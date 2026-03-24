import { Request, Response } from 'express';
import { sql, poolPromise } from '../config/db';

interface AuthRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
    };
}

// Create a report
export const createReport = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;
        const { report_type, report_target_id, report_target_type, description, evidence_urls } = req.body;

        // Validate input
        if (!['account', 'post', 'impostor', 'court', 'other'].includes(report_type)) {
            return res.status(400).json({ message: 'Loại báo cáo không hợp lệ' });
        }

        if (!description || description.trim().length === 0) {
            return res.status(400).json({ message: 'Mô tả báo cáo không được để trống' });
        }

        // Prevent self-reporting for accounts
        if (report_type === 'account' && report_target_id === req.user.id) {
            return res.status(400).json({ message: 'Không thể báo cáo chính mình' });
        }

        // Validate target exists
        if (report_target_id && report_target_type) {
            let targetExists = false;
            if (report_target_type === 'user') {
                const userCheck = await pool.request()
                    .input('id', sql.Int, report_target_id)
                    .query('SELECT id FROM users WHERE id = @id');
                targetExists = userCheck.recordset.length > 0;
            } else if (report_target_type === 'post') {
                const postCheck = await pool.request()
                    .input('id', sql.Int, report_target_id)
                    .query('SELECT id FROM posts WHERE id = @id');
                targetExists = postCheck.recordset.length > 0;
            } else if (report_target_type === 'court') {
                const courtCheck = await pool.request()
                    .input('id', sql.Int, report_target_id)
                    .query('SELECT id FROM courts WHERE id = @id');
                targetExists = courtCheck.recordset.length > 0;
            }

            if (!targetExists) {
                return res.status(404).json({ message: `${report_target_type} không tồn tại` });
            }
        }

        // Check for duplicate reports (within 24 hours)
        const duplicateCheck = await pool.request()
            .input('reporter_id', sql.Int, req.user.id)
            .input('report_type', sql.NVarChar, report_type)
            .input('target_id', sql.Int, report_target_id || null)
            .input('hours', sql.Int, 24)
            .query(`
                SELECT id FROM reports 
                WHERE reporter_id = @reporter_id 
                AND report_type = @report_type
                AND report_target_id = @target_id
                AND created_at > DATEADD(HOUR, -@hours, GETDATE())
            `);

        if (duplicateCheck.recordset.length > 0) {
            return res.status(400).json({ message: 'Bạn đã báo cáo đối tượng này trong 24 giờ qua' });
        }

        // Create report
        const result = await pool.request()
            .input('reporter_id', sql.Int, req.user.id)
            .input('report_type', sql.NVarChar, report_type)
            .input('report_target_id', sql.Int, report_target_id || null)
            .input('report_target_type', sql.NVarChar, report_target_type || null)
            .input('description', sql.NVarChar, description)
            .input('evidence_urls', sql.NVarChar, evidence_urls ? JSON.stringify(evidence_urls) : null)
            .query(`
                INSERT INTO reports (reporter_id, report_type, report_target_id, report_target_type, description, evidence_urls, status)
                OUTPUT INSERTED.id
                VALUES (@reporter_id, @report_type, @report_target_id, @report_target_type, @description, @evidence_urls, 'pending')
            `);

        const reportId = result.recordset[0].id;

        // Create notification for admin
        const adminUsers = await pool.request().query('SELECT id FROM users WHERE role = \'admin\'');
        
        for (const admin of adminUsers.recordset) {
            await pool.request()
                .input('user_id', sql.Int, admin.id)
                .input('title', sql.NVarChar, 'Báo cáo mới')
                .input('message', sql.NVarChar, `Có báo cáo mới: ${report_type}`)
                .input('type', sql.NVarChar, 'report')
                .input('reference_id', sql.Int, reportId)
                .query(`
                    INSERT INTO notifications (user_id, title, message, type, reference_id)
                    VALUES (@user_id, @title, @message, @type, @reference_id)
                `);
        }

        res.status(201).json({ message: 'Báo cáo đã được gửi', reportId });
    } catch (err) {
        console.error("Error in createReport:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get all reports (Admin only)
export const getAllReports = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;
        const { status, report_type, page } = req.query;
        const limit = 20;
        const pageNum = parseInt(String(page || 1), 10);
        const offset = (pageNum - 1) * limit;

        let query = `
            SELECT 
                r.id, r.reporter_id, u1.full_name AS reporter_name, u1.email AS reporter_email,
                r.report_type, r.report_target_id, r.report_target_type,
                r.description, r.evidence_urls, r.status,
                r.admin_note, r.resolved_by, u2.full_name AS resolved_by_name,
                r.created_at, r.updated_at
            FROM reports r
            JOIN users u1 ON r.reporter_id = u1.id
            LEFT JOIN users u2 ON r.resolved_by = u2.id
            WHERE 1=1
        `;

        const request = pool.request();

        if (status) {
            query += ' AND r.status = @status';
            request.input('status', sql.NVarChar, status);
        }

        if (report_type) {
            query += ' AND r.report_type = @report_type';
            request.input('report_type', sql.NVarChar, report_type);
        }

        query += ' ORDER BY r.created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';
        
        request.input('offset', sql.Int, offset);
        request.input('limit', sql.Int, limit);

        const result = await request.query(query);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM reports WHERE 1=1';
        const countRequest = pool.request();

        if (status) {
            countQuery += ' AND status = @status';
            countRequest.input('status', sql.NVarChar, status);
        }

        if (report_type) {
            countQuery += ' AND report_type = @report_type';
            countRequest.input('report_type', sql.NVarChar, report_type);
        }

        const countResult = await countRequest.query(countQuery);

        res.json({
            data: result.recordset,
            total: countResult.recordset[0].total,
            page: pageNum,
            limit,
            pages: Math.ceil(countResult.recordset[0].total / limit)
        });
    } catch (err) {
        console.error("Error in getAllReports:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get report by ID (Admin only)
export const getReportById = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT 
                    r.id, r.reporter_id, u1.full_name AS reporter_name, u1.email AS reporter_email,
                    r.report_type, r.report_target_id, r.report_target_type,
                    r.description, r.evidence_urls, r.status,
                    r.admin_note, r.resolved_by, u2.full_name AS resolved_by_name,
                    r.created_at, r.updated_at
                FROM reports r
                JOIN users u1 ON r.reporter_id = u1.id
                LEFT JOIN users u2 ON r.resolved_by = u2.id
                WHERE r.id = @id
            `);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'Báo cáo không tồn tại' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error in getReportById:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Update report status (Admin only)
export const updateReportStatus = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;
        const { status, admin_note } = req.body;

        if (!['pending', 'investigating', 'resolved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
        }

        // Get current report
        const report = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT * FROM reports WHERE id = @id');

        if (report.recordset.length === 0) {
            return res.status(404).json({ message: 'Báo cáo không tồn tại' });
        }

        const reportData = report.recordset[0];

        // Update report
        await pool.request()
            .input('id', sql.Int, id)
            .input('status', sql.NVarChar, status)
            .input('admin_note', sql.NVarChar, admin_note || null)
            .input('resolved_by', sql.Int, req.user.id)
            .query(`
                UPDATE reports
                SET status = @status, admin_note = @admin_note, resolved_by = @resolved_by, updated_at = GETDATE()
                WHERE id = @id
            `);

        // If resolved and target is user, optionally ban them
        if (status === 'resolved' && reportData.report_target_type === 'user') {
            // Create notification for reported user
            await pool.request()
                .input('user_id', sql.Int, reportData.report_target_id)
                .input('title', sql.NVarChar, 'Báo cáo đã được xử lý')
                .input('message', sql.NVarChar, `Báo cáo về bạn đã được xử lý. Nội dung: ${admin_note || 'Xem chi tiết trong cài đặt'}`)
                .input('type', sql.NVarChar, 'report_resolved')
                .input('reference_id', sql.Int, id)
                .query(`
                    INSERT INTO notifications (user_id, title, message, type, reference_id)
                    VALUES (@user_id, @title, @message, @type, @reference_id)
                `);
        }

        // Notify reporter about status update
        await pool.request()
            .input('user_id', sql.Int, reportData.reporter_id)
            .input('title', sql.NVarChar, 'Báo cáo của bạn đã được xử lý')
            .input('message', sql.NVarChar, `Trạng thái: ${status === 'resolved' ? 'Đã giải quyết' : 'Đang xử lý'}`)
            .input('type', sql.NVarChar, 'report_update')
            .input('reference_id', sql.Int, id)
            .query(`
                INSERT INTO notifications (user_id, title, message, type, reference_id)
                VALUES (@user_id, @title, @message, @type, @reference_id)
            `);

        res.json({ message: 'Cập nhật báo cáo thành công' });
    } catch (err) {
        console.error("Error in updateReportStatus:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Get my reports (User)
export const getMyReports = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input('reporter_id', sql.Int, req.user.id)
            .query(`
                SELECT 
                    id, report_type, report_target_id, report_target_type,
                    description, status, admin_note,
                    created_at, updated_at
                FROM reports
                WHERE reporter_id = @reporter_id
                ORDER BY created_at DESC
            `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in getMyReports:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};

// Delete report (Admin only)
export const deleteReport = async (req: AuthRequest, res: Response) => {
    try {
        const pool = await poolPromise;
        const { id } = req.params;

        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM reports WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Báo cáo không tồn tại' });
        }

        res.json({ message: 'Xóa báo cáo thành công' });
    } catch (err) {
        console.error("Error in deleteReport:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
};
