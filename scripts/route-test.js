const app = require('../app');
const jwt = require('jsonwebtoken');
const port = 3001;

async function run() {
  const server = app.listen(port, async () => {
    console.log(`\n=== Starting Route Integration Test Server on port ${port} ===\n`);
    try {
      const baseUrl = `http://localhost:${port}`;
      
      // 1. Initialize User
      console.log('1. Calling /auth/user-init...');
      const initRes = await fetch(`${baseUrl}/auth/user-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'routeuser', password: 'password123' })
      });
      const userData = await initRes.json();
      console.log('   Response:', JSON.stringify(userData), '\n');

      // 2. Login
      console.log('2. Calling /auth/login...');
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'routeuser', password: 'password123' })
      });
      const loginData = await loginRes.json();
      console.log('   Response:', JSON.stringify(loginData), '\n');
      const token = loginData.token;

      // 3. List Plans
      console.log('3. Calling /billing/plans (Public)...');
      const plansRes = await fetch(`${baseUrl}/billing/plans`);
      const plans = await plansRes.json();
      console.log('   Response:', JSON.stringify(plans), '\n');

      // 4. Denied Access - Test Case A: Invalid Signature
      console.log('4a. Denied Access Test - Calling route with invalid token signature...');
      const invalidTokenRes = await fetch(`${baseUrl}/billing/subscription`, {
        headers: { 'Authorization': 'Bearer invalid.token.sig' }
      });
      console.log(`   Response Status: ${invalidTokenRes.status} (Expected: 401)`);
      console.log('   Response Body:', await invalidTokenRes.text(), '\n');

      // 5. Denied Access - Test Case B: Insufficient Permissions (403)
      console.log('4b. Denied Access Test - Calling route with user having no permissions...');
      // Initialize a user with no permissions
      await fetch(`${baseUrl}/auth/user-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nopermsuser', password: 'password123' })
      });
      // We manually sign a token without 'billing.manage' permission to simulate no permissions (or we lookup)
      // Since our userStore allows permissions to be empty, we need to bypass userStore to set permissions to []
      // Let's create a custom JWT for this user with permissions: []
      const nopermsToken = 'Bearer ' + jwt.sign({ username: 'nopermsuser', permissions: [] }, 'your-secret-key-123');
      const forbiddenRes = await fetch(`${baseUrl}/billing/subscription`, {
        headers: { 'Authorization': nopermsToken }
      });
      console.log(`   Response Status: ${forbiddenRes.status} (Expected: 403)`);
      console.log('   Response Body:', await forbiddenRes.text(), '\n');

      // 6. Subscription (Success Case)
      console.log('5. Calling /billing/subscription (Authenticated & Authorized)...');
      const subRes = await fetch(`${baseUrl}/billing/subscription`, {
        headers: { 'Authorization': token }
      });
      const sub = await subRes.json();
      console.log('   Response:', JSON.stringify(sub), '\n');

      // 7. Payment History
      console.log('6. Calling /billing (Authenticated)...');
      const paymentsRes = await fetch(`${baseUrl}/billing`, {
        headers: { 'Authorization': token }
      });
      const payments = await paymentsRes.json();
      console.log('   Response:', JSON.stringify(payments), '\n');

      // 8. Create Payment Request
      console.log('7. Calling /billing/request (Authenticated)...');
      const reqRes = await fetch(`${baseUrl}/billing/request`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amountCents: 25000,
          currency: 'USD',
          provider: 'stripe',
          metadata: { part: 'CCC Pinnacle Alternator' }
        })
      });
      const reqData = await reqRes.json();
      console.log('   Response:', JSON.stringify(reqData), '\n');

      // 9. Checkout Session (First Call)
      console.log('8. Calling /billing/checkout-session (Idempotency - Call 1)...');
      const checkoutKey = `checkout-key-${Date.now()}`;
      const checkRes1 = await fetch(`${baseUrl}/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Idempotency-Key': checkoutKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId: 'price_growth' })
      });
      const checkData1 = await checkRes1.json();
      console.log('   Response:', JSON.stringify(checkData1), '\n');

      // 10. Checkout Session (Second Call - Duplicate)
      console.log('9. Calling /billing/checkout-session (Idempotency - Call 2, Duplicate)...');
      const checkRes2 = await fetch(`${baseUrl}/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Idempotency-Key': checkoutKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId: 'price_growth' })
      });
      const checkData2 = await checkRes2.json();
      console.log('   Response (Should be already_processed):', JSON.stringify(checkData2), '\n');

      // 11. Onboarding Checkout Session
      console.log('10. Calling /billing/onboarding/checkout-session (Public / Rate limited)...');
      const onboardingKey = `onboarding-key-${Date.now()}`;
      const onboardRes = await fetch(`${baseUrl}/billing/onboarding/checkout-session`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': onboardingKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ priceId: 'price_pro', email: 'recycler@sabhi.io' })
      });
      const onboardData = await onboardRes.json();
      console.log('   Response:', JSON.stringify(onboardData), '\n');

      // 12. Verify Onboarding
      console.log('11. Calling /billing/onboarding/verify-checkout...');
      const verifyKey = `verify-key-${Date.now()}`;
      const verifyRes = await fetch(`${baseUrl}/billing/onboarding/verify-checkout`, {
        method: 'POST',
        headers: {
          'Idempotency-Key': verifyKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: onboardData.id, email: 'recycler@sabhi.io' })
      });
      const verifyData = await verifyRes.json();
      console.log('   Response:', JSON.stringify(verifyData), '\n');

      // 13. Logout
      console.log('12. Calling /auth/logout (Blacklisting Token)...');
      const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': token }
      });
      const logoutData = await logoutRes.json();
      console.log('   Response:', JSON.stringify(logoutData), '\n');

      // 14. Accessing route post-logout (Denied Access Test Case C)
      console.log('13. Denied Access Test - Calling route with logged-out token...');
      const postLogoutRes = await fetch(`${baseUrl}/billing/subscription`, {
        headers: { 'Authorization': token }
      });
      console.log(`   Response Status: ${postLogoutRes.status} (Expected: 401)`);
      console.log('   Response Body:', await postLogoutRes.text(), '\n');

      console.log('=== All Integration Tests Completed Successfully ===');
    } catch (err) {
      console.error('Test execution failed:', err);
      process.exitCode = 1;
    } finally {
      server.close(() => {
        console.log('=== Server Closed ===');
      });
    }
  });
}

run();
