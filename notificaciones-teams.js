const axios = require('axios');

// =================== ENVIAR A CANAL TEAMS ===================
async function enviarAlCanalTeams(titulo, contenidoMarkdown, color = '#CC0000') {
  const webhookUrl = process.env.TEAMS_CHANNEL_WEBHOOK;
  
  if (!webhookUrl) {
    console.log('⚠️ TEAMS_CHANNEL_WEBHOOK no configurado en .env');
    return false;
  }

  try {
    const payload = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: titulo,
      themeColor: color,
      sections: [{
        activityTitle: titulo,
        activitySubtitle: new Date().toLocaleString('es-ES'),
        markdown: true,
        text: contenidoMarkdown
      }]
    };

    await axios.post(webhookUrl, payload, { timeout: 5000 });
    console.log(`✅ Mensaje enviado a Teams: ${titulo}`);
    return true;
  } catch (error) {
    console.error(`❌ Error al enviar a Teams:`, error.message);
    return false;
  }
}

// =================== GENERAR TABLA MARKDOWN PARA TEAMS ===================
function generarTablaTeams(vencidas, proximasVencer) {
  let contenido = '';

  if (vencidas.length > 0) {
    contenido += `
## ❌ TAREAS VENCIDAS (${vencidas.length})

| Actividad | Líder | Proyecto |
|-----------|-------|----------|
`;
    vencidas.forEach(tarea => {
      contenido += `| ${tarea.actividadCatalogo} | ${tarea.lider} | ${tarea.proyecto} |\n`;
    });
    contenido += '\n';
  }

  if (proximasVencer.length > 0) {
    contenido += `
## ⏰ TAREAS PRÓXIMAS A VENCER (${proximasVencer.length})

| Actividad | Líder | Proyecto | Días |
|-----------|-------|----------|------|
`;
    proximasVencer.forEach(tarea => {
      contenido += `| ${tarea.actividadCatalogo} | ${tarea.lider} | ${tarea.proyecto} | ${tarea.diasRestantes} |\n`;
    });
  }

  if (vencidas.length === 0 && proximasVencer.length === 0) {
    contenido += '✅ **No hay tareas vencidas ni próximas a vencer.**';
  }

  return contenido;
}

module.exports = {
  enviarAlCanalTeams,
  generarTablaTeams
};
