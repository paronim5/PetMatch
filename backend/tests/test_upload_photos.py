import sys
from unittest.mock import MagicMock
import types

# Mock tensorflow properly as packages
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

# Add attributes to mocks to satisfy imports
m_tf_keras_apps_mobile.MobileNetV2 = MagicMock()
m_tf_keras_apps_mobile.preprocess_input = MagicMock()
m_tf_keras_apps_mobile.decode_predictions = MagicMock()
m_tf_keras_pre_img.img_to_array = MagicMock()
m_tf_keras_models.load_model = MagicMock()

sys.modules["numpy"] = MagicMock()
sys.modules["PIL"] = MagicMock()
sys.modules["PIL.Image"] = MagicMock()
sys.modules["prometheus_fastapi_instrumentator"] = MagicMock()
sys.modules["cv2"] = MagicMock() # Mock cv2

from fastapi.testclient import TestClient
from unittest.mock import patch, ANY
from main import app
from app.api import deps
from app.domain.models import User
from datetime import datetime
import pytest

client = TestClient(app)

# Mock user
def mock_get_current_active_user():
    return User(id=1, email="test@example.com")

app.dependency_overrides[deps.get_current_active_user] = mock_get_current_active_user

def test_upload_multiple_photos_success():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.open", new_callable=MagicMock) as mock_open, \
         patch("app.api.v1.endpoints.users.os.makedirs") as mock_makedirs, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # AI returns true
        mock_validate.return_value = {"is_animal": True, "is_safe": True, "has_human_face": False, "confidence_score": 0.95}
        
        # Mock Image.open context manager
        mock_img = MagicMock()
        mock_img.width = 800
        mock_img.height = 600
        mock_image_open.return_value.__enter__.return_value = mock_img
        
        files = [
            ("files", ("photo1.jpg", b"content1", "image/jpeg")),
            ("files", ("photo2.png", b"content2", "image/png"))
        ]
        
        # Mock DB
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = None
        
        # Mock refresh to populate IDs
        def side_effect_refresh(obj):
            obj.id = 1 if obj.photo_order == 0 else 2
            obj.uploaded_at = datetime.now()
        
        mock_db.refresh.side_effect = side_effect_refresh
        
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        if response.status_code != 200:
            print(response.json())
            
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Check order and primary status
        # Note: data[0] corresponds to first file processed
        assert data[0]["photo_order"] == 0
        assert data[1]["photo_order"] == 1
        assert data[0]["is_primary"] is True
        assert data[1]["is_primary"] is False
        
        # Verify thumbnails were generated
        assert mock_img.thumbnail.call_count == 2
        assert mock_img.save.call_count == 2

def test_upload_photos_limit_exceeded():
    files = [("files", (f"p{i}.jpg", b"c", "image/jpeg")) for i in range(11)]
    # We don't need DB or AI mock here as check is first
    response = client.post("/api/v1/users/me/photos/upload", files=files)
    assert response.status_code == 400
    assert "Maximum 10 photos" in response.json()["detail"]

def test_upload_photos_ai_rejection():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        mock_validate.return_value = {
            "is_animal": False, 
            "is_safe": True, 
            "has_human_face": False,
            "quarantine": True,
            "rejection_reason": "No animal detected"
        }
        
        # Mock Image for resolution check
        mock_img = MagicMock()
        mock_img.width = 800
        mock_img.height = 600
        mock_image_open.return_value.__enter__.return_value = mock_img
        
        files = [("files", ("bad.jpg", b"content", "image/jpeg"))]
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "rejected" in response.json()["detail"]

def test_upload_photos_duplicate():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate:
        mock_validate.return_value = {"is_animal": True, "is_safe": True, "has_human_face": False, "confidence_score": 0.95}
        
        files = [("files", ("dup.jpg", b"content", "image/jpeg"))]
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        # Simulate duplicate found
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock()
        
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "Duplicate photo" in response.json()["detail"]

def test_upload_photos_resolution_low():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        mock_validate.return_value = {"is_animal": True, "is_safe": True, "confidence_score": 0.95}
        
        # Mock Image with small size
        mock_img = MagicMock()
        mock_img.width = 100
        mock_img.height = 100
        mock_image_open.return_value.__enter__.return_value = mock_img
        
        files = [("files", ("small.jpg", b"content", "image/jpeg"))]
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "resolution too low" in response.json()["detail"]

def test_upload_photos_unsafe():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        mock_validate.return_value = {"is_animal": True, "is_safe": False, "has_human_face": False, "confidence_score": 0.95}
        
        # Mock Image
        mock_img = MagicMock()
        mock_img.width = 800
        mock_img.height = 600
        mock_image_open.return_value.__enter__.return_value = mock_img
        
        files = [("files", ("unsafe.jpg", b"content", "image/jpeg"))]
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = None
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "Inappropriate content" in response.json()["detail"]

def test_upload_photos_human_face_rejected():
    with patch("app.api.v1.endpoints.users.ai_service.validate_image") as mock_validate, \
         patch("app.api.v1.endpoints.users.open", new_callable=MagicMock), \
         patch("app.api.v1.endpoints.users.os.makedirs"), \
         patch("app.api.v1.endpoints.users.Image.open") as mock_image_open:
        
        # Not animal, but has human face, and safe
        mock_validate.return_value = {
            "is_animal": False, 
            "has_human_face": True, 
            "is_safe": True, 
            "confidence_score": 0.0,
            "quarantine": True,
            "rejection_reason": "Human face detected"
        }
        
        mock_img = MagicMock()
        mock_img.width = 800
        mock_img.height = 600
        mock_image_open.return_value.__enter__.return_value = mock_img
        
        files = [("files", ("face.jpg", b"content", "image/jpeg"))]
        
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.count.return_value = 0
        mock_db.query.return_value.filter.return_value.first.return_value = None
        # Mock refresh
        def side_effect_refresh(obj):
            obj.id = 1
            obj.uploaded_at = datetime.now()
        mock_db.refresh.side_effect = side_effect_refresh
        
        app.dependency_overrides[deps.get_db] = lambda: mock_db
        
        response = client.post("/api/v1/users/me/photos/upload", files=files)
        
        assert response.status_code == 400
        assert "Human face detected" in response.json()["detail"]
