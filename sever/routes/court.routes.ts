import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { createCourt, getAllCourts, getCourtById, updateCourt, deleteCourt, getMyCourts, addReview, getAvailableCourts, getCourtSlots } from '../controllers/court.controller';

router.get('/available', auth, getAvailableCourts);
router.get('/', getAllCourts);
router.get('/my', auth, role('owner'), getMyCourts);
router.get('/:id/slots', getCourtSlots);
router.get('/:id', getCourtById);
router.post('/', auth, role('owner'), createCourt);
router.put('/:id', auth, role('owner'), updateCourt);
router.delete('/:id', auth, role('owner'), deleteCourt);
router.post('/:id/review', auth, addReview);

export default router;
