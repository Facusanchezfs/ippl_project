import React, { useState, useEffect, useCallback } from 'react';
import postsService, { Post } from '../services/posts.service';
import { CalendarIcon, EyeIcon, HeartIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { getImageUrl } from '../utils/imageUtils';
import { useAuth } from '../context/AuthContext';
import { getFriendlyErrorMessage, ErrorMessages } from '../utils/errorMessages';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useParams } from 'react-router-dom';

const BlogPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [featuredPost, setFeaturedPost] = useState<Post>();
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [isLiking, setIsLiking] = useState(false);
  const { section } = useParams<{ section?: string }>();

  useEffect(() => {
    AOS.init({ duration: 900, once: true });
  }, []);

  const loadPostsCb = useCallback(() => {
    return loadPosts();
  }, [section]);

  useEffect(() => {
    loadPostsCb();
  }, [loadPostsCb]);

  useEffect(() => {
    if (user && posts.length > 0) {
      checkLikedPosts();
    }
  }, [user, posts]);

  const checkLikedPosts = async () => {
    try {
      const likedStatus: { [key: string]: boolean } = {};
      for (const post of posts) {
        const isLiked = await postsService.checkIfLiked(post.id);
        likedStatus[post.id] = isLiked;
      }
      setLikedPosts(likedStatus);
    } catch (error) {
      console.error('Error al verificar likes:', error);
    }
  };


  const loadPosts = async () => {
    try {
      setIsLoading(true);
      let response
      if(section){
        response = await postsService.getPostBySection(section);
      } else{
        response = await postsService.getAllPosts();
      }

      if(response.posts.length == 0) return;

      let featuredPost;
      let restOfPosts = response.posts;

      // Chequear si hay al menos un featured
      const featuredIndex = response.posts.findIndex((post) => post.featured);

      if (featuredIndex !== -1) {
        // Usar el primero con featured = true
        featuredPost = response.posts[featuredIndex];
         restOfPosts = [
           ...response.posts.slice(0, featuredIndex),
          ...response.posts.slice(featuredIndex + 1),
         ];
       } else {
         // Si no hay featured, usar el primero del array
          featuredPost = response.posts[0];
          restOfPosts = response.posts.slice(1);
       }
      
      setFeaturedPost(featuredPost);
      setPosts(restOfPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.POST_LOAD_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostClick = async (post: Post) => {
    setSelectedPost(post);
    try {
      const { views } = await postsService.incrementViews(post.id);
      setPosts(posts.map(p => 
        p.id === post.id ? { ...p, views } : p
      ));
    } catch (error) {
      console.error('Error al incrementar vistas:', error);
    }
  };

  const handleLike = async (postId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (isLiking) return;

    try {
      setIsLiking(true);
      const { likes } = await postsService.toggleLike(postId);
      
      // Actualizar el contador de likes y el estado del like en la lista de posts
      setPosts(posts.map(post => 
        post.id === postId ? { ...post, likes } : post
      ));

      // Actualizar el post seleccionado si está abierto
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, likes } : null);
      }

      toast.success('¡Gracias por tu like!');
    } catch (error) {
      console.error('Error al gestionar like:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudo procesar tu like. Intenta nuevamente.');
      toast.error(friendlyMessage);
    } finally {
      setIsLiking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00796B]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* === Magazine Layout (Tailwind Only) === */}
      <div className="min-h-screen bg-white">
        <main className="max-w-6xl mx-auto px-4 py-10">
          {/* Page Header */}
          <div className="text-center mb-16" data-aos="fade-up">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
              Blog IPPL
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-3xl mx-auto">
              Artículos, noticias y recursos sobre psicología y salud mental
            </p>
          </div>


          {/* === Featured Post === */}
          {featuredPost && (
            <article
              className="mb-14 group cursor-pointer"
              onClick={() => handlePostClick(featuredPost)}
              data-aos="zoom-in-up"
            >
              <div className="relative overflow-hidden rounded-xl bg-gray-100">
                <div className="w-full">
                  {featuredPost.thumbnail ? (
                    <img
                      src={getImageUrl(featuredPost.thumbnail)}
                      alt={featuredPost.title}
                      className="w-full h-auto max-h-96 object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-64 grid place-items-center text-gray-400">Sin imagen</div>
                  )}
                </div>

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Content over image */}
                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    {featuredPost.tags && featuredPost.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {featuredPost.tags.map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-sm text-white/90">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{new Date(featuredPost.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold mb-3 group-hover:text-teal-300 transition-colors">
                    {featuredPost.title}
                  </h2>

                  {featuredPost.excerpt && (
                    <p className="text-white/90 mb-4 max-w-3xl">{featuredPost.excerpt}</p>
                  )}

                  <div className="flex items-center gap-6 text-sm text-white/90">
                    <div className="flex items-center gap-1">
                      <EyeIcon className="h-4 w-4" />
                      <span>{featuredPost.views?.toLocaleString?.() ?? featuredPost.views ?? 0}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(featuredPost.id, e);
                      }}
                      className={`flex items-center gap-1 transition-colors ${
                        likedPosts[featuredPost.id] ? 'text-teal-300' : 'hover:text-teal-200'
                      }`}
                    >
                      {likedPosts[featuredPost.id] ? (
                        <HeartSolidIcon className="h-4 w-4" />
                      ) : (
                        <HeartIcon className="h-4 w-4" />
                      )}
                      <span>{featuredPost.likes || 0}</span>
                    </button>
                    {featuredPost.readTime && <span>{featuredPost.readTime} de lectura</span>}
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* === Posts Grid (restPosts) === */}
          <div className="grid gap-8 md:grid-cols-2">
            {posts.map((post, idx) => (
              <article
                key={post.id}
                className="group cursor-pointer"
                onClick={() => handlePostClick(post)}
                data-aos="zoom-in-up"
                data-aos-delay={idx * 80}
              >
                {/* Image */}
                <div className="overflow-hidden rounded-lg bg-gray-100 mb-4">
                  <div className="w-full">
                    {post.thumbnail ? (
                      <img
                        src={getImageUrl(post.thumbnail)}
                        alt={post.title}
                        className="w-full h-auto max-h-64 object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-48 grid place-items-center text-gray-400">Sin imagen</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Tags + date */}
                  <div className="flex items-center flex-wrap gap-3">
                    {post.tags?.[0] && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-800 px-2.5 py-1 text-xs font-medium">
                        {post.tags[0]}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <CalendarIcon className="h-4 w-4" />
                      <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-teal-700 transition-colors leading-tight">
                    {post.title}
                  </h3>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p className="text-gray-600 leading-relaxed">{post.excerpt}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <EyeIcon className="h-4 w-4" />
                        <span>{post.views?.toLocaleString?.() ?? post.views ?? 0}</span>
                      </div>
                      <button
                        onClick={(e) => handleLike(post.id, e)}
                        className={`flex items-center gap-1 transition-colors ${
                          likedPosts[post.id] ? 'text-teal-700' : 'hover:text-teal-700'
                        }`}
                      >
                        {likedPosts[post.id] ? (
                          <HeartSolidIcon className="h-4 w-4" />
                        ) : (
                          <HeartIcon className="h-4 w-4" />
                        )}
                        <span>{post.likes || 0}</span>
                      </button>
                    </div>
                    {post.readTime && (
                      <span className="text-sm text-gray-500">{post.readTime}</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        {/* === Modal de Post (tu versión actual, sin cambios funcionales) === */}
          {selectedPost && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto relative shadow-2xl">
              {/* Botón de cerrar */}
              <button
                onClick={() => setSelectedPost(null)}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg text-gray-600 hover:text-red-600 hover:bg-red-50 transform hover:scale-110 transition-all duration-200 z-50"
                aria-label="Cerrar"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>

              {/* Imagen hero ocupando altura */}
              {selectedPost.thumbnail && (
                <div className="relative w-full h-[70vh] flex items-center justify-center bg-black rounded-t-2xl">
                  <img
                    src={getImageUrl(selectedPost.thumbnail)}
                    alt={selectedPost.title}
                    className="max-w-full max-h-full object-contain rounded-t-2xl"
                  />
                  {/* overlay sutil para efecto magazine */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent rounded-t-2xl"></div>
                  <div className="absolute bottom-6 left-6 text-white">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedPost.tags?.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 backdrop-blur-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <h1 className="text-4xl font-extrabold drop-shadow-lg">{selectedPost.title}</h1>
                  </div>
                </div>
              )}

              {/* Contenido */}
              <article className="p-8 prose prose-lg max-w-none">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-8 border-b pb-4">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {new Date(selectedPost.createdAt).toLocaleDateString()}
                    </span>
                    <span className="flex items-center">
                      <EyeIcon className="h-4 w-4 mr-1" />
                      {selectedPost.views || 0} vistas
                    </span>
                    <button
                      onClick={(e) => handleLike(selectedPost.id, e)}
                      className={`flex items-center transition-colors ${
                        likedPosts[selectedPost.id]
                          ? 'text-teal-700 hover:text-teal-800'
                          : 'text-gray-500 hover:text-teal-700'
                      }`}
                    >
                      {likedPosts[selectedPost.id] ? (
                        <HeartSolidIcon className="h-4 w-4 mr-1" />
                      ) : (
                        <HeartIcon className="h-4 w-4 mr-1" />
                      )}
                      {selectedPost.likes || 0} likes
                    </button>
                  </div>
                  {selectedPost.readTime && (
                    <span className="text-teal-700 font-medium">{selectedPost.readTime}</span>
                  )}
                </div>

                <div dangerouslySetInnerHTML={{ __html: selectedPost.content }} />
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage; 