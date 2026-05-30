import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, '..', 'public')))

// ============================================================
// DATA TYPES
// ============================================================

interface User {
  id: string
  username: string
  passwordHash: string
  sessionToken: string | null
  monsterId: string
  position: { scene: string; x: number; y: number }
  createdAt: string
}

interface Monster {
  id: string
  ownerId: string
  species: string
  element: string
  rarity: string
  seed: string
  personality: string
  primaryColor: string
  secondaryColor: string
  auraType: string
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  intelligence: number
  level: number
  xp: number
  xpToNextLevel: number
  specialSkill: string
  passiveSkill: string
  activeSkills: string[]
  createdAt: string
}

interface BattleState {
  id: string
  playerId: string
  playerMonsterSnapshot: Monster
  wildMonster: WildMonster
  playerCurrentHp: number
  wildCurrentHp: number
  turn: number
  isPlayerTurn: boolean
  log: string[]
  status: 'active' | 'victory' | 'defeat' | 'fled'
  xpReward: number
}

interface WildMonster {
  species: string
  element: string
  level: number
  hp: number
  maxHp: number
  attack: number
  defense: number
  speed: number
  rarity: string
  skills: string[]
  primaryColor: string
}

// ============================================================
// IN-MEMORY STORE (replace with DB for production)
// ============================================================

const users = new Map<string, User>()        // username -> User
const monsters = new Map<string, Monster>()  // monsterId -> Monster
const sessions = new Map<string, string>()   // token -> userId
const battles = new Map<string, BattleState>() // userId -> BattleState

// ============================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================

function createRNG(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = (Math.imul(h, 16777619) >>> 0)
  }
  let state = h
  return function () {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 0xFFFFFFFF
  }
}

// ============================================================
// MONSTER SPECIES DATA
// ============================================================

const SPECIES_DATA: Record<string, any> = {
  Aerix: {
    element: 'Air',
    baseHp: 60, baseAtk: 65, baseDef: 45, baseSpd: 90, baseInt: 50,
    primaryColor: '#7EC8E3', secondaryColor: '#FFFFFF',
    auraTypes: ['wind', 'feather', 'cloud'],
    specialSkill: 'Gale Force',
    passiveSkill: 'Wind Rider',
    activeSkills: ['Air Slash', 'Storm Dive', 'Cyclone Breath', 'Feather Storm'],
  },
  Voltalon: {
    element: 'Electric',
    baseHp: 55, baseAtk: 70, baseDef: 40, baseSpd: 85, baseInt: 65,
    primaryColor: '#FFD700', secondaryColor: '#00BFFF',
    auraTypes: ['lightning', 'spark', 'thunder'],
    specialSkill: 'Thunderstorm',
    passiveSkill: 'Static Field',
    activeSkills: ['Volt Strike', 'Thunder Wing', 'Plasma Bolt', 'Electric Surge'],
  },
  Ignivar: {
    element: 'Fire',
    baseHp: 75, baseAtk: 80, baseDef: 50, baseSpd: 65, baseInt: 45,
    primaryColor: '#FF4500', secondaryColor: '#FF8C00',
    auraTypes: ['flame', 'ember', 'inferno'],
    specialSkill: 'Volcanic Eruption',
    passiveSkill: 'Blaze Aura',
    activeSkills: ['Flame Bite', 'Inferno Rush', 'Fire Fang', 'Magma Wave'],
  },
  Aquafy: {
    element: 'Water',
    baseHp: 70, baseAtk: 55, baseDef: 65, baseSpd: 60, baseInt: 70,
    primaryColor: '#00CED1', secondaryColor: '#7FDBFF',
    auraTypes: ['wave', 'bubble', 'frost'],
    specialSkill: 'Tidal Wave',
    passiveSkill: 'Hydro Armor',
    activeSkills: ['Water Pulse', 'Aqua Beam', 'Ice Shard', 'Bubble Burst'],
  },
  Terron: {
    element: 'Earth',
    baseHp: 95, baseAtk: 75, baseDef: 85, baseSpd: 30, baseInt: 40,
    primaryColor: '#8B4513', secondaryColor: '#228B22',
    auraTypes: ['crystal', 'rock', 'nature'],
    specialSkill: 'Ancient Shatter',
    passiveSkill: 'Stone Skin',
    activeSkills: ['Rock Slam', 'Earthquake', 'Stone Edge', 'Mud Wave'],
  },
}

