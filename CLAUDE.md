# CLAUDE.md — Crias RPG (express-js-on-vercel)

## Links — mandar SEMPRE, clicáveis, depois de QUALQUER alteração

Não é opcional e não depende de pedido: toda resposta que muda alguma coisa
termina com estes quatro links, em markdown clicável.

| # | O que é | URL |
|---|---------|-----|
| 1 | 🎮 Jogo | https://express-js-on-vercel-git-clau-939c28-gustavos-projects-0bacb990.vercel.app/game |
| 2 | 📚 Database oficial | https://express-js-on-vercel-git-clau-939c28-gustavos-projects-0bacb990.vercel.app/design |
| 3 | 🗺️ Editor de mapa | https://express-js-on-vercel-git-clau-939c28-gustavos-projects-0bacb990.vercel.app/mapa |
| 4 | 🌎 Produção (celular, sem login) | https://express-js-on-vercel-theta-red-86.vercel.app/game |

Os 3 primeiros são o preview da branch de dev (`claude/crias-rpg-dev-Aj0Fd`) —
recebem a mudança assim que o push termina, mas **só abrem em quem está logado
na Vercel**. O 4º é a produção (`main`), público e o único que abre no celular;
ele só muda quando a branch de dev é mergeada na `main`.

## Visão geral do projeto

Jogo RPG de coleta/batalha de criaturas no estilo Pokémon, rodando em HTML5 Canvas puro.  
Stack: **Express.js + TypeScript** servido via **Vercel**. Todo o jogo fica em **`public/game.html`** (arquivo único, ~8500+ linhas).

---

## Regras absolutas (nunca violar)

### ⛔ COLLISION array — zona do orb (INTOCÁVEL)
O array `COLLISION` (48×48) tem uma zona protegida:
- **Linhas 18-24, colunas 18-27** = zona do orb (tiles especiais de coleta de criaturas)
- Na grade FINA (192×192, SUBCOL=4) isso vira linhas 72-99, colunas 72-111
- **JAMAIS modificar esses valores**, mesmo que o usuário mande um array novo para colar.
- No loader da grade fina publicada, a zona recebe os valores do REPOSITÓRIO
  (upscale do `COLLISION`), nunca os publicados — e nunca zeros: zerar a zona
  já apagou a colisão do pedestal do orbe uma vez.

---

## Constantes do mapa

```
TILE        = 39px          (cada célula do grid)
GRID        = 48            (48×48 tiles)
SUBCOL      = 4             (marcação de colisão 4× mais fina: 192×192)
PASSO       = 1 tile        (o personagem anda de tile em tile)
MAP_W_PX    = MAP_H_PX = 1872px   (= 48 × 39)
Imagem mapa = 4000×4000px   (renderizada escalada para 1872×1872)

Colisão: FICAR num tile olha a caixa dos pés (colunas do meio × metade de
baixo); ATRAVESSAR uma divisa olha as células rentes à borda cruzada.
Marca na metade de CIMA de um tile é beiral — nunca bloqueia.
```

### Y_SHIFT (mobile inject)
O código injetado no mobile intercepta `drawImage`. Chamadas de **9 argumentos** com `naturalHeight=1254` (o mapa) recebem `+48` adicionado ao `srcY`. Sprites usam `drawImage` de 5 argumentos — **não são afetados**.

### Câmera e anti-drift de sub-pixel
O mapa usa `Math.round` nas coordenadas de fonte ao desenhar. Qualquer sprite desenhado "sobre" o mapa (ex: casa) deve usar:
```javascript
const _effCamX = Math.round(camX * _scaleX) / _scaleX;
const _effCamY = Math.round(camY * _scaleY) / _scaleY;
```
(`_scaleX` e `_scaleY` são variáveis locais da função `render()`)  
Sem isso, o sprite "deriva" levemente conforme a câmera move.

---

## Mapas do mundo

