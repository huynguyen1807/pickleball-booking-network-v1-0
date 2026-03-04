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
    payosCancelPayment
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

export default router;

