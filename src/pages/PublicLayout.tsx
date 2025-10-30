import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/common/Header';
import Footer from '../components/common/Footer';
import WhatsAppButton from '../components/common/WhatsAppButton';
import InstagramButton from '../components/common/InstagramButton';
import ContactCTA from '../components/home/ContactCTA';

const PublicLayout: React.FC = () => {
  const location = useLocation();
  const noFooterPaths = ['/', '/nosotros', '/servicios', '/blog', '/contacto'];

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow pt-20">
        <Outlet />
      </main>
      {location.pathname !== '/contacto' && <ContactCTA />}
      <WhatsAppButton />
      <InstagramButton />
      {!noFooterPaths.includes(location.pathname) && <Footer />}
    </div>
  );
};

export default PublicLayout;