| Cena | Imagem | Config na nuvem | Como se chega |
|------|--------|-----------------|---------------|
| `world` — Nexus (cidade 1) | `public/mapa-oficial.jpg` | `mapa-config.json` | é onde o jogo começa |
| `sul` — Jardim do Sul (lobby) | `public/mapa-lobby.jpg` | `mapa-config-lobby.json` | atravessando a borda de BAIXO da cidade |
| `cave1` — caverna | embutida | — | pela entrada da caverna |

Cada mapa tem colisão, passa-atrás, peças e remendos próprios. O editor `/mapa`
tem uma aba por mapa no topo do painel; a primeira abre por padrão.

O Jardim do Sul começa como um gramado liso (textura gerada a partir da cor de
grama do próprio mapa da cidade) — é base para construir praça, bancos e
canteiros pelo editor.

## Sistema de personagens

### Tamanho de desenho
Todos os personagens são desenhados com **48×60 pixels** no canvas.

### Base64 (char1, char2)
Sprites embutidos em `<script id="d-sprites-player">` como JSON base64.  
Carregados por `preloadComboSprites()`.

### PNG externos (char3+)
Sprites em arquivos PNG na pasta `public/`. Definidos em `EXTERNAL_COMBO_SPRITES`:

```javascript
const EXTERNAL_COMBO_SPRITES = {
  char3: {
    down:  ['/char3-down-0.png', '/char3-down-1.png', '/char3-down-2.png'],
    up:    ['/char3-up-0.png',   '/char3-up-1.png',   '/char3-up-2.png'],
    left:  ['/char3-left-0.png', '/char3-left-1.png'],
    right: ['/char3-right-0.png','/char3-right-1.png']
  }
};
```

- `loadExternalCombo(comboId)` carrega os PNGs e aplica auto-trim (union bounding box de todos os frames) para alinhar com o tamanho 48×60.
- `getPlayerSprite(dir, frameIdx)` tem fallback para `char1` se o combo selecionado não estiver carregado.
- Ciclo de animação front/back: `0 → 1 → 2 → 1 → 0 → ...`

### PLAYER_COMBOS (linha ~6628)
```javascript
{"id": "char1", "name": "Pioneiro",  "label": "Treinador #1",  "gender": "male",   "available": true},
{"id": "char2", "name": "Pioneira",  "label": "Treinadora #1", "gender": "female", "available": true},
{"id": "char3", "name": "Guardião", "label": "Treinador #2",  "gender": "male",   "available": true},
{"id": "char4", ..., "available": false},  // Em breve
```

---

## Sprites char3 — arquivos em `public/`

| Arquivo | Descrição |
|---------|-----------|
| `char3-down-0.png` | Frente — parado |
| `char3-down-1.png` | Frente — perna esquerda |
| `char3-down-2.png` | Frente — perna direita |
| `char3-up-0.png`   | Costas — parado |
| `char3-up-1.png`   | Costas — perna direita |
| `char3-up-2.png`   | Costas — perna esquerda |
| `char3-left-0.png` | Perfil esquerda — frame 1 |
| `char3-left-1.png` | Perfil esquerda — frame 2 |
| `char3-right-0.png`| Perfil direita — frame 1 |
| `char3-right-1.png`| Perfil direita — frame 2 |

---

## Casa (pass-behind / sprite overlay)

A casa fica em `gx=32, gy=32, gw=12, gh=10` (em tiles). O sprite da "cobertura" é desenhado **sobre** o player para criar efeito de entrar por baixo da casa.  
Código na função `render()`, após desenho dos personagens:

```javascript
// === House sprite overlay (pass-behind) ===
if (state && state.scene !== 'cave1' && assets.houseRoof && assets.houseRoof.complete) {
  const hWorldX = 32 * TILE, hWorldY = 32 * TILE;
  const hWorldW = 12 * TILE, hWorldH = 10 * TILE;
  if (hWorldX + hWorldW >= camX && hWorldX <= camX + cw &&
      hWorldY + hWorldH >= camY && hWorldY <= camY + ch) {
    const _effCamX = Math.round(camX * _scaleX) / _scaleX;
    const _effCamY = Math.round(camY * _scaleY) / _scaleY;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(assets.houseRoof, hWorldX - _effCamX, hWorldY - _effCamY, hWorldW, hWorldH);
    ctx.imageSmoothingEnabled = false;
  }
}
```

