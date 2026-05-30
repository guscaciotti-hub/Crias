// ============================================================
// CRIAS — Monster Renderer (Procedural Pixel Art)
// Draws monsters using Phaser's Graphics API
// ============================================================

const MonsterRenderer = (() => {

  // Pixel art color palettes per element
  const PALETTES = {
    Air:      { primary: 0x7EC8E3, secondary: 0xE0F7FF, shadow: 0x4A9DB5, glow: 0xBBEEFF, dark: 0x1A5B70 },
    Electric: { primary: 0xFFD700, secondary: 0xFFF176, shadow: 0xB8860B, glow: 0xFFFF99, dark: 0x705A00 },
    Fire:     { primary: 0xFF4500, secondary: 0xFF8C00, shadow: 0xB22222, glow: 0xFFAA44, dark: 0x6B0000 },
    Water:    { primary: 0x00CED1, secondary: 0x7FDBFF, shadow: 0x005F61, glow: 0xAAF5FF, dark: 0x003040 },
    Earth:    { primary: 0x8B4513, secondary: 0x228B22, shadow: 0x3D1A02, glow: 0x5ECC5E, dark: 0x1A0A00 },
  }

  // ============================================================
  // AERIX — Air Drake (small, lithe dragon with wings)
  // ============================================================
  function drawAerix(gfx, x, y, scale = 2, facing = 'right', isEnemy = false) {
    const p = PALETTES.Air
    const s = scale
    const flip = (facing === 'left' || isEnemy) ? -1 : 1

    gfx.save()
    gfx.translateCanvas(x, y)
    gfx.scaleCanvas(flip, 1)

    // Tail
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-20*s, 6*s, 10*s, 4*s)
    gfx.fillRect(-16*s, 2*s, 6*s, 4*s)

    // Body
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-10*s, 0, 20*s, 16*s)
    gfx.fillRect(-8*s, 16*s, 16*s, 6*s)

    // Belly lighter
    gfx.fillStyle(p.secondary, 1)
    gfx.fillRect(-6*s, 3*s, 12*s, 10*s)

    // Wings
    gfx.fillStyle(p.primary, 0.9)
    gfx.fillTriangle(-10*s, 4*s, -28*s, -8*s, -28*s, 18*s)
    gfx.fillTriangle(10*s, 4*s, 28*s, -8*s, 28*s, 18*s)

    // Wing veins
    gfx.fillStyle(p.glow, 0.6)
    gfx.fillRect(-25*s, -2*s, 2*s, 14*s)
    gfx.fillRect(23*s, -2*s, 2*s, 14*s)

    // Neck & Head
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-6*s, -16*s, 12*s, 16*s)
    gfx.fillRect(-10*s, -26*s, 20*s, 14*s)

    // Head darker top
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-10*s, -26*s, 20*s, 5*s)

    // Eyes
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-6*s, -22*s, 4*s, 4*s)
    gfx.fillRect(2*s, -22*s, 4*s, 4*s)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-5*s, -21*s, 2*s, 2*s)
    gfx.fillRect(3*s, -21*s, 2*s, 2*s)

    // Snout
    gfx.fillStyle(p.secondary, 1)
    gfx.fillRect(-4*s, -18*s, 8*s, 6*s)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-3*s, -16*s, 2*s, 2*s)
    gfx.fillRect(1*s, -16*s, 2*s, 2*s)

    // Horn
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-2*s, -32*s, 4*s, 8*s)
    gfx.fillRect(0, -36*s, 2*s, 4*s)

    // Legs
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-8*s, 20*s, 6*s, 8*s)
    gfx.fillRect(2*s, 20*s, 6*s, 8*s)
    // Claws
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-10*s, 28*s, 4*s, 2*s)
    gfx.fillRect(-6*s, 28*s, 4*s, 2*s)
    gfx.fillRect(2*s, 28*s, 4*s, 2*s)
    gfx.fillRect(6*s, 28*s, 4*s, 2*s)

    gfx.restore()
  }

  // ============================================================
  // VOLTALON — Electric Falcon (sharp, angular bird)
  // ============================================================
  function drawVoltalon(gfx, x, y, scale = 2, facing = 'right', isEnemy = false) {
    const p = PALETTES.Electric
    const s = scale
    const flip = (facing === 'left' || isEnemy) ? -1 : 1

    gfx.save()
    gfx.translateCanvas(x, y)
    gfx.scaleCanvas(flip, 1)

    // Tail feathers
    gfx.fillStyle(p.shadow, 1)
    gfx.fillTriangle(-2*s, 12*s, -16*s, 22*s, 0, 20*s)
    gfx.fillTriangle(2*s, 12*s, 16*s, 22*s, 0, 20*s)

    // Wings (swept back)
    gfx.fillStyle(p.primary, 1)
    gfx.fillTriangle(-12*s, 0, -36*s, -12*s, -8*s, 16*s)
    gfx.fillTriangle(12*s, 0, 36*s, -12*s, 8*s, 16*s)
    gfx.fillStyle(p.secondary, 0.7)
    gfx.fillTriangle(-12*s, 2*s, -30*s, -8*s, -8*s, 14*s)
    gfx.fillTriangle(12*s, 2*s, 30*s, -8*s, 8*s, 14*s)

    // Body
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-10*s, -8*s, 20*s, 22*s)

    // Chest lightning pattern
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-4*s, -4*s, 2*s, 8*s)
    gfx.fillRect(-2*s, -2*s, 4*s, 2*s)
    gfx.fillRect(2*s, -4*s, 2*s, 8*s)

    // Head
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-8*s, -20*s, 16*s, 14*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-7*s, -19*s, 14*s, 12*s)

    // Eyes (piercing)
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-5*s, -17*s, 5*s, 4*s)
    gfx.fillRect(0, -17*s, 5*s, 4*s)
    gfx.fillStyle(0x000000, 1)
    gfx.fillRect(-4*s, -16*s, 3*s, 2*s)
    gfx.fillRect(1*s, -16*s, 3*s, 2*s)

    // Beak
    gfx.fillStyle(p.shadow, 1)
    gfx.fillTriangle(-3*s, -10*s, 3*s, -10*s, 0, -6*s)
    gfx.fillStyle(p.glow, 0.8)
    gfx.fillRect(-1*s, -10*s, 2*s, 2*s)

    // Crest (lightning bolt spike)
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(-2*s, -28*s, 4*s, 10*s)
    gfx.fillRect(-4*s, -26*s, 8*s, 2*s)

    // Talons
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-8*s, 14*s, 6*s, 6*s)
    gfx.fillRect(2*s, 14*s, 6*s, 6*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-10*s, 20*s, 4*s, 2*s)
    gfx.fillRect(-6*s, 20*s, 4*s, 2*s)
    gfx.fillRect(2*s, 20*s, 4*s, 2*s)
    gfx.fillRect(6*s, 20*s, 4*s, 2*s)

    gfx.restore()
  }

  // ============================================================
  // IGNIVAR — Fire Wolf (aggressive, spiky mane)
  // ============================================================
  function drawIgnivar(gfx, x, y, scale = 2, facing = 'right', isEnemy = false) {
    const p = PALETTES.Fire
    const s = scale
    const flip = (facing === 'left' || isEnemy) ? -1 : 1

    gfx.save()
    gfx.translateCanvas(x, y)
    gfx.scaleCanvas(flip, 1)

    // Tail
    gfx.fillStyle(p.secondary, 1)
    gfx.fillTriangle(-14*s, 4*s, -24*s, -8*s, -18*s, 10*s)
    gfx.fillStyle(p.glow, 1)
    gfx.fillTriangle(-14*s, 4*s, -22*s, -4*s, -16*s, 8*s)

    // Body
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-12*s, -2*s, 26*s, 18*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-11*s, -1*s, 24*s, 17*s)

    // Belly
    gfx.fillStyle(p.secondary, 0.6)
    gfx.fillRect(-6*s, 3*s, 14*s, 10*s)

    // Flame mane (spikes on back)
    gfx.fillStyle(p.glow, 1)
    for (let i = -8; i <= 8; i += 4) {
      gfx.fillTriangle(i*s, -2*s, (i+2)*s, -14*s, (i+4)*s, -2*s)
    }
    gfx.fillStyle(p.secondary, 0.8)
    for (let i = -6; i <= 6; i += 4) {
      gfx.fillTriangle(i*s, -2*s, (i+2)*s, -10*s, (i+4)*s, -2*s)
    }

    // Neck
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-4*s, -14*s, 10*s, 14*s)

    // Head
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-2*s, -28*s, 18*s, 16*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-1*s, -27*s, 16*s, 15*s)

    // Ears (pointed)
    gfx.fillStyle(p.shadow, 1)
    gfx.fillTriangle(-1*s, -27*s, 2*s, -36*s, 5*s, -27*s)
    gfx.fillTriangle(10*s, -27*s, 13*s, -36*s, 15*s, -27*s)
    gfx.fillStyle(p.glow, 0.7)
    gfx.fillTriangle(0, -28*s, 3*s, -34*s, 5*s, -28*s)
    gfx.fillTriangle(10*s, -28*s, 13*s, -34*s, 14*s, -28*s)

    // Eyes (fierce, ember glow)
    gfx.fillStyle(p.glow, 1)
    gfx.fillRect(2*s, -23*s, 4*s, 4*s)
    gfx.fillRect(9*s, -23*s, 4*s, 4*s)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(3*s, -22*s, 2*s, 2*s)
    gfx.fillRect(10*s, -22*s, 2*s, 2*s)

    // Snout
    gfx.fillStyle(p.secondary, 1)
    gfx.fillRect(4*s, -17*s, 8*s, 5*s)
    // Nostrils
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(5*s, -16*s, 2*s, 2*s)
    gfx.fillRect(9*s, -16*s, 2*s, 2*s)
    // Teeth
    gfx.fillStyle(0xFFFFFF, 1)
    gfx.fillRect(4*s, -13*s, 2*s, 3*s)
    gfx.fillRect(10*s, -13*s, 2*s, 3*s)

    // Legs
    gfx.fillStyle(p.shadow, 1)
    gfx.fillRect(-10*s, 16*s, 8*s, 12*s)
    gfx.fillRect(-2*s, 16*s, 8*s, 12*s)
    gfx.fillRect(7*s, 16*s, 8*s, 12*s)
    // Paws with claws
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-12*s, 26*s, 10*s, 4*s)
    gfx.fillRect(-2*s, 26*s, 10*s, 4*s)
    gfx.fillRect(6*s, 26*s, 10*s, 4*s)

    gfx.restore()
  }

  // ============================================================
  // AQUAFY — Water Entity (luminous jellyfish/kirin hybrid)
  // ============================================================
  function drawAquafy(gfx, x, y, scale = 2, facing = 'right', isEnemy = false) {
    const p = PALETTES.Water
    const s = scale
    const flip = (facing === 'left' || isEnemy) ? -1 : 1

    gfx.save()
    gfx.translateCanvas(x, y)
    gfx.scaleCanvas(flip, 1)

    // Flowing tendrils
    gfx.fillStyle(p.glow, 0.5)
    for (let i = -3; i <= 3; i++) {
      gfx.fillRect(i*4*s, 16*s, 2*s, 18*s)
    }
    gfx.fillStyle(p.secondary, 0.4)
    for (let i = -2; i <= 2; i++) {
      gfx.fillRect(i*4*s + 2*s, 20*s, 2*s, 12*s)
    }

    // Body dome (slightly oval)
    gfx.fillStyle(p.shadow, 0.7)
    gfx.fillEllipse(0, 0, 32*s, 28*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillEllipse(0, -1*s, 28*s, 24*s)

    // Glowing core
    gfx.fillStyle(p.glow, 0.6)
    gfx.fillEllipse(0, -2*s, 18*s, 14*s)
    gfx.fillStyle(0xFFFFFF, 0.4)
    gfx.fillEllipse(-4*s, -5*s, 8*s, 6*s)

    // Flowing fins (sides)
    gfx.fillStyle(p.secondary, 0.8)
    gfx.fillTriangle(-14*s, -4*s, -26*s, -14*s, -14*s, 8*s)
    gfx.fillTriangle(14*s, -4*s, 26*s, -14*s, 14*s, 8*s)
    gfx.fillStyle(p.glow, 0.5)
    gfx.fillTriangle(-14*s, -2*s, -22*s, -10*s, -14*s, 6*s)
    gfx.fillTriangle(14*s, -2*s, 22*s, -10*s, 14*s, 6*s)

    // Eyes (deep glowing)
    gfx.fillStyle(p.glow, 1)
    gfx.fillEllipse(-6*s, -6*s, 8*s, 8*s)
    gfx.fillEllipse(6*s, -6*s, 8*s, 8*s)
    gfx.fillStyle(p.shadow, 1)
    gfx.fillEllipse(-6*s, -6*s, 4*s, 4*s)
    gfx.fillEllipse(6*s, -6*s, 4*s, 4*s)
    gfx.fillStyle(0xFFFFFF, 0.8)
    gfx.fillRect(-8*s, -9*s, 2*s, 2*s)
    gfx.fillRect(5*s, -9*s, 2*s, 2*s)

    // Small crown-like protrusions
    gfx.fillStyle(p.secondary, 1)
    gfx.fillTriangle(-6*s, -14*s, -4*s, -22*s, -2*s, -14*s)
    gfx.fillTriangle(2*s, -14*s, 4*s, -22*s, 6*s, -14*s)
    gfx.fillStyle(p.glow, 0.8)
    gfx.fillTriangle(-5*s, -15*s, -4*s, -20*s, -3*s, -15*s)
    gfx.fillTriangle(3*s, -15*s, 4*s, -20*s, 5*s, -15*s)

    gfx.restore()
  }

  // ============================================================
  // TERRON — Earth Golem (massive, ancient, rune-covered)
  // ============================================================
  function drawTerron(gfx, x, y, scale = 2, facing = 'right', isEnemy = false) {
    const p = PALETTES.Earth
    const s = scale
    const flip = (facing === 'left' || isEnemy) ? -1 : 1

    gfx.save()
    gfx.translateCanvas(x, y)
    gfx.scaleCanvas(flip, 1)

    // Feet / base
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-16*s, 26*s, 14*s, 8*s)
    gfx.fillRect(2*s, 26*s, 14*s, 8*s)

    // Legs (wide stone columns)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-14*s, 12*s, 10*s, 16*s)
    gfx.fillRect(4*s, 12*s, 10*s, 16*s)

    // Main torso (massive square block)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-20*s, -10*s, 42*s, 26*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-18*s, -9*s, 38*s, 24*s)

    // Crack lines
    gfx.fillStyle(p.secondary, 0.6)
    gfx.fillRect(-10*s, -8*s, 2*s, 20*s)
    gfx.fillRect(8*s, -6*s, 2*s, 16*s)
    gfx.fillRect(-6*s, -2*s, 14*s, 2*s)

    // Glowing runes
    gfx.fillStyle(p.secondary, 0.9)
    gfx.fillRect(-14*s, 2*s, 4*s, 6*s)
    gfx.fillRect(-14*s, 4*s, 8*s, 2*s)
    gfx.fillRect(10*s, 2*s, 4*s, 6*s)
    gfx.fillRect(10*s, 4*s, 8*s, 2*s)
    gfx.fillRect(-2*s, -4*s, 4*s, 4*s)

    // Shoulders (boulders)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-28*s, -14*s, 16*s, 16*s)
    gfx.fillRect(12*s, -14*s, 16*s, 16*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-27*s, -13*s, 14*s, 14*s)
    gfx.fillRect(13*s, -13*s, 14*s, 14*s)

    // Arms
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-26*s, 0, 10*s, 14*s)
    gfx.fillRect(16*s, 0, 10*s, 14*s)

    // Fists
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-28*s, 12*s, 14*s, 10*s)
    gfx.fillRect(14*s, 12*s, 14*s, 10*s)

    // Head (square, imposing)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-14*s, -30*s, 30*s, 22*s)
    gfx.fillStyle(p.primary, 1)
    gfx.fillRect(-13*s, -29*s, 28*s, 21*s)

    // Eyes (deep glowing cracks)
    gfx.fillStyle(p.secondary, 1)
    gfx.fillRect(-10*s, -24*s, 8*s, 6*s)
    gfx.fillRect(2*s, -24*s, 8*s, 6*s)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-9*s, -23*s, 6*s, 4*s)
    gfx.fillRect(3*s, -23*s, 6*s, 4*s)
    // Glow within eyes
    gfx.fillStyle(p.secondary, 0.9)
    gfx.fillRect(-8*s, -22*s, 4*s, 2*s)
    gfx.fillRect(4*s, -22*s, 4*s, 2*s)

    // Crown (stone horns)
    gfx.fillStyle(p.dark, 1)
    gfx.fillTriangle(-10*s, -29*s, -8*s, -40*s, -4*s, -29*s)
    gfx.fillTriangle(4*s, -29*s, 8*s, -40*s, 10*s, -29*s)
    gfx.fillStyle(p.secondary, 0.7)
    gfx.fillTriangle(-9*s, -30*s, -8*s, -36*s, -5*s, -30*s)
    gfx.fillTriangle(5*s, -30*s, 8*s, -36*s, 9*s, -30*s)

    // Chin/mouth (grimace)
    gfx.fillStyle(p.dark, 1)
    gfx.fillRect(-8*s, -12*s, 18*s, 4*s)
    gfx.fillStyle(p.secondary, 0.5)
    gfx.fillRect(-6*s, -11*s, 4*s, 2*s)
    gfx.fillRect(0, -11*s, 4*s, 2*s)
    gfx.fillRect(6*s, -11*s, 4*s, 2*s)

    gfx.restore()
  }

  // ============================================================
  // CORE ORB — Animated geometric sphere
  // ============================================================
  function drawCoreOrb(gfx, x, y, radius, time) {
    const t = time * 0.001
    const pulse = Math.sin(t * 2) * 0.15 + 1

    // Outer glow rings
    for (let r = 3; r > 0; r--) {
      gfx.fillStyle(0x00BFFF, 0.05 * r)
      gfx.fillCircle(x, y, radius * pulse * (1 + r * 0.3))
    }

    // Main body (dark gem)
    gfx.fillStyle(0x0A1A4A, 1)
    gfx.fillCircle(x, y, radius * pulse)

    // Geometric face lines (icosahedron look)
    gfx.fillStyle(0x00BFFF, 0.8)
    const faces = 5
    for (let i = 0; i < faces; i++) {
      const a = (i / faces) * Math.PI * 2 + t
      const bx = x + Math.cos(a) * radius * 0.6 * pulse
      const by = y + Math.sin(a) * radius * 0.6 * pulse
      gfx.fillRect(bx - 1, by - 1, 2, 2)
    }

    // Connecting lines (drawn as thin rects)
    gfx.fillStyle(0x00BFFF, 0.4)
    for (let i = 0; i < faces; i++) {
      const a1 = (i / faces) * Math.PI * 2 + t
      const a2 = ((i + 1) / faces) * Math.PI * 2 + t
      const x1 = x + Math.cos(a1) * radius * 0.6 * pulse
      const y1 = y + Math.sin(a1) * radius * 0.6 * pulse
      const x2 = x + Math.cos(a2) * radius * 0.6 * pulse
      const y2 = y + Math.sin(a2) * radius * 0.6 * pulse
      gfx.fillRect((x1 + x2) / 2 - 1, (y1 + y2) / 2 - 1, 2, 2)
    }

    // Inner glow
    gfx.fillStyle(0x4488FF, 0.5)
    gfx.fillCircle(x, y, radius * 0.4 * pulse)
    gfx.fillStyle(0xAADDFF, 0.3)
    gfx.fillCircle(x, y, radius * 0.2 * pulse)
    gfx.fillStyle(0xFFFFFF, 0.6)
    gfx.fillCircle(x - radius * 0.15, y - radius * 0.15, radius * 0.1)

    // Rune symbols on faces (tiny bright dots)
    gfx.fillStyle(0xAAEEFF, 1)
    for (let i = 0; i < faces; i++) {
      const a = (i / faces) * Math.PI * 2 + t * 0.5
      const bx = x + Math.cos(a) * radius * 0.45 * pulse
      const by = y + Math.sin(a) * radius * 0.45 * pulse
      gfx.fillRect(bx - 2, by - 2, 4, 4)
      gfx.fillStyle(0x00BFFF, 0.8)
      gfx.fillRect(bx - 1, by - 1, 2, 2)
      gfx.fillStyle(0xAAEEFF, 1)
    }
  }

  // ============================================================
  // PLAYER CHARACTER — Chibi pixel art character
  // ============================================================
  function drawPlayer(gfx, x, y, facing = 'down', frame = 0) {
    const walkOffset = frame % 2 === 0 ? 0 : 1

    // Shadow
    gfx.fillStyle(0x000000, 0.2)
    gfx.fillEllipse(x, y + 14, 16, 6)

    // Feet
    gfx.fillStyle(0x5C3A1E, 1) // brown shoes
    if (facing === 'left' || facing === 'right') {
      gfx.fillRect(x - 5, y + 10 + (walkOffset ? 0 : 2), 4, 5)
      gfx.fillRect(x + 1, y + 10 + (walkOffset ? 2 : 0), 4, 5)
    } else {
      gfx.fillRect(x - 5, y + 10, 4, 5)
      gfx.fillRect(x + 1, y + 10, 4, 5)
    }

    // Legs (dark jeans)
    gfx.fillStyle(0x1A3A5C, 1)
    gfx.fillRect(x - 5, y + 4, 4, 8)
    gfx.fillRect(x + 1, y + 4, 4, 8)

    // Belt
    gfx.fillStyle(0x8B4513, 1)
    gfx.fillRect(x - 6, y + 3, 12, 2)
    gfx.fillStyle(0xCCAA44, 1)
    gfx.fillRect(x - 1, y + 3, 2, 2)

    // Torso (dark jacket)
    gfx.fillStyle(0x1A1A2E, 1)
    gfx.fillRect(x - 6, y - 5, 12, 10)

    // Chain necklace
    gfx.fillStyle(0xCCCCCC, 1)
    gfx.fillRect(x - 3, y - 2, 6, 1)
    gfx.fillRect(x - 1, y - 1, 2, 2)

    // Arms
    gfx.fillStyle(0x1A1A2E, 1)
    gfx.fillRect(x - 9, y - 5, 3, 8)
    gfx.fillRect(x + 6, y - 5, 3, 8)

    // Hands
    gfx.fillStyle(0xF5CBA7, 1)
    gfx.fillRect(x - 9, y + 2, 3, 3)
    gfx.fillRect(x + 6, y + 2, 3, 3)

    // Neck
    gfx.fillStyle(0xF5CBA7, 1)
    gfx.fillRect(x - 2, y - 7, 4, 3)

    // Head
    gfx.fillStyle(0xF5CBA7, 1)
    gfx.fillRect(x - 7, y - 17, 14, 12)

    // Eyes
    gfx.fillStyle(0x111111, 1)
    if (facing !== 'up') {
      gfx.fillRect(x - 4, y - 13, 2, 2)
      gfx.fillRect(x + 2, y - 13, 2, 2)
      // Eye whites
      gfx.fillStyle(0xFFFFFF, 1)
      gfx.fillRect(x - 5, y - 14, 2, 2)
      gfx.fillRect(x + 3, y - 14, 2, 2)
    } else {
      // Back of head details
      gfx.fillStyle(0x111111, 0.3)
      gfx.fillRect(x - 2, y - 10, 4, 2)
    }

    // Hair (black, tuft above cap)
    gfx.fillStyle(0x111111, 1)
    gfx.fillRect(x - 7, y - 16, 14, 3)
    gfx.fillRect(x - 4, y - 19, 8, 3)

    // Cap (black with blue gem)
    gfx.fillStyle(0x0A0A0A, 1)
    gfx.fillRect(x - 8, y - 22, 16, 8)
    gfx.fillRect(x - 6, y - 24, 12, 2)

    // Cap brim
    gfx.fillStyle(0x222222, 1)
    if (facing !== 'up') {
      gfx.fillRect(x - 9, y - 17, 18, 3)
    }

    // Blue gem on cap
    gfx.fillStyle(0x00BFFF, 1)
    gfx.fillRect(x - 3, y - 20, 6, 5)
    gfx.fillStyle(0x4488FF, 0.8)
    gfx.fillRect(x - 2, y - 20, 4, 4)
    gfx.fillStyle(0xAADDFF, 0.7)
    gfx.fillRect(x - 1, y - 19, 2, 2)

    // Side hair
    gfx.fillStyle(0x111111, 1)
    gfx.fillRect(x - 8, y - 17, 2, 6)
    gfx.fillRect(x + 6, y - 17, 2, 6)
  }

  // ============================================================
  // DISPATCH — render any monster by species name
  // ============================================================
  function drawMonster(gfx, species, x, y, scale = 2, facing = 'right', isEnemy = false) {
    switch (species) {
      case 'Aerix':    drawAerix(gfx, x, y, scale, facing, isEnemy); break
      case 'Voltalon': drawVoltalon(gfx, x, y, scale, facing, isEnemy); break
      case 'Ignivar':  drawIgnivar(gfx, x, y, scale, facing, isEnemy); break
      case 'Aquafy':   drawAquafy(gfx, x, y, scale, facing, isEnemy); break
      case 'Terron':   drawTerron(gfx, x, y, scale, facing, isEnemy); break
      default:         drawAerix(gfx, x, y, scale, facing, isEnemy)
    }
  }

  // ============================================================
  // RENDER TO TEXTURE (for use as Phaser sprites)
  // ============================================================
  function createMonsterTexture(scene, species, key, scale = 2) {
    const rt = scene.add.renderTexture(0, 0, 128, 128)
    rt.setVisible(false)
    const gfx = scene.add.graphics()
    gfx.clear()
    drawMonster(gfx, species, 64, 64, scale, 'right', false)
    rt.draw(gfx, 0, 0)
    gfx.destroy()
    return rt
  }

  return {
    drawMonster,
    drawCoreOrb,
    drawPlayer,
    createMonsterTexture,
    PALETTES,
  }
})()
