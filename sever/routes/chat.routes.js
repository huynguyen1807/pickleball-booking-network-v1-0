const router = require('express').Router();
const auth = require('../middleware/auth');
const { getChatRooms, getMessages, sendMessage } = require('../controllers/chat.controller');

router.get('/rooms', auth, getChatRooms);
router.get('/rooms/:roomId/messages', auth, getMessages);
router.post('/rooms/:roomId/messages', auth, sendMessage);

module.exports = router;
