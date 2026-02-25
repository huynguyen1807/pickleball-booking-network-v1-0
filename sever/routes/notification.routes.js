const router = require('express').Router();
const auth = require('../middleware/auth');
const { getNotifications, markRead, markAllRead } = require('../controllers/notification.controller');

router.get('/', auth, getNotifications);
router.put('/:id/read', auth, markRead);
router.put('/read-all', auth, markAllRead);

module.exports = router;
