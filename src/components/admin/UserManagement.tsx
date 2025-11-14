import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast';
import { User, Edit2, Trash2, Search, UserPlus, X, ArrowBigUpDash, ArrowBigDown } from 'lucide-react';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import Button from '../common/Button';
import userService, { User as UserType, CreateUserData, UpdateUserData } from '../../services/user.service';
import EditUserModal from './EditUserModal';
import AddUserModal from './AddUserModal';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import { useAuth } from '../../context/AuthContext';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isActiveModalOpen, setIsActiveModalOpen] = useState(false);
  const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [userToActive, setUserToActive] = useState<UserType | null>(null);
  const [userToPermanentDelete, setUserToPermanentDelete] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_LOAD_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const handleAddUser = async (userData: CreateUserData) => {
    try {
      await userService.createUser(userData);
      toast.success('Usuario creado exitosamente');
      loadUsers();
      setIsAddModalOpen(false);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_CREATE_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const handleUpdateUser = async (id: string, userData: UpdateUserData) => {
    try {
      await userService.updateUser(id, userData);
      toast.success('Usuario actualizado exitosamente');
      loadUsers();
      setIsEditModalOpen(false);
      setSelectedUser(null);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_UPDATE_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const handleDeleteClick = (user: UserType) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleActiveClick = (user: UserType) => {
    setUserToActive(user);
    setIsActiveModalOpen(true);
  }

  const handleActiveConfirm = async () =>{
    if (!userToActive) return;
    
    try {
      let updateData: UpdateUserData = {};
      updateData.status = "active";
      await userService.updateUser(userToActive.id, updateData);
      toast.success('Usuario activado exitosamente');
      loadUsers();
      setIsActiveModalOpen(false);
      setUserToActive(null);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_UPDATE_FAILED);
      toast.error(friendlyMessage);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    
    try {
      await userService.deleteUser(userToDelete.id);
      toast.success('Usuario desactivado exitosamente');
      loadUsers();
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_DELETE_FAILED);
      toast.error(friendlyMessage);
    }
  };

  const handlePermanentDeleteClick = (user: UserType) => {
    setUserToPermanentDelete(user);
    setIsPermanentDeleteModalOpen(true);
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!userToPermanentDelete) return;
    
    try {
      await userService.permanentDeleteUser(userToPermanentDelete.id);
      toast.success('Usuario eliminado permanentemente');
      loadUsers();
      setIsPermanentDeleteModalOpen(false);
      setUserToPermanentDelete(null);
    } catch (error) {
      const friendlyMessage = getFriendlyErrorMessage(error, ErrorMessages.USER_DELETE_FAILED);
      toast.error(friendlyMessage);
    }
  };


  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'content_manager':
        return 'Editor de contenido';
      case 'professional':
        return 'Psicólogo';
      case 'financial':
        return "Financiero";
      default:
        return role;
    }
  };

  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-AR', options);
  };

  const filteredUsers = users.filter(user => {
    if (currentUser && String(user.id) === String(currentUser.id)) {
      return false;
    }

    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="mt-24">
      <div className="flex justify-between mb-6">
        <button
              onClick={() => navigate('/admin')}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Volver al Dashboard
        </button>
        <Button 
          variant="primary"
          className="inline-flex items-center"
          onClick={() => setIsAddModalOpen(true)}
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Agregar Usuario
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="md:col-span-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar usuarios..."
                className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          <div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="content_manager">Editores de contenido</option>
              <option value="professional">Psicólogos</option>
              <option value="financial">Financiero</option>
            </select>
          </div>
          
          <div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>
        </div>
        <div className="block md:hidden bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 space-y-3">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                  {/* Usuario + Rol + Estado */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User size={18} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-gray-900 truncate">
                          {user.name}
                        </div>
                        <div className="text-sm text-gray-500 truncate">{user.email}</div>
                      </div>
                    </div>

                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary shrink-0">
                      {getRoleLabel(user.role)}
                    </span>
                  </div>

                  {/* Estado + Fecha */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-gray-500">Estado</div>
                      <div>
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.status === 'active'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-gray-300 text-gray-800'
                          }`}
                        >
                          {user.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                    <div className="rounded bg-gray-50 p-2">
                      <div className="text-gray-500">Registro</div>
                      <div className="font-medium text-gray-900">{formatDate(user.createdAt)}</div>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="mt-3 flex justify-end gap-3">
                    <button
                      className="text-indigo-600 hover:text-indigo-900"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsEditModalOpen(true);
                      }}
                      title="Editar usuario"
                    >
                      <Edit2 size={18} />
                    </button>
                    {user.status === 'active' ? (
                      <button
                        className="text-red-600 hover:text-red-900 transition-colors duration-200"
                        onClick={() => handleDeleteClick(user)}
                        title="Deshabilitar usuario"
                      >
                        <ArrowBigDown size={18} />
                      </button>
                    ) : (
                      <>
                        <button
                          className="text-green-600 hover:text-green-900 transition-colors duration-200"
                          onClick={() => handleActiveClick(user)}
                          title="Habilitar usuario"
                        >
                          <ArrowBigUpDash size={18} />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 transition-colors duration-200 ml-2"
                          onClick={() => handlePermanentDeleteClick(user)}
                          title="Eliminar usuario permanentemente"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-gray-500 py-6">
                No se encontraron usuarios con los criterios de búsqueda.
              </div>
            )}
          </div>
        </div>
      
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha de registro
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User size={18} className="text-primary" />
                          </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary/10 text-primary`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      onClick={() => {
                        setSelectedUser(user);
                        setIsEditModalOpen(true);
                      }}
                      title="Editar usuario"
                    >
                        <Edit2 size={18} />
                      </button>
                    {user.status === 'active' ? (
                      <button
                        className="text-red-600 hover:text-red-900 transition-colors duration-200"
                        onClick={() => handleDeleteClick(user)}
                        title="Deshabilitar usuario"
                      >
                        <ArrowBigDown size={18} />
                      </button>
                    ) : (
                      <>
                        <button
                          className="text-green-600 hover:text-green-900 transition-colors duration-200"
                          onClick={() => handleActiveClick(user)}
                          title="Habilitar usuario"
                        >
                          <ArrowBigUpDash size={18} />
                        </button>
                        <button
                          className="text-red-600 hover:text-red-900 transition-colors duration-200 ml-2"
                          onClick={() => handlePermanentDeleteClick(user)}
                          title="Eliminar usuario permanentemente"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    No se encontraron usuarios con los criterios de búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {selectedUser && (
        <EditUserModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedUser(null);
          }}
          onSubmit={handleUpdateUser}
          user={selectedUser}
        />
      )}

      <AddUserModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddUser}
      />

      {isDeleteModalOpen && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Confirmar desactivacion
              </h3>
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mt-3">
              <p className="text-sm text-gray-500">
                ¿Estás seguro de que deseas desactivar usuario?
              </p>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{userToDelete.name}</p>
                <p className="text-sm text-gray-500">{userToDelete.email}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setUserToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}

      {isActiveModalOpen && userToActive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Confirmar activacion
              </h3>
              <button
                onClick={() => {
                  setIsActiveModalOpen(false);
                  setUserToActive(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mt-3">
              <p className="text-sm text-gray-500">
                ¿Estás seguro de que deseas activar nuevamente al usuario?
              </p>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{userToActive.name}</p>
                <p className="text-sm text-gray-500">{userToActive.email}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsActiveModalOpen(false);
                  setUserToActive(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <Button
                type="button"
                onClick={handleActiveConfirm}
                className="px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 "
              >
                Activar nuevamente
              </Button>
            </div>
          </div>
        </div>
      )}

      {isPermanentDeleteModalOpen && userToPermanentDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-red-600">
                Confirmar eliminación permanente
              </h3>
              <button
                onClick={() => {
                  setIsPermanentDeleteModalOpen(false);
                  setUserToPermanentDelete(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mt-3">
              <p className="text-sm text-gray-500">
                ¿Está seguro de que desea eliminar permanentemente este usuario? Esta acción no se puede deshacer.
              </p>
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900">{userToPermanentDelete.name}</p>
                <p className="text-sm text-gray-500">{userToPermanentDelete.email}</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setIsPermanentDeleteModalOpen(false);
                  setUserToPermanentDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePermanentDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Eliminar permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;