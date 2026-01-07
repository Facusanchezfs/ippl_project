import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import patientsService from '../../services/patients.service';
import userService from '../../services/user.service';
import appointmentsService from '../../services/appointments.service';
import derivationService from '../../services/derivation.service';
import reportsService from '../../services/reports.service';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const ReportsPage: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'activation' | 'inactive' | 'derivations'>('inactive');
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [selectedProfessionalForActivations, setSelectedProfessionalForActivations] = useState('');
  const [selectedProfessionalForDerivations, setSelectedProfessionalForDerivations] = useState('');
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [startDateRevenue, setStartDateRevenue] = useState('');
  const [endDateRevenue, setEndDateRevenue] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    userService.getUsers().then(users => {
      setProfessionals(users.filter((u: any) => u.role === 'professional'));
    });
  }, []);

  const generateDerivationsPDF = async () => {
    setLoading(true);
    try {
      const users = await userService.getUsers();
      const allDerivations = await derivationService.getDerivations(
        selectedProfessionalForDerivations || undefined
      );
      
      // Filtrar por rango de fechas usando createdAt
      const filtered = allDerivations.filter(d => {
        if (!d.createdAt) return false;

        const fechaDerivacion = new Date(d.createdAt);

        let start: Date | null = null;
        let end: Date | null = null;

        if (startDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
        }

        if (endDate) {
          // Parsear la fecha sin hora para evitar problemas de timezone
          const [year, month, day] = endDate.split('-').map(Number);
          end = new Date(year, month - 1, day); // month es 0-indexed
          end.setHours(23, 59, 59, 999);
        }

        if (!start && !end) return true;
        if (start && fechaDerivacion < start) return false;
        if (end && fechaDerivacion > end) return false;

        return true;
      });

      const rows = filtered.map(d => {
        const fechaDerivacion = d.createdAt
          ? new Date(d.createdAt).toLocaleString('es-ES')
          : '';

        return [
          fechaDerivacion,
          d.professionalName || 'No asignado',
          d.patientName || 'Sin nombre',
        ];
      });

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Instituto Psicológico y Psicoanálisis del Litoral', 105, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text('Reporte de Derivaciones', 105, 25, { align: 'center' });
      doc.setFontSize(10);
      const fechaGeneracion = new Date().toLocaleString('es-ES');
      const fechaArchivo = new Date().toISOString().split('T')[0];
      doc.text(`Fecha de generación: ${fechaGeneracion}`, 10, 35);
      doc.text(`Rango de reporte: ${startDate || '...'} a ${endDate || '...'}`, 10, 41);
      if (selectedProfessionalForDerivations) {
        const prof = users.find(p => p.id === selectedProfessionalForDerivations);
        doc.text(`Profesional: ${prof?.name || 'Todos'}`, 10, 47);
      }
      doc.setLineWidth(0.5);
      doc.line(10, 50, 200, 50);
      autoTable(doc, {
        head: [['Fecha de Derivación', 'Profesional', 'Paciente']],
        body: rows,
        startY: 55,
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
      doc.save(`reporte_derivaciones_${fechaArchivo}.pdf`);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (reportType === 'derivations') {
      await generateDerivationsPDF();
      return;
    }

    setLoading(true);
    try {
      const users = await userService.getUsers();
      const allPatients = await patientsService.getAllPatients();
      
      let filtered: any[] = [];
      if (reportType === 'activation') {
        // Incluir pacientes con activationRequest aprobada (tienen activatedAt o activationRequest con requestDate)
        filtered = allPatients.filter(p => 
          p.status === 'active' && (p.activatedAt || p.activationRequest?.requestDate)
        );
      } else {
        // Para bajas: incluir pacientes que tengan dischargeRequest aprobada, independientemente de su status actual
        // (puede que hayan sido reactivados después de la baja)
        filtered = allPatients.filter(p => p.dischargeRequest?.requestDate);
      }
      filtered = filtered.filter(p => {
        // Filtro por profesional
        if (selectedProfessionalForActivations && p.professionalId !== selectedProfessionalForActivations) {
          return false;
        }
        
        // Para activaciones: usar activatedAt si existe, sino usar activationRequest.requestDate
        let fechaAprobacion: Date | null = null;
        if (reportType === 'activation') {
          if (p.activatedAt) {
            fechaAprobacion = new Date(p.activatedAt);
          } else if (p.activationRequest?.requestDate) {
            fechaAprobacion = new Date(p.activationRequest.requestDate);
          }
        } else {
          if (p.dischargeRequest?.requestDate) {
            fechaAprobacion = new Date(p.dischargeRequest.requestDate);
          }
        }
        if (!fechaAprobacion) {
          return false;
        }
        
        // Normalizar fechas: start al inicio del día, end al final del día
        let start: Date | null = null;
        let end: Date | null = null;
        
        if (startDate) {
          start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
        }
        
        if (endDate) {
          // Parsear la fecha sin hora para evitar problemas de timezone
          const [year, month, day] = endDate.split('-').map(Number);
          end = new Date(year, month - 1, day); // month es 0-indexed
          end.setHours(23, 59, 59, 999);
        }
        
        // Si no hay filtros de fecha, incluir todos
        if (!start && !end) {
          return true;
        }
        
        // Aplicar filtros
        if (start && fechaAprobacion < start) {
          return false;
        }
        
        if (end && fechaAprobacion > end) {
          return false;
        }
        
        return true;
      });
      const rows = filtered.map(p => {
        const professional = users.find(prof => String(prof.id) === String(p.professionalId));
        // Para activaciones: usar activatedAt si existe, sino usar activationRequest.requestDate
        let fechaAprobacion: Date | null = null;
        if (reportType === 'activation') {
          if (p.activatedAt) {
            fechaAprobacion = new Date(p.activatedAt);
          } else if (p.activationRequest?.requestDate) {
            fechaAprobacion = new Date(p.activationRequest.requestDate);
          }
        } else {
          if (p.dischargeRequest?.requestDate) {
            fechaAprobacion = new Date(p.dischargeRequest.requestDate);
          }
        }
        const tipo = reportType === 'activation' ? 'Activación' : 'Inactivo';
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
      doc.text('Reporte de Activaciones y Bajas de Pacientes', 105, 25, { align: 'center' });
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

  const generateMonthlyRevenuePDF = async () => {
    setLoading(true);
    try {
      if (!startDateRevenue || !endDateRevenue) {
        alert('Por favor selecciona ambas fechas (desde y hasta)');
        setLoading(false);
        return;
      }

      const revenueData = await reportsService.getMonthlyRevenue(startDateRevenue, endDateRevenue);

      // DEBUG: Console logs con toda la información
      if (revenueData.debug) {
        console.log('\n\n');
        console.log('================= MONTHLY REVENUE DEBUG (INPUT) =================');
        console.log('from (raw):', revenueData.debug.input.fromRaw);
        console.log('to   (raw):', revenueData.debug.input.toRaw);
        console.log('fromDate:', revenueData.debug.input.fromDate);
        console.log('toDate  :', revenueData.debug.input.toDate);
        console.log('today   :', revenueData.debug.input.today);
        console.log('fromStr :', revenueData.debug.input.fromStr);
        console.log('toStr   :', revenueData.debug.input.toStr);
        console.log('================================================================\n');

        console.log('================= MONTHLY REVENUE DEBUG (APPOINTMENTS SAMPLE) ===============');
        console.log('count(*) en rango (con filtros):', revenueData.debug.appointmentsSample.count);
        console.log('Top 10 filas:');
        console.log(JSON.stringify(revenueData.debug.appointmentsSample.sampleRows, null, 2));
        console.log('============================================================================\n');

        console.log('================= MONTHLY REVENUE DEBUG (PROFESSIONALS COMMISSION) ==========');
        console.log('professionalIds en rango:', revenueData.debug.professionalsCommission.professionalIds);
        console.log('Commissions:');
        console.log(JSON.stringify(revenueData.debug.professionalsCommission.professionals, null, 2));
        console.log('============================================================================\n');

        console.log('================= MONTHLY REVENUE DEBUG (SQL EXEC) ==========================');
        console.log('SQL byProfessional:');
        console.log(revenueData.debug.sqlQueries.byProfessional);
        console.log('\nSQL total:');
        console.log(revenueData.debug.sqlQueries.total);
        console.log('\nParams:', revenueData.debug.sqlQueries.params);
        console.log('============================================================================\n');

        console.log('================= MONTHLY REVENUE DEBUG (RESULTS) ===========================');
        console.log('revenueByProfessionalRaw (count=' + revenueData.debug.results.revenueByProfessionalRaw.length + '):');
        console.log(JSON.stringify(revenueData.debug.results.revenueByProfessionalRaw, null, 2));
        console.log('\ntotalResultRaw:');
        console.log(JSON.stringify(revenueData.debug.results.totalResultRaw, null, 2));
        console.log('\nParsed total:', revenueData.debug.results.parsedTotal);
        console.log('\nbyProfessionalFinal:');
        console.log(JSON.stringify(revenueData.debug.results.byProfessionalFinal, null, 2));
        console.log('============================================================================\n');

        console.log('================= MONTHLY REVENUE DEBUG (ALL APPOINTMENTS) =================');
        console.log('Total citas en rango:', revenueData.debug.appointmentsSample.allAppointments?.length || 0);
        console.log('Todas las citas:');
        console.log(JSON.stringify(revenueData.debug.appointmentsSample.allAppointments || [], null, 2));
        console.log('============================================================================\n');

        if (revenueData.debug.calculationVerification) {
          console.log('================= MONTHLY REVENUE DEBUG (MANUAL CALCULATION) ================');
          console.log('Cálculo manual por profesional:');
          console.log(JSON.stringify(revenueData.debug.calculationVerification.manualCalculationByProfessional, null, 2));
          console.log('============================================================================\n\n');
        }
      }

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Instituto Psicológico y Psicoanálisis del Litoral', 105, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text('Ingreso Total Mensual', 105, 25, { align: 'center' });
      doc.setFontSize(10);
      const fechaGeneracion = new Date().toLocaleString('es-ES');
      doc.text(`Fecha de generación: ${fechaGeneracion}`, 10, 35);
      doc.text(`Rango de reporte: ${revenueData.from} a ${revenueData.to}`, 10, 41);
      doc.setLineWidth(0.5);
      doc.line(10, 45, 200, 45);
      
      let yPos = 60;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      revenueData.byProfessional.forEach((prof) => {
        const nombre = prof.professionalName;
        const total = prof.total.toLocaleString('es-CO', { minimumFractionDigits: 2 });
        const totalStr = `$${total}`;
        const maxChars = 60;
        const nombreLen = nombre.length;
        const totalLen = totalStr.length;
        const espacioNecesario = maxChars - nombreLen - totalLen;
        const puntos = espacioNecesario > 0 ? '.'.repeat(espacioNecesario) : ' ';
        doc.text(`${nombre}${puntos}${totalStr}`, 10, yPos);
        yPos += 7;
      });

      doc.setLineWidth(0.3);
      doc.line(10, yPos, 200, yPos);
      yPos += 7;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const totalLabel = 'Ingreso Total';
      const totalStr = `$${revenueData.total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`;
      const maxChars = 60;
      const nombreLen = totalLabel.length;
      const totalLen = totalStr.length;
      const espacioNecesario = maxChars - nombreLen - totalLen;
      const puntos = espacioNecesario > 0 ? '.'.repeat(espacioNecesario) : ' ';
      doc.text(`${totalLabel}${puntos}${totalStr}`, 10, yPos);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Instituto Psicológico y Psicoanálisis del Litoral - Reporte confidencial', 105, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      const fechaArchivo = new Date().toISOString().split('T')[0];
      doc.save(`reporte_ingreso_total_${fechaArchivo}.pdf`);
    } catch (error: any) {
      console.error('Error al generar reporte de ingresos:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Error al generar el reporte';
      alert(errorMessage);
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

  // OJO: aquí decides qué mostrar como "Saldo"
  const rows = finalizadas.map(a => [
    a.patientName,
    a.attended ? 'Asistió' : 'No asistió',
    freqLabel(patientMap[a.patientId]?.sessionFrequency),
    `$${(a.paymentAmount ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 2 })}`,
  ]);

  // Calcular TOTAL: suma de paymentAmount solo de filas con attended === true
  const asistidas = finalizadas.filter(a => a.attended === true);
  const total = asistidas.reduce((sum, a) => sum + (a.paymentAmount ?? 0), 0);
  const totalRow = ['TOTAL', '', '', `$${total.toLocaleString('es-CO', { minimumFractionDigits: 2 })}`];

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
    body: [...rows, totalRow],
    startY: 52,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [41, 128, 185] },
    didParseCell: (data: any) => {
      if (data.row.index === rows.length && data.column.index >= 0) {
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 0) {
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    },
  });
  doc.save(`Reporte_Citas_${prof.name.replace(/ /g, '_')}.pdf`);
};

  return (
    <div className="pt-24 px-8 space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Volver al Dashboard
        </button>
        <h1 className="text-2xl font-bold">Reportes de Activaciones y Bajas de Pacientes</h1>
      </div>
      <div className="flex gap-4 mb-6 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Tipo de reporte</label>
          <select value={reportType} onChange={e => setReportType(e.target.value as 'activation' | 'inactive' | 'derivations')} className="border rounded px-2 py-1">
            <option value="activation">Activaciones</option>
            <option value="inactive">Bajas (Inactivos)</option>
            <option value="derivations">Derivaciones</option>
          </select>
        </div>
        {reportType === 'derivations' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700">Profesional (opcional)</label>
            <select
              value={selectedProfessionalForDerivations}
              onChange={e => setSelectedProfessionalForDerivations(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Todos los profesionales</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700">Profesional (opcional)</label>
            <select
              value={selectedProfessionalForActivations}
              onChange={e => setSelectedProfessionalForActivations(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Todos los profesionales</option>
              {professionals.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}
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
      <p className="text-gray-500">
        {reportType === 'derivations' 
          ? 'El reporte incluirá la fecha de derivación, el profesional y el nombre del paciente, según el rango de fechas seleccionado.'
          : `El reporte incluirá la fecha de ${reportType === 'activation' ? 'activación' : 'baja'}, el profesional asignado y el nombre del paciente, según el rango de fechas seleccionado.`}
      </p>
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
      <div className="mt-12">
        <h2 className="text-xl font-bold mb-4">Ingreso total mensual</h2>
        <div className="flex gap-4 mb-6 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
            <input type="date" value={startDateRevenue} onChange={e => setStartDateRevenue(e.target.value)} className="border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
            <input 
              type="date" 
              value={endDateRevenue} 
              onChange={e => setEndDateRevenue(e.target.value)} 
              max={new Date().toISOString().split('T')[0]}
              className="border rounded px-2 py-1" 
            />
          </div>
          <button
            onClick={generateMonthlyRevenuePDF}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generando...' : 'Generar PDF'}
          </button>
        </div>
        <p className="text-gray-500">El reporte mostrará el ingreso total del sistema desglosado por profesional en el período seleccionado, calculado sobre citas completadas y asistidas.</p>
      </div>
    </div>
  );
};

export default ReportsPage; 