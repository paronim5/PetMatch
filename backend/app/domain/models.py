from datetime import datetime
from typing import List, Optional
import os

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, ForeignKey,
    Text, DECIMAL, Enum as SQLEnum, CheckConstraint, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, INET
from sqlalchemy.orm import relationship

from geoalchemy2 import Geography
from geoalchemy2.shape import to_shape

from app.infrastructure.database import Base
from app.domain.enums import (
    GenderType, SwipeType, RelationshipGoalType, SmokingType, DrinkingType,
    UserStatusType, ReportStatusType, SubscriptionTierType, NotificationPriorityType,
    LocationPrivacyType, HeightUnitType, DealBreakerType
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    phone_number_hash = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_active = Column(DateTime)
    status = Column(SQLEnum(UserStatusType), default=UserStatusType.active)
    is_verified = Column(Boolean, default=False)
    subscription_tier = Column(SQLEnum(SubscriptionTierType), default=SubscriptionTierType.free)
    deleted_at = Column(DateTime)

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    photos = relationship("UserPhoto", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")
    subscription_details = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")

    swipes_made = relationship("Swipe", foreign_keys="[Swipe.swiper_id]", back_populates="swiper")
    swipes_received = relationship("Swipe", foreign_keys="[Swipe.swiped_id]", back_populates="swiped")

    matches_as_user1 = relationship("Match", foreign_keys="[Match.user1_id]", back_populates="user1")
    matches_as_user2 = relationship("Match", foreign_keys="[Match.user2_id]", back_populates="user2")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    surname = Column(String(100))
    date_of_birth = Column(Date, nullable=False)
    gender = Column(SQLEnum(GenderType))
    bio = Column(Text)
    location_city = Column(String(100))
    location_state = Column(String(100))
    location_country = Column(String(100))
    location = Column(Geography(geometry_type='POINT', srid=4326))
    location_privacy = Column(SQLEnum(LocationPrivacyType), default=LocationPrivacyType.approximate)
    height_value = Column(Integer)
    height_unit = Column(SQLEnum(HeightUnitType), default=HeightUnitType.cm)
    education = Column(String(100))
    occupation = Column(String(100))
    relationship_goal = Column(SQLEnum(RelationshipGoalType))
    smoking = Column(SQLEnum(SmokingType))
    drinking = Column(SQLEnum(DrinkingType))
    has_children = Column(Boolean)
    wants_children = Column(Boolean)
    locale = Column(String(10), default='en_US')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime)

    user = relationship("User", back_populates="profile")

    @property
    def latitude(self):
        if self.location is not None:
            try:
                point = to_shape(self.location)
                return point.y
            except Exception:
                return None
        return None

    @property
    def longitude(self):
        if self.location is not None:
            try:
                point = to_shape(self.location)
                return point.x
            except Exception:
                return None
        return None


class UserPhoto(Base):
    __tablename__ = "user_photos"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    photo_url = Column(String(500), nullable=False)
    is_primary = Column(Boolean, default=False)
    photo_order = Column(Integer, default=0)
    file_hash = Column(String(64), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime)

    user = relationship("User", back_populates="photos")

    @property
    def thumbnail_url(self):
        if self.photo_url:
            base, ext = os.path.splitext(self.photo_url)
            return f"{base}_thumb{ext}"
        return None


class Interest(Base):
    __tablename__ = "interests"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    category = Column(String(50))
    locale = Column(String(10), default='en_US')


class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = {'extend_existing': True}

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    interest_id = Column(Integer, ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True)
    added_at = Column(DateTime, default=datetime.utcnow)


class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    min_age = Column(Integer)
    max_age = Column(Integer)
    max_distance = Column(Integer)

    preferred_genders = Column(
        ARRAY(SQLEnum(GenderType, name="gender_type")),
        nullable=True
    )

    deal_breakers = Column(
        ARRAY(SQLEnum(DealBreakerType, name="deal_breaker_type")),
        nullable=True
    )

    notify_likes = Column(Boolean, default=True)
    notify_matches = Column(Boolean, default=True)
    notify_messages = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="preferences")


