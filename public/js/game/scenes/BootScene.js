// ============================================================
// CRIAS — Boot Scene
// Checks auth token → routes to LoginScene or NexusScene
// Matches original BootScene flow from Cursor project
// ============================================================

class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }) }

  preload() {
    // Animate loading bar while any async work runs
    const bar = document.getElementById('loading-bar')
    if (bar) {
      let p = 0
      const iv = setInterval(() => {
        p += 4
        bar.style.width = Math.min(80, p) + '%'
        if (p >= 80) clearInterval(iv)
      }, 40)
      this._barInterval = iv
    }
  }

  async create() {
    const bar = document.getElementById('loading-bar')
    if (bar) bar.style.width = '85%'

    const token = GameAPI.getToken()
    if (!token) {
      this.finishBoot('LoginScene')
      return
    }

    try {
      const data = await GameAPI.getMe()
      window.CRIAS = window.CRIAS || {}
      window.CRIAS.user = data.user
      window.CRIAS.monster = data.monster
      this.finishBoot('NexusScene')
    } catch {
      GameAPI.clearToken()
      this.finishBoot('LoginScene')
    }
  }

  finishBoot(scene) {
    if (this._barInterval) clearInterval(this._barInterval)
    const bar = document.getElementById('loading-bar')
    if (bar) bar.style.width = '100%'

    setTimeout(() => {
      const loading = document.getElementById('loading')
      if (loading) {
        loading.style.transition = 'opacity 0.5s'
        loading.style.opacity = '0'
        setTimeout(() => loading.remove(), 500)
      }
      this.scene.start(scene)
    }, 300)
  }
}
