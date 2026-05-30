// ============================================================
// CRIAS — Nexus Central Scene
// Main overworld map — exploration, Core Orb, NPCs
// Companion mechanic: monster follows the player (Cursor feature)
// ============================================================

const FONT_NEXUS = '"Press Start 2P", monospace'

const NEXUS_TILE = {
  GRASS:      0,   // walkable ground
  TREE:       1,   // obstacle
  PATH:       2,   // cobblestone walkable
  BUILDING:   3,   // solid building
  WATER:      4,   // water, not walkable
  TALL_GRASS: 5,   // low encounter chance
  CORE_ORB:   6,   // Core Orb area (walkable, special)
  CAVE_ENTRY: 7,   // triggers cave scene
  GRASS2:     8,   // alternate grass
  FENCE:      9,   // low wall
  FLOWER:     10,  // decoration, walkable
}

// 20 × 15 tile map  (each tile = 32px)
const NEXUS_MAP = [
  //0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19
  [ 1, 1, 1, 1, 1, 1, 1, 1, 7, 7, 7, 7, 1, 1, 1, 1, 1, 1, 1, 1 ], // 0 — cave entrance
  [ 1, 1, 5, 5, 5, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 5, 5, 5, 1, 1 ], // 1
  [ 1, 5, 5, 3, 3, 5, 1, 2, 2, 1, 1, 2, 2, 1, 5, 3, 3, 5, 5, 1 ], // 2
  [ 1, 5, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 5, 1 ], // 3
  [ 1, 0,10, 9, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 9,10, 0, 0, 1 ], // 4
  [ 1, 0, 3, 3, 2, 0, 0, 0, 0, 6, 6, 0, 0, 0, 0, 2, 3, 3, 0, 1 ], // 5
  [ 1, 0, 3, 3, 2, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 2, 3, 3, 0, 1 ], // 6
  [ 1, 0, 0, 0, 2, 0, 0, 6, 6, 6, 6, 6, 6, 0, 0, 2, 0, 0, 0, 1 ], // 7 — orb center
  [ 1, 0, 3, 3, 2, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 2, 3, 3, 0, 1 ], // 8
  [ 1, 0, 3, 3, 2, 0, 0, 0, 0, 6, 6, 0, 0, 0, 0, 2, 3, 3, 0, 1 ], // 9
  [ 1, 0, 9, 9, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 9, 9, 0, 1 ], // 10
  [ 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 1 ], // 11
  [ 1, 5, 5, 0, 0, 5, 5, 0, 0, 4, 4, 0, 0, 5, 5, 0, 0, 5, 5, 1 ], // 12 — pond
  [ 1, 1, 5, 5, 0, 5, 5, 2, 2, 4, 4, 2, 2, 5, 5, 0, 5, 5, 1, 1 ], // 13
  [ 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1 ], // 14 — south exit
]

const TILE_SIZE = 32

const TILE_COLORS = {
  0: 0x2D6A2D,  // grass dark
  1: 0x1A4A0A,  // tree dark green
  2: 0x888070,  // cobblestone path
  3: 0x6B5A3A,  // building wall
  4: 0x2266AA,  // water
  5: 0x3A8A3A,  // tall grass (brighter)
  6: 0x1A1A4A,  // core orb area (dark mystical)
  7: 0x222222,  // cave opening
  8: 0x347A34,  // alt grass
  9: 0x8B7355,  // fence
  10: 0x4A9A3A, // flowers
}

// NPC definitions
const NPCS = [
  { tx: 17, ty: 2, name: 'Lena', color: 0xFFB6C1, dialog: [
    'Welcome to Nexus Central, Tamer!',
    'The Core Orb at the center draws rare entities from across the world.',
    'I heard whispers of a Mythic creature lurking deep in the cave...',
  ]},
  { tx: 2, ty: 2, name: 'Marcus', color: 0xADD8E6, dialog: [
    'Your monster is one of a kind — no one else has one like it!',
    'The seed it was born from will never repeat.',
    'Protect it well.',
  ]},
  { tx: 9, ty: 3, name: 'Zara', color: 0xDDA0DD, dialog: [
    'Type matchups matter in battle.',
    'Fire burns Air and Earth, Water douses Fire, Electric shocks Water...',
    'Learn your enemy\'s element before striking!',
  ]},
  { tx: 10, ty: 11, name: 'Old Ren', color: 0xF4A460, dialog: [
    'The cave above holds powerful wild entities...',
    'The taller the grass, the more dangerous the encounter.',
    'Be ready. Once your monster faints, it wakes up at half HP back here.',
  ]},
]

class NexusScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NexusScene' })
    this.player = { tx: 9, ty: 12, facing: 'down', moving: false, walkFrame: 0 }
    // Companion: monster follows 1 tile behind the player (Cursor feature)
    this.companion = { x: 9 * 32 + 16, y: 12 * 32 + 16, targetX: 9 * 32 + 16, targetY: 13 * 32 + 16 }
    this.gfx = null
    this.uiGfx = null
    this.hudTexts = []
    this.orbTime = 0
    this.nearNPC = null
    this.dialogActive = false
    this.dialogLines = []
    this.dialogIdx = 0
  }

  create() {
    this.gfx = this.add.graphics()
    this.uiGfx = this.add.graphics()
    this.uiGfx.setScrollFactor(0).setDepth(10)

    this.cursors = this.input.keyboard.createCursorKeys()
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    })
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    // Interaction hint UI
    this.createHintUI()

    // Welcome message for new players
    if (window.CRIAS?.isNew) {
      this.time.delayedCall(1000, () => this.showWelcome())
    }
  }

  createHintUI() {
    const ui = document.createElement('div')
    ui.id = 'nexus-hint-ui'
    ui.style.cssText = `
      position: absolute;
      bottom: 12px; left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      font-family: 'Press Start 2P', monospace;
      font-size: 8px;
      color: #7EC8E3;
      letter-spacing: 0.1em;
      text-shadow: 0 0 6px #00BFFF;
      opacity: 0.9;
      display: none;
      background: rgba(5,8,16,0.75);
      padding: 6px 12px;
      border: 1px solid #00BFFF44;
    `
    document.getElementById('game-container').appendChild(ui)
    this.hintUI = ui
  }

  showHint(msg) {
    if (this.hintUI) {
      this.hintUI.textContent = msg
      this.hintUI.style.display = 'block'
    }
  }

  hideHint() {
    if (this.hintUI) this.hintUI.style.display = 'none'
  }

  showWelcome() {
    const monster = window.CRIAS?.monster
    if (!monster) return
    this.showDialog(null, [
      `CORE ORB ATIVADO`,
      `Seu ${monster.species} exclusivo nasceu!`,
      `Especie: ${monster.species}  Elemento: ${monster.element}`,
      `Raridade: ${monster.rarity}  Personalidade: ${monster.personality}`,
      `Va para a CAVERNA (norte) para treinar!`,
    ])
    window.CRIAS.isNew = false
  }

  showDialog(npcName, lines) {
    this.dialogActive = true
    this.dialogLines = lines
    this.dialogIdx = 0
    this.renderDialog()
  }

  renderDialog() {
    // Remove existing dialog
    const old = document.getElementById('nexus-dialog')
    if (old) old.remove()

    if (!this.dialogActive) return

    const line = this.dialogLines[this.dialogIdx]
    const npc = this.nearNPC

    const box = document.createElement('div')
    box.id = 'nexus-dialog'
    box.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: rgba(5,8,16,0.97);
      border-top: 3px solid #00d4ff;
      padding: 20px 28px 16px;
      font-family: 'Press Start 2P', monospace;
      color: #e0f7ff;
      font-size: 10px;
      line-height: 2.2;
      box-shadow: 0 -4px 20px rgba(0,212,255,0.2);
      pointer-events: all;
      cursor: pointer;
      min-height: 90px;
    `

    let html = ''
    if (npc) {
      html += `<div style="color:#00d4ff;font-size:8px;margin-bottom:10px;
        letter-spacing:0.1em;">${npc.name.toUpperCase()}</div>`
    }
    html += `<div>${line}</div>
      <div style="color:#335566;font-size:7px;margin-top:10px;text-align:right;">
        ${this.dialogIdx < this.dialogLines.length - 1 ? '[ ESPACO / CLIQUE ]' : '[ FECHAR ]'}
      </div>`

    box.innerHTML = html
    box.addEventListener('click', () => this.advanceDialog())
    document.getElementById('game-container').appendChild(box)
  }

  advanceDialog() {
    this.dialogIdx++
    if (this.dialogIdx >= this.dialogLines.length) {
      this.dialogActive = false
      const box = document.getElementById('nexus-dialog')
      if (box) box.remove()
    } else {
      this.renderDialog()
    }
  }

  isWalkable(tx, ty) {
    if (ty < 0 || ty >= NEXUS_MAP.length || tx < 0 || tx >= NEXUS_MAP[0].length) return false
    const t = NEXUS_MAP[ty][tx]
    return t !== NEXUS_TILE.TREE && t !== NEXUS_TILE.BUILDING && t !== NEXUS_TILE.WATER && t !== NEXUS_TILE.FENCE
  }

  getNPC(tx, ty) {
    return NPCS.find(n => n.tx === tx && n.ty === ty) || null
  }

  tryMove(dx, dy, facing) {
    if (this.player.moving || this.dialogActive) return
    const nx = this.player.tx + dx
    const ny = this.player.ty + dy
    this.player.facing = facing

    // Check NPC collision
    if (this.getNPC(nx, ny)) {
      this.player.facing = facing
      return // can't walk into NPC
    }

    if (!this.isWalkable(nx, ny)) return

    // Companion follows previous player position
    const prevX = this.player.tx * TILE_SIZE + TILE_SIZE / 2
    const prevY = this.player.ty * TILE_SIZE + TILE_SIZE / 2
    this.companion.targetX = prevX
    this.companion.targetY = prevY

    this.player.tx = nx
    this.player.ty = ny
    this.player.moving = true
    this.player.walkFrame++

    // Check tile events after move
    this.time.delayedCall(80, () => {
      this.player.moving = false
      this.checkTileEvent()
    })

    // Save position
    GameAPI.savePosition('nexus', nx, ny)
  }

  checkTileEvent() {
    const { tx, ty } = this.player
    const tile = NEXUS_MAP[ty]?.[tx]

    if (tile === NEXUS_TILE.CAVE_ENTRY) {
      // Enter cave
      this.transitionTo('CaveScene')
      return
    }

    // Check nearby NPC (adjacent)
    const adj = [
      this.getNPC(tx, ty - 1),
      this.getNPC(tx, ty + 1),
      this.getNPC(tx - 1, ty),
      this.getNPC(tx + 1, ty),
    ].filter(Boolean)
    this.nearNPC = adj[0] || null

    if (this.nearNPC) {
      this.showHint(`[SPACE] Talk to ${this.nearNPC.name}`)
    } else if (tile === NEXUS_TILE.CAVE_ENTRY) {
      this.showHint('[SPACE] Enter Cave')
    } else {
      this.hideHint()
    }
  }

  transitionTo(scene) {
    const flash = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0x000000
    ).setAlpha(0).setDepth(100)

    this.tweens.add({
      targets: flash, alpha: 1, duration: 400,
      onComplete: () => {
        this.shutdown()
        this.scene.start(scene)
      }
    })
  }

  update(time, delta) {
    this.orbTime = time

    const { cursors, wasd } = this

    if (!this.dialogActive) {
      if (cursors.up.isDown || wasd.up.isDown)    this.tryMove( 0, -1, 'up')
      if (cursors.down.isDown || wasd.down.isDown)  this.tryMove( 0,  1, 'down')
      if (cursors.left.isDown || wasd.left.isDown)  this.tryMove(-1,  0, 'left')
      if (cursors.right.isDown || wasd.right.isDown) this.tryMove( 1,  0, 'right')
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) ||
        Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      if (this.dialogActive) {
        this.advanceDialog()
      } else if (this.nearNPC) {
        this.showDialog(this.nearNPC.name, this.nearNPC.dialog)
      }
    }

    // Smoothly move companion toward target
    const speed = 0.18
    this.companion.x += (this.companion.targetX - this.companion.x) * speed
    this.companion.y += (this.companion.targetY - this.companion.y) * speed

    this.render(time)
  }

  render(time) {
    const gfx = this.gfx
    const uiGfx = this.uiGfx
    const W = this.scale.width
    const H = this.scale.height
    const T = TILE_SIZE

    gfx.clear()
    uiGfx.clear()

    // Sky gradient effect at top
    gfx.fillStyle(0x0A0A2A, 1)
    gfx.fillRect(0, 0, W, H)

    // === TILE MAP ===
    for (let ty = 0; ty < NEXUS_MAP.length; ty++) {
      for (let tx = 0; tx < NEXUS_MAP[ty].length; tx++) {
        const tile = NEXUS_MAP[ty][tx]
        const px = tx * T
        const py = ty * T

        const baseColor = TILE_COLORS[tile] || 0x333333

        gfx.fillStyle(baseColor, 1)
        gfx.fillRect(px, py, T, T)

        // Tile details
        switch (tile) {
          case NEXUS_TILE.TREE: {
            // Tree trunk
            gfx.fillStyle(0x5C3A1E, 1)
            gfx.fillRect(px + 11, py + 18, 10, 14)
            // Tree top (3 layers)
            gfx.fillStyle(0x1A5A0A, 1)
            gfx.fillEllipse(px + 16, py + 14, 26, 22)
            gfx.fillStyle(0x2A7A1A, 1)
            gfx.fillEllipse(px + 16, py + 8, 22, 18)
            gfx.fillStyle(0x3A8A2A, 1)
            gfx.fillEllipse(px + 16, py + 4, 16, 14)
            // Highlight
            gfx.fillStyle(0x88BB44, 0.4)
            gfx.fillEllipse(px + 12, py + 2, 8, 6)
            break
          }
          case NEXUS_TILE.PATH: {
            // Cobblestone pattern
            gfx.fillStyle(0x777060, 0.4)
            gfx.fillRect(px + 2, py + 2, 12, 12)
            gfx.fillRect(px + 16, py + 2, 12, 12)
            gfx.fillRect(px + 2, py + 16, 12, 12)
            gfx.fillRect(px + 16, py + 16, 12, 12)
            gfx.lineStyle(1, 0x666050, 0.5)
            gfx.strokeRect(px + 2, py + 2, 12, 12)
            gfx.strokeRect(px + 16, py + 2, 12, 12)
            gfx.strokeRect(px + 2, py + 16, 12, 12)
            gfx.strokeRect(px + 16, py + 16, 12, 12)
            break
          }
          case NEXUS_TILE.BUILDING: {
            // Building wall details
            gfx.fillStyle(0x8A7050, 1)
            gfx.fillRect(px + 4, py + 4, T - 8, T - 8)
            gfx.fillStyle(0x5A4020, 1)
            gfx.fillRect(px + 8, py + 8, T - 16, T - 16)
            // Window
            gfx.fillStyle(0xFFDD88, 0.6)
            gfx.fillRect(px + 10, py + 10, 12, 10)
            gfx.lineStyle(1, 0x4A3010, 1)
            gfx.strokeRect(px + 10, py + 10, 12, 10)
            break
          }
          case NEXUS_TILE.WATER: {
            // Animated water ripples
            const wave = Math.sin(time * 0.002 + tx * 0.5 + ty * 0.3)
            gfx.fillStyle(0x3388CC, 0.3 + wave * 0.1)
            gfx.fillRect(px + 2, py + 10 + wave * 2, T - 4, 4)
            gfx.fillStyle(0x55AAEE, 0.2)
            gfx.fillRect(px + 4, py + 18 - wave * 2, T - 8, 3)
            break
          }
          case NEXUS_TILE.TALL_GRASS: {
            // Swaying grass blades
            const sway = Math.sin(time * 0.002 + tx * 1.2) * 2
            gfx.fillStyle(0x4AA444, 1)
            for (let g = 3; g < T - 3; g += 6) {
              gfx.fillRect(px + g + sway, py + T / 2, 2, T / 2 - 2)
              gfx.fillRect(px + g + 2 - sway, py + T / 2 + 4, 2, T / 2 - 6)
            }
            break
          }
          case NEXUS_TILE.CORE_ORB: {
            // Mystical floor
            const orbGlow = Math.sin(time * 0.003) * 0.2 + 0.3
            gfx.fillStyle(0x0022AA, orbGlow)
            gfx.fillRect(px, py, T, T)
            gfx.fillStyle(0x4488FF, 0.2)
            gfx.fillRect(px + 4, py + 4, T - 8, T - 8)
            // Hex grid lines
            gfx.lineStyle(1, 0x2244AA, 0.4)
            gfx.strokeRect(px + 2, py + 2, T - 4, T - 4)
            break
          }
          case NEXUS_TILE.CAVE_ENTRY: {
            // Cave entrance
            gfx.fillStyle(0x111111, 1)
            gfx.fillEllipse(px + T / 2, py + T * 0.7, T - 6, T * 1.2)
            // Stalactites
            gfx.fillStyle(0x444444, 1)
            gfx.fillTriangle(px + 8, py, px + 12, py + 10, px + 4, py + 10)
            gfx.fillTriangle(px + 18, py, px + 22, py + 8, px + 14, py + 8)
            break
          }
          case NEXUS_TILE.FENCE: {
            gfx.fillStyle(0x9B8B6B, 1)
            gfx.fillRect(px + 2, py + 10, T - 4, 4)
            gfx.fillRect(px + 2, py + 18, T - 4, 4)
            gfx.fillRect(px + 4, py + 8, 4, 16)
            gfx.fillRect(px + 24, py + 8, 4, 16)
            break
          }
          case NEXUS_TILE.FLOWER: {
            // Flower clusters
            gfx.fillStyle(0xFF88AA, 1)
            gfx.fillRect(px + 8, py + 16, 4, 4)
            gfx.fillRect(px + 18, py + 12, 4, 4)
            gfx.fillStyle(0xFFCC44, 1)
            gfx.fillRect(px + 14, py + 18, 4, 4)
            gfx.fillStyle(0xAA88FF, 1)
            gfx.fillRect(px + 6, py + 8, 4, 4)
            gfx.fillStyle(0x2D8A2D, 1)
            gfx.fillRect(px + 8, py + 20, 2, 6)
            gfx.fillRect(px + 18, py + 16, 2, 6)
            gfx.fillRect(px + 14, py + 22, 2, 6)
            break
          }
          default: {
            // Simple tile grid
            gfx.lineStyle(1, 0x000000, 0.05)
            gfx.strokeRect(px, py, T, T)
          }
        }
      }
    }

    // === CORE ORB (center of map) ===
    MonsterRenderer.drawCoreOrb(gfx, 10 * T, 7 * T, 28, time)

    // === NPCS ===
    for (const npc of NPCS) {
      const px = npc.tx * T + T / 2
      const py = npc.ty * T + T / 2
      const bobY = Math.sin(time * 0.003 + npc.tx) * 2

      // Shadow
      gfx.fillStyle(0x000000, 0.2)
      gfx.fillEllipse(px, py + 10, 14, 5)

      // Body
      gfx.fillStyle(npc.color, 1)
      gfx.fillEllipse(px, py - 2 + bobY, 14, 14)

      // Head
      gfx.fillStyle(0xF5CBA7, 1)
      gfx.fillEllipse(px, py - 12 + bobY, 12, 12)

      // Name
      gfx.fillStyle(0x000000, 0.5)
      gfx.fillRect(px - 20, py - 28 + bobY, 40, 12)
      gfx.fillStyle(0xFFFFFF, 0.9)
    }

    // === COMPANION (monster follows player) ===
    const monster = window.CRIAS?.monster
    if (monster) {
      const bobY = Math.sin(time * 0.003) * 3
      // Companion shadow
      gfx.fillStyle(0x000000, 0.25)
      gfx.fillEllipse(this.companion.x, this.companion.y + 26, 28, 8)
      // Draw companion monster at small scale
      MonsterRenderer.drawMonster(gfx, monster.species, this.companion.x, this.companion.y + bobY, 0.85, this.player.facing, false)
      // Small aura glow
      gfx.fillStyle(0x4488FF, 0.07)
      gfx.fillCircle(this.companion.x, this.companion.y + bobY, 22)
    }

    // === PLAYER ===
    const px = this.player.tx * T + T / 2
    const py = this.player.ty * T + T / 2
    MonsterRenderer.drawPlayer(gfx, px, py, this.player.facing, this.player.walkFrame)

    // === HUD (top bar) ===
    const user = window.CRIAS?.user

    if (monster && user) {
      // HUD background
      uiGfx.fillStyle(0x000000, 0.75)
      uiGfx.fillRect(0, 0, W, 42)
      uiGfx.lineStyle(1, 0x00d4ff, 0.4)
      uiGfx.strokeRect(0, 0, W, 42)

      // Monster name panel
      uiGfx.fillStyle(0x00d4ff, 0.08)
      uiGfx.fillRect(4, 4, 180, 34)
      uiGfx.lineStyle(1, 0x00d4ff, 0.3)
      uiGfx.strokeRect(4, 4, 180, 34)

      // HP + XP bars
      BattleLogic.drawHPBar(uiGfx, 210, 16, 140, monster.hp, monster.maxHp)
      BattleLogic.drawXPBar(uiGfx, 210, 26, 140, monster.xp, monster.xpToNextLevel)

      // Remove old HUD texts and re-add (cheap but works for pixel-exact rendering)
      if (this.hudTexts) this.hudTexts.forEach(t => t.destroy())
      this.hudTexts = []

      this.hudTexts.push(
        this.add.text(10, 10, user.username.toUpperCase(), {
          fontFamily: FONT_NEXUS, fontSize: '8px', color: '#00d4ff',
        }).setScrollFactor(0).setDepth(11)
      )
      this.hudTexts.push(
        this.add.text(10, 24, `${monster.species}  Lv.${monster.level}`, {
          fontFamily: FONT_NEXUS, fontSize: '7px', color: '#7EC8E3',
        }).setScrollFactor(0).setDepth(11)
      )
      this.hudTexts.push(
        this.add.text(210, 30, `XP ${monster.xp}/${monster.xpToNextLevel}`, {
          fontFamily: FONT_NEXUS, fontSize: '6px', color: '#4488FF',
        }).setScrollFactor(0).setDepth(11)
      )
      this.hudTexts.push(
        this.add.text(210, 8, `HP ${monster.hp}/${monster.maxHp}`, {
          fontFamily: FONT_NEXUS, fontSize: '7px', color: monster.hp / monster.maxHp > 0.5 ? '#44FF44' : monster.hp / monster.maxHp > 0.25 ? '#FFCC00' : '#FF4444',
        }).setScrollFactor(0).setDepth(11)
      )
    }

    // === MINIMAP indicator ===
    const mmX = W - 48
    const mmY = 40
    uiGfx.fillStyle(0x000000, 0.7)
    uiGfx.fillRect(mmX, mmY, 44, 44)
    uiGfx.lineStyle(1, 0x4488AA, 0.6)
    uiGfx.strokeRect(mmX, mmY, 44, 44)

    // Draw minimap tiles
    const mmScale = 44 / Math.max(NEXUS_MAP[0].length, NEXUS_MAP.length)
    for (let ty = 0; ty < NEXUS_MAP.length; ty++) {
      for (let tx2 = 0; tx2 < NEXUS_MAP[ty].length; tx2++) {
        const t2 = NEXUS_MAP[ty][tx2]
        const col = t2 === NEXUS_TILE.TREE ? 0x1A4A0A
          : t2 === NEXUS_TILE.BUILDING ? 0x6B5A3A
          : t2 === NEXUS_TILE.WATER ? 0x2266AA
          : t2 === NEXUS_TILE.CAVE_ENTRY ? 0x222222
          : t2 === NEXUS_TILE.CORE_ORB ? 0x4488FF
          : 0x2D6A2D
        const cx = mmX + tx2 * mmScale
        const cy = mmY + ty * mmScale
        uiGfx.fillStyle(col, 1)
        uiGfx.fillRect(cx, cy, mmScale + 0.5, mmScale + 0.5)
      }
    }

    // Player dot on minimap
    uiGfx.fillStyle(0xFF4444, 1)
    uiGfx.fillRect(
      mmX + this.player.tx * mmScale,
      mmY + this.player.ty * mmScale,
      mmScale + 1, mmScale + 1
    )

    // NPC labels (drawn as text using scene text objects — we draw simple markers)
    for (const npc of NPCS) {
      uiGfx.fillStyle(0xFFFFFF, 0.7)
      uiGfx.fillRect(mmX + npc.tx * mmScale, mmY + npc.ty * mmScale, 2, 2)
    }
  }

  shutdown() {
    const ui = document.getElementById('nexus-hint-ui')
    if (ui) ui.remove()
    const dialog = document.getElementById('nexus-dialog')
    if (dialog) dialog.remove()
  }
}
