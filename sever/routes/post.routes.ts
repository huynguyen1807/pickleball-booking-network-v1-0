import { Router } from 'express';
const router = Router();
import auth from '../middleware/auth';
import { createPost, getAllPosts, getPostById, deletePost, likePost, unlikePost, getComments, addComment, sharePost } from '../controllers/post.controller';

router.get('/', getAllPosts);
router.post('/', auth, createPost);
router.get('/:id', getPostById);
router.post('/:id/like', auth, likePost);
router.delete('/:id/like', auth, unlikePost);
router.post('/:id/share', auth, sharePost);
router.get('/:id/comments', getComments);
router.post('/:id/comments', auth, addComment);
router.delete('/:id', auth, deletePost);

export default router;
