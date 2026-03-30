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
import numpy as np
import cv2
from pathlib import Path
from ultralytics import YOLO


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


# ── CLIP / ChromaDB live indexer ─────────────────────────────────────────────

_CLIP_MODEL_ID  = "openai/clip-vit-base-patch32"
_CROPS_DIR      = str(Path(__file__).parent / "crops")
_DB_DIR         = str(Path(__file__).parent / "chroma_db")
_INDEX_INTERVAL = 2.0   # seconds between indexed frames per detector

_clip_model      = None
_clip_processor  = None
_clip_device     = None
_chroma_col      = None
_index_queue:    _queue.Queue | None = None
_clip_ready      = False
_clip_init_lock  = threading.Lock()

_index_id_count  = 0
_index_id_lock   = threading.Lock()


def _init_clip_indexer():
    """Lazily load CLIP + ChromaDB on first detector start. Thread-safe."""
    global _clip_model, _clip_processor, _clip_device, _chroma_col
    global _index_queue, _clip_ready

    with _clip_init_lock:
        if _clip_ready:
            return
        try:
            import torch
            import chromadb
            from PIL import Image                 # noqa: F401 — tested here
            from transformers import CLIPProcessor, CLIPModel

            os.makedirs(_CROPS_DIR, exist_ok=True)
            _clip_device    = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[indexer] Loading CLIP on {_clip_device} …")
            _clip_model     = CLIPModel.from_pretrained(_CLIP_MODEL_ID).to(_clip_device)
            _clip_processor = CLIPProcessor.from_pretrained(_CLIP_MODEL_ID)

            client      = chromadb.PersistentClient(path=_DB_DIR)
            _chroma_col = client.get_or_create_collection(name="video_people_search")

            _index_queue = _queue.Queue(maxsize=50)
            threading.Thread(target=_clip_worker, daemon=True).start()

            _clip_ready = True
            print("[indexer] CLIP + ChromaDB ready — live search enabled")
        except Exception as exc:
            print(f"[indexer] CLIP unavailable — search disabled ({exc})")


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
                feats = _clip_model.get_image_features(**inputs)


            if not isinstance(feats, torch.Tensor):
                feats = getattr(feats, 'pooler_output', feats[0])

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
    if not _clip_ready:
        return []
    try:
        import torch
        inputs = _clip_processor(text=[query_text], return_tensors="pt",
                                 padding=True).to(_clip_device)
        with torch.no_grad():
            feats = _clip_model.get_text_features(**inputs)


        if not isinstance(feats, torch.Tensor):
            feats = getattr(feats, 'pooler_output', feats[0])

        vector = feats.cpu().numpy().flatten().tolist()

        raw = _chroma_col.query(query_embeddings=[vector], n_results=n_results)
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
        model_path: str,
        source,                # file path, RTSP URL, MJPEG URL, or device index (int)
        conf: float = 0.40,
        iou:  float = 0.45,
        imgsz: int  = 416,
    ):
        print(f"[detector] Loading ONNX model from {model_path} …")
        self.model  = YOLO(model_path)
        self.source = source
        self.conf   = conf
        self.iou    = iou
        self.imgsz  = imgsz

        self._latest_frame:     cv2.typing.MatLike | None = None
        self._annotated_frame:  cv2.typing.MatLike | None = None
        self._count:            int                        = 0
        self._lock              = threading.Lock()
        self._running           = False

        self._heat_accumulator: np.ndarray | None          = None
        self._heatmap_frame:    cv2.typing.MatLike | None  = None
        self._last_index_time:  float                      = 0.0

        # For webcam / device sources, cv2 expects an int index
        self._cv2_source = int(source) if str(source).isdigit() else source

    # ── public API ──────────────────────────────────────────────────────────

    def start(self):
        self._running = True
        threading.Thread(target=self._capture_loop,   daemon=True).start()
        threading.Thread(target=self._inference_loop, daemon=True).start()
        threading.Thread(target=_init_clip_indexer,   daemon=True).start()
        print(f"[detector] Started — source: {self.source}")

    def stop(self):
        self._running = False

    def get_latest(self):
        """Returns (annotated_frame_bgr, person_count) or (None, 0)."""
        with self._lock:
            return self._annotated_frame, self._count

    def get_latest_heatmap(self):
        """Returns heatmap_frame_bgr or None if not yet available."""
        with self._lock:
            return self._heatmap_frame

    # ── background threads ──────────────────────────────────────────────────

    def _capture_loop(self):
        cap = cv2.VideoCapture(self._cv2_source)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # never queue stale frames

        if not cap.isOpened():
            print(f"[detector] ERROR: Cannot open source: {self.source}")
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

            results = self.model(
                frame,
                imgsz=self.imgsz,
                conf=self.conf,
                iou=self.iou,
                verbose=False,
                half=False,        # half precision is GPU only
                agnostic_nms=True, # better for overlapping people in crowds
            )

            annotated = results[0].plot()
            count = len(results[0].boxes)

            h, w = frame.shape[:2]
            if self._heat_accumulator is None:
                self._heat_accumulator = np.zeros((h, w), dtype=np.float32)
            boxes = results[0].boxes.xyxy.cpu().numpy() if count else np.empty((0, 4))
            heatmap_frm = _apply_heatmap(frame, self._heat_accumulator, boxes)

            with self._lock:
                self._annotated_frame = annotated
                self._count           = count
                self._heatmap_frame   = heatmap_frm

            # queue person crops for CLIP indexing (rate-limited, never blocks inference)
            now = time.time()
            if _clip_ready and count and (now - self._last_index_time) >= _INDEX_INTERVAL:
                self._last_index_time = now
                for x1, y1, x2, y2 in boxes:
                    crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    if crop.shape[0] >= 50 and crop.shape[1] >= 50:
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
        model_path: str,
        conf:  float = 0.40,
        iou:   float = 0.45,
        imgsz: int   = 416,
    ):
        print(f"[push-detector] Loading ONNX model from {model_path} …")
        self.model  = YOLO(model_path)
        self.source = "push"
        self.conf   = conf
        self.iou    = iou
        self.imgsz  = imgsz

        self._latest_frame:    np.ndarray | None = None
        self._annotated_frame: np.ndarray | None = None
        self._count:           int               = 0
        self._lock             = threading.Lock()
        self._running          = False
        self._frame_id         = 0   # incremented each push so inference skips dupes

        self._heat_accumulator: np.ndarray | None = None
        self._heatmap_frame:    np.ndarray | None = None
        self._last_index_time:  float             = 0.0

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

            results = self.model(
                frame,
                imgsz=self.imgsz,
                conf=self.conf,
                iou=self.iou,
                verbose=False,
                half=False,
                agnostic_nms=True,
            )

            annotated = results[0].plot()
            count     = len(results[0].boxes)

            h, w = frame.shape[:2]
            if self._heat_accumulator is None:
                self._heat_accumulator = np.zeros((h, w), dtype=np.float32)
            boxes = results[0].boxes.xyxy.cpu().numpy() if count else np.empty((0, 4))
            heatmap_frm = _apply_heatmap(frame, self._heat_accumulator, boxes)

            with self._lock:
                self._annotated_frame = annotated
                self._count           = count
                self._heatmap_frame   = heatmap_frm

            # queue person crops for CLIP indexing (rate-limited, never blocks inference)
            now = time.time()
            if _clip_ready and count and (now - self._last_index_time) >= _INDEX_INTERVAL:
                self._last_index_time = now
                for x1, y1, x2, y2 in boxes:
                    crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    if crop.shape[0] >= 50 and crop.shape[1] >= 50:
                        try:
                            _index_queue.put_nowait(
                                (crop.copy(), now, str(self.source)))
                        except _queue.Full:
                            pass  # drop silently — never block inference
