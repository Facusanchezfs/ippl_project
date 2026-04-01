import api from '../config/api';

export interface ReconcileSaldosRow {
	professionalId: string | number;
	name: string;
	email: string;
	commissionPercent: number;
	grossFromSessions: number;
	fullCommission: number;
	abonosSum: number;
	currentSaldoTotal: number;
	currentSaldoPendiente: number;
	expectedSaldoTotal: number;
	expectedSaldoPendiente: number;
	hayDesfase: boolean;
	updated?: boolean;
}

export interface ReconcileSaldosPreviewPayload {
	period: { from: string; to: string };
	rows: ReconcileSaldosRow[];
	cantidadDesfase: number;
}

export interface ReconcileSaldosApplyPayload extends ReconcileSaldosPreviewPayload {
	cantidadActualizados: number;
}

function unwrapData<T>(res: { data?: { data?: T; success?: boolean } }): T {
	const d = res.data?.data;
	if (d === undefined || d === null) {
		throw new Error('Respuesta inválida del servidor');
	}
	return d;
}

const financialReconcileService = {
	getPreview: async (): Promise<ReconcileSaldosPreviewPayload> => {
		const res = await api.get('/financial/reconcile-saldos/preview');
		return unwrapData<ReconcileSaldosPreviewPayload>(res);
	},

	apply: async (): Promise<ReconcileSaldosApplyPayload> => {
		const res = await api.post('/financial/reconcile-saldos/apply');
		return unwrapData<ReconcileSaldosApplyPayload>(res);
	},
};

export default financialReconcileService;
