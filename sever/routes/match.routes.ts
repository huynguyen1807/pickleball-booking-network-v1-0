import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { createMatch, getAllMatches, getMatchById, joinMatch, leaveMatch } from '../controllers/match.controller';

router.get('/', auth, getAllMatches);
router.get('/:id', auth, getMatchById);
router.post('/', auth, createMatch);
router.post('/:id/join', auth, joinMatch);
router.post('/:id/leave', auth, leaveMatch);

export default router;

