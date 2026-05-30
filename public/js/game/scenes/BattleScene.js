// ============================================================
// CRIAS — Battle Scene
// Pokémon GBA style turn-based combat
// ============================================================

const FONT = '"Press Start 2P", monospace'

class BattleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BattleScene' })
    this.battleState = null
    this.menuState = 'main'   // 'main' | 'fight' | 'result'
    this.selectedMove = 0
    this.animating = false
    this.texts = {}
    this.gfxObjects = {}
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    this.gfx = this.add.graphics()
    this.uiGfx = this.add.graphics()

    // Load battle state from global
    this.battleState = window.CRIAS?.battle
    this.playerMonster = window.CRIAS?.monster

    if (!this.battleState || !this.playerMonster) {
      this.scene.start('NexusScene')
      return
    }

    this.playerHp = this.battleState.playerCurrentHp
    this.wildHp = this.battleState.wildCurrentHp
    this.logLines = [...this.battleState.log]
    this.currentLogIdx = 0

    this.cursors = this.input.keyboard.createCursorKeys()
    this.confirmKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER)

    // Build all static UI
    this.buildStaticUI()
    this.updateDynamicUI()
    this.showMainMenu()

    // Intro: show first log message
    this.showBattleText(this.logLines[0] || 'Battle started!', () => {
      this.currentLogIdx = 1
    })
  }

  buildStaticUI() {
    const W = this.scale.width
    const H = this.scale.height

    // BACKGROUND — battle arena
    this.gfx.fillStyle(0x0D1B0D, 1)
    this.gfx.fillRect(0, 0, W, H)

    // Ground strips (retro arena look)
    this.gfx.fillStyle(0x1A2E1A, 1)
    this.gfx.fillRect(0, H * 0.5, W, H * 0.25)
    this.gfx.fillStyle(0x1E361E, 1)
    this.gfx.fillRect(0, H * 0.55, W, H * 0.15)

    // Sky gradient
    this.gfx.fillStyle(0x050810, 1)
    this.gfx.fillRect(0, 0, W, H * 0.52)

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * W
      const sy = Math.random() * H * 0.4
      const sr = Math.random() * 1.5 + 0.5
      this.gfx.fillStyle(0xAADDFF, Math.random() * 0.5 + 0.2)
      this.gfx.fillRect(sx, sy, sr * 2, sr * 2)
    }

    // Wild monster platform (top right)
    this.gfx.fillStyle(0x1A3A1A, 1)
    this.gfx.fillEllipse(W * 0.72, H * 0.38, 100, 20)

    // Player platform (bottom left)
    this.gfx.fillStyle(0x1A3A1A, 1)
    this.gfx.fillEllipse(W * 0.28, H * 0.62, 100, 20)
  }

  updateDynamicUI() {
    const W = this.scale.width
    const H = this.scale.height

    // Clear dynamic graphics layer
    this.uiGfx.clear()

    const battle = this.battleState
    const player = this.playerMonster
    const wild = battle.wildMonster

    // =====================
    // ENEMY STATUS PANEL (top left)
    // =====================
    BattleLogic.drawStatusPanel(this.uiGfx, 12, 12, 220, 60, false)

    // Enemy name + rarity
    const rarityLabel = BattleLogic.getRarityLabel(wild.rarity)
    if (rarityLabel) {
      this.uiGfx.fillStyle(BattleLogic.getRarityColor(wild.rarity), 1)
      this.uiGfx.fillRect(14, 14, 2, 56)
    }

    // HP bar
    BattleLogic.drawHPBar(this.uiGfx, 20, 54, 190, this.wildHp, wild.maxHp)

    // XP bar (decorative for wild)
    this.uiGfx.fillStyle(0x111122, 1)
    this.uiGfx.fillRect(20, 62, 190, 3)

    // =====================
    // PLAYER STATUS PANEL (bottom right)
    // =====================
    BattleLogic.drawStatusPanel(this.uiGfx, W - 232, H - 100, 220, 70, true)

    // HP bar
    BattleLogic.drawHPBar(this.uiGfx, W - 224, H - 50, 190, this.playerHp, player.maxHp)

    // XP bar
    BattleLogic.drawXPBar(this.uiGfx, W - 224, H - 38, 190, player.xp, player.xpToNextLevel)

    // =====================
    // MONSTER SPRITES
    // =====================
    // Wild monster (top right, facing left / enemy)
    MonsterRenderer.drawMonster(this.uiGfx, wild.species, W * 0.72, H * 0.3, 2, 'right', true)

    // Player monster (bottom left, facing right)
    MonsterRenderer.drawMonster(this.uiGfx, player.species, W * 0.28, H * 0.54, 2.5, 'right', false)

    // Render all text
    this.renderBattleTexts()
  }

  renderBattleTexts() {
    // Remove existing text objects
    Object.values(this.texts).forEach(t => { if (t && t.destroy) t.destroy() })
    this.texts = {}

    const W = this.scale.width
    const H = this.scale.height
    const battle = this.battleState
    const player = this.playerMonster
    const wild = battle.wildMonster

    // Enemy name
    this.texts.wildName = this.add.text(20, 18, wild.species.toUpperCase(), {
      fontFamily: FONT, fontSize: '9px', color: '#FFFFFF',
    }).setDepth(5)

    // Enemy level
    this.texts.wildLevel = this.add.text(180, 18, `Lv.${wild.level}`, {
      fontFamily: FONT, fontSize: '8px', color: '#AAAAAA',
    }).setDepth(5)

    // Enemy HP text
    this.texts.wildHpText = this.add.text(20, 38, `HP ${this.wildHp}/${wild.maxHp}`, {
      fontFamily: FONT, fontSize: '7px', color: '#88FF88',
    }).setDepth(5)

    // Enemy rarity badge
    if (wild.rarity !== 'Common') {
      this.texts.wildRarity = this.add.text(20, 28, BattleLogic.getRarityLabel(wild.rarity), {
        fontFamily: FONT, fontSize: '7px',
        color: '#' + BattleLogic.getRarityColor(wild.rarity).toString(16).padStart(6, '0'),
      }).setDepth(5)
    }

    // Player monster name
    this.texts.playerName = this.add.text(W - 226, H - 94, player.species.toUpperCase(), {
      fontFamily: FONT, fontSize: '9px', color: '#FFFFFF',
    }).setDepth(5)

    // Player level
    this.texts.playerLevel = this.add.text(W - 80, H - 94, `Lv.${player.level}`, {
      fontFamily: FONT, fontSize: '8px', color: '#AAAAAA',
    }).setDepth(5)

    // Player HP numbers
    const hpColor = this.playerHp / player.maxHp > 0.5 ? '#44FF44'
      : this.playerHp / player.maxHp > 0.25 ? '#FFCC00' : '#FF4444'
    this.texts.playerHpText = this.add.text(
      W - 226, H - 56, `HP  ${this.playerHp}/${player.maxHp}`,
      { fontFamily: FONT, fontSize: '7px', color: hpColor }
    ).setDepth(5)

    // Player XP text
    this.texts.playerXpText = this.add.text(
      W - 226, H - 44, `XP  ${player.xp}/${player.xpToNextLevel}`,
      { fontFamily: FONT, fontSize: '6px', color: '#4488FF' }
    ).setDepth(5)
  }

  // ============================================================
  // BATTLE TEXT BOX
  // ============================================================
  showBattleText(text, onDone) {
    // Remove existing
    const old = document.getElementById('battle-textbox')
    if (old) old.remove()

    const W = this.scale.width
    const H = this.scale.height

    const box = document.createElement('div')
    box.id = 'battle-textbox'
    box.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${H * 0.32}px;
      background: rgba(5,8,16,0.96);
      border-top: 3px solid #00d4ff;
      padding: 18px 24px;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      color: #e0f7ff;
      line-height: 2;
      display: flex;
      align-items: center;
      box-shadow: 0 -4px 20px rgba(0,212,255,0.2);
      pointer-events: all;
      cursor: pointer;
    `

    const inner = document.createElement('div')
    inner.style.width = '100%'
    inner.innerHTML = `<span>${text}</span>
      <div style="float:right;color:#4488AA;font-size:8px;margin-top:4px;">▼</div>`

    box.appendChild(inner)
    document.getElementById('game-container').appendChild(box)

    // Typewriter effect
    const span = inner.querySelector('span')
    let i = 0
    span.textContent = ''
    const iv = setInterval(() => {
      span.textContent += text[i++]
      if (i >= text.length) {
        clearInterval(iv)
        if (onDone) {
          box.addEventListener('click', () => { box.remove(); onDone() }, { once: true })
        }
      }
    }, 22)

    return box
  }

  removeTextBox() {
    const box = document.getElementById('battle-textbox')
    if (box) box.remove()
  }

  // ============================================================
  // MENUS
  // ============================================================

  removeMenu() {
    const m = document.getElementById('battle-menu')
    if (m) m.remove()
  }

  showMainMenu() {
    this.removeMenu()
    this.removeTextBox()
    this.menuState = 'main'

    const W = this.scale.width
    const H = this.scale.height
    const player = this.playerMonster
    const wild = this.battleState.wildMonster

    const menu = document.createElement('div')
    menu.id = 'battle-menu'
    menu.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${H * 0.32}px;
      display: flex;
      font-family: 'Press Start 2P', monospace;
      pointer-events: all;
    `

    // Left: text area
    const textArea = document.createElement('div')
    textArea.style.cssText = `
      flex: 1;
      background: rgba(5,8,16,0.96);
      border-top: 3px solid #00d4ff;
      display: flex;
      align-items: center;
      padding: 20px 24px;
      font-size: 10px;
      color: #e0f7ff;
      line-height: 2;
    `
    textArea.textContent = `O que ${player.species} vai fazer?`

    // Right: action buttons
    const btnArea = document.createElement('div')
    btnArea.style.cssText = `
      width: 200px;
      background: rgba(8,12,24,0.98);
      border-top: 3px solid #00d4ff;
      border-left: 2px solid #0044AA;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      padding: 8px;
    `

    const actions = [
      { label: 'LUTAR', color: '#FF4444', onClick: () => this.showFightMenu() },
      { label: 'FUGIR', color: '#AAAAAA', onClick: () => this.handleFlee() },
    ]

    for (const a of actions) {
      const btn = document.createElement('button')
      btn.textContent = a.label
      btn.style.cssText = `
        background: rgba(0,0,0,0.8);
        border: 2px solid ${a.color}44;
        color: ${a.color};
        font-family: 'Press Start 2P', monospace;
        font-size: 9px;
        padding: 10px 4px;
        cursor: pointer;
        transition: all 0.1s;
      `
      btn.onmouseover = () => {
        btn.style.background = `${a.color}22`
        btn.style.borderColor = a.color
        btn.style.boxShadow = `0 0 8px ${a.color}44`
      }
      btn.onmouseout = () => {
        btn.style.background = 'rgba(0,0,0,0.8)'
        btn.style.borderColor = `${a.color}44`
        btn.style.boxShadow = 'none'
      }
      btn.onclick = a.onClick
      btnArea.appendChild(btn)
    }

    menu.appendChild(textArea)
    menu.appendChild(btnArea)
    document.getElementById('game-container').appendChild(menu)
  }

  showFightMenu() {
    this.removeMenu()
    this.menuState = 'fight'

    const H = this.scale.height
    const player = this.playerMonster
    const skills = player.activeSkills || []

    const menu = document.createElement('div')
    menu.id = 'battle-menu'
    menu.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${H * 0.32}px;
      display: flex;
      font-family: 'Press Start 2P', monospace;
      pointer-events: all;
    `

    // Left: skill grid
    const skillGrid = document.createElement('div')
    skillGrid.style.cssText = `
      flex: 1;
      background: rgba(5,8,16,0.96);
      border-top: 3px solid #00d4ff;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      padding: 12px;
    `

    const ELEMENT_COLORS = {
      Air: '#7EC8E3', Electric: '#FFD700', Fire: '#FF4500',
      Water: '#00CED1', Earth: '#8B4513',
    }

    for (const skill of skills) {
      const btn = document.createElement('button')
      const elemColor = ELEMENT_COLORS[player.element] || '#AAAAFF'
      btn.style.cssText = `
        background: rgba(0,0,0,0.8);
        border: 2px solid ${elemColor}55;
        border-top: 3px solid ${elemColor};
        color: #FFFFFF;
        font-family: 'Press Start 2P', monospace;
        font-size: 8px;
        padding: 10px 6px;
        cursor: pointer;
        text-align: left;
        transition: all 0.1s;
      `
      btn.innerHTML = `<div style="color:${elemColor};margin-bottom:4px;">${skill}</div>
        <div style="color:#888;font-size:6px;">${player.element}</div>`

      btn.onmouseover = () => {
        btn.style.background = `${elemColor}22`
        btn.style.borderColor = elemColor
      }
      btn.onmouseout = () => {
        btn.style.background = 'rgba(0,0,0,0.8)'
        btn.style.borderColor = `${elemColor}55`
      }
      btn.onclick = () => this.handleFight(skill)
      skillGrid.appendChild(btn)
    }

    // Right: back button
    const back = document.createElement('div')
    back.style.cssText = `
      width: 100px;
      background: rgba(8,12,24,0.98);
      border-top: 3px solid #00d4ff;
      border-left: 2px solid #002244;
      display: flex;
      align-items: flex-end;
      padding: 12px;
    `
    const backBtn = document.createElement('button')
    backBtn.textContent = '← VOLTAR'
    backBtn.style.cssText = `
      background: none;
      border: 1px solid #444;
      color: #888;
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      padding: 8px;
      cursor: pointer;
      width: 100%;
    `
    backBtn.onclick = () => this.showMainMenu()
    back.appendChild(backBtn)

    menu.appendChild(skillGrid)
    menu.appendChild(back)
    document.getElementById('game-container').appendChild(menu)
  }

  showResultMenu(status) {
    this.removeMenu()
    this.menuState = 'result'

    const H = this.scale.height
    const menu = document.createElement('div')
    menu.id = 'battle-menu'
    menu.style.cssText = `
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: ${H * 0.32}px;
      background: rgba(5,8,16,0.96);
      border-top: 3px solid ${status === 'victory' ? '#44FF44' : '#FF4444'};
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Press Start 2P', monospace;
      pointer-events: all;
    `

    const continueBtn = document.createElement('button')
    continueBtn.textContent = status === 'victory' ? '▶ CONTINUAR' : '▶ RETORNAR AO NEXUS'
    continueBtn.style.cssText = `
      background: rgba(0,0,0,0.8);
      border: 2px solid ${status === 'victory' ? '#44FF44' : '#FF4444'};
      color: ${status === 'victory' ? '#44FF44' : '#FF4444'};
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      padding: 16px 24px;
      cursor: pointer;
    `
    continueBtn.onclick = () => this.endBattle(status)
    menu.appendChild(continueBtn)
    document.getElementById('game-container').appendChild(menu)
  }

  // ============================================================
  // BATTLE ACTIONS
  // ============================================================

  async handleFight(skillName) {
    if (this.animating) return
    this.animating = true
    this.removeMenu()
    this.removeTextBox()

    try {
      const result = await GameAPI.battleAction('fight', skillName)
      this.battleState = result

      // Update monster data from server
      if (result.status === 'victory') {
        const updatedMonster = await GameAPI.getMonster()
        if (updatedMonster) {
          window.CRIAS.monster = updatedMonster
          this.playerMonster = updatedMonster
        }
      }

      this.playerHp = result.playerCurrentHp
      this.wildHp = result.wildCurrentHp

      // Update visuals
      this.buildStaticUI()
      this.updateDynamicUI()

      // Show battle log sequentially
      const newLogs = result.log.slice(this.currentLogIdx)
      this.currentLogIdx = result.log.length
      this.animating = false

      this.showLogsSequentially(newLogs, () => {
        if (result.status === 'active') {
          this.showMainMenu()
        } else {
          this.showResultMenu(result.status)
        }
      })
    } catch (err) {
      this.animating = false
      this.showBattleText('Erro na batalha!', () => this.showMainMenu())
    }
  }

  async handleFlee() {
    if (this.animating) return
    this.animating = true
    this.removeMenu()
    this.removeTextBox()

    try {
      const result = await GameAPI.battleAction('flee')
      this.battleState = result
      this.animating = false

      if (result.status === 'fled') {
        this.showBattleText('Fugiu com sucesso!', () => this.endBattle('fled'))
      } else {
        this.playerHp = result.playerCurrentHp
        this.wildHp = result.wildCurrentHp
        this.buildStaticUI()
        this.updateDynamicUI()

        const newLogs = result.log.slice(this.currentLogIdx)
        this.currentLogIdx = result.log.length
        this.showLogsSequentially(newLogs, () => {
          if (result.status === 'active') {
            this.showMainMenu()
          } else {
            this.showResultMenu(result.status)
          }
        })
      }
    } catch (err) {
      this.animating = false
      this.showMainMenu()
    }
  }

  showLogsSequentially(logs, onDone) {
    if (!logs || logs.length === 0) { onDone?.(); return }
    let idx = 0
    const showNext = () => {
      if (idx >= logs.length) { onDone?.(); return }
      const box = this.showBattleText(logs[idx++], showNext)
      // Auto-advance after 2s if no click
      setTimeout(() => {
        const existing = document.getElementById('battle-textbox')
        if (existing === box) { box?.remove(); showNext() }
      }, 2500)
    }
    showNext()
  }

  endBattle(status) {
    this.shutdown()
    const returnScene = window.CRIAS?.returnScene || 'CaveScene'

    if (status === 'defeat') {
      this.scene.start('NexusScene')
    } else {
      // Restore position in cave
      if (window.CRIAS?.playerPos) {
        // Will be picked up by CaveScene
      }
      this.scene.start(returnScene)
    }
  }

  update() {
    // Keyboard navigation could be added here
  }

  shutdown() {
    this.removeMenu()
    this.removeTextBox()
    Object.values(this.texts).forEach(t => { if (t?.destroy) t.destroy() })
    this.texts = {}
  }
}

