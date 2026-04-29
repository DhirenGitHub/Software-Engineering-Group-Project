"""
SEGP Detection Server
=====================
Wraps OptimisedDetector / PushDetector in a Flask MJPEG server.

Usage
-----
    python server/app.py

Phone live detection (no app needed)
-------------------------------------
1. Make sure your phone and PC are on the same WiFi.
2. Start this server — it prints a QR-friendly URL at startup.
3. Open  http://<your-pc-ip>:5000/capture/CAM01  in iPhone Safari.
4. Allow camera access → frames are pushed to the server automatically.
5. In the React UI → Settings → Add Camera:
       Source type : MJPEG HTTP
       Stream URL  : http://<your-pc-ip>:5000/video/CAM01

REST API
--------
POST   /cameras          — register a camera (source or push type)
GET    /cameras          — list registered cameras
DELETE /cameras/<id>     — stop & remove
GET    /video/<id>       — MJPEG stream with detection overlay
POST   /frame/<id>       — push a JPEG frame (used by capture page)
GET    /capture/<id>     — HTML capture page to open on the phone
GET    /health           — liveness check

POST /cameras body (JSON):
    {
        "id":     "CAM01",
        "source": "push",          // "push" = phone browser, "0" = webcam,
                                   // or any file/stream URL
        "conf":   0.40,
        "iou":    0.45
    }
"""

import sys
import socket
import time

# Force unbuffered stdout so logs appear in real-time
if not sys.stdout.line_buffering:
    sys.stdout.reconfigure(line_buffering=True)
import uuid
import threading
from pathlib import Path
from collections import deque

import cv2
from flask import Flask, Response, jsonify, request, send_from_directory

from detector import OptimisedDetector, PushDetector, get_clip_status, search_clips

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH       = str(Path(__file__).parent.parent / "assets" / "YOLO.onnx")
PHONE_MODEL_PATH = str(Path(__file__).parent.parent / "assets" / "phone_best.pt")
COCO_MODEL_PATH  = str(Path(__file__).parent.parent / "assets" / "yolov8n.pt")
CROPS_DIR  = str(Path(__file__).parent / "crops")
ALERT_PREVIEWS_DIR = Path(__file__).parent / "alert_previews"
HOST       = "0.0.0.0"
PORT       = 5000
JPEG_Q     = 75

ALERT_PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)


# ── Discover local IP (so we can print the phone URL) ─────────────────────────
def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


# ── App ───────────────────────────────────────────────────────────────────────
app = Flask(__name__)
_detectors: dict[str, OptimisedDetector | PushDetector] = {}
_alerts = deque(maxlen=60)
_alert_cooldowns: dict[tuple[str, str], float] = {}
_alert_counter = 0

ALERT_COOLDOWNS = {
    "phone": 8.0,
    "crowd": 12.0,
    "offline": 20.0,
}

ALERT_KINDS = {
    "phone": {
        "severity": "warning",
        "priorityLabel": "Medium",
        "category": "Device Misuse",
        "status": "open",
    },
    "crowd": {
        "severity": "warning",
        "priorityLabel": "Medium",
        "category": "Crowd Monitoring",
        "status": "open",
    },
    "offline": {
        "severity": "info",
        "priorityLabel": "Low",
        "category": "Feed Health",
        "status": "open",
    },
    "surge": {
        "severity": "critical",
        "priorityLabel": "High",
        "category": "Crowd Anomaly",
        "status": "open",
    },
    "dispersal": {
        "severity": "warning",
        "priorityLabel": "Medium",
        "category": "Crowd Anomaly",
        "status": "open",
    },
}

ALERT_THRESHOLDS = {
    "crowd_people": 4,
    "offline_after": 8.0,
}

ANALYTICS_CONFIG = {
    "detection_confidence": 0.40,
    "nms_iou": 0.45,
    "crowd_threshold": ALERT_THRESHOLDS["crowd_people"],
    "offline_after_seconds": ALERT_THRESHOLDS["offline_after"],
    "default_model": "person",
}


