"""
OptimisedDetector — threaded capture + ONNX inference, always processes the
latest frame so slow inference never causes a backlog.

PushDetector — same inference loop but receives frames via HTTP POST
(used for phone cameras that push frames from the browser).
"""

import os
import queue as _queue
import threading
import time
from collections import deque
import numpy as np
import cv2
from pathlib import Path
from ultralytics import YOLO

_global_models = {}


def classify_detection_label(label) -> str | None:
    normalized = str(label).strip().lower()
    if not normalized:
        return None
    if "phone" in normalized or "cell" in normalized:
        return "phone"
    if "person" in normalized:
        return "person"
    return None

def get_yolo_model(path: str):
    if path not in _global_models:
        print(f"[backend] Loading YOLO cache for {path} …")
        _global_models[path] = YOLO(path)
    return _global_models[path]

def resize_frame(frame, max_dim=640):
    h, w = frame.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        frame = cv2.resize(frame, (int(w * scale), int(h * scale)))
    return frame


# ── Heatmap helper ───────────────────────────────────────────────────────────

_HEAT_INTENSITY = 100
_HEAT_DECAY     = 0.999
_HEAT_BLUR      = (51, 51)


def _apply_heatmap(frame, accumulator, boxes_xyxy):
    """Update accumulator with bottom-centre points from boxes, return blended overlay frame."""
    h, w = frame.shape[:2]
    for x1, y1, x2, y2 in boxes_xyxy:
        cx, cy = int((x1 + x2) / 2), int(y2)
        if 0 <= cx < w and 0 <= cy < h:
            cv2.circle(accumulator, (cx, cy), radius=15,
                       color=(_HEAT_INTENSITY), thickness=-1)
    np.multiply(accumulator, _HEAT_DECAY, out=accumulator)
    blurred  = cv2.GaussianBlur(np.clip(accumulator, 0, 255), _HEAT_BLUR, 0)
    colormap = cv2.applyColorMap(blurred.astype(np.uint8), cv2.COLORMAP_JET)
    mask     = blurred > 15
    mask_3ch = np.stack([mask] * 3, axis=2)
    blended  = cv2.addWeighted(frame, 0.6, colormap, 0.4, 0)
    out      = frame.copy()
    np.putmask(out, mask_3ch, blended)
    return out


def _detect_crowd_anomaly(count_history):
    """Return anomaly dict if a sudden surge or dispersal is detected in the last 4 s."""
    if len(count_history) < 3:
        return {"active": False, "kind": None, "detail": ""}
    now = time.time()
    recent = [(t, c) for t, c in count_history if now - t <= 4.0]
    if len(recent) < 2:
        return {"active": False, "kind": None, "detail": ""}
    delta = recent[-1][1] - recent[0][1]
    if delta >= 4:
        return {"active": True, "kind": "surge",
                "detail": f"Sudden crowd surge (+{delta} people in 4 s)"}
    if delta <= -4:
        return {"active": True, "kind": "dispersal",
                "detail": f"Sudden dispersal ({abs(delta)} people left in 4 s)"}
    return {"active": False, "kind": None, "detail": ""}


# ── CLIP / ChromaDB live indexer ─────────────────────────────────────────────

_CLIP_MODEL_ID  = "openai/clip-vit-base-patch32"
_CLIP_MODEL_DIR = Path(__file__).parent / "models" / "clip-vit-base-patch32"
_CROPS_DIR      = str(Path(__file__).parent / "crops")
_DB_DIR         = str((Path(os.getenv("LOCALAPPDATA", str(Path.home() / "AppData" / "Local"))) / "Temp" / "segp_chroma_db").resolve())
_COLLECTION_NAME = "video_people_search"
_INDEX_INTERVAL = 2.0   # seconds between indexed frames per detector

_clip_model      = None
_clip_processor  = None
_clip_device     = None
_chroma_col      = None
_index_queue:    _queue.Queue | None = None
_clip_ready      = False
_clip_error      = None
_clip_init_lock  = threading.Lock()
_db_storage_mode = "persistent"
_db_runtime_path = _DB_DIR

_index_id_count  = 0
_index_id_lock   = threading.Lock()


