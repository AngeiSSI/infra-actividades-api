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

const Catalogo = mongoose.model(
  'Catalogo',
  new mongoose.Schema({
    tipificacion: String,
    actividad: String,
    diasHabiles: Number
  }),
  'catalogos'
);

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

  const header = req.headers['authorization'] || req.headers['Authorization'];

  if (!header) {
    return res.status(401).json({ error: "No autorizado - sin token" });
  }

  const token = header.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, SECRET);
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

/* ================= CATALOGO ================= */

app.get('/catalogo', auth, async (req, res) => {
  const lista = await Catalogo.find();
  res.json(lista);
});

/* ================= ACTIVIDADES ================= */

app.get('/actividades', auth, async (req, res) => {

  let filtro = {};

  if (req.user.rol === 'lider') {
    filtro.lider = req.user.nombre;
  }

  const actividades = await Actividad.find(filtro).sort({ fechaCreacion: -1 });

  const hoy = new Date();

  for (const act of actividades) {

    if (act.estado === "cerrado" || !act.fechaCierre) continue;

    const progreso = calcularProgreso(act);

    if (act.fechaCierre < hoy) {
      act.estadoCaso = "vencido";
    }

    act._doc.progreso = Math.round(progreso * 100);
  }

  res.json(actividades);
});

/* CREAR ACTIVIDAD */

app.post('/actividades', auth, async (req, res) => {

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

  const nueva = await Actividad.create({
    ...req.body,
    lider: req.user.nombre,
    fechaCreacion,
    fechaCierre
  });

  res.status(201).json(nueva);
});

/* OBSERVACION */

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

/* CERRAR */

app.post('/actividades/:id/cerrar', auth, async (req, res) => {

  const actividad = await Actividad.findById(req.params.id);

  if (!actividad) {
    return res.status(404).json({ error: "Actividad no encontrada" });
  }

  actividad.estado = "cerrado";
  await actividad.save();

  res.json(actividad);
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running on port", port));
