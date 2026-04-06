import { sql, poolPromise } from '../config/db';
import dotenv from 'dotenv';
dotenv.config();

// Helpers
const addNotification = async (transactionOrPool, userId, title, message, type, referenceId) => {
    await transactionOrPool.request()
        .input('notif_user_id', sql.Int, userId)
        .input('notif_title', sql.NVarChar, title)
        .input('notif_message', sql.NVarChar, message)
        .input('notif_type', sql.NVarChar, type)
        .input('notif_ref_id', sql.Int, referenceId)
        .query(`
            INSERT INTO notifications (user_id, title, message, type, reference_id)
            VALUES (@notif_user_id, @notif_title, @notif_message, @notif_type, @notif_ref_id)
        `);
};

// ─── 1. Request Transfer ───────────────────────────────────────────────────
export const requestTransfer = async (req, res) => {
    try {
        const { bookingId, receiverEmail } = req.body;
        const senderId = req.user.id;

        if (!bookingId || !receiverEmail) {
            return res.status(400).json({ message: 'Thiếu thông tin chuyển nhượng' });
        }

        const pool = await poolPromise;
        
        // Find receiver
        const receiverQuery = await pool.request()
            .input('email', sql.NVarChar, receiverEmail)
            .query('SELECT id, full_name FROM users WHERE email = @email');

        if (receiverQuery.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng nhận' });
        }

        const receiver = receiverQuery.recordset[0];
        if (receiver.id === senderId) {
            return res.status(400).json({ message: 'Không thể chuyển sân cho chính mình' });
        }

        // Validate booking
        const bookingQuery = await pool.request()
            .input('id', sql.Int, bookingId)
            .query(`
                SELECT b.user_id, b.status, b.booking_date, b.start_time, c.name as court_name
                FROM bookings b
                JOIN courts c ON b.court_id = c.id
                WHERE b.id = @id
            `);

        if (bookingQuery.recordset.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy lượt đặt sân' });
        }

        const booking = bookingQuery.recordset[0];

        if (booking.user_id !== senderId) {
            return res.status(403).json({ message: 'Bạn không có quyền chuyển nhượng sân này' });
        }

        if (booking.status !== 'confirmed') {
            return res.status(400).json({ message: 'Chỉ có thể chuyển sân khi trạng thái là Đã Xác Nhận (Confirmed)' });
        }

        // Time validation (must be > 2 hours)
        const matchDate = new Date(booking.booking_date);
        let startH = 0, startM = 0;
        if (typeof booking.start_time === 'string') {
            startH = parseInt(booking.start_time.substring(0, 2), 10);
            startM = parseInt(booking.start_time.substring(3, 5), 10);
        } else if (booking.start_time instanceof Date) {
            startH = booking.start_time.getUTCHours();
            startM = booking.start_time.getUTCMinutes();
        }
        matchDate.setHours(startH, startM, 0, 0);

        const now = new Date();
        const diffHours = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (diffHours <= 2) {
            return res.status(400).json({ message: 'Chỉ có thể chuyển sân trước giờ đá ít nhất 2 tiếng' });
        }

        // Default constraints caught by DB, but we check manually too
        const pendingQuery = await pool.request()
            .input('booking_id', sql.Int, bookingId)
            .query("SELECT id FROM booking_transfers WHERE booking_id = @booking_id AND status = 'pending'");

        if (pendingQuery.recordset.length > 0) {
            return res.status(400).json({ message: 'Sân này đang có một lời mời chuyển nhượng chờ xử lý' });
        }

        // Expires in 15 minutes
        const expiresAt = new Date(now.getTime() + 15 * 60000);

        const transaction = pool.transaction();
        await transaction.begin();

        try {
            const insertQuery = await transaction.request()
                .input('booking_id', sql.Int, bookingId)
                .input('sender_id', sql.Int, senderId)
                .input('receiver_id', sql.Int, receiver.id)
                .input('expires_at', sql.DateTimeOffset, expiresAt)
                .query(`
                    INSERT INTO booking_transfers (booking_id, sender_id, receiver_id, status, expires_at)
                    OUTPUT INSERTED.id
                    VALUES (@booking_id, @sender_id, @receiver_id, 'pending', @expires_at)
                `);

            const transferId = insertQuery.recordset[0].id;

            // Notify Receiver
            await addNotification(
                transaction, 
                receiver.id, 
                'Lời mời nhận sân', 
                `Bạn có một lời mời nhận sân ${booking.court_name}. Lời mời sẽ hết hạn sau 15 phút.`, 
                'transfer_request', 
                transferId
            );

            await transaction.commit();
            res.status(201).json({ message: 'Đã gửi lời mời chuyển nhượng sân' });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        console.error('Lỗi yêu cầu chuyển nhượng:', err);
        if (err.message && err.message.includes('unique_pending_transfer')) {
            return res.status(400).json({ message: 'Lượt đặt này đang có lời mời chờ xử lý' });
        }
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── 2. Accept Transfer (Atomic Transaction) ───────────────────────────────
export const acceptTransfer = async (req, res) => {
    try {
        const transferId = req.params.id;
        const receiverId = req.user.id;

        const pool = await poolPromise;
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            // Read and Lock Transfer Row
            const transferQuery = await transaction.request()
                .input('id', sql.Int, transferId)
                .query(`
                    SELECT * FROM booking_transfers WITH (UPDLOCK, ROWLOCK)
                    WHERE id = @id
                `);

            if (transferQuery.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Không tìm thấy giao dịch chuyển nhượng này' });
            }

            const transfer = transferQuery.recordset[0];

            if (transfer.receiver_id !== receiverId) {
                await transaction.rollback();
                return res.status(403).json({ message: 'Bạn không có quyền nhận sân này' });
            }

            if (transfer.status !== 'pending') {
                await transaction.rollback();
                return res.status(400).json({ message: 'Lời mời này không ở trạng thái chờ xử lý' });
            }

            const now = new Date();
            const expiresAt = new Date(transfer.expires_at);
            
            if (now > expiresAt) {
                // Lời mời hết hạn, update db cho sạch
                await transaction.request()
                    .input('id', sql.Int, transferId)
                    .query("UPDATE booking_transfers SET status = 'expired' WHERE id = @id");
                
                await transaction.rollback();
                return res.status(400).json({ message: 'Lời mời chuyển nhượng đã hết hạn' });
            }

            // Read and Lock Booking Row
            const bookingQuery = await transaction.request()
                .input('booking_id', sql.Int, transfer.booking_id)
                .query(`
                    SELECT b.user_id, b.status, c.name as court_name FROM bookings b WITH (UPDLOCK, ROWLOCK)
                    JOIN courts c ON c.id = b.court_id
                    WHERE b.id = @booking_id
                `);

            if (bookingQuery.recordset.length === 0) {
                await transaction.rollback();
                return res.status(404).json({ message: 'Lượt đặt sân không tồn tại' });
            }

            const booking = bookingQuery.recordset[0];

            if (booking.status !== 'confirmed') {
                await transaction.rollback();
                return res.status(400).json({ message: 'Lượt đặt sân không còn hiệu lực để chuyển nhượng' });
            }

            // Execute Updates
            await transaction.request()
                .input('booking_id', sql.Int, transfer.booking_id)
                .input('receiver_id', sql.Int, receiverId)
                .input('sender_id', sql.Int, transfer.sender_id)
                .query(`
                    UPDATE bookings 
                    SET user_id = @receiver_id, is_transferred = 1, transferred_from_user_id = @sender_id
                    WHERE id = @booking_id
                `);

            await transaction.request()
                .input('id', sql.Int, transferId)
                .query(`
                    UPDATE booking_transfers 
                    SET status = 'accepted', updated_at = SYSDATETIMEOFFSET()
                    WHERE id = @id
                `);

            // Notifications
            await addNotification(
                transaction, 
                transfer.sender_id, 
                'Chuyển nhượng thành công', 
                `Lời mời chuyển nhượng sân ${booking.court_name} đã được chấp nhận.`, 
                'transfer_accepted', 
                transferId
            );

            await transaction.commit();
            res.json({ message: 'Đã nhận sân thành công!' });

        } catch (innerErr) {
            await transaction.rollback();
            throw innerErr;
        }

    } catch (err) {
        console.error('Lỗi nhận chuyển nhượng:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── 3. Reject Transfer ────────────────────────────────────────────────────
export const rejectTransfer = async (req, res) => {
    try {
        const transferId = req.params.id;
        const receiverId = req.user.id;

        const pool = await poolPromise;
        const transferQuery = await pool.request()
            .input('id', sql.Int, transferId)
            .query(`
                SELECT t.*, c.name as court_name 
                FROM booking_transfers t
                JOIN bookings b ON t.booking_id = b.id
                JOIN courts c ON b.court_id = c.id
                WHERE t.id = @id
            `);

        if (transferQuery.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy' });

        const transfer = transferQuery.recordset[0];

        if (transfer.receiver_id !== receiverId) return res.status(403).json({ message: 'Không có quyền' });
        if (transfer.status !== 'pending') return res.status(400).json({ message: 'Lời mời không khả dụng' });

        await pool.request()
            .input('id', sql.Int, transferId)
            .query("UPDATE booking_transfers SET status = 'rejected', updated_at = SYSDATETIMEOFFSET() WHERE id = @id");

        await addNotification(
            pool, 
            transfer.sender_id, 
            'Lời mời bị từ chối', 
            `Lời mời chuyển nhượng sân ${transfer.court_name} của bạn đã bị từ chối.`, 
            'transfer_rejected', 
            transferId
        );

        res.json({ message: 'Đã từ chối lời mời' });
    } catch (err) {
        console.error('Lỗi từ chối chuyển nhượng:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── 4. Cancel Transfer (Withdraw) ─────────────────────────────────────────
export const cancelTransfer = async (req, res) => {
    try {
        const transferId = req.params.id;
        const senderId = req.user.id;

        const pool = await poolPromise;
        const transferQuery = await pool.request()
            .input('id', sql.Int, transferId)
            .query(`
                SELECT t.*, c.name as court_name 
                FROM booking_transfers t
                JOIN bookings b ON t.booking_id = b.id
                JOIN courts c ON b.court_id = c.id
                WHERE t.id = @id
            `);

        if (transferQuery.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy' });

        const transfer = transferQuery.recordset[0];

        if (transfer.sender_id !== senderId) return res.status(403).json({ message: 'Không có quyền thu hồi' });
        if (transfer.status !== 'pending') return res.status(400).json({ message: 'Chỉ có thể thu hồi lời mời đang chờ xử lý' });

        await pool.request()
            .input('id', sql.Int, transferId)
            .query("UPDATE booking_transfers SET status = 'cancelled', updated_at = SYSDATETIMEOFFSET() WHERE id = @id");

        await addNotification(
            pool, 
            transfer.receiver_id, 
            'Lời mời đã bị thu hồi', 
            `Lời mời chuyển nhượng sân ${transfer.court_name} đã bị người gửi thu hồi.`, 
            'transfer_cancelled', 
            transferId
        );

        res.json({ message: 'Đã thu hồi lời mời thành công' });
    } catch (err) {
        console.error('Lỗi thu hồi chuyển nhượng:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// ─── 5. Get Transfers (Sync expired lazily first) ─────────────────────────
export const getMyTransfers = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = await poolPromise;

        // Lazy cleanup for expired ones before fetching
        await pool.request()
            .query(`
                UPDATE booking_transfers 
                SET status = 'expired' 
                WHERE status = 'pending' AND expires_at < SYSDATETIMEOFFSET()
            `);

        // Fetch sent requests
        const sentQuery = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`
                SELECT t.id, t.status, t.expires_at, t.created_at,
                       b.booking_date, b.start_time, b.end_time,
                       c.name as court_name, f.name as facility_name,
                       u.full_name as receiver_name, u.email as receiver_email, u.avatar as receiver_avatar
                FROM booking_transfers t
                JOIN bookings b ON t.booking_id = b.id
                JOIN courts c ON b.court_id = c.id
                JOIN facilities f ON c.facility_id = f.id
                JOIN users u ON t.receiver_id = u.id
                WHERE t.sender_id = @user_id
                ORDER BY t.created_at DESC
            `);

        // Fetch received requests
        const receivedQuery = await pool.request()
            .input('user_id', sql.Int, userId)
            .query(`
                SELECT t.id, t.status, t.expires_at, t.created_at,
                       b.booking_date, b.start_time, b.end_time,
                       c.name as court_name, f.name as facility_name,
                       u.full_name as sender_name, u.email as sender_email, u.avatar as sender_avatar
                FROM booking_transfers t
                JOIN bookings b ON t.booking_id = b.id
                JOIN courts c ON b.court_id = c.id
                JOIN facilities f ON c.facility_id = f.id
                JOIN users u ON t.sender_id = u.id
                WHERE t.receiver_id = @user_id
                ORDER BY t.created_at DESC
            `);

        res.json({
            sent: sentQuery.recordset,
            received: receivedQuery.recordset
        });

    } catch (err) {
        console.error('Lỗi lấy danh sách chuyển nhượng:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
