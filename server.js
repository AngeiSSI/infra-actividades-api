require('dotenv').config();
console.log("🔥 SERVER INICIANDO...");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const axios = require('axios');
const { enviarAlCanalTeams, generarTablaTeams } = require('./notificaciones-teams');

const app = express();
// Debug: Listar todos los endpoints
app.get('/_debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push(`${Object.keys(middleware.route.methods)[0].toUpperCase()} ${middleware.route.path}`);
    }
  });
  res.json(routes.filter(r => r.includes('festivos')).sort());
});

const SECRET = "infra-secret-key";

console.log("🔐 SECRET:", SECRET);

/* ================= CORS ================= */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:4200',
      'https://organic-barnacle-r4966xjjvxrrcwqw4-4200.app.github.dev',
      'http://localhost:3000',
      'https://localhost:3000'
    ];
    
    if (!origin || allowedOrigins.includes(origin) || origin?.includes('github.dev')) {
      return callback(null, true);
    }
    
    console.log('❌ CORS BLOQUEADO - Origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 3600
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

/* ================= DB ================= */
console.log("📊 MONGO_URI:", process.env.MONGO_URI ? "✅ CONFIGURADO" : "❌ NO CONFIGURADO");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MONGO CONECTADO"))
  .catch(err => {
    console.log("❌ ERROR MONGO:", err.message);
    console.log("❌ MONGO_URI usado:", process.env.MONGO_URI);
  });

/* ================= MODELOS ================= */
const userSchema = new mongoose.Schema({
  nombre: String,
  email: String,
  password: String,
  rol: String,
  grupo: String,
  activo: { type: Boolean, default: true },
  primeraVez: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema, 'users');

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

const Catalogo = mongoose.model('Catalogo', catalogoSchema, 'catalogos');

const actividadSchema = new mongoose.Schema({
  lider: String,
  proyecto: String,
  tipificacion: String,
  actividadCatalogo: String,
  descripcion: String,
  fechaCreacion: { type: Date, default: Date.now },
  fechaModificacion: { type: Date, default: Date.now, required: true },
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

const Actividad = mongoose.model('Actividad', actividadSchema, 'actividades');

const accesoSchema = new mongoose.Schema({
  usuarioId: mongoose.Schema.Types.ObjectId,
  modulo: String,
  permiso: String,
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now }
});

const Acceso = mongoose.model('Acceso', accesoSchema, 'accesos');

const asignacionSchema = new mongoose.Schema({
  liderAsignado: String,
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

const Asignacion = mongoose.model('Asignacion', asignacionSchema, 'asignaciones');

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

const Historial = mongoose.model('Historial', historialSchema, 'historial_vencimientos');

const listaMaestraSchema = new mongoose.Schema({
  tipo: {
    type: String,
    enum: [
      'flujo_valor',
      'gerente',
      'celula',
      'lider_tecnico',
      'lider_tecnico_flujo_valor',
      'scrum',
      'po',
      'arquitecto'
    ],
    required: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: '',
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaModificacion: {
    type: Date,
    default: Date.now
  }
});

const ListaMaestra = mongoose.model('ListaMaestra', listaMaestraSchema, 'listas_maestras');

const macroTareaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    default: '',
    trim: true
  },
  liderInfraestructuraId: {
    type: String,
    required: true
  },
  liderInfraestructuraNombre: {
    type: String,
    required: true
  },
  microTareas: [{
    _id: { type: String, required: true },
    actividad: { type: String, required: true },
    catalogoId: { type: String, required: true },
    diasHabiles: { type: Number, required: true },
    horasMinimas: { type: Number, default: 0 },
    horasMaximas: { type: Number, default: 0 }
  }],
  estado: {
    type: String,
    enum: ['activa', 'inactiva'],
    default: 'activa'
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  },
  fechaModificacion: {
    type: Date,
    default: Date.now
  }
});

const MacroTarea = mongoose.model('MacroTarea', macroTareaSchema, 'macro_tareas');

/* ================= AUTH MIDDLEWARE ================= */

function auth(req, res, next) {
  const header = req.headers['authorization'] || req.headers['Authorization'];

  console.log("\n🔐 AUTH MIDDLEWARE");
  console.log("  Header existe:", !!header);

  if (!header) {
    console.log("  ❌ NO HAY HEADER");
    return res.status(401).json({ error: "No autorizado - sin token" });
  }

  const token = header.replace("Bearer ", "").replace("bearer ", "");

  console.log("  🔐 Token recibido:", token.substring(0, 30) + "...");

  try {
    const decoded = jwt.verify(token, SECRET);
    console.log("  ✅ Token VÁLIDO:", decoded.nombre);
    req.user = decoded;
    next();
  } catch (err) {
    console.log("  ❌ Error validando token:", err.message);
    return res.status(401).json({ error: "Token inválido: " + err.message });
  }
}

function esCoordinadorOAdmin(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'coordinador' && rol !== 'administrador' && rol !== 'super_admin') {
    return res.status(403).json({ error: "Acceso denegado - requiere permisos de Coordinador o Administrador" });
  }
  next();
}

function esAdministrador(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'administrador' && rol !== 'super_admin') {
    return res.status(403).json({ error: "Acceso denegado - requiere permisos de Administrador" });
  }
  next();
}

function esSuperAdmin(req, res, next) {
  const rol = req.user?.rol?.toLowerCase();
  if (rol !== 'super_admin') {
    return res.status(403).json({ error: "Acceso denegado - requiere permisos de Super Admin" });
  }
  next();
}

/* ================= FUNCIONES AUXILIARES ================= */

function calcularDiasHabiles(fechaInicio, fechaFin) {
  let diasHabiles = 0;
  let fechaActual = new Date(fechaInicio);
  
  while (fechaActual < fechaFin) {
    const dia = fechaActual.getDay();
    if (dia !== 0 && dia !== 6) {
      diasHabiles++;
    }
    fechaActual.setDate(fechaActual.getDate() + 1);
  }
  
  return diasHabiles;
}

async function esDiaLaboral(fecha = new Date()) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    
    const festivo = await mongoose.connection.collection('festivos').findOne({
      fecha: {
        $gte: new Date(fechaStr + 'T00:00:00Z'),
        $lt: new Date(fechaStr + 'T23:59:59Z')
      }
    });

    const diaSemana = fecha.getDay();
    const esFinDeSemana = diaSemana === 0 || diaSemana === 6;
    const esFestivo = !!festivo;

    return !esFinDeSemana && !esFestivo;
  } catch (error) {
    console.error('Error al verificar día laboral:', error);
    return true;
  }
}

function sumarDiasHabiles(fecha, dias) {
  let resultado = new Date(fecha);
  let agregados = 0;

  while (agregados < dias) {
    resultado.setDate(resultado.getDate() + 1);
    const dia = resultado.getDay();
    if (dia !== 0 && dia !== 6) agregados++;
  }

  return resultado;
}

