import unittest
from unittest.mock import MagicMock, patch, ANY
import sys
from datetime import datetime
import os

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
# from app.services.matching_service import MatchingService # Might need similar mocking
from app.domain.enums import SwipeType

# Import the matching endpoint
from app.api.v1.endpoints.matching import create_swipe

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

if __name__ == '__main__':
    unittest.main()
