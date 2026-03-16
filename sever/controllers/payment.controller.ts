import { sql, poolPromise } from '../config/db';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { successResponse, errorResponse, serverError, webhookResponse } from '../utils/response';

dotenv.config();

// ===== PayOS Configuration =====
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
const PAYOS_API_URL = process.env.PAYOS_API_URL || 'https://api-merchant.payos.vn';
const PAYOS_RETURN_URL = process.env.PAYOS_RETURN_URL || 'http://localhost:5173/payment/result';
const PAYOS_CANCEL_URL = process.env.PAYOS_CANCEL_URL || 'http://localhost:5000/api/payments/payos-cancel-return';
const PAYOS_WEBHOOK_URL = process.env.PAYOS_WEBHOOK_URL || 'http://localhost:3000/api/payments/payos-webhook';

// ===== Helper Functions =====

/**
 * Sinh mã đơn hàng duy nhất (unique order code)
 */
export const generateOrderCode = (): number => {
    return Math.floor(Math.random() * 999999999);
};

/**
 * Tạo mô tả ngẫu nhiên (10 ký tự: A-Z, a-z, 0-9)
 */
export const generateRandomDescription = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Sắp xếp object theo alphabet
 */
export const sortParams = (obj: any): any => {
    const keys = Object.keys(obj).sort();
    const sorted: any = {};
    keys.forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
};

/**
 * Tạo query string
 */
export const createQueryString = (obj: any): string => {
    return Object.keys(obj)
        .map(key => `${key}=${obj[key]}`)
        .join('&');
};

/**
 * Tính PayOS Signature (HMAC SHA256)
 */
export const calculatePayOSSignature = (data: string, checksumKey: string): string => {
    return crypto
        .createHmac('sha256', checksumKey)
        .update(Buffer.from(data, 'utf-8'))
        .digest('hex');
};

/**
 * Verify PayOS Signature
 */
export const verifyPayOSSignature = (data: string, clientSignature: string, checksumKey: string): boolean => {
    const serverSignature = calculatePayOSSignature(data, checksumKey);
    return serverSignature === clientSignature;
};

// ===== Database Helpers =====

/**
 * Lưu payment record
 */
export const insertPayment = async (
    userId: number,
    bookingId: number | null,
    matchId: number | null,
    amount: number,
    paymentMethod: string,
    orderCode: number,
    paymentLinkId: string,
    status: string = 'pending'
) => {
    const pool = await poolPromise;
    const commission = amount * 0.05;

    const result = await pool.request()
        .input('user_id', sql.Int, userId)
        .input('booking_id', sql.Int, bookingId || null)
        .input('match_id', sql.Int, matchId || null)
        .input('amount', sql.Decimal(12, 2), amount)
        .input('commission', sql.Decimal(12, 2), commission)
        .input('payment_method', sql.NVarChar, paymentMethod)
        .input('status', sql.NVarChar, status)
        .input('transaction_id', sql.NVarChar, `${paymentMethod}_${orderCode}_${paymentLinkId}`)
        .query(`
            INSERT INTO payments (user_id, booking_id, match_id, amount, commission, payment_method, status, transaction_id)
            OUTPUT INSERTED.id
            VALUES (@user_id, @booking_id, @match_id, @amount, @commission, @payment_method, @status, @transaction_id)
        `);

    return result.recordset[0]?.id;
};

/**
 * Update payment status
 */
export const updatePaymentStatus = async (paymentId: number, status: string) => {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, paymentId)
        .input('status', sql.NVarChar, status)
        .query('UPDATE payments SET status = @status WHERE id = @id');
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (bookingId: number, status: string) => {
    const pool = await poolPromise;
    await pool.request()
        .input('id', sql.Int, bookingId)
        .input('status', sql.NVarChar, status)
        .query('UPDATE bookings SET status = @status WHERE id = @id');
};

// ===== Public Functions =====

/**
 * Lấy lịch sử thanh toán
 */