async function ajustarADiaHabil(fechaISO) {
  console.log("\n  🔍 AJUSTE A DÍA HÁBIL (UTC):");
  console.log("  📥 Entrada (ISO):", fechaISO);

  const regex = /(\d{4})-(\d{2})-(\d{2})/;
  const match = fechaISO.match(regex);
  
  if (!match) {
    throw new Error("Formato de fecha inválido: " + fechaISO);
  }

  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1;
  const day = parseInt(match[3]);

  console.log("  📅 Componentes extraídos: año=" + year + ", mes=" + (month + 1) + ", día=" + day);

  let fecha = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  
  console.log("  📅 Fecha UTC creada:", fecha.toISOString());
  console.log("  📅 getUTCDay():", fecha.getUTCDay());

  const diasNombre = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  let intentos = 0;
  const maxIntentos = 100;

  while (intentos < maxIntentos) {
    const diaSemana = fecha.getUTCDay();
    
    const ano = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    const fechaFormato = `${ano}-${mes}-${dia}`;
    
    console.log(`  📅 Iteración ${intentos + 1}: ${fechaFormato} (${diasNombre[diaSemana]})`);
    
    if (diaSemana === 6) {
      console.log("  ➕ ES SÁBADO - Sumando 2 días");
      fecha.setUTCDate(fecha.getUTCDate() + 2);
      console.log("  ➡️ Nueva fecha:", fecha.toISOString());
      intentos++;
      continue;
    }
    
    if (diaSemana === 0) {
      console.log("  ➕ ES DOMINGO - Sumando 1 día");
      fecha.setUTCDate(fecha.getUTCDate() + 1);
      console.log("  ➡️ Nueva fecha:", fecha.toISOString());
      intentos++;
      continue;
    }

    try {
      const fechaStr = fechaFormato;
      console.log("  🔍 Verificando si es festivo:", fechaStr);
      
      const festivo = await mongoose.connection.collection('festivos').findOne({
        fecha: {
          $gte: new Date(fechaStr + 'T00:00:00Z'),
          $lt: new Date(fechaStr + 'T23:59:59Z')
        }
      });

      if (festivo) {
        console.log("  ➕ ES FERIADO - Sumando 1 día");
        fecha.setUTCDate(fecha.getUTCDate() + 1);
        console.log("  ➡️ Nueva fecha:", fecha.toISOString());
        intentos++;
        continue;
      } else {
        console.log("  ✅ NO es feriado - DÍA HÁBIL VÁLIDO");
      }
    } catch (error) {
      console.error('  ❌ Error verificando feriado:', error);
    }

    console.log("  ✅ SALIENDO DEL LOOP");
    break;
  }

  console.log("  📤 FINAL - Retornando:", fecha.toISOString());
  
  return fecha;
}

function resolverEstadoCierre(fechaCierre) {
  if (!fechaCierre) return "cerrado";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fc = new Date(fechaCierre);
  fc.setHours(0, 0, 0, 0);

  return hoy > fc ? "cerrada_vencida" : "cerrado";
}

function calcularProgreso(actividad) {
  if (!actividad.fechaCierre) return 0;

  const inicio = new Date(actividad.fechaCreacion).getTime();
  const fin = new Date(actividad.fechaCierre).getTime();
  const hoy = Date.now();

  if (hoy >= fin) return 1;

  return (hoy - inicio) / (fin - inicio);
}

