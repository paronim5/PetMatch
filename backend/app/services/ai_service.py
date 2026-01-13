import io
import time
import os
import numpy as np
import tensorflow as tf
from functools import lru_cache
from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2, preprocess_input, decode_predictions
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image as keras_image
from PIL import Image
import logging
import cv2

logger = logging.getLogger(__name__)

class AIService:
    _instance = None
    _model = None
    _is_custom_model = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        try:
            # Check for custom model first
            custom_model_path = 'pet_match_model.h5'
            if os.path.exists(custom_model_path):
                logger.info(f"Loading custom model from {custom_model_path}...")
                self._model = load_model(custom_model_path)
                self._is_custom_model = True
                logger.info("Custom model loaded successfully.")
            else:
                logger.info("Loading MobileNetV2 model...")
                self._model = MobileNetV2(weights='imagenet')
                self._is_custom_model = False
                logger.info("MobileNetV2 model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load AI model: {e}")
            self._model = None

    def _prepare_image(self, image_bytes: bytes):
        try:
            img = Image.open(io.BytesIO(image_bytes))
            if img.mode != 'RGB':
                img = img.convert('RGB')
            img = img.resize((224, 224))
            img_array = keras_image.img_to_array(img)
            img_array = np.expand_dims(img_array, axis=0)
            if not self._is_custom_model:
                img_array = preprocess_input(img_array)
            else:
                img_array = img_array / 255.0  # Normalize for custom model
            return img_array
        except Exception as e:
            logger.error(f"Error preparing image: {e}")
            raise ValueError("Invalid image format")

    @lru_cache(maxsize=32)
    def _predict_internal(self, image_bytes: bytes) -> dict:
        if self._model is None:
            logger.warning("Model not loaded, skipping validation")
            return {"is_animal": True, "animal_type": "unknown", "confidence": 0.0, "is_safe": True}

        try:
            processed_image = self._prepare_image(image_bytes)
            predictions = self._model.predict(processed_image)
            
            if self._is_custom_model:
                # Assuming custom model output: [cat, dog, hamster, bird, fish, rabbit, other]
                classes = ['cat', 'dog', 'hamster', 'bird', 'fish', 'rabbit', 'other']
                class_idx = np.argmax(predictions[0])
                confidence = float(predictions[0][class_idx])
                
                detected_class = classes[class_idx]
                is_animal_detected = detected_class != 'other'
                
                return {
                    "is_animal": is_animal_detected,
                    "animal_type": detected_class if is_animal_detected else None,
                    "confidence_score": confidence,
                    "is_safe": True
                }
            else:
                # MobileNetV2 Logic
                decoded_preds = decode_predictions(predictions, top=5)[0]
                
                animal_keywords = [
                    'cat', 'dog', 'terrier', 'retriever', 'hound', 'spaniel', 'setter', 'pointer',
                    'poodle', 'collie', 'sheepdog', 'corgi', 'husky', 'schnauzer', 'dalmatian',
                    'bulldog', 'pug', 'beagle', 'boxer', 'mastiff', 'chihuahua', 'hamster', 
                    'guinea_pig', 'rabbit', 'hare', 'bird', 'parrot', 'eagle', 'owl', 'fish', 
                    'goldfish', 'turtle', 'lizard', 'iguana', 'snake', 'frog', 'toad', 'mouse',
                    'squirrel', 'tabby', 'tiger_cat', 'persian_cat', 'siamese_cat', 'egyptian_cat'
                ]

                # Exclude non-animal objects that might match animal keywords
                excluded_keywords = [
                    'computer_mouse', 'mouse_pad', 'toy', 'plush', 'stuffed', 'teddy', 
                    'monitor', 'screen', 'keyboard'
                ]
                
                unsafe_keywords = ['bikini', 'maillot', 'brassiere', 'swimming_trunks', 'diaper', 'miniskirt']
                
                top_pred = decoded_preds[0]
                class_id, class_name, score = top_pred
                
                is_animal_detected = False
                detected_type = "unknown"
                confidence = float(score)
                is_safe = True

                for _, label, prob in decoded_preds:
                    label_lower = label.lower()
                    
                    # Check exclusions first
                    if any(ex in label_lower for ex in excluded_keywords):
                        continue

                    if any(keyword in label_lower for keyword in animal_keywords):
                        if not is_animal_detected: # Keep the highest confidence animal
                            is_animal_detected = True
                            detected_type = label.replace('_', ' ')
                            confidence = float(prob)
                    
                    if any(uk in label_lower for uk in unsafe_keywords):
                        is_safe = False
                
                return {
                    "is_animal": is_animal_detected,
                    "animal_type": detected_type if is_animal_detected else None,
                    "confidence_score": confidence,
                    "is_safe": is_safe
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
            # Equalize histogram to improve contrast
            gray = cv2.equalizeHist(gray)
            
            # Load cascades - prioritize multiple for better recall (Catch all faces)
            cascades = []
            
            # Standard Frontal
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'))
            # Alt Frontal (often better)
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt.xml'))
            # Profile
            cascades.append(cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml'))
            
            faces_found = 0
            for cascade in cascades:
                if cascade.empty():
                    continue
                # stricter parameters: scaleFactor 1.1, minNeighbors 3 (lower neighbors = more detection, more false positives)
                # Since we want to strictly REJECT faces, we prefer False Positives (rejecting non-faces) over False Negatives (allowing faces).
                detected = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))
                faces_found += len(detected)
                
                if len(detected) > 0:
                    # Log for debugging
                    logger.info(f"Face detected by cascade. Count: {len(detected)}")
                    # We can return early if we want speed, but let's check others if needed. 
                    # Actually, if any finds a face, we consider it a face.
                    return True

            return False
        except Exception as e:
            logger.warning(f"Face detection failed: {e}")
            # Fail safe: If detection fails, assume no face? Or strict fail?
            # Usually assume no face to avoid blocking on error, but 'strict enforcement' might imply otherwise.
            # Sticking to False for error safety.
            return False

    def _check_security(self, image_bytes: bytes) -> dict:
        """
        Basic security checks for uploaded files.
        """
        try:
            # 1. Check for malicious signatures/content (Basic)
            # Check for script tags that might be embedded
            content_str = image_bytes[:2048].decode('utf-8', errors='ignore').lower() + \
                          image_bytes[-2048:].decode('utf-8', errors='ignore').lower()
            
            suspicious_patterns = [
                '<script', 'javascript:', 'vbscript:', 'onload=', 'onerror=',
                '<?php', 'eval(', 'system('
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
        
        # 1. Security Check
        security_result = self._check_security(image_bytes)
        if not security_result["is_safe"]:
            return {
                "is_animal": False,
                "animal_type": None,
                "confidence_score": 0.0,
                "is_safe": False,
                "security_reason": security_result.get("reason"),
                "has_human_face": False,
                "processing_time_ms": (time.time() - start_time) * 1000
            }

        # 2. AI Prediction
        result = self._predict_internal(image_bytes)
        
        # 3. Face Detection
        has_face = self._detect_faces(image_bytes)
        
        # 4. Quarantine Logic
        quarantine = False
        rejection_reason = None
        
        if has_face:
            quarantine = True
            rejection_reason = "Human face detected"
        elif not result["is_animal"]:
            quarantine = True
            rejection_reason = "No animal detected"
        
        end_time = time.time()
        processing_time_ms = (end_time - start_time) * 1000
        
        return {
            "is_animal": result["is_animal"],
            "animal_type": result["animal_type"],
            "confidence_score": result["confidence_score"],
            "is_safe": result.get("is_safe", True),
            "has_human_face": has_face,
            "quarantine": quarantine,
            "rejection_reason": rejection_reason,
            "processing_time_ms": processing_time_ms
        }

    # Backward compatibility for existing code
    def is_animal(self, image_bytes: bytes) -> dict:
        return self._predict_internal(image_bytes)

ai_service = AIService()
