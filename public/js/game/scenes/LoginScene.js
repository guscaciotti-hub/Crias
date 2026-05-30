// ============================================================
// CRIAS — Login / Register Scene
// Matches TitleScene + LoginScene + RegisterScene from Cursor
// ============================================================

const FONT_LOGIN = '"Press Start 2P", monospace'

class LoginScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LoginScene' })
    this.mode = 'title'  // 'title' | 'login' | 'register'
    this.stars = []
    this.gfx = null
    this.textObjs = []
    this.formEl = null
    this.loading = false
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    // Stars
    for (let i = 0; i < 50; i++) {
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.5 + 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 1.5 + 0.5,
      })
    }

    this.gfx = this.add.graphics()
    this.renderTitle()
  }

  clearTexts() {
    this.textObjs.forEach(t => { if (t?.destroy) t.destroy() })
    this.textObjs = []
    if (this.formEl) { this.formEl.remove(); this.formEl = null }
  }

  // ============================================================
  // TITLE SCREEN (TitleScene equivalent)
  // ============================================================
  renderTitle() {
    this.clearTexts()
    this.mode = 'title'

    const W = this.scale.width
    const H = this.scale.height

    // Main title
    const title = this.add.text(W / 2, H * 0.28, 'CRIAS', {
      fontFamily: FONT_LOGIN, fontSize: '42px', color: '#00d4ff',
      stroke: '#001a33', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(5)
    this.textObjs.push(title)

    // Tagline
    this.textObjs.push(
      this.add.text(W / 2, H * 0.38, 'Sua criatura. Sua identidade.', {
        fontFamily: FONT_LOGIN, fontSize: '9px', color: '#7f8c8d',
      }).setOrigin(0.5).setDepth(5)
    )

    // Sub tagline
    this.textObjs.push(
      this.add.text(W / 2, H * 0.44, '1 conta · 1 monstro · exclusivo', {
        fontFamily: FONT_LOGIN, fontSize: '8px', color: '#4ecdc4',
      }).setOrigin(0.5).setDepth(5)
    )

    // Buttons
    this.textObjs.push(
      this.createBtn(W / 2, H * 0.58, 'ENTRAR', () => this.renderLogin())
    )
    this.textObjs.push(
      this.createBtn(W / 2, H * 0.68, 'CRIAR CONTA', () => this.renderRegister())
    )

    // Version
    this.textObjs.push(
      this.add.text(W / 2, H * 0.94, 'ALPHA v0.1', {
        fontFamily: FONT_LOGIN, fontSize: '7px', color: '#334455',
      }).setOrigin(0.5).setDepth(5)
    )
  }

  // ============================================================
  // LOGIN SCREEN
  // ============================================================
  renderLogin() {
    this.clearTexts()
    this.mode = 'login'

    const W = this.scale.width
    const H = this.scale.height

    this.textObjs.push(
      this.add.text(W / 2, H * 0.22, 'ENTRAR', {
        fontFamily: FONT_LOGIN, fontSize: '18px', color: '#00d4ff',
        stroke: '#001a33', strokeThickness: 6,
      }).setOrigin(0.5).setDepth(5)
    )

    this.createDOMForm('login')

    this.textObjs.push(
      this.createBtn(W / 2, H * 0.84, 'VOLTAR', () => this.renderTitle(), 'secondary')
    )
  }

  // ============================================================
  // REGISTER SCREEN
  // ============================================================
  renderRegister() {
    this.clearTexts()
    this.mode = 'register'

    const W = this.scale.width
    const H = this.scale.height

    this.textObjs.push(
      this.add.text(W / 2, H * 0.17, 'CRIAR CONTA', {
        fontFamily: FONT_LOGIN, fontSize: '14px', color: '#00d4ff',
        stroke: '#001a33', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(5)
    )

    this.textObjs.push(
      this.add.text(W / 2, H * 0.25, 'Nova conta\nMonstro gerado exclusivo', {
        fontFamily: FONT_LOGIN, fontSize: '7px', color: '#4ecdc4',
        align: 'center', lineSpacing: 10,
      }).setOrigin(0.5).setDepth(5)
    )

    this.createDOMForm('register')

    this.textObjs.push(
      this.createBtn(W / 2, H * 0.84, 'VOLTAR', () => this.renderTitle(), 'secondary')
    )
  }

  // ============================================================
  // DOM FORM (like DomForm from Cursor)
  // ============================================================
  createDOMForm(mode) {
    const W = this.scale.width
    const H = this.scale.height

    const form = document.createElement('div')
    form.className = 'crias-form'
    form.style.cssText = `
      position: absolute;
      left: 50%;
      top: ${H * 0.33}px;
      transform: translateX(-50%);
      width: 320px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      font-family: 'Press Start 2P', monospace;
      z-index: 100;
      pointer-events: all;
    `

    const errorDiv = document.createElement('div')
    errorDiv.id = 'crias-form-error'
    errorDiv.style.cssText = `
      color: #FF4444;
      font-size: 7px;
      min-height: 14px;
      text-align: center;
      letter-spacing: 0.1em;
    `

    const usernameInput = this.makeInput('usuario', 'text')
    const passwordInput = this.makeInput('senha', 'password')

    const submitBtn = document.createElement('button')
    submitBtn.textContent = mode === 'login' ? 'CONFIRMAR' : 'GERAR MINHA CRIA'
    submitBtn.style.cssText = `
      background: #0d1528;
      border: 2px solid #00d4ff;
      color: #00d4ff;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 14px;
      cursor: pointer;
      letter-spacing: 0.1em;
      margin-top: 4px;
      transition: all 0.1s;
    `
    submitBtn.onmouseover = () => {
      submitBtn.style.background = 'rgba(0,212,255,0.15)'
      submitBtn.style.boxShadow = '0 0 16px rgba(0,212,255,0.4)'
    }
    submitBtn.onmouseout = () => {
      submitBtn.style.background = '#0d1528'
      submitBtn.style.boxShadow = 'none'
    }
    submitBtn.onclick = () => mode === 'login' ? this.handleLogin(usernameInput, passwordInput, errorDiv, submitBtn)
      : this.handleRegister(usernameInput, passwordInput, errorDiv, submitBtn)

    // Enter key
    const onEnter = (e) => {
      if (e.key === 'Enter') submitBtn.click()
    }
    usernameInput.addEventListener('keydown', onEnter)
    passwordInput.addEventListener('keydown', onEnter)

    form.appendChild(errorDiv)
    form.appendChild(usernameInput)
    form.appendChild(passwordInput)
    form.appendChild(submitBtn)

    document.getElementById('game-container').appendChild(form)
    this.formEl = form

    // Focus username
    setTimeout(() => usernameInput.focus(), 100)
  }

  makeInput(placeholder, type) {
    const input = document.createElement('input')
    input.type = type
    input.placeholder = placeholder.toUpperCase()
    input.maxLength = type === 'password' ? 40 : 20
    input.autocomplete = type === 'password' ? 'current-password' : 'username'
    input.style.cssText = `
      background: #050810;
      border: 2px solid #1a3a6a;
      border-bottom-color: #00d4ff;
      color: #e0f7ff;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 12px 14px;
      outline: none;
      letter-spacing: 0.1em;
      transition: border-color 0.2s;
    `
    input.onfocus = () => {
      input.style.borderColor = '#00d4ff'
      input.style.boxShadow = '0 0 12px rgba(0,212,255,0.2)'
    }
    input.onblur = () => {
      input.style.borderColor = '#1a3a6a'
      input.style.borderBottomColor = '#00d4ff'
      input.style.boxShadow = 'none'
    }
    return input
  }

  async handleLogin(usernameInput, passwordInput, errorDiv, submitBtn) {
    if (this.loading) return
    const username = usernameInput.value.trim()
    const password = passwordInput.value.trim()

    if (!username || !password) {
      errorDiv.textContent = '[ USUÁRIO E SENHA OBRIGATÓRIOS ]'
      return
    }
    if (username.length < 3) {
      errorDiv.textContent = '[ USUÁRIO MUITO CURTO ]'
      return
    }

    this.loading = true
    submitBtn.textContent = 'CONECTANDO...'
    submitBtn.disabled = true
    errorDiv.textContent = ''

    try {
      const data = await GameAPI.login(username, password)
      window.CRIAS = window.CRIAS || {}
      window.CRIAS.user = data.user
      window.CRIAS.monster = data.monster
      window.CRIAS.isNew = false

      this.transitionOut(data.isNew ? 'CoreOrbScene' : 'NexusScene')
    } catch (err) {
      errorDiv.textContent = `[ ${(err.message || 'ERRO').toUpperCase()} ]`
      submitBtn.textContent = 'CONFIRMAR'
      submitBtn.disabled = false
      this.loading = false
    }
  }

  async handleRegister(usernameInput, passwordInput, errorDiv, submitBtn) {
    if (this.loading) return
    const username = usernameInput.value.trim()
    const password = passwordInput.value.trim()

    if (!username || !password) {
      errorDiv.textContent = '[ USUÁRIO E SENHA OBRIGATÓRIOS ]'
      return
    }
    if (username.length < 3) {
      errorDiv.textContent = '[ MÍN. 3 CARACTERES ]'
      return
    }

    this.loading = true
    submitBtn.textContent = 'GERANDO...'
    submitBtn.disabled = true
    errorDiv.textContent = ''

    try {
      const data = await GameAPI.register(username, password)
      window.CRIAS = window.CRIAS || {}
      window.CRIAS.user = data.user
      window.CRIAS.monster = data.monster
      window.CRIAS.isNew = true

      this.transitionOut('CoreOrbScene')
    } catch (err) {
      errorDiv.textContent = `[ ${(err.message || 'ERRO').toUpperCase()} ]`
      submitBtn.textContent = 'GERAR MINHA CRIA'
      submitBtn.disabled = false
      this.loading = false
    }
  }

  transitionOut(scene) {
    const flash = this.add.rectangle(
      this.scale.width / 2, this.scale.height / 2,
      this.scale.width, this.scale.height, 0xFFFFFF
    ).setAlpha(0).setDepth(100)

    this.tweens.add({
      targets: flash, alpha: 1, duration: 400,
      onComplete: () => {
        this.shutdown()
        this.scene.start(scene)
      }
    })
  }

  createBtn(x, y, label, onClick, variant = 'primary') {
    const isSecondary = variant === 'secondary'
    const btn = this.add.text(x, y, label, {
      fontFamily: FONT_LOGIN, fontSize: '12px',
      color: isSecondary ? '#7f8c8d' : '#00d4ff',
      backgroundColor: isSecondary ? '#0a0a0a' : '#0d1528',
      padding: { x: 20, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(5)

    btn.on('pointerover', () => btn.setStyle({
      color: isSecondary ? '#ffffff' : '#ffffff',
      backgroundColor: isSecondary ? '#1a1a1a' : 'rgba(0,212,255,0.15)',
    }))
    btn.on('pointerout', () => btn.setStyle({
      color: isSecondary ? '#7f8c8d' : '#00d4ff',
      backgroundColor: isSecondary ? '#0a0a0a' : '#0d1528',
    }))
    btn.on('pointerdown', onClick)
    return btn
  }

  update(time) {
    const W = this.scale.width
    const H = this.scale.height
    const t = time * 0.001

    this.gfx.clear()

    // Background
    this.gfx.fillStyle(0x050810, 1)
    this.gfx.fillRect(0, 0, W, H)

    // Nebula
    this.gfx.fillStyle(0x0A0A40, 0.2)
    this.gfx.fillEllipse(W * 0.35, H * 0.45, 450, 320)
    this.gfx.fillStyle(0x001A40, 0.15)
    this.gfx.fillEllipse(W * 0.65, H * 0.55, 380, 260)

    // Stars
    for (const s of this.stars) {
      const alpha = 0.3 + Math.sin(s.phase + t * s.speed) * 0.3
      this.gfx.fillStyle(0xAADDFF, alpha)
      this.gfx.fillRect(s.x, s.y, s.r * 2, s.r * 2)
    }

    // Core Orb (title mode only)
    if (this.mode === 'title') {
      MonsterRenderer.drawCoreOrb(this.gfx, W / 2, H * 0.5 - 10, 36, time)
    }
  }

  shutdown() {
    this.clearTexts()
    // Remove all form elements
    document.querySelectorAll('.crias-form').forEach(el => el.remove())
  }
}
