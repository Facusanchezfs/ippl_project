import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import patientsService from '../../services/patients.service';
import userService from '../../services/user.service';
import appointmentsService from '../../services/appointments.service';

const ReportsPage: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'alta' | 'inactive'>('inactive');
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [professionals, setProfessionals] = useState<any[]>([]);

  useEffect(() => {
    userService.getUsers().then(users => {
      setProfessionals(users.filter((u: any) => u.role === 'professional'));
    });
  }, []);

  const generatePDF = async () => {
    setLoading(true);
    try {
      const users = await userService.getUsers();
      const allPatients = await patientsService.getAllPatients();
      let filtered: any[] = [];
      if (reportType === 'alta') {
        filtered = allPatients.filter(p => p.status === 'alta' && p.activatedAt);
      } else {
        filtered = allPatients.filter(p => p.status === 'inactive' && p.dischargeRequest?.requestDate);
      }
      filtered = filtered.filter(p => {
        const fechaAprobacion = reportType === 'alta'
          ? (p.activatedAt ? new Date(p.activatedAt) : null)
          : (p.dischargeRequest?.requestDate ? new Date(p.dischargeRequest.requestDate) : null);
        if (!fechaAprobacion) return false;
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start && end && fechaAprobacion >= start && fechaAprobacion <= end) return true;
        return false;
      });
      const rows = filtered.map(p => {
        const professional = users.find(prof => prof.id === p.professionalId);
        const fechaAprobacion = reportType === 'alta'
          ? (p.activatedAt ? new Date(p.activatedAt) : null)
          : (p.dischargeRequest?.requestDate ? new Date(p.dischargeRequest.requestDate) : null);
        const tipo = reportType === 'alta' ? 'Alta' : 'Inactivo';
        return [
          fechaAprobacion ? fechaAprobacion.toLocaleString('es-ES') : '',
          tipo,
          professional?.name || 'No asignado',
          p.name
        ];
      });
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Instituto Psicológico y Psicoanálisis del Litoral', 105, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text('Reporte de Altas y Bajas de Pacientes', 105, 25, { align: 'center' });
      doc.setFontSize(10);
      const fechaGeneracion = new Date().toLocaleString('es-ES');
      doc.text(`Fecha de generación: ${fechaGeneracion}`, 10, 35);
      doc.text(`Rango de reporte: ${startDate || '...'} a ${endDate || '...'}`, 10, 41);
      doc.setLineWidth(0.5);
      doc.line(10, 45, 200, 45);
      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Profesional', 'Paciente']],
        body: rows,
        startY: 50,
        styles: { fontSize: 11, cellPadding: 3, valign: 'middle' },
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { halign: 'center' },
        alternateRowStyles: { fillColor: [240, 245, 255] },
        tableLineColor: [41, 128, 185],
        tableLineWidth: 0.1,
        margin: { left: 10, right: 10 },
      });
      doc.setFontSize(10);
      doc.text('Instituto Psicológico y Psicoanálisis del Litoral - Reporte confidencial', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.save('Reporte_Altas_Bajas.pdf');
    } finally {
      setLoading(false);
    }
  };

  const generateProfessionalPDF = async () => {
  if (!selectedProfessional) return;

  const prof = professionals.find(p => p.id == selectedProfessional);
  if (!prof) return;

  // util: fecha local
  const toLocalDate = (ymd: string) => {
    const [y,m,d] = ymd.split('-').map(Number);
    return new Date(y, m-1, d);
  };

  // normalizar rango (todo el día)
  const start = startDate ? toLocalDate(startDate) : null;
  const end   = endDate   ? toLocalDate(endDate)   : null;
  if (start) start.setHours(0,0,0,0);
  if (end)   end.setHours(23,59,59,999);

  // pedir en paralelo
  const [appointments, patients] = await Promise.all([
    appointmentsService.getProfessionalAppointments(prof.id),
    patientsService.getProfessionalPatients(prof.id),
  ]);

  // diccionario de pacientes
  const patientMap = Object.fromEntries(patients.map((p: any) => [p.id, p]));

  // filtrar por rango (acepta 3 casos)
  const inRange = (a: any) => {
    const d = toLocalDate(a.date);
    if (start && end)   return d >= start && d <= end;
    if (start && !end)  return d >= start;
    if (!start && end)  return d <= end;
    return true; // sin filtros
  };

  const filtered = appointments.filter(inRange);
  const finalizadas = filtered.filter(a => a.status === 'completed');
  const ausentes = finalizadas.filter(a => !a.attended).length;

  // helper frecuencia
  const freqLabel = (f?: 'weekly'|'biweekly'|'monthly') =>
    f === 'weekly' ? 'Semanal' :
    f === 'biweekly' ? 'Quincenal' :
    f === 'monthly' ? 'Mensual' : '-';

  // OJO: aquí decides qué mostrar como “Saldo”
  const rows = finalizadas.map(a => [
    a.patientName,
    a.attended ? 'Asistió' : 'No asistió',
    freqLabel(patientMap[a.patientId]?.sessionFrequency),
    `$${(a.paymentAmount ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
  ]);

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('Instituto Psicológico y Psicoanálisis del Litoral', 105, 15, { align: 'center' });
  doc.setFontSize(14);
  doc.text(`Reporte de Citas Finalizadas - ${prof.name}`, 105, 25, { align: 'center' });
  doc.setFontSize(11);
  doc.text(`Rango: ${startDate || '...'} a ${endDate || '...'}`, 10, 32);
  doc.text(`Cantidad de citas finalizadas: ${finalizadas.length}`, 10, 40);
  doc.text(`Pacientes ausentes: ${ausentes}`, 10, 46);

  autoTable(doc, {
    head: [['Paciente', 'Asistencia', 'Frecuencia', 'Saldo']],
    body: rows,
    startY: 52,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
  });
  doc.save(`Reporte_Citas_${prof.name.replace(/ /g, '_')}.pdf`);
};

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Reportes de Altas y Bajas de Pacientes</h1>
      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de reporte</label>
          <select value={reportType} onChange={e => setReportType(e.target.value as 'alta' | 'inactive')} className="border rounded px-2 py-1">
            <option value="alta">Altas</option>
            <option value="inactive">Bajas (Inactivos)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button
          onClick={generatePDF}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generando...' : 'Generar PDF'}
        </button>
      </div>
      <p className="text-gray-500">El reporte incluirá la fecha de {reportType === 'alta' ? 'alta' : 'baja'}, el profesional asignado y el nombre del paciente, según el rango de fechas seleccionado.</p>
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Reporte por Profesional</h2>
        <div className="flex gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Profesional</label>
            <select value={selectedProfessional} onChange={e => setSelectedProfessional(e.target.value)} className="border rounded px-2 py-1">
              <option value="">Selecciona un profesional</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <button
            onClick={generateProfessionalPDF}
            disabled={!selectedProfessional || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Generar PDF
          </button>
        </div>
        <p className="text-gray-500">El reporte incluirá la cantidad de citas finalizadas, nombre del paciente, asistencia, frecuencia y saldo correspondiente al rango de fechas seleccionado.</p>
      </div>
    </div>
  );
};

export default ReportsPage; 