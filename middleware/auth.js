const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || "infra-secret-key";

function auth(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];

  if (!header) {
    return res.status(401).json({ error: "No autorizado - sin token" });
  }

  const token = header.replace("Bearer ", "").replace("bearer ", "");

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido: " + err.message });
  }
}

function esCoordinadorOAdmin(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'coordinador' && rol !== 'administrador' && rol !== 'super_admin' && rol !== 'pmo') {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

function esAdministrador(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'administrador' && rol !== 'super_admin') {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

function esSuperAdmin(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'super_admin') {
    return res.status(403).json({ error: "Acceso denegado" });
  }
  next();
}

module.exports = { auth, esCoordinadorOAdmin, esAdministrador, esSuperAdmin };