const SPECIES_LIST = Object.keys(SPECIES_DATA)

const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic']
const RARITY_WEIGHTS = [50, 25, 15, 8, 2]
const RARITY_MULTIPLIERS: Record<string, number> = {
  Common: 1.0, Rare: 1.1, Epic: 1.25, Legendary: 1.45, Mythic: 1.7
}

const PERSONALITIES = ['Aggressive', 'Intelligent', 'Swift', 'Guardian', 'Chaotic']
const PERSONALITY_MODS: Record<string, any> = {
  Aggressive: { atk: 1.2, def: 0.9 },
  Intelligent: { int: 1.2, spd: 0.9 },
  Swift: { spd: 1.2, atk: 0.9 },
  Guardian: { def: 1.2, hp: 0.9 },
  Chaotic: { all: 'random' },
}

// ============================================================
// PROCEDURAL MONSTER GENERATION
// ============================================================

function generateMonster(userId: string, username: string): Monster {
  const seed = `${username}-${userId}-${Date.now()}`
  const rng = createRNG(seed)

  // Pick species
  const speciesIdx = Math.floor(rng() * SPECIES_LIST.length)
  const species = SPECIES_LIST[speciesIdx]
  const specData = SPECIES_DATA[species]

  // Pick rarity using weights
  const rarityRoll = rng() * 100
  let cumulative = 0
  let rarity = 'Common'
  for (let i = 0; i < RARITIES.length; i++) {
    cumulative += RARITY_WEIGHTS[i]
    if (rarityRoll < cumulative) { rarity = RARITIES[i]; break }
  }

  // Pick personality
  const personality = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)]
  const pMod = PERSONALITY_MODS[personality]
  const rarityMult = RARITY_MULTIPLIERS[rarity]

  // Generate stats
  const baseStats = {
    hp: specData.baseHp,
    atk: specData.baseAtk,
    def: specData.baseDef,
    spd: specData.baseSpd,
    int: specData.baseInt,
  }

  function calcStat(base: number, mod?: number): number {
    let val = base * rarityMult
    if (mod) val *= mod
    // Add some random variance (±10%)
    val *= 0.9 + rng() * 0.2
    return Math.floor(val)
  }

  const chaosBonus = personality === 'Chaotic' ? (0.9 + rng() * 0.2) : 1
  const hp = calcStat(baseStats.hp, pMod.hp) * chaosBonus
  const attack = calcStat(baseStats.atk, pMod.atk) * chaosBonus
  const defense = calcStat(baseStats.def, pMod.def) * chaosBonus
  const speed = calcStat(baseStats.spd, pMod.spd) * chaosBonus
  const intelligence = calcStat(baseStats.int, pMod.int) * chaosBonus

  // Pick aura
  const auraType = specData.auraTypes[Math.floor(rng() * specData.auraTypes.length)]

  // Color variants (slight hue variation)
  const primaryColor = specData.primaryColor
  const secondaryColor = specData.secondaryColor

  const monsterId = crypto.randomUUID()

  return {
    id: monsterId,
    ownerId: userId,
    species,
    element: specData.element,
    rarity,
    seed,
    personality,
    primaryColor,
    secondaryColor,
    auraType,
    hp: Math.floor(hp),
    maxHp: Math.floor(hp),
    attack: Math.floor(attack),
    defense: Math.floor(defense),
    speed: Math.floor(speed),
    intelligence: Math.floor(intelligence),
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    specialSkill: specData.specialSkill,
    passiveSkill: specData.passiveSkill,
    activeSkills: specData.activeSkills,
    createdAt: new Date().toISOString(),
  }
}

// ============================================================
// WILD MONSTER GENERATION
// ============================================================

