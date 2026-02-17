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
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
  rol: String
});

const User = mongoose.model('User', userSchema, 'users');

const catalogoSchema = new mongoose.Schema({
  tipificacion: String,
  actividad: String,
  diasHabiles: Number
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
  observaciones: [{
    fecha: { type: Date, default: Date.now },
    comentario: String
  }]
});

const Actividad = mongoose.model('Actividad', actividadSchema, 'actividades');

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
  console.log("  🔐 SECRET usado para validar:", SECRET);

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
      console.log("  📊 Email buscado:", email);
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    console.log("  ✅ Usuario encontrado:", user.nombre);

    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, rol: user.rol },
      SECRET,
      { expiresIn: '30d' }
    );

    console.log("  ✅ Token generado:", token.substring(0, 50) + "...");

    res.json({
      token,
      usuario: {
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (err) {
    console.error("  ❌ Error en login:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ================= CATALOGO ================= */

app.get('/catalogo', auth, async (req, res) => {
  try {
    console.log("\n📖 GET /catalogo - User:", req.user.nombre);
    const lista = await Catalogo.find();
    console.log("  ✅ Catálogo enviado:", lista.length, "items");
    res.json(lista);
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

    if (req.user.rol === 'lider') {
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
      // ✅ NO HAGAS SAVE() aquí, solo lectura
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
      actividad: actividadCatalogo
    });

    if (!cat) {
      return res.status(400).json({ error: "Actividad no existe en catálogo" });
    }

    const fechaCreacion = new Date();
    const fechaCierre = sumarDiasHabiles(fechaCreacion, cat.diasHabiles);

    // ✅ NUEVO: Incluir fechaModificacion al crear
    const nueva = await Actividad.create({
      ...req.body,
      lider: req.user.nombre,
      fechaCreacion,
      fechaModificacion: fechaCreacion,  // ✅ Se asigna automáticamente
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
    console.log("\n📝 POST /actividades/:id/observaciones - User:", req.user.nombre);

    const { comentario, horas } = req.body;

    const actividad = await Actividad.findById(req.params.id);

    if (!actividad) {
      return res.status(404).json({ error: "Actividad no encontrada" });
    }

    actividad.observaciones.push({ comentario, fecha: new Date() });

    if (horas) {
      actividad.horasAcumuladas += horas;
    }

    // ✅ IMPORTANTE: Actualizar fechaModificacion
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Observación agregada");
    console.log("  📅 fechaModificacion actualizada:", actividad.fechaModificacion);

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

    actividad.estado = "cerrado";
    // ✅ NUEVO: Actualizar fechaModificacion al cerrar
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad cerrada");
    console.log("  📅 fechaModificacion actualizada:", actividad.fechaModificacion);

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

    actividad.estado = "cerrado";
    // ✅ NUEVO: Actualizar fechaModificacion al cerrar
    actividad.fechaModificacion = new Date();

    await actividad.save();

    console.log("  ✅ Actividad cerrada");
    console.log("  📅 fechaModificacion actualizada:", actividad.fechaModificacion);

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
