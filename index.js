require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

app.use(cors());

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

app.get("/spotify-login", (req, res) => {
  const scope = "user-read-playback-state user-modify-playback-state user-read-currently-playing";
  const redirect = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&show_dialog=true`;
  res.redirect(redirect);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const response = await axios.post("https://accounts.spotify.com/api/token", null, {
      params: {
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      },
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")
      }
    });

    const { access_token, refresh_token } = response.data;

    res.send(`
      <script>
        window.opener.postMessage({
          type: "SPOTIFY_TOKEN",
          access_token: "${access_token}",
          refresh_token: "${refresh_token}"
        }, "*");
        window.close();
      </script>
    `);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(400).send("Error al intercambiar el código por token");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor activo en puerto ${PORT}`);
});
