import { sql, poolPromise } from '../config/db';

// Create court (owner)
export const createCourt = async (req, res) => {
    try {
        const { facility_id, name, image, price_per_hour, latitude, longitude, court_type, surface_type, status, peak_start_time, peak_end_time, peak_price, weekend_price, slot_step_minutes } = req.body;
        const pool = await poolPromise;

        const facility = await pool.request().input('id', sql.Int, facility_id).query('SELECT owner_id FROM facilities WHERE id = @id');
        if (facility.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy cơ sở' });
        if (facility.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });

        const result = await pool.request()
            .input('facility_id', sql.Int, facility_id)
            .input('name', sql.NVarChar, name)
            .input('image', sql.NVarChar, image || null)
            .input('price_per_hour', sql.Decimal(12, 2), price_per_hour)
            .input('latitude', sql.Decimal(10, 7), latitude || null)
            .input('longitude', sql.Decimal(10, 7), longitude || null)
            .input('court_type', sql.NVarChar, court_type || 'outdoor')
            .input('surface_type', sql.NVarChar, surface_type || 'hard')
            .input('status', sql.NVarChar, status || 'active')
            .input('peak_start_time', sql.VarChar, peak_start_time || null)
            .input('peak_end_time', sql.VarChar, peak_end_time || null)
            .input('peak_price', sql.Decimal(12, 2), peak_price || null)
            .input('weekend_price', sql.Decimal(12, 2), weekend_price || null)
            .input('slot_step_minutes', sql.Int, slot_step_minutes || 30)
            .query(`INSERT INTO courts (facility_id, name, image, price_per_hour, latitude, longitude, court_type, surface_type, status, peak_start_time, peak_end_time, peak_price, weekend_price, slot_step_minutes)
              OUTPUT INSERTED.id
              VALUES (@facility_id, @name, @image, @price_per_hour, @latitude, @longitude, @court_type, @surface_type, @status, @peak_start_time, @peak_end_time, @peak_price, @weekend_price, @slot_step_minutes)`);
        res.status(201).json({ message: 'Đã thêm sân', courtId: result.recordset[0].id });
    } catch (err) {
        console.error("Court creation error:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all courts (public)
export const getAllCourts = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT c.*, f.name AS facility_name, f.owner_id, u.full_name AS owner_name,
        (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
      FROM courts c 
      JOIN facilities f ON c.facility_id = f.id
      JOIN users u ON f.owner_id = u.id
      WHERE c.is_active = 1 ORDER BY c.created_at DESC
    `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get court by ID
export const getCourtById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
        SELECT c.*, f.name AS facility_name, f.owner_id, u.full_name AS owner_name, f.address,
          (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
          (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
        FROM courts c 
        JOIN facilities f ON c.facility_id = f.id
        JOIN users u ON f.owner_id = u.id 
        WHERE c.id = @id
      `);
        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy sân' });

        const reviews = await pool.request()
            .input('court_id', sql.Int, req.params.id)
            .query('SELECT TOP 10 r.*, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.court_id = @court_id ORDER BY r.created_at DESC');

        res.json({ ...result.recordset[0], reviews: reviews.recordset });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Update court (owner)
export const updateCourt = async (req, res) => {
    try {
        const { facility_id, name, image, price_per_hour, latitude, longitude, is_active, court_type, surface_type, status, peak_start_time, peak_end_time, peak_price, weekend_price, slot_step_minutes } = req.body;
        const pool = await poolPromise;
        const court = await pool.request().input('id', sql.Int, req.params.id).query(`
            SELECT c.*, f.owner_id 
            FROM courts c 
            JOIN facilities f ON c.facility_id = f.id 
            WHERE c.id = @id
        `);
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy sân' });
        if (court.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });

        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('image', sql.NVarChar, image || null)
            .input('price_per_hour', sql.Decimal(12, 2), price_per_hour)
            .input('latitude', sql.Decimal(10, 7), latitude || null)
            .input('longitude', sql.Decimal(10, 7), longitude || null)
            .input('is_active', sql.Bit, is_active)
            .input('facility_id', sql.Int, facility_id || court.recordset[0].facility_id)
            .input('court_type', sql.NVarChar, court_type || court.recordset[0].court_type)
            .input('surface_type', sql.NVarChar, surface_type || court.recordset[0].surface_type)
            .input('status', sql.NVarChar, status || court.recordset[0].status)
            .input('peak_start_time', sql.VarChar, peak_start_time || null)
            .input('peak_end_time', sql.VarChar, peak_end_time || null)
            .input('peak_price', sql.Decimal(12, 2), peak_price || null)
            .input('weekend_price', sql.Decimal(12, 2), weekend_price || null)
            .input('slot_step_minutes', sql.Int, slot_step_minutes || court.recordset[0].slot_step_minutes)
            .input('id', sql.Int, req.params.id)
            .query(`UPDATE courts SET 
                facility_id=@facility_id, name=@name, image=@image, price_per_hour=@price_per_hour, 
                latitude=@latitude, longitude=@longitude, is_active=@is_active,
                court_type=@court_type, surface_type=@surface_type, status=@status,
                peak_start_time=@peak_start_time, peak_end_time=@peak_end_time, peak_price=@peak_price,
                weekend_price=@weekend_price, slot_step_minutes=@slot_step_minutes
                WHERE id=@id`);
        res.json({ message: 'Cập nhật sân thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Delete court (owner)
export const deleteCourt = async (req, res) => {
    try {
        const pool = await poolPromise;
        const court = await pool.request().input('id', sql.Int, req.params.id).query(`
            SELECT c.*, f.owner_id 
            FROM courts c 
            JOIN facilities f ON c.facility_id = f.id 
            WHERE c.id = @id
        `);
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy sân' });
        if (court.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });
        await pool.request().input('id', sql.Int, req.params.id).query('DELETE FROM courts WHERE id = @id');
        res.json({ message: 'Đã xóa sân' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get my courts (owner)
export const getMyCourts = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('owner_id', sql.Int, req.user.id)
            .query(`SELECT c.*, f.name as facility_name, 
        (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
        FROM courts c 
        JOIN facilities f ON c.facility_id = f.id
        WHERE f.owner_id = @owner_id ORDER BY c.created_at DESC`);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get court slots for a specific date (dùng cho lưới slot)
export const getCourtSlots = async (req, res) => {
    try {
        const { id } = req.params;
        const { date } = req.query;

        if (!date) return res.status(400).json({ message: 'Thiếu tham số date' });

        const pool = await poolPromise;

        // Lấy giờ mở/đóng cửa của facility
        const courtInfo = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT f.open_time, f.close_time
                FROM courts c
                JOIN facilities f ON c.facility_id = f.id
                WHERE c.id = @id AND c.is_active = 1
            `);

        if (courtInfo.recordset.length === 0)
            return res.status(404).json({ message: 'Không tìm thấy sân' });

        const openTime  = courtInfo.recordset[0].open_time  || '06:00';
        const closeTime = courtInfo.recordset[0].close_time || '22:00';

        // Lấy danh sách slots từ DB (đã được seed)
        const slotsResult = await pool.request()
            .input('court_id',  sql.Int,  id)
            .input('slot_date', sql.Date, date as string)
            .query(`
                SELECT
                    CONVERT(NVARCHAR(5), start_time, 108) AS start_time,
                    CONVERT(NVARCHAR(5), end_time,   108) AS end_time,
                    is_available
                FROM court_slots
                WHERE court_id  = @court_id
                  AND slot_date = @slot_date
                ORDER BY start_time
            `);

        // Nếu chưa có slot trong DB → tự sinh trên-the-fly
        if (slotsResult.recordset.length === 0) {
            // Lấy booking đã có
            const bookingsResult = await pool.request()
                .input('court_id',     sql.Int,  id)
                .input('booking_date', sql.Date, date as string)
                .query(`
                    SELECT
                        CONVERT(NVARCHAR(5), start_time, 108) AS start_time,
                        CONVERT(NVARCHAR(5), end_time,   108) AS end_time
                    FROM bookings
                    WHERE court_id     = @court_id
                      AND booking_date = @booking_date
                      AND status IN ('confirmed', 'pending')
                `);
            const bookedRanges = bookingsResult.recordset;

            // Sinh slot 30 phút từ open_time đến close_time
            const slots: any[] = [];
            const [oh, om] = openTime.split(':').map(Number);
            const [ch, cm] = closeTime.split(':').map(Number);
            let curMin = oh * 60 + om;
            const endMin = ch * 60 + cm;

            while (curMin + 30 <= endMin) {
                const st = `${String(Math.floor(curMin / 60)).padStart(2, '0')}:${String(curMin % 60).padStart(2, '0')}`;
                const et = `${String(Math.floor((curMin + 30) / 60)).padStart(2, '0')}:${String((curMin + 30) % 60).padStart(2, '0')}`;
                const booked = bookedRanges.some(b => st < b.end_time && et > b.start_time);
                slots.push({ start_time: st, end_time: et, is_available: !booked });
                curMin += 30;
            }
            return res.json(slots);
        }

        res.json(slotsResult.recordset.map(s => ({
            ...s,
            is_available: s.is_available === true || s.is_available === 1
        })));
    } catch (err) {
        console.error('Lỗi lấy court slots:', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Add review
export const addReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const pool = await poolPromise;
        await pool.request()
            .input('user_id', sql.Int, req.user.id)
            .input('court_id', sql.Int, req.params.id)
            .input('rating', sql.Int, rating)
            .input('comment', sql.NVarChar, comment)
            .query('INSERT INTO reviews (user_id, court_id, rating, comment) VALUES (@user_id, @court_id, @rating, @comment)');
        res.status(201).json({ message: 'Đánh giá thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

