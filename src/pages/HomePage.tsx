import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  UserGroupIcon, 
  BoltIcon, 
  HeartIcon, 
  ChatBubbleBottomCenterTextIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import AOS from 'aos';
import 'aos/dist/aos.css';
import contentManagementService from '../services/content.service';
import Button from '../components/common/Button';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const HomePage = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Inicializar las animaciones al montar el componente
    AOS.init({ duration: 900, once: true });

    const fetchImages = async () => {
      try {
        const imageFiles = await contentManagementService.getCarouselImages();
        setImages(imageFiles.map(file => `${API_URL}/uploads/carousel/${file}`));
      } catch (error) {
        console.error("Error al cargar las imágenes del carrusel:", error);
        setImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  const [isHovering, setIsHovering] = useState(false);

  const next = useCallback(() => {
    setCurrentIndex(c => (c + 1) % images.length);
  }, [images.length]);

  const prev = useCallback(() => {
    setCurrentIndex(c => (c - 1 + images.length) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!isHovering) {
      const slideInterval = setInterval(next, 4000);
      return () => clearInterval(slideInterval);
    }
  }, [isHovering, next]);

  const [aboutExpanded, setAboutExpanded] = useState(false);

  const renderCarouselContent = useCallback(() => {
    if (isLoading) {
      return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-200 rounded-lg">
          <p>Cargando carrusel...</p>
        </div>
      );
    }

    if (images.length === 0) {
      return (
        <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
          <p className="text-gray-500">No hay imágenes disponibles en este momento.</p>
        </div>
      );
    }

    return (
      <>
        {/* Carousel */}
        <div className="absolute inset-0 w-full h-full">
          {images.map((img, i) => (
            <img
              key={`carousel-img-${i}-${img}`}
              src={img}
              alt={`Carrusel ${i + 1}`}
              className={`w-full h-full object-cover object-center transition-all duration-700 absolute inset-0 ${i === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
        </div>
        
        <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2 bg-white/60 rounded-full hover:bg-white transition-colors shadow-md">
          <ChevronLeftIcon className="h-5 w-5 text-gray-800"/>
        </button>
        <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2 bg-white/60 rounded-full hover:bg-white transition-colors shadow-md">
          <ChevronRightIcon className="h-5 w-5 text-gray-800"/>
        </button>

        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex space-x-2">
          {images.map((_, i) => (
            <div
              key={`carousel-dot-${i}`}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 shadow-sm ${i === currentIndex ? 'bg-white' : 'bg-white/50'}`}
            />
          ))}
        </div>
      </>
    );
  }, [isLoading, images, currentIndex, prev, next]);

  return (
    <div className="min-h-screen">
      <div className="space-y-12">
        {/* Hero Section */}
        <section 
          className="relative w-full max-w-5xl mx-auto flex flex-col justify-center items-center rounded-2xl shadow-2xl overflow-hidden mt-12"
          style={{ height: '400px' }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          data-aos="fade-up"
        >
          {renderCarouselContent()}

          {/* Logo - Siempre visible */}
          <div className="relative z-20 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full bg-white/50 blur-xl z-0"></div>
            <img
              src="/images/logo 2.png"
              alt="Logo IPPL"
              className="w-[400px] max-w-full object-contain drop-shadow-lg relative z-10"
              data-aos="zoom-in"
            />
          </div>
        </section>
        
        {/* El resto del contenido va debajo del carrusel */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 max-w-xl lg:max-w-2xl mx-auto lg:mx-0" data-aos="fade-right">
              <h2 className="text-2xl font-bold text-[#006C73] mb-2 font-sans">¿QUIENES SOMOS?</h2>
              <div className="text-gray-700 text-[1.08rem] leading-relaxed font-sans" style={{fontFamily: 'Inter, Roboto, Nunito, sans-serif'}}>
                <div className={`overflow-hidden transition-all duration-700 ease-in-out ${aboutExpanded ? 'max-h-screen' : 'max-h-24'}`}>
                  {fullAboutText.map((t, i) => <p key={`about-text-${i}-${t.substring(0, 20)}`} className="mb-3 text-gray-700">{t}</p>)}
                </div>
                <Button 
                  variant="primary" 
                  size="md" 
                  className="mt-2"
                  onClick={() => setAboutExpanded(!aboutExpanded)}
                >
                  {aboutExpanded ? 'Ver menos' : 'Ver más'}
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <Link to="/contacto" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" className="w-full sm:w-auto">
                    Solicitar consulta
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-center gap-6 w-full" data-aos="fade-left">
              <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-[#80C0D0] bg-white w-full max-w-xl aspect-video">
                <iframe 
                  src="https://www.youtube.com/embed/Ma2HjKwul0Y?si=CsoY8Kna0pfwRDTh" 
                  title="YouTube video player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  referrerPolicy="strict-origin-when-cross-origin" 
                  allowFullScreen 
                  className="w-full h-full"
                ></iframe>
              </div>
            </div>
          </div>
        </section>

        {/* Professional Referral Section */}
        <section className="py-16 bg-gradient-to-br from-[#006C73] to-[#80C0D0]" data-aos="fade-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-white sm:text-4xl mb-8">
                Cuando no sabés a quién consultar:
              </h2>
              
              <div className="max-w-4xl mx-auto">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-2xl">
                  <div className="space-y-6 text-left">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">1</span>
                        </div>
                      </div>
                      <p className="text-white text-lg leading-relaxed">
                        <span className="font-semibold">A partir de una entrevista de admisión,</span> evaluamos tu demanda y te derivamos al profesional más indicado para vos.
                      </p>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">2</span>
                        </div>
                      </div>
                      <p className="text-white text-lg leading-relaxed">
                        <span className="font-semibold">Contamos con un equipo de psicólogos</span> formados en diversas corrientes y abordajes terapéuticos, en constante formación y supervisión clínica.
                      </p>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-lg">3</span>
                        </div>
                      </div>
                      <p className="text-white text-lg leading-relaxed">
                        <span className="font-semibold">De este modo, garantizamos</span> un acompañamiento personalizado y adecuado a las necesidades de cada paciente.
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-6 border-t border-white/20">
                    <div className="flex items-center justify-center space-x-2 text-white/90">
                      <HeartIcon className="h-6 w-6" />
                      <span className="text-lg font-medium">Tu bienestar es nuestra prioridad</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-[#374151] sm:text-4xl">Nuestros Servicios</h2>
            <p className="mt-4 text-xl text-[#006C73]">Ofrecemos una amplia gama de servicios psicológicos adaptados a las necesidades de cada persona.</p>
          </div>
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service, idx) => (
              <div
                key={service.name}
                className="relative group bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300"
                data-aos="zoom-in-up"
                data-aos-delay={idx * 100}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-[#374151]">{service.name}</h3>
                <p className="mt-2 text-[#006C73]">{service.description}</p>
                <Link
                  to={service.link}
                  className="mt-4 inline-flex items-center text-[#006C73] hover:text-[#00078A] transition-all duration-200 transform hover:scale-110 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-[#80C0D0]"
                >
                  Saber más
                  <ArrowRightIcon className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="py-16 bg-white" data-aos="fade-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-[#374151] sm:text-4xl">¿Por qué elegirnos?</h2>
              <p className="mt-4 text-xl text-[#006C73]">Nuestro compromiso es brindar atención psicológica de calidad con un enfoque personalizado.</p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature, idx) => (
                <div
                  key={feature.name}
                  className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow duration-300"
                  data-aos="zoom-in"
                  data-aos-delay={idx * 100}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-[#374151]">{feature.name}</h3>
                  <p className="mt-2 text-sm text-[#006C73]">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const services = [
  {
    name: 'Terapia Individual',
    description: 'Sesiones personalizadas para abordar tus necesidades específicas en un espacio seguro y confidencial.',
    icon: UserGroupIcon,
    link: '/servicios#individual'
  },
  {
    name: 'Terapia de Pareja',
    description: 'Ayudamos a fortalecer la comunicación y resolver conflictos en la relación.',
    icon: HeartIcon,
    link: '/servicios#pareja'
  },
  {
    name: 'Terapia de Familia',
    description: 'Acompañamiento para resolver conflictos y fortalecer los lazos familiares.',
    icon: BoltIcon,
    link: '/servicios#familia'
  }
];

const features = [
  {
    name: 'Profesionales Certificados',
    description: 'Equipo altamente calificado con amplia experiencia.',
    icon: UserGroupIcon
  },
  {
    name: 'Atención Personalizada',
    description: 'Tratamientos adaptados a tus necesidades específicas.',
    icon: ChatBubbleBottomCenterTextIcon
  },
  {
    name: 'Enfoque Integral',
    description: 'Abordaje holístico para tu bienestar emocional.',
    icon: HeartIcon
  },
  {
    name: 'Resultados Comprobados',
    description: 'Metodologías basadas en evidencia científica.',
    icon: BoltIcon
  }
];

const fullAboutText = [
  "Somos un grupo de profesionales de la salud y la educación que creemos en el trabajo en equipo, en la ética de nuestra profesión y en la formación continua.",
  "Nuestra caja de herramientas en permanente construcción nos permite dar más y mejores respuestas a las situaciones que se nos presentan.",
  "El psicoanálisis vincular nos plantea un abordaje posible frente al desafío de la teoría y la clínica hoy.",
  "Sostenemos la necesidad de una revisión y reformulación de las teorías existentes y del psicoanálisis en particular que nos permita nuevas enunciaciones y dispositivos, con una mirada desde la complejidad, con una perspectiva transdisciplinaria, histórica, sociológica, jurídica, antropológica, semiótica.",
  "El compromiso y la fidelidad es no para con una teoría, sino para con nuestros pacientes, consultantes y estudiantes."
];

export default HomePage;