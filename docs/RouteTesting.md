 ### Step 1: Initialize User

  Create a user in the in-memory database:
    curl -s -X POST http://localhost:3000/auth/user-init \
      -H "Content-Type: application/json" \
      -d '{"username": "testuser", "password": "password123"}'
    
  • Response:
    {"username":"testuser","password":"password123","permissions":["billing.manage"]}
    
  ──────
  ### Step 2: Login and Retrieve JWT
  Authenticate with the created credentials to receive the signed token:

    curl -s -X POST http://localhost:3000/auth/login \
      -H "Content-Type: application/json" \
      -d '{"username": "testuser", "password": "password123"}'
    
  • Response:
    {"token":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicGVybWlzc2lvbnMiOlsiYmlsbGluZy5tYW5hZ2UiXSwiaWF0IjoxNzg0MDY3Njk2LCJleHAiOjE3ODQwNzEyOTZ9.rCyVW66vJ0-JvVAXwM6EjSfgzSxvdwuEGLW-QVaPvE8"}

  ──────
  ### Step 3: Access Protected Route with JWT

  Query  GET /billing/subscription  using the returned Bearer token:

    curl -s -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicGVybWlzc2lvbnMiOlsiYmlsbGluZy5tYW5hZ2UiXSwiaWF0IjoxNzg0MDY3Njk2LCJleHAiOjE3ODQwNzEyOTZ9.rCyVW66vJ0-
  JvVAXwM6EjSfgzSxvdwuEGLW-QVaPvE8" \
      http://localhost:3000/billing/subscription

  • Response:
    {"subscription":{"id":"sub_123","status":"active"}}

  ──────
  ### Step 4: Perform Idempotent Request (First Call)

  Submit a  POST  request with the token and an  Idempotency-Key  header:

    curl -s -X POST \
      -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicGVybWlzc2lvbnMiOlsiYmlsbGluZy5tYW5hZ2UiXSwiaWF0IjoxNzg0MDY3Njk2LCJleHAiOjE3ODQwNzEyOTZ9.rCyVW66vJ0-JvVAXwM6EjSfgzSxvdwuEGLW-
  QVaPvE8" \
      -H "Idempotency-Key: test-key-1" \
      -H "Content-Type: application/json" \
      -d '{"priceId": "price_abc"}' \
      http://localhost:3000/billing/checkout-session

  • Response:
    {"url":"https://checkout.stripe.com/pay/abc"}

  ──────
  ### Step 5: Duplicate Idempotent Request

  Submit the same request with the exact same  Idempotency-Key  header:

    curl -s -X POST \
      -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6InRlc3R1c2VyIiwicGVybWlzc2lvbnMiOlsiYmlsbGluZy5tYW5hZ2UiXSwiaWF0IjoxNzg0MDY3Njk2LCJleHAiOjE3ODQwNzEyOTZ9.rCyVW66vJ0-JvVAXwM6EjSfgzSxvdwuEGLW-
  QVaPvE8" \
      -H "Idempotency-Key: test-key-1" \
      -H "Content-Type: application/json" \
      -d '{"priceId": "price_abc"}' \
      http://localhost:3000/billing/checkout-session

  • Response:
    {"status":"already_processed"}
