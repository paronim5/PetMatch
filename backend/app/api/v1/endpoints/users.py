from typing import Any, List
import shutil
import os
import uuid
import io
import mimetypes
from datetime import datetime
import traceback
import hashlib
from PIL import Image

from fastapi import APIRouter, Depends, HTTPException, status, Response, UploadFile, File, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func 

from app.api import deps
from app.core.config import settings
from app.core.limiter import limiter
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
from app.services.ai_service import ai_service
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
        logger.info(f"Registering new user: {user_in.email}, Username: {user_in.username}")
        user = user_facade.register_new_user(db, user_in=user_in)
        logger.info(f"User registered successfully: {user.email} (ID: {user.id})")
    except ValueError as e:
        logger.error(f"Registration failed for {user_in.email}: {str(e)}")
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
    # Check if user is restricted from deleting account
    if current_user.id == 31:
        raise HTTPException(status_code=403, detail=" ярик, я так и знал что после этого ты захочешь замести следы своей измены...                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     ")
    
    logger.info(f"Deactivating user: {current_user.email} (ID: {current_user.id})")
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
    logger.info(f"Updating profile for user: {current_user.email} (ID: {current_user.id})")
    profile_data = profile_in.model_dump(exclude_unset=True)
    latitude = profile_data.pop("latitude", None)
    longitude = profile_data.pop("longitude", None)
    
    if not current_user.profile:
        logger.info(f"Creating new profile record for user {current_user.id}")
        db_profile = UserProfileModel(**profile_data, user_id=current_user.id)
        if latitude is not None and longitude is not None:
             db_profile.location = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        db.add(db_profile)
    else:
        logger.info(f"Updating existing profile record for user {current_user.id}")
        for field, value in profile_data.items():
            setattr(current_user.profile, field, value)
        if latitude is not None and longitude is not None:
             current_user.profile.location = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
        db.add(current_user.profile)
    
    try:
        db.commit()
        db.refresh(current_user.profile)
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig)
        logger.warning(f"IntegrityError updating profile: {error_msg}")
        
        if "valid_height_cm" in error_msg:
             raise HTTPException(status_code=400, detail="Height must be between 100 cm and 250 cm.")
        if "valid_height_inches" in error_msg:
             raise HTTPException(status_code=400, detail="Height must be between 36 and 96 inches.")
        if "valid_age_range" in error_msg:
             raise HTTPException(status_code=400, detail="Min age must be less than max age.")
        if "valid_min_age" in error_msg:
             raise HTTPException(status_code=400, detail="Min age must be at least 18.")
        
        raise HTTPException(status_code=400, detail="Invalid profile data provided. Please check your inputs.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error updating profile: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to update profile due to a server error.")

    logger.info(f"Profile updated successfully for user {current_user.id}")
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

