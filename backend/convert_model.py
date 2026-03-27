"""
Build-time script: converts MobileNetV2 (ImageNet) to ONNX format.
Run inside the model-converter Docker stage only.
Output: /tmp/mobilenetv2.onnx, /tmp/imagenet_class_index.json
"""
import os
import urllib.request

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2
import tf2onnx

print("Loading MobileNetV2 weights...")
model = MobileNetV2(weights="imagenet", include_top=True)

print("Converting to ONNX (opset 13)...")
spec = [tf.TensorSpec([1, 224, 224, 3], tf.float32, name="input_1")]
tf2onnx.convert.from_keras(
    model,
    input_signature=spec,
    opset=13,
    output_path="/tmp/mobilenetv2.onnx",
)
print(f"ONNX model saved ({os.path.getsize('/tmp/mobilenetv2.onnx') // 1024 // 1024} MB)")

print("Downloading ImageNet class index...")
urllib.request.urlretrieve(
    "https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json",
    "/tmp/imagenet_class_index.json",
)
print("Done.")
