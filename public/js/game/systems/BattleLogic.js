// ============================================================
// CRIAS — Battle Logic (Client-Side)
// Type effectiveness, damage preview, and UI helpers
// ============================================================

const BattleLogic = (() => {

  const TYPE_COLORS = {
    Air:      0x7EC8E3,
    Electric: 0xFFD700,
    Fire:     0xFF4500,
    Water:    0x00CED1,
    Earth:    0x8B4513,
  }

  const RARITY_COLORS = {
    Common:   0xAAAAAA,
    Rare:     0x4488FF,
    Epic:     0xAA44FF,
    Legendary:0xFFAA00,
    Mythic:   0xFF0055,
  }

  const RARITY_LABELS = {
    Common: '',
    Rare: '★ RARE',
    Epic: '★★ EPIC',
    Legendary: '★★★ LEGENDARY',
    Mythic: '✦ MYTHIC',
  }

  function getTypeColor(element) {
    return TYPE_COLORS[element] || 0xFFFFFF
  }

  function getRarityColor(rarity) {
    return RARITY_COLORS[rarity] || 0xFFFFFF
  }

  function getRarityLabel(rarity) {
    return RARITY_LABELS[rarity] || ''
  }

  // Draw HP bar in Pokémon style
  function drawHPBar(gfx, x, y, width, currentHp, maxHp) {
    const ratio = Math.max(0, currentHp / maxHp)
    const filled = Math.floor(width * ratio)

    // Background track
    gfx.fillStyle(0x222222, 1)
    gfx.fillRect(x, y, width, 6)

    // Color gradient based on HP %
    let color
    if (ratio > 0.5) color = 0x44CC44      // green
    else if (ratio > 0.25) color = 0xFFCC00  // yellow
    else color = 0xFF2222                    // red

    gfx.fillStyle(color, 1)
    if (filled > 0) gfx.fillRect(x, y, filled, 6)

    // Border
    gfx.lineStyle(1, 0x555555, 1)
    gfx.strokeRect(x, y, width, 6)
  }

  // Draw XP bar
  function drawXPBar(gfx, x, y, width, currentXp, maxXp) {
    const ratio = Math.max(0, currentXp / maxXp)
    const filled = Math.floor(width * ratio)

    gfx.fillStyle(0x111122, 1)
    gfx.fillRect(x, y, width, 4)
    gfx.fillStyle(0x4488FF, 1)
    if (filled > 0) gfx.fillRect(x, y, filled, 4)
    gfx.lineStyle(1, 0x333366, 1)
    gfx.strokeRect(x, y, width, 4)
  }

  // Draw battle status panel
  function drawStatusPanel(gfx, x, y, width, height, isPlayer) {
    // Panel shadow
    gfx.fillStyle(0x000000, 0.5)
    gfx.fillRect(x + 3, y + 3, width, height)

    // Main panel
    gfx.fillStyle(isPlayer ? 0x0A1A0A : 0x1A0A0A, 1)
    gfx.fillRect(x, y, width, height)

    // Border with element-style color
    gfx.lineStyle(2, isPlayer ? 0x44AA44 : 0xAA4444, 1)
    gfx.strokeRect(x, y, width, height)

    // Inner highlight
    gfx.lineStyle(1, isPlayer ? 0x88FF88 : 0xFF8888, 0.3)
    gfx.strokeRect(x + 2, y + 2, width - 4, height - 4)
  }

  // Draw battle menu box
  function drawMenuBox(gfx, x, y, width, height) {
    // Shadow
    gfx.fillStyle(0x000000, 0.7)
    gfx.fillRect(x + 4, y + 4, width, height)

    // Main bg
    gfx.fillStyle(0x0A0A1E, 1)
    gfx.fillRect(x, y, width, height)

    // Border
    gfx.lineStyle(2, 0x00BFFF, 1)
    gfx.strokeRect(x, y, width, height)

    // Inner accent
    gfx.lineStyle(1, 0x4488AA, 0.5)
    gfx.strokeRect(x + 3, y + 3, width - 6, height - 6)
  }

  // Draw skill button
  function drawSkillButton(gfx, x, y, width, height, element, selected = false) {
    const elemColor = TYPE_COLORS[element] || 0x888888

    // Shadow
    gfx.fillStyle(0x000000, 0.5)
    gfx.fillRect(x + 2, y + 2, width, height)

    // Base
    gfx.fillStyle(selected ? 0x1A1A3E : 0x0E0E22, 1)
    gfx.fillRect(x, y, width, height)

    // Element accent line on top
    gfx.fillStyle(elemColor, selected ? 1 : 0.5)
    gfx.fillRect(x, y, width, 3)

    // Border
    gfx.lineStyle(selected ? 2 : 1, elemColor, selected ? 1 : 0.5)
    gfx.strokeRect(x, y, width, height)

    if (selected) {
      // Selection glow
      gfx.lineStyle(1, elemColor, 0.3)
      gfx.strokeRect(x - 2, y - 2, width + 4, height + 4)
    }
  }

  return {
    drawHPBar,
    drawXPBar,
    drawStatusPanel,
    drawMenuBox,
    drawSkillButton,
    getTypeColor,
    getRarityColor,
    getRarityLabel,
  }
})()
