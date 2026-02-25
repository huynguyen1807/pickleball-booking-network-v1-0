import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { createBooking, getMyBookings, getOwnerBookings, cancelBooking } from '../controllers/booking.controller';

router.post('/', auth, createBooking);
router.get('/my', auth, getMyBookings);
router.get('/owner', auth, role('owner'), getOwnerBookings);
router.put('/:id/cancel', auth, cancelBooking);

export default router;

