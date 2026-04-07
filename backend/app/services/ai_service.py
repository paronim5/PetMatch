import io
import time
import os
import json
import numpy as np
import onnxruntime as ort
from PIL import Image
import logging
import cv2

logger = logging.getLogger(__name__)

# ── ImageNet class index ──────────────────────────────────────────────────────

_CLASS_INDEX: dict | None = None


def _get_class_index() -> dict:
    global _CLASS_INDEX
    if _CLASS_INDEX is None:
        for path in ["/app/imagenet_class_index.json", "imagenet_class_index.json"]:
            if os.path.exists(path):
                with open(path) as f:
                    raw = json.load(f)
                # Format: {"0": ["n01440764", "tench"], ...}
                _CLASS_INDEX = {int(k): v[1] for k, v in raw.items()}
                break
        if _CLASS_INDEX is None:
            logger.warning("imagenet_class_index.json not found; class names will be numeric.")
            _CLASS_INDEX = {}
    return _CLASS_INDEX


def _decode_predictions(scores: np.ndarray, top: int = 5) -> list[tuple]:
    """Return top-N (class_id_str, class_name, probability) from ONNX output."""
    class_index = _get_class_index()
    probs = scores[0]  # remove batch dim → shape (1000,)
    top_indices = np.argsort(probs)[-top:][::-1]
    return [
        (str(i), class_index.get(i, f"class_{i}"), float(probs[i]))
        for i in top_indices
    ]


# ── AI Service ────────────────────────────────────────────────────────────────

