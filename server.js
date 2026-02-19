console.log("🔥 SERVER INICIANDO...");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET = "infra-secret-key";

console.log("🔐 SECRET:", SECRET);

/* ================= CORS ================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

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

/* ================= MODELO CATÁLOGO CON SUGERENCIAS ================= */
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
  activo: { type: Boolean, default: true }
});

const Catalogo = mongoose.model('Catalogo', catalogoSchema, 'catalogos');

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
  observaciones: [{
    fecha: { type: Date, default: Date.now },
    comentario: String,
    usuario: String,
    rol: String
  }]
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
  if (rol !== 'coordinador' && rol !== 'administrador') {
    return res.status(403).json({ error: "Acceso denegado - requiere permisos de Coordinador o Administrador" });
  }
  next();
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
      { id: user._id, nombre: user.nombre, rol: user.rol },
      SECRET,
      { expiresIn: '30d' }
    );

    console.log("  ✅ Token generado:", token.substring(0, 50) + "...");

    const respuesta = {
      token,
      usuario: {
        nombre: user.nombre,
        rol: user.rol,
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
    const lista = await Catalogo.find({ estado: 'oficial', activo: true });
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
    const lista = await Catalogo.find({ activo: true }).sort({ estado: -1, fechaSugerencia: -1 });
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

    const { tipificacion, actividad, diasHabiles } = req.body;

    if (!tipificacion || !actividad || !diasHabiles) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }

    const rol = req.user.rol?.toLowerCase();
    const esAutorizado = rol === 'coordinador' || rol === 'administrador';

    const nuevoItem = await Catalogo.create({
      tipificacion,
      actividad,
      diasHabiles,
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

    const { tipificacion, actividad, diasHabiles } = req.body;

    const item = await Catalogo.findByIdAndUpdate(
      req.params.id,
      { tipificacion, actividad, diasHabiles },
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
      { estado: 'oficial' },
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
      { activo: false, observaciones },
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

    actividad.observaciones.push({ 
      comentario, 
      fecha: new Date(),
      usuario: req.user.nombre,
      rol: req.user.rol
    });

    console.log("  ✅ Observación creada con usuario:", req.user.nombre);

    if (horas) {
      actividad.horasAcumuladas += horas;
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

/* ================= CERRAR ACTIVIDAD (PUT) ================= */

app.put('/actividades/:id/cerrar', auth, async (req, res) => {
  try {
    console.log("\n🔒 PUT /actividades/:id/cerrar - User:", req.user.nombre);

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

    actividad.estado = "cerrado";

    await actividad.save();

    console.log("  ✅ Actividad cerrada");
    console.log("  📅 Estado actualizado a: cerrado");

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

    actividad.estado = "cerrado";

    await actividad.save();

    console.log("  ✅ Actividad cerrada");
    console.log("  📅 Estado actualizado a: cerrado");

    res.json(actividad);
  } catch (err) {
    console.error("  ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= UTILS ================= */

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

function calcularProgreso(actividad) {
  if (!actividad.fechaCierre) return 0;

  const inicio = new Date(actividad.fechaCreacion).getTime();
  const fin = new Date(actividad.fechaCierre).getTime();
  const hoy = Date.now();

  if (hoy >= fin) return 1;

  return (hoy - inicio) / (fin - inicio);
}

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
