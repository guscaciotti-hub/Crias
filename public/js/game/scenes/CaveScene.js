// ============================================================
// CRIAS — Cave Scene
// Dark cave with encounter zones — wild entity battles
// ============================================================

const CAVE_TILE = {
  ROCK:     0,  // wall / obstacle
  FLOOR:    1,  // cave floor (walkable)
  MOSS:     2,  // tall grass encounter zone (HIGH encounter rate)
  CRYSTAL:  3,  // glowing crystal decoration
  EXIT:     4,  // back to Nexus
  CHEST:    5,  // treasure (decoration for now)
}

// 20 × 15 cave map
const CAVE_MAP = [
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 ], // 0
  [ 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0 ], // 1
  [ 0, 1, 2, 2, 1, 0, 1, 1, 2, 2, 1, 2, 2, 1, 1, 0, 2, 2, 1, 0 ], // 2 encounters
  [ 0, 1, 2, 2, 1, 1, 1, 1, 2, 2, 1, 2, 2, 1, 1, 1, 2, 2, 1, 0 ], // 3
  [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0 ], // 4
  [ 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 0 ], // 5
  [ 0, 1, 1, 0, 0, 1, 2, 2, 1, 3, 3, 1, 2, 2, 0, 0, 1, 1, 1, 0 ], // 6
  [ 0, 1, 1, 1, 1, 1, 2, 2, 1, 3, 3, 1, 2, 2, 1, 1, 1, 1, 1, 0 ], // 7 encounters + crystals
  [ 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0 ], // 8
  [ 0, 1, 2, 1, 0, 0, 0, 1, 3, 3, 1, 1, 0, 0, 0, 1, 2, 1, 1, 0 ], // 9
  [ 0, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 0 ], // 10
  [ 0, 1, 1, 1, 1, 2, 2, 1, 1, 5, 1, 1, 2, 2, 1, 1, 1, 1, 1, 0 ], // 11 chest
  [ 0, 1, 1, 0, 0, 0, 0, 1, 2, 2, 1, 2, 2, 1, 0, 0, 0, 1, 1, 0 ], // 12
  [ 0, 1, 1, 0, 0, 0, 0, 1, 2, 2, 1, 2, 2, 1, 0, 0, 0, 1, 1, 0 ], // 13 encounters
  [ 0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0 ], // 14 exit
]

const CAVE_ENCOUNTER_RATE = 0.35  // 35% chance per moss step
const TILE_SIZE = 32

class CaveScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CaveScene' })
    this.player = { tx: 9, ty: 1, facing: 'down', moving: false, walkFrame: 0 }
    this.gfx = null
    this.uiGfx = null
    this.encounterFlash = 0
    this.crystals = []
    this.hintUI = null
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

    // Pre-compute crystal positions for glow animation
    for (let ty = 0; ty < CAVE_MAP.length; ty++) {
      for (let tx = 0; tx < CAVE_MAP[ty].length; tx++) {
        if (CAVE_MAP[ty][tx] === CAVE_TILE.CRYSTAL) {
          this.crystals.push({
            x: tx * TILE_SIZE + TILE_SIZE / 2,
            y: ty * TILE_SIZE + TILE_SIZE / 2,
            phase: Math.random() * Math.PI * 2,
          })
        }
      }
    }

    // Hint UI
    const ui = document.createElement('div')
    ui.id = 'cave-hint-ui'
    ui.style.cssText = `
      position: absolute;
      bottom: 12px; left: 50%;
      transform: translateX(-50%);
      pointer-events: none;
      font-family: 'Courier New', monospace;
      font-size: 0.65rem;
      color: #AA88FF;
      letter-spacing: 0.15rem;
      text-shadow: 0 0 6px #8844FF;
      display: none;
    `
    document.getElementById('game-container').appendChild(ui)
    this.hintUI = ui
  }

  isWalkable(tx, ty) {
    if (ty < 0 || ty >= CAVE_MAP.length || tx < 0 || tx >= CAVE_MAP[0].length) return false
    const t = CAVE_MAP[ty][tx]
    return t !== CAVE_TILE.ROCK && t !== CAVE_TILE.CRYSTAL
  }

  tryMove(dx, dy, facing) {
    if (this.player.moving) return
    const nx = this.player.tx + dx
    const ny = this.player.ty + dy
    this.player.facing = facing

    if (!this.isWalkable(nx, ny)) return

    this.player.tx = nx
    this.player.ty = ny
    this.player.moving = true
    this.player.walkFrame++

    this.time.delayedCall(80, () => {
      this.player.moving = false
      this.checkTileEvent()
    })

    GameAPI.savePosition('cave', nx, ny)
  }

  checkTileEvent() {
    const { tx, ty } = this.player
    const tile = CAVE_MAP[ty]?.[tx]

    if (tile === CAVE_TILE.EXIT) {
      this.transitionTo('NexusScene')
      return
    }

    if (tile === CAVE_TILE.MOSS) {
      if (Math.random() < CAVE_ENCOUNTER_RATE) {
        this.triggerEncounter()
        return
      }
    }

    if (tile === CAVE_TILE.EXIT) {
      if (this.hintUI) {
        this.hintUI.textContent = '[ ENTER ] Return to Nexus'
        this.hintUI.style.display = 'block'
      }
    } else {
      if (this.hintUI) this.hintUI.style.display = 'none'
    }
  }

  triggerEncounter() {
    // Flash effect before battle
    this.encounterFlash = 6
    this.player.moving = true

    const flash = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0xFFFFFF
    ).setAlpha(0).setDepth(100)

    const tween = this.tweens.timeline({
      targets: flash,
      tweens: [
        { alpha: 0.8, duration: 100 },
        { alpha: 0.1, duration: 100 },
        { alpha: 0.8, duration: 100 },
        { alpha: 0.1, duration: 100 },
        { alpha: 1, duration: 200 },
      ],
      onComplete: async () => {
        // Start battle
        try {
          const battleData = await GameAPI.startBattle('cave')
          window.CRIAS = window.CRIAS || {}
          window.CRIAS.battle = battleData
          window.CRIAS.returnScene = 'CaveScene'
          window.CRIAS.playerPos = { tx: this.player.tx, ty: this.player.ty }
          this.shutdown()
          this.scene.start('BattleScene')
        } catch (err) {
          // Monster fainted or other error
          flash.destroy()
          this.player.moving = false
          if (err.message?.includes('fainted') || err.message?.includes('Nexus')) {
            this.transitionTo('NexusScene')
          }
        }
      }
    })
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
    const { cursors, wasd } = this

    if (!this.player.moving) {
      if (cursors.up.isDown || wasd.up.isDown)    this.tryMove( 0, -1, 'up')
      if (cursors.down.isDown || wasd.down.isDown)  this.tryMove( 0,  1, 'down')
      if (cursors.left.isDown || wasd.left.isDown)  this.tryMove(-1,  0, 'left')
      if (cursors.right.isDown || wasd.right.isDown) this.tryMove( 1,  0, 'right')
    }

    this.render(time)
  }

  render(time) {
    const gfx = this.gfx
    const uiGfx = this.uiGfx
    const W = this.scale.width
    const H = this.scale.height
    const T = TILE_SIZE
    const t = time * 0.001

    gfx.clear()
    uiGfx.clear()

    // Deep cave background
    gfx.fillStyle(0x050510, 1)
    gfx.fillRect(0, 0, W, H)

    // === CRYSTAL GLOW AMBIENT LIGHT ===
    for (const c of this.crystals) {
      const glow = Math.sin(t * 2 + c.phase) * 0.1 + 0.2
      gfx.fillStyle(0x8844FF, glow * 0.3)
      gfx.fillCircle(c.x, c.y, 40)
    }

    // === TILE MAP ===
    for (let ty = 0; ty < CAVE_MAP.length; ty++) {
      for (let tx = 0; tx < CAVE_MAP[ty].length; tx++) {
        const tile = CAVE_MAP[ty][tx]
        const px = tx * T
        const py = ty * T

        switch (tile) {
          case CAVE_TILE.ROCK: {
            // Rough rock wall
            gfx.fillStyle(0x1A1A1A, 1)
            gfx.fillRect(px, py, T, T)
            gfx.fillStyle(0x2A2A2A, 0.6)
            gfx.fillRect(px + 2, py + 2, T - 4, T - 4)
            // Rock texture lines
            gfx.fillStyle(0x333333, 0.4)
            gfx.fillRect(px + 4, py + 8, 8, 2)
            gfx.fillRect(px + 16, py + 18, 10, 2)
            gfx.fillRect(px + 6, py + 22, 6, 2)
            break
          }
          case CAVE_TILE.FLOOR: {
            // Dirt cave floor
            gfx.fillStyle(0x1E1410, 1)
            gfx.fillRect(px, py, T, T)
            // Pebble details
            gfx.fillStyle(0x2A1E18, 0.7)
            gfx.fillRect(px + 6, py + 14, 4, 3)
            gfx.fillRect(px + 20, py + 6, 3, 3)
            gfx.fillRect(px + 14, py + 22, 5, 3)
            break
          }
          case CAVE_TILE.MOSS: {
            // Moss / tall cave grass - encounter zone
            gfx.fillStyle(0x0D1A0D, 1)
            gfx.fillRect(px, py, T, T)
            // Swaying moss strands
            const sway = Math.sin(t * 1.5 + tx * 0.8 + ty * 0.5) * 2
            gfx.fillStyle(0x1A4A1A, 1)
            for (let g = 2; g < T - 2; g += 5) {
              gfx.fillRect(px + g + sway * 0.5, py + T / 2, 2, T / 2 - 2)
            }
            gfx.fillStyle(0x224422, 0.8)
            for (let g = 4; g < T - 4; g += 5) {
              gfx.fillRect(px + g - sway * 0.5, py + T / 2 + 4, 2, T / 2 - 6)
            }
            // Subtle glow (encounter zone indicator)
            gfx.fillStyle(0x226622, 0.15)
            gfx.fillRect(px, py, T, T)
            break
          }
          case CAVE_TILE.CRYSTAL: {
            // Cave floor base
            gfx.fillStyle(0x1E1410, 1)
            gfx.fillRect(px, py, T, T)
            // Crystal cluster
            const cGlow = Math.sin(t * 2.5 + tx + ty) * 0.3 + 0.7
            gfx.fillStyle(0x6622CC, cGlow)
            gfx.fillTriangle(px + 12, py + 28, px + 9, py + 8, px + 15, py + 8)
            gfx.fillTriangle(px + 18, py + 28, px + 16, py + 12, px + 21, py + 12)
            gfx.fillTriangle(px + 7, py + 28, px + 4, py + 14, px + 10, py + 14)
            // Crystal glow tips
            gfx.fillStyle(0xBB88FF, cGlow)
            gfx.fillRect(px + 10, py + 6, 4, 4)
            gfx.fillRect(px + 16, py + 10, 4, 4)
            gfx.fillRect(px + 4, py + 12, 4, 4)
            break
          }
          case CAVE_TILE.EXIT: {
            // Exit portal
            gfx.fillStyle(0x1E1410, 1)
            gfx.fillRect(px, py, T, T)
            const exitGlow = Math.sin(t * 3) * 0.2 + 0.6
            gfx.fillStyle(0x4488FF, exitGlow * 0.4)
            gfx.fillRect(px + 4, py + 4, T - 8, T - 8)
            gfx.lineStyle(2, 0x00BFFF, exitGlow)
            gfx.strokeRect(px + 4, py + 4, T - 8, T - 8)
            // Arrow up
            gfx.fillStyle(0x00BFFF, exitGlow)
            gfx.fillTriangle(px + T/2 - 6, py + 20, px + T/2 + 6, py + 20, px + T/2, py + 8)
            gfx.fillRect(px + T/2 - 3, py + 18, 6, 12)
            break
          }
          case CAVE_TILE.CHEST: {
            gfx.fillStyle(0x1E1410, 1)
            gfx.fillRect(px, py, T, T)
            // Chest box
            gfx.fillStyle(0x8B6914, 1)
            gfx.fillRect(px + 6, py + 14, 20, 14)
            gfx.fillStyle(0xB8860B, 1)
            gfx.fillRect(px + 6, py + 12, 20, 6)
            gfx.fillStyle(0xFFD700, 1)
            gfx.fillRect(px + 13, py + 18, 6, 5)
            gfx.fillRect(px + 14, py + 16, 4, 3)
            break
          }
        }
      }
    }

    // === PLAYER ===
    const px = this.player.tx * T + T / 2
    const py = this.player.ty * T + T / 2
    MonsterRenderer.drawPlayer(gfx, px, py, this.player.facing, this.player.walkFrame)

    // Lantern glow around player
    gfx.fillStyle(0xFFDD66, 0.08)
    gfx.fillCircle(px, py, 80)
    gfx.fillStyle(0xFFEE88, 0.05)
    gfx.fillCircle(px, py, 120)

    // === HUD ===
    const monster = window.CRIAS?.monster

    // Top bar
    uiGfx.fillStyle(0x000000, 0.8)
    uiGfx.fillRect(0, 0, W, 36)
    uiGfx.lineStyle(1, 0x8844FF, 0.6)
    uiGfx.strokeRect(0, 0, W, 36)

    if (monster) {
      BattleLogic.drawHPBar(uiGfx, 200, 20, 120, monster.hp, monster.maxHp)
      BattleLogic.drawXPBar(uiGfx, 200, 28, 120, monster.xp, monster.xpToNextLevel)
    }

    // Zone label
    uiGfx.fillStyle(0x8844FF, 0.15)
    uiGfx.fillRect(W - 120, 6, 116, 24)
    uiGfx.lineStyle(1, 0x8844FF, 0.5)
    uiGfx.strokeRect(W - 120, 6, 116, 24)

    // Danger indicator (moss tile highlight)
    const currentTile = CAVE_MAP[this.player.ty]?.[this.player.tx]
    if (currentTile === CAVE_TILE.MOSS) {
      uiGfx.fillStyle(0x226622, 0.3)
      uiGfx.fillRect(0, H - 8, W, 8)
      uiGfx.fillStyle(0x44AA44, 0.8)
      uiGfx.fillRect(0, H - 8, W, 2)
    }
  }

  shutdown() {
    const ui = document.getElementById('cave-hint-ui')
    if (ui) ui.remove()
  }
}
