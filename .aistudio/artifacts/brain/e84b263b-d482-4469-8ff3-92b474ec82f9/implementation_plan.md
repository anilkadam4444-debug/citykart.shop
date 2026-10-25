# Implementation Plan — Razorpay Seller Subscriptions

Integrate Razorpay Standard Checkout into Citykart.shop to enable sellers to pay for subscription plans (`FREE`, `GROWTH`, `BUSINESS_PRO`).

## User Review & Critical Decisions

> [!IMPORTANT]
> - **Integration Mode**: We are using **Razorpay Orders** (Standard Checkout). Sellers will pay for a specific duration (Monthly/Annual).
> - **Currency**: Payments will be processed in **INR** with **18% GST** automatically applied for Indian merchants.
> - **Secrets**: Keys will be managed via environment variables. You must set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in your deployment environment.

- **Confirmed Decision 1**: Standard Checkout (Non-recurring period payments) chosen over recurring subscriptions.
- **Confirmed Decision 2**: Webhook handler will be implemented to ensure subscription activation even if the browser session is interrupted.

## 1. Overview & Core Concept

Authenticated sellers can select a subscription tier from the Merchant Studio. The system creates a Razorpay Order server-side, opens the Razorpay Checkout modal in the browser, and verifies the payment signature server-side before updating the seller's entitlements in Firestore.

## 2. User Experience & Visual Design

### Key User Flows
1. **Plan Selection**: Seller navigates to "Plans & Billing" in Merchant Studio.
2. **Checkout Initiation**: Seller clicks "Switch to [Plan]" or "Upgrade".
3. **Payment Modal**: Razorpay Checkout modal appears over the UI.
4. **Processing**: After payment, the modal closes, and a "Verifying..." state appears.
5. **Success**: Subscription is activated, and a success toast/banner appears.

### Interactive Feedback
- **Loading States**: Buttons will show "Activating..." while communicating with Razorpay.
- **Error Handling**: Clear messages if payment is cancelled or verification fails.

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Period-Based Payments (Orders API)**
    - *Chosen Approach*: Use Razorpay Orders API.
    - *Why*: Simpler for users who don't want recurring mandates. Allows for clean "Annual" vs "Monthly" switches without complex mandate migrations.
- **Decision 2: Server-Side Verification**
    - *Chosen Approach*: All payments verified via Razorpay HMAC signature on the backend.
    - *Why*: Prevents "Client-Side Trust" vulnerabilities where a user could spoof a success message.

## 4. Technical Architecture & Data Strategy

```text
┌────────────────┐      ┌──────────────────┐      ┌────────────────┐
│ Seller Browser │─────▶│ Next.js API      │─────▶│ Razorpay API   │
│ (Checkout UI)  │◀─────│ (Order Creator)  │◀─────│ (Order Record) │
└───────┬────────┘      └────────┬─────────┘      └────────────────┘
        │                        │
        │ Payment Success        │
        ▼                        ▼
┌────────────────┐      ┌──────────────────┐      ┌────────────────┐
│ Seller Browser │─────▶│ Next.js API      │─────▶│ Firestore DB   │
│ (Sig + IDs)    │      │ (Verifier)       │      │ (Update Sub)   │
└────────────────┘      └────────┬─────────┘      └────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Webhook Handler  │
                        │ (Async Backup)   │
                        └──────────────────┘
```

### Data Model & State Updates
- **`MerchantSubscription`**: `status` updated to `ACTIVE`. `currentPeriodEnd` extended based on cycle.
- **`BillingTransaction`**: New record created with `status: SUCCESS` and `gatewayTransactionId`.

### Key Sequences
1. `POST /api/billing/create-checkout`: Calls Razorpay `orders.create`.
2. Frontend: Calls `window.Razorpay(options).open()`.
3. `POST /api/billing/verify-payment`: Validates `razorpay_signature`.
4. `POST /api/billing/webhook`: Validates webhook signature and updates Firestore if not already processed.
