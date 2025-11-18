import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import postsService, { Post } from '../../services/posts.service';
import { getImageUrl } from '../../utils/imageUtils';
import ContentEditorModal from './ContentEditorModal.tsx';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { 
  PencilIcon, 
  TrashIcon, 
  PlusIcon,
  NewspaperIcon,
  TagIcon,
  EyeIcon,
  HeartIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  BookmarkIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon,
  ArrowLeftIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import contentManagementService from '../../services/content.service';
import userService, { UpdateUserData, User } from '../../services/user.service.ts';
import { parseNumber } from '../../utils/functionUtils.ts';
import ChangePasswordModal from '../professional/ChangePassword.tsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ContentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const fileInputRef= useRef<HTMLInputElement | null>(null);
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [hasSelectedFiles, setHasSelectedFiles] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);
  const [isDeleteCarouselModalOpen, setIsDeleteCarouselModalOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isPostModalToCreate, setIsPostModalToCreate] = useState(false);
  const [postToEdit, setPostToEdit] = useState<Post>();
  const [selectedPost, setSelectedPost] = useState<Post | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [userLoaded, setUserLoaded] = useState<User>();

  // Filtros disponibles
  const sectionOptions = [
    { value: 'all', label: 'Todas las secciones' },
    { value: 'ninos', label: 'Niños' },
    { value: 'adultos', label: 'Adultos' },
    { value: 'noticias', label: 'Noticias' }
  ];

  const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'published', label: 'Publicado' },
    { value: 'draft', label: 'Borrador' }
  ];

  useEffect(() => {
    if (user) {
      loadUser();
    }
  }, [user]);

  useEffect(() => {
    loadPosts();
    fetchCarouselImages();
  }, []);

  const loadUser = async () => {
    const userToLoad = await userService.getUserById(parseNumber(user?.id))
    setUserLoaded(userToLoad);
  }

  const loadPosts = async () => {
    try {
      setIsLoading(true);
      const response = await postsService.getAllPosts();
      setPosts(response.posts || []);
    } catch (error) {
      console.error('Error al cargar posts:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.POST_LOAD_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPosts();
    setIsRefreshing(false);
    toast.success('Contenido actualizado');
  };

  const getPostStats = () => {
    const published = posts.filter(p => p.status === 'published').length;
    const draft = posts.filter(p => p.status === 'draft').length;
    const totalViews = posts.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
    
    return { published, draft, totalViews, totalLikes };
  };

  const changePassword = async (newPassword: string) =>{
      try{
        if (!userLoaded) {
          toast.error('Los datos del usuario no están disponibles. Intenta recargar la página.');
          return;
        }
        
        const updateData: UpdateUserData = {};
        updateData.password = newPassword;
        await userService.updateUser(userLoaded.id, updateData);
        toast.success('Contraseña cambiada correctamente');
      } catch (e) {
        console.error('Error al cambiar contraseña:', e);
        const friendlyMessage = getFriendlyErrorMessage(e, ErrorMessages.PASSWORD_CHANGE_FAILED);
        toast.error(friendlyMessage);
      }
    }

  const stats = getPostStats();

  const handleDeleteClick = (post: Post) => {
    setPostToDelete(post);
  };

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return;

    try {
      await postsService.deletePost(postToDelete.id);
      setPosts(posts.filter(p => p.id !== postToDelete.id));
      toast.success('Post eliminado correctamente');
      setPostToDelete(null);
    } catch (error) {
      console.error('Error al eliminar post:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.POST_DELETE_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const handleOpenModalToEdit = (post: Post) => {
    setIsPostModalToCreate(false);
    setPostToEdit(post);
    setIsPostModalOpen(true);
  };

  const handleOpenModalToCreate = () => {
    setIsPostModalToCreate(true);
    setIsPostModalOpen(true);
  }

  const handleSave = async (postData: FormData, id?: string) => {
        const toasterMessages = {
            successCreate: 'Post creado correctamente',
            successEdit: 'Post actualizado correctamente',
            errorCreate: 'Error al crear el post',
            errorEdit: 'Error al actualizar el post'
        }
        try {
            if (id) {
                const updatedPost = await postsService.updatePost(id, postData);
                setPosts(posts.map(p => p.id === id ? updatedPost : p));
                toast.success(toasterMessages.successEdit);
            } else {
                const newPost = await postsService.createPost(postData);
                setPosts([newPost.post, ...posts]);
                toast.success(toasterMessages.successCreate);
            }
            setSelectedPost(undefined);
        } catch (error) {
            toast.error(selectedPost ? toasterMessages.errorEdit : toasterMessages.errorCreate);
            console.error('Error al guardar post:', error);
        }
    };

  const fetchCarouselImages = async () => {
    try {
      const images = await contentManagementService.getCarouselImages();
      setCarouselImages(images);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.IMAGE_LOAD_FAILED);
      toast.error(friendlyMessage);
      console.error(error);
    }
  };
  
  const handleCarouselUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Por favor, selecciona una imagen antes de continuar.");
      return;
    }
    
    setIsUploading(true);
    toast.loading('Subiendo imagen...');
    try {
      const files = Array.from(fileInputRef.current?.files ?? []);
      // Usamos el servicio de posts que tiene la función de subida
      await contentManagementService.uploadCarouselImages(files);
      toast.dismiss();
      toast.success('Imagen subida exitosamente.');
      fetchCarouselImages(); // Refrescar la galería
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setHasSelectedFiles(false);
    } catch (err) {
      toast.dismiss();
      const friendlyMessage = getFriendlyErrorMessage(err, ErrorMessages.FILE_UPLOAD_FAILED);
      toast.error(friendlyMessage);
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteCarouselImage = async (filename: string) => {
    setImageToDelete(filename);
    setIsDeleteCarouselModalOpen(true);
  };

  const confirmDeleteCarouselImage = async () => {
    if (!imageToDelete) return;
    
    toast.loading('Eliminando imagen...');
    try {
      await contentManagementService.deleteCarouselImage(imageToDelete);
      toast.dismiss();
      toast.success('Imagen eliminada correctamente.');
      setCarouselImages(prev => prev.filter(img => img !== imageToDelete));
      fetchCarouselImages();
    } catch (error) {
      toast.dismiss();
      console.error('Error al eliminar imagen:', error);
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.FILE_DELETE_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsDeleteCarouselModalOpen(false);
      setImageToDelete(null);
    }
  };

  // Filtrar posts basado en los criterios de búsqueda
  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         post.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSection = sectionFilter === 'all' || post.section === sectionFilter;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesSection && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 mt-16 space-y-8">
      {/* Header y Filtros */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {user?.role === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Volver al Dashboard
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dashboard de Contenido
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestiona el contenido del blog
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(user?.role === 'content_manager' || user?.role === 'admin') && (
              <>
                <button
                  onClick={() => setShowModal(true)}
                  disabled={!userLoaded}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${userLoaded
                      ? 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                      : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                    }`}
                >
                  <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
                    Cambiar contraseña
                  </button>
                <button
                  onClick={() => navigate('/content/mensajes')}
                  className="flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                  Ver mensajes
                </button>
              </>
            )}
            <button
              onClick={handleRefresh}
              className={`p-2 text-gray-500 hover:text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`}
              disabled={isRefreshing}
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            {(user?.role === 'content_manager' || user?.role === 'admin') && (
            <button
              onClick={() => handleOpenModalToCreate()}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Nuevo Post
            </button>
            )}
          </div>
        </div>
          {isPostModalOpen && (
            <ContentEditorModal
              post={!isPostModalToCreate ? postToEdit : undefined}
              user={user}
              onSave={handleSave}
              closeModal={() => setIsPostModalOpen(false)}
            />
          )}
        {/* Filtros y búsqueda */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {sectionOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Publicados</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.published}</p>
              </div>
              <DocumentTextIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Borradores</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.draft}</p>
              </div>
              <BookmarkIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Vistas</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalViews}</p>
              </div>
              <EyeIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Me gusta</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalLikes}</p>
              </div>
              <HeartIcon className="h-8 w-8 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Posts */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Post
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sección
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPosts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {post.thumbnail ? (
                          <img
                            className="h-10 w-10 rounded-lg object-cover"
                            src={getImageUrl(post.thumbnail)}
                            alt=""
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center">
                          <NewspaperIcon className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {post.title}
                        </div>
                        <div className="text-sm text-gray-500">
                          {post.excerpt?.substring(0, 50)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <TagIcon className="h-4 w-4 text-gray-400 mr-2" />
                      <span className="text-sm text-gray-900">{post.section}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      post.status === 'published' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {post.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleOpenModalToEdit(post)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(post)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gestor del Carrusel */}
      <div className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-semibold mb-5 text-gray-700">Gestión del Carrusel de Inicio</h2>
        <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Columna de subida */}
            <div className="flex flex-col gap-4">
                <label htmlFor="carouselUpload" className="block text-sm font-medium text-gray-600">
                    Subir nueva imagen
                </label>
                <input 
                    type="file" 
                    id="carouselUpload"
                    ref={fileInputRef}
                    multiple
                    accept="image/*"
                    onChange={(e) => setHasSelectedFiles((e.target.files?.length || 0) > 0)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                <button
                    onClick={handleCarouselUpload}
                    disabled={!hasSelectedFiles || isUploading}
                    title={!hasSelectedFiles ? 'Selecciona al menos una imagen para poder subir' : 'Subir imagen al carrusel'}
                    className="w-full md:w-auto self-start px-6 py-2 rounded-lg transition-colors text-white disabled:cursor-not-allowed disabled:bg-gray-400 bg-blue-600 hover:bg-blue-700"
                >
                    {isUploading ? 'Subiendo...' : 'Subir Imagen'}
                </button>
            </div>
            {/* Columna de galería */}
            <div>
              <h3 className="text-lg font-medium text-gray-600 mb-4">Imágenes Actuales</h3>
              {carouselImages.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {carouselImages.map(imageFile => (
                    <div key={imageFile} className="relative group rounded-lg overflow-hidden shadow-md">
                      <img 
                        src={`${API_URL}/uploads/carousel/${imageFile}`}
                        alt={`Imagen del carrusel: ${imageFile}`}
                        className="w-full h-24 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteCarouselImage(imageFile)}
                          className="p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300"
                          aria-label={`Eliminar imagen ${imageFile}`}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 border-2 border-dashed rounded-lg">
                  <p className="text-gray-500">No hay imágenes en el carrusel.</p>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {postToDelete && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Eliminar Post
            </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.
            </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Eliminar
                </button>
              <button
                  type="button"
                onClick={() => setPostToDelete(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Cancelar
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar imagen del carrusel */}
      {isDeleteCarouselModalOpen && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 bg-opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Eliminar imagen del carrusel
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        ¿Estás seguro de que quieres eliminar esta imagen? Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={confirmDeleteCarouselImage}
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => {
                    setIsDeleteCarouselModalOpen(false);
                    setImageToDelete(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ChangePasswordModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={changePassword}
      />
    </div>
  );
};

export default ContentDashboard; 