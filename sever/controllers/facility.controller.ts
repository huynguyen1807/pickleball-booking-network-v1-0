import { sql, poolPromise } from '../config/db';

// Get all facilities
export const getAllFacilities = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT 
                f.id, f.name, f.address, f.is_active,
                f.phone, f.open_time, f.close_time, f.avatar, f.cover_image, f.amenities,
                (SELECT MIN(price_per_hour) FROM courts WHERE facility_id = f.id AND is_active = 1) AS min_price,
                (SELECT COUNT(*) FROM courts WHERE facility_id = f.id AND is_active = 1) AS court_count,
                (
                    SELECT AVG(CAST(r.rating AS FLOAT)) 
                    FROM reviews r 
                    JOIN courts c ON r.court_id = c.id 
                    WHERE c.facility_id = f.id
                ) AS avg_rating,
                (
                    SELECT COUNT(*) 
                    FROM bookings b 
                    JOIN courts c ON b.court_id = c.id 
                    WHERE c.facility_id = f.id
                ) AS booking_count
            FROM facilities f
            WHERE f.is_active = 1
            ORDER BY f.created_at DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in getAllFacilities:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get facility by ID
export const getFacilityById = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT f.*, u.full_name AS owner_name,
                    (
                        SELECT AVG(CAST(r.rating AS FLOAT)) 
                        FROM reviews r 
                        JOIN courts c ON r.court_id = c.id 
                        WHERE c.facility_id = f.id
                    ) AS avg_rating,
                    (
                        SELECT COUNT(*) 
                        FROM bookings b 
                        JOIN courts c ON b.court_id = c.id 
                        WHERE c.facility_id = f.id
                    ) AS booking_count
                FROM facilities f
                JOIN users u ON f.owner_id = u.id
                WHERE f.id = @id
            `);

        if (result.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy cơ sở' });
        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error in getFacilityById:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get my facilities (Owner)
export const getMyFacilities = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('owner_id', sql.Int, req.user.id)
            .query(`
                SELECT f.*,
                    (SELECT COUNT(*) FROM courts WHERE facility_id = f.id) AS court_count,
                    (
                        SELECT AVG(CAST(r.rating AS FLOAT)) 
                        FROM reviews r 
                        JOIN courts c ON r.court_id = c.id 
                        WHERE c.facility_id = f.id
                    ) AS avg_rating,
                    (
                        SELECT COUNT(*) 
                        FROM bookings b 
                        JOIN courts c ON b.court_id = c.id 
                        WHERE c.facility_id = f.id
                    ) AS booking_count
                FROM facilities f
                WHERE f.owner_id = @owner_id
                ORDER BY f.created_at DESC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in getMyFacilities:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Create a new facility (Owner only)
export const createFacility = async (req, res) => {
    try {
        const pool = await poolPromise;
        let { name, address, description, phone, open_time, close_time, avatar, cover_image, gallery, amenities } = req.body;

        // Ensure strictly strings for JSON
        const galleryJson = gallery ? JSON.stringify(gallery) : null;
        const amenitiesJson = amenities ? JSON.stringify(amenities) : null;

        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description || null)
            .input('owner_id', sql.Int, req.user.id)
            .input('phone', sql.NVarChar, phone || null)
            .input('open_time', sql.VarChar, open_time || null)
            .input('close_time', sql.VarChar, close_time || null)
            .input('avatar', sql.NVarChar, avatar || null)
            .input('cover_image', sql.NVarChar, cover_image || null)
            .input('gallery', sql.NVarChar, galleryJson)
            .input('amenities', sql.NVarChar, amenitiesJson)
            .query(`
                INSERT INTO facilities (name, address, description, owner_id, phone, open_time, close_time, avatar, cover_image, gallery, amenities)
                VALUES (@name, @address, @description, @owner_id, @phone, @open_time, @close_time, @avatar, @cover_image, @gallery, @amenities)
            `);
        res.status(201).json({ message: 'Tạo cơ sở thành công' });
    } catch (err) {
        console.error("Error in createFacility:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Update a facility (Owner only)
export const updateFacility = async (req, res) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;
        let { name, address, description, phone, open_time, close_time, avatar, cover_image, gallery, amenities, is_active } = req.body;

        // Verify ownership
        const facilityCheck = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT owner_id FROM facilities WHERE id = @id');

        if (facilityCheck.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy cơ sở' });
        if (facilityCheck.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền sửa cơ sở này' });

        const galleryJson = gallery ? JSON.stringify(gallery) : null;
        const amenitiesJson = amenities ? JSON.stringify(amenities) : null;

        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description || null)
            .input('phone', sql.NVarChar, phone || null)
            .input('open_time', sql.VarChar, open_time || null)
            .input('close_time', sql.VarChar, close_time || null)
            .input('avatar', sql.NVarChar, avatar || null)
            .input('cover_image', sql.NVarChar, cover_image || null)
            .input('gallery', sql.NVarChar, galleryJson)
            .input('amenities', sql.NVarChar, amenitiesJson)
            .input('is_active', sql.Bit, is_active === undefined ? 1 : is_active)
            .query(`
                UPDATE facilities
                SET name = @name, address = @address, description = @description, 
                    phone = @phone, open_time = @open_time, close_time = @close_time,
                    avatar = @avatar, cover_image = @cover_image, gallery = @gallery,
                    amenities = @amenities, is_active = @is_active
                WHERE id = @id
            `);

        res.json({ message: 'Cập nhật cơ sở thành công' });
    } catch (err) {
        console.error("Error in updateFacility:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get courts by Facility ID
export const getCourtsByFacility = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('facility_id', sql.Int, req.params.id)
            .query(`
                SELECT c.*, 
                    (SELECT AVG(CAST(rating AS FLOAT)) FROM reviews WHERE court_id = c.id) AS avg_rating,
                    (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count
                FROM courts c
                WHERE c.facility_id = @facility_id
                ORDER BY c.created_at ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in getCourtsByFacility:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
