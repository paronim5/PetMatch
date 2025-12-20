# Stripe Payment Setup Guide

This guide explains how to set up Stripe payments for the PetMatch Dating App.

## Prerequisites

1.  A [Stripe](https://stripe.com/) account.
2.  Python environment with `stripe` package installed (`pip install stripe`).

## Step 1: Stripe Configuration

1.  **Get API Keys:**
    *   Go to your [Stripe Dashboard](https://dashboard.stripe.com/apikeys).
    *   Get the **Secret Key** (starts with `sk_test_...` or `sk_live_...`).
    *   Get the **Publishable Key** (starts with `pk_test_...` or `pk_live_...`).

2.  **Create Products & Prices:**
    *   Go to [Products](https://dashboard.stripe.com/products).
    *   Create a product named "Premium Subscription".
    *   Add a price (e.g., $9.99/month).
    *   Copy the **Price ID** (starts with `price_...`).
    *   Create another product for "Premium Plus" if needed, and get its Price ID.

3.  **Configure Webhook:**
    *   Go to [Webhooks](https://dashboard.stripe.com/webhooks).
    *   Add an endpoint: `http://localhost:8000/api/v1/subscription/webhook` (for local development, you need a proxy like `ngrok` or use the Stripe CLI to forward events).
    *   Select events to listen for:
        *   `checkout.session.completed`
        *   `customer.subscription.deleted` 
    *   Get the **Webhook Signing Secret** (starts with `whsec_...`).

## Step 2: Update Backend Configuration

1.  Open `.env` file in the `backend` directory.
2.  Add the following variables:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

3.  Open `backend/app/services/stripe_service.py`.
4.  Update the `TIER_PRICE_IDS` dictionary with your actual Price IDs:

```python
TIER_PRICE_IDS = {
    "premium": "price_12345...",
    "premium_plus": "price_67890..."
}
```

## Step 3: Run with Stripe CLI (Local Development)

To test webhooks locally, use the Stripe CLI:

1.  Login: `stripe login`
2.  Forward events:
    ```bash
    stripe listen --forward-to localhost:8000/api/v1/subscription/webhook
    ```
3.  Copy the webhook secret output by the CLI and use it in your `.env` as `STRIPE_WEBHOOK_SECRET`.

## Step 4: Verify

1.  Start the backend server.
2.  Start the frontend.
3.  Go to Profile -> Upgrade to Premium.
4.  You should be redirected to Stripe Checkout.
5.  After payment, you will be redirected back to the Profile page with a success message.
6.  The webhook will fire and update your subscription status in the database.

## Troubleshooting

*   **401 Unauthorized:** Ensure you are logged in. If the error persists, check your token expiration.
*   **Invalid Tier:** Ensure the Price IDs in `stripe_service.py` match your Stripe Dashboard.
*   **Webhook Error:** Check server logs. Ensure `STRIPE_WEBHOOK_SECRET` is correct.
