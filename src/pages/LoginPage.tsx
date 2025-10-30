import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { motion } from 'framer-motion';
import BubbleBackground from '../components/common/BubbleBackground';
import { getFriendlyErrorMessage, ErrorMessages } from '../utils/errorMessages';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, error } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login({
        username: formData.username,
        password: formData.password
      });
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      
      // Verificar si el usuario está inactivo
      if (currentUser.status === 'inactive') {
        toast.error('Tu cuenta está inactiva. Por favor, contacta al administrador.');
        return;
      }
      
      toast.success('¡Bienvenido!');
      
      // Redirigir según el rol
      switch (currentUser.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'content_manager':
          navigate('/content');
          break;
        case 'professional':
          navigate('/professional');
          break;
        default:
          navigate('/');
      }
    } catch (err: any) {
      const friendlyMessage = getFriendlyErrorMessage(err, ErrorMessages.LOGIN_FAILED);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado izquierdo - Formulario */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-12 bg-white relative overflow-hidden">
        <Link to="/" className="absolute top-8 left-8 z-10">
          <motion.img 
            src="/images/Logo-removebg-preview.png" 
            alt="Logo IPPL" 
            className="w-28" 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          />
        </Link>
        <div className="max-w-md w-full mx-auto">
          <motion.div 
            className="text-center mb-12"
            variants={itemVariants}
          >
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight">Bienvenido de Nuevo</h1>
            <p className="text-gray-500 mt-2">Inicia sesión para continuar</p>
          </motion.div>

          <motion.form 
            onSubmit={handleSubmit} 
            className="space-y-6"
            variants={formVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants}>
              <label htmlFor="username" className="block text-sm font-medium text-gray-600 mb-1">
                Correo electrónico
              </label>
              <input
                id="username"
                name="username"
                type="email"
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-2 focus:border-[#00796B] focus:ring-0 transition"
                placeholder="correo@ejemplo.com"
                required
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <label htmlFor="password" className="block text-sm font-medium text-gray-600 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-2 focus:border-[#00796B] focus:ring-0 transition"
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <AiOutlineEyeInvisible size={20} /> : <AiOutlineEye size={20} />}
                </button>
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-[#00796B] text-white py-3.5 rounded-xl font-semibold hover:bg-[#006C73] focus:outline-none focus:ring-2 focus:ring-[#00796B] focus:ring-offset-2 transition-all duration-300 transform hover:scale-105 ${
                  isLoading ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </button>
            </motion.div>
          </motion.form>
        </div>
      </div>

      {/* Lado derecho - Animación */}
      <div className="hidden lg:block lg:w-1/2 bg-[#00796B] relative">
        <BubbleBackground />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            >
              <h2 className="text-4xl font-bold tracking-tight">Transformando Vidas</h2>
              <p className="mt-4 text-lg max-w-md opacity-90">
                  Un espacio seguro y profesional para tu crecimiento personal.
              </p>
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;