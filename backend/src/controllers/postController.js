const { Op } = require('sequelize');
const { Post, sequelize } = require('../../models');
const { toPostDTO, toPostDTOList } = require('../../mappers/PostMapper');
const {toArray} = require("funciones-basicas");

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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')    // quita símbolos
    .trim()
    .replace(/\s+/g, '-')            // espacios -> guiones
    .replace(/-+/g, '-');            // colapsa guiones
}

function calculateWeeklyVisits(posts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const lastWeek = Array(7).fill(0);

  for (const post of posts) {
    const vb = Array.isArray(post.viewedBy) ? post.viewedBy : [];

    for (const v of vb) {
      // Soporte para { date: string } (formato esperado por el helper original)
      if (v && typeof v === 'object' && v.date) {
        const viewDate = new Date(v.date);
        if (isNaN(viewDate.getTime())) continue;
        // normalizamos a medianoche
        viewDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((today - viewDate) / dayMs);
        if (diffDays >= 0 && diffDays < 7) {
          lastWeek[6 - diffDays] += 1;
        }
      }
      // Si es string (id) no hay timestamp -> no podemos ubicarlo en la semana: lo ignoramos.
    }
  }

  return lastWeek;
}

const getAllPosts = async (req, res) => {
  try {
    const posts = await Post.findAll({
      where: { active: true },                 // ✅ solo activos
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    });
    return res.json({ posts: toPostDTOList(posts) });
  } catch (error) {
    console.error('Error al obtener posts:', error);
    return res.status(500).json({ message: 'Error al obtener posts' });
  }
};

const getPostBySection = async (req, res) =>{
  const {section} = req.params;
  try{
    const posts = await Post.findAll({
      where: {active: true, section},
      order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    });
    return res.json({posts: toPostDTOList(posts)});
  } catch (e){
    console.error("Error loading posts by section");
    return res.status(500).json({ message: 'Error loading posts by section' });
  }
}

const getPostBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const post = await Post.findOne({ where: { slug, active: true } }); // ✅
    if (!post) return res.status(404).json({ message: 'Post no encontrado' });
    return res.json({ post: toPostDTO(post) });
  } catch (error) {
    console.error('Error al obtener post por slug:', error);
    return res.status(500).json({ message: 'Error al obtener el post' });
  }
};

const createPost = async (req, res) => {
  try {
    const {
      title,
      content,
      section,
      excerpt = '',
      tags,
      seo,
      status = 'draft',
      slug,               // opcional
      featured,           // opcional
      readTime,           // opcional
    } = req.body;

    const authorId = req.user?.id;
    const authorName = req.user?.name;

    if (!title || !content || !section) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos (título, contenido o sección)',
      });
    }

    const tagsJson = tryParseJSON(tags, toArray(tags));
    const seoJson = tryParseJSON(seo, typeof seo === 'object' && seo ? seo : {});

    // Generar slug automáticamente, siempre debido a que el modelo NO ADMITE NULL en slug
      const base = slug ? slugify(slug) : slugify(title);
      let uniqueSlug = base;
      let suffix = 1;
      while (await Post.findOne({ where: { slug: uniqueSlug } })) {
          uniqueSlug = `${base}-${suffix++}`;
      }


    const filePath = req.file ? req.file.filename : null;

    const created = await Post.create({
      title,
      content,
      section,
      excerpt,
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

    return res.status(201).json({
      success: true,
      message: 'Post creado correctamente',
      post: toPostDTO(created),
    });
  } catch (error) {
    console.error('Error al crear post:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor al crear el post',
      error: error.message,
    });
  }
};

const updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post || !post.active) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Autorización: autor o admin
    const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
    const isAdmin = req.user?.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const {
      title, content, section, excerpt, tags, seo,
      status, slug, featured, readTime,
    } = req.body;

    const updates = {};

    if (title != null) updates.title = title;
    if (content != null) updates.content = content;
    if (section != null) updates.section = section;
    if (excerpt != null) updates.excerpt = excerpt;
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
      // Si se vuelve a draft NO borro publishedAt, salvo que venga explícito:
      if (status === 'draft' && req.body.publishedAt === null) {
        updates.publishedAt = null;
      }
    }
    await post.update(updates);
    return res.json(toPostDTO(post));
  } catch (error) {
    console.error('Error al actualizar post:', error);
    return res.status(500).json({ message: 'Error al actualizar post' });
  }
};

const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findByPk(id);
    if (!post || !post.active) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
    const isAdmin = req.user?.role === 'admin';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await post.update({ active: false });
    return res.json({ message: 'Post eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar post:', error);
    return res.status(500).json({ message: 'Error al eliminar post' });
  }
};

// GET /posts/:id  →  Post plano (compat con tu ruta actual)
const getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findByPk(id);
    if (!post) {
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Ocultamos los soft-deleted a menos que sea admin o autor
    if (post.active === false) {
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = String(post.authorId ?? '') === String(req.user?.id ?? '');
      if (!isAdmin && !isAuthor) {
        return res.status(404).json({ message: 'Post no encontrado' });
      }
    }

    return res.json(toPostDTO(post)); // respuesta plana
  } catch (error) {
    console.error('Error al obtener post por id:', error);
    return res.status(500).json({ message: 'Error al obtener el post' });
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
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    // Ocultar soft-deleted para no admin/no autor
    if (post.active === false) {
      const isAdmin = req.user?.role === 'admin';
      const isAuthor = String(post.authorId ?? '') === userId;
      if (!isAdmin && !isAuthor) {
        return res.status(404).json({ message: 'Post no encontrado' });
      }
    }

    const viewedArr = Array.isArray(post.viewedBy) ? post.viewedBy : [];
    const isViewed = viewedArr.map(String).includes(userId);

    return res.json({ isViewed });
  } catch (error) {
    console.error('Error al verificar vista:', error);
    return res.status(500).json({ message: 'Error al verificar la vista' });
  }
};

const incrementPostView = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await sequelize.transaction(async (t) => {
      const post = await Post.findByPk(id, {
        attributes: ['id', 'active', 'views'],
        transaction: t,
        lock: t.LOCK.UPDATE, // evita condiciones de carrera
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

    return res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Error al incrementar vista:', error);
    return res.status(500).json({ message: 'Error al incrementar la vista' });
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

    return res.json(result);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    console.error('Error al incrementar like:', error);
    return res.status(500).json({ message: 'Error al incrementar el like' });
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
      return res.status(404).json({ message: 'Post no encontrado' });
    }

    const likedBy = Array.isArray(post.likedBy)
      ? post.likedBy.map(String)
      : [];

    const isLiked = likedBy.includes(userId);

    return res.json({ isLiked });
  } catch (error) {
    console.error('Error al verificar like:', error);
    return res.status(500).json({ message: 'Error al verificar el like' });
  }
};

const getPostsStats = async (req, res) => {
  try {
    // Traemos sólo lo que necesitamos
    const posts = await Post.findAll({
      where: { active: true },
      attributes: ['views', 'likes', 'viewedBy'],
      raw: true,
    });

    const users = await User.findAll({
      attributes: ['role', 'status'],
      raw: true,
    });

    const totalPosts  = posts.length;
    const totalViews  = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalLikes  = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalVisits = totalViews; // compat con el legacy

    const activeDoctors = users.filter(
      u => u.role === 'professional' && u.status === 'active'
    ).length;

    // En el legacy: activeUsers = !isDoctor. Aquí: todos los activos que NO son 'professional'.
    const activeUsers = users.filter(
      u => u.role !== 'professional' && u.status === 'active'
    ).length;

    const weeklyVisits = calculateWeeklyVisits(posts);

    return res.json({
      totalVisits,
      activeUsers,
      activeDoctors,
      totalPosts,
      totalLikes,
      totalViews,
      weeklyVisits,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ message: 'Error al obtener estadísticas' });
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