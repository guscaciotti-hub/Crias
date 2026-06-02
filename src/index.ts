import express from 'express'
import path from 'path'
import fs from 'fs'

const app = express()

const publicDir = path.join(process.cwd(), 'public')

const MOBILE_INJECT = `<link rel="stylesheet" href="/game-mobile.css">
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
  // BFS pathfinding + neon quest-path overlay
  var _navTarget = null;
  var _navStart  = 0;
  var NAV_TIMEOUT = 12000;

  // ── Overlay canvas ────────────────────────────────────────────────────────────────────────
  var _oc = null, _ox = null;

  function _ensureOC() {
    if (_oc) return true;
    var gc = document.getElementById('game');
    if (!gc || !gc.parentNode) return false;
    _oc = document.createElement('canvas');
    _oc.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:3;';
    gc.parentNode.insertBefore(_oc, gc.nextSibling);
    _ox = _oc.getContext('2d');
    return true;
  }

  // Game uses: TILE = MAP_W_PX / GRID ≈ 39 px/tile; camX/camY = world-px camera offset
  function _getTS() { return (typeof TILE !== 'undefined' && TILE > 4 && TILE < 500 ? TILE : 39); }
  function _getCam() {
    if (typeof camX !== 'undefined') return { x: camX, y: camY };
    if (typeof camera !== 'undefined' && camera) return { x: camera.x || 0, y: camera.y || 0 };
    if (!state || !state.player) return { x: 0, y: 0 };
    var tS = _getTS();
    return { x: state.player.x * tS + tS / 2 - window.innerWidth / 2,
             y: state.player.y * tS + tS / 2 - window.innerHeight / 2 };
  }

  // 4-point star sparkle
  function _star(ctx, cx, cy, r) {
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      var d = (i % 2 === 0) ? r : r * 0.35;
      i === 0 ? ctx.moveTo(cx + d * Math.cos(a), cy + d * Math.sin(a))
              : ctx.lineTo(cx + d * Math.cos(a), cy + d * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
  }

  function _loop(ts) {
    requestAnimationFrame(_loop);
    if (!_ensureOC()) return;
    var cw = window.innerWidth, ch = window.innerHeight;
    if (_oc.width !== cw || _oc.height !== ch) { _oc.width = cw; _oc.height = ch; }
    _ox.clearRect(0, 0, cw, ch);

    if (!_navTarget || !state || !state.player || !state._autoWalkPath) return;
    var pvp = document.getElementById('pvpBattle');
    if (document.querySelector('.overlay.active') || (pvp && pvp.classList.contains('active'))) return;

    var remaining = state._autoWalkPath.slice(state._autoWalkIdx || 0);
    if (!remaining.length) return;

    var tS   = _getTS();
    var cam  = _getCam();
    var pulse  = 0.55 + 0.45 * Math.sin(ts / 300);         // ~3.3 Hz
    var pulse2 = 0.55 + 0.45 * Math.sin(ts / 300 + Math.PI); // offset for alternating rings
    var n    = remaining.length;

    _ox.save();
    _ox.globalCompositeOperation = 'screen'; // additive glow blend

    // PASS 1 — soft ambient halos (no shadow, large radius, low alpha)
    for (var i = 0; i < n; i++) {
      var s = remaining[i];
      var sx = s.x * tS + tS / 2 - cam.x;
      var sy = s.y * tS + tS / 2 - cam.y;
      var prog = (i + 1) / n;
      _ox.fillStyle = 'rgba(0,170,255,' + (pulse * (0.06 + 0.16 * prog)).toFixed(2) + ')';
      _ox.beginPath();
      _ox.arc(sx, sy, tS * 0.34, 0, 6.2832);
      _ox.fill();
    }

    // PASS 2 — bright core dots (+ star sparkles every 5 steps)
    _ox.shadowBlur = 12;
    _ox.shadowColor = 'rgba(0,210,255,0.9)';
    for (var i = 0; i < n - 1; i++) {
      var s = remaining[i];
      var sx = s.x * tS + tS / 2 - cam.x;
      var sy = s.y * tS + tS / 2 - cam.y;
      var prog = (i + 1) / n;
      var alpha = pulse * (0.28 + 0.55 * prog);
      var r = Math.max(2.5, tS * (0.07 + 0.05 * prog));
      _ox.fillStyle = 'rgba(80,225,255,' + alpha.toFixed(2) + ')';
      if (i % 5 === 0) {
        _star(_ox, sx, sy, r * 1.7);
      } else {
        _ox.beginPath();
        _ox.arc(sx, sy, r, 0, 6.2832);
        _ox.fill();
      }
    }

    // PASS 3 — destination beacon: ripple rings + bright center
    var dst = remaining[n - 1];
    var dx = dst.x * tS + tS / 2 - cam.x;
    var dy = dst.y * tS + tS / 2 - cam.y;

    _ox.shadowBlur = 22;
    _ox.shadowColor = 'rgba(0,220,255,0.95)';
    _ox.lineWidth = 2;

    _ox.strokeStyle = 'rgba(0,220,255,' + (pulse * 0.7).toFixed(2) + ')';
    _ox.beginPath();
    _ox.arc(dx, dy, tS * (0.32 + 0.22 * pulse), 0, 6.2832);
    _ox.stroke();

    _ox.strokeStyle = 'rgba(0,200,255,' + (pulse2 * 0.5).toFixed(2) + ')';
    _ox.lineWidth = 1.5;
    _ox.beginPath();
    _ox.arc(dx, dy, tS * (0.32 + 0.22 * pulse2), 0, 6.2832);
    _ox.stroke();

    _ox.strokeStyle = 'rgba(100,230,255,' + (pulse * 0.25).toFixed(2) + ')';
    _ox.lineWidth = 1;
    _ox.beginPath();
    _ox.arc(dx, dy, tS * (0.52 + 0.2 * pulse), 0, 6.2832);
    _ox.stroke();

    _ox.shadowBlur = 26;
    _ox.fillStyle = 'rgba(190,245,255,' + pulse.toFixed(2) + ')';
    _ox.beginPath();
    _ox.arc(dx, dy, Math.max(4, tS * 0.17), 0, 6.2832);
    _ox.fill();

    _ox.restore();
  }

  // ── BFS walk ────────────────────────────────────────────────────────────────────────────
  function bfsWalk(tx, ty, autoInteract, face) {
    if (!state || state.scene === 'cave1') return;
    var cur = state.player;
    if (!cur) return;
    // If mid-move, start from where current move lands (avoids stale start)
    var sx = (typeof movingTo !== 'undefined' && movingTo) ? Math.round(movingTo.toX) : Math.round(cur.x);
    var sy = (typeof movingTo !== 'undefined' && movingTo) ? Math.round(movingTo.toY) : Math.round(cur.y);
    var eff = face || 'down';

    function bfsTo(dx, dy) {
      if (sx === dx && sy === dy) return [];
      var DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
      var par = new Map();
      par.set(sx+','+sy, null);
      var q = [[sx, sy]];
      for (var i = 0; i < q.length; i++) {
        if (par.size > 4000) return null;
        var cx = q[i][0], cy = q[i][1];
        for (var d = 0; d < 4; d++) {
          var nx = cx+DIRS[d][0], ny = cy+DIRS[d][1];
          if (nx === dx && ny === dy) {
            par.set(nx+','+ny, [cx, cy]);
            var steps = [], node = [nx, ny];
            while (node) {
              steps.unshift({ x: node[0], y: node[1] });
              var p = par.get(node[0]+','+node[1]);
              node = (p !== undefined) ? p : null;
            }
            steps.shift();
            return steps;
          }
          var k = nx+','+ny;
          if (!par.has(k) && canWalkTo(nx, ny)) { par.set(k, [cx, cy]); q.push([nx, ny]); }
        }
      }
      return null;
    }

    // QUEST_NAV gives the stand tile directly — navigate to (tx, ty)
    var steps = canWalkTo(tx, ty) ? bfsTo(tx, ty) : null;
    if (steps === null) {
      // Stand tile blocked — try walkable adjacent tiles sorted by proximity
      var adjs = [[tx,ty-1],[tx,ty+1],[tx-1,ty],[tx+1,ty]]
        .filter(function(t) { return canWalkTo(t[0], t[1]); })
        .sort(function(a, b) { return (Math.abs(a[0]-sx)+Math.abs(a[1]-sy)) - (Math.abs(b[0]-sx)+Math.abs(b[1]-sy)); });
      for (var fi = 0; fi < adjs.length; fi++) {
        steps = bfsTo(adjs[fi][0], adjs[fi][1]);
        if (steps !== null) break;
      }
    }

    if (steps === null) return;
    if (steps.length === 0) {
      if (autoInteract) setTimeout(function() { lastFacing = eff; if (state.player) state.player.dir = eff; tryInteract(); }, 80);
      _navTarget = null;
      return;
    }
    state._autoWalkPath = steps;
    state._autoWalkIdx = 0;
    state._autoWalkInteract = !!autoInteract;
    state._autoWalkFace = eff;
  }

  document.addEventListener('DOMContentLoaded', function() {
    requestAnimationFrame(_loop);
    if (typeof walkPlayerToward !== 'function') return;
    walkPlayerToward = function(tx, ty, autoInteract, face) {
      _navTarget = { tx: tx, ty: ty, autoInteract: !!autoInteract, face: face || 'down' };
      _navStart  = Date.now();
      bfsWalk(tx, ty, autoInteract, face);
    };
    // Re-route if the executor blocks mid-path (obstacle appeared or start position was stale)
    setInterval(function() {
      if (!_navTarget || !state || !state.player) return;
      if (Date.now() - _navStart > NAV_TIMEOUT) { _navTarget = null; return; }
      if (state._autoWalkPath) return; // still walking
      var cur = state.player;
      var dist = Math.abs(Math.round(cur.x) - _navTarget.tx) + Math.abs(Math.round(cur.y) - _navTarget.ty);
      if (dist <= 1) { _navTarget = null; return; } // arrived
      bfsWalk(_navTarget.tx, _navTarget.ty, _navTarget.autoInteract, _navTarget.face);
    }, 300);
  });
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
