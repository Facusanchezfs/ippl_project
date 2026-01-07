import api from '../config/api';

export interface MonthlyRevenueResponse {
  from: string;
  to: string;
  total: number;
  byProfessional: Array<{
    professionalId: string;
    professionalName: string;
    total: number;
  }>;
  debug?: {
    input: {
      fromRaw: string;
      toRaw: string;
      fromDate: string;
      toDate: string;
      today: string;
      fromStr: string;
      toStr: string;
    };
    appointmentsSample: {
      count: number;
      sampleRows: Array<{
        id: number;
        date: string;
        status: string;
        attended: boolean;
        sessionCost: number | string;
        professionalId: number | null;
        professionalName: string | null;
        commission?: number | string;
      }>;
      allAppointments?: Array<{
        id: number;
        date: string;
        status: string;
        attended: boolean;
        sessionCost: number | string;
        professionalId: number | null;
        professionalName: string | null;
        commission?: number | string;
      }>;
    };
    professionalsCommission: {
      professionalIds: number[];
      professionals: Array<{
        id: number;
        name: string;
        commission: number | string;
      }>;
    };
    sqlQueries: {
      byProfessional: string;
      total: string;
      params: {
        fromDate: string;
        toDate: string;
      };
    };
    results: {
      revenueByProfessionalRaw: any[];
      totalResultRaw: any[];
      parsedTotal: number;
      byProfessionalFinal: Array<{
        professionalId: string;
        professionalName: string;
        total: number;
      }>;
    };
    calculationVerification?: {
      manualCalculationByProfessional: Array<{
        professionalId: number;
        professionalName: string;
        appointmentCount: number;
        totalSessionCost: number;
        totalInstituteRevenue: number;
      }>;
    };
  };
}

const reportsService = {
  getMonthlyRevenue: async (from: string, to: string): Promise<MonthlyRevenueResponse> => {
    try {
      const response = await api.get<{ data: MonthlyRevenueResponse }>('/admin/reports/monthly-revenue', {
        params: { from, to }
      });
      return response.data?.data || response.data || {
        from,
        to,
        total: 0,
        byProfessional: []
      };
    } catch (error) {
      console.error('Error fetching monthly revenue:', error);
      throw error;
    }
  }
};

export default reportsService;

