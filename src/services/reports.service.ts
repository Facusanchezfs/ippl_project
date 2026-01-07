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

