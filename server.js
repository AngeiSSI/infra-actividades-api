console.log("🔥 SERVER INICIANDO...");

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET = process.env.JWT_SECRET || "infra-secret-key";

/* ===== CORS SIMPLE ===== */
app.use(cors());
app.use(express.json());

/* ===== DB ===== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MONGO CONECTADO"))
  .catch(err => console.log("❌ ERROR MONGO:", err.message));

/* ===== MODELO ===== */
const Actividad = mongoose.model('Actividad', new mongoose.Schema({
  lider: String,
  proyecto: String,
  descripcion: String
}), 'actividades');

/* ===== RUTA TEST ===== */
app.get('/', (req, res) => {
  res.send("API funcionando 🚀");
});

/* ===== START ===== */
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("🚀 Server running on port", port));
