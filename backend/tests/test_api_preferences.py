from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.api import deps
from main import app
from app.domain.models import User, UserPreferences as UserPreferencesModel

client = TestClient(app)

def test_update_preferences_patch_success():
    # Mock user
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    mock_user.email = "test@example.com"
    mock_user.status = "active"

    # Mock DB
    mock_db = MagicMock()
    
    # Mock existing preferences
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.user_id = 1
    mock_prefs.min_age = 18
    mock_prefs.max_age = 50
    mock_prefs.max_distance = 100
    mock_prefs.preferred_genders = []
    mock_prefs.deal_breakers = []
    
    # Setup query return
    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs

    # Override dependencies
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user

    # Test partial update
    response = client.patch(
        "/api/v1/users/me/preferences",
        json={"min_age": 25}
    )
    
    assert response.status_code == 200
    assert response.json()["min_age"] == 25
    # Ensure other fields are not touched in the mock logic (though in real DB they stay same)
    # The endpoint returns the modified object.
    
    # Verify setattr was called
    assert mock_prefs.min_age == 25
    
    # Clean up overrides
    app.dependency_overrides = {}

def test_update_preferences_invalid_age_range():
    # Mock user
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    # Mock DB
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.min_age = 20
    mock_prefs.max_age = 30
    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    # Try to set min_age > max_age (existing)
    response = client.patch(
        "/api/v1/users/me/preferences",
        json={"min_age": 35}
    )
    
    assert response.status_code == 400
    assert "min_age cannot be greater than max_age" in response.json()["detail"]
    
    app.dependency_overrides = {}

def test_update_preferences_integrity_error():
    from sqlalchemy.exc import IntegrityError
    
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.min_age = 18
    mock_prefs.max_age = 50
    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    # Simulate commit failure
    mock_db.commit.side_effect = IntegrityError("mock", "mock", "mock")
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    response = client.patch(
        "/api/v1/users/me/preferences",
        json={"min_age": 25}
    )
    
    assert response.status_code == 400
    assert "Invalid preferences values" in response.json()["detail"]
    
    app.dependency_overrides = {}

def test_update_preferences_complex_payload():
    # Test with the exact payload user reported failing
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.min_age = 18
    mock_prefs.max_age = 50
    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    # Payload from user report
    payload = {
        "min_age": 20,
        "max_age": 100,
        "max_distance": 9999,
        "preferred_genders": ["female", "male"],
        "deal_breakers": []
    }
    
    response = client.patch(
        "/api/v1/users/me/preferences",
        json=payload
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["min_age"] == 20
    assert data["max_age"] == 100
    assert data["max_distance"] == 9999
    # Response usually converts Enums to strings for JSON
    assert "female" in data["preferred_genders"]
    assert "male" in data["preferred_genders"]
    assert data["deal_breakers"] == []
    
    app.dependency_overrides = {}

def test_get_preferences_success():
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.user_id = 1
    mock_prefs.min_age = 18
    mock_prefs.max_age = 99
    mock_prefs.max_distance = 50
    mock_prefs.preferred_genders = []
    mock_prefs.deal_breakers = []
    # Add timestamps as they are required in response schema
    mock_prefs.id = 1
    mock_prefs.created_at = "2023-01-01T00:00:00"
    mock_prefs.updated_at = "2023-01-01T00:00:00"

    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    response = client.get("/api/v1/users/me/preferences")
    
    assert response.status_code == 200
    data = response.json()
    assert data["min_age"] == 18
    assert data["max_age"] == 99
    
    app.dependency_overrides = {}

def test_get_preferences_validation_error_handling():
    # Simulate DB returning invalid enum value in list
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.user_id = 1
    mock_prefs.min_age = 18
    mock_prefs.max_age = 99
    mock_prefs.max_distance = 50
    # 'alien' is not a valid GenderType
    mock_prefs.preferred_genders = ["alien", "male"] 
    mock_prefs.deal_breakers = []
    mock_prefs.id = 1
    mock_prefs.created_at = "2023-01-01T00:00:00"
    mock_prefs.updated_at = "2023-01-01T00:00:00"

    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    response = client.get("/api/v1/users/me/preferences")
    
    # It should now succeed and sanitize the data
    assert response.status_code == 200
    data = response.json()
    assert "alien" not in data["preferred_genders"]
    assert "male" in data["preferred_genders"]
    assert len(data["preferred_genders"]) == 1
    
    app.dependency_overrides = {}

def test_get_preferences_numeric_validation_error():
    # Simulate DB returning invalid numeric values (violating Pydantic ge/le constraints)
    mock_user = MagicMock(spec=User)
    mock_user.id = 1
    
    mock_db = MagicMock()
    mock_prefs = MagicMock(spec=UserPreferencesModel)
    mock_prefs.user_id = 1
    mock_prefs.min_age = 10  # Invalid: < 18
    mock_prefs.max_age = 150 # Invalid: > 100
    mock_prefs.max_distance = 0 # Invalid: <= 0
    mock_prefs.preferred_genders = []
    mock_prefs.deal_breakers = []
    mock_prefs.id = 1
    mock_prefs.created_at = "2023-01-01T00:00:00"
    mock_prefs.updated_at = "2023-01-01T00:00:00"

    mock_db.query.return_value.filter.return_value.first.return_value = mock_prefs
    
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    app.dependency_overrides[deps.get_current_active_user] = lambda: mock_user
    
    response = client.get("/api/v1/users/me/preferences")
    
    # Before fix, this should fail with 500 (ResponseValidationError)
    # After fix, it should return sanitized values (18, 100, etc.)
    
    assert response.status_code == 200
    data = response.json()
    assert data["min_age"] == 18
    assert data["max_age"] == 100
    assert data["max_distance"] == 1
    
    app.dependency_overrides = {}


