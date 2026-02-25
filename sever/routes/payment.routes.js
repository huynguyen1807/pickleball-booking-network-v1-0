const router = require('express').Router();
const auth = require('../middleware/auth');
const { getPaymentHistory, processPayment } = require('../controllers/payment.controller');

router.get('/history', auth, getPaymentHistory);
router.post('/process', auth, processPayment);

module.exports = router;
