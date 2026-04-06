import { sql, poolPromise } from '../config/db';
import dotenv from 'dotenv';
import { getHoursUntilStart, getScheduleConflictMessage, getUserScheduleConflict } from '../utils/matchLifecycle';
import { applyRefundFinancialReversal } from '../utils/refundFinancials';
dotenv.config();
const COMMISSION = parseFloat(process.env.COMMISSION_RATE) || 0.05;
const MIN_ADVANCE_HOURS = 1;

// ─── helpers ────────────────────────────────────────────────────────────────

const extractTimeH = (timeStr: any): number | null => {
    if (!timeStr) return null;
    const str = timeStr instanceof Date ? timeStr.toISOString() : String(timeStr);
    const match = str.match(/\d{2}:\d{2}/);
    if (!match) return null;
    const [h, m] = match[0].split(':').map(Number);
    return h + m / 60;
};

// ─── Create booking (với transaction + conflict check + cập nhật court_slots) ─

export const createBooking = async (req, res) => {
    try {
        const { court_id, booking_date, start_time, end_time, payment_method } = req.body;

        if (!court_id || !booking_date || !start_time || !end_time) {
            return res.status(400).json({ message: 'Thiếu thông tin đặt sân' });
        }

        const inputDate = new Date(booking_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 30);

        if (inputDate < today) {
            return res.status(400).json({ message: 'Không thể đặt sân trong quá khứ' });
        }

        if (inputDate > maxDate) {
            return res.status(400).json({ message: 'Chỉ có thể đặt sân tối đa 30 ngày kể từ hôm nay' });
        }

        if (getHoursUntilStart(booking_date, start_time) < MIN_ADVANCE_HOURS) {
            return res.status(400).json({ message: `Thời gian bắt đầu booking phải cách hiện tại ít nhất ${MIN_ADVANCE_HOURS} giờ` });
        }

        const pool = await poolPromise;
        const isPayOS = payment_method === 'payos';

        const scheduleConflict = await getUserScheduleConflict(
            pool,
            Number(req.user.id),
            booking_date,
            start_time,
            end_time,
            null,
            null,
            {
                includeBookingConflicts: false,
                includeMatchConflicts: true
            }
        );
        if (scheduleConflict) {
            return res.status(409).json({ message: getScheduleConflictMessage(scheduleConflict) });
        }

        // 1. Lấy thông tin sân
        const courtQuery = await pool.request()
            .input('id', sql.Int, court_id)
            .query('SELECT price_per_hour, peak_start_time, peak_end_time, peak_price FROM courts WHERE id = @id AND is_active = 1');
        if (courtQuery.recordset.length === 0)
            return res.status(404).json({ message: 'Sân không tồn tại' });

        const court = courtQuery.recordset[0];

        // 2. Tính giá
        const startH = parseFloat(start_time.split(':')[0]) + parseFloat(start_time.split(':')[1]) / 60;
        const endH = parseFloat(end_time.split(':')[0]) + parseFloat(end_time.split(':')[1]) / 60;
        if (endH <= startH) {
            return res.status(400).json({ message: 'Giờ kết thúc phải sau giờ bắt đầu' });
        }
        const peakStartH = extractTimeH(court.peak_start_time);
        const peakEndH = extractTimeH(court.peak_end_time);

        let peakHours = 0;
        if (court.peak_price && peakStartH !== null && peakEndH !== null) {
            const overlapStart = Math.max(startH, peakStartH);
            const overlapEnd = Math.min(endH, peakEndH);
            if (overlapStart < overlapEnd) peakHours = overlapEnd - overlapStart;
        }

        const regularHours = (endH - startH) - peakHours;
        const total = Math.round(regularHours * court.price_per_hour + peakHours * (court.peak_price || court.price_per_hour));
        const commission = Math.round(total * COMMISSION);
        const bookingStatus = isPayOS ? 'payment_pending' : 'confirmed';

        // 3. Transaction + lock để chống race condition
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Kiểm tra xung đột (UPDLOCK + HOLDLOCK ngăn concurrent read)
            const conflictCheck = await transaction.request()
                .input('court_id', sql.Int, court_id)
                .input('booking_date', sql.Date, booking_date)
                .input('start_time', sql.NVarChar, start_time)
                .input('end_time', sql.NVarChar, end_time)
                .query(`
                    SELECT COUNT(*) AS cnt
                    FROM bookings WITH (UPDLOCK, HOLDLOCK)
                    WHERE court_id     = @court_id
                      AND booking_date = @booking_date
                        AND status IN ('confirmed', 'pending', 'payment_pending')
                      AND start_time   < @end_time
                      AND end_time     > @start_time
                `);

            if (conflictCheck.recordset[0].cnt > 0) {
                await transaction.rollback();
                return res.status(409).json({
                    error: 'SLOT_CONFLICT',
                    message: 'Khung giờ này đã được đặt, vui lòng chọn giờ khác'
                });
            }

            // Insert booking
            const result = await transaction.request()
                .input('user_id', sql.Int, req.user.id)
                .input('court_id', sql.Int, court_id)
                .input('booking_date', sql.Date, booking_date)
                .input('start_time', sql.NVarChar, start_time)
                .input('end_time', sql.NVarChar, end_time)
                .input('total_price', sql.Decimal(12, 2), total)
                .input('commission_rate', sql.Decimal(4, 2), COMMISSION)
                .input('commission_amount', sql.Decimal(12, 2), commission)
                .input('payment_method', sql.NVarChar, payment_method || 'mock')
                .input('status', sql.NVarChar, bookingStatus)
                .query(`
                    INSERT INTO bookings
                        (user_id, court_id, booking_date, start_time, end_time,
                         total_price, commission_rate, commission_amount, payment_method, status)
                    VALUES
                        (@user_id, @court_id, @booking_date, @start_time, @end_time,
                         @total_price, @commission_rate, @commission_amount, @payment_method, @status);
                    SELECT SCOPE_IDENTITY() AS id;
                `);

            const bookingId = result.recordset[0].id;

            // Nếu thanh toán mock → tạo payment ngay
            if (!isPayOS) {
                await transaction.request()
                    .input('user_id', sql.Int, req.user.id)
                    .input('booking_id', sql.Int, bookingId)
                    .input('amount', sql.Decimal(12, 2), total)
                    .input('commission', sql.Decimal(12, 2), commission)
                    .input('payment_method', sql.NVarChar, payment_method || 'mock')
                    .query(`
                        INSERT INTO payments (user_id, booking_id, amount, commission, payment_context, payment_method, status)
                        VALUES (@user_id, @booking_id, @amount, @commission, 'booking', @payment_method, 'completed')
                    `);
            }

            await transaction.commit();
            res.status(201).json({ message: 'Đặt sân thành công', bookingId, total });

        } catch (innerErr) {
            await transaction.rollback();
            throw innerErr;
        }
    } catch (err) {
        console.error('LỖI TẠO BOOKING:', err);
        res.status(500).json({ message: 'Lỗi server', error: err.message });
    }
};