@router.post("/me/photos/upload", response_model=List[UserPhoto])
def upload_user_photo(
    *, 
    db: Session = Depends(deps.get_db), 
    files: List[UploadFile] = File(...), 
    current_user: Any = Depends(deps.get_current_active_user)
) -> Any:
    logger.info(f"Starting photo upload for user {current_user.id} with {len(files)} files")
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos allowed per upload.")

    saved_photos = []
    seen_hashes = set()
    
    # Get current photo count for ordering
    base_count = db.query(UserPhotoModel).filter(UserPhotoModel.user_id == current_user.id).count()
        
    for i, file in enumerate(files):
        try:
            allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
            if file.content_type not in allowed_types:
                logger.warning(f"Invalid file type: {file.content_type}")
                raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Allowed: JPG, PNG, WebP, GIF")
            
            file_bytes = file.file.read()
            file_size = len(file_bytes)
            # Reset cursor for potential future reads (though we use bytes mostly)
            file.file.seek(0)
            
            logger.info(f"Processing file: {file.filename}, size: {file_size} bytes")
            
            if file_size > 5 * 1024 * 1024:
                logger.warning("File too large")
                raise HTTPException(status_code=400, detail=f"File {file.filename} too large (Max 5MB).")

            # Validate Image Integrity immediately
            try:
                with Image.open(io.BytesIO(file_bytes)) as img:
                    img.verify() # Verify file integrity
            except Exception as e:
                logger.warning(f"Invalid image file {file.filename}: {e}")
                raise HTTPException(status_code=400, detail=f"File {file.filename} is not a valid image.")

            # Duplicate Detection
            file_hash = hashlib.sha256(file_bytes).hexdigest()
            
            # Check within current batch
            if file_hash in seen_hashes:
                 logger.warning(f"Duplicate photo in batch: {file.filename}")
                 # Skip duplicates in batch without failing the whole request? 
                 # Or raise error? Frontend should have filtered.
                 # Let's skip to be graceful.
                 continue
            
            seen_hashes.add(file_hash)

            duplicate = db.query(UserPhotoModel).filter(
                UserPhotoModel.user_id == current_user.id,
                UserPhotoModel.file_hash == file_hash
            ).first()
            
            if duplicate:
                logger.warning(f"Duplicate photo detected: {file.filename}")
                raise HTTPException(status_code=400, detail=f"Duplicate photo: {file.filename} has already been uploaded.")

            # AI Validation
            try:
                ai_result = ai_service.validate_image(file_bytes)
                
                # Check for Quarantine/Rejection
                if ai_result.get('quarantine', False):
                     reason = ai_result.get('rejection_reason', 'Unknown safety violation')
                     logger.warning(f"REJECTED/QUARANTINED photo {file.filename} for user {current_user.id}: {reason}. AI Result: {ai_result}")
                     
                     # Detailed logging for audit
                     logger.info(f"AUDIT_LOG: User={current_user.id}, Action=UploadReject, File={file.filename}, Reason={reason}, Confidence={ai_result.get('confidence_score')}, Face={ai_result.get('has_human_face')}")
                     
                     raise HTTPException(
                        status_code=400, 
                        detail=f"Photo rejected: {reason}. Please review our upload guidelines."
                    )

                # 1. Strict Safety Check (Redundant but safe)
                if not ai_result.get('is_safe', True):
                     reason = ai_result.get('security_reason') or "Inappropriate content detected"
                     logger.warning(f"AI rejected photo {file.filename} as unsafe: {reason}")
                     raise HTTPException(status_code=400, detail=f"Photo {file.filename} rejected: {reason}.")
                
                # ... (Rest of checks should be covered by quarantine flag, but keeping for safety) ...

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"AI check failed: {e}")
                # Fail CLOSED for strict enforcement
                raise HTTPException(status_code=500, detail="Image validation service unavailable. Please try again later.")
            
            # Generate unique filename
            file_ext = os.path.splitext(file.filename)[1]
            if not file_ext:
                # Deduce extension from content type if missing
                file_ext = mimetypes.guess_extension(file.content_type) or ".jpg"

            base_name = f"{uuid.uuid4()}"
            filename = f"{base_name}{file_ext}"
            thumb_filename = f"{base_name}_thumb{file_ext}"
            
            # Ensure static/uploads exists
            upload_dir = "static/uploads"
            os.makedirs(upload_dir, exist_ok=True)
            
            file_path = f"{upload_dir}/{filename}"
            thumb_path = f"{upload_dir}/{thumb_filename}"
            
            # Check Resolution before saving
            try:
                with Image.open(io.BytesIO(file_bytes)) as img:
                    if img.width < 200 or img.height < 200:
                         raise HTTPException(status_code=400, detail=f"Image {file.filename} resolution too low (min 200x200).")
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Failed to check resolution for {file.filename}: {e}")
                raise HTTPException(status_code=400, detail=f"File {file.filename} is not a valid image.")

            logger.info(f"Saving file to {file_path}")
            
            try:
                with open(file_path, "wb") as buffer:
                    buffer.write(file_bytes)
                
                # Generate Thumbnail
                try:
                    with Image.open(io.BytesIO(file_bytes)) as img:
                        # Convert to RGB if needed (e.g. PNG with alpha)
                        if img.mode in ('RGBA', 'P'):
                            img = img.convert('RGB')
                        img.thumbnail((300, 300))
                        img.save(thumb_path)
                except Exception as e:
                    logger.error(f"Failed to generate thumbnail: {e}")
                    # Fallback to copy original if thumbnail fails
                    shutil.copy(file_path, thumb_path)
            except IOError as e:
                logger.error(f"Failed to write file to {file_path}: {e}")
                raise HTTPException(status_code=500, detail="Could not save file to disk.")
            
            photo_url = f"/static/uploads/{filename}"
            
            # If base_count is 0 and i is 0, it's primary.
            is_primary = (base_count + i == 0)
            photo_order = base_count + i
            
            photo = UserPhotoModel(
                user_id=current_user.id, 
                photo_url=photo_url, 
                is_primary=is_primary, 
                photo_order=photo_order,
                file_hash=file_hash
            )
            db.add(photo)
            saved_photos.append(photo)
            
        except HTTPException as he:
            # Clean up logic could go here (delete saved files?)
            raise he
        except Exception as e:
            logger.error(f"Unexpected error in upload_user_photo for {file.filename}: {e}")
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

    try:
        db.commit()
        for p in saved_photos:
            db.refresh(p)
    except Exception as e:
        logger.error(f"Database commit failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal Server Error: Could not save photos to database.")
        
    return saved_photos

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

@router.post("/validate-photo")
@limiter.limit("20/minute")
async def validate_photo(
    request: Request,
    file: UploadFile = File(...),
) -> Any:
    """
    Validate if the uploaded photo contains an animal or clear face, and is safe.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await file.read()
        
        # Check size (5MB)
        if len(contents) > 5 * 1024 * 1024:
             raise HTTPException(status_code=400, detail="File too large (Max 5MB)")

        # Use the comprehensive validation
        result = ai_service.validate_image(contents)
        
        # Log the result
        logger.info(f"Photo validation result for {file.filename}: {result}")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating photo: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate photo")