export const getPaymentHistory = async (req: any, res: any) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT p.*, b.booking_date, c.name AS court_name, m.match_date
                FROM payments p
                LEFT JOIN bookings b ON p.booking_id = b.id
                LEFT JOIN matches m ON p.match_id = m.id
                LEFT JOIN courts c ON (b.court_id = c.id OR m.court_id = c.id)
                WHERE p.user_id = @user_id
                ORDER BY p.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err: any) {
        console.error('Payment history error:', err.message);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ===== PAYOS FUNCTIONS =====

/**
 * 1️⃣ Khởi tạo PayOS Payment
 * Route: POST /api/payments/payos-init
 * 
 * Flow:
 * 1. Kiểm tra booking
 * 2. Sinh order code
 * 3. Tạo signature
 * 4. Call PayOS API tạo link thanh toán
 * 5. Return checkout URL + QR code
 */
export const payosInit = async (req: any, res: any) => {
    try {
        const { booking_id, match_id } = req.body;
        const pool = await poolPromise;

        // Kiểm tra booking hoặc match
        let amount = 0;
        if (booking_id) {
            const booking = await pool.request()
                .input('id', sql.Int, booking_id)
                .query('SELECT user_id, total_price FROM bookings WHERE id = @id');

            if (booking.recordset.length === 0) {
                return res.status(404).json({ message: 'Booking không tồn tại' });
            }

            if (booking.recordset[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Không có quyền' });
            }

            amount = booking.recordset[0].total_price;
        } else if (match_id) {
            // Handle match payment
            const match = await pool.request()
                .input('id', sql.Int, match_id)
                .query('SELECT total_cost FROM matches WHERE id = @id');

            if (match.recordset.length === 0) {
                return res.status(404).json({ message: 'Match không tồn tại' });
            }

            amount = match.recordset[0].total_cost / 4; // Chia cho 4 người chơi
        } else {
            return res.status(400).json({ message: 'Cần booking_id hoặc match_id' });
        }

        // Sinh order code
        const orderCode = generateOrderCode();

        // Prepare PayOS params
        const payosData = {
            orderCode,
            amount: Math.round(amount),
            description: generateRandomDescription(),
            returnUrl: PAYOS_RETURN_URL,
            cancelUrl: PAYOS_CANCEL_URL
        };

        // Sắp xếp và tạo signature
        const sorted = sortParams(payosData);
        const queryString = createQueryString(sorted);
        const signature = calculatePayOSSignature(queryString, PAYOS_CHECKSUM_KEY);

        // Call PayOS API
        const payosPayload = {
            ...payosData,
            signature
        };

        console.log('PayOS Request:', payosPayload);

        const payosResponse = await axios.post(
            `${PAYOS_API_URL}/v2/payment-requests`,
            payosPayload,
            {
                headers: {
                    'x-client-id': PAYOS_CLIENT_ID,
                    'x-api-key': PAYOS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('PayOS Response:', payosResponse.data);

        if (payosResponse.data.code !== '00') {
            return errorResponse(res, 'Không thể tạo link thanh toán', payosResponse.data.desc);
        }

        const paymentData = payosResponse.data.data;

        // Lưu payment record
        const paymentId = await insertPayment(
            req.user.id,
            booking_id || null,
            match_id || null,
            Math.round(amount),
            'payos',
            orderCode,
            paymentData.paymentLinkId,
            'pending'
        );

        return successResponse(res, {
            paymentId,
            data: {
                checkoutUrl: paymentData.checkoutUrl,
                qrCode: paymentData.qrCode,
                amount: paymentData.amount,
                orderCode: paymentData.orderCode,
                paymentLinkId: paymentData.paymentLinkId,
                status: paymentData.status
            }
        }, 'Khởi tạo PayOS thành công');
    } catch (err: any) {
        return serverError(res, 'Lỗi khởi tạo thanh toán', err);
    }
};

/**
 * 2️⃣ PayOS Webhook Callback
 * Route: POST /api/payments/payos-webhook
 * 
 * PayOS sẽ gọi hàm này khi có transaction
 */
export const payosWebhook = async (req: any, res: any) => {
    try {
        const { code, desc, success, data, signature } = req.body;

        console.log('PayOS Webhook Received:', { code, desc, success });

        // Lưu webhook data để verify
        const webhookData = {
            code,
            desc,
            success
        };

        // Verify signature
        if (data?.orderCode) {
            const sorted = sortParams(data);
            const queryString = createQueryString(sorted);
            const expectedSignature = calculatePayOSSignature(queryString, PAYOS_CHECKSUM_KEY);

            if (signature !== expectedSignature) {
                console.log('PayOS Webhook: Invalid signature');
                return res.status(400).json({
                    code: '97',
                    message: 'Invalid signature'
                });
            }
        }

        const pool = await poolPromise;
        const transactionPattern = `payos_${data.orderCode}_%`;

        // Tìm payment bằng orderCode
        const payment = await pool.request()
            .input('transaction_pattern', sql.NVarChar, transactionPattern)
            .query(`
                SELECT p.*, b.id as booking_id
                FROM payments p
                LEFT JOIN bookings b ON p.booking_id = b.id
                WHERE p.transaction_id LIKE @transaction_pattern
            `);

        if (payment.recordset.length === 0) {
            console.log('PayOS Webhook: Payment not found');
            return webhookResponse(res);
        }

        const paymentRecord = payment.recordset[0];

        // Cập nhật status dựa trên success flag
        if (success === true && code === '00') {
            // Success
            await updatePaymentStatus(paymentRecord.id, 'completed');
            if (paymentRecord.booking_id) {
                // Tìm booking và update
                await pool.request()
                    .input('payment_id', sql.Int, paymentRecord.id)
                    .query(`
                        UPDATE bookings 
                        SET status = 'confirmed' 
                        WHERE id = (SELECT booking_id FROM payments WHERE id = @payment_id)
                    `);
            }
            console.log(`PayOS Webhook: Payment ${data.orderCode} completed`);
        } else {
            // Failed
            await updatePaymentStatus(paymentRecord.id, 'failed');
            console.log(`PayOS Webhook: Payment ${data.orderCode} failed - ${desc}`);
        }

        // Always return 00
        return webhookResponse(res);
    } catch (err: any) {
        console.error('PayOS Webhook Error:', err.message);
        return webhookResponse(res);
    }
};

/**
 * 3️⃣ PayOS Return URL Handler
 * Route: GET /api/payments/payos-return
 * 
 * User redirect về đây sau khi thanh toán (tùy chọn)
 */
export const payosReturn = async (req: any, res: any) => {
    try {
        const { orderCode, status } = req.query;

        console.log('PayOS Return:', { orderCode, status });

        if (!orderCode) {
            return res.status(400).json({
                status: 'error',
                message: 'OrderCode không hợp lệ'
            });
        }

        const pool = await poolPromise;

        // Tìm payment
        const transactionPattern = `payos_${orderCode}_%`;
        const payment = await pool.request()
            .input('transaction_pattern', sql.NVarChar, transactionPattern)
            .query('SELECT status FROM payments WHERE transaction_id LIKE @transaction_pattern');

        if (payment.recordset.length === 0) {
            return errorResponse(res, 'Thanh toán không tìm thấy');
        }

        return successResponse(res, {
            status: payment.recordset[0].status
        }, payment.recordset[0].status === 'completed' ?
            'Thanh toán thành công' :
            'Đang xử lý thanh toán...');
    } catch (err: any) {
        return serverError(res, 'Lỗi server', err);
    }
};

/**
 * 4️⃣ Check Payment Status
 * Route: GET /api/payments/payos-status/:orderCode
 * 
 * Client polling để check status
 */
export const payosCheckStatus = async (req: any, res: any) => {
    try {
        const { orderCode } = req.params;

        const pool = await poolPromise;
        const transactionPattern = `payos_${orderCode}_%`;
        const payment = await pool.request()
            .input('transaction_pattern', sql.NVarChar, transactionPattern)
            .query('SELECT status, amount FROM payments WHERE transaction_id LIKE @transaction_pattern');

        if (payment.recordset.length === 0) {
            return errorResponse(res, 'Thanh toán không tìm thấy', undefined, 404);
        }

        return successResponse(res, {
            status: payment.recordset[0].status,
            amount: payment.recordset[0].amount
        });
    } catch (err: any) {
        return serverError(res, 'Lỗi server', err);
    }
};

/**
 * 5️⃣ Get Payment Link Info from PayOS
 * Route: GET /api/payments/payos-info/:paymentLinkId
 */
export const payosGetInfo = async (req: any, res: any) => {
    try {
        const { paymentLinkId } = req.params;

        const response = await axios.get(
            `${PAYOS_API_URL}/v2/payment-requests/${paymentLinkId}`,
            {
                headers: {
                    'x-client-id': PAYOS_CLIENT_ID,
                    'x-api-key': PAYOS_API_KEY
                }
            }
        );

        if (response.data.code !== '00') {
            return errorResponse(res, 'Không thể lấy thông tin', response.data.desc);
        }

        return successResponse(res, {
            data: response.data.data,
            signature: response.data.signature
        });
    } catch (err: any) {
        return serverError(res, 'Lỗi server', err);
    }
};

/**
 * 6️⃣ Cancel Payment Link
 * Route: POST /api/payments/payos-cancel/:paymentLinkId
 */
export const payosCancelPayment = async (req: any, res: any) => {
    try {
        const { paymentLinkId } = req.params;
        const { cancellationReason } = req.body;

        const response = await axios.post(
            `${PAYOS_API_URL}/v2/payment-requests/${paymentLinkId}/cancel`,
            {
                cancellationReason: cancellationReason || 'User cancelled'
            },
            {
                headers: {
                    'x-client-id': PAYOS_CLIENT_ID,
                    'x-api-key': PAYOS_API_KEY
                }
            }
        );

        if (response.data.code !== '00') {
            return errorResponse(res, 'Không thể hủy thanh toán', response.data.desc);
        }

        // Update payment status
        const pool = await poolPromise;
        await pool.request()
            .input('transaction_id', sql.NVarChar, `payos_%${paymentLinkId}`)
            .query(`UPDATE payments SET status = 'cancelled' WHERE transaction_id LIKE @transaction_id`);

        return successResponse(res, {
            data: response.data.data
        }, 'Đã hủy thanh toán');
    } catch (err: any) {
        return serverError(res, 'Lỗi server', err);
    }
};

/**
 * 7️⃣ Handle PayOS Cancel Redirect
 * Route: GET /api/payments/payos-cancel-return?orderCode=xxx
 *
 * PayOS redirect user về đây khi hủy thanh toán.
 * Cập nhật status thành cancelled rồi redirect về frontend.
 */
export const payosCancelReturn = async (req: any, res: any) => {
    const { orderCode } = req.query;
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

    try {
        if (orderCode) {
            const pool = await poolPromise;
            const transactionPattern = `payos_${orderCode}_%`;

            // Tìm và cập nhật payment + booking thành cancelled
            const payment = await pool.request()
                .input('transaction_pattern', sql.NVarChar, transactionPattern)
                .query(`
                    SELECT id, booking_id FROM payments
                    WHERE transaction_id LIKE @transaction_pattern AND status = 'pending'
                `);

            if (payment.recordset.length > 0) {
                const { id: paymentId, booking_id: bookingId } = payment.recordset[0];

                await updatePaymentStatus(paymentId, 'cancelled');

                if (bookingId) {
                    // Lấy thông tin booking để trả slot
                    const bk = await pool.request()
                        .input('id', sql.Int, bookingId)
                        .query('SELECT court_id, booking_date, start_time, end_time FROM bookings WHERE id = @id AND status = \'pending\'');

                    await pool.request()
                        .input('id', sql.Int, bookingId)
                        .query(`UPDATE bookings SET status = 'cancelled' WHERE id = @id AND status = 'pending'`);

                    // Trả court_slots về trạng thái trống
                    if (bk.recordset.length > 0) {
                        const { court_id, booking_date, start_time, end_time } = bk.recordset[0];
                        await pool.request()
                            .input('court_id', sql.Int, court_id)
                            .input('slot_date', sql.Date, booking_date)
                            .input('start_time', sql.NVarChar, start_time)
                            .input('end_time', sql.NVarChar, end_time)
                            .query(`
                                UPDATE court_slots SET is_available = 1
                                WHERE court_id  = @court_id
                                  AND slot_date = @slot_date
                                  AND start_time >= CAST(@start_time AS TIME)
                                  AND end_time   <= CAST(@end_time   AS TIME)
                            `);
                    }
                }

                console.log(`PayOS Cancel Return: Payment ${orderCode} cancelled`);
            }
        }
    } catch (err: any) {
        console.error('PayOS Cancel Return Error:', err.message);
    }

    // Redirect về frontend dù có lỗi hay không
    res.redirect(`${FRONTEND_URL}/payment/cancel?orderCode=${orderCode || ''}`);
};

/**
 * 8️⃣ Cancel Payment by OrderCode (JSON response — called from frontend when timer expires)
 * Route: PATCH /api/payments/cancel-by-order?orderCode=xxx
 */
export const payosCancelByOrderCode = async (req: any, res: any) => {
    try {
        const { orderCode, newStatus } = req.query;
        if (!orderCode) return errorResponse(res, 'Thiếu orderCode');

        // Only allow safe status values from this endpoint
        const allowedStatuses = ['cancelled', 'expired'];
        const targetStatus: string = allowedStatuses.includes(newStatus as string)
            ? (newStatus as string)
            : 'cancelled';

        const pool = await poolPromise;
        const transactionPattern = `payos_${orderCode}_%`;

        const payment = await pool.request()
            .input('pattern', sql.NVarChar, transactionPattern)
            .query(`SELECT id, booking_id, status FROM payments WHERE transaction_id LIKE @pattern`);

        if (payment.recordset.length === 0) {
            return errorResponse(res, 'Không tìm thấy giao dịch');
        }

        const record = payment.recordset[0];
        if (record.status !== 'pending') {
            return successResponse(res, { status: record.status }, 'Giao dịch đã được xử lý');
        }

        await updatePaymentStatus(record.id, targetStatus);

        // Booking always goes to 'cancelled' regardless of payment expiry/cancel
        if (record.booking_id) {
            // Lấy thông tin booking để trả slot
            const bk = await pool.request()
                .input('id', sql.Int, record.booking_id)
                .query('SELECT court_id, booking_date, start_time, end_time FROM bookings WHERE id = @id AND status = \'pending\'');

            await pool.request()
                .input('id', sql.Int, record.booking_id)
                .query(`UPDATE bookings SET status = 'cancelled' WHERE id = @id AND status = 'pending'`);

            // Trả court_slots về trạng thái trống
            if (bk.recordset.length > 0) {
                const { court_id, booking_date, start_time, end_time } = bk.recordset[0];
                await pool.request()
                    .input('court_id', sql.Int, court_id)
                    .input('slot_date', sql.Date, booking_date)
                    .input('start_time', sql.NVarChar, start_time)
                    .input('end_time', sql.NVarChar, end_time)
                    .query(`
                        UPDATE court_slots SET is_available = 1
                        WHERE court_id  = @court_id
                          AND slot_date = @slot_date
                          AND start_time >= CAST(@start_time AS TIME)
                          AND end_time   <= CAST(@end_time   AS TIME)
                    `);
            }
        }

        return successResponse(res, { status: targetStatus }, `Đã cập nhật giao dịch: ${targetStatus}`);
    } catch (err: any) {
        return serverError(res, 'Lỗi server', err);
    }
};

/**
 * Auto-cancel expired payments (called by scheduled job in index.ts)
 * Cancels pending PayOS payments older than 15 minutes
 */
export const cancelExpiredPayments = async (): Promise<void> => {
    try {
        const pool = await poolPromise;

        // Cancel associated bookings first (while join is still valid)
        await pool.request().query(`
            UPDATE b SET b.status = 'cancelled'
            FROM bookings b
            INNER JOIN payments p ON p.booking_id = b.id
            WHERE p.status = 'pending'
              AND p.transaction_id LIKE 'payos_%'
              AND p.created_at < DATEADD(MINUTE, -15, GETDATE())
              AND b.status = 'pending'
        `);

        // Trả court_slots về trạng thái trống cho các booking hết hạn
        await pool.request().query(`
            UPDATE cs SET cs.is_available = 1
            FROM court_slots cs
            INNER JOIN bookings b
                ON  cs.court_id  = b.court_id
                AND cs.slot_date = b.booking_date
                AND cs.start_time >= b.start_time
                AND cs.end_time   <= b.end_time
            INNER JOIN payments p ON p.booking_id = b.id
            WHERE p.status = 'pending'
              AND p.transaction_id LIKE 'payos_%'
              AND p.created_at < DATEADD(MINUTE, -15, GETDATE())
              AND b.status = 'pending'
        `);

        // Mark expired payments as expired (not cancelled — user didn't cancel)
        const result = await pool.request().query(`
            UPDATE payments SET status = 'expired'
            WHERE status = 'pending'
              AND transaction_id LIKE 'payos_%'
              AND created_at < DATEADD(MINUTE, -15, GETDATE())
        `);

        const count = result.rowsAffected[0];
        if (count > 0) {
            console.log(`[Auto-expire] Đã hết hạn ${count} giao dịch`);
        }
    } catch (err: any) {
        console.error('[Auto-expire] Lỗi:', err.message);
    }
};

