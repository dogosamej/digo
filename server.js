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

    // ✅ Redirige a la página de éxito con el refresh_token en la URL
    res.redirect(`${FRONTEND_URI}?refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Error en /callback:', error.response?.data || error.message);
    res.status(500).send('Error al obtener el token');
  }
});

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

app.get('/spotify-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'spotify-success.html'));
});

app.get('/', (req, res) => {
  res.send('🎧 API de Spotify funcionando correctamente.');
});

app.listen(port, () => {
  console.log(`✅ Servidor escuchando en http://localhost:${port}`);
});

