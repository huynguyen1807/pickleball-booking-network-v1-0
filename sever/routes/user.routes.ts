import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { updateProfile, requestUpgrade, getAllUsers } from '../controllers/user.controller';
import role from '../middleware/role';
import { uploadLicense } from '../middleware/upload.middleware';

router.put('/profile', auth, updateProfile);
router.post('/upgrade-request', auth, role('user'), uploadLicense.single('license'), requestUpgrade);
router.get('/all', auth, role('admin'), getAllUsers);

export default router;

