const router = require('express').Router();
const auth = require('../middleware/auth');
const { register, login, getProfile, changePassword, forgotPassword, verifyCode, resetPassword } = require('../controllers/auth.controller');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.put('/change-password', auth, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyCode);
router.post('/reset-password', resetPassword);

module.exports = router;
