const router = require('express').Router();
const auth = require('../middleware/auth');
const { updateProfile, requestUpgrade, getAllUsers } = require('../controllers/user.controller');
const role = require('../middleware/role');

router.put('/profile', auth, updateProfile);
router.post('/upgrade-request', auth, role('user'), requestUpgrade);
router.get('/all', auth, role('admin'), getAllUsers);

module.exports = router;
