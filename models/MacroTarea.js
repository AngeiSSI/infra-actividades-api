const mongoose = require('mongoose');

const macroTareaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '', trim: true },
  liderInfraestructuraId: { type: String, required: true },
  liderInfraestructuraNombre: { type: String, required: true },
  microTareas: [{
    _id: { type: String, required: true },
    actividad: { type: String, required: true },
    catalogoId: { type: String, required: true },
    diasHabiles: { type: Number, required: true },
    horasMinimas: { type: Number, default: 0 },
    horasMaximas: { type: Number, default: 0 }
  }],
  estado: { type: String, enum: ['activa', 'inactiva'], default: 'activa' },
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MacroTarea', macroTareaSchema, 'macro_tareas');