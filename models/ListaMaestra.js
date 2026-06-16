const mongoose = require('mongoose');

const listaMaestraSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: ['flujo_valor', 'gerente', 'celula', 'lider_tecnico', 'lider_tecnico_flujo_valor', 'scrum', 'po', 'arquitecto'],
    required: true
  },
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '', trim: true },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ListaMaestra', listaMaestraSchema, 'listas_maestras');