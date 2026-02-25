const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const { createCourt, getAllCourts, getCourtById, updateCourt, deleteCourt, getMyCourts, addReview } = require('../controllers/court.controller');

router.get('/', getAllCourts);
router.get('/my', auth, role('owner'), getMyCourts);
router.get('/:id', getCourtById);
router.post('/', auth, role('owner'), createCourt);
router.put('/:id', auth, role('owner'), updateCourt);
router.delete('/:id', auth, role('owner'), deleteCourt);
router.post('/:id/review', auth, addReview);

module.exports = router;
