
### 1. README.md

# Billing API Service

This repository provides a robust Node.js/Express implementation for B2B SaaS billing flows, focusing on production-grade security, request integrity, and financial idempotency.

## Quick Start
1. **Install dependencies:**
   npm install

## Start the server:

`npm run start`

## Security Architecture
This API is designed to sit behind a proxy (e.g., Cloudflare).

Public Route Protection: Onboarding endpoints are secured via enforcePublicSafety (Rate Limiting).

RBAC: Secured endpoints utilize authRequired and requirePermissions middleware.

Financial Integrity: All payment-related POST requests mandate an Idempotency-Key header.

## Idempotency Implementation
This service uses a "Guard-and-Commit" pattern via a lightweight in-memory store.

Lifecycle: PROCESSING (Lock) → FINISHED (Commit).

Behavior: * If a request is PROCESSING, the API returns a 409 Conflict.

If a request is FINISHED, the API returns the cached transaction state.

## Development & Testing
Tests are colocated with the source code.

Running the suite: `npm test`
There is a script to validate everything from the outside (e2e testing) `npm run route-test`

Test Harness: Uses jest and supertest for isolated integration testing.