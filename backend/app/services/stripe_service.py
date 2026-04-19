import stripe
import logging
import json
from typing import Optional, Dict
from sqlalchemy.orm import Session
from app.core.config import settings
from app.domain.models import User, Subscription, SubscriptionTierType
from app.domain.enums import SubscriptionTierType
from datetime import datetime, timedelta
#todo suka nado https protokol naxui a dila etogo nado domain name suka a s secret key vse ok a snizu netx
logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_SECRET_KEY

def _get_tier_price_ids():
    premium = settings.STRIPE_PRICE_ID_PREMIUM or "price_1TMkPK1guJQMZVvr4hHYmDnr"
    premium_plus = settings.STRIPE_PRICE_ID_PREMIUM_PLUS or "price_1SgQE51guJQMZVvrBOoeDfJ6"
    return {"premium": premium, "premium_plus": premium_plus}

class StripeService:
    def create_checkout_session(self, user: User, tier: str) -> str:
        """
        Creates a Stripe Checkout Session for subscription upgrade.
        """
        tier_price_ids = _get_tier_price_ids()
        if tier not in tier_price_ids:
            raise ValueError(f"Invalid subscription tier: {tier}")

        price_id = tier_price_ids[tier]
        
        if not stripe.api_key:
             # For development without stripe keys, return a dummy URL or error
             logger.warning("Stripe API key not set. Returning dummy URL.")
             # return f"{settings.STRIPE_SUCCESS_URL}&mock_tier={tier}"
             raise ValueError("Stripe API key is not configured.")

        try:
            checkout_session = stripe.checkout.Session.create(
                customer_email=user.email,
                client_reference_id=str(user.id),
                payment_method_types=['card'],
                line_items=[
                    {
                        'price': price_id,
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                success_url=settings.STRIPE_SUCCESS_URL,
                cancel_url=settings.STRIPE_CANCEL_URL,
                metadata={
                    "tier": tier,
                    "user_id": str(user.id)
                }
            )
            return checkout_session.url
        except Exception as e:
            logger.error(f"Stripe Checkout Error: {str(e)}")
            raise e

    def handle_webhook(self, db: Session, payload: bytes, sig_header: str):
        """
        Handles Stripe webhooks to update user subscription status.
        """
        event = None
        
        if not settings.STRIPE_WEBHOOK_SECRET:
             logger.warning("Stripe Webhook Secret not set. Skipping verification (unsafe in production).")
             # Skip verification in dev if secret is missing
             try:
                event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
             except Exception as e:
                logger.error(f"Invalid payload: {e}")
                raise e
        else:
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
                )
            except ValueError as e:
                # Invalid payload
                logger.error(f"Invalid payload: {e}")
                raise e
            except stripe.error.SignatureVerificationError as e:
                # Invalid signature
                logger.error(f"Invalid signature: {e}")
                raise e

        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            self.handle_checkout_session_completed(db, session)
        elif event['type'] == 'invoice.payment_succeeded':
            # Handle recurring payment success if needed
            # For now we assume subscription is active until cancelled or payment fails
            pass
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            self._handle_subscription_deleted(db, subscription)
            
    def handle_checkout_session_completed(self, db: Session, session):
        user_id = session.get('client_reference_id')
        tier = session.get('metadata', {}).get('tier')
        subscription_id = session.get('subscription')
        
        if user_id and tier:
            logger.info(f"Processing subscription for user {user_id} tier {tier}")
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                # Update user tier
                if tier == 'premium':
                    user.subscription_tier = SubscriptionTierType.premium
                elif tier == 'premium_plus':
                    user.subscription_tier = SubscriptionTierType.premium_plus
                
                # Update or create Subscription record
                # Check if exists
                sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
                if not sub:
                    sub = Subscription(user_id=user.id)
                    db.add(sub)
                
                sub.tier = user.subscription_tier
                sub.external_payment_id = subscription_id
                sub.payment_method = 'stripe'
                sub.is_active = True
                sub.start_date = datetime.utcnow()
                # end_date depends on billing cycle, usually 1 month
                # Stripe subscription object has current_period_end
                
                db.commit()
                logger.info(f"User {user_id} upgraded to {tier}")

    def _handle_subscription_deleted(self, db: Session, subscription):
        # Find user by subscription ID or customer ID
        # Since we stored external_payment_id as subscription_id
        sub_id = subscription.get('id')
        sub = db.query(Subscription).filter(Subscription.external_payment_id == sub_id).first()
        if sub:
            sub.is_active = False
            sub.end_date = datetime.utcnow()
            
            # Downgrade user to free
            user = db.query(User).filter(User.id == sub.user_id).first()
            if user:
                user.subscription_tier = SubscriptionTierType.free
            
            db.commit()
            logger.info(f"Subscription {sub_id} cancelled, user downgraded to free")

stripe_service = StripeService()
