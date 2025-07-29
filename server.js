const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// 📁 Servir archivos estáticos como el HTML de confirmación
app.use(express.static(path.join(__dirname)));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const FRONTEND_URI = process.env.FRONTEND_URI || 'http://localhost:3000';

const generateRandomString = (length) => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

// 🔐 Inicia login con Spotify
app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-read-playback-state user-modify-playback-state streaming';

  const queryParams = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${queryParams}`);
});

// 🔄 Callback de Spotify después del login
app.get('/callback', async (req, res) => {
  const code = req.query.code || null;

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    const { refresh_token } = response.data;

    // ✅ Redirige al frontend con el refresh_token
    res.redirect(`${FRONTEND_URI}?refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Error en /callback:', error.response?.data || error.message);
    res.status(500).send('Error al obtener el token');
  }
});

// 🔄 Endpoint para refrescar el token de acceso
app.get('/refresh_token', async (req, res) => {
  const refresh_token = req.query.refresh_token;

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
      }
    );

    res.json({ access_token: response.data.access_token });
  } catch (error) {
    console.error('Error al refrescar token:', error.response?.data || error.message);
    res.status(500).send('Error al refrescar token');
  }
});

// ▶️ Reproducir canción usando refresh_token
app.get('/play', async (req, res) => {
  const { query, token } = req.query;

  if (!query || !token) {
    return res.status(400).json({ ok: false, error: 'Faltan parámetros' });
  }

  try {
    // 🔄 Obtener access_token desde el refresh_token
    const refreshRes = await axios.get(`${FRONTEND_URI}/refresh_token`, {
      params: { refresh_token: token }
    });

    const access_token = refreshRes.data.access_token;

    // 🔍 Buscar la canción por nombre
    const searchRes = await axios.get('https://api.spotify.com/v1/search', {
      headers: { Authorization: `Bearer ${access_token}` },
      params: {
        q: query,
        type: 'track',
        limit: 1
      }
    });

    const track = searchRes.data.tracks.items[0];
    if (!track) {
      return res.json({ ok: false, error: 'Canción no encontrada' });
    }

    // ▶️ Intentar reproducir
    await axios.put(
      'https://api.spotify.com/v1/me/player/play',
      { uris: [`spotify:track:${track.id}`] },
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    res.json({
      ok: true,
      title: `${track.name} - ${track.artists.map(a => a.name).join(", ")}`
    });

  } catch (err) {
    console.error('Error en /play:', err.response?.data || err.message);
    res.status(500).json({ ok: false, error: 'Fallo en reproducción' });
  }
});

// ✅ Página de éxito de login
app.get('/spotify-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'spotify-success.html'));
});

// 🟢 Verificación
app.get('/', (req, res) => {
  res.send('🎧 API de Spotify funcionando correctamente.');
});

app.listen(port, () => {
  console.log(`✅ Servidor escuchando en http://localhost:${port}`);
});

