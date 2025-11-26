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
    
    // 1.3: Migrar StatusRequests - PRIMERO currentStatus
    // Verificar cuántos registros tienen 'alta' o 'absent' antes de actualizar
    const [altaCountBefore] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM StatusRequests WHERE currentStatus = 'alta';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const [absentCountBefore] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM StatusRequests WHERE currentStatus = 'absent';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    console.log(`Migrando StatusRequests: ${altaCountBefore[0]?.count || 0} con 'alta', ${absentCountBefore[0]?.count || 0} con 'absent'`);
    
    // Migrar currentStatus='alta' a 'active'
    const [altaUpdateResult] = await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET currentStatus = 'active'
      WHERE currentStatus = 'alta';
    `);
    
    // Migrar currentStatus='absent' a 'inactive'
    const [absentUpdateResult] = await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET currentStatus = 'inactive' 
      WHERE currentStatus = 'absent';
    `);
    
    // Verificar que se actualizaron correctamente
    const [altaCountAfter] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM StatusRequests WHERE currentStatus = 'alta';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const [absentCountAfter] = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count FROM StatusRequests WHERE currentStatus = 'absent';
    `, { type: Sequelize.QueryTypes.SELECT });
    
    if ((altaCountAfter[0]?.count || 0) > 0 || (absentCountAfter[0]?.count || 0) > 0) {
      throw new Error(`Error: Aún quedan valores 'alta' o 'absent' en currentStatus después de la actualización. alta: ${altaCountAfter[0]?.count}, absent: ${absentCountAfter[0]?.count}`);
    }
    
    // 1.4: Migrar StatusRequests - LUEGO requestedStatus
    // Migrar requestedStatus='alta' a 'active' y type='activation'
    await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET requestedStatus = 'active', type = 'activation'
      WHERE requestedStatus = 'alta';
    `);
    
    // Migrar requestedStatus='absent' a 'inactive'
    await queryInterface.sequelize.query(`
      UPDATE StatusRequests 
      SET requestedStatus = 'inactive' 
      WHERE requestedStatus = 'absent';
    `);
    
    // 1.5: Verificar que no queden valores inválidos antes de modificar ENUMs
    // Usar raw query para obtener el resultado correctamente
    const invalidCurrentStatusResult = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count 
      FROM StatusRequests 
      WHERE currentStatus NOT IN ('active', 'pending', 'inactive')
        OR currentStatus IS NULL;
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const invalidRequestedStatusResult = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count 
      FROM StatusRequests 
      WHERE requestedStatus NOT IN ('active', 'pending', 'inactive')
        OR requestedStatus IS NULL;
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const invalidPatientStatusResult = await queryInterface.sequelize.query(`
      SELECT COUNT(*) as count 
      FROM Patients 
      WHERE status NOT IN ('active', 'pending', 'inactive')
        OR status IS NULL;
    `, { type: Sequelize.QueryTypes.SELECT });
    
    const invalidCurrentCount = invalidCurrentStatusResult[0]?.count || 0;
    const invalidRequestedCount = invalidRequestedStatusResult[0]?.count || 0;
    const invalidPatientCount = invalidPatientStatusResult[0]?.count || 0;
    
    if (invalidCurrentCount > 0 || invalidRequestedCount > 0 || invalidPatientCount > 0) {
      // Mostrar detalles de los valores inválidos para debugging
      const [invalidCurrentDetails] = await queryInterface.sequelize.query(`
        SELECT DISTINCT currentStatus, COUNT(*) as count
        FROM StatusRequests 
        WHERE currentStatus NOT IN ('active', 'pending', 'inactive') OR currentStatus IS NULL
        GROUP BY currentStatus;
      `, { type: Sequelize.QueryTypes.SELECT });
      
      const [invalidRequestedDetails] = await queryInterface.sequelize.query(`
        SELECT DISTINCT requestedStatus, COUNT(*) as count
        FROM StatusRequests 
        WHERE requestedStatus NOT IN ('active', 'pending', 'inactive') OR requestedStatus IS NULL
        GROUP BY requestedStatus;
      `, { type: Sequelize.QueryTypes.SELECT });
      
      console.error('Valores inválidos encontrados:');
      console.error('currentStatus inválidos:', invalidCurrentDetails);
      console.error('requestedStatus inválidos:', invalidRequestedDetails);
      
      throw new Error(`Aún hay valores inválidos en la base de datos. currentStatus: ${invalidCurrentCount}, requestedStatus: ${invalidRequestedCount}, patientStatus: ${invalidPatientCount}`);
    }
    
    // 1.6: Actualizar pacientes que tenían solicitudes de alta aprobadas pero no estaban en active
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

