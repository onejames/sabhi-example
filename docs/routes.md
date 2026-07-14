# Sabhi & PayBuddy API Routes Reference

This document provides a comprehensive list of all API endpoints implemented in the system, including request formats, middleware chains, validation schemas, and descriptions.

---

## Authentication & Onboarding Setup (`/auth`)
These endpoints provide testing setup to generate credentials, sign stateless JSON Web Tokens (JWT), and simulate authentication workflows.

### 1. Initialize Test User
* **Method & Path:** `POST /auth/user-init`
* **Auth / Permissions:** None (Public)
* **Description:** Registers a mock user in-memory. If no credentials are provided, it auto-generates a secure username and password.
* **Request Body:**
  ```json
  {
    "username": "customUser", // Optional
    "password": "customPassword" // Optional
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "username": "customUser",
    "password": "customPassword",
    "permissions": ["billing.manage"]
  }
  ```

### 2. Login & JWT Generation
* **Method & Path:** `POST /auth/login`
* **Auth / Permissions:** None (Public)
* **Description:** Authenticates credentials against the in-memory store and issues a stateless, signed JSON Web Token (JWT) valid for 1 hour.
* **Request Body:**
  ```json
  {
    "username": "customUser",
    "password": "customPassword"
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "token": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```

### 3. Logout & Token Blacklist
* **Method & Path:** `POST /auth/logout`
* **Auth / Permissions:** Requires a valid `Authorization` Bearer token.
* **Description:** Blacklists the provided Bearer token in memory. Any subsequent API calls made with this token will return `401 Unauthorized`.
* **Success Response (200 OK):**
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

## Billing & Embedded Payments (`/billing`)
These routes handle payment requests, checkout session generation, and subscription statuses, backed by the YourPayBuddy payments engine.

All endpoints below require a valid **Bearer JWT** in the `Authorization` header and the `billing.manage` role permission, unless stated otherwise.

### 1. List Subscription Plans
* **Method & Path:** `GET /billing/plans`
* **Auth / Permissions:** None (Public)
* **Description:** Retrieves the list of subscription packages customized for auto recyclers (Starter, Growth, and Pro tiers).
* **Success Response (200 OK):**
  ```json
  [
    {
      "id": "starter",
      "name": "Sabhi Starter",
      "description": "Essential payment tools for small auto recyclers.",
      "priceCents": 4900,
      "currency": "USD",
      "interval": "month"
    },
    ...
  ]
  ```

### 2. Get Subscription Details
* **Method & Path:** `GET /billing/subscription`
* **Auth / Permissions:** Requires JWT Auth + `billing.manage` permission.
* **Description:** Fetches current subscription periods, statuses, payment methods, and *Sabhi Score* AI fraud detection flag configurations.
* **Success Response (200 OK):**
  ```json
  {
    "subscription": {
      "id": "sub_4df8b3a0c201",
      "userId": "testuser",
      "planId": "growth",
      "status": "active",
      "currentPeriodStart": "2026-07-14T22:00:00.000Z",
      "currentPeriodEnd": "2026-08-14T22:00:00.000Z",
      "cancelAtPeriodEnd": false,
      "paymentMethod": { "brand": "visa", "last4": "4242" },
      "sabhiScoreEnabled": false
    }
  }
  ```

### 3. List Payment History
* **Method & Path:** `GET /billing`
* **Auth / Permissions:** Requires JWT Auth + `billing.manage` permission.
* **Description:** Returns transaction history for Hollander/CCC Pinnacle part sales, shipping payments, or internal payouts.
* **Success Response (200 OK):**
  ```json
  {
    "payments": [
      {
        "id": "pay_5a7c29be7a",
        "amountCents": 45000,
        "currency": "USD",
        "status": "succeeded",
        "provider": "stripe",
        "paymentMethod": "card",
        "createdAt": "2026-07-14T22:00:00.000Z",
        "metadata": { "item": "CCC Pinnacle Transmission" }
      }
    ]
  }
  ```

