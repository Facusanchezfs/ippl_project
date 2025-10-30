import React, { useState } from 'react';
import { X } from 'lucide-react';
import {User, UpdateUserData, Roles, Status} from '../../services/user.service';

interface EditUserModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: UpdateUserData) => Promise<void>;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    status: user.status,
    commission: user.commission ?? 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updateData: UpdateUserData = {};
    
    // Solo incluir campos que han sido modificados
    if (formData.name !== user.name) updateData.name = formData.name;
    if (formData.email !== user.email) updateData.email = formData.email;
    if (formData.password) updateData.password = formData.password;
    if (formData.role !== user.role) updateData.role = formData.role;
    if (formData.status !== user.status) updateData.status = formData.status;
    if ((formData.role === 'admin' || formData.role === 'professional' || formData.role === 'financial') && formData.commission !== user.commission) updateData.commission = formData.commission;

    await onSubmit(user.id, updateData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold mb-6">Editar Usuario</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              id="name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              id="email"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña (dejar en blanco para mantener la actual)
            </label>
            <input
              type="password"
              id="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Rol
            </label>
            <select
              id="role"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as Roles })}
            >
              <option value="professional">Psicólogo</option>
              <option value="content_manager">Editor de contenido</option>
              <option value="financial">Financiero</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              id="status"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Status })}
            >
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>

          {/* Campo de comisión solo para admin, professional o financial */}
          {(formData.role === 'admin' || formData.role === 'professional' || formData.role === 'financial') && (
            <div>
              <label htmlFor="commission" className="block text-sm font-medium text-gray-700 mb-1">
                Comisión (%)
              </label>
              <input
                type="number"
                id="commission"
                min={0}
                max={100}
                step={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                value={formData.commission}
                onChange={(e) => setFormData({ ...formData, commission: Math.max(0, Math.min(100, Number(e.target.value))) })}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal; 