const router = require('express').Router();
const auth = require('../middleware/auth');
const { createMatch, getAllMatches, getMatchById, joinMatch, leaveMatch } = require('../controllers/match.controller');

router.get('/', auth, getAllMatches);
router.get('/:id', auth, getMatchById);
router.post('/', auth, createMatch);
router.post('/:id/join', auth, joinMatch);
router.post('/:id/leave', auth, leaveMatch);

module.exports = router;
