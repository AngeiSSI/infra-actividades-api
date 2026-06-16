const mongoose = require('mongoose');

const actividadSchema = new mongoose.Schema({
  nombre: String,
  lider: String,
  liderSustituto: { type: String, default: null },
  tipoSustituto: { type: String, enum: ['Temporal', 'Definitivo'], default: null },
  proyecto: String,
  tipificacion: String,
  actividadCatalogo: String,
  descripcion: String,
  macroTareaId: { type: String, default: '' },
  macroTareaNombre: { type: String, default: '' },
  fechaInicio: { type: String, default: '' },
  diasHabiles: { type: Number, default: 0 },
  horasMinimas: { type: Number, default: 0 },
  horasMaximas: { type: Number, default: 0 },
  esUltima: { type: Boolean, default: false },
  indiceSecuencia: { type: Number, default: 0 },
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date, default: Date.now },
  fechaCierre: Date,
  estado: { type: String, default: "en progreso" },
  estadoCaso: { type: String, default: "no aplica" },
  horas: { type: Number, default: 0 },
  horasAcumuladas: { type: Number, default: 0 },
  horasMes: { type: Number, default: 0 },
  observaciones: [{
    fecha: { type: Date, default: Date.now },
    comentario: String,
    usuario: String,
    rol: String,
    horas: { type: Number, default: 0 }
  }],
  justificacionCierre: {
    texto: String,
    usuario: String,
    fecha: Date,
    asunto: String,
    estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado'] },
    comentarioCoordinador: String
  }
});

module.exports = mongoose.model('Actividad', actividadSchema, 'actividades');