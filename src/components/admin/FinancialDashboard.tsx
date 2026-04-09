/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService, { UpdateUserData, User } from '../../services/user.service';
import { getFriendlyErrorMessage, ErrorMessages } from '../../utils/errorMessages';
import {
	AdjustmentsHorizontalIcon,
	ExclamationCircleIcon,
	ArrowPathIcon,
	CalendarIcon,
	UserGroupIcon,
	ArrowLeftIcon,
	EyeIcon,
	ArrowDownTrayIcon,
	MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import patientsService from '../../services/patients.service';
import appointmentsService from '../../services/appointments.service';
import { parseNumber } from '../../utils/functionUtils';
import type { Appointment } from '../../types/Appointment';
import ChangePasswordModal from '../professional/ChangePassword';
import financialReconcileService, {
	type ReconcileSaldosPreviewPayload,
	type ReconcileSaldosRow,
} from '../../services/financialReconcile.service';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';

interface FinancialStats {
	totalRevenue: number;
	pendingPayments: number;
	completedAppointments: number;
	averagePayment: number;
	recentTransactions: Array<{
		id: string;
		patientName: string;
		amount: number;
		date: string;
		type: string;
	}>;
	paymentsByProfessional: Array<{
		professionalName: string;
		totalAmount: number;
		pendingAmount: number;
	}>;
}

const TRANSACTIONS_PER_PAGE = 10;
const PROFESSIONALS_PER_PAGE = 10;

/** Valor bruto de sesión completada: el backend suele cargar `sessionCost`; `paymentAmount` a menudo queda 0 si el paciente aún debe (`remainingBalance`). */
function grossCompletedSessionValue(
	a: Pick<Appointment, 'sessionCost' | 'paymentAmount' | 'remainingBalance'>
): number {
	const sc = a.sessionCost != null ? Number(a.sessionCost) : NaN;
	if (Number.isFinite(sc) && sc > 0) return sc;
	const paid = Number(a.paymentAmount) || 0;
	const rem = Number(a.remainingBalance) || 0;
	return paid + rem;
}

type ProfessionalSortField = 'name' | 'saldoPendiente';
type SortDirection = 'asc' | 'desc';

const FinancialDashboard: React.FC = () => {
	const navigate = useNavigate();
	const { user } = useAuth();
	const [stats, setStats] = useState<FinancialStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [userLoaded, setUserLoaded] = useState<User>();
	const [professionals, setProfessionals] = useState<User[]>([]);
	const [selectedProfessional, setSelectedProfessional] = useState<User | null>(
		null
	);
	const [totalDeudaComision, setTotalDeudaComision] = useState(0);
 	const [showModal, setShowModal] = useState(false);
	const [recentAbonos, setRecentAbonos] = useState<
		{ name: string; amount: number; date: string }[]
	>([]);
	const [transactionPage, setTransactionPage] = useState(0);
	const [professionalPage, setProfessionalPage] = useState(0);
	const [professionalSort, setProfessionalSort] = useState<{
		field: ProfessionalSortField;
		direction: SortDirection;
	}>({ field: 'name', direction: 'asc' });
	const [professionalSearch, setProfessionalSearch] = useState<string>('');
	const [reconcilePayload, setReconcilePayload] =
		useState<ReconcileSaldosPreviewPayload | null>(null);
	const [reconcileLoading, setReconcileLoading] = useState(false);
	const [reconcileApplying, setReconcileApplying] = useState(false);
	const [reconcileSectionOpen, setReconcileSectionOpen] = useState(false);

	useEffect(() => {
		if (user) {
		loadUser();
		}
	}, [user]);

	useEffect(() => {
		loadFinancialStats();
		loadProfessionals();
		loadRecentAbonos();
	}, []);

	const loadUser = async () => {
		const userToLoad = await userService.getUserById(parseNumber(user?.id))
		setUserLoaded(userToLoad);
  	}

	const loadFinancialStats = async () => {
		try {
			setIsLoading(true);
			const appointments = await appointmentsService.getAllAppointments();
			const completedAppointments = appointments.filter(
				(a) => a.status === 'completed'
			);
			const totalRevenue = completedAppointments.reduce(
				(sum, a) => sum + grossCompletedSessionValue(a),
				0
			);
			const pendingPayments = completedAppointments.reduce(
				(sum, a) => sum + (a.remainingBalance || 0),
				0
			);
			const averagePayment =
				completedAppointments.length > 0
					? totalRevenue / completedAppointments.length
					: 0;

			const professionalPayments = completedAppointments.reduce(
				(acc, appointment) => {
					const professional = acc.find(
						(p) => p.professionalName === appointment.professionalName
					);
					if (professional) {
						professional.totalAmount += grossCompletedSessionValue(appointment);
						professional.pendingAmount += appointment.remainingBalance || 0;
					} else {
						acc.push({
							professionalName: appointment.professionalName,
							totalAmount: grossCompletedSessionValue(appointment),
							pendingAmount: appointment.remainingBalance || 0,
						});
					}
					return acc;
				},
				[] as Array<{
					professionalName: string;
					totalAmount: number;
					pendingAmount: number;
				}>
			);

			const recentTransactions = completedAppointments
				.filter((a) => grossCompletedSessionValue(a) > 0)
				.map((a) => ({
					id: a.id,
					patientName: a.patientName,
					amount:
						a.paymentAmount && a.paymentAmount > 0
							? a.paymentAmount
							: grossCompletedSessionValue(a),
					date: a.completedAt || a.date,
					type: a.type,
				}))
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.slice(0, 5);

			setStats({
				totalRevenue,
				pendingPayments,
				completedAppointments: completedAppointments.length,
				averagePayment,
				recentTransactions,
				paymentsByProfessional: professionalPayments,
			});
		} catch (error) {
			console.error('Error al cargar estadísticas financieras:', error);
			const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar las estadísticas. Intenta recargar la página.');
			toast.error(friendlyMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const loadProfessionals = async () => {
		try {
			const users = await userService.getProfessionals();
			setProfessionals(users);

			const totalDeuda = users.reduce(
				(acc, { saldoPendiente }) => acc + (saldoPendiente ?? 0),
				0
			);

			setTotalDeudaComision(totalDeuda);
		} catch (error) {
			const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar los profesionales. Intenta recargar la página.');
			toast.error(friendlyMessage);
		}
	};

	const loadReconcilePreview = async () => {
		try {
			setReconcileLoading(true);
			const data = await financialReconcileService.getPreview();
			setReconcilePayload(data);
		} catch (error) {
			const friendlyMessage = getFriendlyErrorMessage(
				error,
				'No se pudo consultar los desfasajes. Intenta de nuevo.'
			);
			toast.error(friendlyMessage);
		} finally {
			setReconcileLoading(false);
		}
	};

	const handleOpenReconcileSection = async () => {
		if (!reconcileSectionOpen) {
			setReconcileSectionOpen(true);
			await loadReconcilePreview();
		} else {
			setReconcileSectionOpen(false);
		}
	};

	const handleApplyReconcile = async () => {
		if (!reconcilePayload?.cantidadDesfase) return;
		const ok = window.confirm(
			`Se van a actualizar los saldos de ${reconcilePayload.cantidadDesfase} profesional(es) para que coincidan con esta revisión. ¿Continuar?`
		);
		if (!ok) return;
		try {
			setReconcileApplying(true);
			await financialReconcileService.apply();
			toast.success('Saldos actualizados correctamente.');
			await Promise.all([loadReconcilePreview(), loadProfessionals()]);
		} catch (error) {
			const friendlyMessage = getFriendlyErrorMessage(
				error,
				'No se pudo aplicar la corrección.'
			);
			toast.error(friendlyMessage);
		} finally {
			setReconcileApplying(false);
		}
	};

	const sortedReconcileRows: ReconcileSaldosRow[] = reconcilePayload
		? [...reconcilePayload.rows].sort((a, b) => {
				if (a.hayDesfase !== b.hayDesfase) return a.hayDesfase ? -1 : 1;
				return String(a.name).localeCompare(String(b.name), 'es');
			})
		: [];

	const changePassword = async (newPassword: string) =>{
    try{
      if (!userLoaded) {
        toast.error('Los datos del usuario no están disponibles. Intenta recargar la página.');
        return;
      }
      
      const updateData: UpdateUserData = {};
      updateData.password = newPassword;
      await userService.updateUser(userLoaded.id, updateData);
      toast.success('Contraseña cambiada correctamente');
    } catch (e) {
      console.error('Error al cambiar contraseña:', e);
      const friendlyMessage = getFriendlyErrorMessage(e, ErrorMessages.PASSWORD_CHANGE_FAILED);
      toast.error(friendlyMessage);
    }
  }

	const loadRecentAbonos = async () => {
		try {
			const abonos = await userService.getAbonos();
			if (!Array.isArray(abonos)) {
				setRecentAbonos([]);
				return;
			}
			const recientes = abonos
				.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
				.map((a) => ({
					name: a.professionalName,
					amount: Number(a.amount) || 0,
					date: a.date,
				}));
			setRecentAbonos(recientes);
		} catch (error) {
			console.error('Error al cargar abonos recientes:', error);
			const friendlyMessage = getFriendlyErrorMessage(error, 'No se pudieron cargar los abonos recientes. Intenta recargar la página.');
			toast.error(friendlyMessage);
			setRecentAbonos([]);
		}
	};

	const handleRefresh = async () => {
		setIsRefreshing(true);
		await Promise.all([loadFinancialStats(), loadProfessionals(), loadRecentAbonos()]);
		setTransactionPage(0);
		setProfessionalPage(0);
		setIsRefreshing(false);
		toast.success('Datos actualizados');
	};

	const generateProfessionalPDF = async (prof: User) => {
		const doc = new jsPDF();
		const now = new Date();
		const fecha = now.toLocaleString('es-ES', {
			dateStyle: 'long',
			timeStyle: 'short',
		});
		
		const allAbonos = await userService.getAbonos();
		const profAbonos = allAbonos.filter(a => String(a.professionalId) === String(prof.id));
		
		const porcentajeIppl = Number(prof.commission) || 0;
		const saldoTotal = Number(prof.saldoTotal) || 0;
		const saldoIppl = saldoTotal * (porcentajeIppl / 100);
		const saldoNeto = saldoTotal - saldoIppl;
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(16);
		doc.text('Instituto Psicológico y Psicoanálisis del Litoral', 105, 12, {
			align: 'center',
		});
		doc.setFontSize(18);
		doc.text(`Resumen Financiero de ${prof.name}`, 10, 28);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(11);
		doc.text(`Fecha de generación: ${fecha}`, 10, 36);
		doc.setLineWidth(0.5);
		doc.line(10, 39, 200, 39);
		doc.setFontSize(12);
		doc.text(`Email: ${prof.email}`, 10, 48);
		doc.text(`Saldo Total: $${saldoTotal.toFixed(2)}`, 10, 56);
		doc.text(`Porcentaje del IPPL: ${porcentajeIppl}%`, 10, 64);
		doc.text(`Descuento IPPL: $${saldoIppl.toFixed(2)}`, 10, 72);
		doc.text(`Saldo Neto (profesional): $${saldoNeto.toFixed(2)}`, 10, 80);
		let y = 88;
		doc.setLineWidth(0.1);
		doc.line(10, y + 4, 200, y + 4);
		y += 10;
		
		if (profAbonos.length > 0) {
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(14);
			doc.text('Pagos Realizados:', 10, y);
			y += 8;
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(12);
			
			doc.setFillColor(230, 230, 230);
			doc.rect(10, y - 5, 190, 8, 'F');
			doc.setFont('helvetica', 'bold');
			doc.text('Fecha', 15, y);
			doc.text('Monto', 180, y, { align: 'right' });
			y += 7;
			doc.setFont('helvetica', 'normal');
			
			let totalPagos = 0;
			profAbonos.forEach((abono: any) => {
				const fechaAbono = new Date(abono.date).toLocaleDateString('es-ES');
				doc.text(fechaAbono, 15, y);
				doc.text(`$${Number(abono.amount).toFixed(2)}`, 180, y, { align: 'right' });
				totalPagos += Number(abono.amount);
				y += 7;
				if (y > 270) {
					doc.addPage();
					y = 20;
				}
			});
			
			doc.setFont('helvetica', 'bold');
			doc.line(10, y + 2, 200, y + 2);
			y += 5;
			doc.text('Total Pagos:', 15, y);
			doc.text(`$${totalPagos.toFixed(2)}`, 180, y, { align: 'right' });
			y += 10;
		}
		
		doc.setLineWidth(0.1);
		doc.line(10, y + 4, 200, y + 4);
		y += 10;
		
		const patients = await patientsService.getProfessionalPatients(prof.id);
		const appointments = await appointmentsService.getProfessionalAppointments(
			prof.id
		);
		const patientsWithDebt = patients
			.map((patient: any) => {
				const debt = appointments
					.filter(
						(a: any) =>
							a.patientId === patient.id &&
							a.status === 'completed' &&
							a.attended
					)
					.reduce(
						(acc: number, curr: any) => acc + (curr.remainingBalance || 0),
						0
					);
				return { name: patient.name, debt };
			})
			.filter((p: any) => p.debt > 0);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(14);
		doc.text('Pacientes con Deuda:', 10, y);
		y += 8;
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(12);
		if (patientsWithDebt.length === 0) {
			doc.text('Ningún paciente tiene deuda pendiente.', 10, y);
		} else {
			doc.setFillColor(230, 230, 230);
			doc.rect(10, y - 5, 190, 8, 'F');
			doc.setFont('helvetica', 'bold');
			doc.text('Nombre', 15, y);
			doc.text('Deuda', 180, y, { align: 'right' });
			y += 7;
			doc.setFont('helvetica', 'normal');
			patientsWithDebt.forEach((p: any) => {
				doc.text(p.name, 15, y);
				doc.text(`$${p.debt.toFixed(2)}`, 180, y, { align: 'right' });
				y += 7;
				if (y > 270) {
					doc.addPage();
					y = 20;
				}
			});
		}
		doc.save(`Resumen_${prof.name.replace(/ /g, '_')}.pdf`);
	};

	const paginatedTransactions = React.useMemo(() => {
		const start = transactionPage * TRANSACTIONS_PER_PAGE;
		return recentAbonos.slice(start, start + TRANSACTIONS_PER_PAGE);
	}, [recentAbonos, transactionPage]);

	const totalTransactionPages = Math.max(
		Math.ceil(recentAbonos.length / TRANSACTIONS_PER_PAGE),
		1
	);

	const filteredAndSortedProfessionals = React.useMemo(() => {
		let list = [...professionals];

		if (professionalSearch.trim()) {
			const searchLower = professionalSearch.trim().toLowerCase();
			list = list.filter((prof) => {
				const nameLower = prof.name.toLowerCase();
				const words = nameLower.split(/\s+/);
				return words.some((word) => word.startsWith(searchLower));
			});
		}

		list.sort((a, b) => {
			const multiplier = professionalSort.direction === 'asc' ? 1 : -1;

			if (professionalSort.field === 'name') {
				return (
					a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) *
					multiplier
				);
			}

			const saldoA = Number(a.saldoPendiente ?? 0);
			const saldoB = Number(b.saldoPendiente ?? 0);
			if (saldoA === saldoB) return 0;
			return saldoA > saldoB ? 1 * multiplier : -1 * multiplier;
		});
		return list;
	}, [professionals, professionalSort, professionalSearch]);

	useEffect(() => {
		setProfessionalPage(0);
	}, [professionalSort, professionalSearch]);

	const paginatedProfessionals = React.useMemo(() => {
		const start = professionalPage * PROFESSIONALS_PER_PAGE;
		return filteredAndSortedProfessionals.slice(start, start + PROFESSIONALS_PER_PAGE);
	}, [filteredAndSortedProfessionals, professionalPage]);

	const totalProfessionalPages = Math.max(
		Math.ceil(filteredAndSortedProfessionals.length / PROFESSIONALS_PER_PAGE),
		1
	);

	const toggleProfessionalSort = (field: ProfessionalSortField) => {
		setProfessionalSort((prev) => {
			if (prev.field === field) {
				return {
					field,
					direction: prev.direction === 'asc' ? 'desc' : 'asc',
				};
			}
			return { field, direction: field === 'name' ? 'asc' : 'desc' };
		});
	};

	const getSortIndicator = (field: ProfessionalSortField) => {
		if (professionalSort.field !== field) return null;
		return professionalSort.direction === 'asc' ? '↑' : '↓';
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-8">
			<div className="bg-white rounded-2xl shadow-lg p-6">
				<div className="flex justify-between items-center mb-6">
					<div className="flex items-center gap-4">
						{user?.role === 'admin' && (
							<button
								onClick={() => navigate('/admin')}
								className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
							>
								<ArrowLeftIcon className="h-5 w-5 mr-2" />
								Volver al Dashboard
							</button>
						)}
						<div>
							<h1 className="text-2xl font-bold text-gray-900">
								Panel Financiero
							</h1>
							<p className="mt-1 text-gray-600">
								Resumen financiero y estadísticas
							</p>
						</div>
					</div>
          <div className="flex items-center gap-4">
            {user?.role === 'financial' && (
              <button
                onClick={() => setShowModal(true)}
                disabled={!userLoaded}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  userLoaded 
                    ? 'text-blue-700 bg-blue-50 hover:bg-blue-100' 
                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }`}
                >
                <AdjustmentsHorizontalIcon className="h-5 w-5 mr-2" />
                Cambiar contraseña
              </button>
            )}
						<button
							onClick={handleRefresh}
							className={`flex items-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors ${
								isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
							}`}
							disabled={isRefreshing}
						>
							<ArrowPathIcon
								className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
							/>
							Actualizar datos
						</button>
					</div>
				</div>

				{stats && (
					<>
						{/* Estadísticas Principales */}
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
							<div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6">
								<div className="flex items-center">
									<div className="bg-red-500/10 p-3 rounded-lg">
										<ExclamationCircleIcon className="h-6 w-6 text-red-600" />
									</div>
									<div className="ml-4">
										<h3 className="text-2xl font-bold text-gray-900">
											$
											{totalDeudaComision.toLocaleString('es-CO', {
												minimumFractionDigits: 2,
											})}
										</h3>
										<p className="text-sm text-gray-600">
											Pagos Pendientes con el Instituto
										</p>
									</div>
								</div>
							</div>

							<div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
								<div className="flex items-center">
									<div className="bg-blue-500/10 p-3 rounded-lg">
										<CalendarIcon className="h-6 w-6 text-blue-600" />
									</div>
									<div className="ml-4">
										<h3 className="text-2xl font-bold text-gray-900">
											{stats?.completedAppointments || 0}
										</h3>
										<p className="text-sm text-gray-600">Citas Completadas</p>
									</div>
								</div>
							</div>
						</div>

						{/* Transacciones Recientes y Resumen por Profesional */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Transacciones Recientes */}
							<div className="bg-white rounded-xl shadow p-6">
								<h3 className="text-lg font-semibold text-gray-900 mb-4">
									Transacciones Recientes
								</h3>
								<div className="space-y-4">
									{recentAbonos.length === 0 ? (
										<div className="text-gray-500">No hay abonos recientes</div>
									) : (
										paginatedTransactions.map((abono, idx) => (
											<div
												key={`${abono.name}-${abono.date}-${idx}`}
												className="items-center justify-between p-4 bg-gray-50 rounded-lg"
											>
												<div className="flex items-center">
													<UserGroupIcon className="h-8 w-8 text-gray-400" />
													<div className="ml-4">
														<p className="text-sm font-medium text-gray-900">
															{abono.name}
														</p>
														<p className="text-xs text-gray-500">
															{new Date(abono.date).toLocaleDateString(
																'es-ES',
																{
																	year: 'numeric',
																	month: 'long',
																	day: 'numeric',
																}
															)}
														</p>
													</div>
												</div>
												<div className="text-right">
													<p className="text-sm font-semibold text-green-600">
														+$
														{abono.amount.toLocaleString('es-CO', {
															minimumFractionDigits: 2,
														})}
													</p>
													<p className="text-xs text-gray-500">Abono</p>
												</div>
											</div>
										))
									)}
								</div>
								{recentAbonos.length > TRANSACTIONS_PER_PAGE && (
									<div className="flex justify-end items-center gap-3 mt-4">
										<button
											onClick={() => setTransactionPage((prev) => Math.max(prev - 1, 0))}
											disabled={transactionPage === 0}
											className="px-3 py-1 text-sm rounded-md border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Anterior
										</button>
										<span className="text-sm text-gray-500">
											Página {transactionPage + 1} de {totalTransactionPages}
										</span>
										<button
											onClick={() =>
												setTransactionPage((prev) =>
													Math.min(prev + 1, totalTransactionPages - 1)
												)
											}
											disabled={transactionPage >= totalTransactionPages - 1}
											className="px-3 py-1 text-sm rounded-md border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Siguiente
										</button>
									</div>
								)}
							</div>

							{/* Resumen por Profesional */}
							<div className="bg-white rounded-2xl shadow p-6">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
									<h2 className="text-xl font-bold items-center gap-2">
										<UserGroupIcon className="h-6 w-6 text-blue-600 inline mr-2" /> Resumen
										por Profesional
									</h2>
									<div className="relative w-full sm:w-64">
										<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
											<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
										</div>
										<input
											type="text"
											value={professionalSearch}
											onChange={(e) => setProfessionalSearch(e.target.value)}
											placeholder="Buscar por nombre o apellido..."
											className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
										/>
									</div>
								</div>
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-gray-200">
										<thead className="bg-gray-50">
											<tr>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
													<button
														type="button"
														onClick={() => toggleProfessionalSort('name')}
														className="flex items-center gap-1 hover:text-gray-700"
													>
														<span>Nombre</span>
														{professionalSort.field === 'name' && (
															<span className="text-gray-400 text-xs">
																{getSortIndicator('name')}
															</span>
														)}
													</button>
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
													<button
														type="button"
														onClick={() => toggleProfessionalSort('saldoPendiente')}
														className="flex items-center gap-1 hover:text-gray-700"
													>
														<span>Saldo Pendiente</span>
														{professionalSort.field === 'saldoPendiente' && (
															<span className="text-gray-400 text-xs">
																{getSortIndicator('saldoPendiente')}
															</span>
														)}
													</button>
												</th>
												<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
													Acciones
												</th>
											</tr>
										</thead>
										<tbody className="bg-white divide-y divide-gray-200">
											{paginatedProfessionals.map((prof) => {
												const saldoPendientePacientes = prof.saldoPendiente;
												return (
													<tr key={prof.id} className="hover:bg-gray-50">
														<td className="px-6 py-4 whitespace-nowrap">
															{prof.name}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-red-600 font-semibold">
															$
															{saldoPendientePacientes.toLocaleString('es-CO', {
																minimumFractionDigits: 2,
															})}
														</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<div className="flex gap-3">
																<button
																	onClick={() => setSelectedProfessional(prof)}
																	className="text-blue-600 hover:text-blue-900 transition-colors"
																	title="Ver detalle"
																	aria-label="Ver detalle"
																>
																	<EyeIcon className="h-5 w-5" />
																</button>
																<button
																	onClick={() => generateProfessionalPDF(prof)}
																	className="text-green-600 hover:text-green-900 transition-colors"
																	title="Generar PDF"
																	aria-label="Generar PDF"
																>
																	<ArrowDownTrayIcon className="h-5 w-5" />
																</button>
															</div>
														</td>
													</tr>
												);
											})}
											{filteredAndSortedProfessionals.length === 0 && (
												<tr>
													<td
														className="px-6 py-4 text-center"
														colSpan={3}
													>
														{professionalSearch.trim() ? (
															<div className="flex flex-col items-center justify-center py-8">
																<MagnifyingGlassIcon className="h-12 w-12 text-gray-300 mb-3" />
																<p className="text-gray-600 font-medium text-lg">
																	No se encontraron profesionales
																</p>
																<p className="text-gray-500 text-sm mt-1">
																	No hay ningún profesional cuyo nombre o apellido comience con "{professionalSearch}"
																</p>
															</div>
														) : (
															<span className="text-gray-500">No hay profesionales registrados.</span>
														)}
													</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
								{filteredAndSortedProfessionals.length > PROFESSIONALS_PER_PAGE && (
									<div className="flex justify-end items-center gap-3 mt-4">
										<button
											onClick={() => setProfessionalPage((prev) => Math.max(prev - 1, 0))}
											disabled={professionalPage === 0}
											className="px-3 py-1 text-sm rounded-md border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Anterior
										</button>
										<span className="text-sm text-gray-500">
											Página {professionalPage + 1} de {totalProfessionalPages}
										</span>
										<button
											onClick={() =>
												setProfessionalPage((prev) =>
													Math.min(prev + 1, totalProfessionalPages - 1)
												)
											}
											disabled={professionalPage >= totalProfessionalPages - 1}
											className="px-3 py-1 text-sm rounded-md border border-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
										>
											Siguiente
										</button>
									</div>
								)}
							</div>
						</div>
					</>
				)}
			</div>

			<div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
				<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
					<div className="flex gap-3">
						<div className="p-2 rounded-lg bg-amber-50 text-amber-800 shrink-0">
							<ClipboardDocumentListIcon className="h-6 w-6" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-gray-900">
								Revisar y corregir saldos de profesionales
							</h2>
							<p className="text-sm text-gray-500 mt-1 max-w-2xl">
								Podés ver si los montos de cada profesional coinciden con las sesiones ya hechas y los
								abonos cargados. Si algo sale en rojo es que hay una diferencia; podés alinearlo con el
								botón Corregir.
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2 shrink-0">
						<button
							type="button"
							onClick={handleOpenReconcileSection}
							disabled={reconcileLoading}
							className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
								reconcileSectionOpen
									? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
									: 'text-amber-900 bg-amber-100 hover:bg-amber-200'
							} disabled:opacity-50 disabled:cursor-not-allowed`}
						>
							{reconcileLoading
								? 'Consultando…'
								: reconcileSectionOpen
									? 'Ocultar'
									: 'Consultar'}
						</button>
						{reconcileSectionOpen && reconcilePayload && (
							<button
								type="button"
								onClick={() => loadReconcilePreview()}
								disabled={reconcileLoading}
								className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
							>
								Actualizar consulta
							</button>
						)}
					</div>
				</div>

				{reconcileSectionOpen && reconcileLoading && (
					<p className="mt-6 text-sm text-gray-500">Consultando datos…</p>
				)}

				{reconcileSectionOpen && !reconcileLoading && !reconcilePayload && (
					<p className="mt-6 text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
						No hay resultado cargado. Reintentá con «Actualizar consulta» o volvé a abrir la
						sección.
					</p>
				)}

				{reconcileSectionOpen && !reconcileLoading && reconcilePayload && (
					<div className="mt-6 space-y-4">
						<p className="text-sm text-gray-600">
							Período revisado:{' '}
							<strong>
								{reconcilePayload.period.from} — {reconcilePayload.period.to}
							</strong>
							{' · '}
							Profesionales con diferencias:{' '}
							<strong
								className={
									reconcilePayload.cantidadDesfase > 0 ? 'text-red-600' : 'text-green-700'
								}
							>
								{reconcilePayload.cantidadDesfase}
							</strong>
						</p>

						<div className="overflow-x-auto rounded-lg border border-gray-200">
							<table className="min-w-full text-sm">
								<thead className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
									<tr>
										<th className="px-3 py-2">ID</th>
										<th className="px-3 py-2">Profesional</th>
										<th className="px-3 py-2 text-right">% com.</th>
										<th className="px-3 py-2 text-right">Bruto citas</th>
										<th className="px-3 py-2 text-right">Comisión</th>
										<th className="px-3 py-2 text-right">Abonos</th>
										<th className="px-3 py-2 text-right">Total (BD)</th>
										<th className="px-3 py-2 text-right">Total (esperado)</th>
										<th className="px-3 py-2 text-right">Pend. (BD)</th>
										<th className="px-3 py-2 text-right">Pend. (esperado)</th>
									</tr>
								</thead>
								<tbody>
									{sortedReconcileRows.map((row) => (
										<tr
											key={String(row.professionalId)}
											className={
												row.hayDesfase
													? 'bg-red-50 text-red-950 border-t border-red-100'
													: 'border-t border-gray-100'
											}
										>
											<td className="px-3 py-2 font-mono text-xs">{row.professionalId}</td>
											<td className="px-3 py-2">{row.name}</td>
											<td className="px-3 py-2 text-right">{row.commissionPercent}%</td>
											<td className="px-3 py-2 text-right tabular-nums">
												${row.grossFromSessions.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												${row.fullCommission.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												${row.abonosSum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												${row.currentSaldoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums font-medium">
												${row.expectedSaldoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums">
												${row.currentSaldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
											<td className="px-3 py-2 text-right tabular-nums font-medium">
												${row.expectedSaldoPendiente.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{reconcilePayload.cantidadDesfase > 0 && (
							<div className="flex flex-wrap items-center gap-3 pt-2">
								<button
									type="button"
									onClick={handleApplyReconcile}
									disabled={reconcileApplying || reconcileLoading}
									className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{reconcileApplying ? 'Corrigiendo…' : 'Corregir saldos'}
								</button>
								<p className="text-xs text-gray-500">
									Actualiza en el sistema los importes de cada profesional para que queden alineados con
									esta revisión. En producción, usalo con criterio.
								</p>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Modal de Detalle de Profesional */}
			{selectedProfessional && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white rounded-lg p-6 w-full max-w-md">
						<h2 className="text-xl font-semibold mb-4">
							Detalle de Profesional
						</h2>
						<div className="mb-2">
							<span className="font-bold">Nombre:</span>{' '}
							{selectedProfessional.name}
						</div>
						<div className="mb-2">
							<span className="font-bold">Email:</span>{' '}
							{selectedProfessional.email}
						</div>
						<div className="mb-2">
							<span className="font-bold">Acumulado historico:</span> $
							{(selectedProfessional.saldoTotal || 0).toFixed(2)}
						</div>
						<div className="mb-4">
							<span className="font-bold">Deuda / saldo a favor:</span> $
							{(selectedProfessional.saldoPendiente || 0).toFixed(2)}
						</div>
						<div className="flex justify-end">
							<button
								onClick={() => setSelectedProfessional(null)}
								className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
							>
								Cerrar
							</button>
						</div>
					</div>
				</div>
			)}
			<ChangePasswordModal
				isOpen={showModal}
				onClose={() => setShowModal(false)}
				onSubmit={changePassword}
			/>
		</div>
	);
};

export default FinancialDashboard;
