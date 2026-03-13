import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import role from '../middleware/role';
import { createBooking, getMyBookings, getOwnerBookings, cancelBooking, getBookedSlots } from '../controllers/booking.controller';

router.post('/', auth, createBooking);
router.get('/my', auth, getMyBookings);
router.get('/owner', auth, role('owner'), getOwnerBookings);
router.get('/booked-slots/:courtId/:date', getBookedSlots);
router.put('/:id/cancel', auth, cancelBooking);

export default router;

