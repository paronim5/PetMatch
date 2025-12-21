from typing import Any, List
import shutil
import os
import uuid
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func 

from app.api import deps
from app.domain.schemas import (
    User, UserCreate, UserUpdate, UserProfile, UserProfileUpdate, 
    UserPreferences, UserPreferencesUpdate, UserPhoto, UserPhotoCreate,
    BlockCreate, ReportCreate, Block, Report, BlockWithUser, ReportWithUser,
)
from app.domain.models import (
    User as UserModel, UserProfile as UserProfileModel, 
    UserPhoto as UserPhotoModel, UserPreferences as UserPreferencesModel,
    Block as BlockModel, Report as ReportModel, PushToken as PushTokenModel,
)
from app.services.facade import user_facade
from app.core.logging import logger
from app.domain.enums import GenderType, DealBreakerType, UserStatusType
from pydantic import BaseModel

router = APIRouter()

class PushTokenSchema(BaseModel):
    token: str
    device_type: str = "web"

# --- EXISTING ENDPOINTS (REGISTER, ME, PROFILE, PHOTOS) ---

@router.post("/me/push-token")
def register_push_token(
    *,
    db: Session = Depends(deps.get_db),
    token_in: PushTokenSchema,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    try:
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
def create_user(*, db: Session = Depends(deps.get_db), user_in: UserCreate) -> Any:
    try:
        user = user_facade.register_new_user(db, user_in=user_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return user

@router.get("/me", response_model=User)
def read_user_me(current_user: User = Depends(deps.get_current_active_user)) -> Any:
    return current_user

@router.delete("/me")
def delete_user_me(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Soft delete the current user.
    """
    current_user.status = "deactivated"
    current_user.deleted_at = datetime.utcnow()
    db.add(current_user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.put("/me/profile", response_model=UserProfile)
def update_user_profile(
    *,
    db: Session = Depends(deps.get_db),
    profile_in: UserProfileUpdate,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    profile_data = profile_in.model_dump(exclude_unset=True)
    latitude = profile_data.pop("latitude", None)
    longitude = profile_data.pop("longitude", None)
    
    if not current_user.profile:
        db_profile = UserProfileModel(**profile_data, user_id=current_user.id)
        if latitude is not None and longitude is not None:
             db_profile.location = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        db.add(db_profile)
    else:
        for field, value in profile_data.items():
            setattr(current_user.profile, field, value)
        if latitude is not None and longitude is not None:
             current_user.profile.location = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        db.add(current_user.profile)
    db.commit()
    db.refresh(current_user.profile)
    return current_user.profile

# --- PREFERENCES ENDPOINTS (ADDED BACK) ---

@router.get("/me/preferences", response_model=UserPreferences)
def get_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user preferences.
    """
    prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferencesModel(
            user_id=current_user.id,
            notify_likes=True,
            notify_matches=True,
            notify_messages=True,
            min_age=18,
            max_age=50,
            max_distance=50
        )
        db.add(prefs)
        db.commit()
        db.refresh(prefs)
    
    # Simple sanitization to prevent frontend 422 errors
    if prefs.min_age is None: prefs.min_age = 18
    if prefs.max_age is None: prefs.max_age = 100
    if prefs.max_distance is None: prefs.max_distance = 50
    
    return prefs

@router.patch("/me/preferences", response_model=UserPreferences)
def update_user_preferences(
    *,
    db: Session = Depends(deps.get_db),
    prefs_in: UserPreferencesUpdate,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Update user preferences.
    """
    prefs = db.query(UserPreferencesModel).filter(UserPreferencesModel.user_id == current_user.id).first()
    if not prefs:
        prefs = UserPreferencesModel(user_id=current_user.id)
        db.add(prefs)

    update_data = prefs_in.model_dump(exclude_unset=True)
    
    # Age Validation logic
    new_min = update_data.get("min_age", prefs.min_age)
    new_max = update_data.get("max_age", prefs.max_age)
    if new_min and new_max and new_min > new_max:
        raise HTTPException(status_code=400, detail="Minimum age cannot be greater than maximum age")

    for field, value in update_data.items():
        setattr(prefs, field, value)

    db.commit()
    db.refresh(prefs)
    return prefs

# --- PHOTOS, BLOCKS, AND REPORTS (KEEPING YOUR WORKING CODE) ---

@router.get("/me/photos", response_model=List[UserPhoto])
def read_user_photos(db: Session = Depends(deps.get_db), current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    return current_user.photos

@router.post("/me/photos/upload", response_model=UserPhoto)
def upload_user_photo(*, db: Session = Depends(deps.get_db), file: UploadFile = File(...), current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    allowed_types = {"image/jpeg", "image/png"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPG and PNG are allowed.")
    file_bytes = file.file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (Max 5MB).")
    file.file.seek(0)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    os.makedirs("static/uploads", exist_ok=True)
    file_path = f"static/uploads/{filename}"
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except IOError as e:
        logger.error(f"Failed to write file to {file_path}: {e}")
        raise HTTPException(status_code=500, detail="Could not save file to disk.")
    
    # Use environment variable or request base URL for photo URL
    base_url = settings.BACKEND_CORS_ORIGINS[0] if settings.BACKEND_CORS_ORIGINS else "http://localhost:8000"
    # Clean up base_url if it has trailing slash
    base_url = str(base_url).rstrip("/")
    # Construct full URL. Note: In production with Nginx, this might need adjustment if serving static files differently.
    # Ideally, store relative path in DB and construct URL on frontend or use a CDN.
    # For now, we will store the relative path in the DB to be safe for migration, 
    # but the current implementation expects a full URL.
    # Let's stick to returning a full URL for the API response, but we might want to rethink storage.
    
    # FIX: The original code stored "http://localhost:8000/static/..." which is wrong for production.
    # We should return a URL that is accessible from the frontend.
    # If the frontend accesses via http://52.200.119.252.sslip.io:8000, we should use that.
    # However, inside the container, we don't know the public IP easily without config.
    # A better approach is to store the RELATIVE path in the DB, or a path starting with /static.
    
    # Temporary fix: Use the relative path starting with / so the frontend interprets it relative to the API domain
    # IF the API and Frontend are on same domain/port (via Nginx proxy), this works.
    # If they are different ports, we need the full URL.
    
    # Given the user's error: "http://52.200.119.252.sslip.io:5173/assets/..." 
    # The frontend seems to be on port 5173 (dev mode exposed?) or Nginx mapping.
    # The error "Internal Server Error" suggests the backend failed to WRITE the file or DB.
    
    # Let's assume the write failed due to permissions first (fixed in Dockerfile).
    # Now let's fix the URL generation to be more robust.
    
    # We will use a relative URL for the response so the frontend uses its own origin if needed,
    # OR better, use the request.base_url if available, but here we don't have 'request' object easily injected without modifying signature.
    
    # Let's try to store the relative path "/static/uploads/..." which is standard.
    photo_url = f"/{file_path}" 
    
    count = db.query(UserPhotoModel).filter(UserPhotoModel.user_id == current_user.id).count()
    photo = UserPhotoModel(user_id=current_user.id, photo_url=photo_url, is_primary=(count == 0), photo_order=count)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo

@router.delete("/me/photos/{photo_id}")
def delete_user_photo(*, db: Session = Depends(deps.get_db), photo_id: int, current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    photo = db.query(UserPhotoModel).filter(UserPhotoModel.id == photo_id, UserPhotoModel.user_id == current_user.id).first()
    if not photo: raise HTTPException(status_code=404, detail="Photo not found")
    db.delete(photo)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/block", response_model=Block)
def block_user(*, db: Session = Depends(deps.get_db), block_in: BlockCreate, current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    if current_user.id == block_in.blocked_id: raise HTTPException(status_code=400, detail="You cannot block yourself.")
    if db.query(BlockModel).filter(BlockModel.blocker_id == current_user.id, BlockModel.blocked_id == block_in.blocked_id).first():
        raise HTTPException(status_code=400, detail="User is already blocked.")
    block = BlockModel(blocker_id=current_user.id, blocked_id=block_in.blocked_id, reason=block_in.reason)
    db.add(block); db.commit(); db.refresh(block)
    return block

@router.get("/blocks", response_model=List[BlockWithUser])
def read_blocks(skip: int = 0, limit: int = 100, db: Session = Depends(deps.get_db), current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    return db.query(BlockModel).options(joinedload(BlockModel.blocked)).filter(BlockModel.blocker_id == current_user.id).offset(skip).limit(limit).all()

@router.delete("/blocks/{blocked_id}")
def unblock_user(*, db: Session = Depends(deps.get_db), blocked_id: int, current_user: Any = Depends(deps.get_current_active_user)) -> Response:
    block = db.query(BlockModel).filter(BlockModel.blocker_id == current_user.id, BlockModel.blocked_id == blocked_id).first()
    if not block: raise HTTPException(status_code=404, detail="Block record not found")
    db.delete(block); db.commit(); return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/report", response_model=Report)
def report_user(*, db: Session = Depends(deps.get_db), report_in: ReportCreate, current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    if current_user.id == report_in.reported_id: raise HTTPException(status_code=400, detail="You cannot report yourself.")
    report = ReportModel(reporter_id=current_user.id, reported_id=report_in.reported_id, reason=report_in.reason, description=report_in.description)
    db.add(report); db.commit(); db.refresh(report)
    return report

@router.get("/reports", response_model=List[ReportWithUser])
def read_reports(skip: int = 0, limit: int = 100, db: Session = Depends(deps.get_db), current_user: Any = Depends(deps.get_current_active_user)) -> Any:
    return db.query(ReportModel).options(joinedload(ReportModel.reported)).filter(ReportModel.reporter_id == current_user.id).offset(skip).limit(limit).all()   