def _init_clip_indexer():
    """Lazily load CLIP + ChromaDB on first detector start. Thread-safe."""
    global _clip_model, _clip_processor, _clip_device, _chroma_col
    global _index_queue, _clip_ready, _clip_error, _db_storage_mode, _db_runtime_path

    with _clip_init_lock:
        if _clip_ready:
            return True
        try:
            import torch
            import chromadb
            from PIL import Image                 # noqa: F401 — tested here
            from transformers import CLIPProcessor, CLIPModel

            os.makedirs(_CROPS_DIR, exist_ok=True)
            _clip_device    = "cuda" if torch.cuda.is_available() else "cpu"
            clip_source     = str(_CLIP_MODEL_DIR) if _CLIP_MODEL_DIR.exists() else _CLIP_MODEL_ID
            print(f"[indexer] Loading CLIP on {_clip_device} …")
            _clip_model     = CLIPModel.from_pretrained(clip_source).to(_clip_device)
            _clip_processor = CLIPProcessor.from_pretrained(clip_source)

            db_path = Path(_DB_DIR)
            db_path.mkdir(parents=True, exist_ok=True)
            try:
                client = chromadb.PersistentClient(path=str(db_path))
                _db_storage_mode = "persistent"
                _db_runtime_path = str(db_path)
            except Exception as db_exc:
                print(f"[indexer] Persistent ChromaDB unavailable, falling back to session memory ({db_exc})")
                client = chromadb.EphemeralClient()
                _db_storage_mode = "ephemeral"
                _db_runtime_path = "memory"
            _chroma_col = client.get_or_create_collection(name=_COLLECTION_NAME)
            
            global _index_id_count
            try:
                _index_id_count = _chroma_col.count()
            except:
                _index_id_count = 0

            _index_queue = _queue.Queue(maxsize=50)
            threading.Thread(target=_clip_worker, daemon=True).start()

            _clip_ready = True
            _clip_error = None
            print("[indexer] CLIP + ChromaDB ready — live search enabled")
            return True
        except Exception as exc:
            _clip_error = str(exc)
            print(f"[indexer] CLIP unavailable — search disabled ({exc})")
            return False


def get_clip_status() -> dict:
    count = 0
    if _clip_ready and _chroma_col is not None:
        try:
            count = _chroma_col.count()
        except Exception:
            count = 0

    return {
        "ready": _clip_ready,
        "error": _clip_error,
        "indexed_items": count,
        "queued_items": _index_queue.qsize() if _index_queue is not None else 0,
        "database": "ChromaDB",
        "collection": _COLLECTION_NAME,
        "persist_dir": _db_runtime_path,
        "storage_mode": _db_storage_mode,
        "crops_dir": "server/crops",
        "model_id": _CLIP_MODEL_ID,
        "model_source": str(_CLIP_MODEL_DIR) if _CLIP_MODEL_DIR.exists() else _CLIP_MODEL_ID,
        "device": _clip_device,
    }


def _clip_worker():
    """Background thread: dequeues person crops and stores CLIP embeddings."""
    global _index_id_count
    import torch
    from PIL import Image

    while True:
        item = _index_queue.get()
        if item is None:
            break
        crop_bgr, timestamp, cam_id = item
        try:
            pil_img = Image.fromarray(cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2RGB))
            inputs  = _clip_processor(images=pil_img, return_tensors="pt").to(_clip_device)
            with torch.no_grad():
                feats = _clip_model.get_image_features(pixel_values=inputs["pixel_values"])

            if not isinstance(feats, torch.Tensor):
                feats = getattr(feats, 'image_embeds', getattr(feats, 'pooler_output', feats[0]))

            vector = feats.cpu().numpy().flatten().tolist()

            with _index_id_lock:
                _index_id_count += 1
                idx = _index_id_count
            crop_file = f"crop_{idx}_t{timestamp:.1f}.jpg"
            cv2.imwrite(os.path.join(_CROPS_DIR, crop_file), crop_bgr)

            _chroma_col.add(
                embeddings=[vector],
                metadatas=[{"timestamp": timestamp, "cam_id": cam_id,
                            "image_file": crop_file}],
                ids=[f"id_{idx}"],
            )
        except Exception as exc:
            print(f"[indexer] worker error: {exc}")


