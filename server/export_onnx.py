"""
Export UI/assets/YOLO.pt → UI/assets/YOLO.onnx

Run once from the project root:
    python server/export_onnx.py

After export the .onnx file is used directly by the detection server —
you never need to export again unless you swap the model.
"""

from pathlib import Path
from ultralytics import YOLO
import onnx

# Paths are relative to this script file, so it works regardless of CWD
_HERE      = Path(__file__).parent
MODEL_PT   = _HERE.parent / "assets" / "YOLO.pt"
MODEL_ONNX = _HERE.parent / "assets" / "YOLO.onnx"
IMGSZ      = 416

def main():
    if not MODEL_PT.exists():
        raise FileNotFoundError(f"Model not found: {MODEL_PT}")

    print(f"Loading {MODEL_PT} …")
    model = YOLO(str(MODEL_PT))

    # Print class names so we know what class indices to use
    print(f"Model classes: {model.names}")

    print(f"\nExporting to ONNX (imgsz={IMGSZ}) …")
    onnx_path = model.export(
        format="onnx",
        imgsz=IMGSZ,
        opset=12,
        simplify=True,
        dynamic=False,
    )
    print(f"Exported to: {onnx_path}")

    # Move to UI/assets/ if ultralytics wrote it somewhere else
    onnx_path = Path(onnx_path)
    if onnx_path.resolve() != MODEL_ONNX.resolve():
        MODEL_ONNX.parent.mkdir(parents=True, exist_ok=True)
        onnx_path.rename(MODEL_ONNX)
        print(f"Moved to: {MODEL_ONNX}")

    # Verify
    print("\nVerifying ONNX model …")
    m = onnx.load(str(MODEL_ONNX))
    onnx.checker.check_model(m)
    print("✅  ONNX model valid")
    print(f"\nDone — load this path in the server:\n  {MODEL_ONNX.resolve()}")

if __name__ == "__main__":
    main()
