const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { getUpgradeRequests, approveUpgrade, rejectUpgrade, getAllUsers, toggleUserStatus } = require('../controllers/admin.controller');

router.get('/upgrade-requests', auth, role('admin'), getUpgradeRequests);
router.put('/upgrade-requests/:id/approve', auth, role('admin'), approveUpgrade);
router.put('/upgrade-requests/:id/reject', auth, role('admin'), rejectUpgrade);
router.get('/users', auth, role('admin'), getAllUsers);
router.put('/users/:id/status', auth, role('admin'), toggleUserStatus);

module.exports = router;
