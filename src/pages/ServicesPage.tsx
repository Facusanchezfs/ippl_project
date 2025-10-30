import { useEffect } from 'react';
import {
  BeakerIcon,
  UsersIcon,
  UserIcon,
  AcademicCapIcon,
  SparklesIcon,
  VideoCameraIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import AOS from 'aos';
import 'aos/dist/aos.css';

const ServicesPage = () => {
  useEffect(() => {
    AOS.init({ duration: 900, once: true });
  }, []);

  const mainServices = [
    {
      icon: UserIcon,
      title: "Clínica con niños y adolescentes"
    },
    {
      icon: UserIcon,
      title: "Clínica con adultos"
    },
    {
      icon: UserIcon,
      title: "Clínica con adultos mayores"
    },
    {
      icon: AcademicCapIcon,
      title: "Orientación Vocacional"
    },
    {
      icon: BeakerIcon,
      title: "Evaluación Psicotécnica y Psicodiagnóstico"
    },
    {
      icon: UsersIcon,
      title: "Supervisión & Terapia de Pareja y Familia"
    }
  ];

  const specializedServices = [
    {
      icon: UserIcon,
      title: "Evaluación Psicológica",
      description: "Evaluaciones completas para diagnóstico y planificación de tratamientos efectivos."
    },
    {
      icon: AcademicCapIcon,
      title: "Orientación Vocacional",
      description: "Guía profesional para descubrir tu vocación y planificar tu futuro académico y laboral."
    },
    {
      icon: SparklesIcon,
      title: "Mindfulness y Meditación",
      description: "Técnicas de atención plena para reducir el estrés y mejorar el bienestar general."
    },
    {
      icon: VideoCameraIcon,
      title: "Terapia Online",
      description: "Sesiones virtuales con la misma calidad y profesionalismo que las presenciales."
    }
  ];

  const features = [
    {
      icon: ClockIcon,
      title: "Horarios Flexibles",
      description: "Adaptamos nuestros horarios a tus necesidades"
    },
    {
      icon: UsersIcon,
      title: "Equipo Multidisciplinario",
      description: "Profesionales especializados en diferentes áreas"
    }
  ];

  return (
    <div className="space-y-24 py-16 bg-[#F9FAFB] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-[#374151]">
            Nuestros Servicios
          </h1>
        </div>
        <div className="mt-8 max-w-3xl mx-auto text-left font-sans text-base text-[#374151] leading-relaxed" data-aos="fade-up" data-aos-delay="100">
          <p className="mb-4">
            En muchas ocasiones, quienes buscan iniciar una consulta psicológica no saben con certeza qué profesional es el más adecuado o qué orientación teórica se ajusta mejor a su motivo de consulta. Por ello, en nuestro instituto contamos con un equipo de profesionales formados en distintas corrientes teórico-clínicas y diferentes dispositivos de abordaje psicoterapéutico.
          </p>
          <p>
            A través de una entrevista de admisión, evaluamos la demanda y derivamos a cada paciente con el profesional más indicado, según la problemática presentada. Nuestro equipo se encuentra en permanente formación y realiza supervisión clínica continua, lo que contribuye a diseñar dispositivos teóricos pertinentes considerando las singularidades de cada caso.
          </p>
        </div>
      </section>

      {/* Main Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {mainServices.map((service, idx) => (
            <div 
              key={service.title} 
              className="bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300"
              data-aos="zoom-in-up"
              data-aos-delay={idx * 100}
            >
              <div className="p-8 flex flex-col items-center justify-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
                  <service.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-extrabold text-[#374151] text-center">
                  {service.title}
                </h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Specialized Services Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#374151]">
            Servicios Especializados
          </h2>
          <p className="mt-3 sm:mt-4 text-lg sm:text-xl text-[#006C73]">
            Atención especializada para necesidades específicas
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {specializedServices.map((service, idx) => (
            <div 
              key={service.title} 
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300"
              data-aos="zoom-in-up"
              data-aos-delay={idx * 100}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <service.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-[#374151]">
                {service.title}
              </h3>
              <p className="mt-2 text-[#006C73]">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="flex justify-center">
          <div className="bg-[#E5E7EB] rounded-3xl shadow-lg overflow-hidden max-w-4xl">
            <div className="px-6 py-16 sm:p-16">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {features.map((feature, idx) => (
                  <div 
                    key={feature.title} 
                    className="flex items-start"
                    data-aos="fade-right"
                    data-aos-delay={idx * 150}
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-[#374151]">
                        {feature.title}
                      </h3>
                      <p className="mt-1 text-[#006C73]">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ServicesPage; 