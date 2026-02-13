console.log("🔥 SERVER INICIANDO...");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET = process.env.JWT_SECRET || "infra-secret-key";

/* ================= CORS ================= */
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

app.use(express.json());

/* ================= DB ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MONGO CONECTADO"))
  .catch(err => console.log("❌ ERROR MONGO:", err.message));

/* ================= MODELOS ================= */

const User = mongoose.model('User', new mongoose.Schema({
  nombre: String,
  email: String,
  password: String,
  rol: String // lider | senior | coordinador
}));

const Actividad = mongoose.model('Actividad', new mongoose.Schema({
  lider: String,
  proyecto: String,
  tipificacion: String,
  actividadCatalogo: String,
  descripcion: String,

  fechaCreacion: { type: Date, default: Date.now },
  fechaCierre: Date,

  estado: { type: String, default: "en progreso" },
  estadoCaso: { type: String, default: "no aplica" },

  horas: { type: Number, default: 0 },
  horasAcumuladas: { type: Number, default: 0 },

  observaciones: [{
    fecha: { type: Date, default: Date.now },
    comentario: String
  }]
}), 'actividades');

/* ================= AUTH ================= */

function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(403).json({ error: "No autorizado" });
  }

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/* ================= LOGIN ================= */

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });

  if (!user) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  const token = jwt.sign(
    { id: user._id, nombre: user.nombre, rol: user.rol },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: {
      nombre: user.nombre,
      rol: user.rol
    }
  });
});

/* ================= ACTIVIDADES ================= */

/* GET actividades */
app.get('/actividades', auth, async (req, res) => {

  let filtro = {};

  // si es líder solo ve sus actividades
  if (req.user.rol === "lider") {
    filtro.lider = req.user.nombre;
  }

  const actividades = await Actividad.find(filtro);
  res.json(actividades);
});

/* POST crear actividad */
app.post('/actividades', auth, async (req, res) => {

  const nueva = await Actividad.create({
    ...req.body,
    lider: req.user.nombre
  });

  res.status(201).json(nueva);
});

/* agregar observación */
app.post('/actividades/:id/observacion', auth, async (req, res) => {

  const { comentario, horas } = req.body;

  const actividad = await Actividad.findById(req.params.id);

  if (!actividad) {
    return res.status(404).json({ error: "Actividad no encontrada" });
  }

  actividad.observaciones.push({ comentario });

  if (horas) {
    actividad.horasAcumuladas += horas;
  }

  await actividad.save();

  res.json(actividad);
});

/* cerrar actividad */
app.post('/actividades/:id/cerrar', auth, async (req, res) => {

  const actividad = await Actividad.findById(req.params.id);

  if (!actividad) {
    return res.status(404).json({ error: "Actividad no encontrada" });
  }

  actividad.estado = "cerrado";
  await actividad.save();

  res.json(actividad);
});

/* ================= TEST ================= */

app.get('/', (req, res) => {
  res.send('API Infra funcionando 🚀');
});

/* ================= START ================= */

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running on port", port));
