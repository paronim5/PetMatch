import unittest
from unittest.mock import MagicMock, patch, ANY
import sys
from datetime import datetime
import os
from starlette.requests import Request

# Mock firebase_admin before importing notification_service
sys.modules["firebase_admin"] = MagicMock()
sys.modules["firebase_admin.messaging"] = MagicMock()
sys.modules["firebase_admin.credentials"] = MagicMock()

# Mock settings to avoid pydantic validation error
mock_settings = MagicMock()
mock_settings.POSTGRES_SERVER = "localhost"
mock_settings.POSTGRES_USER = "user"
mock_settings.POSTGRES_PASSWORD = "password"
mock_settings.POSTGRES_DB = "db"
mock_settings.SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"

# We need to mock app.core.config BEFORE importing anything that uses it
# However, we can also just set env vars if that's easier, but mocking module is cleaner if possible.
# Let's try to patch the Settings class or the module.
sys.modules["app.core.config"] = MagicMock()
sys.modules["app.core.config"].settings = mock_settings

from app.services.notification_service import NotificationService
from app.domain.models import Notification, PushToken, User, UserPreferences, Match, Message, Block
from app.services.messaging_service import MessagingService
from app.domain.enums import SwipeType
from app.api.v1.endpoints.matching import create_swipe
from app.api.v1.endpoints.notifications import (
    create_notification as create_notification_endpoint,
    get_unread_notifications as get_unread_notifications_endpoint,
    mark_notifications_read as mark_notifications_read_endpoint,
    NotificationCreatePayload,
    MarkReadPayload,
)

