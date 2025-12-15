import api from '../config/api';

export interface Derivation {
	id: string;
	patientId: string;
	professionalId: string;
	createdAt: string;
	patientName: string;
	professionalName: string;
}

const derivationService = {
	// Obtener todas las derivaciones
	// Opcional: filtrar por professionalId
	getDerivations: async (professionalId?: string): Promise<Derivation[]> => {
		const params = professionalId ? { professionalId } : {};
		const response = await api.get<{ success: true; data: { derivations: Derivation[] } }>(
			'/derivations',
			{ params }
		);
		const derivations = response.data?.data?.derivations || [];
		return Array.isArray(derivations) ? derivations : [];
	},
};

export default derivationService;

