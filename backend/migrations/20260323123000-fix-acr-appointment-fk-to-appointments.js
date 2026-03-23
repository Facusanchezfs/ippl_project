'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const tableName = 'AppointmentCancellationRequests';

    const allTables = await queryInterface.showAllTables();
    const normalized = allTables.map((t) =>
      typeof t === 'string' ? t : t.tableName || t.TABLE_NAME
    );
    if (!normalized.includes(tableName)) {
      return;
    }

    const [fkRows] = await queryInterface.sequelize.query(`
      SELECT
        kcu.CONSTRAINT_NAME AS constraintName,
        kcu.REFERENCED_TABLE_NAME AS referencedTable
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = '${tableName}'
        AND kcu.COLUMN_NAME = 'appointmentId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `);

    const hasCorrectFk = fkRows.some(
      (row) => row.referencedTable === 'Appointments'
    );

    if (hasCorrectFk) {
      return;
    }

    for (const row of fkRows) {
      await queryInterface.removeConstraint(tableName, row.constraintName);
    }

    await queryInterface.addConstraint(tableName, {
      fields: ['appointmentId'],
      type: 'foreign key',
      name: 'fk_acr_appointment_id_appointments',
      references: {
        table: 'Appointments',
        field: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  },

  async down() {
    // No-op intencional: no restauramos FKs rotas históricas.
  },
};

