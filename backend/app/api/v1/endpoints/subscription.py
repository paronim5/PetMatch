import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api import deps

logger = logging.getLogger(__name__)
from app.domain.models import User
from app.services.subscription_service import subscription_service
from app.services.stripe_service import stripe_service

router = APIRouter()

class CheckoutSessionRequest(BaseModel):
    tier: str

@router.get("/", response_model=dict)
def get_subscription_status(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Get current user's subscription status and remaining swipes.
    """
    return subscription_service.get_subscription_status(db, current_user)

@router.post("/ads/watch", response_model=dict)
def watch_ad_reward(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Grant extra swipes for watching an ad.
    """
    return subscription_service.grant_ad_reward(db, current_user)

@router.post("/upgrade", response_model=dict)
def upgrade_subscription(
    tier: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Upgrade subscription tier (Legacy/Mock implementation).
    """
    # Validate tier
    if tier not in ["free", "premium", "premium_plus"]:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    # In a real app, we would process payment here
    current_user.subscription_tier = tier
    db.add(current_user)
    db.commit()
    
    return {"message": f"Successfully upgraded to {tier}"}

@router.post("/create-checkout-session", response_model=dict)
def create_checkout_session(
    request: CheckoutSessionRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Create a Stripe Checkout Session.
    """
    try:
        url = stripe_service.create_checkout_session(current_user, request.tier)
        return {"checkout_url": url}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Stripe checkout error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    db: Session = Depends(deps.get_db)
):
    """
    Stripe Webhook Handler.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        stripe_service.handle_webhook(db, payload, sig_header)
    except ValueError as e:
         raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
         raise HTTPException(status_code=400, detail=str(e))
         
    return {"status": "success"}

@router.get("/verify-session")
def verify_session(
    session_id: str,
    db: Session = Depends(deps.get_db),
    current_user: Any = Depends(deps.get_current_active_user)
):
    """
    Manually verify a Stripe Checkout Session.
    """
    import stripe
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        if session.payment_status == 'paid':
            stripe_service.handle_checkout_session_completed(db, session)
            return {"status": "success", "tier": session.metadata.get("tier")}
        return {"status": "pending"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
