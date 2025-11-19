'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // OPTIMIZACIÓN FASE 3 PARTE 2: Índice para getProfessionalAppointments y validación de solapamientos
    // PROBLEMA: Query sin índice optimizado para WHERE (professionalId, active)
    // IMPACTO: Escaneo completo de tabla al buscar citas por profesional
    // SOLUCIÓN: Crear índice compuesto (professionalId, active)
    // COMPATIBILIDAD: No afecta queries existentes, solo mejora performance
    
    await queryInterface.addIndex('Appointments', ['professionalId', 'active'], {
      name: 'idx_appointments_professionalId_active',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('Appointments', 'idx_appointments_professionalId_active');
  }
};
