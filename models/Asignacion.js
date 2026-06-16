const mongoose = require('mongoose');

const asignacionSchema = new mongoose.Schema({
  liderAsignado: String,
  liderSustituto: { type: String, default: null },
  tipoSustituto: { type: String, enum: ['Temporal', 'Definitivo'], default: null },
  razonSustituto: { type: String, enum: ['Vacaciones', 'Incapacidad', 'Licencia', 'Capacitación', 'Otro'], default: null },
  proyecto: String,
  idFeature: String,
  tipologia: String,
  porcentajeAsignacion: { type: Number, default: 0 },
  liSenior: String,
  liderTecnico: String,
  scrum: String,
  po: String,
  liderTecnicoFV: String,
  gerente: String,
  flujoValor: String,
  celula: String,
  pep: String,
  fechaAsignacion: { type: Date, default: Date.now },
  fechaFinAsignacion: Date,
  estado: { type: String, default: "activo" },
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Asignacion', asignacionSchema, 'asignaciones');