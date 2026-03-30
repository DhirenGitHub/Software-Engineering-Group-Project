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

import socket
import time
import uuid
from pathlib import Path

import cv2
from flask import Flask, Response, jsonify, request, send_from_directory

from detector import OptimisedDetector, PushDetector, search_clips

# ── Config ────────────────────────────────────────────────────────────────────
MODEL_PATH = str(Path(__file__).parent.parent / "assets" / "YOLO.onnx")
CROPS_DIR  = str(Path(__file__).parent / "crops")
HOST       = "0.0.0.0"
PORT       = 5000
JPEG_Q     = 75


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


# ── REST routes ───────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({"status": "ok", "cameras": list(_detectors.keys())})


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
    conf   = float(body.get("conf", 0.40))
    iou    = float(body.get("iou",  0.45))

    if cam_id in _detectors:
        return jsonify({"error": f"{cam_id} already exists"}), 409

    if source == "push":
        detector = PushDetector(MODEL_PATH, conf=conf, iou=iou)
    else:
        detector = OptimisedDetector(MODEL_PATH, source=source, conf=conf, iou=iou)

    detector.start()
    _detectors[cam_id] = detector

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


# ── Frame push (phone → server) ───────────────────────────────────────────────

@app.route("/frame/<cam_id>", methods=["POST"])
def push_frame(cam_id):
    d = _detectors.get(cam_id)
    if d is None:
        return jsonify({"error": "camera not registered"}), 404
    if not isinstance(d, PushDetector):
        return jsonify({"error": "camera is not a push type"}), 400

    d.push_frame(request.data)
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
    while True:
        frame, _ = detector.get_latest()

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

    results = search_clips(query, n_results=5)
    ip = _local_ip()
    for r in results:
        r["image_url"] = f"http://{ip}:{PORT}/crops/{r['image_file']}"
    return jsonify(results)


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
    app.run(host=HOST, port=PORT, threaded=True)
