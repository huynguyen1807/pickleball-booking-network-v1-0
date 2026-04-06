import { sql } from '../config/db';

const ADMIN_COMMISSION_RATE = 0.05;

const resolveOwnerInfoByPayment = async (executor: any, paymentId: number) => {
    const result = await executor.request()
        .input('payment_id', sql.Int, paymentId)
        .query(`
            SELECT
                p.id AS payment_id,
                p.booking_id,
                p.match_id,
                COALESCE(fb.owner_id, fm.owner_id) AS owner_id,
                CASE WHEN fb.owner_id IS NOT NULL THEN 'booking' ELSE 'match' END AS owner_source
            FROM payments p
            LEFT JOIN bookings b ON b.id = p.booking_id
            LEFT JOIN courts cb ON cb.id = b.court_id
            LEFT JOIN facilities fb ON fb.id = cb.facility_id
            LEFT JOIN matches m ON m.id = p.match_id
            LEFT JOIN courts cm ON cm.id = m.court_id
            LEFT JOIN facilities fm ON fm.id = cm.facility_id
            WHERE p.id = @payment_id
        `);

    return result.recordset?.[0] || null;
};

const isPaymentAlreadySettledToOwner = async (executor: any, paymentId: number): Promise<boolean> => {
    // Optional integration point for future payout module.
    const hasPayouts = await executor.request().query("SELECT OBJECT_ID('owner_payouts', 'U') AS t");
    const hasPayoutItems = await executor.request().query("SELECT OBJECT_ID('owner_payout_items', 'U') AS t");

    if (!hasPayouts.recordset?.[0]?.t || !hasPayoutItems.recordset?.[0]?.t) {
        return false;
    }

    const settled = await executor.request()
        .input('payment_id', sql.Int, paymentId)
        .query(`
            SELECT TOP 1 1 AS is_settled
            FROM owner_payout_items opi
            JOIN owner_payouts op ON op.id = opi.payout_id
            WHERE opi.payment_id = @payment_id
              AND LOWER(op.status) IN ('paid', 'completed', 'settled')
        `);

    return settled.recordset.length > 0;
};

export const applyRefundFinancialReversal = async (executor: any, params: {
    paymentId: number;
    refundAmount: number;
    note?: string;
}) => {
    const refundAmount = Math.max(0, Number(params.refundAmount || 0));
    if (refundAmount <= 0) return;

    const existing = await executor.request()
        .input('payment_id', sql.Int, params.paymentId)
        .query(`
            SELECT id
            FROM payment_refund_reversals
            WHERE payment_id = @payment_id
        `);

    if (existing.recordset.length > 0) {
        return;
    }

    const ownerInfo = await resolveOwnerInfoByPayment(executor, params.paymentId);
    const ownerId = ownerInfo?.owner_id ? Number(ownerInfo.owner_id) : null;
    const bookingId = ownerInfo?.booking_id ? Number(ownerInfo.booking_id) : null;
    const matchId = ownerInfo?.match_id ? Number(ownerInfo.match_id) : null;

    const adminReversal = Math.round(refundAmount * ADMIN_COMMISSION_RATE);
    const ownerReversal = Math.max(0, refundAmount - adminReversal);
    const ownerWasPaidOut = ownerId ? await isPaymentAlreadySettledToOwner(executor, params.paymentId) : false;

    await executor.request()
        .input('payment_id', sql.Int, params.paymentId)
        .input('booking_id', sql.Int, bookingId)
        .input('match_id', sql.Int, matchId)
        .input('owner_id', sql.Int, ownerId)
        .input('refund_amount', sql.Decimal(12, 2), refundAmount)
        .input('admin_reversal', sql.Decimal(12, 2), adminReversal)
        .input('owner_reversal', sql.Decimal(12, 2), ownerReversal)
        .input('owner_payout_state', sql.NVarChar, ownerWasPaidOut ? 'paid_out' : 'not_paid_out')
        .input('note', sql.NVarChar, params.note || null)
        .query(`
            INSERT INTO payment_refund_reversals (
                payment_id, booking_id, match_id, owner_id,
                refund_amount, admin_reversal, owner_reversal,
                owner_payout_state, note
            )
            VALUES (
                @payment_id, @booking_id, @match_id, @owner_id,
                @refund_amount, @admin_reversal, @owner_reversal,
                @owner_payout_state, @note
            )
        `);

    if (ownerWasPaidOut && ownerId && ownerReversal > 0) {
        await executor.request()
            .input('owner_id', sql.Int, ownerId)
            .input('owner_reversal', sql.Decimal(12, 2), ownerReversal)
            .query(`
                UPDATE users
                SET owner_debt_balance = ISNULL(owner_debt_balance, 0) + @owner_reversal
                WHERE id = @owner_id
            `);
    }
};
