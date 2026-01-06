const { Op } = require('sequelize');
const { Post, sequelize, User } = require('../../models');
const { toPostDTO, toPostDTOList } = require('../../mappers/PostMapper');
const {toArray} = require("funciones-basicas");
const logger = require('../utils/logger');
const { sendSuccess, sendError } = require('../utils/response');

function tryParseJSON(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function calculateWeeklyVisits(posts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const lastWeek = Array(7).fill(0);

  for (const post of posts) {
    const vb = Array.isArray(post.viewedBy) ? post.viewedBy : [];

    for (const v of vb) {
      if (v && typeof v === 'object' && v.date) {
        const viewDate = new Date(v.date);
        if (isNaN(viewDate.getTime())) continue;
        viewDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - viewDate) / dayMs);
        if (diffDays >= 0 && diffDays < 7) {
          lastWeek[6 - diffDays] += 1;
        }
      }
    }
  }

  return lastWeek;
}

const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { active: true },
      attributes: { exclude: ['content'] },
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    });
    return sendSuccess(res, { posts: toPostDTOList(posts) });
  } catch (error) {
    logger.error('Error al obtener posts:', error);
    return sendError(res, 500, 'Error al obtener posts');
  }
};

const getPostBySection = async (req, res) =>{
  const {section} = req.params;
  try{
    const posts = await Post.findAll({
      where: {active: true, section},
      attributes: { exclude: ['content'] },
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    });
    return sendSuccess(res, { posts: toPostDTOList(posts) });
  } catch (e){
    logger.error("Error loading posts by section");
    return sendError(res, 500, 'Error loading posts by section');
  }
}

const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await Post.findOne({ where: { slug, active: true } });
    if (!post) return sendError(res, 404, 'Post no encontrado');
    return sendSuccess(res, { post: toPostDTO(post) });
  } catch (error) {
    logger.error('Error al obtener post por slug:', error);
    return sendError(res, 500, 'Error al obtener el post');
  }
};

const createPost = async (req, res) => {
  try {
    const {
      title,
      content,
      section,
      excerpt = '',
      description,
      tags,
      seo,
      status = 'draft',
      slug,
      featured,
      readTime,
    } = req.body;

    const authorId = req.user?.id;
    const authorName = req.user?.name;

    if (!title || !section) {
      return sendError(res, 400, 'Faltan campos requeridos (título o sección)');
    }

    const tagsJson = tryParseJSON(tags, toArray(tags));
    const seoJson = tryParseJSON(seo, typeof seo === 'object' && seo ? seo : {});

      const base = slug ? slugify(slug) : slugify(title);
      let uniqueSlug = base;
      let suffix = 1;
      while (await Post.findOne({ where: { slug: uniqueSlug } })) {
          uniqueSlug = `${base}-${suffix++}`;
      }


    const filePath = req.file ? req.file.filename : null;

    const created = await Post.create({
      title,
      content: content || '',
      section,
      excerpt,
      description: description || '',
      tags: tagsJson,
      seo: seoJson,
      authorId,
      authorName,
      status,
      slug: uniqueSlug,
      thumbnail: filePath,
      featured: typeof featured === 'boolean' ? featured : !!(featured === 'true'),
      readTime: readTime ?? '1 min',
      views: 0,
      likes: 0,
      comments: [],
      likedBy: [],
      viewedBy: [],
    });

    return sendSuccess(res, { post: toPostDTO(created) }, 'Post creado correctamente', 201);
  } catch (error) {
    logger.error('Error al crear post:', error);
    return sendError(res, 500, 'Error interno del servidor al crear el post');
  }
};

const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post || !post.active) {
      return sendError(res, 404, 'Post no encontrado');
    }

    const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
    const isAdmin = req.user?.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return sendError(res, 403, 'No autorizado');
    }

    const {
      title, content, section, excerpt, description, tags, seo,
      status, slug, featured, readTime,
    } = req.body;

    const updates = {};

    if (title != null) updates.title = title;
    if (content != null) updates.content = content;
    if (section != null) updates.section = section;
    if (excerpt != null) updates.excerpt = excerpt;
    if (description !== undefined) {
      updates.description = (description && description.trim()) ? description.trim() : null;
    }
    if (tags !== undefined) updates.tags = tryParseJSON(tags, Array.isArray(tags) ? tags : []);
    if (seo !== undefined) updates.seo = tryParseJSON(seo, typeof seo === 'object' && seo ? seo : {});

    if (req.file) {
        updates.thumbnail = req.file.filename;
    } else if(req.body.thumbnail === null || req.body.thumbnail === ""){
        updates.thumbnail = null;
    }

    if (featured !== undefined) {
      updates.featured = typeof featured === 'boolean' ? featured : !!(featured === 'true');
    }
    if (readTime !== undefined) updates.readTime = readTime;

    if (slug !== undefined && slug !== post.slug) {
        if(slug){
            const base = slugify(slug);
            let uniqueSlug = base, suffix = 1;
            while (await Post.findOne({ where: { slug: uniqueSlug, id: { [Op.ne]: id } } })) {
                uniqueSlug = `${base}-${suffix++}`;
            }
            updates.slug = uniqueSlug;
        } else {
            updates.slug = null;
        }
    }

    if (status !== undefined && status !== post.status) {
      updates.status = status;
      if (status === 'published' && !post.publishedAt) {
        updates.publishedAt = new Date();
      }
      if (status === 'draft' && req.body.publishedAt === null) {
        updates.publishedAt = null;
      }
    }
    await post.update(updates);
    await post.reload();
    return sendSuccess(res, toPostDTO(post), 'Post actualizado correctamente');
  } catch (error) {
    logger.error('Error al actualizar post:', error);
    return sendError(res, 500, 'Error al actualizar post');
  }
};

