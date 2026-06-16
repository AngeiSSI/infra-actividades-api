const ExcelJS = require('exceljs');

async function generarExcelActividades(datos) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Actividades');

  worksheet.columns = [
    { header: 'Nombre', key: 'nombre', width: 25 },
    { header: 'Líder', key: 'lider', width: 15 },
    { header: 'Proyecto', key: 'proyecto', width: 20 },
    { header: 'Estado', key: 'estado', width: 15 },
    { header: 'Fecha Inicio', key: 'fechaCreacion', width: 15 },
    { header: 'Fecha Cierre', key: 'fechaCierre', width: 15 },
    { header: 'Horas Acum.', key: 'horasAcumuladas', width: 12 }
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE30613' }
  };

  datos.forEach((actividad) => {
    worksheet.addRow({
      nombre: actividad.nombre,
      lider: actividad.lider,
      proyecto: actividad.proyecto,
      estado: actividad.estado,
      fechaCreacion: actividad.fechaCreacion?.toLocaleDateString('es-CO') || '',
      fechaCierre: actividad.fechaCierre?.toLocaleDateString('es-CO') || '',
      horasAcumuladas: actividad.horasAcumuladas
    });
  });

  return workbook;
}

async function generarExcelAsignaciones(datos) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Asignaciones');

  worksheet.columns = [
    { header: 'Líder', key: 'liderAsignado', width: 15 },
    { header: 'Líder Sustituto', key: 'liderSustituto', width: 15 },
    { header: 'Proyecto', key: 'proyecto', width: 20 },
    { header: 'Porcentaje', key: 'porcentajeAsignacion', width: 12 },
    { header: 'Estado', key: 'estado', width: 12 }
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE30613' }
  };

  datos.forEach((asignacion) => {
    worksheet.addRow({
      liderAsignado: asignacion.liderAsignado,
      liderSustituto: asignacion.liderSustituto || 'N/A',
      proyecto: asignacion.proyecto,
      porcentajeAsignacion: asignacion.porcentajeAsignacion,
      estado: asignacion.estado
    });
  });

  return workbook;
}

module.exports = { generarExcelActividades, generarExcelAsignaciones };