# ── CORS ──────────────────────────────────────────────────────────────────────
@app.after_request
def _cors(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    return response

@app.route("/<path:path>", methods=["OPTIONS"])
def _options(path):
    return _cors(Response())


def _next_alert_id():
    global _alert_counter
    _alert_counter += 1
    return _alert_counter


def _format_timestamp(ts: float) -> str:
    return time.strftime("%H:%M:%S", time.localtime(ts))


def _resolve_compute_device() -> str:
    try:
        import torch
        return "GPU (CUDA)" if torch.cuda.is_available() else "CPU"
    except Exception:
        return "CPU"


def _serialize_analytics_config():
    search_status = get_clip_status()
    return {
        **ANALYTICS_CONFIG,
        "activeCameraCount": len(_detectors),
        "searchBackend": "ChromaDB",
        "searchReady": bool(search_status.get("ready")),
        "computeDevice": _resolve_compute_device(),
        "availableModels": [
            {"value": "person", "label": "Person Detection"},
            {"value": "both", "label": "Person & Phone Detection"},
            {"value": "phone", "label": "Phone Detection"},
        ],
    }


def _apply_analytics_config(updates: dict):
    detection_confidence = updates.get("detection_confidence")
    if detection_confidence is not None:
        detection_confidence = max(0.05, min(0.95, float(detection_confidence)))
        ANALYTICS_CONFIG["detection_confidence"] = detection_confidence
        for detector in _detectors.values():
            detector.conf = detection_confidence

    nms_iou = updates.get("nms_iou")
    if nms_iou is not None:
        nms_iou = max(0.05, min(0.95, float(nms_iou)))
        ANALYTICS_CONFIG["nms_iou"] = nms_iou
        for detector in _detectors.values():
            detector.iou = nms_iou

    crowd_threshold = updates.get("crowd_threshold")
    if crowd_threshold is not None:
        crowd_threshold = max(1, min(50, int(crowd_threshold)))
        ANALYTICS_CONFIG["crowd_threshold"] = crowd_threshold
        ALERT_THRESHOLDS["crowd_people"] = crowd_threshold

    offline_after = updates.get("offline_after_seconds")
    if offline_after is not None:
        offline_after = max(3.0, min(120.0, float(offline_after)))
        ANALYTICS_CONFIG["offline_after_seconds"] = offline_after
        ALERT_THRESHOLDS["offline_after"] = offline_after

    default_model = updates.get("default_model")
    if default_model in {"person", "both", "phone"}:
        ANALYTICS_CONFIG["default_model"] = default_model


def _delete_alert_preview(preview_name: str | None):
    if not preview_name:
        return

    try:
        preview_path = ALERT_PREVIEWS_DIR / preview_name
        if preview_path.exists():
            preview_path.unlink()
    except OSError:
        pass


def _capture_alert_preview(cam_id: str, alert_id: int):
    detector = _detectors.get(cam_id)
    if detector is None:
        return None, None

    frame, _ = detector.get_latest()
    if frame is None:
        return None, None

    preview_name = f"alert_{alert_id}.jpg"
    preview_path = ALERT_PREVIEWS_DIR / preview_name
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_Q])
    if not ok:
        return None, None

    preview_path.write_bytes(buf.tobytes())
    return f"http://localhost:{PORT}/alert-previews/{preview_name}", preview_name


def _push_alert(cam_id: str, kind: str, alert_type: str, target: str, detail: str, ts: float):
    cooldown_key = (cam_id, kind)
    last_emitted = _alert_cooldowns.get(cooldown_key, 0.0)
    cooldown = ALERT_COOLDOWNS.get(kind, 10.0)
    if ts - last_emitted < cooldown:
        return

    _alert_cooldowns[cooldown_key] = ts
    alert_id = _next_alert_id()
    alert_config = ALERT_KINDS.get(kind, {
        "severity": "warning",
        "priorityLabel": "Medium",
        "category": "General",
        "status": "open",
    })
    preview_url, preview_file = _capture_alert_preview(cam_id, alert_id)
    alert_obj = {
        "id": alert_id,
        "cameraId": cam_id,
        "kind": kind,
        "severity": alert_config["severity"],
        "priorityLabel": alert_config["priorityLabel"],
        "category": alert_config["category"],
        "status": alert_config["status"],
        "type": alert_type,
        "target": target,
        "detail": detail,
        "timestamp": _format_timestamp(ts),
        "eventTime": ts,
        "previewUrl": preview_url,
        "previewFile": preview_file,
    }
    if len(_alerts) >= _alerts.maxlen:
        expired = _alerts.pop()
        _delete_alert_preview(expired.get("previewFile"))
    _alerts.appendleft(alert_obj)
    print(f"[alerts] ✅ FIRED #{alert_obj['id']}: {alert_type} on {cam_id} — {detail}")


