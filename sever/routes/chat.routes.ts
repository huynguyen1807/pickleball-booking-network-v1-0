import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { getChatRooms, getMessages, sendMessage } from '../controllers/chat.controller';

router.get('/rooms', auth, getChatRooms);
router.get('/rooms/:roomId/messages', auth, getMessages);
router.post('/rooms/:roomId/messages', auth, sendMessage);

export default router;