def search_clips(query_text: str, n_results: int = 5) -> list:
    """Convert text to CLIP embedding, query ChromaDB, return ranked results."""
    if not _clip_ready and not _init_clip_indexer():
        raise RuntimeError(_clip_error or "Smart search is still starting up")
    try:
        import torch
        inputs = _clip_processor(text=[query_text], return_tensors="pt",
                                 padding=True).to(_clip_device)
        with torch.no_grad():
            feats = _clip_model.get_text_features(**inputs)


        if not isinstance(feats, torch.Tensor):
            feats = getattr(feats, 'pooler_output', feats[0])

        vector = feats.cpu().numpy().flatten().tolist()

        cnt = _chroma_col.count()
        if cnt == 0:
            return []
            
        actual_n = min(n_results, cnt)
        raw = _chroma_col.query(query_embeddings=[vector], n_results=actual_n)
        out = []
        for i, meta in enumerate(raw["metadatas"][0]):
            out.append({
                "timestamp":  meta["timestamp"],
                "cam_id":     meta.get("cam_id", ""),
                "image_file": meta["image_file"],
                "score":      round(raw["distances"][0][i], 4),
            })
        return out
    except Exception as exc:
        print(f"[indexer] search error: {exc}")
        return []


class OptimisedDetector:
    """
    Two background threads:
      - _capture_loop: continuously reads frames, always keeps only the newest
      - _inference_loop: picks up the latest frame, runs YOLO, stores results

    Call get_latest() from the MJPEG generator — it returns (annotated_frame, count).
    """

    def __init__(
        self,
        model_path,
        source,                # file path, RTSP URL, MJPEG URL, or device index (int)
        conf: float = 0.40,
        iou:  float = 0.45,
        imgsz: int  = 416,
        classes: list = None,
        per_model_classes: list = None,
    ):
        print(f"[detector] Initialising models from {model_path} …")
        if isinstance(model_path, list):
            self.models = [get_yolo_model(p) for p in model_path]
            self.model_paths = model_path
        else:
            self.models = [get_yolo_model(model_path)]
            self.model_paths = [model_path]
            
        for m in self.models:
            for k, v in list(m.names.items()):
                if "phone" in v.lower() or "cell" in v.lower():
                    m.names[k] = "phone"
        self.source = source
        self.conf   = conf
        self.iou    = iou
        self.classes = classes
        self.per_model_classes = per_model_classes
        
        # In combined mode we use multiple models, determine max imgsz needed
        has_coco_phone = any("yolov8n" in p.lower() for p in self.model_paths)
        self.imgsz  = 640 if has_coco_phone else imgsz

        self._latest_frame:     cv2.typing.MatLike | None = None
        self._annotated_frame:  cv2.typing.MatLike | None = None
        self._count:            int                        = 0
        self._latest_stats      = {
            "person_count": 0,
            "phone_count": 0,
            "total_count": 0,
            "updated_at": 0.0,
            "has_frame": False,
        }
        self._peak_stats        = {
            "peak_phone_count": 0,
            "peak_person_count": 0,
            "peak_updated_at": 0.0,
        }
        self._lock              = threading.Lock()
        self._running           = False

        self._heat_accumulator: np.ndarray | None          = None
        self._heatmap_frame:    cv2.typing.MatLike | None  = None
        self._last_index_time:  float                      = 0.0
        self._cap = None  # store capture reference for clean release

        # Feature flags (toggled live via /cameras/<id>/features)
        self.anomaly_enabled = False
        self._count_history  = deque(maxlen=120)   # (timestamp, person_count)
        self._anomaly_state  = {"active": False, "kind": None, "detail": ""}

        # For webcam / device sources, cv2 expects an int index.
        # For file paths, resolve relative paths against the project root so
        # paths like "public/video1.mp4" or "../video2.mp4" work when the
        # server is started from any working directory.
        if str(source).isdigit():
            self._cv2_source = int(source)
        else:
            src = str(source).strip().strip('"').strip("'")  # remove accidental surrounding quotes
            if not src.startswith(("rtsp://", "rtmp://", "http://", "https://", "push")):
                candidate = Path(src)
                if not candidate.is_absolute():
                    # resolve relative to the project root (parent of server/)
                    project_root = Path(__file__).parent.parent
                    candidate = (project_root / candidate).resolve()
                if candidate.exists():
                    src = str(candidate)
            self._cv2_source = src

    # ── public API ──────────────────────────────────────────────────────────

    def start(self):
        self._running = True
        threading.Thread(target=self._capture_loop,   daemon=True).start()
        threading.Thread(target=self._inference_loop, daemon=True).start()
        threading.Thread(target=_init_clip_indexer,   daemon=True).start()
        print(f"[detector] Started — source: {self.source}")

    def stop(self):
        self._running = False
        # Explicitly release webcam so the camera light turns off
        if self._cap is not None:
            try:
                self._cap.release()
            except:
                pass
            self._cap = None

    def get_latest(self):
        """Returns (annotated_frame_bgr, person_count) or (None, 0)."""
        with self._lock:
            return self._annotated_frame, self._count

    def get_latest_stats(self):
        with self._lock:
            return dict(self._latest_stats)

    def consume_peak_stats(self):
        """Return peak phone/person counts since last consume, then reset peaks."""
        with self._lock:
            peaks = dict(self._peak_stats)
            self._peak_stats["peak_phone_count"] = 0
            self._peak_stats["peak_person_count"] = 0
            self._peak_stats["peak_updated_at"] = 0.0
            return peaks

    def get_latest_heatmap(self):
        """Returns heatmap_frame_bgr or None if not yet available."""
        with self._lock:
            return self._heatmap_frame

    # ── background threads ──────────────────────────────────────────────────

    def _capture_loop(self):
        cap = cv2.VideoCapture(self._cv2_source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # never queue stale frames
        self._cap = cap  # store for clean release on stop()

        if not cap.isOpened():
            print(f"[detector] ERROR: Cannot open source: {self.source}")
            with self._lock:
                self._latest_stats["source_error"] = f"Cannot open: {self.source}"
            self._running = False
            return

        while self._running:
            ret, frame = cap.read()
            if not ret:
                # End of file — loop video; for live streams, retry briefly
                if isinstance(self._cv2_source, str) and not self._cv2_source.startswith("rtsp"):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop file
                else:
                    time.sleep(0.1)
                continue

            with self._lock:
                self._latest_frame = frame  # always overwrite with newest

        cap.release()

    def _inference_loop(self):
        while self._running:
            with self._lock:
                frame = self._latest_frame

            if frame is None:
                time.sleep(0.01)
                continue

            frame = resize_frame(frame, max_dim=640)

            annotated = frame.copy()
            total_count = 0
            person_count = 0
            phone_count = 0
            all_boxes = []

            for idx, m in enumerate(self.models):
                try:
                    path_str = self.model_paths[idx].lower() if hasattr(self, 'model_paths') else ""
                    # Lower confidence threshold slightly for the COCO phone model
                    current_conf = 0.20 if "yolov8n" in path_str else self.conf

                    # Select appropriate class filter
                    current_classes = self.classes
                    if self.per_model_classes and idx < len(self.per_model_classes):
                        current_classes = self.per_model_classes[idx]
                        
                    # ONNX export was rigidly sized, so check if model is ONNX to use correct size
                    current_imgsz = 416 if "onnx" in path_str else self.imgsz

                    results = m(
                        frame,
                        imgsz=current_imgsz,
                        conf=current_conf,
                        iou=self.iou,
                        classes=current_classes,
                        verbose=False,
                        half=False,        # half precision is GPU only
                        agnostic_nms=True, # better for overlapping people in crowds
                    )
                    annotated = results[0].plot(img=annotated, line_width=2)
                    count = len(results[0].boxes)
                    if count:
                        all_boxes.append(results[0].boxes.xyxy.cpu().numpy())
                        class_ids = results[0].boxes.cls.int().cpu().tolist()
                        for class_id in class_ids:
                            label_kind = classify_detection_label(m.names.get(class_id, class_id))
                            if label_kind == "phone":
                                phone_count += 1
                            elif label_kind == "person":
                                person_count += 1
                    total_count += count
                except Exception as e:
                    print(f"[detector] Error in inference loop for model {idx}: {e}")
                    import traceback
                    traceback.print_exc()
                    continue

            h, w = frame.shape[:2]
            if self._heat_accumulator is None:
                self._heat_accumulator = np.zeros((h, w), dtype=np.float32)
            boxes = np.vstack(all_boxes) if all_boxes else np.empty((0, 4))
            heatmap_frm = _apply_heatmap(frame, self._heat_accumulator, boxes)
            now = time.time()

            # Read feature flags under lock so HTTP toggling can't race
            with self._lock:
                anomaly_on = self.anomaly_enabled

            # Crowd anomaly detection
            anomaly_state = {"active": False, "kind": None, "detail": ""}
            if anomaly_on:
                self._count_history.append((now, person_count))
                anomaly_state = _detect_crowd_anomaly(self._count_history)
            self._anomaly_state = anomaly_state

            with self._lock:
                self._annotated_frame = annotated
                self._count           = total_count
                self._heatmap_frame   = heatmap_frm
                self._latest_stats    = {
                    "person_count": person_count,
                    "phone_count": phone_count,
                    "total_count": total_count,
                    "updated_at": now,
                    "has_frame": True,
                    "anomaly": anomaly_state,
                }
                # Accumulate peaks so alerts never miss transient detections
                if phone_count > self._peak_stats["peak_phone_count"]:
                    self._peak_stats["peak_phone_count"] = phone_count
                    self._peak_stats["peak_updated_at"] = now
                if person_count > self._peak_stats["peak_person_count"]:
                    self._peak_stats["peak_person_count"] = person_count
                    if not self._peak_stats["peak_updated_at"]:
                        self._peak_stats["peak_updated_at"] = now

            # queue person crops for CLIP indexing (rate-limited, never blocks inference)
            if _clip_ready and total_count and (now - self._last_index_time) >= _INDEX_INTERVAL:
                self._last_index_time = now
                for x1, y1, x2, y2 in boxes:
                    crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    if crop.shape[0] >= 20 and crop.shape[1] >= 20:
                        try:
                            _index_queue.put_nowait(
                                (crop.copy(), now, str(self.source)))
                        except _queue.Full:
                            pass  # drop silently — never block inference


class PushDetector:
    """
    Like OptimisedDetector but the capture side is HTTP POST instead of
    cv2.VideoCapture.  The phone browser calls POST /frame/<cam_id> with a
    JPEG body; push_frame() decodes it and the inference thread picks it up.
    """

    def __init__(
        self,
        model_path,
        conf:  float = 0.40,
        iou:   float = 0.45,
        imgsz: int   = 416,
        classes: list = None,
        per_model_classes: list = None,
    ):
        print(f"[push-detector] Initialising models from {model_path} …")
        if isinstance(model_path, list):
            self.models = [get_yolo_model(p) for p in model_path]
            self.model_paths = model_path
        else:
            self.models = [get_yolo_model(model_path)]
            self.model_paths = [model_path]
            
        for m in self.models:
            for k, v in list(m.names.items()):
                if "phone" in v.lower() or "cell" in v.lower():
                    m.names[k] = "phone"
        self.source = "push"
        self.conf   = conf
        self.iou    = iou
        self.classes = classes
        self.per_model_classes = per_model_classes
        
        has_coco_phone = any("yolov8n" in p.lower() for p in self.model_paths)
        self.imgsz  = 640 if has_coco_phone else imgsz

        self._latest_frame:    np.ndarray | None = None
        self._annotated_frame: np.ndarray | None = None
        self._count:           int               = 0
        self._latest_stats     = {
            "person_count": 0,
            "phone_count": 0,
            "total_count": 0,
            "updated_at": 0.0,
            "has_frame": False,
        }
        self._peak_stats       = {
            "peak_phone_count": 0,
            "peak_person_count": 0,
            "peak_updated_at": 0.0,
        }
        self._lock             = threading.Lock()
        self._running          = False
        self._frame_id         = 0   # incremented each push so inference skips dupes

        self._heat_accumulator: np.ndarray | None = None
        self._heatmap_frame:    np.ndarray | None = None
        self._last_index_time:  float             = 0.0

        # Feature flags
        self.anomaly_enabled = False
        self._count_history  = deque(maxlen=120)
        self._anomaly_state  = {"active": False, "kind": None, "detail": ""}

    # ── public API ──────────────────────────────────────────────────────────

    def push_frame(self, jpeg_bytes: bytes):
        """Called by the Flask route — decodes JPEG and stores as latest frame."""
        arr   = np.frombuffer(jpeg_bytes, dtype=np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is not None:
            with self._lock:
                self._latest_frame = frame
                self._frame_id    += 1

    def start(self):
        self._running = True
        threading.Thread(target=self._inference_loop, daemon=True).start()
        threading.Thread(target=_init_clip_indexer,   daemon=True).start()
        print("[push-detector] Started — waiting for frames from phone")

    def stop(self):
        self._running = False

    def get_latest(self):
        """Returns (annotated_frame_bgr, person_count) or (None, 0)."""
        with self._lock:
            return self._annotated_frame, self._count

    def get_latest_stats(self):
        with self._lock:
            return dict(self._latest_stats)

    def consume_peak_stats(self):
        """Return peak phone/person counts since last consume, then reset peaks."""
        with self._lock:
            peaks = dict(self._peak_stats)
            self._peak_stats["peak_phone_count"] = 0
            self._peak_stats["peak_person_count"] = 0
            self._peak_stats["peak_updated_at"] = 0.0
            return peaks

    def get_latest_heatmap(self):
        """Returns heatmap_frame_bgr or None if not yet available."""
        with self._lock:
            return self._heatmap_frame

    # ── inference thread ─────────────────────────────────────────────────────

    def _inference_loop(self):
        last_id = -1
        while self._running:
            with self._lock:
                frame    = self._latest_frame
                frame_id = self._frame_id

            if frame is None or frame_id == last_id:
                time.sleep(0.01)
                continue

            last_id = frame_id
            
            frame = resize_frame(frame, max_dim=640)

            annotated = frame.copy()
            total_count = 0
            person_count = 0
            phone_count = 0
            all_boxes = []

            for idx, m in enumerate(self.models):
                try:
                    path_str = self.model_paths[idx].lower() if hasattr(self, 'model_paths') else ""
                    current_conf = 0.20 if "yolov8n" in path_str else self.conf

                    current_classes = self.classes
                    if self.per_model_classes and idx < len(self.per_model_classes):
                        current_classes = self.per_model_classes[idx]
                        
                    current_imgsz = 416 if "onnx" in path_str else self.imgsz

                    results = m(
                        frame,
                        imgsz=current_imgsz,
                        conf=current_conf,
                        iou=self.iou,
                        classes=current_classes,
                        verbose=False,
                        half=False,
                        agnostic_nms=True,
                    )
                    annotated = results[0].plot(img=annotated, line_width=2)
                    count = len(results[0].boxes)
                    if count:
                        all_boxes.append(results[0].boxes.xyxy.cpu().numpy())
                        class_ids = results[0].boxes.cls.int().cpu().tolist()
                        for class_id in class_ids:
                            label_kind = classify_detection_label(m.names.get(class_id, class_id))
                            if label_kind == "phone":
                                phone_count += 1
                            elif label_kind == "person":
                                person_count += 1
                    total_count += count
                except Exception as e:
                    print(f"[push-detector] Error in inference loop for model {idx}: {e}")
                    continue

            h, w = frame.shape[:2]
            if self._heat_accumulator is None:
                self._heat_accumulator = np.zeros((h, w), dtype=np.float32)
            boxes = np.vstack(all_boxes) if all_boxes else np.empty((0, 4))
            heatmap_frm = _apply_heatmap(frame, self._heat_accumulator, boxes)
            now = time.time()

            # Read feature flags under lock so HTTP toggling can't race
            with self._lock:
                anomaly_on = self.anomaly_enabled

            # Crowd anomaly detection
            anomaly_state = {"active": False, "kind": None, "detail": ""}
            if anomaly_on:
                self._count_history.append((now, person_count))
                anomaly_state = _detect_crowd_anomaly(self._count_history)
            self._anomaly_state = anomaly_state

            with self._lock:
                self._annotated_frame = annotated
                self._count           = total_count
                self._heatmap_frame   = heatmap_frm
                self._latest_stats    = {
                    "person_count": person_count,
                    "phone_count": phone_count,
                    "total_count": total_count,
                    "updated_at": now,
                    "has_frame": True,
                    "anomaly": anomaly_state,
                }
                # Accumulate peaks so alerts never miss transient detections
                if phone_count > self._peak_stats["peak_phone_count"]:
                    self._peak_stats["peak_phone_count"] = phone_count
                    self._peak_stats["peak_updated_at"] = now
                if person_count > self._peak_stats["peak_person_count"]:
                    self._peak_stats["peak_person_count"] = person_count
                    if not self._peak_stats["peak_updated_at"]:
                        self._peak_stats["peak_updated_at"] = now

            # queue person crops for CLIP indexing (rate-limited, never blocks inference)
            if _clip_ready and total_count and (now - self._last_index_time) >= _INDEX_INTERVAL:
                self._last_index_time = now
                for x1, y1, x2, y2 in boxes:
                    crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    if crop.shape[0] >= 20 and crop.shape[1] >= 20:
                        try:
                            _index_queue.put_nowait(
                                (crop.copy(), now, str(self.source)))
                        except _queue.Full:
                            pass  # drop silently — never block inference
