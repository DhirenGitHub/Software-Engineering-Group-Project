# SEGP Surveillance UI

A real-time AI surveillance dashboard built with React + Vite. Displays live camera feeds with person and phone detection overlays powered by a local YOLO/ONNX detection server. It also features Smart Search using CLIP and ChromaDB.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | For the React UI |
| Python | 3.10–3.11 | **3.11 recommended** — onnxruntime wheels may not exist for 3.12+ |
| pip | latest | `python -m pip install --upgrade pip` |

---

## Setup & Running (Start to Finish)

### 1. Install React Dependencies
```bash
npm install
```

### 2. Install Python Dependencies
```bash
pip install -r server/requirements.txt
```
> **Note for Smart Search:** The `requirements.txt` already includes the necessary packages for the AI Smart Search feature: `chromadb`, `transformers`, `torch`, and `Pillow`.

### 3. Export the ONNX model (One-time only)
The detection server uses an ONNX version of the model for faster CPU inference.
```bash
python server/export_onnx.py
```

### 4. Start the Application
You need to run both the frontend and the backend simultaneously. Open two terminals:

**Terminal 1 — React UI:**
```bash
npm run dev
```
*Open http://localhost:5173 or http://127.0.0.1:5173 in your browser.*

**Terminal 2 — Detection Server:**
```bash
python server/app.py
```
*The server starts on http://localhost:5000.*

---

## Features & How to Use Them

### 1. Smart Search (AI-Powered)
- **What it does:** Allows you to search through historical camera frames using natural language (e.g., "person wearing a red backpack", "someone holding a phone").
- **Requirements:** Requires `chromadb`, `transformers`, `torch`, and `Pillow` (all included in `requirements.txt`). It automatically downloads the `openai/clip-vit-base-patch32` model on first run.
- **How to use:** In the dashboard sidebar, type your query into the **Smart Search** panel and hit Enter. The system will search its local vector database for frames matching your description.

### 2. Phone & Person Detection
- **What it does:** Highlights people and phones in the camera feeds with bounding boxes and generates alerts for phone usage.
- **How to use:** Toggle **AI Detection** to "On" in the dashboard's Feed Controls. When a phone or person is detected, an alert will be pushed to the **Active Alerts** panel.

### 3. Crowd Monitoring & Zone Analytics
- **What it does:** Tracks the number of people across all camera feeds and generates alerts if a capacity threshold is exceeded.
- **How to use:** The **Zone Analytics** panel automatically aggregates person counts. To view historical trends, check the **Footfall Chart** on the dashboard.

### 4. Camera Feed Management
- **What it does:** Supports adding multiple camera sources including Video Files, MJPEG streams (e.g., from an IP Webcam phone app), Webcams, and HLS.
- **How to use:** Go to **System Configuration** (bottom left) → **Camera Feeds** → **Add Camera**. 

*Example URLs:*
- **Video File:** `C:/path/to/video.mp4`
- **MJPEG HTTP:** `http://192.168.1.101:8080/video`

---

## Using a phone as a camera (MJPEG app)

1. Install an MJPEG streaming app on your phone (e.g., IP Webcam on Android).
2. Connect your phone and PC to the same WiFi network.
3. Start the stream in the app and note the MJPEG URL (e.g., `http://192.168.0.x:8080/video`).
4. In the UI → Add Camera → Source type: **MJPEG HTTP** → paste the URL.

> **iPhone note:** iOS Safari requires HTTPS for camera access via browser. Use an MJPEG app instead of the browser capture approach.

---

## Troubleshooting

- **Black feed after adding camera:** Check that `python server/app.py` is running. Make sure the file path/URL is correct.
- **`FileNotFoundError: YOLO.onnx does not exist`:** Run `python server/export_onnx.py`.
- **`Cannot open source: /path/to/file.mp4`:** Use a full absolute path with forward slashes (e.g. `C:/Users/name/video.mp4`).
- **Browser keeps loading / cannot reach localhost:** Ensure `host: true` is set in `vite.config.js`.
