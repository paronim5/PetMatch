from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.api import deps
from app.domain.schemas import User, SwipeCreate, Swipe, SwipeWithUser
from app.services.matching_service import matching_service
from app.services.subscription_service import subscription_service
from app.domain.models import Swipe as SwipeModel, Match, User as UserModel, UserProfile, UserPreferences
from datetime import datetime
from app.domain.enums import SwipeType
from app.services.notification_service import notification_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/history", response_model=List[SwipeWithUser])
def get_swipe_history(
    type: Optional[str] = Query(None, description="Filter by swipe type: 'like', 'super_like', or None for all"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    skip: int = 0,
    limit: int = 50,
) -> Any:
    """
    Get history of users who swiped on the current user.
    """
    query = db.query(SwipeModel).options(
        joinedload(SwipeModel.swiper).joinedload(UserModel.profile),
        joinedload(SwipeModel.swiper).joinedload(UserModel.photos)
    ).filter(
        SwipeModel.swiped_id == current_user.id
    )

    if type:
        if type == "like":
            query = query.filter(SwipeModel.swipe_type == SwipeType.like)
        elif type == "super_like":
            query = query.filter(SwipeModel.swipe_type == SwipeType.super_like)
        # If "all" or specific types not handled, usually we want like/super_like for history?
        # User asked for "All swipes", "Only likes", "Only super_likes".
        # Assuming "All swipes" means all incoming likes/super_likes (not passes).
        # Usually users don't see who passed them.
        # Let's restrict to like/super_like by default for "history" unless specific requirement says otherwise.
        # "Create a dedicated page to display all users who have swiped like/super_like" -> So only positive swipes.
    
    # Always filter for like/super_like for this view as per requirement
    query = query.filter(SwipeModel.swipe_type.in_([SwipeType.like, SwipeType.super_like]))

    return query.order_by(SwipeModel.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/candidates", response_model=List[User])
def get_matching_candidates(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    limit: int = 10,
) -> Any:
    """
    Get matching candidates for the current user.
    """
    try:
        return matching_service.get_matches(db, user=current_user, limit=limit)
    except Exception as e:
        logger.error(f"Error fetching candidates for user {current_user.id}: {e}", exc_info=True)
        # Include error detail in response for debugging purposes
        raise HTTPException(status_code=500, detail=f"Internal Server Error: Failed to fetch candidates. {str(e)}")

@router.get("/likers", response_model=List[User])
def get_likers(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
    swipe_type: Optional[str] = Query(None, description="Filter by swipe type: like or super_like"),
    limit: int = 50,
) -> Any:
    """
    Get users who have liked or super_liked the current user.
    """
    query = db.query(UserModel).join(SwipeModel, SwipeModel.swiper_id == UserModel.id).filter(
        SwipeModel.swiped_id == current_user.id,
        SwipeModel.swipe_type.in_([SwipeType.like, SwipeType.super_like])
    )
    
    if swipe_type:
        query = query.filter(SwipeModel.swipe_type == swipe_type)
        
    # Order by most recent swipe
    query = query.order_by(SwipeModel.created_at.desc())
    
    # Eager load profile and photos
    users = query.options(
        joinedload(UserModel.profile),
        joinedload(UserModel.photos)
    ).limit(limit).all()
    
    return users

@router.post("/swipe", response_model=Swipe)
def create_swipe(
    *,
    db: Session = Depends(deps.get_db),
    swipe_in: SwipeCreate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Record a swipe (like, pass, super_like).
    """
    try:
        existing_swipe = db.query(SwipeModel).filter(
            SwipeModel.swiper_id == current_user.id,
            SwipeModel.swiped_id == swipe_in.swiped_id
        ).first()
        
        if existing_swipe:
            # Idempotency: If swipe exists, return it (success) instead of error
            return existing_swipe

        # Check subscription limits (only if new swipe)
        # This will raise 403 if limit reached
        subscription_service.check_and_increment_swipe(db, current_user)

        swipe = SwipeModel(
            swiper_id=current_user.id,
            swiped_id=swipe_in.swiped_id,
            swipe_type=swipe_in.swipe_type.value,
            created_at=datetime.utcnow()
        )
        db.add(swipe)
        db.commit()
        db.refresh(swipe)

        # Notify the swiped user that they received a like/super_like
        if swipe_in.swipe_type in {SwipeType.like, SwipeType.super_like}:
            try:
                # Check settings
                target_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == swipe_in.swiped_id).first()
                should_notify = not target_prefs or target_prefs.notify_likes
                
                if should_notify:
                    msg_title = "New Like!"
                    msg_body = f"{current_user.username} liked you!"
                    if swipe_in.swipe_type == SwipeType.super_like:
                         msg_title = "Super Like!"
                         msg_body = f"{current_user.username} super_liked you!"

                    notification_service.create_notification(
                        db,
                        user_id=swipe_in.swiped_id,
                        type="like" if swipe_in.swipe_type == SwipeType.like else "super_like",
                        title=msg_title,
                        message=msg_body,
                        related_user_id=current_user.id
                    )
            except Exception:
                pass

            # Check if the other user already liked current user -> create match
            other_swipe = db.query(SwipeModel).filter(
                SwipeModel.swiper_id == swipe_in.swiped_id,
                SwipeModel.swiped_id == current_user.id,
                SwipeModel.swipe_type.in_([SwipeType.like, SwipeType.super_like])
            ).first()
            
            if other_swipe:
                # Avoid duplicate matches if one exists
                existing_match = db.query(Match).filter(
                    ((Match.user1_id == current_user.id) & (Match.user2_id == swipe_in.swiped_id)) |
                    ((Match.user1_id == swipe_in.swiped_id) & (Match.user2_id == current_user.id))
                ).first()
                
                if not existing_match:
                    match = Match(
                        user1_id=min(current_user.id, swipe_in.swiped_id),
                        user2_id=max(current_user.id, swipe_in.swiped_id),
                        matched_at=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(match)
                    db.commit()
                    db.refresh(match)
                    
                    try:
                        # Notify Current User
                        curr_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == current_user.id).first()
                        if not curr_prefs or curr_prefs.notify_matches:
                            notification_service.create_notification(
                                db,
                                user_id=current_user.id,
                                type="match",
                                title="It's a match!",
                                message=f"You matched with {db.query(UserModel).get(swipe_in.swiped_id).username}!",
                                related_user_id=swipe_in.swiped_id,
                                related_match_id=match.id
                            )

                        # Notify Other User
                        try:
                             target_prefs_match = db.query(UserPreferences).filter(UserPreferences.user_id == swipe_in.swiped_id).first()
                             if not target_prefs_match or target_prefs_match.notify_matches:
                                notification_service.create_notification(
                                    db,
                                    user_id=swipe_in.swiped_id,
                                    type="match",
                                    title="It's a match!",
                                    message=f"You matched with {current_user.username}!",
                                    related_user_id=current_user.id,
                                    related_match_id=match.id
                                )
                        except Exception:
                            pass
                    except Exception:
                        pass

        return swipe
    except HTTPException:
        raise
    except Exception as e:
        print(f"Swipe Error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to record swipe: {type(e).__name__}: {str(e)}")