function generateWildMonster(playerLevel: number, zone: string): WildMonster {
  const rng = createRNG(`wild-${Date.now()}-${Math.random()}`)

  const zoneSpecies: Record<string, string[]> = {
    cave: ['Aerix', 'Ignivar', 'Terron', 'Aquafy', 'Voltalon'],
    nexus: ['Aerix', 'Aquafy'],
  }

  const eligible = zoneSpecies[zone] || SPECIES_LIST
  const species = eligible[Math.floor(rng() * eligible.length)]
  const specData = SPECIES_DATA[species]

  // Wild level is playerLevel ±2
  const levelVariance = Math.floor(rng() * 5) - 2
  const level = Math.max(1, playerLevel + levelVariance)

  // Wild monsters always Common for regular encounters
  const wildRarityRoll = rng() * 100
  let wildRarity = 'Common'
  if (wildRarityRoll > 95) wildRarity = 'Rare'
  else if (wildRarityRoll > 90) wildRarity = 'Epic'

  const mult = RARITY_MULTIPLIERS[wildRarity] * (1 + (level - 1) * 0.08)

  return {
    species,
    element: specData.element,
    level,
    hp: Math.floor(specData.baseHp * mult),
    maxHp: Math.floor(specData.baseHp * mult),
    attack: Math.floor(specData.baseAtk * mult),
    defense: Math.floor(specData.baseDef * mult),
    speed: Math.floor(specData.baseSpd * mult),
    rarity: wildRarity,
    skills: specData.activeSkills.slice(0, 2),
    primaryColor: specData.primaryColor,
  }
}

// ============================================================
// TYPE EFFECTIVENESS CHART
// ============================================================

const TYPE_CHART: Record<string, Record<string, number>> = {
  Fire:     { Air: 1.5, Earth: 1.5, Water: 0.5, Fire: 0.5, Electric: 1.0 },
  Water:    { Fire: 1.5, Earth: 1.5, Electric: 0.5, Water: 0.5, Air: 1.0 },
  Electric: { Water: 1.5, Air: 1.5, Earth: 0.5, Electric: 0.5, Fire: 1.0 },
  Earth:    { Electric: 1.5, Fire: 1.5, Water: 0.5, Air: 0.5, Earth: 0.5 },
  Air:      { Earth: 1.5, Water: 1.5, Fire: 0.5, Electric: 0.5, Air: 0.5 },
}

// ============================================================
// SKILL DATA
// ============================================================

const SKILLS: Record<string, any> = {
  'Air Slash':       { power: 45, element: 'Air',      pp: 20 },
  'Storm Dive':      { power: 75, element: 'Air',      pp: 10 },
  'Cyclone Breath':  { power: 55, element: 'Air',      pp: 15 },
  'Feather Storm':   { power: 35, element: 'Air',      pp: 25 },
  'Volt Strike':     { power: 50, element: 'Electric', pp: 18 },
  'Thunder Wing':    { power: 70, element: 'Electric', pp: 10 },
  'Plasma Bolt':     { power: 60, element: 'Electric', pp: 12 },
  'Electric Surge':  { power: 40, element: 'Electric', pp: 20 },
  'Flame Bite':      { power: 55, element: 'Fire',     pp: 15 },
  'Inferno Rush':    { power: 80, element: 'Fire',     pp: 8 },
  'Fire Fang':       { power: 50, element: 'Fire',     pp: 18 },
  'Magma Wave':      { power: 65, element: 'Fire',     pp: 10 },
  'Water Pulse':     { power: 45, element: 'Water',    pp: 20 },
  'Aqua Beam':       { power: 70, element: 'Water',    pp: 10 },
  'Ice Shard':       { power: 50, element: 'Water',    pp: 15 },
  'Bubble Burst':    { power: 40, element: 'Water',    pp: 25 },
  'Rock Slam':       { power: 60, element: 'Earth',    pp: 15 },
  'Earthquake':      { power: 85, element: 'Earth',    pp: 8 },
  'Stone Edge':      { power: 70, element: 'Earth',    pp: 10 },
  'Mud Wave':        { power: 45, element: 'Earth',    pp: 20 },
  'Gale Force':      { power: 100, element: 'Air',     pp: 5 },
  'Thunderstorm':    { power: 100, element: 'Electric',pp: 5 },
  'Volcanic Eruption': { power: 100, element: 'Fire',  pp: 5 },
  'Tidal Wave':      { power: 100, element: 'Water',   pp: 5 },
  'Ancient Shatter': { power: 100, element: 'Earth',   pp: 5 },
}

