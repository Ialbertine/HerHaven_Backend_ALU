const CommunityPost = require("../models/community");
const Comment = require("../models/comment");
const { validateObjectId, sanitizeHtml } = require('../validations/postValidation');
const logger = require('../utils/logger');

// Create a new post
const createPost = async (req, res) => {
  try {
    const { title, content, tags, isAnonymous } = req.body;

    const sanitizedTitle = sanitizeHtml(title);
    const sanitizedContent = sanitizeHtml(content);
    const sanitizedTags = tags ? tags.map(tag => sanitizeHtml(tag)) : [];

    let author = null;
    let authorType = "guest";
    let authorName = "Anonymous User";

    if (req.user) {
      author = req.user._id;
      authorType = "authenticated";
      
      // Set author name based on user type and anonymity preference
      if (isAnonymous) {
        authorName = "Anonymous";
      } else {
        switch (req.user.role) {
          case 'user':
            authorName = req.user.username;
            break;
          case 'counselor':
            authorName = `Counselor ${req.user.firstName}`;
            break;
          case 'admin':
          case 'super_admin':
            authorName = `Admin ${req.user.firstName}`;
            break;
          default:
            authorName = `${req.user.firstName} ${req.user.lastName}`;
        }
      }
    }

    const post = new CommunityPost({
      title: sanitizedTitle,
      content: sanitizedContent,
      author,
      authorType,
      authorName,
      tags: sanitizedTags,
      isAnonymous: isAnonymous || false
    });

    await post.save();

    // Populate author if authenticated user
    if (author) {
      await post.populate("author", "firstName lastName avatar role");
    }

    logger.info(`New post created by ${authorType} user: ${post._id}`, {
      postId: post._id,
      authorType,
      authorId: author,
      isAnonymous
    });

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post
    });
  } catch (error) {
    logger.error("Create post error:", {
      error: error.message,
      stack: error.stack,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error creating post",
      error: error.message
    });
  }
};

// Get all posts with pagination
// GET /api/community/posts
const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { isActive: true };
    
    if (req.query.tags) {
      const sanitizedTags = req.query.tags.split(",").map(tag => 
        sanitizeHtml(tag.trim())
      );
      filter.tags = { $in: sanitizedTags };
    }

    if (req.query.author) {
      filter.author = validateObjectId(req.query.author) 
        ? req.query.author 
        : null;
    }

    // Get posts with population
    const posts = await CommunityPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "firstName lastName avatar role")
      .lean();

    // Get total count for pagination
    const total = await CommunityPost.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    logger.debug(`Fetched ${posts.length} posts for page ${page}`, {
      page,
      limit,
      total,
      filter
    });

    res.json({
      success: true,
      data: posts,
      pagination: {
        current: page,
        pages: totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error("Get posts error:", {
      error: error.message,
      stack: error.stack,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: "Server error fetching posts"
    });
  }
};

// Get single post
// GET /api/community/posts/:id
const getSinglePost = async (req, res) => {
  try {
    // Validate post ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await CommunityPost.findOne({
      _id: req.params.id,
      isActive: true
    }).populate("author", "firstName lastName avatar role");

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    logger.debug(`Post fetched: ${post._id}`, { postId: post._id });

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    logger.error("Get post error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id
    });
    res.status(500).json({
      success: false,
      message: "Server error fetching post"
    });
  }
};

// Update a post
// PUT /api/community/posts/:id
const updatePost = async (req, res) => {
  try {
    const { title, content, tags, isAnonymous } = req.body;
    
    // Validate post ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await CommunityPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check ownership or admin privileges
    const isOwner = req.user && post.author && post.author.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      logger.warn(`Unauthorized post update attempt by user: ${req.user?._id}`, {
        userId: req.user?._id,
        postId: post._id,
        isOwner,
        isAdmin
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this post"
      });
    }

    // Sanitize and update fields
    if (title) post.title = sanitizeHtml(title);
    if (content) post.content = sanitizeHtml(content);
    if (tags) post.tags = tags.map(tag => sanitizeHtml(tag));
    if (isAnonymous !== undefined) post.isAnonymous = isAnonymous;

    // Update author name if user is authenticated and not anonymous
    if (req.user && !isAnonymous) {
      switch (req.user.role) {
        case 'user':
          post.authorName = `${req.user.firstName} ${req.user.lastName}`;
          break;
        case 'counselor':
          post.authorName = `Counselor ${req.user.firstName}`;
          break;
        case 'admin':
        case 'super_admin':
          post.authorName = `Admin ${req.user.firstName}`;
          break;
        default:
          post.authorName = `${req.user.firstName} ${req.user.lastName}`;
      }
    }

    await post.save();
    await post.populate("author", "firstName lastName avatar role");

    logger.info(`Post updated: ${post._id}`, {
      postId: post._id,
      updatedBy: req.user?._id
    });

    res.json({
      success: true,
      message: "Post updated successfully",
      data: post
    });
  } catch (error) {
    logger.error("Update post error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error updating post"
    });
  }
};

