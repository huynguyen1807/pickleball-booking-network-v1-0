import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { updateProfile, requestUpgrade, getAllUsers, getUserProfile, getUserBrief } from '../controllers/user.controller';
import role from '../middleware/role';

router.get('/profile/:id', auth, getUserProfile);
router.get('/brief/:id', auth, getUserBrief);
router.put('/profile', auth, updateProfile);
router.post('/upgrade-request', auth, role('user'), requestUpgrade);
router.get('/all', auth, role('admin'), getAllUsers);

export default router;

