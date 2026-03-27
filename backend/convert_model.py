"""
One-time local conversion script: MobileNetV2 (ImageNet) → ONNX.
Run once on a machine with enough RAM, then commit the output files to git.

Usage:
    py convert_model.py          (from the backend/ directory)

Outputs:
    backend/mobilenetv2.onnx            (~14 MB)
    backend/imagenet_class_index.json   (~35 KB)
"""
import os
import urllib.request

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2
import tf2onnx

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
ONNX_PATH = os.path.join(OUT_DIR, "mobilenetv2.onnx")
LABELS_PATH = os.path.join(OUT_DIR, "imagenet_class_index.json")

print("Loading MobileNetV2 weights (downloads ~14 MB on first run)...")
model = MobileNetV2(weights="imagenet", include_top=True)

print("Converting to ONNX (opset 13)...")
spec = [tf.TensorSpec([1, 224, 224, 3], tf.float32, name="input_1")]
tf2onnx.convert.from_keras(model, input_signature=spec, opset=13, output_path=ONNX_PATH)
print(f"  Saved: {ONNX_PATH}  ({os.path.getsize(ONNX_PATH) // 1024 // 1024} MB)")

print("Downloading ImageNet class index...")
urllib.request.urlretrieve(
    "https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json",
    LABELS_PATH,
)
print(f"  Saved: {LABELS_PATH}")
print("Done. Commit both files to git.")
