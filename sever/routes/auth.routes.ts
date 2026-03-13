import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
const router = Router();
import auth from '../middleware/auth';
import { register,sendRegisterOTP, login, getProfile, changePassword, forgotPassword, verifyCode, resetPassword } from '../controllers/auth.controller';

// ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/business_licenses');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// multer config for storing business license files in memory first
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Chỉ chấp nhận các định dạng PDF/JPG/PNG'));
    }
});

router.post('/send-register-otp', sendRegisterOTP)
// register route now accepts multipart form-data with optional business_license file
router.post('/register', upload.single('business_license'), register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.put('/change-password', auth, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyCode);
router.post('/reset-password', resetPassword);

export default router;

