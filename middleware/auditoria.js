const Auditoria = require('../models/Auditoria');

async function registrarAuditoria(usuario, modulo, accion, registroId, valorAnterior, valorNuevo, razon = null, tipoAusentismo = null) {
  try {
    await Auditoria.create({
      usuario,
      modulo,
      accion,
      registroId,
      valorAnterior,
      valorNuevo,
      razon,
      tipoAusentismo,
      fecha: new Date()
    });
  } catch (err) {
    console.error("  ⚠️ Error registrando auditoría:", err.message);
  }
}

module.exports = { registrarAuditoria };