def _sync_alerts():
    now = time.time()

    for cam_id, detector in _detectors.items():
        stats = detector.get_latest_stats() if hasattr(detector, "get_latest_stats") else {}
        if not stats:
            continue

        updated_at = float(stats.get("updated_at") or 0.0)
        has_frame = bool(stats.get("has_frame"))

        # ── Use peak stats (accumulated since last consume) for reliable alerting
        peaks = detector.consume_peak_stats() if hasattr(detector, "consume_peak_stats") else {}
        peak_phone = int(peaks.get("peak_phone_count") or 0)
        peak_person = int(peaks.get("peak_person_count") or 0)

        # Also check current frame (in case consume just reset peaks)
        cur_phone = int(stats.get("phone_count") or 0)
        cur_person = int(stats.get("person_count") or 0)
        phone_count = max(peak_phone, cur_phone)
        person_count = max(peak_person, cur_person)

        # Always use wall-clock time so the cooldown timer actually progresses
        alert_ts = now

        if phone_count > 0 or person_count > 0:
            print(f"[alerts] {cam_id}: phone={phone_count} (peak={peak_phone}, cur={cur_phone}), "
                  f"person={person_count} (peak={peak_person}, cur={cur_person})")

        if phone_count > 0:
            _push_alert(
                cam_id=cam_id,
                kind="phone",
                alert_type="Phone Detection",
                target=cam_id,
                detail=f"{phone_count} phone{'s' if phone_count != 1 else ''} detected on this feed",
                ts=alert_ts,
            )

        if person_count >= ALERT_THRESHOLDS["crowd_people"]:
            _push_alert(
                cam_id=cam_id,
                kind="crowd",
                alert_type="Zone Capacity Warning",
                target=cam_id,
                detail=f"{person_count} people visible in the current frame",
                ts=alert_ts,
            )

        if has_frame and updated_at and now - updated_at >= ALERT_THRESHOLDS["offline_after"]:
            _push_alert(
                cam_id=cam_id,
                kind="offline",
                alert_type="Feed Timeout",
                target=cam_id,
                detail="No fresh frames received recently from this camera",
                ts=now,
            )

        # Crowd anomaly alerts (surge / dispersal)
        anomaly = getattr(detector, "_anomaly_state", {})
        if anomaly.get("active") and anomaly.get("kind") in {"surge", "dispersal"}:
            kind = anomaly["kind"]
            alert_type = "Crowd Surge Detected" if kind == "surge" else "Sudden Crowd Dispersal"
            _push_alert(
                cam_id=cam_id,
                kind=kind,
                alert_type=alert_type,
                target=cam_id,
                detail=anomaly.get("detail", ""),
                ts=now,
            )


def _alert_sync_loop():
    """Background thread: runs _sync_alerts every 3 seconds so alerts fire
    proactively even when no frontend is polling."""
    while True:
        time.sleep(3)
        try:
            _sync_alerts()
        except Exception as exc:
            print(f"[alerts] sync error: {exc}")


# ── REST routes ───────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "cameras": list(_detectors.keys())})


@app.route("/analytics/config", methods=["GET", "POST"])
def analytics_config():
    if request.method == "POST":
        body = request.get_json(force=True) or {}
        _apply_analytics_config(body)
    return jsonify(_serialize_analytics_config())