// Delete a post
// DELETE /api/community/posts/:id
const deletePost = async (req, res) => {
  try {
    // Validate post ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await CommunityPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Check ownership or admin privileges
    const isOwner = req.user && post.author && post.author.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      logger.warn(`Unauthorized post deletion attempt by user: ${req.user?._id}`, {
        userId: req.user?._id,
        postId: post._id
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this post"
      });
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    logger.info(`Post deleted: ${post._id}`, {
      postId: post._id,
      deletedBy: req.user?._id,
      authorType: post.authorType
    });

    res.json({
      success: true,
      message: "Post deleted successfully"
    });
  } catch (error) {
    logger.error("Delete post error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error deleting post"
    });
  }
};

// Like/unlike a post
// POST /api/community/posts/:id/like
const likePost = async (req, res) => {
  try {
    // Validate post ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await CommunityPost.findById(req.params.id);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // For likes, we require authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for liking posts"
      });
    }

    const hasLiked = post.likes.includes(req.user._id);

    if (hasLiked) {
      // Unlike
      post.likes = post.likes.filter(
        like => like.toString() !== req.user._id.toString()
      );
      post.likeCount = Math.max(0, post.likeCount - 1);
    } else {
      // Like
      post.likes.push(req.user._id);
      post.likeCount += 1;
    }

    await post.save();

    logger.debug(`Post ${hasLiked ? 'unliked' : 'liked'}`, {
      postId: post._id,
      userId: req.user._id,
      action: hasLiked ? 'unlike' : 'like'
    });

    res.json({
      success: true,
      message: hasLiked ? "Post unliked" : "Post liked",
      data: {
        liked: !hasLiked,
        likeCount: post.likeCount
      }
    });
  } catch (error) {
    logger.error("Like post error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error updating like"
    });
  }
};

// Create a comment
// POST /api/community/posts/:postId/comments
const createComment = async (req, res) => {
  try {
    const { content, parentComment, isAnonymous } = req.body;
    const postId = req.params.postId;

    // Validate post ID
    if (!validateObjectId(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    // Validate post exists
    const post = await CommunityPost.findOne({ _id: postId, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Sanitize content
    const sanitizedContent = sanitizeHtml(content);

    // Determine author info
    let author = null;
    let authorType = "guest";
    let authorName = "Anonymous User";

    if (req.user) {
      author = req.user._id;
      authorType = "authenticated";
      
      if (isAnonymous) {
        authorName = "Anonymous";
      } else {
        switch (req.user.role) {
          case 'user':
            authorName = req.user.username;
            break;
          case 'counselor':
            authorName = `Counselor ${req.user.firstName}`;
            break;
          case 'admin':
          case 'super_admin':
            authorName = `Admin ${req.user.firstName}`;
            break;
          default:
            authorName = req.user.username;
        }
      }
    }

    const comment = new Comment({
      content: sanitizedContent,
      author,
      authorType,
      authorName,
      post: postId,
      parentComment: parentComment || null,
      isAnonymous: isAnonymous || false
    });

    await comment.save();

    // Update post comment count
    post.commentCount += 1;
    await post.save();

    // Populate author if authenticated
    if (author) {
      await comment.populate("author", "firstName lastName avatar role");
    }

    logger.info(`New comment created on post: ${postId}`, {
      commentId: comment._id,
      postId,
      authorType,
      authorId: author,
      isAnonymous
    });

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: comment
    });
  } catch (error) {
    logger.error("Create comment error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.postId,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error creating comment"
    });
  }
};

// Get comments for a post
// GET /api/community/posts/:postId/comments
const getPostComments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Validate post ID
    if (!validateObjectId(req.params.postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const comments = await Comment.find({
      post: req.params.postId,
      isActive: true,
      parentComment: null // Only top-level comments
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "firstName lastName avatar role")
      .lean();

    // Get total count
    const total = await Comment.countDocuments({
      post: req.params.postId,
      isActive: true,
      parentComment: null
    });

    const totalPages = Math.ceil(total / limit);

    logger.debug(`Fetched ${comments.length} comments for post: ${req.params.postId}`, {
      postId: req.params.postId,
      page,
      limit,
      total
    });

    res.json({
      success: true,
      data: comments,
      pagination: {
        current: page,
        pages: totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error("Get comments error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.postId,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: "Server error fetching comments"
    });
  }
};

// Update a comment
// PUT /api/community/comments/:id
const updateComment = async (req, res) => {
  try {
    const { content, isAnonymous } = req.body;
    
    // Validate comment ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Check ownership or admin privileges
    const isOwner = req.user && comment.author && comment.author.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      logger.warn(`Unauthorized comment update attempt by user: ${req.user?._id}`, {
        userId: req.user?._id,
        commentId: comment._id
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this comment"
      });
    }

    if (content) comment.content = sanitizeHtml(content);
    if (isAnonymous !== undefined) comment.isAnonymous = isAnonymous;

    // Update author name if user is authenticated and not anonymous
    if (req.user && !isAnonymous) {
      switch (req.user.role) {
        case 'user':
          comment.authorName = req.user.username;
          break;
        case 'counselor':
          comment.authorName = `Counselor ${req.user.firstName}`;
          break;
        case 'admin':
        case 'super_admin':
          comment.authorName = `Admin ${req.user.firstName}`;
          break;
        default:
          comment.authorName = req.user.username;
      }
    }

    await comment.save();
    await comment.populate("author", "firstName lastName avatar role");

    logger.info(`Comment updated: ${comment._id}`, {
      commentId: comment._id,
      updatedBy: req.user?._id
    });

    res.json({
      success: true,
      message: "Comment updated successfully",
      data: comment
    });
  } catch (error) {
    logger.error("Update comment error:", {
      error: error.message,
      stack: error.stack,
      commentId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error updating comment"
    });
  }
};

// Delete a comment
// DELETE /api/community/comments/:id
const deleteComment = async (req, res) => {
  try {
    // Validate comment ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // Check ownership or admin privileges
    const isOwner = req.user && comment.author && comment.author.toString() === req.user._id.toString();
    const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      logger.warn(`Unauthorized comment deletion attempt by user: ${req.user?._id}`, {
        userId: req.user?._id,
        commentId: comment._id
      });
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment"
      });
    }

    // Soft delete
    comment.isActive = false;
    await comment.save();

    // Update post comment count
    await CommunityPost.findByIdAndUpdate(comment.post, {
      $inc: { commentCount: -1 }
    });

    logger.info(`Comment deleted: ${comment._id}`, {
      commentId: comment._id,
      deletedBy: req.user?._id,
      postId: comment.post
    });

    res.json({
      success: true,
      message: "Comment deleted successfully"
    });
  } catch (error) {
    logger.error("Delete comment error:", {
      error: error.message,
      stack: error.stack,
      commentId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error deleting comment"
    });
  }
};

