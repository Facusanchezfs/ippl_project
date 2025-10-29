import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../common/Card';
import Button from '../common/Button';
import { Calendar, User } from 'lucide-react';

// Mock data for demonstration
const posts = [
  {
    id: '1',
    title: 'Cómo manejar la ansiedad en tiempos de incertidumbre',
    excerpt: 'Estrategias prácticas para gestionar los síntomas de ansiedad y recuperar la calma en momentos difíciles.',
    slug: 'como-manejar-ansiedad-incertidumbre',
    publishedAt: '2025-02-15',
    author: {
      id: '3',
      name: 'Dra. María González',
      profilePicture: 'https://images.pexels.com/photos/5452293/pexels-photo-5452293.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    featuredImage: 'https://images.pexels.com/photos/3807738/pexels-photo-3807738.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
  },
  {
    id: '2',
    title: 'La importancia de establecer límites saludables',
    excerpt: 'Aprender a decir "no" y establecer límites claros es fundamental para mantener relaciones sanas y proteger nuestro bienestar emocional.',
    slug: 'importancia-limites-saludables',
    publishedAt: '2025-01-28',
    author: {
      id: '4',
      name: 'Dr. Carlos Rodríguez',
      profilePicture: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    featuredImage: 'https://images.pexels.com/photos/6942018/pexels-photo-6942018.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
  },
  {
    id: '3',
    title: 'Mindfulness: una práctica para el bienestar cotidiano',
    excerpt: 'Descubre cómo la atención plena puede transformar tu día a día, reducir el estrés y mejorar tu calidad de vida.',
    slug: 'mindfulness-practica-bienestar',
    publishedAt: '2025-01-10',
    author: {
      id: '5',
      name: 'Lic. Ana Martínez',
      profilePicture: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
    },
    featuredImage: 'https://images.pexels.com/photos/3560044/pexels-photo-3560044.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
  }
];

const LatestPosts: React.FC = () => {
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-AR', options);
  };

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Últimas Publicaciones</h2>
            <p className="text-lg text-gray-600">
              Artículos, recursos y reflexiones de nuestros profesionales.
            </p>
          </div>
          <Link to="/blog" className="mt-4 md:mt-0">
            <Button variant="outline">
              Ver todas las publicaciones
            </Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map(post => (
            <Card 
              key={post.id} 
              className="h-full flex flex-col overflow-hidden transition-transform hover:-translate-y-1 duration-200"
              padding="none"
            >
              <Link to={`/blog/${post.slug}`}>
                <img
                  src={post.featuredImage}
                  alt={post.title}
                  className="w-full h-auto max-h-48 object-contain"
                />
              </Link>
              
              <div className="p-5 flex-grow flex flex-col">
                <Link to={`/blog/${post.slug}`}>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2 hover:text-blue-600 transition-colors">
                    {post.title}
                  </h3>
                </Link>
                
                <p className="text-gray-600 mb-4 flex-grow">
                  {post.excerpt}
                </p>
                
                <div className="mt-auto">
                  <div className="flex items-center text-sm text-gray-500 mb-3">
                    <Calendar size={16} className="mr-1" />
                    <span>{formatDate(post.publishedAt)}</span>
                    <span className="mx-2">•</span>
                    <User size={16} className="mr-1" />
                    <span>{post.author.name}</span>
                  </div>
                  
                  <Link to={`/blog/${post.slug}`}>
                    <Button variant="text" size="sm" className="text-blue-600 hover:text-blue-700 p-0">
                      Leer más →
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LatestPosts;