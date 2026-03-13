import { Router } from 'express';
import auth from '../middleware/auth';
import {
    getPaymentHistory,
    // PayOS
    payosInit,
    payosWebhook,
    payosReturn,
    payosCheckStatus,
    payosGetInfo,
    payosCancelPayment,
    payosCancelReturn,
    payosCancelByOrderCode
} from '../controllers/payment.controller';

const router = Router();

// ===== Payment History =====
router.get('/history', auth, getPaymentHistory);

// ===== PayOS Payment Routes =====
/**
 * Step 1: Init PayOS payment
 * POST /api/payments/payos-init
 * Body: { booking_id?, match_id?, description? }
 * Response: { checkoutUrl, qrCode, orderCode, paymentLinkId }
 */
router.post('/payos-init', auth, payosInit);

/**
 * Step 2: PayOS Webhook (server-to-server)
 * POST /api/payments/payos-webhook
 * Called by PayOS after payment thanh toán
 */
router.post('/payos-webhook', payosWebhook);

/**
 * Step 3: Return URL (user redirect)
 * GET /api/payments/payos-return?orderCode=...&status=...
 * User redirect từ PayOS
 */
router.get('/payos-return', payosReturn);

/**
 * Step 4: Check payment status (polling)
 * GET /api/payments/payos-status/:orderCode
 */
router.get('/payos-status/:orderCode', payosCheckStatus);

/**
 * Get Payment Link Info
 * GET /api/payments/payos-info/:paymentLinkId
 */
router.get('/payos-info/:paymentLinkId', auth, payosGetInfo);

/**
 * Cancel Payment
 * POST /api/payments/payos-cancel/:paymentLinkId
 */
router.post('/payos-cancel/:paymentLinkId', auth, payosCancelPayment);

/**
 * PayOS Cancel Redirect Handler (no auth - called by PayOS redirect)
 * GET /api/payments/payos-cancel-return?orderCode=...
 * Updates payment/booking to cancelled, then redirects to frontend
 */
router.get('/payos-cancel-return', payosCancelReturn);

/**
 * Cancel by OrderCode (JSON - called by frontend when 15-min timer expires)
 * PATCH /api/payments/cancel-by-order?orderCode=...
 */
router.patch('/cancel-by-order', payosCancelByOrderCode);

export default router;

