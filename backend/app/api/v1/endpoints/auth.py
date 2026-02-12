from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.api import deps
from app.services.auth_service import auth_service
from app.services.google_auth_service import GoogleAuthService
from app.infrastructure.repositories.user import user_repository
from app.core.security import create_access_token
from app.domain.models import User
from app.domain.schemas import User as UserSchema
from app.domain.enums import UserStatusType

google_auth_service = GoogleAuthService()
from app.domain.schemas import Token

from app.core.logging import logger

router = APIRouter()

@router.post("/login", response_model=Token)
def login_access_token(
    db: Session = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    logger.info(f"Login attempt for user: {form_data.username}")
    token = auth_service.login(db, email=form_data.username, password=form_data.password)
    if not token:
        logger.warning(f"Login failed for user: {form_data.username} - Incorrect credentials")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    logger.info(f"Login successful for user: {form_data.username}")
    return token

@router.get("/google")
def login_google():
    authorization_url = google_auth_service.get_login_url()
    if not authorization_url:
        raise HTTPException(status_code=500, detail="Google configuration missing")
    return {"url": authorization_url}

@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(deps.get_db)):
    try:
        token_response = google_auth_service.get_token(code)
        user_info = google_auth_service.get_user_info(token_response)
    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Google authentication failed: {str(e)}")

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")
        
    email = user_info.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email not found in Google user info")
        
    user = user_repository.get_by_email(db, email=email)
    if user:
        if user.status == UserStatusType.deactivated:
            raise HTTPException(status_code=403, detail="Account is deactivated")
        if user.status == UserStatusType.banned:
            raise HTTPException(status_code=403, detail="Account is banned")
        if user.status == UserStatusType.suspended:
            raise HTTPException(status_code=403, detail="Account is suspended")

    if not user:
        user = user_repository.create_social_user(db, email=email)
        
    access_token = create_access_token(data={"sub": user.email})
    
    # Check if profile is complete
    profile_incomplete = not user.profile or not user.profile.date_of_birth
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "profile_incomplete": profile_incomplete
    }

@router.get("/me", response_model=UserSchema)
def read_users_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user
