import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.api.v1.endpoints.auth import google_callback
from app.domain.models import User
from app.domain.enums import UserStatusType
from app.services.google_auth_service import GoogleAuthService

def test_google_callback_deactivated_user():
    # Setup
    db = MagicMock()
    code = "fake_code"
    
    # Mock Google Auth Service
    with patch("app.api.v1.endpoints.auth.google_auth_service") as mock_google_service:
        mock_google_service.get_token.return_value = {"access_token": "fake_token"}
        mock_google_service.get_user_info.return_value = {"email": "test@example.com"}
        
        # Mock User Repository
        with patch("app.api.v1.endpoints.auth.user_repository") as mock_user_repo:
            # Case 1: Deactivated User
            mock_user = MagicMock(spec=User)
            mock_user.email = "test@example.com"
            mock_user.status = UserStatusType.deactivated
            
            mock_user_repo.get_by_email.return_value = mock_user
            
            # Execute & Assert
            try:
                google_callback(code, db)
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 403
                assert "deactivated" in e.detail

def test_google_callback_banned_user():
    # Setup
    db = MagicMock()
    code = "fake_code"
    
    # Mock Google Auth Service
    with patch("app.api.v1.endpoints.auth.google_auth_service") as mock_google_service:
        mock_google_service.get_token.return_value = {"access_token": "fake_token"}
        mock_google_service.get_user_info.return_value = {"email": "banned@example.com"}
        
        # Mock User Repository
        with patch("app.api.v1.endpoints.auth.user_repository") as mock_user_repo:
            # Case 2: Banned User
            mock_user = MagicMock(spec=User)
            mock_user.email = "banned@example.com"
            mock_user.status = UserStatusType.banned
            
            mock_user_repo.get_by_email.return_value = mock_user
            
            # Execute & Assert
            try:
                google_callback(code, db)
                assert False, "Should have raised HTTPException"
            except HTTPException as e:
                assert e.status_code == 403
                assert "banned" in e.detail

def test_google_callback_active_user():
    # Setup
    db = MagicMock()
    code = "fake_code"
    
    # Mock Google Auth Service
    with patch("app.api.v1.endpoints.auth.google_auth_service") as mock_google_service:
        mock_google_service.get_token.return_value = {"access_token": "fake_token"}
        mock_google_service.get_user_info.return_value = {"email": "active@example.com"}
        
        # Mock User Repository
        with patch("app.api.v1.endpoints.auth.user_repository") as mock_user_repo:
            # Case 3: Active User
            mock_user = MagicMock(spec=User)
            mock_user.email = "active@example.com"
            mock_user.status = UserStatusType.active
            mock_user.profile = None # Simulate incomplete profile
            
            mock_user_repo.get_by_email.return_value = mock_user
            
            # Mock create_access_token
            with patch("app.api.v1.endpoints.auth.create_access_token") as mock_create_token:
                mock_create_token.return_value = "fake_jwt_token"
                
                # Execute
                result = google_callback(code, db)
                
                # Assert
                assert result["access_token"] == "fake_jwt_token"
                assert result["profile_incomplete"] is True

def test_google_callback_new_user():
    # Setup
    db = MagicMock()
    code = "fake_code"
    
    # Mock Google Auth Service
    with patch("app.api.v1.endpoints.auth.google_auth_service") as mock_google_service:
        mock_google_service.get_token.return_value = {"access_token": "fake_token"}
        mock_google_service.get_user_info.return_value = {"email": "new@example.com"}
        
        # Mock User Repository
        with patch("app.api.v1.endpoints.auth.user_repository") as mock_user_repo:
            # Case 4: New User (get_by_email returns None)
            mock_user_repo.get_by_email.return_value = None
            
            mock_new_user = MagicMock(spec=User)
            mock_new_user.email = "new@example.com"
            mock_new_user.status = UserStatusType.active
            mock_new_user.profile = None
            
            mock_user_repo.create_social_user.return_value = mock_new_user
            
            # Mock create_access_token
            with patch("app.api.v1.endpoints.auth.create_access_token") as mock_create_token:
                mock_create_token.return_value = "fake_jwt_token"
                
                # Execute
                result = google_callback(code, db)
                
                # Assert
                assert result["access_token"] == "fake_jwt_token"
                mock_user_repo.create_social_user.assert_called_once_with(db, email="new@example.com")

if __name__ == "__main__":
    try:
        test_google_callback_deactivated_user()
        test_google_callback_banned_user()
        test_google_callback_active_user()
        test_google_callback_new_user()
        print("All auth blocking tests passed!")
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
