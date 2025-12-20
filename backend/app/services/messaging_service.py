from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from app.domain.models import Message, Match, User, UserProfile, UserPreferences, Block, MessageReaction, MessageRead
from app.domain.schemas import MessageCreate, Match as MatchSchema
from app.domain.events import event_bus
from app.services.notification_service import notification_service

class MessagingService:
    def send_message(self, db: Session, sender_id: int, message_in: MessageCreate) -> Message:
        match_id = message_in.match_id
        
        # If match_id is not provided, try to find match by recipient_id
        if not match_id and message_in.recipient_id:
            # Check for block before finding match
            is_blocked = db.query(Block).filter(
                or_(
                    and_(Block.blocker_id == sender_id, Block.blocked_id == message_in.recipient_id),
                    and_(Block.blocker_id == message_in.recipient_id, Block.blocked_id == sender_id)
                )
            ).first()
            if is_blocked:
                raise ValueError("Cannot send message: Blocked")

            match = db.query(Match).filter(
                or_(
                    and_(Match.user1_id == sender_id, Match.user2_id == message_in.recipient_id),
                    and_(Match.user1_id == message_in.recipient_id, Match.user2_id == sender_id)
                ),
                Match.is_active == True
            ).first()
            if match:
                match_id = match.id
            else:
                # Optional: Auto-create match if allowed? 
                # For now, require existing match
                raise ValueError("No active match found with this user")

        if not match_id:
            raise ValueError("match_id or valid recipient_id required")

        # Verify match exists and is active
        match = db.query(Match).filter(
            Match.id == match_id,
            Match.is_active == True
        ).first()
        
        if not match:
            raise ValueError("Match not found or inactive")
            
        # Verify sender is part of the match
        if match.user1_id != sender_id and match.user2_id != sender_id:
            raise ValueError("User is not part of this match")
        
        recipient_id = match.user1_id if match.user2_id == sender_id else match.user2_id

        # Check for block using match participants
        is_blocked = db.query(Block).filter(
            or_(
                and_(Block.blocker_id == sender_id, Block.blocked_id == recipient_id),
                and_(Block.blocker_id == recipient_id, Block.blocked_id == sender_id)
            )
        ).first()
        
        if is_blocked:
             raise ValueError("Cannot send message: Blocked")
            
        # Create message
        db_message = Message(
            match_id=match_id,
            sender_id=sender_id,
            message_text=message_in.message_text,
            media_url=message_in.media_url,
            created_at=datetime.utcnow()
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        # Notify recipient via Event Bus (best-effort, never break message flow)
        recipient_id = match.user1_id if match.user2_id == sender_id else match.user2_id
        try:
            event_bus.notify("new_message", {
                "message_id": db_message.id,
                "sender_id": sender_id,
                "recipient_id": recipient_id,
                "match_id": match.id,
                "text": db_message.message_text
            })
        except Exception:
            pass
        
        # Persist notification for recipient
        try:
            # Check recipient settings
            recipient_prefs = db.query(UserPreferences).filter(UserPreferences.user_id == recipient_id).first()
            if not recipient_prefs or recipient_prefs.notify_messages:
                # Get Sender Username
                sender = db.query(User).filter(User.id == sender_id).first()
                sender_name = sender.username if sender else "Someone"
                
                preview = (db_message.message_text or "New message")
                notification_service.create_notification(
                    db,
                    user_id=recipient_id,
                    type="message",
                    title=f"Message from {sender_name}",
                    message=preview[:50] + ("..." if len(preview) > 50 else "") if preview else "Sent an attachment",
                    related_user_id=sender_id,
                    related_match_id=match.id,
                    related_message_id=db_message.id
                )
        except Exception as e:
            # Do not interrupt message flow on notification error
            print(f"Notification Error: {e}")
            pass
        
        return db_message

    def get_messages(self, db: Session, match_id: int, user_id: int, limit: int = 50, offset: int = 0) -> List[Message]:
        # Verify user is part of the match
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise ValueError("Match not found")
            
        if match.user1_id != user_id and match.user2_id != user_id:
            raise ValueError("User is not part of this match")
            
        return db.query(Message).options(
            joinedload(Message.reactions),
            joinedload(Message.reads)
        ).filter(
            Message.match_id == match_id
        ).order_by(Message.created_at.desc()).limit(limit).offset(offset).all()

    def react_to_message(self, db: Session, user_id: int, message_id: int, emoji: str) -> Message:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise ValueError("Message not found")
            
        # Verify user is part of the match
        match = db.query(Match).filter(Match.id == message.match_id).first()
        if not match or (match.user1_id != user_id and match.user2_id != user_id):
            raise ValueError("Unauthorized")

        # Check existing reaction
        existing = db.query(MessageReaction).filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.reaction_emoji == emoji
        ).first()

        if existing:
            db.delete(existing)
        else:
            reaction = MessageReaction(
                message_id=message_id,
                message_created_at=message.created_at,
                user_id=user_id,
                reaction_emoji=emoji
            )
            db.add(reaction)
        
        db.commit()
        db.refresh(message)
        return message

    def mark_messages_as_read(self, db: Session, user_id: int, match_id: int):
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise ValueError("Match not found")
        
        if match.user1_id != user_id and match.user2_id != user_id:
            raise ValueError("Unauthorized")

        # Find unread messages sent by the other user
        # We want messages where match_id matches, sender_id != user_id
        # AND there is NO MessageRead for this user_id
        
        unread_messages = db.query(Message).filter(
            Message.match_id == match_id,
            Message.sender_id != user_id,
            ~Message.reads.any(MessageRead.reader_id == user_id)
        ).all()

        for msg in unread_messages:
            read_entry = MessageRead(
                message_id=msg.id,
                message_created_at=msg.created_at,
                reader_id=user_id
            )
            db.add(read_entry)
        
        if unread_messages:
            db.commit()


    def get_user_matches(self, db: Session, user_id: int) -> List[Match]:
        """Get all active matches (chats) with latest message preview"""
        
        # Get blocked/blocker IDs
        blocked_ids = db.query(Block.blocked_id).filter(Block.blocker_id == user_id).subquery()
        blocker_ids = db.query(Block.blocker_id).filter(Block.blocked_id == user_id).subquery()

        # Eager load user details for UI
        matches = db.query(Match).options(
            joinedload(Match.user1).joinedload(User.profile),
            joinedload(Match.user1).joinedload(User.photos),
            joinedload(Match.user2).joinedload(User.profile),
            joinedload(Match.user2).joinedload(User.photos),
        ).filter(
            or_(Match.user1_id == user_id, Match.user2_id == user_id),
            Match.is_active == True,
            Match.user1_id.notin_(blocked_ids),
            Match.user1_id.notin_(blocker_ids),
            Match.user2_id.notin_(blocked_ids),
            Match.user2_id.notin_(blocker_ids)
        ).all()
        return matches

    def join_chat_by_code(self, db: Session, user_id: int, code: str) -> Match:
        # Code format expected: "USER-{id}" to match with a specific user
        # Or "MATCH-{id}" to join an existing match (if authorized)
        code_upper = code.upper().strip()
        if code_upper.startswith("USER-"):
            try:
                target_user_id = int(code_upper.split("-")[1])
            except (IndexError, ValueError):
                raise ValueError("Invalid code format")
                
            if target_user_id == user_id:
                raise ValueError("Cannot match with yourself")
                
            # Check if user exists
            target_user = db.query(User).filter(User.id == target_user_id).first()
            if not target_user:
                raise ValueError("User not found")

            # Check for block
            is_blocked = db.query(Block).filter(
                or_(
                    and_(Block.blocker_id == user_id, Block.blocked_id == target_user_id),
                    and_(Block.blocker_id == target_user_id, Block.blocked_id == user_id)
                )
            ).first()
            if is_blocked:
                raise ValueError("Cannot match: Blocked")
                
            # Check if match exists
            match = db.query(Match).filter(
                or_(
                    and_(Match.user1_id == user_id, Match.user2_id == target_user_id),
                    and_(Match.user1_id == target_user_id, Match.user2_id == user_id)
                )
            ).first()
            
            if match:
                if not match.is_active:
                    match.is_active = True
                    db.commit()
                return match
            else:
                # Create new match
                # Ensure ordered IDs
                u1, u2 = sorted([user_id, target_user_id])
                new_match = Match(
                    user1_id=u1,
                    user2_id=u2,
                    is_active=True,
                    matched_at=datetime.utcnow()
                )
                db.add(new_match)
                db.commit()
                db.refresh(new_match)
                
                # Notify target
                event_bus.notify("new_match", {
                    "match_id": new_match.id,
                    "matcher_id": user_id,
                    "recipient_id": target_user_id
                })
                
                # Persist notifications for both users
                try:
                    notification_service.create_notification(
                        db,
                        user_id=user_id,
                        type="match",
                        title="It's a match!",
                        message="You and another user are matched.",
                        related_user_id=target_user_id,
                        related_match_id=new_match.id
                    )
                    notification_service.create_notification(
                        db,
                        user_id=target_user_id,
                        type="match",
                        title="It's a match!",
                        message="You have a new match.",
                        related_user_id=user_id,
                        related_match_id=new_match.id
                    )
                except Exception:
                    pass
                
                return new_match
        elif code_upper.startswith("MATCH-"):
            try:
                match_id = int(code_upper.split("-")[1])
            except (IndexError, ValueError):
                raise ValueError("Invalid code format")
            
            match = db.query(Match).filter(Match.id == match_id).first()
            if not match:
                raise ValueError("Match not found")
            if match.user1_id != user_id and match.user2_id != user_id:
                raise ValueError("User is not part of this match")
            if not match.is_active:
                match.is_active = True
                db.commit()
            return match
        else:
            raise ValueError("Invalid code format. Use 'USER-{id}' or 'MATCH-{id}'")

    def join_chat_by_username(self, db: Session, user_id: int, username: str) -> Match:
        # Find target user by username and create or return existing match
        target = db.query(User).filter(User.username == username).first()
        if not target:
            raise ValueError("User not found")
        if target.id == user_id:
            raise ValueError("Cannot match with yourself")
            
        # Check for block
        is_blocked = db.query(Block).filter(
            or_(
                and_(Block.blocker_id == user_id, Block.blocked_id == target.id),
                and_(Block.blocker_id == target.id, Block.blocked_id == user_id)
            )
        ).first()
        if is_blocked:
            raise ValueError("Cannot match: Blocked")

        match = db.query(Match).filter(
            or_(
                and_(Match.user1_id == user_id, Match.user2_id == target.id),
                and_(Match.user1_id == target.id, Match.user2_id == user_id)
            )
        ).first()
        if match:
            if not match.is_active:
                match.is_active = True
                db.commit()
            return match
        u1, u2 = sorted([user_id, target.id])
        new_match = Match(
            user1_id=u1,
            user2_id=u2,
            is_active=True,
            matched_at=datetime.utcnow()
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        try:
            event_bus.notify("new_match", {
                "match_id": new_match.id,
                "matcher_id": user_id,
                "recipient_id": target.id
            })
        except Exception:
            pass
        return new_match

    def add_reaction(self, db: Session, user_id: int, message_id: int, emoji: str) -> Message:
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            raise ValueError("Message not found")
        
        # Verify user is part of the match
        match = db.query(Match).filter(Match.id == message.match_id).first()
        if not match or (match.user1_id != user_id and match.user2_id != user_id):
            raise ValueError("Unauthorized")

        # Check existing reaction
        existing = db.query(MessageReaction).filter(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == user_id,
            MessageReaction.reaction_emoji == emoji
        ).first()

        if existing:
            # Toggle off if same emoji
            db.delete(existing)
        else:
            # Create new reaction
            reaction = MessageReaction(
                message_id=message_id,
                user_id=user_id,
                reaction_emoji=emoji,
                message_created_at=message.created_at
            )
            db.add(reaction)
        
        db.commit()
        db.refresh(message)
        return message

    def mark_messages_read(self, db: Session, user_id: int, match_id: int) -> bool:
        match = db.query(Match).filter(Match.id == match_id).first()
        if not match:
            raise ValueError("Match not found")
        if match.user1_id != user_id and match.user2_id != user_id:
            raise ValueError("Unauthorized")

        # Find unread messages sent by the OTHER user
        # We need messages where sender_id != user_id AND no MessageRead exists for this user
        unread_messages = db.query(Message).outerjoin(
            MessageRead, 
            and_(
                MessageRead.message_id == Message.id,
                MessageRead.reader_id == user_id
            )
        ).filter(
            Message.match_id == match_id,
            Message.sender_id != user_id,
            MessageRead.id == None
        ).all()

        if not unread_messages:
            return False

        for msg in unread_messages:
            read_record = MessageRead(
                message_id=msg.id,
                reader_id=user_id,
                message_created_at=msg.created_at,
                read_at=datetime.utcnow()
            )
            db.add(read_record)
        
        db.commit()
        return True

messaging_service = MessagingService()
