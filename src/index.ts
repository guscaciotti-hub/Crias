import express from 'express'
import path from 'path'

const app = express()

const publicDir = path.join(process.cwd(), 'public')

// O jogo não é mais remendado pelo servidor. Tudo que era injetado aqui (CSS de
// celular, rotação em retrato, troca do mapa, offset do drawImage, patch do
// getContext, observer do chat e override da arena PvP) ou virou código morto —
// o jogo inteiro vive dentro de um IIFE, então os overrides nunca alcançavam
// nada — ou apontava para assets que saíram do jogo. O que continua valendo
// mora dentro do próprio public/game.html, que assim funciona igual servido
// pelo Express ou direto do CDN como arquivo estático.

// Serve static files from public/
// HTML revalida a cada visita (um deploy novo nunca fica preso no cache), mas
// pode ficar guardado: quando nada mudou o browser recebe 304 em vez de baixar
// o arquivo inteiro de novo. Assets versionados ficam no cache do browser.
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate')
    }
  },
}))

// Espelho da configuração publicada dos mapas (dados públicos do storage).
// Serve para depurar colisão/remendos com os DADOS REAIS: o ambiente de
// desenvolvimento não alcança o Supabase direto, mas alcança este preview.
app.get('/debug/config/:arq', async (req, res) => {
  const arq = String(req.params.arq || '')
  if (!/^[\w.-]+\.json$/.test(arq)) { res.status(400).json({ erro: 'nome inválido' }); return }
  try {
    const r = await fetch(
      'https://gmycqvvvglexbtbqkjzi.supabase.co/storage/v1/object/public/mapas/' + arq + '?t=' + Date.now())
    if (!r.ok) { res.status(r.status).json({ erro: 'storage devolveu ' + r.status }); return }
    res.setHeader('Cache-Control', 'no-store')
    res.json(await r.json())
  } catch (e) {
    res.status(502).json({ erro: String(e) })
  }
})

// /game → o próprio public/game.html
app.get('/game', (req, res) => {
  // 'no-cache' revalida a cada visita (continua sempre a build mais recente),
  // mas deixa o browser guardar: em vez de baixar tudo de novo, recebe um 304.
  // Com 'no-store' o celular re-baixava o jogo inteiro toda vez que abria.
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(publicDir, 'game.html'))
})

// /rig → estúdio de ossos (rigging simples e animações prontas)
app.get('/rig', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(publicDir, 'rig.html'))
})

// /studio → estúdio de assets (imagem limpa → 3D → sprites do jogo)
app.get('/studio', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(path.join(publicDir, 'studio.html'))
})

// /forge → fábrica de assets (imagem → chroma limpo → modelo 3D via HF)
app.get('/forge', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.sendFile(path.join(publicDir, 'forge.html'))
})

// /mapa → editor de colisão, passa-atrás e orbe sobre o mapa oficial
app.get('/mapa', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.sendFile(path.join(publicDir, 'mapa.html'))
})

// /editor → construtor visual de mapas (pinta tiles + colisão sobre o original)
app.get('/editor', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.sendFile(path.join(publicDir, 'editor.html'))
})

// /design → database oficial do jogo (mecânica, crias, orbes, masmorra)
app.get('/design', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.sendFile(path.join(publicDir, 'design.html'))
})

// /prompts → lista de prompts prontos (copiar e colar no ChatGPT)
app.get('/prompts', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, must-revalidate')
  res.sendFile(path.join(publicDir, 'prompts.html'))
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