// Like/unlike a comment
// POST /api/community/comments/:id/like
const likeComment = async (req, res) => {
  try {
    // Validate comment ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid comment ID"
      });
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment || !comment.isActive) {
      return res.status(404).json({
        success: false,
        message: "Comment not found"
      });
    }

    // For likes, we require authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for liking comments"
      });
    }

    const hasLiked = comment.likes.includes(req.user._id);

    if (hasLiked) {
      // Unlike
      comment.likes = comment.likes.filter(
        like => like.toString() !== req.user._id.toString()
      );
      comment.likeCount = Math.max(0, comment.likeCount - 1);
    } else {
      // Like
      comment.likes.push(req.user._id);
      comment.likeCount += 1;
    }

    await comment.save();

    logger.debug(`Comment ${hasLiked ? 'unliked' : 'liked'}`, {
      commentId: comment._id,
      userId: req.user._id,
      action: hasLiked ? 'unlike' : 'like'
    });

    res.json({
      success: true,
      message: hasLiked ? "Comment unliked" : "Comment liked",
      data: {
        liked: !hasLiked,
        likeCount: comment.likeCount
      }
    });
  } catch (error) {
    logger.error("Like comment error:", {
      error: error.message,
      stack: error.stack,
      commentId: req.params.id,
      userId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error updating like"
    });
  }
};

// get all posts including inactive
// GET /api/community/admin/posts
const getAllPostsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Admins can see all posts, including inactive ones
    const filter = {};
    
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }

    if (req.query.author) {
      if (validateObjectId(req.query.author)) {
        filter.author = req.query.author;
      }
    }

    const posts = await CommunityPost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "firstName lastName avatar role email")
      .lean();

    const total = await CommunityPost.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    logger.info(`Admin fetched posts with filter`, {
      adminId: req.user?._id,
      filter,
      page,
      total
    });

    res.json({
      success: true,
      data: posts,
      pagination: {
        current: page,
        pages: totalPages,
        total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error("Admin get posts error:", {
      error: error.message,
      stack: error.stack,
      adminId: req.user?._id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      message: "Server error fetching posts"
    });
  }
};

// Restore a deleted post, Admin only
// PATCH /api/community/admin/posts/:id/restore
const restorePost = async (req, res) => {
  try {
    // Validate post ID
    if (!validateObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await CommunityPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    post.isActive = true;
    await post.save();

    logger.info(`Post restored by admin: ${post._id}`, {
      postId: post._id,
      adminId: req.user?._id
    });

    res.json({
      success: true,
      message: "Post restored successfully",
      data: post
    });
  } catch (error) {
    logger.error("Restore post error:", {
      error: error.message,
      stack: error.stack,
      postId: req.params.id,
      adminId: req.user?._id
    });
    res.status(500).json({
      success: false,
      message: "Server error restoring post"
    });
  }
};

module.exports = {
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
};