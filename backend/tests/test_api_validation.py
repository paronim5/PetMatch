import sys
from unittest.mock import MagicMock

# Mock tensorflow and other heavy dependencies
sys.modules["tensorflow"] = MagicMock()
sys.modules["tensorflow.keras"] = MagicMock()
sys.modules["tensorflow.keras.applications"] = MagicMock()
sys.modules["tensorflow.keras.applications.mobilenet_v2"] = MagicMock()
sys.modules["tensorflow.keras.models"] = MagicMock()
sys.modules["tensorflow.keras.preprocessing"] = MagicMock()
sys.modules["tensorflow.keras.preprocessing.image"] = MagicMock()
sys.modules["numpy"] = MagicMock()
sys.modules["numpy.core"] = MagicMock()
sys.modules["cv2"] = MagicMock()
sys.modules["PIL"] = MagicMock()
sys.modules["PIL.Image"] = MagicMock()
sys.modules["prometheus_fastapi_instrumentator"] = MagicMock()

from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
from main import app
import pytest

client = TestClient(app)

def test_validate_photo_endpoint_success():
    # Patch the ai_service instance in the users module
    with patch("app.api.v1.endpoints.users.ai_service") as mock_service:
        mock_service.validate_image.return_value = {
            "is_animal": True,
            "animal_type": "dog",
            "confidence_score": 0.95,
            "is_safe": True,
            "has_human_face": False
        }
        
        # Create a dummy image file
        files = {"file": ("test.jpg", b"fake image content", "image/jpeg")}
        
        response = client.post("/api/v1/users/validate-photo", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_animal"] is True
        assert data["animal_type"] == "dog"

def test_validate_photo_endpoint_not_animal():
    with patch("app.api.v1.endpoints.users.ai_service") as mock_service:
        mock_service.validate_image.return_value = {
            "is_animal": False,
            "animal_type": "toaster",
            "confidence_score": 0.99,
            "is_safe": True,
            "has_human_face": False
        }
        
        files = {"file": ("test.jpg", b"fake image content", "image/jpeg")}
        
        response = client.post("/api/v1/users/validate-photo", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert data["is_animal"] is False
        assert data["animal_type"] == "toaster"

def test_validate_photo_endpoint_invalid_file_type():
    files = {"file": ("test.txt", b"fake text content", "text/plain")}
    response = client.post("/api/v1/users/validate-photo", files=files)
    assert response.status_code == 400
