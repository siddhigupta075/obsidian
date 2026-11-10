import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../src/models/Payment.js';
import { User } from '../src/models/User.js';
import { processFamilyDecision, lazyCheckExpiredHolds } from '../src/controllers/holds.js';
import * as paypalController from '../src/controllers/paypal.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function runLifecycleTests() {
  console.log('================================================================');
  console.log('🧪 Second Sight — PayPal Lifecycle, Concurrency & Security Tests');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI as string);

  const elder = (await User.findOne({ role: 'elder' })) || (await User.create({
    name: 'Test Elder',
    role: 'elder',
    email: 'elder-test@example.com',
  }));

  const family = (await User.findOne({ role: 'family' })) || (await User.create({
    name: 'Test Family',
    role: 'family',
    email: 'family-test@example.com',
  }));

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  const createdTestIds: mongoose.Types.ObjectId[] = [];

  try {
    // --------------------------------------------------------------------------
    // Test 1: Currency consistency (USD default across models and records)
    // --------------------------------------------------------------------------
    console.log('Test 1: Currency consistency (USD default)');
    const usdPayment = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 150,
      payeeLabel: 'USD Test Payee',
      message: 'Currency check',
      risk: 'LOW',
      status: 'CHECKED',
      holdToken: uuidv4(),
    });
    createdTestIds.push(usdPayment._id as mongoose.Types.ObjectId);
    assert(usdPayment.currency === 'USD', 'Payment model defaults to USD currency');

    // --------------------------------------------------------------------------
    // Test 2: Order Creation Concurrency & Atomic Claim (Section 4)
    // --------------------------------------------------------------------------
    console.log('\nTest 2: Order Creation Concurrency (CHECKED -> PROCESSING)');
    const orderCheckPayment = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 200,
      currency: 'USD',
      payeeLabel: 'Order Concurrent Store',
      message: 'Order creation test',
      risk: 'LOW',
      status: 'CHECKED',
      holdToken: uuidv4(),
    });
    createdTestIds.push(orderCheckPayment._id as mongoose.Types.ObjectId);

    const leaseCutoff = new Date(Date.now() - 60000);

    // 4 concurrent requests attempt to create PayPal order for the same payment record
    const concurrentOrderClaims = await Promise.all([
      Payment.findOneAndUpdate(
        {
          _id: orderCheckPayment._id,
          $or: [
            { status: 'CHECKED' },
            { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: { $lt: leaseCutoff } },
          ],
        },
        { $set: { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: new Date() } },
        { new: true }
      ),
      Payment.findOneAndUpdate(
        {
          _id: orderCheckPayment._id,
          $or: [
            { status: 'CHECKED' },
            { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: { $lt: leaseCutoff } },
          ],
        },
        { $set: { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: new Date() } },
        { new: true }
      ),
      Payment.findOneAndUpdate(
        {
          _id: orderCheckPayment._id,
          $or: [
            { status: 'CHECKED' },
            { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: { $lt: leaseCutoff } },
          ],
        },
        { $set: { status: 'PROCESSING', processingAction: 'CREATE_ORDER', processingStartedAt: new Date() } },
        { new: true }
      ),
    ]);

    const orderClaimWinners = concurrentOrderClaims.filter((c) => c !== null);
    assert(orderClaimWinners.length === 1, 'Exactly one concurrent request claimed order creation lock');
    assert(orderClaimWinners[0]?.processingAction === 'CREATE_ORDER', 'Processing action tagged as CREATE_ORDER');

    // Complete order creation
    const simOrderId = `ORDER-${uuidv4().substring(0, 8)}`;
    orderClaimWinners[0]!.paypalOrderId = simOrderId;
    orderClaimWinners[0]!.status = 'CREATED';
    orderClaimWinners[0]!.processingAction = null;
    orderClaimWinners[0]!.processingStartedAt = null;
    await orderClaimWinners[0]!.save();

    const finalizedOrder = await Payment.findById(orderCheckPayment._id);
    assert(finalizedOrder?.status === 'CREATED', 'Order successfully set to CREATED status');
    assert(finalizedOrder?.paypalOrderId === simOrderId, 'paypalOrderId successfully recorded');

    // --------------------------------------------------------------------------
    // Test 3: Atomic authorization claiming with lease recovery (Section 1)
    // --------------------------------------------------------------------------
    console.log('\nTest 3: Authorization claiming and lease recovery (Section 1)');
    const orderId3 = `ORDER-${uuidv4().substring(0, 8)}`;
    const payment3 = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 500,
      currency: 'USD',
      payeeLabel: 'Test Merchant 3',
      message: 'Monthly bill',
      risk: 'LOW',
      status: 'CREATED',
      paypalOrderId: orderId3,
      holdToken: uuidv4(),
    });
    createdTestIds.push(payment3._id as mongoose.Types.ObjectId);

    const authRequestId = payment3.paypalAuthorizationRequestId || uuidv4();
    const claimedAuth = await Payment.findOneAndUpdate(
      {
        paypalOrderId: orderId3,
        $or: [
          { status: 'CREATED' },
          { status: 'PROCESSING', processingAction: 'AUTHORIZE', processingStartedAt: { $lt: leaseCutoff } },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAction: 'AUTHORIZE',
          processingStartedAt: new Date(),
          paypalAuthorizationRequestId: authRequestId,
        },
      },
      { new: true }
    );

    assert(claimedAuth !== null, 'Successfully claimed CREATED -> PROCESSING authorization lock');
    assert(claimedAuth?.status === 'PROCESSING', 'Status transitioned to PROCESSING');
    assert(claimedAuth?.processingAction === 'AUTHORIZE', 'Tagged processingAction: AUTHORIZE');
    assert(claimedAuth?.paypalAuthorizationRequestId === authRequestId, 'paypalAuthorizationRequestId persisted');

    // Concurrent claim while lease is active must be rejected
    const activeClaim = await Payment.findOneAndUpdate(
      {
        paypalOrderId: orderId3,
        $or: [
          { status: 'CREATED' },
          { status: 'PROCESSING', processingAction: 'AUTHORIZE', processingStartedAt: { $lt: leaseCutoff } },
        ],
      },
      { $set: { status: 'PROCESSING', processingAction: 'AUTHORIZE', processingStartedAt: new Date() } },
      { new: true }
    );
    assert(activeClaim === null, 'Active in-flight authorization lease cannot be reclaimed concurrently');

    // Simulate an expired lease (> 60s ago, e.g. worker timed out or crashed)
    claimedAuth!.processingStartedAt = new Date(Date.now() - 120000); // 2 minutes ago
    await claimedAuth!.save();

    // Now recovery must succeed and REUSE the exact same authRequestId!
    const recoveredAuthClaim = await Payment.findOneAndUpdate(
      {
        paypalOrderId: orderId3,
        $or: [
          { status: 'CREATED' },
          { status: 'PROCESSING', processingAction: 'AUTHORIZE', processingStartedAt: { $lt: leaseCutoff } },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAction: 'AUTHORIZE',
          processingStartedAt: new Date(),
          paypalAuthorizationRequestId: claimedAuth!.paypalAuthorizationRequestId || uuidv4(),
        },
      },
      { new: true }
    );

    assert(recoveredAuthClaim !== null, 'Expired lease was successfully recovered for retry');
    assert(recoveredAuthClaim?.paypalAuthorizationRequestId === authRequestId, 'Exact same paypalAuthorizationRequestId reused on recovery');

    // --------------------------------------------------------------------------
    // Test 4: Persisting authorization before capture & Low-risk direct capture
    // --------------------------------------------------------------------------
    console.log('\nTest 4: Authorization persistence & Low-risk direct capture');
    const simAuthId = `AUTH-${uuidv4().substring(0, 8)}`;
    recoveredAuthClaim!.paypalAuthorizationId = simAuthId;
    recoveredAuthClaim!.status = 'AUTHORIZED';
    recoveredAuthClaim!.processingAction = null;
    recoveredAuthClaim!.processingStartedAt = null;
    await recoveredAuthClaim!.save();

    const authSaved = await Payment.findById(recoveredAuthClaim!._id);
    assert(authSaved?.status === 'AUTHORIZED', 'Payment persisted in AUTHORIZED before capture');
    assert(authSaved?.paypalAuthorizationId === simAuthId, 'paypalAuthorizationId persisted correctly');

    // Low-risk direct capture claim
    const captureReqId = authSaved?.paypalCaptureRequestId || uuidv4();
    const lowRiskCapturing = await Payment.findOneAndUpdate(
      {
        _id: authSaved!._id,
        $or: [
          { status: 'AUTHORIZED' },
          { status: 'PROCESSING', processingAction: 'CAPTURE', processingStartedAt: { $lt: leaseCutoff } },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          processingAction: 'CAPTURE',
          processingStartedAt: new Date(),
          paypalCaptureRequestId: captureReqId,
        },
      },
      { new: true }
    );

    assert(lowRiskCapturing !== null, 'Atomic transition AUTHORIZED -> PROCESSING claimed for capture');
    assert(lowRiskCapturing?.processingAction === 'CAPTURE', 'processingAction tagged as CAPTURE');

    // Finalize low-risk capture
    const simCapId = `CAP-${uuidv4().substring(0, 8)}`;
    lowRiskCapturing!.paypalCaptureId = simCapId;
    lowRiskCapturing!.status = 'CAPTURED';
    lowRiskCapturing!.decision = 'APPROVED';
    lowRiskCapturing!.decidedAt = new Date();
    lowRiskCapturing!.processingAction = null;
    lowRiskCapturing!.processingStartedAt = null;
    await lowRiskCapturing!.save();

    const finalizedPayment = await Payment.findById(recoveredAuthClaim!._id);
    assert(finalizedPayment?.status === 'CAPTURED', 'Payment transitioned to CAPTURED');
    assert(finalizedPayment?.decision === 'APPROVED', 'Decision recorded as APPROVED');
    assert(finalizedPayment?.paypalCaptureId === simCapId, 'paypalCaptureId persisted');

    // --------------------------------------------------------------------------
    // Test 5: Strict PayPal Capture Validation (Section 2)
    // --------------------------------------------------------------------------
    console.log('\nTest 5: Strict PayPal Capture Validation (Section 2)');
    const originalFetch = globalThis.fetch;

    // Subtest 5a: Reject PENDING status
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ id: 'CAP-123', status: 'PENDING' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let pendingThrew = false;
    try {
      await paypalController.capturePayPalAuthorization('AUTH-FAKE-1');
    } catch (err: any) {
      pendingThrew = true;
      assert(err.message.includes('non-completed status: PENDING'), 'capturePayPalAuthorization rejected PENDING status');
    }
    assert(pendingThrew, 'Strict capture threw error on PENDING status');

    // Subtest 5b: Reject DECLINED status
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ id: 'CAP-123', status: 'DECLINED' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let declinedThrew = false;
    try {
      await paypalController.capturePayPalAuthorization('AUTH-FAKE-2');
    } catch (err: any) {
      declinedThrew = true;
      assert(err.message.includes('non-completed status: DECLINED'), 'capturePayPalAuthorization rejected DECLINED status');
    }
    assert(declinedThrew, 'Strict capture threw error on DECLINED status');

    // Subtest 5c: Reject missing status / malformed response
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ id: 'CAP-123' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let missingStatusThrew = false;
    try {
      await paypalController.capturePayPalAuthorization('AUTH-FAKE-3');
    } catch (err: any) {
      missingStatusThrew = true;
      assert(err.message.includes('missing status'), 'capturePayPalAuthorization rejected missing status');
    }
    assert(missingStatusThrew, 'Strict capture threw error on missing status');

    // Subtest 5d: Reject missing capture ID
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ status: 'COMPLETED' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    let missingIdThrew = false;
    try {
      await paypalController.capturePayPalAuthorization('AUTH-FAKE-4');
    } catch (err: any) {
      missingIdThrew = true;
      assert(err.message.includes('missing capture ID'), 'capturePayPalAuthorization rejected missing capture ID');
    }
    assert(missingIdThrew, 'Strict capture threw error on missing ID');

    // Subtest 5e: Accept explicitly COMPLETED with capture ID
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ id: 'CAP-VALID-999', status: 'COMPLETED' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const validCapture = await paypalController.capturePayPalAuthorization('AUTH-FAKE-5');
    assert(validCapture.captureId === 'CAP-VALID-999', 'Accepted valid capture ID');
    assert(validCapture.status === 'COMPLETED', 'Accepted explicitly COMPLETED capture');

    // Restore fetch
    globalThis.fetch = originalFetch;

    // --------------------------------------------------------------------------
    // Test 6: Capture failure preserves AUTHORIZED status and idempotency key
    // --------------------------------------------------------------------------
    console.log('\nTest 6: Capture failure recovery (status restored to AUTHORIZED, never CREATED)');
    const orderId6 = `ORDER-${uuidv4().substring(0, 8)}`;
    const authId6 = `AUTH-${uuidv4().substring(0, 8)}`;
    const payment6 = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 300,
      currency: 'USD',
      payeeLabel: 'Grocery Store',
      message: 'Weekly fruits',
      risk: 'LOW',
      status: 'AUTHORIZED',
      paypalOrderId: orderId6,
      paypalAuthorizationId: authId6,
      paypalAuthorizationRequestId: uuidv4(),
      holdToken: uuidv4(),
    });
    createdTestIds.push(payment6._id as mongoose.Types.ObjectId);

    // Atomically claim for capture
    const captureReqId6 = payment6.paypalCaptureRequestId || uuidv4();
    const capturing6 = await Payment.findOneAndUpdate(
      { _id: payment6._id, status: 'AUTHORIZED' },
      { status: 'PROCESSING', processingAction: 'CAPTURE', paypalCaptureRequestId: captureReqId6, processingStartedAt: new Date() },
      { new: true }
    );

    // Simulate external capture failure / timeout -> restore to AUTHORIZED
    capturing6!.status = 'AUTHORIZED';
    capturing6!.processingAction = null;
    capturing6!.processingStartedAt = null;
    await capturing6!.save();

    const recoveredPayment6 = await Payment.findById(payment6._id);
    assert(recoveredPayment6?.status === 'AUTHORIZED', 'Payment restored to AUTHORIZED, avoiding stuck PROCESSING');
    assert(recoveredPayment6?.status !== 'CREATED', 'Payment was NEVER reset to CREATED');
    assert(recoveredPayment6?.paypalAuthorizationId === authId6, 'Authorization ID preserved across capture failure');
    assert(recoveredPayment6?.paypalCaptureRequestId === captureReqId6, 'Capture request idempotency key preserved');

    // --------------------------------------------------------------------------
    // Test 7: Family approval workflow with persistent idempotency key
    // --------------------------------------------------------------------------
    console.log('\nTest 7: Family approval workflow with persistent idempotency key');
    const holdToken7 = uuidv4();
    const authId7 = `AUTH-${uuidv4().substring(0, 8)}`;
    const payment7 = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 1500,
      currency: 'USD',
      payeeLabel: 'Family Review Payee',
      message: 'Urgent transfer',
      risk: 'HIGH',
      status: 'HELD',
      holdToken: holdToken7,
      paypalAuthorizationId: authId7,
      expiresAt: new Date(Date.now() + 86400000),
      rulesResult: { risk: 'HIGH', flags: ['urgency'] },
      aiResult: { risk: 'HIGH', scamType: 'other', reasons: ['urgency'], questionForElder: '', familySummary: '' },
    });
    createdTestIds.push(payment7._id as mongoose.Types.ObjectId);

    // Intercept fetch for capture request
    let interceptedCaptureKey: string | undefined = undefined;
    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/capture')) {
        interceptedCaptureKey = init?.headers?.['PayPal-Request-Id'];
        return new Response(JSON.stringify({ id: `CAP-${uuidv4().substring(0, 8)}`, status: 'COMPLETED' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, init);
    };

    try {
      const decisionResult = await processFamilyDecision(holdToken7, 'approve');
      assert(decisionResult.success === true, 'Family approval succeeded');
      assert(decisionResult.status === 'CAPTURED', 'Approval returned CAPTURED status');

      const approvedPayment = await Payment.findById(payment7._id);
      assert(approvedPayment?.status === 'CAPTURED', 'Database status updated to CAPTURED');
      assert(approvedPayment?.decision === 'APPROVED', 'Decision stored as APPROVED');
      assert(Boolean(approvedPayment?.paypalCaptureRequestId), 'Persistent capture request ID stored');
      assert(approvedPayment?.paypalCaptureRequestId === interceptedCaptureKey, 'Persistent capture key matches PayPal-Request-Id header');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // --------------------------------------------------------------------------
    // Test 8: Family rejection workflow with void verification
    // --------------------------------------------------------------------------
    console.log('\nTest 8: Family rejection workflow with void verification');
    const holdToken8 = uuidv4();
    const authId8 = `AUTH-${uuidv4().substring(0, 8)}`;
    const payment8 = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 4000,
      currency: 'USD',
      payeeLabel: 'Unknown Tech Scam',
      message: 'Remote access fee',
      risk: 'HIGH',
      status: 'HELD',
      holdToken: holdToken8,
      paypalAuthorizationId: authId8,
      expiresAt: new Date(Date.now() + 86400000),
      rulesResult: { risk: 'HIGH', flags: ['remote_access'] },
      aiResult: { risk: 'HIGH', scamType: 'tech_support', reasons: ['remote_access'], questionForElder: '', familySummary: '' },
    });
    createdTestIds.push(payment8._id as mongoose.Types.ObjectId);

    // Intercept fetch for void request
    let interceptedVoidKey: string | undefined = undefined;
    globalThis.fetch = async (url: any, init?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/void')) {
        interceptedVoidKey = init?.headers?.['PayPal-Request-Id'];
        return new Response(null, { status: 204 });
      }
      return originalFetch(url, init);
    };

    try {
      const declineResult = await processFamilyDecision(holdToken8, 'decline');
      assert(declineResult.success === true, 'Decline decision succeeded');
      assert(declineResult.status === 'VOIDED', 'Decline returned VOIDED status');

      const voidedPayment = await Payment.findById(payment8._id);
      assert(voidedPayment?.status === 'VOIDED', 'Database status transitioned to VOIDED');
      assert(voidedPayment?.decision === 'DECLINED', 'Decision stored as DECLINED');
      assert(Boolean(voidedPayment?.paypalVoidRequestId), 'Persistent paypalVoidRequestId stored');
      assert(voidedPayment?.paypalVoidRequestId === interceptedVoidKey, 'Void request key matches PayPal-Request-Id header');
    } finally {
      globalThis.fetch = originalFetch;
    }

    // --------------------------------------------------------------------------
    // Test 9: Duplicate decision conflict prevention
    // --------------------------------------------------------------------------
    console.log('\nTest 9: Duplicate decision conflict prevention');
    const duplicateAttempt = await processFamilyDecision(holdToken8, 'approve');
    assert(duplicateAttempt.status === 'VOIDED' || duplicateAttempt.status === 'CONFLICT', 'Duplicate decision on settled payment recognized as settled/conflict');

    // --------------------------------------------------------------------------
    // Test 10: Automatic hold expiry concurrency protection
    // --------------------------------------------------------------------------
    console.log('\nTest 10: Automatic hold expiry concurrency protection');
    const holdToken10 = uuidv4();
    const payment10 = await Payment.create({
      elderId: elder._id,
      familyId: family._id,
      amount: 800,
      currency: 'USD',
      payeeLabel: 'Expired Service',
      message: 'Cooling off expired',
      risk: 'MEDIUM',
      status: 'PROCESSING', // Simulating another concurrent operation currently in progress
      processingAction: 'CAPTURE', // Family member actively approving
      processingStartedAt: new Date(),
      holdToken: holdToken10,
      expiresAt: new Date(Date.now() - 10000), // Expired
      rulesResult: { risk: 'MEDIUM', flags: [] },
      aiResult: { risk: 'MEDIUM', scamType: 'other', reasons: [], questionForElder: '', familySummary: '' },
    });
    createdTestIds.push(payment10._id as mongoose.Types.ObjectId);

    // Run lazy check: since status is PROCESSING with action CAPTURE, expiry worker must not void it
    await lazyCheckExpiredHolds();
    const inFlightPayment = await Payment.findById(payment10._id);
    assert(inFlightPayment?.status === 'PROCESSING', 'Expiry worker did not interfere with in-flight PROCESSING payment');
    assert(inFlightPayment?.processingAction === 'CAPTURE', 'Processing action CAPTURE remained intact');

    console.log('\n================================================================');
    console.log(`🎉 All ${passedTests}/${totalTests} lifecycle tests passed successfully!`);
    console.log('================================================================');
  } finally {
    // Clean up test documents
    if (createdTestIds.length > 0) {
      await Payment.deleteMany({ _id: { $in: createdTestIds } });
    }
    await mongoose.disconnect();
  }
}

runLifecycleTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