// ─── Get user bookings (tất cả trạng thái) ──────────────────────────────────

export const getMyBookings = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .query(`
                SELECT
                    b.id,
                    b.court_id,
                    b.booking_date,
                    CONVERT(NVARCHAR(8), b.start_time, 108) AS start_time,
                    CONVERT(NVARCHAR(8), b.end_time,   108) AS end_time,
                    b.total_price,
                    b.commission_rate,
                    b.commission_amount,
                    LTRIM(RTRIM(LOWER(b.status))) AS status,
                    b.payment_method,
                    b.created_at,
                    c.name        AS court_name,
                    f.name        AS facility_name,
                    f.address
                FROM bookings b
                LEFT JOIN courts     c ON b.court_id     = c.id
                LEFT JOIN facilities f ON c.facility_id  = f.id
                WHERE b.user_id = @user_id
                ORDER BY b.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── Get owner bookings ──────────────────────────────────────────────────────

export const getOwnerBookings = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('owner_id', sql.Int, req.user.id)
            .query(`
                SELECT
                    b.id,
                    b.booking_date,
                    CONVERT(NVARCHAR(8), b.start_time, 108) AS start_time,
                    CONVERT(NVARCHAR(8), b.end_time,   108) AS end_time,
                    b.total_price,
                    LTRIM(RTRIM(LOWER(b.status))) AS status,
                    b.payment_method,
                    b.created_at,
                    c.name        AS court_name,
                    u.full_name   AS user_name,
                    u.phone       AS user_phone
                FROM bookings b
                JOIN courts     c ON b.court_id     = c.id
                JOIN facilities f ON c.facility_id  = f.id
                JOIN users      u ON b.user_id      = u.id
                WHERE f.owner_id = @owner_id
                ORDER BY b.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── Cancel booking (+ trả slot về is_available = 1) ────────────────────────

export const cancelBooking = async (req, res) => {
    try {
        const pool = await poolPromise;
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // UPDLOCK to prevent race condition
            const checkQuery = await transaction.request()
                .input('id', sql.Int, req.params.id)
                .query(`
                    SELECT b.user_id, b.court_id, b.booking_date, b.start_time, b.end_time, b.status, b.total_price, c.name as court_name
                    FROM bookings b WITH (UPDLOCK) 
                    JOIN courts c ON b.court_id = c.id
                    WHERE b.id = @id
                `);

            if (checkQuery.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy booking' });
            }

            const b = checkQuery.recordset[0];
            if (b.user_id !== req.user.id) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Không có quyền' });
            }
            if (b.status === 'cancelled' || b.status === 'expired' || b.status === 'transferred') {
                await transaction.rollback();
                return res.status(400).json({ message: 'Booking này đã không còn khả dụng để hủy' });
            }
            if (b.status !== 'pending' && b.status !== 'confirmed') {
                await transaction.rollback();
                return res.status(400).json({ message: 'Trạng thái hiện tại không thể hủy' });
            }

            // Múi giờ máy chủ và Database có thể cần khớp, lấy từ CSDL cho an toàn
            const matchDate = new Date(b.booking_date);
            let startH = 0, startM = 0;

            if (typeof b.start_time === 'string') {
                startH = parseInt(b.start_time.substring(0, 2), 10);
                startM = parseInt(b.start_time.substring(3, 5), 10);
            } else if (b.start_time instanceof Date) {
                // SQL Server TIME type via mssql often returns a Date object
                startH = b.start_time.getUTCHours();
                startM = b.start_time.getUTCMinutes();
            }

            matchDate.setHours(startH, startM, 0, 0);

            const now = new Date();
            const diffMs = matchDate.getTime() - now.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            let paymentStatusQuery = '';
            let refundPercent = 0;
            let refundAmount = 0;

            if (b.status === 'pending') {
                // Hủy trực tiếp, không hoàn tiền, payment = cancelled
                paymentStatusQuery = "UPDATE payments SET status = 'cancelled' WHERE booking_id = @id";
            } else if (b.status === 'confirmed') {
                if (diffHours > 4) {
                    paymentStatusQuery = "UPDATE payments SET status = 'refunded', refunded_amount = amount WHERE booking_id = @id AND status = 'completed'";
                    refundPercent = 100;
                    refundAmount = b.total_price;
                } else {
                    // <= 4 hours: không cập nhật payment (giữ 'completed'), mất tiền
                    paymentStatusQuery = "";
                }
            }

            await transaction.request()
                .input('id', sql.Int, req.params.id)
                .query("UPDATE bookings SET status = 'cancelled' WHERE id = @id");

            if (paymentStatusQuery) {
                await transaction.request()
                    .input('id', sql.Int, req.params.id)
                    .query(paymentStatusQuery);
            }

            if (refundPercent === 100 && refundAmount > 0) {
                // Add amount to user's wallet
                await transaction.request()
                    .input('user_id', sql.Int, b.user_id)
                    .input('amount', sql.Decimal(12, 2), refundAmount)
                    .query("UPDATE users SET balance = ISNULL(balance, 0) + @amount WHERE id = @user_id");

                // Log wallet transaction
                await transaction.request()
                    .input('user_id', sql.Int, b.user_id)
                    .input('amount', sql.Decimal(12, 2), refundAmount)
                    .input('desc', sql.NVarChar, `Hoàn tiền hủy sân ${b.court_name}`)
                    .query(`
                        INSERT INTO wallet_transactions (user_id, amount, type, description, status)
                        VALUES (@user_id, @amount, 'refund', @desc, 'completed')
                    `);

                const refundedPayments = await transaction.request()
                    .input('booking_id', sql.Int, req.params.id)
                    .query(`
                        SELECT id AS payment_id, ISNULL(refunded_amount, 0) AS refunded_amount
                        FROM payments
                        WHERE booking_id = @booking_id
                          AND status = 'refunded'
                          AND ISNULL(refunded_amount, 0) > 0
                    `);

                for (const row of refundedPayments.recordset) {
                    await applyRefundFinancialReversal(transaction, {
                        paymentId: Number(row.payment_id),
                        refundAmount: Number(row.refunded_amount),
                        note: 'Booking cancellation refund'
                    });
                }
            }

            await transaction.request()
                .input('id', sql.Int, req.params.id)
                .input('refund_percent', sql.Int, refundPercent)
                .input('refund_amount', sql.Decimal(12, 2), refundAmount)
                .query(`
                    INSERT INTO booking_cancellations (booking_id, refund_percent, refund_amount)
                    VALUES (@id, @refund_percent, @refund_amount)
                `);

            const formatTimeStr = (t) => {
                if (typeof t === 'string') return t;
                if (t instanceof Date) return `${t.getUTCHours().toString().padStart(2, '0')}:${t.getUTCMinutes().toString().padStart(2, '0')}:00`;
                return String(t);
            };

            await transaction.request()
                .input('court_id', sql.Int, b.court_id)
                .input('date', sql.Date, b.booking_date)
                .input('startT', sql.NVarChar, formatTimeStr(b.start_time))
                .input('endT', sql.NVarChar, formatTimeStr(b.end_time))
                .query(`
                    UPDATE court_slots
                    SET is_available = 1
                    WHERE court_id = @court_id
                      AND slot_date = @date
                      AND start_time >= @startT
                      AND start_time < @endT
                `);

            await transaction.commit();
            res.json({ message: 'Đã hủy booking thành công', isRefundable: refundPercent > 0 });

        } catch (innerErr) {
            await transaction.rollback();
            throw innerErr;
        }

    } catch (err) {
        console.error('Lỗi khi hủy booking:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── Get booked slots (từ bookings, dùng cho lưới slot) ─────────────────────

export const getBookedSlots = async (req, res) => {
    try {
        const { courtId, date } = req.params;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('court_id', sql.Int, courtId)
            .input('booking_date', sql.Date, date)
            .query(`
                SELECT
                    CONVERT(NVARCHAR(5), start_time, 108) AS start_time,
                    CONVERT(NVARCHAR(5), end_time,   108) AS end_time
                FROM bookings
                WHERE court_id     = @court_id
                  AND booking_date = @booking_date
                  AND status IN ('confirmed', 'pending', 'payment_pending')
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Lỗi lấy booked slots:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
