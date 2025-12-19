from typing import Any, List
import shutil
import os
import uuid
import io
from datetime import datetime
from fastapi import APIRouter, Body, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.api import deps
from app.domain.schemas import User, UserCreate, UserUpdate, UserProfile, UserProfileUpdate, UserPhoto, UserPhotoCreate, UserPreferences, UserPreferencesUpdate
from app.domain.models import UserProfile as UserProfileModel, UserPhoto as UserPhotoModel, UserPreferences as UserPreferencesModel
from app.services.facade import user_facade
from geoalchemy2.functions import ST_SetSRID, ST_MakePoint
from app.core.logging import logger
from app.domain.enums import GenderType, DealBreakerType
from app.domain.models import User as UserModel, PushToken as PushTokenModel
from pydantic import BaseModel

router = APIRouter()

class PushTokenSchema(BaseModel):
    token: str
    device_type: str = "web"

@router.post("/me/push-token")
def register_push_token(
    *,
    db: Session = Depends(deps.get_db),
    token_in: PushTokenSchema,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Register a push token for the current user.
    """
    try:
        # Check if token exists
        existing_token = db.query(PushTokenModel).filter(
            PushTokenModel.user_id == current_user.id,
            PushTokenModel.device_token == token_in.token
        ).first()
        
        if existing_token:
            existing_token.updated_at = datetime.utcnow()
            existing_token.is_active = True
            db.commit()
            return {"status": "updated"}
        
        new_token = PushTokenModel(
            user_id=current_user.id,
            device_token=token_in.token,
            device_type=token_in.device_type,
            is_active=True
        )
        db.add(new_token)
        db.commit()
        return {"status": "created"}
    except Exception as e:
        logger.error(f"Failed to register push token: {e}")
        raise HTTPException(status_code=500, detail="Failed to register push token")


@router.post("/", response_model=User)
def create_user(
    *,
    db: Session = Depends(deps.get_db),
    user_in: UserCreate,
) -> Any:
    """
    Create new user.
    """
    try:
        user = user_facade.register_new_user(db, user_in=user_in)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    return user

@router.get("/me", response_model=User)
def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user.
    """
    return current_user

@router.put("/me/preferences", response_model=UserPreferences)
def update_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    preferences_in: UserPreferencesUpdate,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update user preferences.
    """
    prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == current_user.id).first()
    if not prefs:
        # Create default preferences if not exist
        prefs = UserPreferencesModel(
            user_id=current_user.id,
            notify_likes=True,
            notify_matches=True,
            notify_messages=True
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    prefs_data = preferences_in.model_dump(exclude_unset=True)
    if "user_id" in prefs_data:
        del prefs_data["user_id"]
        
    for field, value in prefs_data.items():
        setattr(prefs, field, value)
        
    db.add(prefs)
    db.commit()
    db.refresh(prefs)
    return prefs

@router.put("/me/profile", response_model=UserProfile)
def update_user_profile(
    *,
    db: Session = Depends(deps.get_db),
    profile_in: UserProfileUpdate,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update own profile.
    """
    profile_data = profile_in.model_dump(exclude_unset=True)
    
    # Handle location if lat/long provided
    latitude = profile_data.pop("latitude", None)
    longitude = profile_data.pop("longitude", None)
    
    if "user_id" in profile_data:
        del profile_data["user_id"]
        
    if not current_user.profile:
        # Create new profile
        db_profile = UserProfileModel(**profile_data, user_id=current_user.id)
        
        if latitude is not None and longitude is not None:
             db_profile.location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
             
        db.add(db_profile)
        db.commit()
        db.refresh(db_profile)
        return db_profile
    else:
        # Update existing
        for field, value in profile_data.items():
            setattr(current_user.profile, field, value)
            
        if latitude is not None and longitude is not None:
             current_user.profile.location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
             
        db.add(current_user.profile)
        db.commit()
        db.refresh(current_user.profile)
        return current_user.profile

@router.post("/me/photos", response_model=UserPhoto)
def create_user_photo(
    *,
    db: Session = Depends(deps.get_db),
    photo_in: UserPhotoCreate,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Add a photo to user profile.
    """
    photo = UserPhotoModel(
        user_id=current_user.id,
        photo_url=photo_in.photo_url,
        is_primary=photo_in.is_primary,
        photo_order=photo_in.photo_order
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo

@router.get("/me/photos", response_model=List[UserPhoto])
def read_user_photos(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user photos.
    """
    return current_user.photos

@router.post("/me/photos/upload", response_model=UserPhoto)
def upload_user_photo(
    *,
    db: Session = Depends(deps.get_db),
    file: UploadFile = File(...),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upload a photo.
    """
    # Validate content type
    allowed_types = {"image/jpeg", "image/png"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only JPG and PNG are allowed.")
    
    # Read bytes to validate size
    file_bytes = file.file.read()
    max_size_bytes = 5 * 1024 * 1024  # 5MB
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(status_code=400, detail="File too large. Max size is 5MB.")
    
    # Validate dimensions (gracefully skip if Pillow is unavailable)
    try:
        from PIL import Image  # local import to avoid startup crash if Pillow missing
        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size
        min_dim = 300
        max_dim = 4000
        if width < min_dim or height < min_dim:
            raise HTTPException(status_code=400, detail=f"Image too small. Minimum dimensions are {min_dim}x{min_dim}.")
        if width > max_dim or height > max_dim:
            raise HTTPException(status_code=400, detail=f"Image too large. Maximum dimensions are {max_dim}x{max_dim}.")
    except ImportError:
        # Continue without dimension validation; recommend installing Pillow
        pass
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file.")
    
    # Reset pointer for saving
    file.file.seek(0)
    
    # Create unique filename
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    
    # Ensure directory exists
    os.makedirs("static/uploads", exist_ok=True)
    
    file_path = f"static/uploads/{filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Construct URL 
    # NOTE: In production this should be a proper domain/CDN URL
    photo_url = f"http://localhost:8000/{file_path}"
    
    # Check if this is the first photo
    existing_photos_count = db.query(UserPhotoModel).filter(UserPhotoModel.user_id == current_user.id).count()
    is_primary = existing_photos_count == 0

    photo = UserPhotoModel(
        user_id=current_user.id,
        photo_url=photo_url,
        is_primary=is_primary,
        photo_order=existing_photos_count
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo

@router.delete("/me/photos/{photo_id}")
def delete_user_photo(
    *,
    db: Session = Depends(deps.get_db),
    photo_id: int,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Delete a photo.
    """
    photo = db.query(UserPhotoModel).filter(
        UserPhotoModel.id == photo_id,
        UserPhotoModel.user_id == current_user.id
    ).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
        
    db.delete(photo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.delete("/me", status_code=200)
def delete_account(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Permanently delete the current user's account.
    """
    user = db.query(UserModel).filter(UserModel.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"status": "success"}

@router.get("/me/preferences", response_model=UserPreferences)
def get_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get or initialize user preferences.
    """
    try:
        prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferencesModel(user_id=current_user.id)
            db.add(prefs)
            db.commit()
            db.refresh(prefs)
        
        # Sanitize data to prevent ResponseValidationError if DB has invalid enums
        valid_genders = {g.value for g in GenderType}
        valid_deal_breakers = {d.value for d in DealBreakerType}
        
        # Check and clean preferred_genders
        if prefs.preferred_genders:
            cleaned_genders = [g for g in prefs.preferred_genders if g in valid_genders]
            if len(cleaned_genders) != len(prefs.preferred_genders):
                logger.warning(f"Sanitized preferred_genders for user {current_user.id}: {prefs.preferred_genders} -> {cleaned_genders}")
                # We don't save back to DB here to avoid unexpected data loss, just fix response
                prefs.preferred_genders = cleaned_genders

        # Check and clean deal_breakers
        if prefs.deal_breakers:
            cleaned_breakers = [d for d in prefs.deal_breakers if d in valid_deal_breakers]
            if len(cleaned_breakers) != len(prefs.deal_breakers):
                logger.warning(f"Sanitized deal_breakers for user {current_user.id}: {prefs.deal_breakers} -> {cleaned_breakers}")
                prefs.deal_breakers = cleaned_breakers

        # Sanitize numeric fields to match Pydantic constraints
        if prefs.min_age is not None and prefs.min_age < 18:
             prefs.min_age = 18
        
        if prefs.max_age is not None and prefs.max_age > 100:
             prefs.max_age = 100
             
        if prefs.max_distance is not None and prefs.max_distance <= 0:
             prefs.max_distance = 1 # Set to minimal valid distance

        return prefs
    except Exception as e:
        logger.exception(f"Failed to get preferences for user_id={current_user.id}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.patch("/me/preferences", response_model=UserPreferencesUpdate) # Assuming Schema name
def update_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    prefs_in: UserPreferencesUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Partially update user preferences.
    """
    try:
        # 1. Retrieve existing preferences or initialize if missing
        prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == current_user.id).first()
        if not prefs:
            prefs = UserPreferencesModel(user_id=current_user.id)
            db.add(prefs)
            db.flush() # Sync with DB to get an ID

        # 2. Extract partial update data
        update_data = prefs_in.model_dump(exclude_unset=True)

        # 3. Age Validation (Compare proposed values against existing ones)
        new_min = update_data.get("min_age", prefs.min_age)
        new_max = update_data.get("max_age", prefs.max_age)

        if new_min is not None and new_max is not None:
            if new_min > new_max:
                raise HTTPException(status_code=400, detail="min_age cannot be greater than max_age")

        # 4. Apply Updates
        for field, value in update_data.items():
            setattr(prefs, field, value)

        db.commit()
        db.refresh(prefs)

        # 5. Safety Sanitization (Filter any non-enum values that might be in DB)
        valid_genders = {g.value for g in GenderType}
        valid_deal_breakers = {d.value for d in DealBreakerType}

        if prefs.preferred_genders:
            prefs.preferred_genders = [g for g in prefs.preferred_genders if g in valid_genders]
        
        if prefs.deal_breakers:
            cleaned_breakers = [d for d in prefs.deal_breakers if d in valid_deal_breakers]
            if len(cleaned_breakers) != len(prefs.deal_breakers):
                prefs.deal_breakers = cleaned_breakers

        # Sanitize numeric fields to match Pydantic constraints
        if prefs.min_age is not None and prefs.min_age < 18:
             prefs.min_age = 18
        
        if prefs.max_age is not None and prefs.max_age > 100:
             prefs.max_age = 100
             
        if prefs.max_distance is not None and prefs.max_distance <= 0:
             prefs.max_distance = 1 # Set to minimal valid distance

        return prefs
        
    except HTTPException:
        db.rollback() # Important: Reset session on validation error
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Invalid preferences values (constraint violation)")
    except Exception as e:
        db.rollback() # Important: Reset session on DB error
        logger.exception(f"Failed to update preferences for user_id={current_user.id}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
