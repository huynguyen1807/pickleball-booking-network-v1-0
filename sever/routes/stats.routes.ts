import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { getUserStats, getOwnerStats, getAdminStats } from '../controllers/stats.controller';

router.get('/user', auth, getUserStats);
router.get('/owner', auth, role('owner'), getOwnerStats);
router.get('/admin', auth, role('admin'), getAdminStats);

export default router;

