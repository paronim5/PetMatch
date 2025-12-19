from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.services.notification_service import notification_service
from app.domain.schemas import Notification

router = APIRouter()

@router.get("/", response_model=List[Notification])
def read_notifications(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Retrieve notifications.
    """
    return notification_service.get_notifications(db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/unread-count", response_model=int)
def get_unread_count(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get unread notification count.
    """
    return notification_service.get_unread_count(db, user_id=current_user.id)

@router.post("/{notification_id}/read", response_model=Notification)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark a notification as read.
    """
    notification = notification_service.mark_as_read(db, user_id=current_user.id, notification_id=notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notification

@router.post("/read-all", response_model=dict)
def mark_all_notifications_read(
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    """
    Mark all notifications as read.
    """
    notification_service.mark_all_as_read(db, user_id=current_user.id)
    return {"status": "success"}
