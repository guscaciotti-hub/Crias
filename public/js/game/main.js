// ============================================================
// CRIAS — Main entry point
// Initialises Phaser 3 with all scenes
// ============================================================

window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    width: 640,
    height: 480,
    parent: 'game-container',
    backgroundColor: '#050810',

    // Pixel-perfect rendering (matches Press Start 2P / GBA aesthetic)
    pixelArt: true,
    antialias: false,
    roundPixels: true,

    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 480,
    },

    // No physics needed for overworld (tile-based movement)
    // Physics only needed if we add arcade physics later
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },

    scene: [
      BootScene,
      LoginScene,
      CoreOrbScene,
      NexusScene,
      CaveScene,
      BattleScene,
    ],
  }

  window.game = new Phaser.Game(config)
})
