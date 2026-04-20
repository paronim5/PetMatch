from typing import List, Protocol
from datetime import date
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, not_, desc, or_, text
from sqlalchemy.exc import ArgumentError
from geoalchemy2.functions import ST_DWithin
from app.domain.models import User, UserProfile, Swipe, UserPreferences, UserInterest, Block
from app.domain.enums import SwipeType, DealBreakerType, SmokingType, DrinkingType
import logging

logger = logging.getLogger(__name__)

class MatchingStrategy(Protocol):
    def find_matches(self, db: Session, user: User, limit: int = 10) -> List[User]:
        ...

class LocationBasedMatching(MatchingStrategy):
    def find_matches(self, db: Session, user: User, limit: int = 10) -> List[User]:
        try:
            logger.info(f"Finding matches for user {user.id}")
            if not user.profile:
                logger.warning(f"User {user.id} has no profile")
                return []

            user_has_location = user.profile.location is not None
            if not user_has_location:
                logger.info(f"User {user.id} has no location — skipping distance filter")

            # Get user preferences or defaults
            max_distance_km = 50
            if user.preferences and user.preferences.max_distance:
                max_distance_km = user.preferences.max_distance

            logger.info(f"User {user.id} preferences: max_dist={max_distance_km}, min_age={user.preferences.min_age if user.preferences else 'N/A'}")

            # Convert km to meters
            max_distance_meters = max_distance_km * 1000
            
            # Only exclude users that were liked/super_liked — passes are not permanent
            swiped_ids_query = db.query(Swipe.swiped_id).filter(
                Swipe.swiper_id == user.id,
                Swipe.swipe_type.in_([SwipeType.like, SwipeType.super_like])
            )
            
            # Get IDs of users blocked by this user or who blocked this user
            blocked_ids_query = db.query(Block.blocked_id).filter(Block.blocker_id == user.id)
            blocker_ids_query = db.query(Block.blocker_id).filter(Block.blocked_id == user.id)
            
            # 1. Find users who have Liked or Super Liked the current user (Prioritized)
            # We only want those who the current user hasn't swiped on yet
            # Order them by most recent like/super_like timestamp (descending)
            liker_subquery = db.query(
                Swipe.swiper_id
            ).filter(
                Swipe.swiped_id == user.id,
                Swipe.swipe_type.in_([SwipeType.like, SwipeType.super_like]),
                Swipe.swiper_id.notin_(swiped_ids_query),
                Swipe.swiper_id.notin_(blocked_ids_query),
                Swipe.swiper_id.notin_(blocker_ids_query),
            ).subquery()

            base_likers_query = (
                db.query(User)
                .options(
                    joinedload(User.photos),
                    joinedload(User.profile),
                )
                .join(UserProfile)
                .join(liker_subquery, User.id == liker_subquery.c.swiper_id)
            )

            likers = base_likers_query.limit(limit).all()
            
            logger.info(f"Found {len(likers)} likers for user {user.id}")

            # Mark as liked_you
            for liker in likers:
                liker.liked_you = True

            # 2. Find standard matches (excluding those who already liked - to avoid duplicates in list)
            # Prepare interests subquery for shared interests
            self_interest_ids = db.query(UserInterest.interest_id).filter(UserInterest.user_id == user.id).subquery()
            
            # Base query for potential matches
            # Use func.min() wrapper so ST_Distance is a valid aggregate with GROUP BY users.id
            distance_expr = func.min(func.ST_Distance(UserProfile.location, user.profile.location)) if user_has_location else None
            shared_count_expr = func.count(UserInterest.interest_id)
            
            remaining_limit = limit - len(likers)
            standard_matches = []

            if remaining_limit > 0:
                # Create a simple list of liker IDs to exclude
                liker_ids_query = db.query(Swipe.swiper_id).filter(
                    Swipe.swiped_id == user.id,
                    Swipe.swipe_type.in_([SwipeType.like, SwipeType.super_like])
                )

                query = db.query(
                        User
                    ).options(
                        joinedload(User.photos),
                        joinedload(User.profile)
                    ).join(UserProfile
                    ).outerjoin(UserInterest, and_(UserInterest.user_id == User.id, UserInterest.interest_id.in_(self_interest_ids))
                    ).filter(
                    User.id != user.id,
                    User.id.notin_(swiped_ids_query),
                    User.id.notin_(liker_ids_query),            # Exclude likers using standard query
                    User.id.notin_(blocked_ids_query),          # Exclude users I blocked
                    User.id.notin_(blocker_ids_query),          # Exclude users who blocked me
                ).group_by(User.id)

                # Only apply distance filter when the current user has a location set
                if user_has_location:
                    query = query.filter(
                        or_(
                            UserProfile.location == None,
                            ST_DWithin(
                                UserProfile.location,
                                user.profile.location,
                                max_distance_meters
                            )
                        )
                    )

                # Filter by gender if specified
                if user.preferences and user.preferences.preferred_genders:
                    query = query.filter(UserProfile.gender.in_(user.preferences.preferred_genders))
                    
                # Filter by age if specified
                if user.preferences:
                    today = date.today()
                    
                    if user.preferences.min_age:
                        # To be at least X years old, birth date must be <= today - X years
                        try:
                            min_birth_date = today.replace(year=today.year - user.preferences.min_age)
                        except ValueError:
                            # Handle Feb 29 for leap years
                            min_birth_date = today.replace(year=today.year - user.preferences.min_age, month=2, day=28)
                        
                        query = query.filter(UserProfile.date_of_birth <= min_birth_date)

                    if user.preferences.max_age:
                        # To be at most Y years old, birth date must be > today - (Y + 1) years
                        try:
                            max_birth_date = today.replace(year=today.year - (user.preferences.max_age + 1))
                        except ValueError:
                            max_birth_date = today.replace(year=today.year - (user.preferences.max_age + 1), month=2, day=28)
                            
                        query = query.filter(UserProfile.date_of_birth > max_birth_date)

                # Filter by deal breakers if specified
                if user.preferences and user.preferences.deal_breakers:
                    for deal_breaker in user.preferences.deal_breakers:
                        if deal_breaker == DealBreakerType.smoking:
                            query = query.filter(UserProfile.smoking == SmokingType.never)
                        elif deal_breaker == DealBreakerType.drinking:
                            query = query.filter(UserProfile.drinking == DrinkingType.never)
                        elif deal_breaker == DealBreakerType.has_children:
                            query = query.filter(UserProfile.has_children == False)
                        elif deal_breaker == DealBreakerType.wants_children:
                            query = query.filter(UserProfile.wants_children == False)
                        # Note: different_religion and long_distance would require more complex logic
                        # likely involving user's own religion/location, which is partially covered by distance filter

                # Order by compatibility: more shared interests, then closer distance if available
                if distance_expr is not None:
                    query = query.order_by(desc(shared_count_expr), distance_expr)
                else:
                    query = query.order_by(desc(shared_count_expr))

                logger.info(f"Executing standard matches query for user {user.id}")
                standard_matches = query.limit(remaining_limit).all()
                logger.info(f"Found {len(standard_matches)} standard matches")

            return likers + standard_matches
            
        except Exception as e:
            logger.error(f"Error in find_matches for user {user.id}: {e}", exc_info=True)
            raise e

class InterestBasedMatching(MatchingStrategy):
    def find_matches(self, db: Session, user: User, limit: int = 10) -> List[User]:
        # Placeholder for interest-based matching logic
        # Ideally would join UserInterests and rank by shared interests
        return []

class HybridMatching(MatchingStrategy):
    def __init__(self):
        self.location_strategy = LocationBasedMatching()
        self.interest_strategy = InterestBasedMatching()

    def find_matches(self, db: Session, user: User, limit: int = 10) -> List[User]:
        # For now, just return location-based results
        return self.location_strategy.find_matches(db, user, limit)

class MatchingService:
    def __init__(self, strategy: MatchingStrategy):
        self.strategy = strategy

    def set_strategy(self, strategy: MatchingStrategy):
        self.strategy = strategy

    def get_matches(self, db: Session, user: User, limit: int = 10) -> List[User]:
        return self.strategy.find_matches(db, user, limit)

# Default to Location Based
matching_service = MatchingService(LocationBasedMatching())
