import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { getNotifications, getUnreadCount, markRead, markAllRead } from '../controllers/notification.controller';

router.get('/', auth, getNotifications);
router.get('/unread-count', auth, getUnreadCount);
router.put('/:id/read', auth, markRead);
router.put('/read-all', auth, markAllRead);

export default router;


