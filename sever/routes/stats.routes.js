const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getUserStats, getOwnerStats, getAdminStats } = require('../controllers/stats.controller');

router.get('/user', auth, getUserStats);
router.get('/owner', auth, role('owner'), getOwnerStats);
router.get('/admin', auth, role('admin'), getAdminStats);

module.exports = router;
