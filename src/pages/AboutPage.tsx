import { useEffect } from 'react';

import {
  HeartIcon,
  AcademicCapIcon,
  LightBulbIcon,
  HandRaisedIcon,
} from '@heroicons/react/24/outline';
import AOS from 'aos';
import 'aos/dist/aos.css';

const AboutPage = () => {
  useEffect(() => {
    AOS.init({ duration: 900, once: true });
  }, []);

  const values = [
    {
      icon: HeartIcon,
      title: "Compromiso con el Bienestar",
      description: "Dedicados a promover la salud mental y el desarrollo personal de cada individuo."
    },
    {
      icon: AcademicCapIcon,
      title: "Excelencia Profesional",
      description: "Equipo altamente calificado con formación continua y actualización permanente."
    },
    {
      icon: LightBulbIcon,
      title: "Enfoque Innovador",
      description: "Integramos las últimas investigaciones y métodos terapéuticos en nuestra práctica."
    },
    {
      icon: HandRaisedIcon,
      title: "Ética y Responsabilidad",
      description: "Mantenemos los más altos estándares éticos en nuestra práctica profesional."
    }
  ];

  return (
    <div className="space-y-24 py-16 bg-[#F9FAFB] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-[#374151] sm:text-5xl md:text-6xl">
            Sobre Nosotros
          </h1>
          <p className="mt-6 text-xl text-[#006C73] max-w-3xl mx-auto leading-relaxed">
            Somos un instituto comprometido con la excelencia en la atención psicológica, 
            formando profesionales y brindando servicios de calidad a la comunidad desde hace más de una década.
          </p>
        </div>
      </section>

      {/* Historia Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 lg:p-12" data-aos="fade-right">
              <h2 className="text-3xl font-bold text-gray-900">
                Nuestra Historia
              </h2>
              <p className="mt-6 text-lg text-gray-500 leading-relaxed">
                Fundado en 2010, el Instituto de Psicología Profesional de Argentina nació con la visión 
                de crear un espacio donde la excelencia profesional y el compromiso con la salud mental 
                se unieran para brindar atención de calidad a la comunidad.
              </p>
              <p className="mt-4 text-lg text-gray-500 leading-relaxed">
                A lo largo de los años, hemos crecido y evolucionado, manteniendo siempre nuestro 
                compromiso con la formación continua y la atención personalizada.
              </p>
            </div>
            <div className="relative h-96 lg:h-auto" data-aos="fade-left">
              <img
                className="absolute inset-0 w-full h-full object-cover"
                src="/images/image.jpg"
                alt="Equipo del Instituto de Psicología Profesional de Argentina"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Valores Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" data-aos="fade-up">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">
            Nuestros Valores
          </h2>
          <p className="mt-4 text-xl text-gray-500">
            Los principios que guían nuestra práctica profesional
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((value, idx) => (
            <div 
              key={value.title} 
              className="bg-white rounded-xl shadow-lg p-8 hover:shadow-xl transition-shadow duration-300"
              data-aos="zoom-in-up"
              data-aos-delay={idx * 100}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#00B19F]/10 mb-4">
                <value.icon className="h-6 w-6 text-[#00B19F]" />
              </div>
              <h3 className="mt-6 text-xl font-semibold text-gray-900">
                {value.title}
              </h3>
              <p className="mt-2 text-gray-500">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AboutPage; 