@app.route("/debug/<cam_id>")
def debug_camera(cam_id):
    """Return raw detection stats for a camera — for debugging."""
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "not found"}), 404
    stats = d.get_latest_stats() if hasattr(d, "get_latest_stats") else {}
    peaks = {"peak_phone_count": d._peak_stats.get("peak_phone_count", 0),
             "peak_person_count": d._peak_stats.get("peak_person_count", 0),
             "peak_updated_at": d._peak_stats.get("peak_updated_at", 0)} if hasattr(d, "_peak_stats") else {}
    return jsonify({
        "cam_id": cam_id,
        "current_stats": stats,
        "peak_stats_snapshot": peaks,
        "alert_count": len(_alerts),
        "detector_running": getattr(d, "_running", None),
        "model_paths": getattr(d, "model_paths", []),
        "features": {
            "anomaly": getattr(d, "anomaly_enabled", False),
        },
        "anomaly_state": getattr(d, "_anomaly_state", {}),
    })


@app.route("/alerts", methods=["GET"])
def list_alerts():
    # No need to call _sync_alerts() here — the background thread handles it
    return jsonify(list(_alerts))


@app.route("/alert-previews/<path:filename>", methods=["GET"])
def alert_preview(filename):
    return send_from_directory(ALERT_PREVIEWS_DIR, filename)


@app.route("/cameras", methods=["GET"])
def list_cameras():
    return jsonify([
        {"id": cid, "source": str(d.source), "type": type(d).__name__}
        for cid, d in _detectors.items()
    ])


@app.route("/cameras", methods=["POST"])
def add_camera():
    body   = request.get_json(force=True)
    cam_id = body.get("id") or f"CAM{str(uuid.uuid4())[:4].upper()}"
    source = body.get("source", "push")
    conf   = float(body.get("conf", ANALYTICS_CONFIG["detection_confidence"]))
    iou    = float(body.get("iou",  ANALYTICS_CONFIG["nms_iou"]))
    model_type = body.get("model", ANALYTICS_CONFIG["default_model"])

    if cam_id in _detectors:
        return jsonify({"error": f"{cam_id} already exists"}), 409

    # ── Model / class-filter selection ──────────────────────────────────────
    #
    # person : YOLO.onnx (large, accurate person-only model)
    # phone  : yolov8n.pt (COCO) → class 67 (cell phone)
    # both   : two models — YOLO.onnx for persons + yolov8n.pt for phones
    #          each model gets its OWN class filter via per_model_classes
    #
    # per_model_classes is a list parallel to active_model_path:
    #   None  → single filter shared by all models  (backwards compat)
    #   [...]  → one filter per model
    # ───────────────────────────────────────────────────────────────────────

    if model_type == "phone":
        # Use custom phone_best.pt
        active_model_path = PHONE_MODEL_PATH
        cls_filter = [0]  # In custom phone model, class 0 is 'Mobile-phone'
        per_model_classes = None  # single model, single filter
    elif model_type == "both":
        # Two models: person model + custom phone model
        active_model_path = [MODEL_PATH, PHONE_MODEL_PATH]
        cls_filter = None  # ignored when per_model_classes is set
        per_model_classes = [None, [0]]  # person model: all classes, phone model: class 0
    else:
        # Default: person-only
        active_model_path = MODEL_PATH
        cls_filter = None
        per_model_classes = None

    print(f"[server] add_camera {cam_id}: model_type={model_type}, "
          f"path={active_model_path}, classes={cls_filter}, per_model={per_model_classes}")

    if source == "push":
        detector = PushDetector(active_model_path, conf=conf, iou=iou,
                                classes=cls_filter, per_model_classes=per_model_classes)
    else:
        detector = OptimisedDetector(active_model_path, source=source, conf=conf, iou=iou,
                                     classes=cls_filter, per_model_classes=per_model_classes)

    detector.start()
    _detectors[cam_id] = detector
    _sync_alerts()

    ip = _local_ip()
    return jsonify({
        "id":      cam_id,
        "stream":  f"http://{ip}:{PORT}/video/{cam_id}",
        "capture": f"http://{ip}:{PORT}/capture/{cam_id}",
    }), 201


@app.route("/cameras/<cam_id>", methods=["DELETE"])
def remove_camera(cam_id):
    d = _detectors.pop(cam_id, None)
    if d is None:
        return jsonify({"error": "not found"}), 404
    d.stop()
    return jsonify({"stopped": cam_id})


