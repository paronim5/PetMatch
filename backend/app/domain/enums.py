from enum import Enum

class GenderType(str, Enum):
    male = 'male'
    female = 'female'
    non_binary = 'non_binary'
    other = 'other'
    prefer_not_to_say = 'prefer_not_to_say'

class SwipeType(str, Enum):
    like = 'like'
    pass_ = 'pass'  # pass is a reserved keyword
    super_like = 'super_like'

class RelationshipGoalType(str, Enum):
    relationship = 'relationship'
    casual = 'casual'
    friendship = 'friendship'
    undecided = 'undecided'

class SmokingType(str, Enum):
    never = 'never'
    occasionally = 'occasionally'
    regularly = 'regularly'
    prefer_not_to_say = 'prefer_not_to_say'

class DrinkingType(str, Enum):
    never = 'never'
    occasionally = 'occasionally'
    regularly = 'regularly'
    prefer_not_to_say = 'prefer_not_to_say'

class UserStatusType(str, Enum):
    active = 'active'
    suspended = 'suspended'
    banned = 'banned'
    deactivated = 'deactivated'

class ReportStatusType(str, Enum):
    pending = 'pending'
    under_review = 'under_review'
    resolved = 'resolved'
    dismissed = 'dismissed'

class SubscriptionTierType(str, Enum):
    free = 'free'
    premium = 'premium'
    premium_plus = 'premium_plus'

class NotificationPriorityType(str, Enum):
    high = 'high'
    medium = 'medium'
    low = 'low'

class LocationPrivacyType(str, Enum):
    exact = 'exact'
    approximate = 'approximate'
    hidden = 'hidden'

class HeightUnitType(str, Enum):
    cm = 'cm'
    feet_inches = 'feet_inches'

class DealBreakerType(str, Enum):
    smoking = 'smoking'
    drinking = 'drinking'
    has_children = 'has_children'
    wants_children = 'wants_children'
    different_religion = 'different_religion'
    long_distance = 'long_distance'
