const mongoose = require('mongoose');

const accesoSchema = new mongoose.Schema({
  usuarioId: mongoose.Schema.Types.ObjectId,
  modulo: String,
  permiso: String,
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Acceso', accesoSchema, 'accesos');