class TierLimits(Base):
    __tablename__ = "tier_limits"

    id = Column(Integer, primary_key=True)
    tier = Column(SQLEnum(SubscriptionTierType), unique=True, nullable=False)
    daily_swipe_limit = Column(Integer)
    daily_super_likes = Column(Integer)
    profile_views_visible = Column(Boolean, default=False)
    can_see_who_liked = Column(Boolean, default=False)
    ad_free = Column(Boolean, default=False)
    rewind_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    tier = Column(SQLEnum(SubscriptionTierType), nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    auto_renew = Column(Boolean, default=True)
    payment_method = Column(String(50))
    amount = Column(DECIMAL(12, 4))
    currency = Column(String(3), default='USD')
    external_payment_id = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscription_details")


class DailySwipeLimit(Base):
    __tablename__ = "daily_swipe_limits"
    __table_args__ = (
        UniqueConstraint('user_id', 'date', name='idx_daily_swipe_limits_user_date'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, default=datetime.utcnow)
    swipe_count = Column(Integer, default=0)
    super_like_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class Swipe(Base):
    __tablename__ = "swipes"

    id = Column(Integer, primary_key=True)
    swiper_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    swiped_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    swipe_type = Column(SQLEnum('like', 'pass', 'super_like', name='swipe_type'), nullable=False)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    swiper = relationship("User", foreign_keys=[swiper_id], back_populates="swipes_made")
    swiped = relationship("User", foreign_keys=[swiped_id], back_populates="swipes_received")


class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)
    user1_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user2_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    matched_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    unmatched_by = Column(Integer, ForeignKey("users.id"))
    unmatched_at = Column(DateTime)
    deleted_at = Column(DateTime)

    user1 = relationship("User", foreign_keys=[user1_id], back_populates="matches_as_user1")
    user2 = relationship("User", foreign_keys=[user2_id], back_populates="matches_as_user2")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    match_id = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_text = Column(Text)
    media_url = Column(String(500))
    reply_to_message_id = Column(Integer, ForeignKey("messages.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    deleted_at = Column(DateTime)

    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")
    reads = relationship("MessageRead", back_populates="message", cascade="all, delete-orphan")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index('idx_notifications_user_created', 'user_id', 'created_at'),
        Index('idx_notifications_user_unread', 'user_id', 'is_read'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(String(50), nullable=False)
    priority = Column(SQLEnum(NotificationPriorityType), default=NotificationPriorityType.medium)
    title = Column(String(200))
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    related_user_id = Column(Integer, ForeignKey("users.id"))
    related_match_id = Column(Integer, ForeignKey("matches.id"))
    related_message_id = Column(Integer, ForeignKey("messages.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    read_at = Column(DateTime)
    deleted_at = Column(DateTime)


class ProfileView(Base):
    __tablename__ = "profile_views"

    id = Column(Integer, primary_key=True)
    viewer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    viewed_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    viewed_at = Column(DateTime, default=datetime.utcnow)


class MessageReaction(Base):
    __tablename__ = "message_reactions"
    __table_args__ = (
        UniqueConstraint('message_id', 'user_id', 'reaction_emoji', name='idx_message_reactions_unique'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    message_created_at = Column(DateTime, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction_emoji = Column(String(10), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="reactions")


class MessageRead(Base):
    __tablename__ = "message_reads"
    __table_args__ = (
        UniqueConstraint('message_id', 'reader_id', name='idx_message_reads_unique'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    message_created_at = Column(DateTime, nullable=False)
    reader_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime, default=datetime.utcnow)

    message = relationship("Message", back_populates="reads")


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (
        UniqueConstraint('blocker_id', 'blocked_id', name='blocks_blocker_id_blocked_id_key'),
        CheckConstraint('blocker_id != blocked_id', name='no_self_block'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint('reporter_id != reported_id', name='no_self_report'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    reported_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=False)
    reason = Column(String(100), nullable=False)
    description = Column(Text)
    status = Column(SQLEnum(ReportStatusType), default=ReportStatusType.pending)
    resolver_id = Column(Integer, ForeignKey("users.id"))
    resolution_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)

    reporter = relationship("User", foreign_keys=[reporter_id])
    reported = relationship("User", foreign_keys=[reported_id])
    resolver = relationship("User", foreign_keys=[resolver_id])


class PushToken(Base):
    __tablename__ = "push_tokens"
    __table_args__ = (
        UniqueConstraint('user_id', 'device_token', name='idx_push_tokens_unique'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    device_token = Column(String(500), nullable=False)
    device_type = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TypingIndicator(Base):
    __tablename__ = "typing_indicators"
    __table_args__ = {'extend_existing': True}

    match_id = Column(Integer, ForeignKey("matches.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class IcebreakerPrompt(Base):
    __tablename__ = "icebreaker_prompts"

    id = Column(Integer, primary_key=True)
    prompt_text = Column(Text, nullable=False)
    category = Column(String(50))
    locale = Column(String(10), default='en_US')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserIcebreakerAnswer(Base):
    __tablename__ = "user_icebreaker_answers"
    __table_args__ = (
        UniqueConstraint('user_id', 'prompt_id', name='idx_user_icebreaker_answers_unique'),
        {'extend_existing': True}
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    prompt_id = Column(Integer, ForeignKey("icebreaker_prompts.id"), nullable=False)
    answer_text = Column(Text, nullable=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class PhoneVerification(Base):
    __tablename__ = "phone_verifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    phone_number_hash = Column(String(255), nullable=False)
    verification_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_verified = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False)
    ip_address = Column(INET)
    user_agent = Column(Text)
    details = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)