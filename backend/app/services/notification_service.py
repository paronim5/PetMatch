import os
import logging
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.domain.models import Notification, PushToken
from app.domain.schemas import Notification as NotificationSchema
from app.domain.events import event_bus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Firebase Admin Setup
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
except ImportError:
    firebase_admin = None

class NotificationService:
    def __init__(self):
        self._initialize_firebase()

    def _initialize_firebase(self):
        if firebase_admin and not firebase_admin._apps:
            try:
                # Expects GOOGLE_APPLICATION_CREDENTIALS env var or default path
                # For now, we'll try default or skip if not configured
                cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "firebase-service-account.json")
                if os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    logger.info("Firebase Admin initialized successfully.")
                else:
                    logger.warning(f"Firebase credentials not found at {cred_path}. FCM disabled.")
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")

    def create_notification(self, db: Session, user_id: int, type: str, title: str, message: str, 
                            related_user_id: Optional[int] = None, related_match_id: Optional[int] = None,
                            related_message_id: Optional[int] = None) -> Notification:
        logger.info(f"Creating notification for user {user_id}, type={type}")
        try:
            start_time = datetime.utcnow()
            notification = Notification(
                user_id=user_id,
                notification_type=type,
                title=title,
                message=message,
                related_user_id=related_user_id,
                related_match_id=related_match_id,
                related_message_id=related_message_id,
                created_at=start_time,
                is_read=False
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)

            # Real-time push (Event Bus for in-app)
            try:
                event_bus.notify("new_notification", {
                    "recipient_id": user_id,
                    "notification": {
                        "id": notification.id,
                        "title": title,
                        "message": message,
                        "type": type,
                        "is_read": False,
                        "created_at": notification.created_at.isoformat(),
                        "related_user_id": related_user_id,
                        "related_match_id": related_match_id
                    }
                })
            except Exception as e:
                 logger.error(f"Failed to send real-time notification via EventBus: {e}")

            # Send Push Notification (FCM)
            try:
                self.send_push_notification(db, user_id, title, message, {"type": type, "id": str(notification.id)})
            except Exception as e:
                logger.error(f"Failed to send push notification to user {user_id}: {e}")
            
            logger.info(f"Notification created successfully: id={notification.id}, user={user_id}, type={type}")
            return notification
        except Exception as e:
            logger.error(f"Failed to create notification record for user {user_id}: {e}", exc_info=True)
            raise

    def send_push_notification(self, db: Session, user_id: int, title: str, body: str, data: dict = None):
        """
        Send a push notification to the user's devices using FCM.
        """
        if not firebase_admin or not firebase_admin._apps:
            # Fallback for dev/test without firebase
            logger.info(f"[FCM Mock] Sending to user {user_id}: {title} - {body}")
            return

        tokens = db.query(PushToken).filter(
            PushToken.user_id == user_id,
            PushToken.is_active == True
        ).all()
        
        if not tokens:
            logger.debug(f"No active push tokens for user {user_id}")
            return

        for token in tokens:
            try:
                msg = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body,
                    ),
                    data=data or {},
                    token=token.device_token,
                )
                response = messaging.send(msg)
                logger.info(f"Successfully sent FCM message to {token.device_token[:10]}...: {response}")
            except Exception as e:
                logger.error(f"Error sending FCM message to {token.device_token}: {e}")
                # Optional: deactivate token if invalid
                # In a real scenario, we should check the error type and deactivate if it's an invalid token error


            
    def get_notifications(self, db: Session, user_id: int, skip: int = 0, limit: int = 20) -> List[Notification]:
        # Sort by unread first, then by date desc
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.deleted_at.is_(None)
        ).order_by(
            Notification.is_read.asc(),
            Notification.created_at.desc()
        ).offset(skip).limit(limit).all()

    def get_unread_count(self, db: Session, user_id: int) -> int:
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None)
        ).count()

    def get_unread_notifications(self, db: Session, user_id: int, limit: int = 10) -> List[Notification]:
        return db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False,
            Notification.deleted_at.is_(None)
        ).order_by(
            Notification.created_at.desc()
        ).limit(limit).all()

    def mark_as_read(self, db: Session, user_id: int, notification_id: int) -> Optional[Notification]:
        notification = db.query(Notification).filter(
            Notification.id == notification_id,
            Notification.user_id == user_id
        ).first()
        if notification:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)
        return notification

    def mark_match_notifications_as_read(self, db: Session, user_id: int, match_id: int):
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.related_match_id == match_id,
            Notification.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        db.commit()

    def mark_all_as_read(self, db: Session, user_id: int):
        db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True, "read_at": datetime.utcnow()})
        db.commit()

    def mark_notifications_as_read(self, db: Session, user_id: int, notification_ids: List[int]) -> int:
        if not notification_ids:
            return 0
        updated = db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.id.in_(notification_ids),
            Notification.is_read == False
        ).update(
            {"is_read": True, "read_at": datetime.utcnow()},
            synchronize_session=False
        )
        db.commit()
        return updated

notification_service = NotificationService()