function calcDamage(
  attacker: { attack: number; element: string },
  defender: { defense: number; element: string },
  skillName: string
): { damage: number; effectiveness: string } {
  const skill = SKILLS[skillName] || { power: 40, element: attacker.element }
  const typeChart = TYPE_CHART[skill.element] || {}
  const typeMult = typeChart[defender.element] || 1.0
  const variance = 0.85 + Math.random() * 0.15
  const damage = Math.floor((attacker.attack * skill.power / 50 / (defender.defense * 0.5 + 1)) * typeMult * variance)

  let effectiveness = 'normal'
  if (typeMult > 1) effectiveness = 'super'
  if (typeMult < 1) effectiveness = 'weak'

  return { damage: Math.max(1, damage), effectiveness }
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function requireAuth(req: any, res: any, next: any) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const userId = sessions.get(token)
  if (!userId) return res.status(401).json({ error: 'Invalid session' })
  req.userId = userId
  req.user = [...users.values()].find(u => u.id === userId)
  next()
}

// ============================================================
// AUTH ROUTES
// ============================================================

app.post('/api/auth/register', (req: any, res: any) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username must be 3-20 chars' })
  if (users.has(username.toLowerCase())) return res.status(409).json({ error: 'Username already taken' })

  const userId = crypto.randomUUID()
  const sessionToken = crypto.randomBytes(32).toString('hex')
  const passwordHash = crypto.createHash('sha256').update(password + userId).digest('hex')

  // Generate the player's unique monster
  const monster = generateMonster(userId, username)
  monsters.set(monster.id, monster)

  const user: User = {
    id: userId,
    username: username.toLowerCase(),
    passwordHash,
    sessionToken,
    monsterId: monster.id,
    position: { scene: 'nexus', x: 10, y: 12 },
    createdAt: new Date().toISOString(),
  }
  users.set(username.toLowerCase(), user)
  sessions.set(sessionToken, userId)

  res.json({
    token: sessionToken,
    user: { id: userId, username: user.username },
    monster,
    isNew: true,
  })
})

app.post('/api/auth/login', (req: any, res: any) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })

  const user = users.get(username.toLowerCase())
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const hash = crypto.createHash('sha256').update(password + user.id).digest('hex')
  if (hash !== user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' })

  const newToken = crypto.randomBytes(32).toString('hex')
  // Invalidate old token
  if (user.sessionToken) sessions.delete(user.sessionToken)
  user.sessionToken = newToken
  sessions.set(newToken, user.id)

  const monster = monsters.get(user.monsterId)
  res.json({
    token: newToken,
    user: { id: user.id, username: user.username },
    monster,
    isNew: false,
  })
})

app.get('/api/auth/me', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const monster = monsters.get(user.monsterId)
  res.json({
    user: { id: user.id, username: user.username, position: user.position },
    monster,
  })
})

// ============================================================
// GAME ROUTES
// ============================================================

app.get('/api/game/monster', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const monster = monsters.get(user.monsterId)
  if (!monster) return res.status(404).json({ error: 'Monster not found' })
  res.json(monster)
})

app.post('/api/game/position', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const { scene, x, y } = req.body
  user.position = { scene, x, y }
  res.json({ ok: true })
})

// ============================================================
// BATTLE ROUTES
// ============================================================

app.post('/api/battle/start', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const { zone } = req.body

  // End any existing battle
  battles.delete(user.id)

  const monster = monsters.get(user.monsterId)
  if (!monster) return res.status(400).json({ error: 'No monster found' })
  if (monster.hp <= 0) {
    monster.hp = Math.floor(monster.maxHp * 0.5)
    return res.status(400).json({ error: 'Your monster fainted! Returning to Nexus.', healed: true })
  }

  const wildMonster = generateWildMonster(monster.level, zone || 'cave')
  const xpReward = Math.floor(wildMonster.level * 20 * RARITY_MULTIPLIERS[wildMonster.rarity])

  const battleId = crypto.randomUUID()
  const battle: BattleState = {
    id: battleId,
    playerId: user.id,
    playerMonsterSnapshot: { ...monster },
    wildMonster,
    playerCurrentHp: monster.hp,
    wildCurrentHp: wildMonster.hp,
    turn: 1,
    isPlayerTurn: monster.speed >= wildMonster.speed,
    log: [`A wild ${wildMonster.rarity !== 'Common' ? `[${wildMonster.rarity}] ` : ''}${wildMonster.species} appeared! (Lv.${wildMonster.level})`],
    status: 'active',
    xpReward,
  }

  battles.set(user.id, battle)
  res.json(battle)
})

