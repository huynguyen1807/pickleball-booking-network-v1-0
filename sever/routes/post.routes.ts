import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { createPost, getAllPosts, deletePost } from '../controllers/post.controller';

router.get('/', getAllPosts);
router.post('/', auth, createPost);
router.delete('/:id', auth, deletePost);

export default router;

