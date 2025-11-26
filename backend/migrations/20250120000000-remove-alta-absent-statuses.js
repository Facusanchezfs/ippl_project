'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // FASE 1: Migrar datos existentes antes de modificar ENUMs
    
    // 1.1: Migrar pacientes con status='alta' a 'active' y setear activatedAt si no existe
    await queryInterface.sequelize.query(`
      UPDATE Patients 
      SET status = 'active', activatedAt = NOW() 
      WHERE status = 'alta' AND activatedAt IS NULL;
    `);
    
    await queryInterface.sequelize.query(`
      UPDATE Patients 
      SET status = 'active' 
      WHERE status = 'alta' AND activatedAt IS NOT NULL;
    `);
    
    // 1.2: Migrar pacientes con status='absent' a 'inactive'
    await queryInterface.sequelize.query(`
      UPDATE Patients 
      SET status = 'inactive' 
      WHERE status = 'absent';
    `);
    
    // 1.3: Migrar StatusRequests con requestedStatus='alta' a 'active' y type='activation'
    await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET requestedStatus = 'active', type = 'activation'
      WHERE requestedStatus = 'alta';
    `);
    
    // 1.4: Migrar StatusRequests con currentStatus o requestedStatus='absent' a 'inactive'
    await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET currentStatus = 'inactive' 
      WHERE currentStatus = 'absent';
    `);
    
    await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET requestedStatus = 'inactive' 
      WHERE requestedStatus = 'absent';
    `);
    
    // 1.5: Actualizar pacientes que tenían solicitudes de alta aprobadas pero no estaban en active
    await queryInterface.sequelize.query(`
      UPDATE Patients p
      INNER JOIN StatusRequests sr ON p.id = sr.patientId
      SET p.status = 'active', p.activatedAt = COALESCE(p.activatedAt, sr.updatedAt, sr.createdAt)
      WHERE sr.type = 'activation' 
        AND sr.status = 'approved' 
        AND sr.requestedStatus = 'active'
        AND p.status != 'active';
    `);
    
    // FASE 2: Modificar ENUMs en la base de datos
    
    // 2.1: Modificar ENUM de Patients.status
    await queryInterface.sequelize.query(`
      ALTER TABLE Patients 
      MODIFY COLUMN status ENUM('active', 'pending', 'inactive') NOT NULL DEFAULT 'active';
    `);
    
    // 2.2: Modificar ENUMs de StatusRequests
    await queryInterface.sequelize.query(`
      ALTER TABLE StatusRequests 
      MODIFY COLUMN currentStatus ENUM('active', 'pending', 'inactive') NOT NULL;
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE StatusRequests 
      MODIFY COLUMN requestedStatus ENUM('active', 'pending', 'inactive') NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revertir: Agregar 'alta' y 'absent' de vuelta a los ENUMs
    // NOTA: No revertimos los datos migrados porque sería incorrecto
    
    await queryInterface.sequelize.query(`
      ALTER TABLE Patients 
      MODIFY COLUMN status ENUM('active', 'pending', 'inactive', 'absent', 'alta') NOT NULL DEFAULT 'active';
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE StatusRequests 
      MODIFY COLUMN currentStatus ENUM('active', 'pending', 'inactive', 'absent', 'alta') NOT NULL;
    `);
    
    await queryInterface.sequelize.query(`
      ALTER TABLE StatusRequests 
      MODIFY COLUMN requestedStatus ENUM('active', 'pending', 'inactive', 'absent', 'alta') NOT NULL;
    `);
  }
};

