import express from 'express';
import { getAllFacilities, getFacilityById, getCourtsByFacility, createFacility, updateFacility, getMyFacilities } from '../controllers/facility.controller';
import verifyToken from '../middleware/auth';

const router = express.Router();

router.get('/', getAllFacilities);

// Protected routes (Owner only)
router.get('/my', verifyToken, getMyFacilities);
router.post('/', verifyToken, createFacility);
router.put('/:id', verifyToken, updateFacility);

router.get('/:id', getFacilityById);
router.get('/:id/courts', getCourtsByFacility);

export default router;
