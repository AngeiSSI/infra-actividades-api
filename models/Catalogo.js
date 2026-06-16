const mongoose = require('mongoose');

const catalogoSchema = new mongoose.Schema({
  tipificacion: String,
  actividad: String,
  diasHabiles: Number,
  horasMinimas: { type: Number, default: 0 },
  horasMaximas: { type: Number, default: 0 },
  estado: { type: String, enum: ['oficial', 'pendiente'], default: 'oficial' },
  sugeridoPor: String,
  rolSugeridor: String,
  fechaSugerencia: { type: Date, default: Date.now },
  fechaCreacion: { type: Date, default: Date.now },
  observaciones: String,
  activo: { type: Boolean, default: true },
  esHistorico: { type: Boolean, default: false },
  estadoHistorico: { type: String, enum: ['aprobado', 'rechazado'], default: null }
});

module.exports = mongoose.model('Catalogo', catalogoSchema, 'catalogos');