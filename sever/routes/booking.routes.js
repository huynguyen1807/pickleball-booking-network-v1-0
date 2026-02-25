const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { createBooking, getMyBookings, getOwnerBookings, cancelBooking } = require('../controllers/booking.controller');

router.post('/', auth, createBooking);
router.get('/my', auth, getMyBookings);
router.get('/owner', auth, role('owner'), getOwnerBookings);
router.put('/:id/cancel', auth, cancelBooking);

module.exports = router;
