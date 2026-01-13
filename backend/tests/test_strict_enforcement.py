import sys
from unittest.mock import MagicMock
import types

# Mock modules
m_tf = types.ModuleType("tensorflow")
m_tf_keras = types.ModuleType("tensorflow.keras")
m_tf_keras_apps = types.ModuleType("tensorflow.keras.applications")
m_tf_keras_apps_mobile = types.ModuleType("tensorflow.keras.applications.mobilenet_v2")
m_tf_keras_models = types.ModuleType("tensorflow.keras.models")
m_tf_keras_pre = types.ModuleType("tensorflow.keras.preprocessing")
m_tf_keras_pre_img = types.ModuleType("tensorflow.keras.preprocessing.image")

sys.modules["tensorflow"] = m_tf
sys.modules["tensorflow.keras"] = m_tf_keras
sys.modules["tensorflow.keras.applications"] = m_tf_keras_apps
sys.modules["tensorflow.keras.applications.mobilenet_v2"] = m_tf_keras_apps_mobile
sys.modules["tensorflow.keras.models"] = m_tf_keras_models
sys.modules["tensorflow.keras.preprocessing"] = m_tf_keras_pre
sys.modules["tensorflow.keras.preprocessing.image"] = m_tf_keras_pre_img

# Add attributes to mocks
m_tf_keras_apps_mobile.MobileNetV2 = MagicMock()
m_tf_keras_apps_mobile.preprocess_input = MagicMock()
m_tf_keras_apps_mobile.decode_predictions = MagicMock()
m_tf_keras_pre_img.img_to_array = MagicMock()
m_tf_keras_models.load_model = MagicMock()

sys.modules["numpy"] = MagicMock()
sys.modules["PIL"] = MagicMock()
sys.modules["PIL.Image"] = MagicMock()
sys.modules["prometheus_fastapi_instrumentator"] = MagicMock()
sys.modules["cv2"] = MagicMock()

from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app
from app.api import deps
from app.domain.models import User
import pytest

client = TestClient(app)

# Mock user
def mock_get_current_active_user():
    return User(id=1, email="test@example.com")

app.dependency_overrides[deps.get_current_active_user] = mock_get_current_active_user

def get_mock_db():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.count.return_value = 0
    mock_db.query.return_value.filter.return_value.first.return_value = None
    return mock_db

def setup_mock_image(mock_image_open):
    mock_img = MagicMock()
    mock_img.width = 800
    mock_img.height = 600
    mock_image_open.return_value.__enter__.return_value = mock_img

def test_quarantine_rejection_human_face():
    """Test that photos flagged for quarantine due to human face are rejected."""
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # AI Service returns quarantine=True due to face
        mock_validate.return_value = {
            "is_animal": True,
            "has_human_face": True,
            "is_safe": True,
            "confidence_score": 0.9,
            "quarantine": True,
            "rejection_reason": "Human face detected"
        }
        
        setup_mock_image(mock_image_open)
        app.dependency_overrides[deps.get_db] = get_mock_db
        
        files = [("files", ("face.jpg", b"content", "image/jpeg"))]
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "Human face detected" in response.json()["detail"]

def test_quarantine_rejection_low_confidence():
    """Test that photos flagged for quarantine due to low confidence are rejected."""
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # AI Service returns quarantine=True due to low confidence
        mock_validate.return_value = {
            "is_animal": True,
            "has_human_face": False,
            "is_safe": True,
            "confidence_score": 0.5, # Below 0.6 threshold
            "quarantine": True,
            "rejection_reason": "Low confidence animal detection (0.50)"
        }
        
        setup_mock_image(mock_image_open)
        app.dependency_overrides[deps.get_db] = get_mock_db
        
        files = [("files", ("blurry.jpg", b"content", "image/jpeg"))]
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "Low confidence" in response.json()["detail"]

def test_quarantine_rejection_not_animal():
    """Test that photos flagged for quarantine due to not being an animal are rejected."""
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # AI Service returns quarantine=True due to not animal
        mock_validate.return_value = {
            "is_animal": False,
            "has_human_face": False,
            "is_safe": True,
            "confidence_score": 0.1,
            "quarantine": True,
            "rejection_reason": "No animal detected"
        }
        
        setup_mock_image(mock_image_open)
        app.dependency_overrides[deps.get_db] = get_mock_db
        
        files = [("files", ("car.jpg", b"content", "image/jpeg"))]
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "No animal detected" in response.json()["detail"]

from datetime import datetime

def test_valid_upload_no_quarantine():
    """Test that valid animal photos with no quarantine flag are accepted."""
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.open", new_callable=MagicMock), \
         patch("app.api.v1.endpoints.users.os.makedirs"), \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # AI Service returns quarantine=False
        mock_validate.return_value = {
            "is_animal": True,
            "has_human_face": False,
            "is_safe": True,
            "confidence_score": 0.95,
            "quarantine": False
        }
        
        setup_mock_image(mock_image_open)
        mock_db = get_mock_db()
        # Mock refresh to populate IDs
        def side_effect_refresh(obj):
            obj.id = 1
            obj.uploaded_at = datetime.now()
        mock_db.refresh.side_effect = side_effect_refresh
        
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        files = [("files", ("good_dog.jpg", b"content", "image/jpeg"))]
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
