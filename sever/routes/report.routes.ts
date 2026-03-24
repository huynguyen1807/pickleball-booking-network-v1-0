import express from 'express';
import auth from '../middleware/auth';
import role from '../middleware/role';
import {
    createReport,
    getAllReports,
    getReportById,
    updateReportStatus,
    getMyReports,
    deleteReport
} from '../controllers/report.controller';

const router = express.Router();

// User routes
router.post('/', auth, createReport);                    // Create report
router.get('/my-reports', auth, getMyReports);           // Get my reports

// Admin only
router.get('/', auth, role('admin'), getAllReports);              // Get all reports
router.get('/:id', auth, role('admin'), getReportById);           // Get report detail
router.put('/:id', auth, role('admin'), updateReportStatus);      // Update report status
router.delete('/:id', auth, role('admin'), deleteReport);         // Delete report

export default router;
