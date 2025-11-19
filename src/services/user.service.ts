import api from '../config/api';

export type Roles = 'admin' | 'professional' | 'content_manager' | 'financial';
export type Status = 'active' | 'inactive';

export interface User {
	id: string;
	name: string;
	email: string;
	role: Roles;
	status: Status;
	createdAt: string;
	commission?: number; // porcentaje IPPL
	saldoTotal: number;
	saldoPendiente: number;
}

export interface CreateUserData {
	name: string;
	email: string;
	password: string;
	role: 'admin' | 'professional' | 'content_manager' | 'financial';
	commission?: number;
}

export interface UpdateUserData {
	name?: string;
	email?: string;
	password?: string;
	role?: 'admin' | 'professional' | 'content_manager' | 'financial';
	status?: string;
	commission?: number;
}

const userService = {
	getUserById: async (id: number): Promise<User> => {
		const response = await api.get(`/users/${id}`);
		return response.data?.data || response.data || {
			id: '',
			name: '',
			email: '',
			role: 'professional' as Roles,
			status: 'active' as Status,
			createdAt: '',
			saldoTotal: 0,
			saldoPendiente: 0
		};
	},

	getProfessionals: async (): Promise<User[]> => {
		const response = await api.get('/users/professionals');
		const professionals = response.data?.data || response.data || [];
		return Array.isArray(professionals) ? professionals : [];
	},

	getUsers: async (): Promise<User[]> => {
		const response = await api.get('/users');
		const users = response.data?.data?.users || response.data?.data || response.data || [];
		return Array.isArray(users) ? users : [];
	},

	createUser: async (userData: CreateUserData): Promise<User> => {
		const response = await api.post('/users', userData);
		return response.data?.data || response.data || {
			id: '',
			name: userData.name,
			email: userData.email,
			role: userData.role,
			status: 'active' as Status,
			createdAt: new Date().toISOString(),
			commission: userData.commission,
			saldoTotal: 0,
			saldoPendiente: 0
		};
	},

	updateUser: async (id: string, userData: UpdateUserData): Promise<User> => {
		const response = await api.put(`/users/${id}`, userData);
		return response.data?.data || response.data || {
			id,
			name: userData.name || '',
			email: userData.email || '',
			role: (userData.role || 'professional') as Roles,
			status: (userData.status || 'active') as Status,
			createdAt: '',
			commission: userData.commission,
			saldoTotal: 0,
			saldoPendiente: 0
		};
	},

	deleteUser: async (id: string): Promise<void> => {
		await api.delete(`/users/${id}`);
	},

	permanentDeleteUser: async (id: string): Promise<void> => {
		await api.delete(`/users/${id}/permanent`);
	},

	abonarComision: async (id: string, abono: number): Promise<void> => {
		await api.post(`/users/${id}/abonar-comision`, { abono });
	},

	getAbonos: async (): Promise<
		Array<{
			id: string;
			professionalId: string;
			professionalName: string;
			amount: number;
			date: string;
		}>
	> => {
		const response = await api.get('/users/abonos');
		const abonos = response.data?.data?.abonos || response.data?.abonos || [];
		return Array.isArray(abonos) ? abonos : [];
	},
};

export default userService;
