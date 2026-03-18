'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('Derivations', {
			id: {
				type: Sequelize.BIGINT,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
			},
			patientId: {
				type: Sequelize.BIGINT,
				allowNull: false,
				references: { model: 'Patients', key: 'id' },
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},
			professionalId: {
				type: Sequelize.BIGINT,
				allowNull: false,
				references: { model: 'Users', key: 'id' },
				onUpdate: 'CASCADE',
			},
			textNote: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			audioNote: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			sessionFrequency: {
				type: Sequelize.ENUM('weekly', 'biweekly', 'monthly', 'twice_weekly'),
				allowNull: true,
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal(
					'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
				),
			},
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.dropTable('Derivations');
	},
};