@app.route("/cameras/<cam_id>/features", methods=["GET", "POST"])
def camera_features(cam_id):
    """Get or set per-camera feature flags (flow, anomaly)."""
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "not found"}), 404
    if request.method == "POST":
        body = request.get_json(force=True) or {}
        if "anomaly" in body:
            d.anomaly_enabled = bool(body["anomaly"])
            if not d.anomaly_enabled:
                d._anomaly_state = {"active": False, "kind": None, "detail": ""}
    return jsonify({
        "anomaly": getattr(d, "anomaly_enabled", False),
        "anomalyState": getattr(d, "_anomaly_state", {}),
    })


# ── Frame push (phone → server) ───────────────────────────────────────────────

@app.route("/frame/<cam_id>", methods=["POST"])
def push_frame(cam_id):
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "camera not registered"}), 404
    if not isinstance(d, PushDetector):
        return jsonify({"error": "camera is not a push type"}), 400

    d.push_frame(request.data)
    _sync_alerts()
    return "", 204


# ── MJPEG stream (server → browser/UI) ───────────────────────────────────────

@app.route("/video/<cam_id>")
def video_feed(cam_id):
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "camera not registered"}), 404

    return Response(
        _generate(d),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/heatmap/<cam_id>")
def heatmap_feed(cam_id):
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "camera not registered"}), 404

    return Response(
        _generate_heatmap(d),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


def _generate(detector):
    waited = 0.0
    while True:
        frame, _ = detector.get_latest()

        if frame is None:
            # If detector stopped (file not found etc.) give up after 5 s
            if not detector._running and waited > 5.0:
                return
            time.sleep(0.02)
            waited += 0.02
            continue
        waited = 0.0

        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_Q])
        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + buf.tobytes()
            + b"\r\n"
        )
        time.sleep(1 / 30)


def _generate_heatmap(detector):
    while True:
        frame = detector.get_latest_heatmap()

        if frame is None:
            time.sleep(0.02)
            continue

        ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_Q])
        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + buf.tobytes()
            + b"\r\n"
        )
        time.sleep(1 / 30)


# ── Smart Search (CLIP + ChromaDB) ───────────────────────────────────────────

@app.route("/search", methods=["POST"])
def search_route():
    body  = request.get_json(force=True)
    query = body.get("query", "").strip()
    if not query:
        return jsonify({"error": "query required"}), 400

    try:
        results = search_clips(query, n_results=5)
    except RuntimeError as exc:
        return jsonify({
            "error": "smart search unavailable",
            "detail": str(exc),
            "searchStatus": get_clip_status(),
        }), 503
    except Exception as exc:
        return jsonify({
            "error": "smart search failed",
            "detail": str(exc),
        }), 500

    base_url = request.host_url.rstrip("/")
    for r in results:
        r["image_url"] = f"{base_url}/crops/{r['image_file']}"
    return jsonify(results)


@app.route("/search/status", methods=["GET"])
def search_status():
    status = get_clip_status()
    status.update({
        "cameraCount": len(_detectors),
        "cameras": list(_detectors.keys()),
        "searchEndpoint": "/search",
    })
    return jsonify(status)


@app.route("/crops/<path:filename>")
def serve_crop(filename):
    return send_from_directory(CROPS_DIR, filename)


# ── Phone capture page ────────────────────────────────────────────────────────

@app.route("/capture/<cam_id>")
def capture_page(cam_id):
    ip   = _local_ip()
    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>SEGP Camera — {cam_id}</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: #080808;
      color: #9fa09e;
      font-family: -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100dvh;
      padding: 20px 16px;
      gap: 16px;
    }}
    h2 {{ font-size: 13px; letter-spacing: 0.1em; color: #4a4a4a; margin-top: 8px; }}
    #status {{
      font-size: 11px;
      padding: 6px 14px;
      border-radius: 20px;
      background: #141414;
      border: 1px solid #252525;
    }}
    #status.sending  {{ color: #38b45a; border-color: #1a3a22; }}
    #status.waiting  {{ color: #9fa09e; }}
    #status.error    {{ color: #d52521; border-color: #3a1a1a; }}
    video {{
      width: 100%;
      max-width: 480px;
      border-radius: 8px;
      border: 1px solid #1a1a1a;
      background: #000;
      display: none;
    }}
    #fps {{ font-size: 10px; color: #3c3c3c; }}
    #hint {{
      font-size: 10px;
      color: #2e2e2e;
      text-align: center;
      max-width: 320px;
      line-height: 1.6;
      margin-top: 8px;
    }}
  </style>
