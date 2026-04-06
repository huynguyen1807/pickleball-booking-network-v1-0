import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { 
    requestTransfer, 
    acceptTransfer, 
    rejectTransfer, 
    cancelTransfer, 
    getMyTransfers 
} from '../controllers/transfer.controller';

// Các API xử lý chuyển nhượng sân
router.post('/request', auth, requestTransfer);
router.post('/:id/accept', auth, acceptTransfer);
router.post('/:id/reject', auth, rejectTransfer);
router.patch('/:id/cancel', auth, cancelTransfer);
router.get('/my-requests', auth, getMyTransfers);

export default router;
