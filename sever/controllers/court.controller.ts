import { sql, poolPromise } from '../config/db';

// Get available courts for a given date + time range (used by match creation)
export const getAvailableCourts = async (req, res) => {
    try {
        const { date, start_time, end_time } = req.query;
        if (!date || !start_time || !end_time)
            return res.status(400).json({ message: 'Cần truyền date, start_time, end_time' });

        const pool = await poolPromise;
        // Courts that are active and have no conflicting booking or match in the slot
        const result = await pool.request()
            .input('date', sql.Date, date)
            .input('start', sql.NVarChar, start_time)
            .input('end', sql.NVarChar, end_time)
            .query(`
                SELECT c.*, f.name AS facility_name, f.address, f.owner_id, u.full_name AS owner_name,
                       (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
                       (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
                FROM courts c
                JOIN facilities f ON c.facility_id = f.id
                JOIN users u ON f.owner_id = u.id
                WHERE c.is_active = 1
                  AND NOT EXISTS (
                      SELECT 1 FROM bookings b
                      WHERE b.court_id = c.id
                        AND b.booking_date = @date
                        AND b.status IN ('confirmed','pending')
                        AND b.start_time < @end AND b.end_time > @start
                  )
                  AND NOT EXISTS (
                      SELECT 1 FROM matches m
                      WHERE m.court_id = c.id
                        AND m.match_date = @date
                        AND m.status NOT IN ('cancelled','completed','finished')
                        AND m.start_time < @end AND m.end_time > @start
                  )
                ORDER BY c.price_per_hour ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('[getAvailableCourts]', err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

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