</head>
<body>
  <h2>SEGP · {cam_id}</h2>
  <div id="status" class="waiting">Waiting for camera…</div>
  <video id="v" autoplay playsinline muted></video>
  <div id="fps"></div>
  <p id="hint">Keep this page open on your phone.<br>View the annotated feed on the PC dashboard.</p>

  <canvas id="c" style="display:none"></canvas>

  <script>
    const CAM_ID   = "{cam_id}";
    const SERVER   = "http://{ip}:{PORT}";
    const INTERVAL = 100; // ms between frames (~10 fps — tune to taste)
    const QUALITY  = 0.6; // JPEG quality sent to server

    const video  = document.getElementById("v");
    const canvas = document.getElementById("c");
    const ctx    = canvas.getContext("2d");
    const status = document.getElementById("status");
    const fpsEl  = document.getElementById("fps");

    let sending  = false;
    let framesSent = 0;
    let lastFpsCheck = Date.now();

    async function startCamera() {{
      try {{
        const stream = await navigator.mediaDevices.getUserMedia({{
          video: {{ facingMode: "environment", width: {{ ideal: 1280 }}, height: {{ ideal: 720 }} }},
          audio: false,
        }});
        video.srcObject = stream;
        video.style.display = "block";
        status.textContent = "Camera ready — connecting…";
        status.className   = "waiting";

        // Make sure camera is registered on the server
        await fetch(SERVER + "/cameras", {{
          method: "POST",
          headers: {{ "Content-Type": "application/json" }},
          body: JSON.stringify({{ id: CAM_ID, source: "push" }}),
        }}).catch(() => {{}});  // 409 = already exists, that's fine

        startSending();
      }} catch (e) {{
        status.textContent = "Camera denied — allow access and reload";
        status.className   = "error";
      }}
    }}

    function startSending() {{
      setInterval(async () => {{
        if (sending || video.readyState < 2) return;
        sending = true;
        try {{
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);

          const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", QUALITY));
          await fetch(`${{SERVER}}/frame/${{CAM_ID}}`, {{
            method: "POST",
            body:   blob,
          }});

          framesSent++;
          status.textContent = "Sending frames…";
          status.className   = "sending";
        }} catch (e) {{
          status.textContent = "Connection lost — retrying…";
          status.className   = "error";
        }} finally {{
          sending = false;
        }}
      }}, INTERVAL);

      // FPS counter
      setInterval(() => {{
        const now     = Date.now();
        const elapsed = (now - lastFpsCheck) / 1000;
        fpsEl.textContent = `${{(framesSent / elapsed).toFixed(1)}} fps sent`;
        framesSent   = 0;
        lastFpsCheck = now;
      }}, 2000);
    }}

    startCamera();
  </script>
</body>
</html>"""
    return Response(html, mimetype="text/html")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    ip = _local_ip()
    print(f"[server] Model   : {MODEL_PATH}")
    print(f"[server] Local IP: {ip}")
    print()
    print("  ── Phone live detection (no app needed) ──────────────────")
    print(f"  1. Open on iPhone Safari: http://{ip}:{PORT}/capture/CAM01")
    print(f"  2. Allow camera → frames stream to this server")
    print(f"  3. Add to UI — Source: MJPEG HTTP  URL: http://{ip}:{PORT}/video/CAM01")
    print("  ──────────────────────────────────────────────────────────")
    print()
    print("  ── Local file / webcam ───────────────────────────────────")
    print(f'  curl -X POST http://localhost:{PORT}/cameras \\')
    print(f'       -H "Content-Type: application/json" \\')
    print(f'       -d \'{{"id":"CAM01","source":"UI/public/test.mp4"}}\'')
    print("  ──────────────────────────────────────────────────────────")
    print()
    # Start background alert sync thread
    threading.Thread(target=_alert_sync_loop, daemon=True).start()
    print("[server] Alert sync thread started (every 3s)")
    app.run(host=HOST, port=PORT, threaded=True)
