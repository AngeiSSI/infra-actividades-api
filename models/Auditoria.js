const mongoose = require('mongoose');

const auditoriaSchema = new mongoose.Schema({
  usuario: String,
  fecha: { type: Date, default: Date.now },
  modulo: String,
  accion: String,
  registroId: String,
  valorAnterior: mongoose.Schema.Types.Mixed,
  valorNuevo: mongoose.Schema.Types.Mixed,
  razon: String,
  tipoAusentismo: { type: String, enum: ['Vacaciones', 'Incapacidad', 'Licencia', 'Capacitación', 'Otro'], default: null }
});

module.exports = mongoose.model('Auditoria', auditoriaSchema, 'auditoria');