class TestNotificationService(unittest.TestCase):
    def setUp(self):
        self.db = MagicMock()
        self.notification_service = NotificationService()
        self.messaging_service = MessagingService()
        # We need to mock notification_service used inside messaging_service
        # Since we can't easily patch the imported instance in messaging_service without some work,
        # we'll rely on patching it during the test method.

    @patch('app.services.notification_service.event_bus')
    @patch('app.services.notification_service.messaging')
    def test_create_notification_success(self, mock_messaging, mock_event_bus):
        # Setup
        user_id = 1
        title = "Test Notification"
        message = "This is a test"
        type = "test"
        
        # Mock DB behavior
        self.db.add = MagicMock()
        self.db.commit = MagicMock()
        self.db.refresh = MagicMock()
        
        # Mock Push Token
        mock_token = PushToken(user_id=user_id, device_token="token123", is_active=True)
        self.db.query.return_value.filter.return_value.all.return_value = [mock_token]
        
        # Execute
        notification = self.notification_service.create_notification(
            self.db, user_id, type, title, message
        )
        
        # Verify DB interactions
        self.db.add.assert_called_once()
        self.db.commit.assert_called_once()
        
        # Verify Event Bus
        mock_event_bus.notify.assert_called_once_with("new_notification", ANY)
        
        # Verify FCM
        mock_messaging.Message.assert_called_once()
        mock_messaging.send.assert_called_once()

    @patch('app.services.notification_service.event_bus')
    @patch('app.services.notification_service.messaging')
    def test_create_notification_push_failure_does_not_fail_function(self, mock_messaging, mock_event_bus):
        # Setup
        user_id = 1
        
        # Mock DB behavior
        self.db.add = MagicMock()
        self.db.commit = MagicMock()
        self.db.refresh = MagicMock()
        
        # Mock Push Token
        mock_token = PushToken(user_id=user_id, device_token="token123", is_active=True)
        self.db.query.return_value.filter.return_value.all.return_value = [mock_token]
        
        # Mock FCM Failure
        mock_messaging.send.side_effect = Exception("FCM Error")
        
        # Execute (should not raise exception)
        notification = self.notification_service.create_notification(
            self.db, user_id, "test", "Title", "Message"
        )
        
        # Verify DB still committed
        self.db.commit.assert_called_once()

    @patch('app.services.messaging_service.notification_service')
    @patch('app.services.messaging_service.event_bus')
    def test_send_message_triggers_notification(self, mock_event_bus, mock_notification_service):
        # Setup
        sender_id = 1
        recipient_id = 2
        match_id = 100
        
        message_in = MagicMock()
        message_in.match_id = match_id
        message_in.message_text = "Hello"
        message_in.media_url = None
        message_in.recipient_id = recipient_id
        
        # Mock Match
        match = Match(id=match_id, user1_id=sender_id, user2_id=recipient_id, is_active=True)
        
        # Mock DB queries
        # 1. Block check (None)
        # 2. Match check (match)
        # 3. Block check 2 (None)
        # 4. Recipient prefs (notify_messages=True)
        # 5. Sender (user)
        
        def query_side_effect(model):
            query = MagicMock()
            if model == Block:
                query.filter.return_value.first.return_value = None
            elif model == Match:
                query.filter.return_value.first.return_value = match
            elif model == UserPreferences:
                prefs = UserPreferences(user_id=recipient_id, notify_messages=True)
                query.filter.return_value.first.return_value = prefs
            elif model == User:
                user = User(id=sender_id, username="Sender")
                query.filter.return_value.first.return_value = user
            return query
            
        self.db.query.side_effect = query_side_effect
        
        # Execute
        self.messaging_service.send_message(self.db, sender_id, message_in)
        
        # Verify Notification Service called
        mock_notification_service.create_notification.assert_called_once_with(
            self.db,
            user_id=recipient_id,
            type="message",
            title="Message from Sender",
            message="Hello",
            related_user_id=sender_id,
            related_match_id=match_id,
            related_message_id=ANY
        )

    @patch('app.api.v1.endpoints.matching.notification_service')
    @patch('app.api.v1.endpoints.matching.subscription_service')
    def test_create_swipe_triggers_notification(self, mock_subscription_service, mock_notification_service):
        # Setup
        swiper_id = 1
        swiped_id = 2
        
        swipe_in = MagicMock()
        swipe_in.swiped_id = swiped_id
        swipe_in.swipe_type = SwipeType.like
        
        current_user = User(id=swiper_id, username="Swiper")
        
        # Mock DB queries
        # 1. Check existing swipe (None)
        # 2. Check target prefs (None or True)
        # 3. Check other swipe (None - no match yet)
        
        def query_side_effect(model):
            query = MagicMock()
            if model == SwipeType: # not a model
                 return query
            
            # Check for existing swipe
            if str(model) == "<class 'app.domain.models.Swipe'>":
                # First call is check existing swipe
                # Second call is check other swipe
                # This is tricky with side_effect.
                # Let's verify call arguments in filter
                pass
            
            # For simplicity, we can make all queries return None or specific objects based on filter
            # But query objects are chained.
            return query
            
        # Better approach: Mock db.query return value's filter return value...
        # 1. existing_swipe = db.query(SwipeModel).filter(...).first() -> None
        # 2. target_prefs = db.query(UserPreferences).filter(...).first() -> None (defaults to True)
        # 3. other_swipe = db.query(SwipeModel).filter(...).first() -> None
        
        self.db.query.return_value.filter.return_value.first.return_value = None
        
        # Execute
        create_swipe(db=self.db, swipe_in=swipe_in, current_user=current_user)
        
        # Verify Notification Service called
        mock_notification_service.create_notification.assert_called_with(
            self.db,
            user_id=swiped_id,
            type="like",
            title="New Like!",
            message="Swiper liked you!",
            related_user_id=swiper_id
        )

    @patch('app.api.v1.endpoints.notifications.notification_service')
    def test_create_notification_endpoint_maps_fields(self, mock_notification_service):
        db = self.db
        current_user = MagicMock()
        current_user.id = 1
        payload = NotificationCreatePayload(
            receiver_id=2,
            action_type="super_like",
            content="Test content",
            related_match_id=None,
            related_message_id=None,
        )
        mock_notification = MagicMock()
        mock_notification.id = 10
        mock_notification.user_id = 2
        mock_notification.related_user_id = 1
        mock_notification.notification_type = "super_like"
        mock_notification.message = "Test content"
        mock_notification.is_read = False
        mock_notification.created_at = datetime.utcnow()
        mock_notification_service.create_notification.return_value = mock_notification
        result = create_notification_endpoint(payload=payload, db=db, current_user=current_user)
        mock_notification_service.create_notification.assert_called_once_with(
            db=db,
            user_id=2,
            type="super_like",
            title="super_like",
            message="Test content",
            related_user_id=1,
            related_match_id=None,
            related_message_id=None,
        )
        assert result.sender_id == 1
        assert result.receiver_id == 2
        assert result.action_type == "super_like"
        assert result.content == "Test content"
        assert result.is_read is False

    @patch('app.api.v1.endpoints.notifications.notification_service')
    def test_unread_endpoint_returns_count_and_items(self, mock_notification_service):
        db = self.db
        current_user = MagicMock()
        current_user.id = 5
        notif1 = MagicMock()
        notif1.id = 1
        notif1.user_id = 5
        notif1.related_user_id = 2
        notif1.notification_type = "message"
        notif1.message = "Hello"
        notif1.is_read = False
        notif1.created_at = datetime.utcnow()
        notif2 = MagicMock()
        notif2.id = 2
        notif2.user_id = 5
        notif2.related_user_id = 3
        notif2.notification_type = "super_like"
        notif2.message = "Hi"
        notif2.is_read = False
        notif2.created_at = datetime.utcnow()
        mock_notification_service.get_unread_notifications.return_value = [notif1, notif2]
        mock_notification_service.get_unread_count.return_value = 2
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/notifications/unread",
            "headers": [],
            "client": ("testclient", 12345),
        }
        request = Request(scope)
        result = get_unread_notifications_endpoint(
            request=request,
            user_id=None,
            limit=10,
            db=db,
            current_user=current_user,
        )
        mock_notification_service.get_unread_notifications.assert_called_once()
        mock_notification_service.get_unread_count.assert_called_once_with(db, user_id=5)
        assert result.count == 2
        assert len(result.notifications) == 2
        assert result.notifications[0].receiver_id == 5

    @patch('app.api.v1.endpoints.notifications.notification_service')
    def test_mark_notifications_read_endpoint(self, mock_notification_service):
        db = self.db
        current_user = MagicMock()
        current_user.id = 7
        mock_notification_service.mark_notifications_as_read.return_value = 3
        payload = MarkReadPayload(notification_ids=[1, 2, 3])
        result = mark_notifications_read_endpoint(
            payload=payload,
            db=db,
            current_user=current_user,
        )
        mock_notification_service.mark_notifications_as_read.assert_called_once_with(
            db=db,
            user_id=7,
            notification_ids=[1, 2, 3],
        )
        assert result.updated_count == 3

if __name__ == '__main__':
    unittest.main()
