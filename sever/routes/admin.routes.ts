import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { getUpgradeRequests, getLicenseImage, approveUpgrade, rejectUpgrade, getAllUsers, toggleUserStatus, sendBroadcastNotification } from '../controllers/admin.controller';

router.get('/upgrade-requests', auth, role('admin'), getUpgradeRequests);
router.get('/upgrade-requests/:id/license', auth, role('admin'), getLicenseImage);
router.put('/upgrade-requests/:id/approve', auth, role('admin'), approveUpgrade);
router.put('/upgrade-requests/:id/reject', auth, role('admin'), rejectUpgrade);
router.get('/users', auth, role('admin'), getAllUsers);
router.put('/users/:id/status', auth, role('admin'), toggleUserStatus);
router.post('/notifications/broadcast', auth, role('admin'), sendBroadcastNotification);

export default router;

