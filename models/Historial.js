const mongoose = require('mongoose');

const historialSchema = new mongoose.Schema({
  actividadId: mongoose.Schema.Types.ObjectId,
  lider: String,
  proyecto: String,
  actividadCatalogo: String,
  tipificacion: String,
  descripcion: String,
  fechaCierre: Date,
  justificacion: {
    texto: String,
    usuario: String,
    fecha: Date,
    asunto: String
  },
  decision: {
    estado: { type: String, enum: ['aprobado', 'rechazado'] },
    coordinador: String,
    comentario: String,
    fecha: Date
  },
  fechaCreacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Historial', historialSchema, 'historial_vencimientos');