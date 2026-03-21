import { sql, poolPromise } from '../config/db';
import crypto from 'crypto';
import axios from 'axios';
import dotenv from 'dotenv';
import { successResponse, errorResponse, serverError, webhookResponse } from '../utils/response';
import { createNotification } from './notification.controller';
import { getIO } from '../socket/index';

dotenv.config();

// ===== PayOS Configuration =====
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;
const PAYOS_API_URL = process.env.PAYOS_API_URL;
const PAYOS_RETURN_URL = process.env.PAYOS_RETURN_URL;
const PAYOS_CANCEL_URL = process.env.PAYOS_CANCEL_URL;

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
 * Tạo description theo loại giao dịch để dễ phân biệt trên sao kê
 * Ví dụ: BK0012A8F4 / MT0034Z1K9
 */
export const generatePaymentDescription = (type: 'booking' | 'match', refId: number): string => {
    const prefix = type === 'booking' ? 'BK' : 'MT';
    const ref = String(refId).padStart(4, '0').slice(-4);
    const randomSuffix = generateRandomDescription().slice(0, 4).toUpperCase();
    return `${prefix}${ref}${randomSuffix}`;
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
        .filter(key => obj[key] !== undefined)
        .map(key => {
            const value = obj[key];
            // null values must be serialised as empty string to match PayOS backend
            return `${key}=${value === null ? '' : value}`;
        })
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

const toValidInt = (value: any): number | null => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const recalcMatchStatus = async (matchId: number): Promise<void> => {
    const pool = await poolPromise;

    const summary = await pool.request()
        .input('match_id', sql.Int, matchId)
        .query(`
            SELECT
                m.max_players,
                m.status,
                SUM(CASE WHEN mp.status = 'joined' THEN 1 ELSE 0 END) AS joined_count,
                SUM(CASE WHEN mp.status = 'joined' AND mp.payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_joined_count
            FROM matches m
            LEFT JOIN match_players mp ON mp.match_id = m.id
            WHERE m.id = @match_id
            GROUP BY m.max_players, m.status
        `);

    if (summary.recordset.length === 0) return;

    const row = summary.recordset[0];
    const maxPlayers = Number(row.max_players) || 0;
    const joinedCount = Number(row.joined_count) || 0;
    const paidJoinedCount = Number(row.paid_joined_count) || 0;
    const currentStatus = String(row.status || '').toLowerCase();

    if (['completed', 'finished', 'cancelled'].includes(currentStatus)) return;

    let nextStatus = 'waiting';
    if (joinedCount >= maxPlayers && maxPlayers > 0) {
        nextStatus = paidJoinedCount >= maxPlayers ? 'confirmed' : 'full';
    }

    await pool.request()
        .input('id', sql.Int, matchId)
        .input('current_players', sql.Int, joinedCount)
        .input('status', sql.NVarChar, nextStatus)
        .query(`
            UPDATE matches
            SET current_players = @current_players,
                status = @status
            WHERE id = @id AND status NOT IN ('completed', 'finished', 'cancelled')
        `);
};

const syncMatchPaymentState = async (paymentRecord: any, nextPaymentStatus: string): Promise<void> => {
    const matchId = toValidInt(paymentRecord?.match_id);
    const userId = toValidInt(paymentRecord?.user_id);
    if (!matchId || !userId) return;

    const pool = await poolPromise;

    if (nextPaymentStatus === 'completed') {
        await pool.request()
            .input('match_id', sql.Int, matchId)
            .input('user_id', sql.Int, userId)
            .query(`
                UPDATE match_players
                SET payment_status = 'paid'
                WHERE match_id = @match_id
                  AND user_id = @user_id
                  AND status = 'joined'
            `);
    } else if (['failed', 'cancelled', 'expired'].includes(nextPaymentStatus)) {
        await pool.request()
            .input('match_id', sql.Int, matchId)
            .input('user_id', sql.Int, userId)
            .query(`
                UPDATE match_players
                SET payment_status = 'pending'
                WHERE match_id = @match_id
                  AND user_id = @user_id
                  AND status = 'joined'
            `);
    }

    await recalcMatchStatus(matchId);
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
                SELECT p.*, b.booking_date, c.name AS court_name, m.match_date,
                       CASE
                           WHEN p.match_id IS NOT NULL THEN 'match'
                           WHEN p.booking_id IS NOT NULL THEN 'booking'
                           ELSE 'other'
                       END AS transaction_type,
                       mp.payment_status AS match_player_payment_status
                FROM payments p
                LEFT JOIN bookings b ON p.booking_id = b.id
                LEFT JOIN matches m ON p.match_id = m.id
                LEFT JOIN match_players mp ON mp.match_id = p.match_id AND mp.user_id = p.user_id
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
        let paymentDescription = '';
        const bookingId = booking_id ? Number(booking_id) : null;
        const matchId = match_id ? Number(match_id) : null;

        // Kiểm tra booking hoặc match
        let amount = 0;
        if (bookingId) {
            const booking = await pool.request()
            .input('id', sql.Int, bookingId)
                .query('SELECT user_id, total_price FROM bookings WHERE id = @id');

            if (booking.recordset.length === 0) {
                return res.status(404).json({ message: 'Booking không tồn tại' });
            }

            if (booking.recordset[0].user_id !== req.user.id) {
                return res.status(403).json({ message: 'Không có quyền' });
            }

            amount = booking.recordset[0].total_price;
            paymentDescription = generatePaymentDescription('booking', bookingId);
        } else if (matchId) {
            // Handle match payment
            const match = await pool.request()
                .input('id', sql.Int, matchId)
                .query('SELECT total_cost, max_players FROM matches WHERE id = @id');

            if (match.recordset.length === 0) {
                return res.status(404).json({ message: 'Match không tồn tại' });
            }

            const { total_cost, max_players } = match.recordset[0];
            amount = total_cost / (max_players || 4); // Chia theo số người chơi thực tế
            paymentDescription = generatePaymentDescription('match', matchId);
        } else {
            return res.status(400).json({ message: 'Cần booking_id hoặc match_id' });
        }

        // Sinh order code
        const orderCode = generateOrderCode();

        // Prepare PayOS params
        const payosData = {
            orderCode,
            amount: Math.round(amount),
            description: paymentDescription || generateRandomDescription(),
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

        if (payosResponse.data.code !== '00') {
            return errorResponse(res, 'Không thể tạo link thanh toán', payosResponse.data.desc);
        }

        const paymentData = payosResponse.data.data;

        // Lưu payment record
        const paymentId = await insertPayment(
            req.user.id,
            bookingId,
            matchId,
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

        // Verify signature
        if (data?.orderCode) {
                const sorted = sortParams(data);
                const queryString = createQueryString(sorted);
                const expectedSignature = calculatePayOSSignature(queryString, PAYOS_CHECKSUM_KEY);

                if (signature !== expectedSignature) {
                    // Fallback: try with null → "null" (older PayOS SDK behaviour)
                    const queryStringAlt = Object.keys(sorted)
                        .filter(key => sorted[key] !== undefined)
                        .map(key => `${key}=${sorted[key]}`)
                        .join('&');
                    const altSignature = calculatePayOSSignature(queryStringAlt, PAYOS_CHECKSUM_KEY);

                    if (signature !== altSignature) {
                        console.error('PayOS Webhook: Invalid signature (both strategies failed)', {
                            orderCode: data.orderCode,
                            receivedSigPrefix: String(signature || '').slice(0, 8),
                            expectedSigPrefix: String(expectedSignature || '').slice(0, 8),
                            altSigPrefix: String(altSignature || '').slice(0, 8),
                            checksumKeyLength: String(PAYOS_CHECKSUM_KEY || '').length
                        });
                        return res.status(400).json({
                            code: '97',
                            message: 'Invalid signature'
                        });
                    }
                }
        }

        const pool = await poolPromise;

        // Ưu tiên tìm theo paymentLinkId (chính xác nhất), fallback qua orderCode.
        let paymentRecord: any = null;

        if (data?.paymentLinkId) {
            const byLink = await pool.request()
                .input('transaction_suffix', sql.NVarChar, `%_${data.paymentLinkId}`)
                .query(`
                    SELECT TOP 1 p.*
                    FROM payments p
                    WHERE p.transaction_id LIKE @transaction_suffix
                    ORDER BY p.created_at DESC
                `);
            paymentRecord = byLink.recordset[0] || null;
        }

        if (!paymentRecord && data?.orderCode) {
            const transactionPattern = `payos_${data.orderCode}_%`;
            const byOrderCode = await pool.request()
                .input('transaction_pattern', sql.NVarChar, transactionPattern)
                .query(`
                    SELECT TOP 1 p.*
                    FROM payments p
                    WHERE p.transaction_id LIKE @transaction_pattern
                    ORDER BY p.created_at DESC
                `);
            paymentRecord = byOrderCode.recordset[0] || null;
        }

        if (!paymentRecord) {
            return webhookResponse(res);
        }

        if (paymentRecord.status !== 'pending') {
            return webhookResponse(res);
        }

        const isSuccess =
            success === true ||
            success === 'true' ||
            String(code || data?.code || '').toUpperCase() === '00';

        const bookingId = toValidInt(paymentRecord.booking_id);
        const matchId = toValidInt(paymentRecord.match_id);

        if (isSuccess) {
            await updatePaymentStatus(paymentRecord.id, 'completed');

            if (bookingId) {
                await pool.request()
                    .input('booking_id', sql.Int, bookingId)
                    .query(`
                        UPDATE bookings
                        SET status = 'confirmed'
                        WHERE id = @booking_id AND status = 'pending'
                    `);
                
                // Notify user about booking confirmation
                const bookingData = await pool.request()
                    .input('id', sql.Int, bookingId)
                    .query('SELECT c.name, b.booking_date, CONVERT(VARCHAR(5), b.start_time, 108) AS start_time, f.owner_id, u.full_name FROM bookings b JOIN courts c ON b.court_id = c.id JOIN facilities f ON c.facility_id = f.id JOIN users u ON b.user_id = u.id WHERE b.id = @id');
                
                if (bookingData.recordset.length > 0) {
                    const { name, booking_date, start_time, owner_id, full_name } = bookingData.recordset[0];
                    
                    // Notify player
                    await createNotification(
                        paymentRecord.user_id,
                        '✅ Đặt sân thành công',
                        `Đã xác nhận đơn đặt sân "${name}" ngày ${booking_date} lúc ${start_time}`,
                        'booking_confirmed',
                        bookingId
                    );
                    try { getIO()?.to(`user_${paymentRecord.user_id}`).emit('new_notification'); } catch { }
                    
                    // Notify court owner about booking payment
                    if (owner_id !== paymentRecord.user_id) {
                        await createNotification(
                            owner_id,
                            '💵 Có thanh toán đặt sân',
                            `${full_name} thanh toán cho "${name}" - ${booking_date} lúc ${start_time}`,
                            'booking_payment',
                            bookingId
                        );
                        try { getIO()?.to(`user_${owner_id}`).emit('new_notification'); } catch { }
                    }
                }
            } else if (paymentRecord.booking_id !== null && paymentRecord.booking_id !== undefined) {
                console.warn('PayOS Webhook: skip booking sync due to invalid booking_id', {
                    paymentId: paymentRecord.id,
                    rawBookingId: paymentRecord.booking_id
                });
            }

            if (matchId) {
                // Notify user about match payment confirmation
                const matchData = await pool.request()
                    .input('id', sql.Int, matchId)
                    .query('SELECT c.name, m.match_date, CONVERT(VARCHAR(5), m.start_time, 108) AS start_time, f.owner_id, u.full_name FROM matches m JOIN courts c ON m.court_id = c.id JOIN facilities f ON c.facility_id = f.id JOIN users u ON m.creator_id = u.id WHERE m.id = @id');
                
                if (matchData.recordset.length > 0) {
                    const { name, match_date, start_time, owner_id, full_name } = matchData.recordset[0];
                    
                    // Notify match participant
                    await createNotification(
                        paymentRecord.user_id,
                        '✅ Thanh toán ghép trận thành công',
                        `Chỉ số chuyến "${name}" ngày ${match_date} lúc ${start_time} - Sẵn sàng chơi!`,
                        'match_payment_confirmed',
                        matchId
                    );
                    try { getIO()?.to(`user_${paymentRecord.user_id}`).emit('new_notification'); } catch { }
                    
                    // Notify court owner about match payment
                    if (owner_id !== paymentRecord.user_id) {
                        const playerName = paymentRecord.user_id === full_name ? 'Host' : (await pool.request()
                            .input('id', sql.Int, paymentRecord.user_id)
                            .query('SELECT full_name FROM users WHERE id = @id')).recordset[0]?.full_name || 'Player';
                        
                        await createNotification(
                            owner_id,
                            '💰 Có thanh toán ghép trận',
                            `Trận tại "${name}" - Ngày ${match_date} lúc ${start_time} (${playerName} thanh toán)`,
                            'match_payment_owner',
                            matchId
                        );
                        try { getIO()?.to(`user_${owner_id}`).emit('new_notification'); } catch { }
                    }
                }
            }

            await syncMatchPaymentState(paymentRecord, 'completed');
        } else {
            await updatePaymentStatus(paymentRecord.id, 'failed');

            if (bookingId) {
                await pool.request()
                    .input('booking_id', sql.Int, bookingId)
                    .query(`
                        UPDATE bookings
                        SET status = 'cancelled'
                        WHERE id = @booking_id AND status = 'pending'
                    `);
            } else if (paymentRecord.booking_id !== null && paymentRecord.booking_id !== undefined) {
                console.warn('PayOS Webhook: skip booking cancel sync due to invalid booking_id', {
                    paymentId: paymentRecord.id,
                    rawBookingId: paymentRecord.booking_id
                });
            }

            await syncMatchPaymentState(paymentRecord, 'failed');
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

        const latest = await pool.request()
            .input('transaction_pattern', sql.NVarChar, transactionPattern)
            .query('SELECT TOP 1 status FROM payments WHERE transaction_id LIKE @transaction_pattern ORDER BY created_at DESC');

        const latestStatus = latest.recordset[0]?.status || payment.recordset[0].status;

        return successResponse(res, {
            status: latestStatus
        }, latestStatus === 'completed' ?
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
        const latest = await pool.request()
            .input('transaction_pattern', sql.NVarChar, transactionPattern)
            .query(`
                SELECT TOP 1 id, user_id, booking_id, match_id, status, amount
                FROM payments
                WHERE transaction_id LIKE @transaction_pattern
                ORDER BY created_at DESC
            `);

        if (latest.recordset.length === 0) {
            return errorResponse(res, 'Thanh toán không tìm thấy', undefined, 404);
        }

        const payment = latest.recordset[0];
        if (['completed', 'failed', 'cancelled', 'expired'].includes(String(payment.status || '').toLowerCase())) {
            await syncMatchPaymentState(payment, String(payment.status || '').toLowerCase());
        }

        return successResponse(res, {
            status: payment.status,
            amount: payment.amount
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

        // Update payment status + sync booking/match state
        const pool = await poolPromise;
        const payment = await pool.request()
            .input('transaction_id', sql.NVarChar, `payos_%${paymentLinkId}`)
            .query(`
                SELECT TOP 1 id, user_id, booking_id, match_id, status
                FROM payments
                WHERE transaction_id LIKE @transaction_id
                ORDER BY created_at DESC
            `);

        if (payment.recordset.length > 0) {
            const record = payment.recordset[0];

            if (record.status === 'pending') {
                await updatePaymentStatus(record.id, 'cancelled');
            }

            if (record.booking_id) {
                await pool.request()
                    .input('id', sql.Int, record.booking_id)
                    .query(`UPDATE bookings SET status = 'cancelled' WHERE id = @id AND status = 'pending'`);
            }

            await syncMatchPaymentState(record, 'cancelled');
        }

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

            // Tìm và cập nhật payment + booking/match thành cancelled
            const payment = await pool.request()
                .input('transaction_pattern', sql.NVarChar, transactionPattern)
                .query(`
                    SELECT TOP 1 id, booking_id, match_id, user_id
                    FROM payments
                    WHERE transaction_id LIKE @transaction_pattern AND status = 'pending'
                    ORDER BY created_at DESC
                `);

            if (payment.recordset.length > 0) {
                const record = payment.recordset[0];

                await updatePaymentStatus(record.id, 'cancelled');

                if (record.booking_id) {
                    const bk = await pool.request()
                        .input('id', sql.Int, record.booking_id)
                        .query(`
                            SELECT court_id, booking_date, start_time, end_time
                            FROM bookings
                            WHERE id = @id AND status = 'pending'
                        `);

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

                await syncMatchPaymentState(record, 'cancelled');
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
            .query(`
                SELECT TOP 1 id, booking_id, match_id, user_id, status
                FROM payments
                WHERE transaction_id LIKE @pattern
                ORDER BY created_at DESC
            `);

        if (payment.recordset.length === 0) {
            return errorResponse(res, 'Không tìm thấy giao dịch');
        }

        const record = payment.recordset[0];
        if (record.status !== 'pending') {
            return successResponse(res, { status: record.status }, 'Giao dịch đã được xử lý');
        }

        await updatePaymentStatus(record.id, targetStatus);

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

        await syncMatchPaymentState(record, targetStatus);

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

        const expiredPayments = await pool.request().query(`
            SELECT id, user_id, booking_id, match_id
            FROM payments
            WHERE status = 'pending'
              AND transaction_id LIKE 'payos_%'
              AND created_at < DATEADD(MINUTE, -15, GETDATE())
        `);

        // Mark expired payments as expired (not cancelled — user didn't cancel)
        const result = await pool.request().query(`
            UPDATE payments SET status = 'expired'
            WHERE status = 'pending'
              AND transaction_id LIKE 'payos_%'
              AND created_at < DATEADD(MINUTE, -15, GETDATE())
        `);

        for (const record of expiredPayments.recordset) {
            await syncMatchPaymentState(record, 'expired');
        }

        const count = result.rowsAffected[0];
        if (count > 0) {
            // intentionally no info log
        }
    } catch (err: any) {
        console.error('[Auto-expire] Lỗi:', err.message);
    }
};

