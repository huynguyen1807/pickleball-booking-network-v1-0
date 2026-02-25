import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { getUpgradeRequests, approveUpgrade, rejectUpgrade, getAllUsers, toggleUserStatus } from '../controllers/admin.controller';

router.get('/upgrade-requests', auth, role('admin'), getUpgradeRequests);
router.put('/upgrade-requests/:id/approve', auth, role('admin'), approveUpgrade);
router.put('/upgrade-requests/:id/reject', auth, role('admin'), rejectUpgrade);
router.get('/users', auth, role('admin'), getAllUsers);
router.put('/users/:id/status', auth, role('admin'), toggleUserStatus);

export default router;

