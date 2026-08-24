import express from 'express'
import path from 'path'
import fs from 'fs'

const app = express()

const publicDir = path.join(process.cwd(), 'public')

const MOBILE_INJECT = `<link rel="stylesheet" href="/game-mobile.css">
<style>
/* Force landscape: rotate #app 90deg in portrait. Reset inset:0 explicitly. */
@media (orientation: portrait) {
  #rotatePrompt { display: none !important; }
  #app {
    transform: rotate(90deg) !important;
    transform-origin: center !important;
    width: 100vh !important;
    height: 100vw !important;
    position: fixed !important;
    top: calc((100vh - 100vw) / 2) !important;
    left: calc((100vw - 100vh) / 2) !important;
    right: auto !important;
    bottom: auto !important;
  }
}
</style>
<script>
(function(){
  // Swap embedded base64 map for high-res external file
  var _g = document.getElementById.bind(document);
  document.getElementById = function(id) {
    if (id === 'd-map') { document.getElementById = _g; return { textContent: '/map-hd.jpg.png.png' }; }
    return _g(id);
  };
})();
(function(){
  // Align new map's Core Orb visual with the game sprite
  var MAP_H = 1254, Y_SHIFT = 48;
  var _di = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function() {
    var a = Array.prototype.slice.call(arguments);
    if (a.length === 9 && a[0] && a[0].naturalHeight === MAP_H) {
      a[2] = Math.min(a[2] + Y_SHIFT, MAP_H - a[4]);
    }
    return _di.apply(this, a);
  };
})();
(function(){
  // Force nearest-neighbor on every canvas 2D context (crisp pixel art on HiDPI)
  var _orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function(type, attrs) {
    var ctx = _orig.call(this, type, attrs);
    if (ctx && type === '2d') { ctx.imageSmoothingEnabled = false; }
    return ctx;
  };
})();
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
(function(){
  // PVP arena: override to COVER the screen — no black bars on portrait/tall screens
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof pvpFitArena !== 'function') return;
    pvpFitArena = function() {
      var col = document.getElementById('pvpColiseum');
      var w   = document.getElementById('pvpArenaWrap');
      if (!col || !w) return;
      var cw = col.clientWidth, ch = col.clientHeight;
      if (!cw || !ch) return;
      var iw = 1881, ih = 836; // ARENA_IMG
      var scale = Math.max(cw / iw, ch / ih); // COVER: fill, may crop edges
      w.style.width  = (iw * scale) + 'px';
      w.style.height = (ih * scale) + 'px';
    };
  });
})();
(function(){
  // Force landscape: API lock on Android Chrome; CSS overlay handles iOS
  function tryLock() {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function(){});
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryLock);
  } else {
    tryLock();
  }
})();
<\/script>`

// Pre-load game.html with mobile CSS+script injected (read once at startup)
let gameHtml = ''
try {
  gameHtml = fs.readFileSync(path.join(publicDir, 'game.html'), 'utf8')
    // Add viewport-fit=cover so iOS extends canvas to screen edges
    .replace(
      'content="width=device-width, initial-scale=1.0, user-scalable=no"',
      'content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover"'
    )
    .replace('</head>', MOBILE_INJECT + '</head>')
} catch { /* served via static fallback */ }

// Serve static files from public/
// HTML nunca é cacheado (senão um deploy novo continua servindo a versão antiga
// do jogo); assets versionados podem ficar no cache do browser.
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store, must-revalidate')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate')
    }
  },
}))

// /game → game.html with mobile CSS injection
app.get('/game', (req, res) => {
  // sem cache: cada acesso recebe a build mais recente do jogo
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  if (gameHtml) return void res.type('html').send(gameHtml)
  res.sendFile(path.join(publicDir, 'game.html'))
})

// /collision-editor → collision editor tool
app.get('/collision-editor', (req, res) => {
  res.sendFile(path.join(publicDir, 'collision-editor.html'))
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
        <h1>Welcome to Express on Vercel &#x1F680;</h1>
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
