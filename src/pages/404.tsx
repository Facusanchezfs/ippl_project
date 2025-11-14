import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-white via-[#F6F8FC] to-[#E8F3FF] min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-semibold uppercase text-xs tracking-[0.25em]">
            Error 404
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
            Ups, no encontramos la página que estás buscando
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Puede que la URL esté mal escrita, que el contenido haya sido movido o que ya no exista.
            Mientras tanto, podés regresar al inicio o escribirnos para ayudarte a encontrar lo que necesitas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-xl text-white bg-primary shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors"
            >
              Volver al inicio
            </Link>
            <Link
              to="/contacto"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold rounded-xl border border-primary text-primary hover:bg-primary/5 transition-colors"
            >
              Contactar al equipo
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 pt-6 border-t border-primary/10">
            {[{
              label: 'Soporte humano',
              value: 'Respuesta en menos de 24 hs'
            }, {
              label: 'Pacientes activos',
              value: 'Más de 200 acompañados'
            }, {
              label: 'Profesionales',
              value: 'Equipo interdisciplinario'
            }].map((item) => (
              <div key={item.label} className="bg-white/80 backdrop-blur rounded-xl p-4 shadow-sm border border-white">
                <p className="text-xs uppercase tracking-widest text-primary/70 font-semibold">
                  {item.label}
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-primary/10 blur-3xl" aria-hidden="true" />
          <div className="relative bg-white rounded-3xl shadow-xl border border-primary/10 p-8 space-y-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary text-2xl font-bold">
              404
            </div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Estamos para acompañarte
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Si estás intentando acceder a un recurso del panel o a información puntual, escribinos y te guiamos paso a paso para que puedas continuar.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                <span>
                  Email: <a href="mailto:info@ippl.com" className="text-primary font-semibold">info@ippl.com</a>
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
                <span>
                  Teléfono: <a href="tel:+543442123456" className="text-primary font-semibold">+54 3442 123 456</a>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFoundPage; 