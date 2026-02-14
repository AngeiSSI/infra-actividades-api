console.log("🔥 SERVER INICIANDO...");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET = process.env.JWT_SECRET || "infra-secret-key";

app.use(cors());
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
  rol: String
}));

const Catalogo = mongoose.model('Catalogo', new mongoose.Schema({
  tipificacion: String,
  actividad: String,
  diasHabiles: Number
}), 'catalogos');

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
  if (!token) return res.status(403).json({ error: "No autorizado" });

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido" });
  }
}

/* ================= LOGIN ================= */

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, password });
  if (!user) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign(
    { id: user._id, nombre: user.nombre, rol: user.rol },
    SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: { nombre: user.nombre, rol: user.rol }
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

  // solo lider ve sus actividades
  if (req.user.rol === 'lider') {
    filtro.lider = req.user.nombre;
  }

  const actividades = await Actividad.find(filtro).sort({ fechaCreacion: -1 });

  const hoy = new Date();

  actividades.forEach(a => {
    if (!a.fechaCierre) return;

    const inicio = new Date(a.fechaCreacion).getTime();
    const fin = new Date(a.fechaCierre).getTime();
    const progreso = Math.min(1, Math.max(0, (Date.now() - inicio) / (fin - inicio)));

    a._doc.progreso = Math.round(progreso * 100);

    if (a.fechaCierre < hoy) {
      a.estadoCaso = "vencido";
    }
  });

  res.json(actividades);
});

/* CREAR */
app.post('/actividades', auth, async (req, res) => {

  const { tipificacion, actividadCatalogo } = req.body;

  const cat = await Catalogo.findOne({
    tipificacion,
    actividad: actividadCatalogo
  });

  if (!cat) return res.status(400).json({ error: "Actividad no existe en catálogo" });

  const fechaCreacion = new Date();
  const fechaCierre = sumarDiasHabiles(fechaCreacion, cat.diasHabiles);

  const nueva = await Actividad.create({
    ...req.body,
    lider: req.user.nombre,
    fechaCreacion,
    fechaCierre,
    horasAcumuladas: req.body.horas || 0
  });

  res.status(201).json(nueva);
});

/* OBSERVACION */
app.post('/actividades/:id/observacion', auth, async (req, res) => {
  const act = await Actividad.findById(req.params.id);

  act.observaciones.push({ comentario: req.body.comentario });
  act.horasAcumuladas += req.body.horas || 0;

  await act.save();

  res.json(act);
});

/* CERRAR */
app.post('/actividades/:id/cerrar', auth, async (req, res) => {
  const act = await Actividad.findById(req.params.id);
  act.estado = "cerrado";
  await act.save();
  res.json(act);
});

/* ================= UTILS ================= */

function sumarDiasHabiles(fecha, dias) {
  let result = new Date(fecha);
  let added = 0;

  while (added < dias) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) added++;
  }

  return result;
}

/* ================= START ================= */

app.get('/', (req,res)=> res.send("API OK 🚀"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running"));
