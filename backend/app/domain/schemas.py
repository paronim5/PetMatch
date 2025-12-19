from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, validator, ConfigDict
from pydantic import model_validator
from app.domain.enums import (
    GenderType, UserStatusType, RelationshipGoalType, SmokingType, DrinkingType,
    HeightUnitType, LocationPrivacyType, DealBreakerType, SwipeType, ReportStatusType
)

class UserBase(BaseModel):
    email: EmailStr
    username: Optional[str] = None

class UserCreate(UserBase):
    password: str
    phone_number: str

class UserUpdate(BaseModel):
    password: Optional[str] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None

class UserInDBBase(UserBase):
    id: int
    created_at: datetime
    updated_at: datetime
    status: UserStatusType
    is_verified: bool

    model_config = ConfigDict(from_attributes=True)

class User(UserInDBBase):
    profile: Optional['UserProfile'] = None
    photos: Optional[List['UserPhoto']] = None
    liked_you: Optional[bool] = False

class UserInDB(UserInDBBase):
    password_hash: str

class UserPublic(BaseModel):
    id: int
    username: Optional[str] = None
    profile: Optional['UserProfile'] = None
    photos: Optional[List['UserPhoto']] = None
    liked_you: Optional[bool] = False
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Interest Schemas
class InterestBase(BaseModel):
    name: str
    category: Optional[str] = None

class InterestCreate(InterestBase):
    pass

class Interest(InterestBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

# Profile Schemas
class UserProfileBase(BaseModel):
    first_name: str
    surname: Optional[str] = None
    date_of_birth: date
    gender: Optional[GenderType] = None
    bio: Optional[str] = None
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Extended fields
    height_value: Optional[int] = None
    height_unit: Optional[HeightUnitType] = HeightUnitType.cm
    education: Optional[str] = None
    occupation: Optional[str] = None
    relationship_goal: Optional[RelationshipGoalType] = None
    smoking: Optional[SmokingType] = None
    drinking: Optional[DrinkingType] = None
    has_children: Optional[bool] = None
    wants_children: Optional[bool] = None
    locale: Optional[str] = "en_US"
    location_privacy: Optional[LocationPrivacyType] = LocationPrivacyType.approximate

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    first_name: Optional[str] = None
    date_of_birth: Optional[date] = None

class UserProfile(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Photo Schemas
class UserPhotoBase(BaseModel):
    photo_url: str
    is_primary: Optional[bool] = False
    photo_order: Optional[int] = 0

class UserPhotoCreate(UserPhotoBase):
    pass

class UserPhoto(UserPhotoBase):
    id: int
    user_id: int
    uploaded_at: datetime

    model_config = ConfigDict(from_attributes=True)

# User Preferences Schemas
class UserPreferencesBase(BaseModel):
    min_age: Optional[int] = Field(None, ge=18)
    max_age: Optional[int] = Field(None, le=100)
    max_distance: Optional[int] = Field(None, gt=0)
    preferred_genders: Optional[List[GenderType]] = None
    deal_breakers: Optional[List[DealBreakerType]] = None

    @model_validator(mode='after')
    def check_age_range(self) -> 'UserPreferencesBase':
        if self.min_age is not None and self.max_age is not None:
            if self.min_age > self.max_age:
                raise ValueError("min_age cannot be greater than max_age")
        return self

class UserPreferencesCreate(UserPreferencesBase):
    pass

class UserPreferencesUpdate(UserPreferencesBase):
    pass

class UserPreferences(UserPreferencesBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Message Schemas
class MessageBase(BaseModel):
    message_text: Optional[str] = None
    media_url: Optional[str] = None

class MessageCreate(MessageBase):
    recipient_id: Optional[int] = None
    match_id: Optional[int] = None

class Message(MessageBase):
    id: int
    match_id: int
    sender_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Notification Schemas
class NotificationBase(BaseModel):
    notification_type: str
    title: Optional[str] = None
    message: Optional[str] = None
    is_read: bool = False
    related_user_id: Optional[int] = None
    related_match_id: Optional[int] = None
    related_message_id: Optional[int] = None

class Notification(NotificationBase):
    id: int
    user_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Match Schemas
class MatchBase(BaseModel):
    pass

class Match(MatchBase):
    id: int
    user1_id: int
    user2_id: int
    matched_at: datetime
    is_active: bool

    model_config = ConfigDict(from_attributes=True)

class MatchWithUsers(Match):
    user1: Optional[UserPublic] = None
    user2: Optional[UserPublic] = None

# Swipe Schemas
class SwipeBase(BaseModel):
    swiped_id: int
    swipe_type: SwipeType

class SwipeCreate(SwipeBase):
    pass

class Swipe(SwipeBase):
    id: int
    swiper_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SwipeWithUser(BaseModel):
    id: int
    swiper: UserPublic
    swipe_type: SwipeType
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Block Schemas
class BlockBase(BaseModel):
    blocked_id: int
    reason: Optional[str] = None

class BlockCreate(BlockBase):
    pass

class Block(BlockBase):
    id: int
    blocker_id: int
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class BlockWithUser(Block):
    blocked: Optional[UserPublic] = None

# Report Schemas
class ReportBase(BaseModel):
    reported_id: int
    reason: str = Field(..., max_length=100)
    description: Optional[str] = None

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: int
    reporter_id: int
    status: ReportStatusType
    created_at: datetime
    resolved_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class ReportWithUser(Report):
    reported: Optional[UserPublic] = None

# Update forward references
User.model_rebuild()