const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post || !post.active) {
      return sendError(res, 404, 'Post no encontrado');
    }

    const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
    const isAdmin = req.user?.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return sendError(res, 403, 'No autorizado');
    }

    await post.update({ active: false });
    return sendSuccess(res, null, 'Post eliminado correctamente', 204);
  } catch (error) {
    logger.error('Error al eliminar post:', error);
    return sendError(res, 500, 'Error al eliminar post');
  }
};

const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) {
      return sendError(res, 404, 'Post no encontrado');
    }

    if (post.active === false) {
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
      if (!isAdmin && !isAuthor) {
        return sendError(res, 404, 'Post no encontrado');
      }
    }

    return sendSuccess(res, toPostDTO(post));
  } catch (error) {
    logger.error('Error al obtener post por id:', error);
    return sendError(res, 500, 'Error al obtener el post');
  }
};

const checkPostViewed = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.user?.id ?? '');

    const post = await Post.findByPk(id, {
      attributes: ['id', 'authorId', 'active', 'viewedBy'],
    });

    if (!post) {
      return sendError(res, 404, 'Post no encontrado');
    }

    if (post.active === false) {
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = String(post.authorId ?? '') === userId;
      if (!isAdmin && !isAuthor) {
        return sendError(res, 404, 'Post no encontrado');
      }
    }

    const viewedArr = Array.isArray(post.viewedBy) ? post.viewedBy : [];
    const isViewed = viewedArr.map(String).includes(userId);

    return sendSuccess(res, { isViewed });
  } catch (error) {
    logger.error('Error al verificar vista:', error);
    return sendError(res, 500, 'Error al verificar la vista');
  }
};

const incrementPostView = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sequelize.transaction(async (t) => {
      const post = await Post.findByPk(id, {
        attributes: ['id', 'active', 'views'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!post || post.active === false) {
        const err = new Error('Post no encontrado');
        err.status = 404;
        throw err;
      }

      post.views = (post.views || 0) + 1;
      await post.save({ transaction: t });

      return { views: post.views };
    });

    return sendSuccess(res, result);
  } catch (error) {
    if (error.status === 404) {
      return sendError(res, 404, error.message);
    }
    logger.error('Error al incrementar vista:', error);
    return sendError(res, 500, 'Error al incrementar la vista');
  }
};

const togglePostLike = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sequelize.transaction(async (t) => {
      const post = await Post.findByPk(id, {
        attributes: ['id', 'active', 'likes'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!post || post.active === false) {
        const err = new Error('Post no encontrado');
        err.status = 404;
        throw err;
      }

      post.likes = (post.likes || 0) + 1;
      await post.save({ transaction: t });

      return { likes: post.likes };
    });

    return sendSuccess(res, result);
  } catch (error) {
    if (error.status === 404) {
      return sendError(res, 404, error.message);
    }
    logger.error('Error al incrementar like:', error);
    return sendError(res, 500, 'Error al incrementar el like');
  }
};


const checkPostLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.user.id);

    const post = await Post.findByPk(id, {
      attributes: ['id', 'active', 'likedBy'],
    });

    if (!post || post.active === false) {
      return sendError(res, 404, 'Post no encontrado');
    }

    const likedBy = Array.isArray(post.likedBy)
      ? post.likedBy.map(String)
      : [];

    const isLiked = likedBy.includes(userId);

    return sendSuccess(res, { isLiked });
  } catch (error) {
    logger.error('Error al verificar like:', error);
    return sendError(res, 500, 'Error al verificar el like');
  }
};

const getPostsStats = async (req, res) => {
  try {
    const { fn, col } = require('sequelize');
    
    const [postsAgg, usersByRole, postsForWeekly] = await Promise.all([
      Post.findAll({
        attributes: [
          [fn('COUNT', col('id')), 'totalPosts'],
          [fn('SUM', col('views')), 'totalViews'],
          [fn('SUM', col('likes')), 'totalLikes'],
        ],
        where: { active: true },
        raw: true,
      }),
      User.findAll({
        attributes: [
          'role',
          'status',
          [fn('COUNT', col('id')), 'count'],
        ],
        group: ['role', 'status'],
        raw: true,
      }),
      Post.findAll({
        where: { active: true },
        attributes: ['viewedBy'],
        raw: true,
      }),
    ]);

    const agg = postsAgg[0] || {};
    const totalPosts = parseInt(agg.totalPosts || 0, 10);
    const totalViews = parseInt(agg.totalViews || 0, 10);
    const totalLikes = parseInt(agg.totalLikes || 0, 10);
    const totalVisits = totalViews;

    let activeDoctors = 0;
    let activeUsers = 0;
    for (const row of usersByRole) {
      if (row.role === 'professional' && row.status === 'active') {
        activeDoctors = parseInt(row.count, 10);
      } else if (row.role !== 'professional' && row.status === 'active') {
        activeUsers += parseInt(row.count, 10);
      }
    }

    const weeklyVisits = calculateWeeklyVisits(postsForWeekly);

    return sendSuccess(res, {
      totalVisits,
      activeUsers,
      activeDoctors,
      totalPosts,
      totalLikes,
      totalViews,
      weeklyVisits,
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas:', error);
    return sendError(res, 500, 'Error al obtener estadísticas');
  }
};

module.exports = {
  getAllPosts,
  getPostBySection,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  getPostById,
  checkPostViewed,
  incrementPostView,
  togglePostLike,
  checkPostLike,
  getPostsStats
}; 