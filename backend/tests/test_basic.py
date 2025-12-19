from unittest.mock import MagicMock, patch
from app.domain.events import event_bus
from app.services.facade import UserManagementFacade
from app.services.matching_service import LocationBasedMatching
from app.domain.models import User, UserProfile, UserPreferences

def test_user_registration_facade():
    # Mock dependencies
    mock_observer = MagicMock()
    event_bus.attach("user_registered", mock_observer)
    
    # Mock dependencies
    db = MagicMock()
    user_in = MagicMock()
    user_in.email = "test@example.com"
    
    # Mock user_service.create_user to return a user object
    with patch("app.services.user_service.user_service.create_user") as mock_create:
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.email = "test@example.com"
        mock_create.return_value = mock_user
        
        facade = UserManagementFacade()
        user = facade.register_new_user(db, user_in)
        
        assert user.id == 1
        mock_observer.update.assert_called_once()
        # Verify the arguments passed to update
        args, _ = mock_observer.update.call_args
        assert args[0] == "user_registered"
        assert args[1]["user_id"] == 1

def test_singleton_pattern():
    from app.infrastructure.database import Database
    db1 = Database()
    db2 = Database()
    assert db1 is db2

def test_matching_strategy_logic():
    strategy = LocationBasedMatching()
    db = MagicMock()
    user = MagicMock()
    user.id = 1
    user.profile.location = "POINT(0 0)"
    user.preferences = None
    
    # Mock the query chain
    # This is hard to fully mock with SQLAlchemy chaining, but we can check if it tries to build the query
    # Real integration test would be better, but for now we verify it doesn't crash on basic logic
    
    # If user has no profile/location, should return empty list
    user_no_loc = MagicMock()
    user_no_loc.profile = None
    assert strategy.find_matches(db, user_no_loc) == []
    
    user_no_loc_2 = MagicMock()
    user_no_loc_2.profile.location = None
    assert strategy.find_matches(db, user_no_loc_2) == []

def test_configuration_loading():
    from app.core.config import settings
    assert settings.PROJECT_NAME == "PetMatch Dating App"
    assert settings.POSTGRES_PORT == 5432
    # Check if SQLALCHEMY_DATABASE_URI is built correctly (it should be a PostgresDsn object or string)
    assert str(settings.SQLALCHEMY_DATABASE_URI).startswith("postgresql://")

def test_database_connection_settings():
    from app.infrastructure.database import Database
    from app.core.config import settings
    db = Database()
    
    # Construct expected URL from raw settings
    expected_url = f"postgresql://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
    
    # Compare with the engine's URL
    # Note: SQLAlchemy might normalize the URL (e.g., handling special chars), but for simple cases this works
    # We must explicitly ask SQLAlchemy not to hide the password
    assert db.engine.url.render_as_string(hide_password=False) == expected_url

if __name__ == "__main__":
    test_user_registration_facade()
    test_singleton_pattern()
    test_configuration_loading()
    test_database_connection_settings()
    print("All tests passed!")