app.post('/api/battle/action', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const battle = battles.get(user.id)
  if (!battle || battle.status !== 'active') return res.status(400).json({ error: 'No active battle' })

  const { action, skillName } = req.body
  const monster = monsters.get(user.monsterId)!
  const wild = battle.wildMonster

  // Player's turn
  if (action === 'fight' && skillName) {
    const { damage, effectiveness } = calcDamage(
      { attack: monster.attack, element: monster.element },
      { defense: wild.defense, element: wild.element },
      skillName
    )
    battle.wildCurrentHp = Math.max(0, battle.wildCurrentHp - damage)

    let effText = effectiveness === 'super' ? ' It\'s super effective!' : effectiveness === 'weak' ? ' It\'s not very effective...' : ''
    battle.log.push(`${monster.species} used ${skillName}! Dealt ${damage} damage.${effText}`)

    if (battle.wildCurrentHp <= 0) {
      battle.status = 'victory'
      battle.log.push(`Wild ${wild.species} was defeated!`)
      battle.log.push(`${monster.species} gained ${battle.xpReward} XP!`)

      // Award XP
      monster.xp += battle.xpReward
      while (monster.xp >= monster.xpToNextLevel) {
        monster.xp -= monster.xpToNextLevel
        monster.level += 1
        monster.xpToNextLevel = Math.floor(100 * Math.pow(1.2, monster.level - 1))
        // Stat growth on level up
        monster.maxHp = Math.floor(monster.maxHp * 1.05)
        monster.hp = Math.min(monster.hp + 5, monster.maxHp)
        monster.attack = Math.floor(monster.attack * 1.04)
        monster.defense = Math.floor(monster.defense * 1.04)
        monster.speed = Math.floor(monster.speed * 1.03)
        battle.log.push(`⭐ ${monster.species} leveled up to Lv.${monster.level}!`)
      }

      return res.json(battle)
    }
  } else if (action === 'flee') {
    // Flee chance based on speed
    const fleeChance = Math.min(0.9, monster.speed / (monster.speed + wild.speed) * 1.5)
    if (Math.random() < fleeChance) {
      battle.status = 'fled'
      battle.log.push('Escaped safely!')
      battles.delete(user.id)
      return res.json(battle)
    } else {
      battle.log.push('Can\'t escape!')
    }
  }

  // Enemy turn (if battle still active)
  if (battle.status === 'active') {
    const wildSkill = wild.skills[Math.floor(Math.random() * wild.skills.length)]
    const { damage: wildDmg, effectiveness: wildEff } = calcDamage(
      { attack: wild.attack, element: wild.element },
      { defense: monster.defense, element: monster.element },
      wildSkill
    )
    battle.playerCurrentHp = Math.max(0, battle.playerCurrentHp - wildDmg)
    monster.hp = battle.playerCurrentHp

    let effText2 = wildEff === 'super' ? ' Super effective!' : wildEff === 'weak' ? ' Not very effective...' : ''
    battle.log.push(`Wild ${wild.species} used ${wildSkill}! Dealt ${wildDmg} damage.${effText2}`)

    if (battle.playerCurrentHp <= 0) {
      battle.status = 'defeat'
      monster.hp = Math.floor(monster.maxHp * 0.3)
      battle.log.push(`${monster.species} fainted!`)
      battle.log.push('Returning to Nexus Central...')
    }

    battle.turn++
  }

  res.json(battle)
})

app.get('/api/battle/state', requireAuth, (req: any, res: any) => {
  const user = req.user as User
  const battle = battles.get(user.id)
  if (!battle) return res.status(404).json({ error: 'No active battle' })
  res.json(battle)
})

// ============================================================
// GAME DATA
// ============================================================

app.get('/api/game/species', (_req: any, res: any) => {
  res.json(SPECIES_DATA)
})

app.get('/api/game/skills', (_req: any, res: any) => {
  res.json(SKILLS)
})

// ============================================================
// SERVE GAME
// ============================================================

app.get('/game', (_req: any, res: any) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'game.html'))
})

app.get('/', (_req: any, res: any) => {
  res.redirect('/game')
})

// Health check
app.get('/healthz', (_req: any, res: any) => {
  res.json({ status: 'ok', game: 'CRIAS', timestamp: new Date().toISOString() })
})

export default app