---

## HUD Premium

### Elementos principais
- `#profileCard` — card topo-esquerdo (avatar + nome + Lv + barra XP). Clique abre `openProfile()`.
- `#resBar` — barra de recursos topo-direito (gold 🪙 / frags 🧩 / orbs 💠), **uma única pílula compacta**, não sobrepõe o mapa.
- `#questQuickBtn` — painel de missão horizontal (topo-centro).
- `#chatFab` — botão flutuante 💬 (chat colapsado por padrão).
- `#chatPanel.cpanel` — painel de chat expandido.
- `#profileModal` — modal de perfil com 5 abas: Perfil / Crias / Amigos / Conquistas / Config.
- `#playerMiniCard` — mini-card ao tocar em outro jogador.

### Funções JS importantes
```
showPremiumHUD()        — exibe profileCard, resBar, chatFab
updateHUDExtras()       — atualiza valores (throttle 220ms)
updateMissionPanel()    — atualiza #questQuickBtn
openProfile() / closeProfile() / switchProfileTab(tab)
toggleChat(open)        — expande/recolhe chat
showPlayerCard() / hidePlayerCard()
_migrateProfile(s)      — seed de novos campos em saves antigos
trainerXP(s) / playerLevel(s) / playerLevelProgress(s)
orbsCompleted(s)        — total de crias coletadas
```

### Regra crítica de design
`#resBar` deve ser **extremamente discreta** — não pode cobrir nem sobrepor o mapa ou outros elementos HUD. Pílula única, fundo semi-transparente leve, sem `backdrop-filter` pesado.

---

## Estado do jogo (state)

Campos adicionados recentemente em `newGameState()`:
```javascript
createdAt:    Date.now(),
playSeconds:  0,
playerId:     'CR-' + Math.random().toString(36).slice(2,7).toUpperCase(),
friends:      [],
photo:        null,
```

`loadGame()` chama `_migrateProfile(s)` para seeds em saves antigos.  
`startGame()` chama `showPremiumHUD()` e `toggleChat(false)`.

---

## Fluxo de deploy

```
Branch de dev : claude/crias-rpg-dev-Aj0Fd   → preview (links 1, 2 e 3)
Merge para    : main                          → produção (link 4)
Deploy auto   : Vercel detecta o push nas duas
```

O merge para `main` só acontece com autorização explícita do usuário — é o que
publica para o público e é o único jeito de o celular ver a mudança.

```bash
git fetch origin main
git worktree add -B main <tmp> origin/main
git -C <tmp> merge --no-ff --no-commit claude/crias-rpg-dev-Aj0Fd
git -C <tmp> checkout --theirs public/game.html   # dev sempre ganha o conflito
git -C <tmp> add public/game.html && git -C <tmp> commit && git -C <tmp> push origin main
```

---

## Arquitetura geral de `public/game.html`

```
<head>
  CSS global
  CSS Premium HUD (~linha 723+)

<body>
  Canvas (#gameCanvas)
  HUD (#hud — posicionado em top:64px para ficar abaixo do profileCard)
  #profileCard, #resBar, #chatFab
  #chatPanel.cpanel
  #playerMiniCard
  #profileModal
  #onboard (tela de seleção de personagem)
  Overlays de batalha, menu, etc.

<script id="d-sprites-player"> — JSON com sprites base64

<script>
  Constantes (TILE, GRID, MONSTERS, QUESTS, etc.)
  COLLISION array (48×48)
  PLAYER_COMBOS
  EXTERNAL_COMBO_SPRITES + loadExternalCombo()
  preloadComboSprites() / getPlayerSprite()
  newGameState() / saveGame() / loadGame()
  render() / loop()
  renderHUD() → updateHUDExtras()
  Funções de batalha, PvP simulado, etc.
  Premium HUD JS (openProfile, toggleChat, etc.)
```

---

## Não multiplayer

O jogo **não tem servidor de jogadores em tempo real**. PvP é simulado localmente com NPCs. Não adicionar WebSocket ou servidor de estado sem aprovação explícita.
