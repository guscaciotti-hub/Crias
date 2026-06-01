import express from 'express'
import path from 'path'
import fs from 'fs'

const app = express()

const publicDir = path.join(process.cwd(), 'public')

const MOBILE_INJECT = `<link rel="stylesheet" href="/game-mobile.css">
<script>
(function(){
  function syncChat() {
    var chat = document.getElementById('chatPanel');
    if (!chat) return;
    var pvp = document.getElementById('pvpBattle');
    var anyActive = !!(
      document.querySelector('.overlay.active') ||
      (pvp && pvp.classList.contains('active'))
    );
    chat.style.display = anyActive ? 'none' : '';
  }
  var mo = new MutationObserver(syncChat);
  function watchOverlays() {
    document.querySelectorAll('.overlay').forEach(function(o) {
      mo.observe(o, { attributes: true, attributeFilter: ['class','style'] });
    });
    var pvp = document.getElementById('pvpBattle');
    if (pvp) mo.observe(pvp, { attributes: true, attributeFilter: ['class'] });
    syncChat();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchOverlays);
  } else {
    watchOverlays();
  }
})();
<\/script>`

// Pre-load game.html with mobile CSS+script injected (read once at startup)
let gameHtml = ''
try {
  gameHtml = fs.readFileSync(path.join(publicDir, 'game.html'), 'utf8')
    .replace('</head>', MOBILE_INJECT + '</head>')
} catch { /* served via static fallback */ }

// Serve static files from public/
app.use(express.static(publicDir))

// /game → game.html with mobile CSS injection
app.get('/game', (req, res) => {
  if (gameHtml) return void res.type('html').send(gameHtml)
  res.sendFile(path.join(publicDir, 'game.html'))
})

// Home route - HTML
app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Express on Vercel</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/api-data">API Data</a>
          <a href="/healthz">Health</a>
        </nav>
        <h1>Welcome to Express on Vercel 🚀</h1>
        <p>This is a minimal example without a database or forms.</p>
        <img src="/logo.png" alt="Logo" width="120" />
      </body>
    </html>
  `)
})

app.get('/about', function (req, res) {
  res.sendFile(path.join(process.cwd(), 'components', 'about.htm'))
})

// Example API endpoint - JSON
app.get('/api-data', (req, res) => {
  res.json({
    message: 'Here is some sample API data',
    items: ['apple', 'banana', 'cherry'],
  })
})

// Health check
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