class AIService:
    _instance = None
    _session: ort.InferenceSession | None = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
        return cls._instance

    def _get_session(self) -> ort.InferenceSession | None:
        if self._session is None:
            self._load_model()
        return self._session

    def _load_model(self):
        try:
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 1
            opts.inter_op_num_threads = 1
            opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL

            for path in ["/app/mobilenetv2.onnx", "mobilenetv2.onnx"]:
                if os.path.exists(path):
                    self._session = ort.InferenceSession(
                        path,
                        sess_options=opts,
                        providers=["CPUExecutionProvider"],
                    )
                    logger.info("ONNX MobileNetV2 model loaded successfully.")
                    return

            logger.error("mobilenetv2.onnx not found — image validation will be skipped.")
        except Exception as e:
            logger.error(f"Failed to load ONNX model: {e}")
            self._session = None

    def _prepare_image(self, image_bytes: bytes) -> np.ndarray:
        try:
            img = Image.open(io.BytesIO(image_bytes))
            if img.mode != "RGB":
                img = img.convert("RGB")
            img = img.resize((224, 224))
            img_array = np.array(img, dtype=np.float32)
            img_array = np.expand_dims(img_array, axis=0)
            # MobileNetV2 preprocess_input: scale [0,255] → [-1,1]
            img_array = (img_array / 127.5) - 1.0
            return img_array
        except Exception as e:
            logger.error(f"Error preparing image: {e}")
            raise ValueError("Invalid image format")

    def _predict_internal(self, image_bytes: bytes) -> dict:
        session = self._get_session()
        if session is None:
            logger.warning("Model not loaded, skipping validation")
            return {"is_animal": True, "animal_type": "unknown", "confidence": 0.0, "is_safe": True}

        try:
            processed_image = self._prepare_image(image_bytes)
            input_name = session.get_inputs()[0].name
            outputs = session.run(None, {input_name: processed_image})
            decoded_preds = _decode_predictions(outputs[0], top=5)

            animal_keywords = [
                "cat", "dog", "terrier", "retriever", "hound", "spaniel", "setter", "pointer",
                "poodle", "collie", "sheepdog", "corgi", "husky", "schnauzer", "dalmatian",
                "bulldog", "pug", "beagle", "boxer", "mastiff", "chihuahua", "hamster",
                "guinea_pig", "rabbit", "hare", "bird", "parrot", "eagle", "owl", "fish",
                "goldfish", "turtle", "lizard", "iguana", "snake", "frog", "toad", "mouse",
                "squirrel", "tabby", "tiger_cat", "persian_cat", "siamese_cat", "egyptian_cat",
            ]
            excluded_keywords = [
                "computer_mouse", "mouse_pad", "toy", "plush", "stuffed", "teddy",
                "monitor", "screen", "keyboard",
            ]
            unsafe_keywords = ["bikini", "maillot", "brassiere", "swimming_trunks", "diaper", "miniskirt"]

            is_animal_detected = False
            detected_type = "unknown"
            confidence = 0.0
            is_safe = True
            unsafe_category = None
            unsafe_reason = None

            for _class_id, label, prob in decoded_preds:
                label_lower = label.lower()

                if any(ex in label_lower for ex in excluded_keywords):
                    continue

                if any(keyword in label_lower for keyword in animal_keywords):
                    if not is_animal_detected:
                        is_animal_detected = True
                        detected_type = label.replace("_", " ")
                        confidence = float(prob)

                if any(uk in label_lower for uk in unsafe_keywords):
                    is_safe = False
                    unsafe_category = "nsfw"
                    unsafe_reason = "Potential NSFW or adult content detected"

            return {
                "is_animal": is_animal_detected,
                "animal_type": detected_type if is_animal_detected else None,
                "confidence_score": confidence,
                "is_safe": is_safe,
                "unsafe_category": unsafe_category,
                "unsafe_reason": unsafe_reason,
            }

        except Exception as e:
            logger.error(f"Error during prediction: {e}")
            return {"is_animal": False, "animal_type": "error", "confidence": 0.0, "is_safe": True}

    def _detect_faces(self, image_bytes: bytes) -> bool:
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return False
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            gray = cv2.equalizeHist(gray)

            cascades = []
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml"))
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt.xml"))
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_profileface.xml"))

            for cascade in cascades:
                if cascade.empty():
                    continue
                detected = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))
                if len(detected) > 0:
                    logger.info(f"Face detected by cascade. Count: {len(detected)}")
                    return True

            return False
        except Exception as e:
            logger.warning(f"Face detection failed: {e}")
            return False

    def _check_security(self, image_bytes: bytes) -> dict:
        try:
            content_str = (
                image_bytes[:2048].decode("utf-8", errors="ignore").lower()
                + image_bytes[-2048:].decode("utf-8", errors="ignore").lower()
            )
            suspicious_patterns = [
                "<script", "javascript:", "vbscript:", "onload=", "onerror=",
                "<?php", "eval(", "system(",
            ]
            for pattern in suspicious_patterns:
                if pattern in content_str:
                    logger.warning(f"Suspicious pattern found: {pattern}")
                    return {"is_safe": False, "reason": "Potential malicious content detected"}
            return {"is_safe": True}
        except Exception as e:
            logger.error(f"Security check failed: {e}")
            return {"is_safe": False, "reason": "Security check error"}

    def validate_image(self, image_bytes: bytes) -> dict:
        start_time = time.time()

        security_result = self._check_security(image_bytes)
        if not security_result["is_safe"]:
            return {
                "is_animal": False,
                "animal_type": None,
                "confidence_score": 0.0,
                "is_safe": False,
                "security_reason": security_result.get("reason"),
                "has_human_face": False,
                "processing_time_ms": (time.time() - start_time) * 1000,
            }

        result = self._predict_internal(image_bytes)
        has_face = self._detect_faces(image_bytes)

        quarantine = False
        rejection_reason = None
        is_nsfw = False
        nsfw_reason = None

        unsafe_category = result.get("unsafe_category")
        unsafe_reason = result.get("unsafe_reason")
        is_animal = result.get("is_animal", False)

        if unsafe_category == "nsfw":
            is_nsfw = True
            nsfw_reason = unsafe_reason or "Potential NSFW or adult content detected"
            result["is_safe"] = False

        if is_nsfw:
            quarantine = True
            rejection_reason = nsfw_reason
        elif not is_animal:
            quarantine = True
            rejection_reason = "Human face detected" if has_face else "No animal detected"
            result["is_safe"] = False

        return {
            "is_animal": result["is_animal"],
            "animal_type": result["animal_type"],
            "confidence_score": result["confidence_score"],
            "is_safe": result.get("is_safe", True),
            "has_human_face": has_face,
            "quarantine": quarantine,
            "rejection_reason": rejection_reason,
            "unsafe_category": result.get("unsafe_category"),
            "unsafe_reason": nsfw_reason if is_nsfw else result.get("unsafe_reason"),
            "processing_time_ms": (time.time() - start_time) * 1000,
        }

    def is_animal(self, image_bytes: bytes) -> dict:
        return self._predict_internal(image_bytes)


ai_service = AIService()
