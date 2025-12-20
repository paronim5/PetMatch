
import pytest
from unittest.mock import MagicMock, call
from datetime import datetime
from app.services.messaging_service import MessagingService
from app.domain.models import Message, MessageReaction, Match, MessageRead

def test_add_reaction_new():
    service = MessagingService()
    db = MagicMock()
    
    # Setup
    user_id = 1
    message_id = 100
    emoji = "❤️"
    
    mock_message = MagicMock(spec=Message)
    mock_message.id = message_id
    mock_message.match_id = 50
    mock_message.created_at = datetime.now()
    
    mock_match = MagicMock(spec=Match)
    mock_match.id = 50
    mock_match.user1_id = 1
    mock_match.user2_id = 2
    
    # Mock queries
    # First query gets message
    # Second query gets match
    # Third query checks for existing reaction
    
    def query_side_effect(model):
        query = MagicMock()
        if model == Message:
            query.filter.return_value.first.return_value = mock_message
        elif model == Match:
            query.filter.return_value.first.return_value = mock_match
        elif model == MessageReaction:
            # Fix: The code uses one .filter() call with multiple arguments
            # So we only need one level of .filter.return_value
            query.filter.return_value.first.return_value = None # No existing reaction
        return query
    
    db.query.side_effect = query_side_effect
    
    # Execute
    result = service.add_reaction(db, user_id, message_id, emoji)
    
    # Assert
    assert result == mock_message
    # Check if db.add was called with a MessageReaction
    assert db.add.called
    args = db.add.call_args[0][0]
    assert isinstance(args, MessageReaction)
    assert args.message_id == message_id
    assert args.user_id == user_id
    assert args.reaction_emoji == emoji
    assert db.commit.called
    assert db.refresh.called

def test_add_reaction_toggle_off():
    service = MessagingService()
    db = MagicMock()
    
    # Setup
    user_id = 1
    message_id = 100
    emoji = "❤️"
    
    mock_message = MagicMock(spec=Message)
    mock_message.id = message_id
    mock_message.match_id = 50
    
    mock_match = MagicMock(spec=Match)
    mock_match.id = 50
    mock_match.user1_id = 1
    mock_match.user2_id = 2
    
    mock_existing_reaction = MagicMock(spec=MessageReaction)
    
    def query_side_effect(model):
        query = MagicMock()
        if model == Message:
            query.filter.return_value.first.return_value = mock_message
        elif model == Match:
            query.filter.return_value.first.return_value = mock_match
        elif model == MessageReaction:
            filter_mock = MagicMock()
            filter_mock.first.return_value = mock_existing_reaction
            query.filter.return_value = filter_mock
        return query
    
    db.query.side_effect = query_side_effect
    
    # Execute
    service.add_reaction(db, user_id, message_id, emoji)
    
    # Assert
    assert db.delete.called
    print(f"DEBUG: db.delete called with: {db.delete.call_args}")
    assert db.delete.call_args[0][0] == mock_existing_reaction
    assert db.commit.called

def test_mark_messages_read():
    service = MessagingService()
    db = MagicMock()
    
    user_id = 1
    match_id = 50
    
    mock_match = MagicMock(spec=Match)
    mock_match.id = match_id
    mock_match.user1_id = 1
    mock_match.user2_id = 2
    
    mock_msg1 = MagicMock(spec=Message)
    mock_msg1.id = 101
    mock_msg1.created_at = datetime.now()
    
    mock_msg2 = MagicMock(spec=Message)
    mock_msg2.id = 102
    mock_msg2.created_at = datetime.now()
    
    def query_side_effect(model):
        query = MagicMock()
        if model == Match:
            query.filter.return_value.first.return_value = mock_match
        elif model == Message:
            # Mock complex query for unread messages
            # chain: outerjoin -> filter -> all
            # The actual code: db.query(Message).outerjoin(...).filter(...).all()
            q = MagicMock()
            q.outerjoin.return_value.filter.return_value.all.return_value = [mock_msg1, mock_msg2]
            return q
        return query
        
    db.query.side_effect = query_side_effect
    
    # Execute
    result = service.mark_messages_read(db, user_id, match_id)
    
    # Assert
    assert result is True
    assert db.add.call_count == 2
    # Check that MessageRead objects were added
    calls = db.add.call_args_list
    assert isinstance(calls[0][0][0], MessageRead)
    assert isinstance(calls[1][0][0], MessageRead)
    assert calls[0][0][0].message_id == 101
    assert calls[1][0][0].message_id == 102
    assert db.commit.called

if __name__ == "__main__":
    try:
        test_add_reaction_new()
        test_add_reaction_toggle_off()
        test_mark_messages_read()
        print("All tests passed!")
    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()
