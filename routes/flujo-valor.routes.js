// routes/flujo-valor.routes.js
const express = require('express');

module.exports = function registerFlujoValorRoutes(app, deps) {
  const { mongoose, auth } = deps;

  /* ================= FLUJO DE VALOR - GET ALL ================= */
  app.get('/flujo-valor', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor');
      const flujos = await mongoose.connection.collection('flujoValor').find({}).toArray();
      console.log('  ✅ Total de flujos:', flujos.length);
      res.json(flujos);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - GET TIPOLOGÍAS ================= */
  app.get('/flujo-valor/lista/tipologias', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor/lista/tipologias');
      const tipologias = await mongoose.connection.collection('flujoValor').aggregate([
        { $group: { _id: '$tipologia' } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const tipoList = tipologias.map(t => t._id).filter(t => t);
      console.log('  ✅ Tipologías encontradas:', tipoList.length);
      res.json(tipoList);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - GET GERENTES POR TIPOLOGÍA ================= */
  app.get('/flujo-valor/lista/gerentes/:tipologia', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor/lista/gerentes/:tipologia');
      console.log('  Tipología:', req.params.tipologia);

      const gerentes = await mongoose.connection.collection('flujoValor').aggregate([
        { $match: { tipologia: req.params.tipologia } },
        { $group: { _id: '$gerente' } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const gerenteList = gerentes.map(g => g._id).filter(g => g);
      console.log('  ✅ Gerentes encontrados:', gerenteList.length);
      res.json(gerenteList);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - GET FLUJOS POR GERENTE ================= */
  app.get('/flujo-valor/lista/flujos/:gerente', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor/lista/flujos/:gerente');
      console.log('  Gerente:', req.params.gerente);

      const flujos = await mongoose.connection.collection('flujoValor').aggregate([
        { $match: { gerente: req.params.gerente } },
        { $group: { _id: '$flujodeValor' } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const flujoList = flujos.map(f => f._id).filter(f => f);
      console.log('  ✅ Flujos encontrados:', flujoList.length);
      res.json(flujoList);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - GET CÉLULAS POR FLUJO ================= */
  app.get('/flujo-valor/lista/celulas/:flujodeValor', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor/lista/celulas/:flujodeValor');
      console.log('  Flujo:', req.params.flujodeValor);

      // IMPORTANTE: aquí debe ser "flujodeValor" (d minúscula) para coincidir con tu data
      const celulas = await mongoose.connection.collection('flujoValor').aggregate([
        { $match: { flujodeValor: req.params.flujodeValor } },
        { $group: { _id: '$celula' } },
        { $sort: { _id: 1 } }
      ]).toArray();

      const celulasList = celulas.map(c => c._id).filter(c => c);
      console.log('  ✅ Células encontradas:', celulasList.length);
      res.json(celulasList);
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - GET LÍDERES POR CÉLULA ================= */
  app.get('/flujo-valor/lista/lideres/:celula', async (req, res) => {
    try {
      console.log('\n📊 GET /flujo-valor/lista/lideres/:celula');
      console.log('  Célula:', req.params.celula);

      const registro = await mongoose.connection.collection('flujoValor').findOne({
        celula: req.params.celula
      });

      if (!registro) {
        return res.status(404).json({ error: 'Célula no encontrada' });
      }

      console.log('  ✅ Líderes encontrados');

      res.json({
        liderTecnicoFlujoValor: registro.liderTecnicoFlujoValor,
        liderTecnicoCelula: registro.liderTecnicoCelula,
        scrum: registro.scrum,
        po: registro.po
      });
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - POST (AGREGAR) ================= */
  app.post('/flujo-valor', auth, async (req, res) => {
    try {
      console.log('\n➕ POST /flujo-valor - User:', req.user.nombre);
      console.log('  📤 Body recibido:', req.body);

      const rol = req.user.rol?.toLowerCase();
      const rolesPermitidos = ['administrador', 'super_admin', 'coordinador', 'senior'];

      if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({ error: 'No tienes permisos para crear flujos de valor' });
      }

      const { tipologia, gerente, flujodeValor, celula, liderTecnicoFlujoValor, liderTecnicoCelula, scrum, po } = req.body;

      if (!tipologia || !gerente || !flujodeValor || !celula) {
        return res.status(400).json({ error: 'Tipología, Gerente, Flujo de Valor y Célula son requeridos' });
      }

      const celExistente = await mongoose.connection.collection('flujoValor').findOne({ celula });
      if (celExistente) {
        return res.status(400).json({ error: `La célula "${celula}" ya existe en el sistema` });
      }

      const nuevoFlujo = {
        tipologia: tipologia.trim(),
        gerente: gerente.trim(),
        flujodeValor: flujodeValor.trim(),
        celula: celula.trim(),
        liderTecnicoFlujoValor: liderTecnicoFlujoValor?.trim() || '',
        liderTecnicoCelula: liderTecnicoCelula?.trim() || '',
        scrum: scrum?.trim() || '',
        po: po?.trim() || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const resultado = await mongoose.connection.collection('flujoValor').insertOne(nuevoFlujo);

      res.status(201).json({
        mensaje: 'Flujo de valor agregado correctamente',
        id: resultado.insertedId,
        flujo: nuevoFlujo
      });
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - PUT (ACTUALIZAR) ================= */
  app.put('/flujo-valor/:id', auth, async (req, res) => {
    try {
      const rol = req.user.rol?.toLowerCase();
      const rolesPermitidos = ['administrador', 'super_admin', 'coordinador', 'senior'];

      if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({ error: 'No tienes permisos para editar flujos de valor' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'ID de flujo inválido' });
      }

      const { tipologia, gerente, flujodeValor, celula, liderTecnicoFlujoValor, liderTecnicoCelula, scrum, po } = req.body;

      if (!tipologia || !gerente || !flujodeValor || !celula) {
        return res.status(400).json({ error: 'Tipología, Gerente, Flujo de Valor y Célula son requeridos' });
      }

      const flujoActual = await mongoose.connection.collection('flujoValor').findOne({
        _id: new mongoose.Types.ObjectId(req.params.id)
      });

      if (!flujoActual) {
        return res.status(404).json({ error: 'Flujo no encontrado' });
      }

      if (flujoActual.celula !== celula) {
        const celExistente = await mongoose.connection.collection('flujoValor').findOne({ celula });
        if (celExistente) {
          return res.status(400).json({ error: `La célula "${celula}" ya existe en el sistema` });
        }
      }

      const flujoActualizado = {
        tipologia: tipologia.trim(),
        gerente: gerente.trim(),
        flujodeValor: flujodeValor.trim(),
        celula: celula.trim(),
        liderTecnicoFlujoValor: liderTecnicoFlujoValor?.trim() || '',
        liderTecnicoCelula: liderTecnicoCelula?.trim() || '',
        scrum: scrum?.trim() || '',
        po: po?.trim() || '',
        updatedAt: new Date()
      };

      const resultado = await mongoose.connection.collection('flujoValor').findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.params.id) },
        { $set: flujoActualizado },
        { returnDocument: 'after' }
      );

      if (!resultado.value) {
        return res.status(404).json({ error: 'Flujo no encontrado' });
      }

      res.json({
        mensaje: 'Flujo actualizado correctamente',
        flujo: resultado.value
      });
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  /* ================= FLUJO DE VALOR - DELETE ================= */
  app.delete('/flujo-valor/:id', auth, async (req, res) => {
    try {
      const rol = req.user.rol?.toLowerCase();
      const rolesPermitidos = ['administrador', 'super_admin', 'coordinador', 'senior'];

      if (!rolesPermitidos.includes(rol)) {
        return res.status(403).json({ error: 'No tienes permisos para eliminar flujos de valor' });
      }

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'ID de flujo inválido' });
      }

      const flujo = await mongoose.connection.collection('flujoValor').findOne({
        _id: new mongoose.Types.ObjectId(req.params.id)
      });

      if (!flujo) {
        return res.status(404).json({ error: 'Flujo no encontrado' });
      }

      const resultado = await mongoose.connection.collection('flujoValor').deleteOne({
        _id: new mongoose.Types.ObjectId(req.params.id)
      });

      if (resultado.deletedCount === 0) {
        return res.status(404).json({ error: 'Flujo no encontrado' });
      }

      res.json({ mensaje: 'Flujo eliminado correctamente' });
    } catch (err) {
      console.error('  ❌ Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });
};