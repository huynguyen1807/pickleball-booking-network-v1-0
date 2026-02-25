import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { getNotifications, markRead, markAllRead } from '../controllers/notification.controller';

router.get('/', auth, getNotifications);
router.put('/:id/read', auth, markRead);
router.put('/read-all', auth, markAllRead);

export default router;

