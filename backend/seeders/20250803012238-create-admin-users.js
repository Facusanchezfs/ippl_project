'use strict';
/** @type {import('sequelize-cli').Migration} */
const bcrypt = require('bcryptjs');
module.exports = {
	async up(queryInterface, Sequelize) {
		const supporthash = await bcrypt.hash('Password1', 10);
		const testHash = await bcrypt.hash('1234', 10);
		await queryInterface.bulkInsert('Users', [
			{
				name: 'Roberta Gorischnik',
				email: 'robertagoris@gmail.com',
				password: supporthash,
				role: 'admin',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Antonella Gonzalez',
				email: 'antuggonzalez13@gmail.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Ariadna Santos',
				email: 'ariadnasantosa.psi@gmail.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Betty Wajsblat',
				email: 'sbw.4170@ya.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Cecilia Duran',
				email: 'psimariacecilia.duran@gmail.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Delfina Bovier',
				email: 'bovierdelfina29@gmail.con',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Dora Francou',
				email: 'dorafrancou@hotmail.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Emanuel Cerundolo',
				email: 'emanuelceru@gmail.com',
				password: supporthash,
				role: 'professional',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			      {
			        name: 'Flavia Naves',
			        email: 'flaviaandreanaves@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Florencia Richard',
			        email: 'florenciasrichard@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Gisela Saint Paul',
			        email: 'giselasaintpaul@yahoo.com.ar',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Guillermina López',
			        email: 'analiticabuenosaires@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Juan Rossi',
			        email: 'juann.rossi11@hotmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			   {
			        name: 'Julia Sampedro',
			        email: 'sampedromjulia@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Juliana Badano',
			        email: 'badanojuliana02@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Julieta Basgall',
			        email: 'julieta.basgall@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Karina Garcia',
			        email: 'a.karinagarcia@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Lorena Fogel',
			        email: 'lorenafogel@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Luciana Gennari',
			        email: 'lucianapgennari@yahoo.com.ar',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Luisina Montenegro',
			        email: 'Montenegroluisina@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Maria Fernandez',
			        email: 'mariafernandezcastano@yahoo.com.ar',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Maria Whittingslow',
			        email: 'mariawhi@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Máximo Agüero',
			        email: 'lic.maximoaguero@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Melina Nadal',
			        email: 'melinajnadal@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Mónica Carrazán',
			        email: 'monicacarrazan@live.com.ar',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Natalia Soracco',
			        email: 'nataliasoracco@hotmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Pablo Reto',
			        email: 'pabloretov@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Rodolfo Cergneux',
			        email: 'rolocergneux@hotmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Sofia Loker',
			        email: 'sofia.loker@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Sol Campocaracoche',
			        email: 'soledadcampocaracoche@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Tatiana Sfiligoy',
			        email: 'Tatysfiligoy@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Valeria Bregant',
			        email: 'valeriacbregant@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Virginia',
			        email: 'virsaidon@gmail.com',
			        password: supporthash,
			        role: 'professional',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			    {
			        name: 'Jazmin Sanchez',
			        email: 'jazgorissanchez@gmail.com',
			        password: supporthash,
			        role: 'content_manager',
			        status: 'active',
			        createdAt: new Date(),
			        updatedAt: new Date()
			    },
			{
				name: 'Agos Benedetti',
				email: 'agostinabenedetti19@gmail.com',
				password: supporthash,
				role: 'financial',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			{
				name: 'Test Dev',
				email: 'test@dev.com',
				password: testHash,
				role: 'admin',
				status: 'active',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		]);
	},

	async down(queryInterface, Sequelize) {
		// Elimina los usuarios por su email
		await queryInterface.bulkDelete(
			'Users',
			{
				email: {
					[Sequelize.Op.in]: ['facundo.eet2@gmail.com', 'test@dev.com'],
				},
			},
			{}
		);
	},
};
