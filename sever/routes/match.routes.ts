import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import {
    createMatch, getAllMatches, getMyMatchHistory, getMatchById,
    joinMatch, leaveMatch,
    cancelMatch, getMatchMessages, sendMatchMessage
} from '../controllers/match.controller';

router.get('/', auth, getAllMatches);
router.get('/my-history', auth, getMyMatchHistory);
router.get('/:id', auth, getMatchById);
router.post('/', auth, createMatch);
router.post('/:id/join', auth, joinMatch);
router.post('/:id/leave', auth, leaveMatch);
router.post('/:id/cancel', auth, cancelMatch);
router.get('/:id/messages', auth, getMatchMessages);
router.post('/:id/messages', auth, sendMatchMessage);

export default router;

