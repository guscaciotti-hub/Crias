// ============================================================
// CRIAS — Core Orb Scene
// Monster birth / awakening sequence
// Shows after first login (matching original CoreOrbScene concept)
// ============================================================

const FONT_CORB = '"Press Start 2P", monospace'

class CoreOrbScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CoreOrbScene' })
    this.phase = 'charging'  // charging → burst → reveal → stats → done
    this.phaseTimer = 0
    this.particles = []
    this.burstParticles = []
    this.monsterAlpha = 0
    this.textObjs = []
    this.gfx = null
    this.stars = []
  }

  create() {
    this.gfx = this.add.graphics()

    // Stars
    for (let i = 0; i < 100; i++) {
      this.stars.push({
        x: Math.random() * this.scale.width,
        y: Math.random() * this.scale.height,
        r: Math.random() * 1.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
      })
    }

    // Particles for charging effect
    for (let i = 0; i < 60; i++) {
      const angle = Math.random() * Math.PI * 2
      const dist = 80 + Math.random() * 120
      this.particles.push({
        angle, dist,
        speed: (0.3 + Math.random() * 0.7) * (Math.random() < 0.5 ? 1 : -1),
        r: Math.random() * 2 + 1,
        color: [0x00BFFF, 0x4488FF, 0xAADDFF, 0x00FFFF][Math.floor(Math.random() * 4)],
      })
    }

    // Phase transition timers
    this.time.delayedCall(1500, () => { this.phase = 'burst'; this.triggerBurst() })
    this.time.delayedCall(2500, () => { this.phase = 'reveal' })
    this.time.delayedCall(4000, () => { this.phase = 'stats'; this.showStats() })
  }

  triggerBurst() {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2, cy = H * 0.42

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 2 + Math.random() * 5
      this.burstParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.02,
        r: Math.random() * 3 + 1,
        color: [0x00FFFF, 0x4488FF, 0xFFFFFF, 0x00BFFF][Math.floor(Math.random() * 4)],
      })
    }
  }

  showStats() {
    const W = this.scale.width
    const H = this.scale.height
    const monster = window.CRIAS?.monster
    const user = window.CRIAS?.user
    if (!monster) return

    // Remove existing texts
    this.textObjs.forEach(t => t.destroy())
    this.textObjs = []

    const rarityColors = {
      Common: '#AAAAAA', Rare: '#4488FF', Epic: '#AA44FF',
      Legendary: '#FFAA00', Mythic: '#FF0055',
    }
    const rarityColor = rarityColors[monster.rarity] || '#FFFFFF'

    // Welcome
    this.textObjs.push(
      this.add.text(W / 2, H * 0.06, `CORE ORB ATIVADO`, {
        fontFamily: FONT_CORB, fontSize: '10px', color: '#00d4ff',
        stroke: '#001a33', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(10)
    )

    // Monster name with rarity glow
    this.textObjs.push(
      this.add.text(W / 2, H * 0.13, monster.species.toUpperCase(), {
        fontFamily: FONT_CORB, fontSize: '20px', color: rarityColor,
        stroke: '#000000', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(10)
    )

    // Rarity badge
    this.textObjs.push(
      this.add.text(W / 2, H * 0.2, `[ ${monster.rarity.toUpperCase()} ]`, {
        fontFamily: FONT_CORB, fontSize: '9px', color: rarityColor,
      }).setOrigin(0.5).setDepth(10)
    )

    // Stats grid
    const statLines = [
      `ELEMENTO  : ${monster.element}`,
      `PERSONALIDADE : ${monster.personality}`,
      `HP        : ${monster.maxHp}`,
      `ATK       : ${monster.attack}`,
      `DEF       : ${monster.defense}`,
      `VEL       : ${monster.speed}`,
    ]
    statLines.forEach((line, i) => {
      this.textObjs.push(
        this.add.text(W * 0.2, H * 0.71 + i * 20, line, {
          fontFamily: FONT_CORB, fontSize: '7px', color: '#7EC8E3',
        }).setDepth(10)
      )
    })

    // Seed (uniqueness)
    this.textObjs.push(
      this.add.text(W / 2, H * 0.88, `SEED: ${monster.seed.substring(0, 16)}...`, {
        fontFamily: FONT_CORB, fontSize: '6px', color: '#334466',
      }).setOrigin(0.5).setDepth(10)
    )

    // Continue button
    const btn = this.add.text(W / 2, H * 0.94, '► ENTRAR NO NEXUS', {
      fontFamily: FONT_CORB, fontSize: '9px', color: '#00d4ff',
      backgroundColor: '#0d1528',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10)

    btn.on('pointerover', () => btn.setStyle({ color: '#ffffff', backgroundColor: '#00d4ff22' }))
    btn.on('pointerout', () => btn.setStyle({ color: '#00d4ff', backgroundColor: '#0d1528' }))
    btn.on('pointerdown', () => this.enterNexus())

    // Also space/enter
    this.input.keyboard.once('keydown-SPACE', () => this.enterNexus())
    this.input.keyboard.once('keydown-ENTER', () => this.enterNexus())

    this.textObjs.push(btn)
  }

  enterNexus() {
    const flash = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0xFFFFFF
    ).setAlpha(0).setDepth(100)

    this.tweens.add({
      targets: flash, alpha: 1, duration: 500,
      onComplete: () => {
        this.textObjs.forEach(t => { if (t?.destroy) t.destroy() })
        this.scene.start('NexusScene')
      }
    })
  }

  update(time, delta) {
    const W = this.scale.width
    const H = this.scale.height
    const cx = W / 2
    const cy = H * 0.42
    const t = time * 0.001

    this.gfx.clear()

    // Background
    this.gfx.fillStyle(0x020210, 1)
    this.gfx.fillRect(0, 0, W, H)

    // Nebula
    this.gfx.fillStyle(0x0A0A40, 0.25)
    this.gfx.fillEllipse(W * 0.4, H * 0.5, 500, 350)
    this.gfx.fillStyle(0x001A40, 0.15)
    this.gfx.fillEllipse(W * 0.6, H * 0.4, 400, 280)

    // Stars
    for (const s of this.stars) {
      const alpha = 0.3 + Math.sin(s.phase + t * 0.8) * 0.3
      this.gfx.fillStyle(0xAADDFF, alpha)
      this.gfx.fillRect(s.x, s.y, s.r * 2, s.r * 2)
    }

    // Charging particles orbiting the orb
    if (this.phase === 'charging') {
      const orbRadius = 50 + Math.sin(t * 3) * 5
      for (const p of this.particles) {
        p.angle += 0.02 * p.speed
        const currentDist = p.dist * (0.3 + Math.sin(p.angle * 0.5) * 0.7)
        const px = cx + Math.cos(p.angle) * currentDist
        const py = cy + Math.sin(p.angle) * currentDist * 0.6
        const alpha = 0.4 + Math.sin(t * 3 + p.angle) * 0.3
        this.gfx.fillStyle(p.color, alpha)
        this.gfx.fillRect(px - p.r, py - p.r, p.r * 2, p.r * 2)
      }

      MonsterRenderer.drawCoreOrb(this.gfx, cx, cy, orbRadius, time)
    }

    // Burst particles
    if (this.phase === 'burst' || this.phase === 'reveal') {
      for (const p of this.burstParticles) {
        if (p.life <= 0) continue
        p.x += p.vx
        p.y += p.vy
        p.life -= p.decay
        this.gfx.fillStyle(p.color, p.life * 0.8)
        this.gfx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)
      }
    }

    // Expanding ring on burst
    if (this.phase === 'burst') {
      const burstProgress = Math.min(1, (time - this.phaseTimer) / 800)
      const ringR = 60 + burstProgress * 150
      this.gfx.lineStyle(3, 0x00BFFF, (1 - burstProgress) * 0.8)
      this.gfx.strokeCircle(cx, cy, ringR)
      this.gfx.lineStyle(2, 0xFFFFFF, (1 - burstProgress) * 0.4)
      this.gfx.strokeCircle(cx, cy, ringR * 0.7)
    }

    // Monster reveal
    if (this.phase === 'reveal' || this.phase === 'stats') {
      const monster = window.CRIAS?.monster
      if (monster) {
        this.monsterAlpha = Math.min(1, this.monsterAlpha + 0.02)

        // Aura glow
        this.gfx.fillStyle(0x00BFFF, 0.1 * this.monsterAlpha)
        this.gfx.fillCircle(cx, cy, 80)
        this.gfx.fillStyle(0x4488FF, 0.06 * this.monsterAlpha)
        this.gfx.fillCircle(cx, cy, 110)

        // Draw monster (slightly transparent until fully revealed)
        const savedAlpha = this.gfx.defaultFillAlpha
        this.gfx.setAlpha(this.monsterAlpha)
        MonsterRenderer.drawMonster(this.gfx, monster.species, cx, cy, 3, 'right', false)
        this.gfx.setAlpha(1)

        // Bob animation
        const bobY = Math.sin(t * 2) * 4
        MonsterRenderer.drawMonster(this.gfx, monster.species, cx, cy + bobY, 3, 'right', false)
      }
    }

    // Stats phase: still show monster with orb glow
    if (this.phase === 'stats') {
      const monster = window.CRIAS?.monster
      if (monster) {
        const bobY = Math.sin(t * 2) * 4
        // Dim orb under monster
        MonsterRenderer.drawCoreOrb(this.gfx, cx + 100, cy - 30, 15, time)
        MonsterRenderer.drawMonster(this.gfx, monster.species, W * 0.72, H * 0.42 + bobY, 2.5, 'right', false)
      }
    }
  }

  shutdown() {
    this.textObjs.forEach(t => { if (t?.destroy) t.destroy() })
    this.textObjs = []
  }
}