/* ================= LOGIN ================= */
app.post('/login', async (req, res) => {
  console.log("\n🔓 POST /login");
  console.log("  Body recibido:", req.body);
  
  const { email, password } = req.body;

  try {
    console.log("  🔍 Buscando usuario:", email);
    
    const user = await User.findOne({ email, password });

    if (!user) {
      console.log("  ❌ Usuario NO encontrado");
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    console.log("  ✅ Usuario encontrado:", user.nombre);
    console.log("  🔐 primeraVez en BD:", user.primeraVez);

    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, rol: user.rol, grupo: user.grupo },
      SECRET,
      { expiresIn: '30d' }
    );

    console.log("  ✅ Token generado:", token.substring(0, 50) + "...");

    const respuesta = {
      token,
      usuario: {
        nombre: user.nombre,
        rol: user.rol,
        grupo: user.grupo,
        primeraVez: user.primeraVez
      }
    };

    console.log("  📤 Respuesta de login:", JSON.stringify(respuesta, null, 2));
    
    res.json(respuesta);
  } catch (err) {
    console.error("  ❌ Error en login:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CAMBIAR CONTRASEÑA (Primera Vez) ================= */
app.post('/cambiar-password-primera-vez', auth, async (req, res) => {
  try {
    console.log("\n🔐 POST /cambiar-password-primera-vez - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", { nueva_password: '***' });

    const { nueva_password } = req.body;

    if (!nueva_password || nueva_password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    }

    const usuario = await User.findByIdAndUpdate(
      req.user.id,
      { password: nueva_password, primeraVez: false },
      { new: true, runValidators: false }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("  ✅ Contraseña actualizada:", usuario._id);
    console.log("  🔐 primeraVez actualizado a:", usuario.primeraVez);
    res.json({ mensaje: "Contraseña cambiada correctamente", usuario });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= RECUPERAR CONTRASEÑA (ENVIAR EMAIL) ================= */
app.post('/recuperar-password', async (req, res) => {
  try {
    console.log("\n🔐 POST /recuperar-password");
    console.log("  📤 Datos recibidos:", { email: req.body.email });

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const usuario = await User.findOne({ email });

    if (!usuario) {
      return res.json({ 
        mensaje: "Si el email existe, recibirá instrucciones para resetear su contraseña" 
      });
    }

    console.log("  ✅ Usuario encontrado:", usuario.nombre);
    console.log("  📧 Email:", usuario.email);

    const tokenReset = jwt.sign(
      { id: usuario._id, email: usuario.email },
      SECRET,
      { expiresIn: '1h' }
    );

    console.log("  🔐 Token de reset generado:", tokenReset.substring(0, 50) + "...");

    res.json({ 
      mensaje: "Instrucciones enviadas al email",
      tokenReset
    });

  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= RESETEAR CONTRASEÑA (CON TOKEN) ================= */
app.post('/resetear-password', async (req, res) => {
  try {
    console.log("\n🔐 POST /resetear-password");

    const { token, nueva_password } = req.body;

    if (!token || !nueva_password) {
      return res.status(400).json({ error: "Token y contraseña requeridos" });
    }

    if (nueva_password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, SECRET);
      console.log("  ✅ Token válido para usuario:", decoded.email);
    } catch (err) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const usuario = await User.findByIdAndUpdate(
      decoded.id,
      { password: nueva_password, primeraVez: false },
      { new: true, runValidators: false }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("  ✅ Contraseña reseteada para:", usuario.nombre);
    res.json({ 
      mensaje: "Contraseña reseteada correctamente",
      usuario 
    });

  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= RESETEAR CONTRASEÑA (COORDINADOR/ADMIN) ================= */
app.put('/usuarios/:id/resetear-password', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n🔐 PUT /usuarios/:id/resetear-password - User:", req.user.nombre);

    const { nueva_password } = req.body;

    if (!nueva_password || nueva_password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener mínimo 6 caracteres" });
    }

    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      { password: nueva_password, primeraVez: true },
      { new: true, runValidators: false }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("  ✅ Contraseña reseteada por:", req.user.nombre);
    console.log("  👤 Usuario afectado:", usuario.nombre);
    console.log("  🔐 primeraVez marcado como true");

    res.json({ 
      mensaje: "Contraseña reseteada correctamente",
      usuario 
    });

  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ADMIN - ACTUALIZAR TODOS LOS USUARIOS ================= */
app.post('/admin/actualizar-usuarios-primera-vez', async (req, res) => {
  try {
    console.log("\n🔧 POST /admin/actualizar-usuarios-primera-vez");
    
    const resultado = await User.updateMany(
      { primeraVez: { $exists: false } },
      { $set: { primeraVez: true } }
    );

    console.log("  ✅ Usuarios actualizados:", resultado.modifiedCount);
    res.json({ 
      mensaje: "Usuarios actualizados", 
      actualizados: resultado.modifiedCount 
    });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - GET (SOLO OFICIAL) ================= */
app.get('/catalogo', auth, async (req, res) => {
  try {
    console.log("\n📖 GET /catalogo - User:", req.user.nombre);
    const lista = await Catalogo.find({ estado: 'oficial', activo: true }).sort({ actividad: 1 });
    console.log("  ✅ Catálogo oficial enviado:", lista.length, "items");
    res.json(lista);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - GET TODOS (INCLUYE PENDIENTES) ================= */
app.get('/catalogo/todos', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📖 GET /catalogo/todos - User:", req.user.nombre);
    const lista = await Catalogo.find({ activo: true }).sort({ estado: -1, actividad: 1 });
    console.log("  ✅ Catálogo completo enviado:", lista.length, "items");
    res.json(lista);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - POST (CREAR O SUGERIR) ================= */
app.post('/catalogo', auth, async (req, res) => {
  try {
    console.log("\n➕ POST /catalogo - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { tipificacion, actividad, diasHabiles, horasMinimas, horasMaximas } = req.body;

    if (!tipificacion || !actividad || !diasHabiles) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const rol = req.user.rol?.toLowerCase();
    const esAutorizado = rol === 'coordinador' || rol === 'administrador' || rol === 'super_admin';

    const nuevoItem = await Catalogo.create({
      tipificacion,
      actividad,
      diasHabiles,
      horasMinimas: horasMinimas || 0,
      horasMaximas: horasMaximas || 0,
      estado: esAutorizado ? 'oficial' : 'pendiente',
      sugeridoPor: req.user.nombre,
      rolSugeridor: req.user.rol
    });

    console.log("  ✅ Catálogo creado:", nuevoItem._id);
    console.log("  📋 Estado:", nuevoItem.estado);
    console.log("  👤 Sugerido por:", req.user.nombre);

    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - PUT (EDITAR - SOLO COORDINADOR/ADMIN) ================= */
app.put('/catalogo/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n✏️ PUT /catalogo/:id - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { tipificacion, actividad, diasHabiles, horasMinimas, horasMaximas } = req.body;

    const item = await Catalogo.findByIdAndUpdate(
      req.params.id,
      { tipificacion, actividad, diasHabiles, horasMinimas, horasMaximas },
      { new: true, runValidators: false }
    );

    if (!item) {
      return res.status(404).json({ error: "Catálogo no encontrado" });
    }

    console.log("  ✅ Catálogo actualizado:", item._id);
    res.json(item);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - PATCH (APROBAR SUGERENCIA) ================= */
app.patch('/catalogo/:id/aprobar', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n✅ PATCH /catalogo/:id/aprobar - User:", req.user.nombre);

    const item = await Catalogo.findByIdAndUpdate(
      req.params.id,
      { 
        estado: 'oficial',
        esHistorico: true,
        estadoHistorico: 'aprobado'
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Catálogo no encontrado" });
    }

    console.log("  ✅ Sugerencia aprobada:", item._id);
    console.log("  📋 Sugerencia de:", item.sugeridoPor);

    res.json({ mensaje: "Sugerencia aprobada", item });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - PATCH (RECHAZAR SUGERENCIA) ================= */
app.patch('/catalogo/:id/rechazar', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n❌ PATCH /catalogo/:id/rechazar - User:", req.user.nombre);

    const { observaciones } = req.body;

    const item = await Catalogo.findByIdAndUpdate(
      req.params.id,
      { 
        activo: false,
        observaciones,
        esHistorico: true,
        estadoHistorico: 'rechazado'
      },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Catálogo no encontrado" });
    }

    console.log("  ✅ Sugerencia rechazada:", item._id);
    console.log("  📝 Observaciones:", observaciones);

    res.json({ mensaje: "Sugerencia rechazada", item });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - DELETE (DESACTIVAR - SOLO COORDINADOR/ADMIN) ================= */
app.delete('/catalogo/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n🗑️ DELETE /catalogo/:id - User:", req.user.nombre);

    const item = await Catalogo.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ error: "Catálogo no encontrado" });
    }

    console.log("  ✅ Catálogo eliminado (desactivado):", item._id);
    res.json({ mensaje: "Catálogo eliminado correctamente" });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - IMPORTAR CSV ================= */
app.post('/catalogo/importar', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📥 POST /catalogo/importar - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Debes enviar una lista de items para importar" });
    }

    const normalizar = (texto) => (texto || '').trim().toLowerCase();

const unicosEnArchivoMap = new Map();

for (const item of items) {
  const tipificacion = item?.tipificacion?.trim();
  const actividad = item?.actividad?.trim();

  if (!tipificacion || !actividad) {
    continue;
  }

  const clave = normalizar(actividad);

  if (!unicosEnArchivoMap.has(clave)) {
    unicosEnArchivoMap.set(clave, {
      tipificacion,
      actividad,
      diasHabiles: Number(item.diasHabiles) || 1,
      horasMinimas: Number(item.horasMinimas) || 0,
      horasMaximas: Number(item.horasMaximas) || 0,
      observaciones: item?.observaciones?.trim() || '',
      estado: 'oficial',
      sugeridoPor: req.user.nombre,
      rolSugeridor: req.user.rol,
      fechaSugerencia: new Date(),
      fechaCreacion: new Date(),
      activo: true
    });
  }
}

const itemsUnicosArchivo = Array.from(unicosEnArchivoMap.values());

const existentes = await Catalogo.find({
  activo: true,
  actividad: { $in: itemsUnicosArchivo.map(item => item.actividad) }
}).select('actividad');

const existentesSet = new Set(
  existentes.map(item => normalizar(item.actividad))
);

const nuevos = itemsUnicosArchivo.filter(item => {
  const clave = normalizar(item.actividad);
  return !existentesSet.has(clave);
});
    if (nuevos.length === 0) {
      return res.status(400).json({
        error: "Todos los registros ya existen en la base de datos",
        resumen: {
          recibidos: items.length,
          unicosEnArchivo: itemsUnicosArchivo.length,
          duplicadosEnArchivo: items.length - itemsUnicosArchivo.length,
          duplicadosEnBD: itemsUnicosArchivo.length,
          insertados: 0
        }
      });
    }

    const insertados = await Catalogo.insertMany(nuevos);

    console.log("  ✅ Registros importados:", insertados.length);

    res.status(201).json({
      mensaje: "Importación completada correctamente",
      resumen: {
        recibidos: items.length,
        unicosEnArchivo: itemsUnicosArchivo.length,
        duplicadosEnArchivo: items.length - itemsUnicosArchivo.length,
        duplicadosEnBD: itemsUnicosArchivo.length - nuevos.length,
        insertados: insertados.length
      }
    });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - HISTÓRICO ================= */
app.get('/catalogo/historico', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📊 GET /catalogo/historico - User:", req.user.nombre);
    console.log("  📤 Query params:", req.query);

    const { estado, sugeridoPor } = req.query;
    let filtro = { esHistorico: true };

    if (estado && estado !== 'todos') {
      filtro.estadoHistorico = estado;
      console.log("  🔍 Filtrando BD por estadoHistorico:", estado);
    }

    if (sugeridoPor) {
      filtro.sugeridoPor = sugeridoPor;
      console.log("  🔍 Filtrando BD por sugeridor:", sugeridoPor);
    }

    console.log("  📋 Filtro MongoDB:", JSON.stringify(filtro));

    const historico = await Catalogo.find(filtro).sort({ fechaSugerencia: -1 });

    console.log("  ✅ Total registros encontrados en BD:", historico.length);
    
    if (historico.length > 0) {
      console.log("  📋 Primeros registros:");
      historico.slice(0, 3).forEach((item, idx) => {
        console.log(`     [${idx}] Actividad: ${item.actividad}, Estado: ${item.estadoHistorico}, Histórico: ${item.esHistorico}`);
      });
    }
    
    res.json(historico);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATÁLOGO - ESTADÍSTICAS DEL HISTÓRICO ================= */
app.get('/catalogo/historico-stats', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📊 GET /catalogo/historico-stats - User:", req.user.nombre);

    const total = await Catalogo.countDocuments({ esHistorico: true });
    const aprobados = await Catalogo.countDocuments({ 
      esHistorico: true,
      estadoHistorico: 'aprobado'
    });
    const rechazados = await Catalogo.countDocuments({ 
      esHistorico: true,
      estadoHistorico: 'rechazado'
    });

    console.log("  ✅ Estadísticas calculadas");

    res.json({
      total,
      aprobados,
      rechazados,
      porcentajeAprobacion: total > 0 ? ((aprobados / total) * 100).toFixed(2) : 0
    });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= USUARIOS - GET ================= */
app.get('/usuarios', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n👥 GET /usuarios - User:", req.user.nombre);
    
    const total = await User.countDocuments();
    console.log("  📊 Total de usuarios en BD:", total);
    
    const usuarios = await User.find().select('-password');
    
    console.log("  ✅ Usuarios encontrados:", usuarios.length);
    console.log("  📋 IDs de usuarios:", usuarios.map(u => ({ _id: u._id, nombre: u.nombre, activo: u.activo })));
    
    res.json(usuarios);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= USUARIOS - POST (Crear) ================= */
app.post('/usuarios', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n👤 POST /usuarios - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { nombre, email, password, rol, grupo } = req.body;

    const existente = await User.findOne({ email });
    if (existente) {
      return res.status(400).json({ error: "El email ya existe" });
    }

    const nuevoUsuario = await User.create({
      nombre,
      email,
      password,
      rol,
      grupo,
      activo: true,
      primeraVez: true
    });

    console.log("  ✅ Usuario creado:", nuevoUsuario._id);
    console.log("  🔐 primeraVez:", nuevoUsuario.primeraVez);
    console.log("  📋 Datos guardados:", { nombre, email, rol, grupo, primeraVez: true });
    
    res.status(201).json(nuevoUsuario);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= USUARIOS - PUT (Actualizar) ================= */
app.put('/usuarios/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n✏️ PUT /usuarios/:id - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { nombre, email, rol, grupo, activo } = req.body;

    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      { nombre, email, rol, grupo, activo },
      { new: true, runValidators: false }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("  ✅ Usuario actualizado:", usuario._id);
    console.log("  📋 Usuario actualizado:", { nombre, email, rol, grupo, activo });
    res.json(usuario);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= USUARIOS - DELETE ================= */
app.delete('/usuarios/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n🗑️ DELETE /usuarios/:id - User:", req.user.nombre);

    const usuario = await User.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    console.log("  ✅ Usuario eliminado (desactivado):", usuario._id);
    res.json({ mensaje: "Usuario eliminado correctamente" });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ACCESOS - GET ================= */
app.get('/accesos', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n🔐 GET /accesos - User:", req.user.nombre);

    const { usuarioId } = req.query;
    let filtro = { activo: true };

    if (usuarioId) {
      filtro.usuarioId = usuarioId;
    }

    const accesos = await Acceso.find(filtro);

    console.log("  ✅ Accesos enviados:", accesos.length);
    res.json(accesos);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ACCESOS - POST (Actualizar accesos de usuario) ================= */
app.post('/usuarios/:id/accesos', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n🔐 POST /usuarios/:id/accesos - User:", req.user.nombre);

    const { accesos } = req.body;
    const usuarioId = req.params.id;

    await Acceso.deleteMany({ usuarioId });

    const nuevosAccesos = accesos.map(a => ({
      usuarioId,
      modulo: a.modulo,
      permiso: a.permiso,
      activo: a.activo
    }));

    const resultado = await Acceso.insertMany(nuevosAccesos);

    console.log("  ✅ Accesos actualizados:", resultado.length);
    res.json(resultado);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ACTIVIDADES - GET ================= */
app.get('/actividades', auth, async (req, res) => {
  try {
    console.log("\n📋 GET /actividades - User:", req.user.nombre);

    let filtro = {};

    const rol = req.user.rol?.toLowerCase();
    if (rol === 'lider') {
      filtro.lider = req.user.nombre;
    }

    const actividades = await Actividad.find(filtro).sort({ fechaCreacion: -1 });

    console.log("  ✅ Actividades enviadas:", actividades.length);

    const hoy = new Date();

    for (const act of actividades) {
      if (act.estado === "cerrado" || !act.fechaCierre) continue;

      if (act.fechaCierre < hoy) {
        act.estadoCaso = "vencido";
      }
    }

    res.json(actividades);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CREAR ACTIVIDAD ================= */
app.post('/actividades', auth, async (req, res) => {
  try {
    console.log("\n✏️ POST /actividades - User:", req.user.nombre);

    const { tipificacion, actividadCatalogo } = req.body;

    const cat = await Catalogo.findOne({
      tipificacion,
      actividad: actividadCatalogo,
      estado: 'oficial'
    });

    if (!cat) {
      return res.status(400).json({ error: "Actividad no existe en catálogo oficial" });
    }

    const fechaCreacion = new Date();
    const fechaCierre = sumarDiasHabiles(fechaCreacion, cat.diasHabiles);

    const nueva = await Actividad.create({
      ...req.body,
      lider: req.user.nombre,
      fechaCreacion,
      fechaModificacion: fechaCreacion,
      fechaCierre
    });

    console.log("  ✅ Actividad creada:", nueva._id);
    console.log("  📅 fechaModificacion asignada:", nueva.fechaModificacion);

    res.status(201).json(nueva);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ACTUALIZAR ACTIVIDAD (SOLO SUPER ADMIN) - CON AJUSTE A DÍA HÁBIL ================= */
app.put('/actividades/:id', auth, esSuperAdmin, async (req, res) => {
  try {
    console.log("\n✏️ PUT /actividades/:id - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);
    console.log("  📤 ID de actividad:", req.params.id);

    const { fechaCierre } = req.body;

    if (!fechaCierre) {
      return res.status(400).json({ error: "fechaCierre es requerida" });
    }

    let fechaAjustada = await ajustarADiaHabil(fechaCierre);

    console.log("  📅 Fecha final ajustada:", fechaAjustada.toISOString());

    const actualizacion = {
      fechaCierre: fechaAjustada,
      fechaModificacion: new Date()
    };

    console.log("  📤 Objeto actualizacion antes de guardar:", JSON.stringify(actualizacion, null, 2));

    const actividad = await Actividad.findByIdAndUpdate(
      req.params.id,
      actualizacion,
      { new: true, runValidators: false }
    );

    if (!actividad) {
      console.log("  ❌ Actividad no encontrada con ID:", req.params.id);
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    console.log("\n  ✅ DESPUÉS de guardar en BD:");
    console.log("  📤 fechaCierre en BD:", actividad.fechaCierre);
    console.log("  📤 fechaCierre toISOString():", actividad.fechaCierre.toISOString());
    console.log("  📤 Actividad actualizada:", actividad._id);

    res.json({
      ...actividad.toObject(),
      mensaje: `Fecha ajustada al próximo día hábil: ${actividad.fechaCierre.toLocaleDateString('es-CO')}`
    });

  } catch (err) {
    console.error("  ❌ Error:", err.message);
    console.error("  ❌ Stack:", err.stack);
    res.status(500).json({ error: err.message });
  }
});

/* ================= OBSERVACIONES ================= */
app.post('/actividades/:id/observaciones', auth, async (req, res) => {
  try {
    console.log("\n📝 POST /actividades/:id/observaciones");
    console.log("  🔐 req.user:", req.user);
    console.log("  🔐 req.user.nombre:", req.user?.nombre);
    console.log("  📤 Body recibido:", req.body);

    const { comentario, horas } = req.body;

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    console.log("  ✅ Actividad encontrada");
    console.log("  📋 Usuario a guardar:", req.user.nombre);
    console.log("  ⏱️ Horas recibidas:", horas);

    const nuevaObservacion = {
      comentario,
      fecha: new Date(),
      usuario: req.user.nombre,
      rol: req.user.rol,
      horas: horas ? parseFloat(horas) : 0
    };

    console.log("  📝 Observación a guardar:", nuevaObservacion);

    actividad.observaciones.push(nuevaObservacion);

    console.log("  ✅ Observación creada con usuario:", req.user.nombre);
    console.log("  ⏱️ Observación con horas:", horas);

    if (horas && horas > 0) {
      actividad.horasAcumuladas = (actividad.horasAcumuladas || 0) + parseFloat(horas);
      console.log("  📊 horasAcumuladas actualizado a:", actividad.horasAcumuladas);
    }

    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad guardada");
    console.log("  📋 Observaciones guardadas:", actividad.observaciones.length);
    console.log("  📋 Última observación guardada:", actividad.observaciones[actividad.observaciones.length - 1]);

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CERRAR ACTIVIDAD (POST) ================= */
app.post('/actividades/:id/cerrar', auth, async (req, res) => {
  try {
    console.log("\n🔒 POST /actividades/:id/cerrar - User:", req.user.nombre);

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    const hoy = new Date();
    const hoyString = hoy.toISOString().split('T')[0];

    const tieneObservacionHoy = actividad.observaciones?.some(obs => {
      const fechaObs = new Date(obs.fecha).toISOString().split('T')[0];
      return fechaObs === hoyString;
    });

    if (!tieneObservacionHoy) {
      return res.status(400).json({ error: "No se puede cerrar sin observación del día de hoy" });
    }

    actividad.estado = resolverEstadoCierre(actividad.fechaCierre);

    await actividad.save();

    console.log("  ✅ Actividad cerrada");
    console.log("  📅 Estado actualizado a:", actividad.estado);

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= VALIDAR CIERRE DE TAREA VENCIDA (JUSTIFICACIÓN) ================= */
app.post('/actividades/:id/validar-cierre', auth, async (req, res) => {
  try {
    console.log("\n📋 POST /actividades/:id/validar-cierre - User:", req.user.nombre);
    console.log("  📤 Body recibido:", req.body);

    const { texto, asunto, estado } = req.body;

    if (!texto || !texto.trim()) {
      return res.status(400).json({ error: "La justificación no puede estar vacía" });
    }

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    console.log("  ✅ Actividad encontrada:", actividad._id);
    console.log("  👤 Usuario justificando:", req.user.nombre);

    actividad.justificacionCierre = {
      texto: texto.trim(),
      usuario: req.user.nombre,
      fecha: new Date(),
      asunto: asunto || '',
      estado: 'pendiente'
    };

    actividad.estado = 'pendiente validacion';
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad actualizada a 'pendiente validacion'");
    console.log("  📋 Justificación registrada");
    console.log("  👤 Justificado por:", req.user.nombre);

    const coordinadores = await User.find({ 
      rol: { $in: ['Coordinador', 'coordinador', 'Administrador', 'administrador', 'Super Admin', 'super_admin'] },
      activo: true 
    });

    console.log("  📧 Notificando a coordinadores:", coordinadores.length);

    if (coordinadores.length > 0) {
      const mensaje = `
⚠️ **NUEVA JUSTIFICACIÓN DE VENCIMIENTO**

📋 **Actividad:** ${actividad.actividadCatalogo}
👤 **Líder:** ${actividad.lider}
📦 **Proyecto:** ${actividad.proyecto}
📅 **Fecha de Cierre:** ${new Date(actividad.fechaCierre).toLocaleDateString()}

**Justificación del Líder:**
${texto}

**Asunto del correo:** ${asunto || 'No especificado'}

⏳ **Estado:** Pendiente de aprobación

👉 Accede a: Aprobación de Vencimientos para revisar
      `;

      try {
        await enviarAlCanalTeams(
          '⚠️ Nueva Justificación de Vencimiento',
          mensaje,
          '#FF9800'
        );
        console.log("  ✅ Notificación enviada a Teams");
      } catch (err) {
        console.log("  ⚠️ Error al enviar notificación Teams:", err.message);
      }
    }

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= APROBAR CIERRE DE TAREA VENCIDA (COORDINADOR) ================= */
app.post('/actividades/:id/aprobar-cierre', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n✅ POST /actividades/:id/aprobar-cierre - User:", req.user.nombre);
    console.log("  📤 Body recibido:", req.body);

    const { comentario } = req.body;

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    if (actividad.estado !== 'pendiente validacion') {
      return res.status(400).json({ error: "La actividad no está en estado de validación" });
    }

    console.log("  ✅ Actividad encontrada:", actividad._id);
    console.log("  👤 Aprobado por:", req.user.nombre);

    const registroHistorial = await Historial.create({
      actividadId: actividad._id,
      lider: actividad.lider,
      proyecto: actividad.proyecto,
      actividadCatalogo: actividad.actividadCatalogo,
      tipificacion: actividad.tipificacion,
      descripcion: actividad.descripcion,
      fechaCierre: actividad.fechaCierre,
      justificacion: {
        texto: actividad.justificacionCierre?.texto,
        usuario: actividad.justificacionCierre?.usuario,
        fecha: actividad.justificacionCierre?.fecha,
        asunto: actividad.justificacionCierre?.asunto
      },
      decision: {
        estado: 'aprobado',
        coordinador: req.user.nombre,
        comentario: comentario || 'Aprobado',
        fecha: new Date()
      }
    });

    console.log("  📋 Registro en historial creado:", registroHistorial._id);

    actividad.justificacionCierre = {
      ...actividad.justificacionCierre,
      estado: 'aprobado',
      comentarioCoordinador: comentario || 'Aprobado',
      fecha: new Date()
    };

    actividad.estado = 'cerrada_vencida';
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad aprobada y cerrada");
    console.log("  📝 Comentario del coordinador:", comentario);

    const lider = await User.findOne({ nombre: actividad.lider });
    if (lider) {
      console.log("  📧 Notificando al líder:", lider.nombre);
      try {
        await enviarAlCanalTeams(
          '✅ Tu justificación fue APROBADA',
          `
✅ **APROBACIÓN DE VENCIMIENTO**

📋 **Actividad:** ${actividad.actividadCatalogo}
📦 **Proyecto:** ${actividad.proyecto}

**Decisión del Coordinador:**
${comentario || 'Aprobado'}

**Estado:** Cerrado
**Guardado en Historial:** Sí
          `,
          '#4CAF50'
        );
      } catch (err) {
        console.log("  ⚠️ Error al notificar Teams:", err.message);
      }
    }

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= RECHAZAR CIERRE DE TAREA VENCIDA (COORDINADOR) ================= */
app.post('/actividades/:id/rechazar-cierre', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n❌ POST /actividades/:id/rechazar-cierre - User:", req.user.nombre);
    console.log("  📤 Body recibido:", req.body);

    const { comentario } = req.body;

    if (!comentario || !comentario.trim()) {
      return res.status(400).json({ error: "Debes especificar el motivo del rechazo" });
    }

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    if (actividad.estado !== 'pendiente validacion') {
      return res.status(400).json({ error: "La actividad no está en estado de validación" });
    }

    console.log("  ✅ Actividad encontrada:", actividad._id);
    console.log("  👤 Rechazado por:", req.user.nombre);
    console.log("  📝 Motivo:", comentario);

    const registroHistorial = await Historial.create({
      actividadId: actividad._id,
      lider: actividad.lider,
      proyecto: actividad.proyecto,
      actividadCatalogo: actividad.actividadCatalogo,
      tipificacion: actividad.tipificacion,
      descripcion: actividad.descripcion,
      fechaCierre: actividad.fechaCierre,
      justificacion: {
        texto: actividad.justificacionCierre?.texto,
        usuario: actividad.justificacionCierre?.usuario,
        fecha: actividad.justificacionCierre?.fecha,
        asunto: actividad.justificacionCierre?.asunto
      },
      decision: {
        estado: 'rechazado',
        coordinador: req.user.nombre,
        comentario: comentario,
        fecha: new Date()
      }
    });

    console.log("  📋 Registro en historial creado:", registroHistorial._id);

    actividad.justificacionCierre = {
      ...actividad.justificacionCierre,
      estado: 'rechazado',
      comentarioCoordinador: comentario,
      fecha: new Date()
    };

    actividad.estado = 'en progreso';
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad rechazada - volviendo a 'en progreso'");

    const lider = await User.findOne({ nombre: actividad.lider });
    if (lider) {
      console.log("  📧 Notificando al líder:", lider.nombre);
      try {
        await enviarAlCanalTeams(
          '❌ Tu justificación fue RECHAZADA',
          `
❌ **RECHAZO DE JUSTIFICACIÓN**

📋 **Actividad:** ${actividad.actividadCatalogo}
📦 **Proyecto:** ${actividad.proyecto}

**Motivo del Rechazo:**
${comentario}

⏳ **Acción requerida:** Debes reenviar una justificación mejorada

👉 Accede a: Mis Actividades para reenviar la justificación
**Guardado en Historial:** Sí
          `,
          '#CC0000'
        );
      } catch (err) {
        console.log("  ⚠️ Error al notificar Teams:", err.message);
      }
    }

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= HISTORIAL DE VENCIMIENTOS - GET ================= */
app.get('/historial-vencimientos', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📊 GET /historial-vencimientos - User:", req.user.nombre);

    const { lider, proyecto, estado } = req.query;
    let filtro = {};

    if (lider) {
      filtro.lider = lider;
    }

    if (proyecto) {
      filtro.proyecto = proyecto;
    }

    if (estado) {
      filtro['decision.estado'] = estado;
    }

    const historial = await Historial.find(filtro).sort({ 'decision.fecha': -1 });

    console.log("  ✅ Registros de historial encontrados:", historial.length);
    res.json(historial);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= HISTORIAL DE VENCIMIENTOS - POR ACTIVIDAD ================= */
app.get('/historial-vencimientos/:actividadId', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📊 GET /historial-vencimientos/:actividadId - User:", req.user.nombre);

    const registros = await Historial.find({ actividadId: req.params.actividadId }).sort({ 'decision.fecha': -1 });

    console.log("  ✅ Registros encontrados para actividad:", registros.length);
    res.json(registros);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= HISTORIAL ESTADÍSTICAS ================= */
app.get('/historial-vencimientos-stats', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log("\n📊 GET /historial-vencimientos-stats - User:", req.user.nombre);

    const total = await Historial.countDocuments();
    const aprobados = await Historial.countDocuments({ 'decision.estado': 'aprobado' });
    const rechazados = await Historial.countDocuments({ 'decision.estado': 'rechazado' });

    const porLider = await Historial.aggregate([
      {
        $group: {
          _id: '$lider',
          total: { $sum: 1 },
          aprobados: {
            $sum: { $cond: [{ $eq: ['$decision.estado', 'aprobado'] }, 1, 0] }
          },
          rechazados: {
            $sum: { $cond: [{ $eq: ['$decision.estado', 'rechazado'] }, 1, 0] }
          }
        }
      },
      { $sort: { total: -1 } }
    ]);

    console.log("  ✅ Estadísticas calculadas");

    res.json({
      resumen: {
        total,
        aprobados,
        rechazados,
        porcentajeAprobacion: total > 0 ? ((aprobados / total) * 100).toFixed(2) : 0
      },
      porLider
    });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= RESUMEN CONSOLIDADO DE TAREAS - TEAMS ================= */
app.post('/resumen-consolidado-tareas', async (req, res) => {
  try {
    console.log('\n📊 POST /resumen-consolidado-tareas');

    const esLaboral = await esDiaLaboral();
    if (!esLaboral) {
      const diaSemana = new Date().getDay();
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      console.log(`⏭️ ${dias[diaSemana]} - No es día laboral`);
      return res.status(400).json({ error: 'No es un día laboral' });
    }

    const actividades = await Actividad.find({ estado: 'en progreso' });

    const vencidas = [];
    const proximasVencer = [];

    for (const actividad of actividades) {
      if (!actividad.fechaCierre) continue;

      const diasRestantes = calcularDiasHabiles(new Date(), new Date(actividad.fechaCierre));

      if (diasRestantes < 0) {
        vencidas.push({
          actividadCatalogo: actividad.actividadCatalogo,
          lider: actividad.lider,
          proyecto: actividad.proyecto
        });
      }

      if (diasRestantes > 0 && diasRestantes <= 2) {
        proximasVencer.push({
          actividadCatalogo: actividad.actividadCatalogo,
          lider: actividad.lider,
          proyecto: actividad.proyecto,
          diasRestantes: diasRestantes
        });
      }
    }

    if (vencidas.length > 0 || proximasVencer.length > 0) {
      const tabla = generarTablaTeams(vencidas, proximasVencer);
      const titulo = `📊 Resumen Diario - ${vencidas.length} Vencidas, ${proximasVencer.length} Próximas`;
      
      const enviado = await enviarAlCanalTeams(titulo, tabla, vencidas.length > 0 ? '#FF5252' : '#FF9800');

      res.json({
        mensaje: 'Resumen enviado a Teams',
        vencidas: vencidas.length,
        proximasVencer: proximasVencer.length,
        enviado: enviado
      });
    } else {
      res.json({
        mensaje: 'No hay tareas para reportar',
        vencidas: 0,
        proximasVencer: 0
      });
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CRON JOB - RESUMEN DIARIO ================= */
cron.schedule('0 8 * * *', async () => {
  try {
    const esLaboral = await esDiaLaboral();
    if (!esLaboral) {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      console.log(`\n⏭️ [CRON] ${dias[new Date().getDay()]} - No es día laboral`);
      return;
    }
    console.log('\n📊 [CRON] 08:00 AM - Enviando resumen...');
    await axios.post('http://localhost:3000/resumen-consolidado-tareas', {});
  } catch (err) {
    console.error('Error CRON:', err.message);
  }
});

console.log(`
⏰ ═════════════════════════════════════════
   CONFIGURACIÓN DE RESUMEN DIARIO
⏰ ═════════════════════════════════════════
   • Horario: 08:00 AM
   • Frecuencia: Diaria
   • Días: Lunes a Viernes
   • Excluye: Fines de semana y festivos
   • Destino: Teams (canal configurado)
⏰ ═════════════════════════════════════════
`);

/* ================= ASIGNACIONES - GET ================= */
app.get('/asignaciones', auth, async (req, res) => {
  try {
    console.log("\n📋 GET /asignaciones - User:", req.user.nombre);
    const asignaciones = await Asignacion.find().sort({ fechaAsignacion: -1 });
    console.log("  ✅ Asignaciones enviadas:", asignaciones.length);
    res.json(asignaciones);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ASIGNACIONES - POST (Crear) ================= */
app.post('/asignaciones', auth, async (req, res) => {
  try {
    console.log("\n➕ POST /asignaciones - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const rol = req.user.rol?.toLowerCase();
    const esAutorizado = rol === 'administrador' || rol === 'coordinador' || rol === 'senior' || rol === 'super_admin';

    if (!esAutorizado) {
      return res.status(403).json({ error: "No tienes permisos para crear asignaciones" });
    }

    const nueva = await Asignacion.create({
      ...req.body,
      fechaCreacion: new Date(),
      fechaModificacion: new Date()
    });

    console.log("  ✅ Asignación creada:", nueva._id);
    res.status(201).json(nueva);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ASIGNACIONES - PUT (Actualizar) ================= */
app.put('/asignaciones/:id', auth, async (req, res) => {
  try {
    console.log("\n✏️ PUT /asignaciones/:id - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const rol = req.user.rol?.toLowerCase();
    const esAutorizado = rol === 'administrador' || rol === 'coordinador' || rol === 'senior' || rol === 'super_admin';

    if (!esAutorizado) {
      return res.status(403).json({ error: "No tienes permisos para editar asignaciones" });
    }

    const asignacion = await Asignacion.findByIdAndUpdate(
      req.params.id,
      { ...req.body, fechaModificacion: new Date() },
      { new: true, runValidators: false }
    );

    if (!asignacion) {
      return res.status(404).json({ error: "Asignación no encontrada" });
    }

    console.log("  ✅ Asignación actualizada:", asignacion._id);
    res.json(asignacion);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= ASIGNACIONES - DELETE ================= */
app.delete('/asignaciones/:id', auth, async (req, res) => {
  try {
    console.log("\n🗑️ DELETE /asignaciones/:id - User:", req.user.nombre);

    const rol = req.user.rol?.toLowerCase();
    const esAutorizado = rol === 'administrador' || rol === 'coordinador' || rol === 'senior' || rol === 'super_admin';

    if (!esAutorizado) {
      return res.status(403).json({ error: "No tienes permisos para eliminar asignaciones" });
    }

    const asignacion = await Asignacion.findByIdAndDelete(req.params.id);

    if (!asignacion) {
      return res.status(404).json({ error: "Asignación no encontrada" });
    }

    console.log("  ✅ Asignación eliminada:", req.params.id);
    res.json({ mensaje: "Asignación eliminada correctamente" });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= MACRO TAREAS - POST (CREAR) ================= */
app.post('/macro-tareas', auth, async (req, res) => {
  try {
    console.log("\n➕ POST /macro-tareas - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const { nombre, descripcion, liderInfraestructuraId, liderInfraestructuraNombre, microTareas } = req.body;

    if (!nombre || !liderInfraestructuraId || !liderInfraestructuraNombre || !microTareas || microTareas.length === 0) {
      return res.status(400).json({ error: "Faltan campos requeridos (nombre, liderInfraestructuraId, liderInfraestructuraNombre, microTareas)" });
    }

    const nueva = await MacroTarea.create({
      nombre,
      descripcion: descripcion || '',
      liderInfraestructuraId,
      liderInfraestructuraNombre,
      microTareas,
      estado: 'activa',
      fechaCreacion: new Date(),
      fechaModificacion: new Date()
    });

    console.log("  ✅ Macro tarea creada:", nueva._id);
    console.log("  👤 Líder:", nueva.liderInfraestructuraNombre);
    console.log("  📋 Micro tareas:", nueva.microTareas.length);

    res.status(201).json(nueva);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= MACRO TAREAS - PUT (ACTUALIZAR) ================= */
app.put('/macro-tareas/:id', auth, async (req, res) => {
  try {
    console.log("\n✏️ PUT /macro-tareas/:id - User:", req.user.nombre);
    console.log("  📤 Datos recibidos:", req.body);

    const macroTarea = await MacroTarea.findByIdAndUpdate(
      req.params.id,
      { ...req.body, fechaModificacion: new Date() },
      { new: true, runValidators: false }
    );

    if (!macroTarea) {
      return res.status(404).json({ error: "Macro tarea no encontrada" });
    }

    console.log("  ✅ Macro tarea actualizada:", macroTarea._id);
    res.json(macroTarea);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= MACRO TAREAS - DELETE (ELIMINAR) ================= */
app.delete('/macro-tareas/:id', auth, async (req, res) => {
  try {
    console.log("\n🗑️ DELETE /macro-tareas/:id - User:", req.user.nombre);

    const macroTarea = await MacroTarea.findByIdAndDelete(req.params.id);

    if (!macroTarea) {
      return res.status(404).json({ error: "Macro tarea no encontrada" });
    }

    console.log("  ✅ Macro tarea eliminada:", req.params.id);
    res.json({ mensaje: "Macro tarea eliminada correctamente" });
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= MACRO TAREAS - GET ================= */
app.get('/macro-tareas', auth, async (req, res) => {
  try {
    console.log("\n📋 GET /macro-tareas - User:", req.user.nombre);

    const macroTareas = await MacroTarea.find().sort({ fechaCreacion: -1 });

    console.log("  ✅ Macro tareas enviadas:", macroTareas.length);
    res.json(macroTareas);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= FESTIVOS - GET ================= */
app.get('/festivos', async (req, res) => {
  try {
    console.log('\n📅 GET /festivos');
    
    const festivos = await mongoose.connection.collection('festivos').find({}).toArray();

    console.log('  ✅ Total de festivos en BD:', festivos.length);
    
    if (festivos.length > 0) {
      console.log('  📋 Primeros 3 festivos:');
      festivos.slice(0, 3).forEach((f, idx) => {
        console.log(`     [${idx}] ID: ${f._id}, Fecha: ${f.fecha}, Descripción: ${f.descripcion}`);
      });
    }

    res.json(festivos);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= FESTIVOS - POST (AGREGAR UNO) ================= */
app.post('/festivos', auth, esAdministrador, async (req, res) => {
  try {
    console.log('\n➕ POST /festivos - User:', req.user.nombre);
    console.log('  📤 Body recibido:', req.body);

    const { fecha, descripcion } = req.body;

    if (!fecha || !descripcion) {
      return res.status(400).json({ error: 'Fecha y descripción son requeridas' });
    }

    const fechaISO = new Date(fecha);
    console.log('  📅 Fecha ISO recibida:', fechaISO.toISOString());
    console.log('  📅 Fecha UTC:', fechaISO.getUTCDate(), '/', (fechaISO.getUTCMonth() + 1), '/', fechaISO.getUTCFullYear());

    // Verificar si esta fecha está en uso en alguna actividad
    const actividades = await mongoose.connection.collection('actividades').find({
      estado: { $in: ['en progreso', 'pendiente validacion'] },
      fechaCreacion: { $lte: fechaISO },
      fechaCierre: { $gte: fechaISO }
    }).toArray();

    if (actividades.length > 0) {
      console.log('  ⚠️ Esta fecha está en uso en', actividades.length, 'actividad(es)');
      return res.status(400).json({ 
        error: `No se puede agregar un festivo en esta fecha. Hay ${actividades.length} actividad(es) en progreso que incluyen esta fecha.`,
        actividadesAfectadas: actividades.length
      });
    }

    const nuevoFestivo = {
      fecha: fechaISO,
      descripcion: descripcion.trim(),
      createdAt: new Date()
    };

    console.log('  📤 Insertando festivo:', nuevoFestivo);

    const resultado = await mongoose.connection.collection('festivos').insertOne(nuevoFestivo);

    console.log('  ✅ Festivo agregado:', resultado.insertedId);
    res.status(201).json({ 
      mensaje: 'Festivo agregado correctamente',
      id: resultado.insertedId,
      festivo: nuevoFestivo
    });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= FESTIVOS - DELETE ================= */
app.delete('/festivos/:id', auth, esAdministrador, async (req, res) => {
  try {
    console.log('\n🗑️ DELETE /festivos/:id - User:', req.user.nombre);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID de festivo inválido' });
    }

    // Obtener el festivo
    const festivo = await mongoose.connection.collection('festivos').findOne({
      _id: new mongoose.Types.ObjectId(req.params.id)
    });

    if (!festivo) {
      return res.status(404).json({ error: 'Festivo no encontrado' });
    }

    console.log('  📅 Festivo a eliminar:', festivo.fecha);

    // Verificar si esta fecha está en uso en alguna actividad
    const actividades = await mongoose.connection.collection('actividades').find({
      estado: { $in: ['en progreso', 'pendiente validacion'] },
      fechaCreacion: { $lte: festivo.fecha },
      fechaCierre: { $gte: festivo.fecha }
    }).toArray();

    if (actividades.length > 0) {
      console.log('  ⚠️ Este festivo está en uso en', actividades.length, 'actividad(es)');
      return res.status(400).json({ 
        error: `No se puede eliminar este festivo. Hay ${actividades.length} actividad(es) en progreso que incluyen esta fecha. Primero cierra o modifica las actividades.`,
        actividadesAfectadas: actividades.map(a => ({
          id: a._id,
          nombre: a.actividadCatalogo,
          lider: a.lider,
          proyecto: a.proyecto
        }))
      });
    }

    const resultado = await mongoose.connection.collection('festivos').deleteOne({
      _id: new mongoose.Types.ObjectId(req.params.id)
    });

    if (resultado.deletedCount === 0) {
      return res.status(404).json({ error: 'Festivo no encontrado' });
    }

    console.log('  ✅ Festivo eliminado');
    res.json({ mensaje: 'Festivo eliminado correctamente' });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= FESTIVOS - POST (GUARDAR TODOS - REEMPLAZAR AÑO) ================= */
app.post('/festivos/guardar', auth, esAdministrador, async (req, res) => {
  try {
    console.log('\n💾 POST /festivos/guardar - User:', req.user.nombre);
    console.log('  📤 Festivos a guardar:', req.body.festivos.length);

    const { festivos } = req.body;

    if (!Array.isArray(festivos) || festivos.length === 0) {
      return res.status(400).json({ error: 'Debes enviar al menos un festivo' });
    }

    const primerFestivo = new Date(festivos[0].fecha);
    const anio = primerFestivo.getFullYear();

    // Eliminar festivos del año
    await mongoose.connection.collection('festivos').deleteMany({
      fecha: {
        $gte: new Date(`${anio}-01-01`),
        $lt: new Date(`${anio + 1}-01-01`)
      }
    });

    console.log('  🗑️ Festivos anteriores eliminados');

    const festivosInsert = festivos.map(f => ({
      fecha: new Date(f.fecha),
      descripcion: f.descripcion || '',
      createdAt: new Date()
    }));

    const resultado = await mongoose.connection.collection('festivos').insertMany(festivosInsert);

    console.log('  ✅ Festivos guardados:', resultado.insertedCount);
    res.json({ 
      mensaje: 'Festivos guardados correctamente',
      cantidad: resultado.insertedCount 
    });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - GET ================= */
app.get('/listas-maestras', auth, async (req, res) => {
  try {
    console.log('\n📚 GET /listas-maestras - User:', req.user.nombre);
    console.log('  Query params:', req.query);

    const { tipo, activo } = req.query;
    const filtro = {};

    if (tipo) {
      filtro.tipo = tipo;
    }

    if (activo === 'true') {
      filtro.activo = true;
    } else if (activo === 'false') {
      filtro.activo = false;
    }

    const items = await ListaMaestra.find(filtro).sort({ nombre: 1 });

    console.log('  ✅ Listas maestras encontradas:', items.length);
    res.json(items);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - POST ================= */
app.post('/listas-maestras', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log('\n➕ POST /listas-maestras - User:', req.user.nombre);
    console.log('  📤 Body recibido:', req.body);

    const { tipo, nombre, descripcion, activo } = req.body;

    if (!tipo || !nombre) {
      return res.status(400).json({ error: 'Los campos tipo y nombre son requeridos' });
    }

    const tiposPermitidos = [
      'flujo_valor',
      'gerente',
      'celula',
      'lider_tecnico',
      'lider_tecnico_flujo_valor',
      'scrum',
      'po',
      'arquitecto'
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de lista maestra no válido' });
    }

    const existente = await ListaMaestra.findOne({
      tipo,
      nombre: nombre.trim()
    });

    if (existente) {
      return res.status(400).json({ error: `Ya existe un registro con nombre "${nombre}" para el tipo "${tipo}"` });
    }

    const nuevoItem = await ListaMaestra.create({
      tipo,
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || '',
      activo: activo !== undefined ? activo : true,
      fechaCreacion: new Date(),
      fechaModificacion: new Date()
    });

    console.log('  ✅ Lista maestra creada:', nuevoItem._id);
    res.status(201).json(nuevoItem);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - PUT ================= */
app.put('/listas-maestras/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log('\n✏️ PUT /listas-maestras/:id - User:', req.user.nombre);
    console.log('  ID recibido:', req.params.id);
    console.log('  📤 Body recibido:', req.body);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { nombre, descripcion, activo } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El campo nombre es requerido' });
    }

    const actual = await ListaMaestra.findById(req.params.id);

    if (!actual) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    const duplicado = await ListaMaestra.findOne({
      _id: { $ne: req.params.id },
      tipo: actual.tipo,
      nombre: nombre.trim()
    });

    if (duplicado) {
      return res.status(400).json({ error: `Ya existe un registro con nombre "${nombre}" para el tipo "${actual.tipo}"` });
    }

    const actualizado = await ListaMaestra.findByIdAndUpdate(
      req.params.id,
      {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || '',
        activo: activo !== undefined ? activo : actual.activo,
        fechaModificacion: new Date()
      },
      { new: true, runValidators: false }
    );

    console.log('  ✅ Lista maestra actualizada:', actualizado._id);
    res.json(actualizado);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - PATCH ESTADO ================= */
app.patch('/listas-maestras/:id/estado', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log('\n🔄 PATCH /listas-maestras/:id/estado - User:', req.user.nombre);
    console.log('  ID recibido:', req.params.id);
    console.log('  📤 Body recibido:', req.body);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { activo } = req.body;

    if (typeof activo !== 'boolean') {
      return res.status(400).json({ error: 'El campo activo debe ser booleano' });
    }

    const actualizado = await ListaMaestra.findByIdAndUpdate(
      req.params.id,
      {
        activo,
        fechaModificacion: new Date()
      },
      { new: true }
    );

    if (!actualizado) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    console.log('  ✅ Estado actualizado:', actualizado._id, '->', actualizado.activo);
    res.json(actualizado);
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - DELETE ================= */
app.delete('/listas-maestras/:id', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log('\n🗑️ DELETE /listas-maestras/:id - User:', req.user.nombre);
    console.log('  ID recibido:', req.params.id);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const eliminado = await ListaMaestra.findByIdAndDelete(req.params.id);

    if (!eliminado) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }

    console.log('  ✅ Registro eliminado:', eliminado._id);
    res.json({ mensaje: 'Registro eliminado correctamente' });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= LISTAS MAESTRAS - IMPORTAR ================= */
app.post('/listas-maestras/importar', auth, esCoordinadorOAdmin, async (req, res) => {
  try {
    console.log('\n📥 POST /listas-maestras/importar - User:', req.user.nombre);
    console.log('  📤 Body recibido:', req.body);

    const { tipo, items } = req.body;

    if (!tipo || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Debes enviar tipo e items válidos para importar' });
    }

    const tiposPermitidos = [
      'flujo_valor',
      'gerente',
      'celula',
      'lider_tecnico',
      'lider_tecnico_flujo_valor',
      'scrum',
      'po',
      'arquitecto'
    ];

    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de lista maestra no válido' });
    }

    const ahora = new Date();

    const documentos = items
      .filter(item => item?.nombre && item.nombre.trim())
      .map(item => ({
        tipo,
        nombre: item.nombre.trim(),
        descripcion: item.descripcion?.trim() || '',
        activo: item.activo !== undefined ? item.activo : true,
        fechaCreacion: ahora,
        fechaModificacion: ahora
      }));

    if (documentos.length === 0) {
      return res.status(400).json({ error: 'No hay registros válidos para importar' });
    }

    const nombresExistentes = await ListaMaestra.find({
      tipo,
      nombre: { $in: documentos.map(d => d.nombre) }
    }).select('nombre');

    const setExistentes = new Set(nombresExistentes.map(x => x.nombre));

    const nuevosDocumentos = documentos.filter(d => !setExistentes.has(d.nombre));

    if (nuevosDocumentos.length === 0) {
      return res.status(400).json({ error: 'Todos los registros ya existen en la base de datos' });
    }

    const resultado = await ListaMaestra.insertMany(nuevosDocumentos);

    console.log('  ✅ Registros importados:', resultado.length);

    res.status(201).json({
      mensaje: 'Importación realizada correctamente',
      insertados: resultado.length,
      omitidos: documentos.length - nuevosDocumentos.length
    });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= TEST ================= */
app.get('/', (req, res) => {
  res.send('API Infra funcionando 🚀');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', secret: SECRET });
});

/* ================= SERVER ================= */
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("\n🚀 Server running on port", port);
  console.log("🔐 JWT_SECRET:", SECRET);
  console.log("📊 MONGO_URI:", process.env.MONGO_URI ? "✅ Configurado" : "❌ NO Configurado");
});