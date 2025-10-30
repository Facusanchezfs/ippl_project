import React, { createContext, useContext, useState, useEffect } from 'react';
import authService, { User, LoginCredentials } from '../services/auth.service';

interface AuthContextType {
	user: User | null;
	login: (credentials: LoginCredentials) => Promise<void>;
	logout: () => void;
	isLoading: boolean;
	error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const token = localStorage.getItem('token');
		console.debug(
			'[AuthProvider] mount. hasToken:',
			!!token,
			'path:',
			window.location.pathname
		);
		const initAuth = () => {
			const currentUser = authService.getCurrentUser();
			if (currentUser) {
				setUser(currentUser);
			}
			setIsLoading(false);
		};

		initAuth();
	}, []);

	const login = async (credentials: LoginCredentials) => {
		try {
			setError(null);
			const response = await authService.login(credentials);
			localStorage.setItem('token', response.token);
			localStorage.setItem('user', JSON.stringify(response.user));
			setUser(response.user);
		} catch (err) {
			setError(
				'Error al iniciar sesión. Por favor, verifica tus credenciales.'
			);
			throw err;
		}
	};

	const logout = () => {
		authService.logout();
		setUser(null);
	};

	const value = {
		user,
		login,
		logout,
		isLoading,
		error,
	};

	return (
		<AuthContext.Provider value={value}>
			{!isLoading && children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth debe ser usado dentro de un AuthProvider');
	}
	return context;
};
