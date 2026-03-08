import { sql, poolPromise } from '../config/db';

// Create court (owner)
export const createCourt = async (req, res) => {
    try {
        const { name, address, description, image, price_per_hour, latitude, longitude } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('owner_id', sql.Int, req.user.id)
            .input('name', sql.NVarChar, name)
            .input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description)
            .input('image', sql.NVarChar, image)
            .input('price_per_hour', sql.Decimal(12, 2), price_per_hour)
            .input('latitude', sql.Decimal(10, 7), latitude || null)
            .input('longitude', sql.Decimal(10, 7), longitude || null)
            .query(`INSERT INTO courts (owner_id, name, address, description, image, price_per_hour, latitude, longitude)
              OUTPUT INSERTED.id
              VALUES (@owner_id, @name, @address, @description, @image, @price_per_hour, @latitude, @longitude)`);
        res.status(201).json({ message: 'Đã thêm sân', courtId: result.recordset[0].id });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all courts (public)
export const getAllCourts = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
      SELECT c.*, u.full_name AS owner_name,
        (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
      FROM courts c JOIN users u ON c.owner_id = u.id
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
        SELECT c.*, u.full_name AS owner_name,
          (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
          (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
        FROM courts c JOIN users u ON c.owner_id = u.id WHERE c.id = @id
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
        const { name, address, description, image, price_per_hour, latitude, longitude, is_active } = req.body;
        const pool = await poolPromise;
        const court = await pool.request().input('id', sql.Int, req.params.id).query('SELECT owner_id FROM courts WHERE id = @id');
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy sân' });
        if (court.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });

        await pool.request()
            .input('name', sql.NVarChar, name).input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description).input('image', sql.NVarChar, image)
            .input('price_per_hour', sql.Decimal(12, 2), price_per_hour)
            .input('latitude', sql.Decimal(10, 7), latitude).input('longitude', sql.Decimal(10, 7), longitude)
            .input('is_active', sql.Bit, is_active).input('id', sql.Int, req.params.id)
            .query('UPDATE courts SET name=@name, address=@address, description=@description, image=@image, price_per_hour=@price_per_hour, latitude=@latitude, longitude=@longitude, is_active=@is_active WHERE id=@id');
        res.json({ message: 'Cập nhật sân thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Delete court (owner)
export const deleteCourt = async (req, res) => {
    try {
        const pool = await poolPromise;
        const court = await pool.request().input('id', sql.Int, req.params.id).query('SELECT owner_id FROM courts WHERE id = @id');
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
            .query(`SELECT c.*, (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
        FROM courts c WHERE c.owner_id = @owner_id ORDER BY c.created_at DESC`);
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

