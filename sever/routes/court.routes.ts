import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { createCourt, getAllCourts, getCourtById, updateCourt, deleteCourt, getMyCourts, addReview, updateSubCourtStatus, updateSubCourt, createSubCourt, getSubCourtById, getSubCourtsByCourtId } from '../controllers/court.controller';

router.get('/', getAllCourts);
router.get('/my', auth, role('owner'), getMyCourts);
router.get('/:id', getCourtById);
router.post('/', auth, role('owner'), createCourt);
router.put('/:id', auth, role('owner'), updateCourt);
router.delete('/:id', auth, role('owner'), deleteCourt);
router.post('/:id/review', auth, addReview);

// courts.routes.ts
router.get('/:courtId/sub-courts', getSubCourtsByCourtId)
router.post('/:courtId/sub-courts', createSubCourt)

// subCourts.routes.ts
router.put('/:id', updateSubCourt)
router.put('/:id/status', updateSubCourtStatus)

export default router;

