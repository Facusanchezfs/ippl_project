import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ChevronDown } from 'lucide-react';

const blogDropdown = [
  { to: '/blog/ninos', text: 'Niños' },
  { to: '/blog/adultos', text: 'Adultos' },
  { to: '/blog/noticias', text: 'Noticias' },
];

const Header = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBlogOpen, setIsBlogOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const controlNavbar = () => {
      if (typeof window !== 'undefined') {
        if (window.scrollY > lastScrollY && window.scrollY > 80) {
          setVisible(false);
        } else {
          setVisible(true);
        }
        setLastScrollY(window.scrollY);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', controlNavbar);
      return () => {
        window.removeEventListener('scroll', controlNavbar);
      };
    }
  }, [lastScrollY]);

  const navigationLinks = [
    { to: '/', text: 'Inicio' },
    { to: '/nosotros', text: 'Nosotros' },
    { to: '/servicios', text: 'Servicios' },
    { to: '/blog', text: 'Blog', dropdown: blogDropdown },
    { to: '/contacto', text: 'Contacto' },
  ];

  const getDashboardLink = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin';
      case 'content_manager': return '/content';
      case 'professional': return '/professional';
      case 'financial': return '/financial';
      default: return '/';
    }
  };

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <header className={`bg-[#F9FAFB] shadow-sm fixed w-full z-50 transition-all duration-300 ${visible ? 'top-0' : '-top-24'}`}>
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <nav className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center h-20 pl-2">
            <Link to="/" className="flex items-center">
              <img
                className="h-32 w-auto"
                src="/images/Logo-removebg-preview.png"
                alt="Logo IPPL"
              />
            </Link>
            </div>

            {/* Navigation Links - Desktop */}
            <div className="hidden md:flex items-center">
            <div className="flex space-x-1 bg-[#E5E7EB]/80 rounded-full px-2 py-1">
              {navigationLinks.map((link, index) =>
                link.dropdown ? (
                  <div
                    key={`desktop-nav-${index}`}
                    className="relative group"
                  >
                    <Link
                      to={link.to}
                      className="px-4 py-2 text-sm font-semibold text-[#374151] hover:text-[#006C73] hover:bg-[#F9FAFB] rounded-full transition-all duration-200 flex items-center gap-1"
                    >
                      {link.text}
                      <ChevronDown className="w-4 h-4" />
                    </Link>
                    <div
                      className="absolute left-0 top-full w-40 bg-white rounded-xl shadow-lg py-2 z-20 transition-all duration-150 hidden group-hover:block"
                    >
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all"
                        >
                          {item.text}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                <Link
                  key={`desktop-nav-${index}`}
                  to={link.to}
                    className="px-4 py-2 text-sm font-semibold text-[#374151] hover:text-[#006C73] hover:bg-[#F9FAFB] rounded-full transition-all duration-200"
                >
                  {link.text}
                </Link>
                )
              )}
            </div>
            </div>

            {/* Auth Buttons - Desktop */}
            <div className="hidden md:flex items-center space-x-6">
              {user ? (
                <div className="flex items-center space-x-6">
                <span className="text-sm font-semibold text-gray-700">{user.name}</span>
                <Link to={getDashboardLink()} className="relative px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200 hover:shadow-md">Dashboard</Link>
                <button onClick={logout} className="text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors duration-200">Cerrar Sesión</button>
                </div>
              ) : (
              <Link to="/login" className="relative px-6 py-2 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg group overflow-hidden">
                <span className="absolute inset-0 w-0 bg-blue-100 transition-all duration-300 ease-out group-hover:w-full"></span>
                <span className="relative">Iniciar Sesión</span>
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
            <button onClick={toggleMenu} className="p-2 text-gray-700 hover:text-blue-600 transition-colors duration-200">
                <span className="sr-only">Abrir menú principal</span>
                {isMenuOpen ? (
                <X className="h-6 w-6 transform rotate-0 hover:rotate-90 transition-transform duration-200" />
                ) : (
                <Menu className="h-6 w-6" />
                )}
              </button>
          </div>
        </nav>

        {/* Mobile menu */}
        <div 
          className={`md:hidden transition-all duration-300 ease-in-out overflow-hidden
          ${isMenuOpen
            ? 'opacity-100 translate-y-0 max-h-[80vh]'
            : 'opacity-0 -translate-y-2 max-h-0 pointer-events-none'
          }`}
        >
        <div className="pt-2 pb-3 space-y-1">
            {navigationLinks.map((link, index) =>
              link.dropdown ? (
                <div key={`mobile-nav-${index}`} className="relative">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    onClick={() => setIsBlogOpen((prev) => !prev)}
                    aria-expanded={isBlogOpen}
                  >
                    {link.text}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                  {/* submenú */}
                  <div className={`pl-4 mt-1 space-y-1 transition-all duration-200 overflow-hidden
                    ${isBlogOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-all"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        {item.text}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  key={`mobile-nav-${index}`}
                  to={link.to}
                  className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.text}
                </Link>
              )
            )}
          </div>
          {/* Mobile auth buttons */}
          <div className="pt-4 pb-3">
            {user ? (
              <div className="px-4 space-y-3">
                <div className="text-base font-medium text-gray-800">{user.name}</div>
                <Link
                  to={getDashboardLink()}
                  className="block w-full px-4 py-2 text-center text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors duration-200"
                >
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <div className="px-4">
                <Link
                  to="/login"
                  className="block w-full px-4 py-2 text-center text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Iniciar Sesión
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;