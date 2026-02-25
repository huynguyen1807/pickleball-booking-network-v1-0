const router = require('express').Router();
const auth = require('../middleware/auth');
const { createPost, getAllPosts, deletePost } = require('../controllers/post.controller');

router.get('/', getAllPosts);
router.post('/', auth, createPost);
router.delete('/:id', auth, deletePost);

module.exports = router;
