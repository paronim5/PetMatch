from datetime import date
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.domain.models import User, DailySwipeLimit, TierLimits
from app.domain.enums import SubscriptionTierType

class SubscriptionService:
    def get_tier_limits(self, db: Session, tier: SubscriptionTierType) -> TierLimits:
        limits = db.query(TierLimits).filter(TierLimits.tier == tier).first()
        
        should_update = False
        if not limits:
            limits = TierLimits(tier=tier)
            should_update = True
            
        # Ensure limits are set correctly (Self-healing for NULL values)
        if limits.daily_swipe_limit is None:
            if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus]:
                limits.daily_swipe_limit = 1000000 # Effectively unlimited
            else:
                limits.daily_swipe_limit = 50 # Default for free
            should_update = True
            
        if limits.daily_super_likes is None:
            limits.daily_super_likes = 5 if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus] else 1
            should_update = True
            
        if limits.profile_views_visible is None:
            limits.profile_views_visible = True if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus] else False
            should_update = True
            
        if limits.can_see_who_liked is None:
            limits.can_see_who_liked = True if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus] else False
            should_update = True
            
        if limits.ad_free is None:
            limits.ad_free = True if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus] else False
            should_update = True
            
        if limits.rewind_enabled is None:
            limits.rewind_enabled = True if tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus] else False
            should_update = True

        if should_update:
            db.add(limits)
            db.commit()
            db.refresh(limits)
            
        return limits

    def get_user_daily_limit(self, db: Session, user_id: int) -> DailySwipeLimit:
        today = date.today()
        daily_limit = db.query(DailySwipeLimit).filter(
            DailySwipeLimit.user_id == user_id,
            DailySwipeLimit.date == today
        ).first()
        
        if not daily_limit:
            daily_limit = DailySwipeLimit(user_id=user_id, date=today, swipe_count=0, super_like_count=0)
            db.add(daily_limit)
            db.commit()
            db.refresh(daily_limit)
        
        return daily_limit

    def check_and_increment_swipe(self, db: Session, user: User) -> bool:
        # 1. Get User Tier Limits
        tier_limits = self.get_tier_limits(db, user.subscription_tier)
        
        # 2. Get Today's Usage
        daily_usage = self.get_user_daily_limit(db, user.id)
        
        # 3. Check Limits
        if daily_usage.swipe_count >= tier_limits.daily_swipe_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Daily swipe limit reached. Upgrade to Premium or watch an ad to continue."
            )
        
        # 4. Increment
        daily_usage.swipe_count += 1
        db.add(daily_usage)
        # We don't commit here to allow atomic transaction with the swipe creation
        # db.commit()
        return True

    def grant_ad_reward(self, db: Session, user: User) -> dict:
        daily_usage = self.get_user_daily_limit(db, user.id)
        
        # Decrease swipe count by 5, but not below 0
        # This effectively gives 5 more swipes
        new_count = max(0, daily_usage.swipe_count - 5)
        granted = daily_usage.swipe_count - new_count
        
        daily_usage.swipe_count = new_count
        db.add(daily_usage)
        db.commit()
        
        return {
            "message": "Reward granted",
            "swipes_restored": granted,
            "current_swipe_count": daily_usage.swipe_count
        }

    def get_subscription_status(self, db: Session, user: User) -> dict:
        tier_limits = self.get_tier_limits(db, user.subscription_tier)
        daily_usage = self.get_user_daily_limit(db, user.id)
        
        remaining_swipes = max(0, tier_limits.daily_swipe_limit - daily_usage.swipe_count)
        
        return {
            "tier": user.subscription_tier,
            "daily_swipe_limit": tier_limits.daily_swipe_limit,
            "swipes_used_today": daily_usage.swipe_count,
            "remaining_swipes": remaining_swipes,
            "is_premium": user.subscription_tier in [SubscriptionTierType.premium, SubscriptionTierType.premium_plus]
        }

subscription_service = SubscriptionService()
