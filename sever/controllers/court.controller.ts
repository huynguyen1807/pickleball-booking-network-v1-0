import { sql, poolPromise } from '../config/db';

// Create court (owner)
export const createCourt = async (req, res) => {
    try {
        const { name, address, description, image, number_of_small_court, latitude, longitude } = req.body;
        const pool = await poolPromise;
        const result = await pool.request()
            .input('owner_id', sql.Int, req.user.id)
            .input('name', sql.NVarChar, name)
            .input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description)
            .input('image', sql.NVarChar, image)
            .input('number_of_small_court', sql.Decimal(12, 2), number_of_small_court)
            .input('latitude', sql.Decimal(10, 7), latitude || null)
            .input('longitude', sql.Decimal(10, 7), longitude || null)
            .query(`INSERT INTO courts (owner_id, name, address, description, image, number_of_small_court, latitude, longitude)
              OUTPUT INSERTED.id
              VALUES (@owner_id, @name, @address, @description, @image, @number_of_small_court, @latitude, @longitude)`);
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
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count,
        (SELECT COUNT(*) FROM sub_courts WHERE court_id = c.id) AS sub_courts_count
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
        let { name, address, description, image, number_of_small_court, latitude, longitude, is_active } = req.body;
        const pool = await poolPromise;
        const court = await pool.request().input('id', sql.Int, req.params.id).query('SELECT owner_id FROM courts WHERE id = @id');
        if (court.recordset.length === 0) return res.status(404).json({ message: 'Không tìm thấy sân' });
        if (court.recordset[0].owner_id !== req.user.id) return res.status(403).json({ message: 'Không có quyền' });

        // allow partial updates by falling back to existing values
        const existing = await pool.request().input('id', sql.Int, req.params.id).query('SELECT * FROM courts WHERE id = @id');
        const curr = existing.recordset[0] || {};
        name = name ?? curr.name;
        address = address ?? curr.address;
        description = description ?? curr.description;
        image = image ?? curr.image;
        number_of_small_court = number_of_small_court ?? curr.number_of_small_court;
        latitude = latitude ?? curr.latitude;
        longitude = longitude ?? curr.longitude;
        is_active = (typeof is_active === 'boolean') ? is_active : curr.is_active;
        // price_per_hour = price_per_hour ?? curr.price_per_hour;

        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('address', sql.NVarChar, address)
            .input('description', sql.NVarChar, description)
            .input('image', sql.NVarChar, image)
            .input('number_of_small_court', sql.Decimal(12, 2), number_of_small_court)
            .input('latitude', sql.Decimal(10, 7), latitude)
            .input('longitude', sql.Decimal(10, 7), longitude)
            .input('is_active', sql.Bit, is_active)
            // .input('price_per_hour', sql.Decimal(12,2), price_per_hour)
            .input('id', sql.Int, req.params.id)
            .query('UPDATE courts SET name=@name, address=@address, description=@description, image=@image, number_of_small_court=@number_of_small_court, latitude=@latitude, longitude=@longitude, is_active=@is_active WHERE id=@id');
        res.json({ message: 'Cập nhật sân thành công' });
    } catch (err) {
        console.error(err);
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
        (SELECT COUNT(*) FROM bookings WHERE court_id = c.id) AS booking_count,
        (SELECT COUNT(*) FROM sub_courts WHERE court_id = c.id) AS sub_courts_count
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

//Sub_Co
export const getSubCourtsByCourtId = async (req, res) => {
  try {
    const pool = await poolPromise
    const result = await pool.request()
      .input('court_id', sql.Int, req.params.courtId)
      .query(`
        SELECT *
        FROM sub_courts
        WHERE court_id = @court_id
        ORDER BY id ASC
      `)

    res.json(result.recordset)
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const getSubCourtById = async (req, res) => {
  try {
    const pool = await poolPromise
    const query = req.params.courtId
      ? `SELECT * FROM sub_courts WHERE id = @id AND court_id = @courtId`
      : `SELECT * FROM sub_courts WHERE id = @id`
    const request = pool.request().input('id', sql.Int, req.params.id)
    if (req.params.courtId) request.input('courtId', sql.Int, req.params.courtId)

    const result = await request.query(query)

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân con' })
    }

    res.json(result.recordset[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const createSubCourt = async (req, res) => {
  try {
    const { name, court_type, surface_type, status, price_per_hour } = req.body
    const courtId = Number(req.params.courtId)

    if (!name || !court_type || !surface_type) {
      return res.status(400).json({ message: 'Thiếu thông tin sân con' })
    }

    const pool = await poolPromise

    // check sân cha và quyền owner
    const parent = await pool.request()
      .input('id', sql.Int, courtId)
      .query('SELECT id, owner_id FROM courts WHERE id = @id')

    if (parent.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân cha' })
    }

    if (parent.recordset[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền thêm sân con' })
    }

    const result = await pool.request()
      .input('court_id', sql.Int, courtId)
      .input('name', sql.NVarChar, name)
      .input('court_type', sql.VarChar, court_type)
      .input('surface_type', sql.VarChar, surface_type)
      .input('status', sql.VarChar, status || 'active')
      .input('price_per_hour', sql.Decimal(12,2), price_per_hour || 0)
      .query(`
        INSERT INTO sub_courts
          (court_id, name, court_type, surface_type, status, price_per_hour)
        OUTPUT INSERTED.*
        VALUES
          (@court_id, @name, @court_type, @surface_type, @status, @price_per_hour)
      `)

    res.status(201).json(result.recordset[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const updateSubCourt = async (req, res) => {
  try {
    const { name, court_type, surface_type, status } = req.body
    const pool = await poolPromise

    // xác định courtId từ params nếu có hoặc truy vấn từ sub_courts
    const courtIdParam = req.params.courtId ? Number(req.params.courtId) : null

    // Kiểm tra sân con tồn tại và lấy court_id
    const subCourtCheck = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT id, court_id FROM sub_courts WHERE id = @id`)

    if (subCourtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân con' })
    }

    const courtId = subCourtCheck.recordset[0].court_id

    if (courtIdParam && courtIdParam !== courtId) {
      return res.status(400).json({ message: 'Sân con không thuộc sân cha' })
    }

    // Kiểm tra owner
    const courtCheck = await pool.request()
      .input('id', sql.Int, courtId)
      .query(`SELECT owner_id FROM courts WHERE id = @id`)

    if (courtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân' })
    }

    if (courtCheck.recordset[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền cập nhập' })
    }

    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('name', sql.NVarChar, name)
      .input('court_type', sql.VarChar, court_type)
      .input('surface_type', sql.VarChar, surface_type)
      .input('status', sql.VarChar, status)
      .query(`
        UPDATE sub_courts
        SET
          name = @name,
          court_type = @court_type,
          surface_type = @surface_type,
          status = @status,
          updated_at = GETDATE()
        OUTPUT INSERTED.*
        WHERE id = @id
      `)

    res.json(result.recordset[0])
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' })
  }
}

export const updateSubCourtStatus = async (req, res) => {
  try {
    const pool = await poolPromise

    const courtIdParam = req.params.courtId ? Number(req.params.courtId) : null

    // Kiểm tra sân con tồn tại
    const subCourtCheck = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT id, court_id FROM sub_courts WHERE id = @id`)

    if (subCourtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân con' })
    }

    const courtId = subCourtCheck.recordset[0].court_id

    if (courtIdParam && courtIdParam !== courtId) {
      return res.status(400).json({ message: 'Sân con không thuộc sân cha' })
    }

    // Kiểm tra owner
    const courtCheck = await pool.request()
      .input('id', sql.Int, courtId)
      .query(`SELECT owner_id FROM courts WHERE id = @id`)

    if (courtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân cha' })
    }

    if (courtCheck.recordset[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền cập nhập' })
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('status', sql.VarChar, req.body.status)
      .query(`
        UPDATE sub_courts
        SET status = @status, updated_at = GETDATE()
        WHERE id = @id
      `)

    res.json({ message: 'Cập nhật trạng thái thành công' })
  } catch (err) {
    console.error('updateSubCourtStatus error', err)
    res.status(500).json({ message: 'Lỗi server', error: err.message })
  }
}

export const deleteSubCourt = async (req, res) => {
  try {
    const pool = await poolPromise
    const courtIdParam = req.params.courtId ? Number(req.params.courtId) : null

    const subCourtCheck = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT id, court_id FROM sub_courts WHERE id = @id`)

    if (subCourtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân con' })
    }

    const courtId = subCourtCheck.recordset[0].court_id
    if (courtIdParam && courtIdParam !== courtId) {
      return res.status(400).json({ message: 'Sân con không thuộc sân cha' })
    }

    // check ownership
    const courtCheck = await pool.request()
      .input('id', sql.Int, courtId)
      .query(`SELECT owner_id FROM courts WHERE id = @id`)

    if (courtCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy sân' })
    }
    if (courtCheck.recordset[0].owner_id !== req.user.id) {
      return res.status(403).json({ message: 'Không có quyền xóa' })
    }

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`DELETE FROM sub_courts WHERE id = @id`)

    res.json({ message: 'Đã xóa sân con' })
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server' })
  }
}