### 4. Create Payment Request
* **Method & Path:** `POST /billing/request`
* **Auth / Permissions:** Requires JWT Auth + `billing.manage` permission.
* **Description:** Creates an outbound invoice payment request powered by PayBuddy.
* **Request Body (Zod Validated):**
  ```json
  {
    "contactId": "b02d8f99-281b-432d-94c6-2c93845b41e9", // Optional UUID
    "invoiceId": "d50a256d-e9ef-4bf2-be79-cc756209e99c", // Optional UUID
    "amountCents": 1000, // Required positive integer
    "currency": "USD", // Optional (USD, EUR, GBP, JPY, etc. Default: USD)
    "provider": "stripe", // Optional (stripe, manual. Default: stripe)
    "metadata": { "item": "Hollander parts order" } // Optional
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "req_8b3a0c201d4a",
    "contactId": "b02d8f99-281b-432d-94c6-2c93845b41e9",
    "invoiceId": "d50a256d-e9ef-4bf2-be79-cc756209e99c",
    "amountCents": 1000,
    "currency": "USD",
    "provider": "stripe",
    "status": "request_created",
    "url": "https://yourpaybuddy.com/pay/req_8b3a0c201d4a",
    "createdAt": "2026-07-14T22:00:00.000Z",
    "metadata": { "item": "Hollander parts order" }
  }
  ```

### 5. Create Subscription Checkout Session
* **Method & Path:** `POST /billing/checkout-session`
* **Auth / Permissions:** Requires JWT Auth + `Idempotency-Key` header.
* **Description:** Builds a Stripe checkout URL to set up recurring billing cycles. Subsequent duplicate calls using the same `Idempotency-Key` header bypass creation and return `already_processed` or cached data.
* **Headers:**
  * `Idempotency-Key: <unique-uuid-or-string>` (Required)
* **Request Body (Zod Validated):**
  ```json
  {
    "priceId": "price_growth", // Required min length 1
    "successPath": "/success", // Optional
    "cancelPath": "/cancel" // Optional
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "cs_29be7a840e4fbc0214",
    "priceId": "price_growth",
    "email": null,
    "url": "https://checkout.stripe.com/pay/cs_29be7a840e4fbc0214",
    "successPath": "/success",
    "cancelPath": "/cancel",
    "createdAt": "2026-07-14T22:00:00.000Z"
  }
  ```

### 6. Create Onboarding Checkout Session
* **Method & Path:** `POST /billing/onboarding/checkout-session`
* **Auth / Permissions:** `Idempotency-Key` header (Public endpoint used during initial setup/sign-up).
* **Rate Limiting:** Restricted to **5 requests per 15 minutes** per client fingerprint.
* **Description:** Generates a checkout link for new auto recyclers setting up their PayBuddy integrations.
* **Headers:**
  * `Idempotency-Key: <unique-uuid-or-string>` (Required)
* **Request Body (Zod Validated):**
  ```json
  {
    "priceId": "price_pro", // Required min length 1
    "email": "onboarding@recycler.com", // Required email format
    "planKey": "pro", // Optional (starter, growth, pro)
    "successPath": "/success", // Optional
    "cancelPath": "/cancel" // Optional
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "cs_64a9ef1c9b83a0c201",
    "priceId": "price_pro",
    "email": "onboarding@recycler.com",
    "url": "https://checkout.stripe.com/onboarding/cs_64a9ef1c9b83a0c201",
    "successPath": "/success",
    "cancelPath": "/cancel",
    "createdAt": "2026-07-14T22:00:00.000Z"
  }
  ```

### 7. Verify Onboarding Checkout
* **Method & Path:** `POST /billing/onboarding/verify-checkout`
* **Auth / Permissions:** `Idempotency-Key` header (Public endpoint).
* **Rate Limiting:** Restricted to **10 requests per 15 minutes** per client fingerprint.
* **Description:** Verifies the outcome status of the onboarding checkout flow.
* **Headers:**
  * `Idempotency-Key: <unique-uuid-or-string>` (Required)
* **Request Body (Zod Validated):**
  ```json
  {
    "sessionId": "cs_64a9ef1c9b83a0c201", // Required min length 1
    "email": "onboarding@recycler.com" // Optional email format
  }
  ```
* **Success Response (200 OK):**
  ```json
  {
    "verified": true,
    "sessionId": "cs_64a9ef1c9b83a0c201",
    "plan": "growth",
    "verifiedAt": "2026-07-14T22:00:00.000Z"
  }
  ```
