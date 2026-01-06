import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Button from '../common/Button';

const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    login({
      username: formData.email,
      password: formData.password
    })
      .then(() => {
        navigate('/admin');
      })
      .catch((err) => {
        setError('Ocurrió un error al iniciar sesión. Por favor intente más tarde.');
        console.error('Login error:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div className="w-full max-w-md">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="correo@ejemplo.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={formData.password}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div>
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={isLoading}
          >
            Iniciar sesión
          </Button>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>
            Para demostración, use estas credenciales:
          </p>
          <ul className="mt-2 space-y-1">
            <li><strong>Admin:</strong> admin@ippl.org / 123456</li>
            <li><strong>Editor:</strong> editor@ippl.org / 123456</li>
            <li><strong>Psicólogo:</strong> psicologo@ippl.org / 123456</li>
          </ul>
        </div>
      </form>
    </div>
  );
};

export default LoginForm;