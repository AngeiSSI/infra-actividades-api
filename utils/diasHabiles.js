const mongoose = require('mongoose');

function calcularDiasHabiles(fechaInicio, fechaFin) {
  let diasHabiles = 0;
  let fechaActual = new Date(fechaInicio);
  
  while (fechaActual < fechaFin) {
    const dia = fechaActual.getDay();
    if (dia !== 0 && dia !== 6) {
      diasHabiles++;
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }
  
  return diasHabiles;
}

async function esDiaLaboral(fecha = new Date()) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    const festivo = await mongoose.connection.collection('festivos').findOne({
      fecha: {
        $gte: new Date(fechaStr + 'T00:00:00Z'),
        $lt: new Date(fechaStr + 'T23:59:59Z')
      }
    });

    const diaSemana = fecha.getDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const esFestivo = !!festivo;

    return !esFinDeSemana && !esFestivo;
  } catch (error) {
    console.error('Error al verificar día laboral:', error);
    return true;
  }
}

function sumarDiasHabiles(fecha, dias) {
  let resultado = new Date(fecha);
  let agregados = 0;

  while (agregados < dias) {
    resultado.setDate(resultado.getDate() + 1);
    const dia = resultado.getDay();
    if (dia !== 0 && dia !== 6) agregados++;
  }

  return resultado;
}

async function ajustarADiaHabil(fechaISO) {
  const regex = /(\d{4})-(\d{2})-(\d{2})/;
  const match = fechaISO.match(regex);
  
  if (!match) {
    throw new Error("Formato de fecha inválido: " + fechaISO);
  }

  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);

  let fecha = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  let intentos = 0;
  const maxIntentos = 100;

  while (intentos < maxIntentos) {
    const diaSemana = fecha.getUTCDay();
    
    if (diaSemana === 6) {
      fecha.setUTCDate(fecha.getUTCDate() + 2);
      intentos++;
      continue;
    }
    
    if (diaSemana === 0) {
      fecha.setUTCDate(fecha.getUTCDate() + 1);
      intentos++;
      continue;
    }

    try {
      const ano = fecha.getUTCFullYear();
      const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getUTCDate()).padStart(2, '0');
      const fechaStr = `${ano}-${mes}-${dia}`;
      
      const festivo = await mongoose.connection.collection('festivos').findOne({
        fecha: {
          $gte: new Date(fechaStr + 'T00:00:00Z'),
          $lt: new Date(fechaStr + 'T23:59:59Z')
        }
      });

      if (festivo) {
        fecha.setUTCDate(fecha.getUTCDate() + 1);
        intentos++;
        continue;
      }
    } catch (error) {
      console.error('Error verificando feriado:', error);
    }

    break;
  }

  return fecha;
}

module.exports = { calcularDiasHabiles, esDiaLaboral, sumarDiasHabiles, ajustarADiaHabil };