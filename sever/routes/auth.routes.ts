import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { register, login, getProfile, changePassword, forgotPassword, verifyCode, resetPassword } from '../controllers/auth.controller';

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.put('/change-password', auth, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyCode);
router.post('/reset-password', resetPassword);

export default router;

