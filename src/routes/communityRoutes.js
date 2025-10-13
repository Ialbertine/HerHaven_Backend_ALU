const express = require("express");
const router = express.Router();
const { optionalAuth, adminAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/roleAuth");
const {
  createPost,
  getAllPosts,
  getSinglePost,
  updatePost,
  deletePost,
  likePost,
  createComment,
  getPostComments,
  updateComment,
  deleteComment,
  likeComment,
  getAllPostsAdmin,
  restorePost
} = require("../controllers/communityController");
const {
  validateCreatePost,
  validateUpdatePost,
  validateCreateComment,
  validateUpdateComment
} = require('../validations/postValidation');

// POST ROUTES
router.post("/posts", optionalAuth, validateCreatePost, createPost);
router.get("/all-posts", getAllPosts);
router.get("/posts/:id", getSinglePost);
router.put("/posts/:id", optionalAuth, validateUpdatePost, updatePost);
router.delete("/posts/:id", optionalAuth, deletePost);
router.post("/posts/:id/like", optionalAuth, likePost);

// COMMENT ROUTES
router.post("/posts/:postId/comments", optionalAuth, validateCreateComment, createComment);
router.get("/posts/:postId/all-comments", getPostComments);
router.put("/comments/:id", optionalAuth, validateUpdateComment, updateComment);
router.delete("/comments/:id", optionalAuth, deleteComment);
router.post("/comments/:id/like", optionalAuth, likeComment);

// ADMIN ROUTES
router.get("/admin/posts", adminAuth, requireAdmin, getAllPostsAdmin);
router.patch("/admin/posts/:id/restore", adminAuth, requireAdmin, restorePost);

module.exports = router;