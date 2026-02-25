import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { getPaymentHistory, processPayment } from '../controllers/payment.controller';

router.get('/history', auth, getPaymentHistory);
router.post('/process', auth, processPayment);

export default router;

