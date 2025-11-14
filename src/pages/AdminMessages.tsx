import React, { useState, useEffect } from 'react';
import { messageService, Message } from '../services/messageService';
import { TrashIcon, InboxIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminMessages = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await messageService.getMessages();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Error al cargar los mensajes');
      toast.error('Error al cargar los mensajes');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await messageService.markAsRead(id);
      await loadMessages();
      toast.success('Mensaje marcado como leído');
    } catch (error) {
      console.error('Error marking message as read:', error);
      toast.error('Error al marcar el mensaje como leído');
    }
  };

  const handleClearMessages = async () => {
    try {
      await messageService.clearAllMessages();
      await loadMessages();
      toast.success('Todos los mensajes han sido eliminados');
      setShowConfirmDialog(false);
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Error al eliminar los mensajes');
    }
  };

  const filteredMessages = messages.filter(message => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      message.nombre.toLowerCase().includes(searchTermLower) ||
      message.apellido.toLowerCase().includes(searchTermLower) ||
      message.correoElectronico.toLowerCase().includes(searchTermLower) ||
      message.mensaje.toLowerCase().includes(searchTermLower)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate(user?.role === 'financial' ? '/financial' : user?.role === 'content_manager' ? '/content' : '/admin')}
            className="mb-6 inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Volver
          </button>
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  const backRoute = user?.role === 'financial'
    ? '/financial'
    : user?.role === 'content_manager'
      ? '/content'
      : '/admin';

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <button
          onClick={() => navigate(backRoute)}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Volver
        </button>
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-medium text-gray-900 mb-4 sm:mb-0">
                Mensajes de Contacto
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
                <input
                  type="text"
                  placeholder="Buscar mensajes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                {messages.length > 0 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="h-5 w-5 mr-2" />
                    Limpiar Mensajes
                  </button>
                )}
              </div>
            </div>
          </div>
          {error ? (
            <div className="p-4 text-center">
              <p className="text-red-600">{error}</p>
              <button
                onClick={loadMessages}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
              >
                Reintentar
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <InboxIcon className="h-16 w-16 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No hay mensajes</h3>
              <p className="mt-1 text-sm text-gray-500">
                Cuando los usuarios envíen mensajes a través del formulario de contacto, aparecerán aquí.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredMessages.map((message) => (
                <li key={message._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-blue-600 truncate">
                          {message.nombre} {message.apellido}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(message.fecha).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500">{message.correoElectronico}</p>
                      <p className="mt-1 text-sm text-gray-900">{message.mensaje}</p>
                    </div>
                    {!message.leido && (
                      <button
                        onClick={() => handleMarkAsRead(message._id)}
                        className="ml-4 px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Marcar como leído
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {filteredMessages.length === 0 && (
                <li className="p-4 text-center text-gray-500">
                  {searchTerm
                    ? 'No se encontraron mensajes que coincidan con tu búsqueda'
                    : 'No hay mensajes para mostrar'}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Modal de confirmación */}
      {showConfirmDialog && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowConfirmDialog(false)} />

            <div className="relative bg-white rounded-lg w-96 mx-auto p-6 shadow-xl">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <TrashIcon className="h-6 w-6 text-red-600" />
                </div>
              </div>
              
              <p className="text-center text-gray-700 mb-6">
                ¿Estás seguro de que deseas eliminar todos los mensajes? Esta acción no se puede deshacer.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClearMessages}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMessages; 