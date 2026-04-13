import { Router } from 'express';
const router = Router();
import auth, { optionalAuth } from '../middleware/auth';
import { uploadPostMedia } from '../middleware/upload.middleware';
import { createPost, getAllPosts, getPostById, deletePost, likePost, unlikePost, getComments, addComment, sharePost } from '../controllers/post.controller';

router.get('/', optionalAuth, getAllPosts);
router.post('/', auth, uploadPostMedia.array('files', 10), createPost);
router.get('/:id', optionalAuth, getPostById);
router.post('/:id/like', auth, likePost);
router.delete('/:id/like', auth, unlikePost);
router.post('/:id/share', auth, sharePost);
router.get('/:id/comments', getComments);
router.post('/:id/comments', auth, addComment);
router.delete('/:id', auth, deletePost);

export default router;
