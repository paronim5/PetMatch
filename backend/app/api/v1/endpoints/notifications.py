from typing import Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.services.notification_service import notification_service
from app.domain.schemas import Notification
from pydantic import BaseModel
from app.core.limiter import limiter


class NotificationCreatePayload(BaseModel):
    receiver_id: int
    action_type: str
    content: str
    related_match_id: Optional[int] = None
    related_message_id: Optional[int] = None


class NotificationItem(BaseModel):
    id: int
    sender_id: Optional[int]
    receiver_id: int
    action_type: str
    content: Optional[str]
    is_read: bool
    created_at: datetime


class UnreadNotificationsResponse(BaseModel):
    count: int
    notifications: List[NotificationItem]


class MarkReadPayload(BaseModel):
    notification_ids: List[int]


class MarkReadResponse(BaseModel):
    updated_count: int

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


@router.post("/create", response_model=NotificationItem)
def create_notification(
    payload: NotificationCreatePayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    if payload.receiver_id == current_user.id:
        sender_id = current_user.id
    else:
        sender_id = current_user.id
    notification = notification_service.create_notification(
        db=db,
        user_id=payload.receiver_id,
        type=payload.action_type,
        title=payload.action_type,
        message=payload.content,
        related_user_id=sender_id,
        related_match_id=payload.related_match_id,
        related_message_id=payload.related_message_id,
    )
    return NotificationItem(
        id=notification.id,
        sender_id=notification.related_user_id,
        receiver_id=notification.user_id,
        action_type=notification.notification_type,
        content=notification.message,
        is_read=notification.is_read,
        created_at=notification.created_at,
    )


@router.get("/unread", response_model=UnreadNotificationsResponse)
@limiter.limit("60/minute")
def get_unread_notifications(
    request: Request,
    user_id: Optional[int] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    target_user_id = user_id if user_id is not None else current_user.id
    if target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    notifications = notification_service.get_unread_notifications(
        db=db,
        user_id=target_user_id,
        limit=limit,
    )
    count = notification_service.get_unread_count(db, user_id=target_user_id)
    items = [
        NotificationItem(
            id=n.id,
            sender_id=n.related_user_id,
            receiver_id=n.user_id,
            action_type=n.notification_type,
            content=n.message,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in notifications
    ]
    return UnreadNotificationsResponse(count=count, notifications=items)

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


@router.post("/mark-read", response_model=MarkReadResponse)
def mark_notifications_read(
    payload: MarkReadPayload,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user),
) -> Any:
    updated = notification_service.mark_notifications_as_read(
        db=db,
        user_id=current_user.id,
        notification_ids=payload.notification_ids,
    )
    return MarkReadResponse(updated_count=updated)
