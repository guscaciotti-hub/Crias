// Plain JS shim so the app can run without a TypeScript compiler
// Vercel uses its own TS compilation pipeline; this file is for local dev.
import { createServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import crypto from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ============================================================
// DATA TYPES (JS version — no TypeScript)
// ============================================================

// In-memory store
const users    = new Map()
const monsters = new Map()
const sessions = new Map()
const battles  = new Map()

// ============================================================
// SEEDED RNG
// ============================================================
function createRNG(seed) {
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
// SPECIES DATA
// ============================================================
const SPECIES_DATA = {
  Aerix:    { element: 'Air',      baseHp: 60, baseAtk: 65, baseDef: 45, baseSpd: 90, baseInt: 50,  primaryColor: '#7EC8E3', secondaryColor: '#FFFFFF',  auraTypes: ['wind','feather','cloud'],      specialSkill: 'Gale Force',         passiveSkill: 'Wind Rider',  activeSkills: ['Air Slash','Storm Dive','Cyclone Breath','Feather Storm'] },
  Voltalon: { element: 'Electric', baseHp: 55, baseAtk: 70, baseDef: 40, baseSpd: 85, baseInt: 65,  primaryColor: '#FFD700', secondaryColor: '#00BFFF',  auraTypes: ['lightning','spark','thunder'],  specialSkill: 'Thunderstorm',       passiveSkill: 'Static Field',activeSkills: ['Volt Strike','Thunder Wing','Plasma Bolt','Electric Surge'] },
  Ignivar:  { element: 'Fire',     baseHp: 75, baseAtk: 80, baseDef: 50, baseSpd: 65, baseInt: 45,  primaryColor: '#FF4500', secondaryColor: '#FF8C00',  auraTypes: ['flame','ember','inferno'],      specialSkill: 'Volcanic Eruption',  passiveSkill: 'Blaze Aura', activeSkills: ['Flame Bite','Inferno Rush','Fire Fang','Magma Wave'] },
  Aquafy:   { element: 'Water',    baseHp: 70, baseAtk: 55, baseDef: 65, baseSpd: 60, baseInt: 70,  primaryColor: '#00CED1', secondaryColor: '#7FDBFF',  auraTypes: ['wave','bubble','frost'],        specialSkill: 'Tidal Wave',         passiveSkill: 'Hydro Armor',activeSkills: ['Water Pulse','Aqua Beam','Ice Shard','Bubble Burst'] },
  Terron:   { element: 'Earth',    baseHp: 95, baseAtk: 75, baseDef: 85, baseSpd: 30, baseInt: 40,  primaryColor: '#8B4513', secondaryColor: '#228B22',  auraTypes: ['crystal','rock','nature'],      specialSkill: 'Ancient Shatter',    passiveSkill: 'Stone Skin', activeSkills: ['Rock Slam','Earthquake','Stone Edge','Mud Wave'] },
}

const SPECIES_LIST = Object.keys(SPECIES_DATA)
const RARITIES = ['Common','Rare','Epic','Legendary','Mythic']
const RARITY_WEIGHTS = [50,25,15,8,2]
const RARITY_MULT = { Common:1.0, Rare:1.1, Epic:1.25, Legendary:1.45, Mythic:1.7 }
const PERSONALITIES = ['Aggressive','Intelligent','Swift','Guardian','Chaotic']
const PERSONALITY_MODS = {
  Aggressive: { atk:1.2, def:0.9 },
  Intelligent:{ int:1.2, spd:0.9 },
  Swift:      { spd:1.2, atk:0.9 },
  Guardian:   { def:1.2, hp:0.9 },
  Chaotic:    { all:'random' },
}

// ============================================================
// MONSTER GENERATION
// ============================================================
function generateMonster(userId, username) {
  const seed = `${username}-${userId}-${Date.now()}`
  const rng  = createRNG(seed)

  const species = SPECIES_LIST[Math.floor(rng() * SPECIES_LIST.length)]
  const spec    = SPECIES_DATA[species]

  const rarityRoll = rng() * 100
  let rarity = 'Common', cum = 0
  for (let i = 0; i < RARITIES.length; i++) {
    cum += RARITY_WEIGHTS[i]
    if (rarityRoll < cum) { rarity = RARITIES[i]; break }
  }

  const personality = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)]
  const pMod = PERSONALITY_MODS[personality]
  const mult = RARITY_MULT[rarity]

  const chaos = personality === 'Chaotic' ? (0.9 + rng() * 0.2) : 1
  const stat = (base, mod) => Math.floor(base * mult * (mod || 1) * (0.9 + rng() * 0.2) * chaos)

  const hp = stat(spec.baseHp, pMod.hp)

  return {
    id: crypto.randomUUID(),
    ownerId: userId,
    species,
    element: spec.element,
    rarity,
    seed,
    personality,
    primaryColor: spec.primaryColor,
    secondaryColor: spec.secondaryColor,
    auraType: spec.auraTypes[Math.floor(rng() * spec.auraTypes.length)],
    hp,
    maxHp: hp,
    attack: stat(spec.baseAtk, pMod.atk),
    defense: stat(spec.baseDef, pMod.def),
    speed: stat(spec.baseSpd, pMod.spd),
    intelligence: stat(spec.baseInt, pMod.int),
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    specialSkill: spec.specialSkill,
    passiveSkill: spec.passiveSkill,
    activeSkills: spec.activeSkills,
    createdAt: new Date().toISOString(),
  }
}

// ============================================================
// WILD MONSTER GENERATION
// ============================================================
function generateWild(playerLevel, zone) {
  const rng     = createRNG(`wild-${Date.now()}-${Math.random()}`)
  const species = SPECIES_LIST[Math.floor(rng() * SPECIES_LIST.length)]
  const spec    = SPECIES_DATA[species]
  const level   = Math.max(1, playerLevel + Math.floor(rng() * 5) - 2)

  const roll = rng() * 100
  const wr   = roll > 95 ? 'Epic' : roll > 90 ? 'Rare' : 'Common'
  const mult = RARITY_MULT[wr] * (1 + (level - 1) * 0.08)

  return {
    species,
    element: spec.element,
    level,
    hp:      Math.floor(spec.baseHp  * mult),
    maxHp:   Math.floor(spec.baseHp  * mult),
    attack:  Math.floor(spec.baseAtk * mult),
    defense: Math.floor(spec.baseDef * mult),
    speed:   Math.floor(spec.baseSpd * mult),
    rarity:  wr,
    skills:  spec.activeSkills.slice(0, 2),
    primaryColor: spec.primaryColor,
  }
}

// ============================================================
// TYPE CHART + SKILLS
// ============================================================
const TYPE_CHART = {
  Fire:     { Air:1.5, Earth:1.5, Water:0.5, Fire:0.5, Electric:1.0 },
  Water:    { Fire:1.5, Earth:1.5, Electric:0.5, Water:0.5, Air:1.0 },
  Electric: { Water:1.5, Air:1.5, Earth:0.5, Electric:0.5, Fire:1.0 },
  Earth:    { Electric:1.5, Fire:1.5, Water:0.5, Air:0.5, Earth:0.5 },
  Air:      { Earth:1.5, Water:1.5, Fire:0.5, Electric:0.5, Air:0.5 },
}

const SKILLS = {
  'Air Slash':{'power':45,'element':'Air'}, 'Storm Dive':{'power':75,'element':'Air'},
  'Cyclone Breath':{'power':55,'element':'Air'}, 'Feather Storm':{'power':35,'element':'Air'},
  'Volt Strike':{'power':50,'element':'Electric'}, 'Thunder Wing':{'power':70,'element':'Electric'},
  'Plasma Bolt':{'power':60,'element':'Electric'}, 'Electric Surge':{'power':40,'element':'Electric'},
  'Flame Bite':{'power':55,'element':'Fire'}, 'Inferno Rush':{'power':80,'element':'Fire'},
  'Fire Fang':{'power':50,'element':'Fire'}, 'Magma Wave':{'power':65,'element':'Fire'},
  'Water Pulse':{'power':45,'element':'Water'}, 'Aqua Beam':{'power':70,'element':'Water'},
  'Ice Shard':{'power':50,'element':'Water'}, 'Bubble Burst':{'power':40,'element':'Water'},
  'Rock Slam':{'power':60,'element':'Earth'}, 'Earthquake':{'power':85,'element':'Earth'},
  'Stone Edge':{'power':70,'element':'Earth'}, 'Mud Wave':{'power':45,'element':'Earth'},
}

function calcDamage(atk, def, atkElem, defElem, skillName) {
  const skill = SKILLS[skillName] || { power:40, element:atkElem }
  const typeMult = (TYPE_CHART[skill.element] || {})[defElem] || 1.0
  const variance = 0.85 + Math.random() * 0.15
  const dmg = Math.floor((atk * skill.power / 50 / (def * 0.5 + 1)) * typeMult * variance)
  const eff = typeMult > 1 ? 'super' : typeMult < 1 ? 'weak' : 'normal'
  return { damage: Math.max(1, dmg), effectiveness: eff }
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
function requireAuth(req, res, next) {
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
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' })
  if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Usuário: 3 a 20 caracteres' })
  if (users.has(username.toLowerCase())) return res.status(409).json({ error: 'Nome de usuário já existe' })

  const userId = crypto.randomUUID()
  const token  = crypto.randomBytes(32).toString('hex')
  const hash   = crypto.createHash('sha256').update(password + userId).digest('hex')
  const monster = generateMonster(userId, username)
  monsters.set(monster.id, monster)

  const user = { id: userId, username: username.toLowerCase(), passwordHash: hash,
                 sessionToken: token, monsterId: monster.id,
                 position: { scene:'nexus', x:9, y:12 }, createdAt: new Date().toISOString() }
  users.set(username.toLowerCase(), user)
  sessions.set(token, userId)

  res.json({ token, user: { id: userId, username: user.username }, monster, isNew: true })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' })

  const user = users.get(username.toLowerCase())
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

  const hash = crypto.createHash('sha256').update(password + user.id).digest('hex')
  if (hash !== user.passwordHash) return res.status(401).json({ error: 'Credenciais inválidas' })

  if (user.sessionToken) sessions.delete(user.sessionToken)
  const token = crypto.randomBytes(32).toString('hex')
  user.sessionToken = token
  sessions.set(token, user.id)

  const monster = monsters.get(user.monsterId)
  res.json({ token, user: { id: user.id, username: user.username }, monster, isNew: false })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const monster = monsters.get(req.user.monsterId)
  res.json({ user: { id: req.user.id, username: req.user.username, position: req.user.position }, monster })
})

// ============================================================
// GAME ROUTES
// ============================================================
app.get('/api/game/monster', requireAuth, (req, res) => {
  const m = monsters.get(req.user.monsterId)
  if (!m) return res.status(404).json({ error: 'Monster not found' })
  res.json(m)
})

app.post('/api/game/position', requireAuth, (req, res) => {
  const { scene, x, y } = req.body
  req.user.position = { scene, x, y }
  res.json({ ok: true })
})

// ============================================================
// BATTLE ROUTES
// ============================================================
app.post('/api/battle/start', requireAuth, (req, res) => {
  const { zone } = req.body
  battles.delete(req.user.id)

  const monster = monsters.get(req.user.monsterId)
  if (!monster) return res.status(400).json({ error: 'Monster not found' })
  if (monster.hp <= 0) {
    monster.hp = Math.floor(monster.maxHp * 0.5)
    return res.status(400).json({ error: 'Seu monstro desmaiou! Voltando ao Nexus.', healed: true })
  }

  const wild = generateWild(monster.level, zone || 'cave')
  const xpReward = Math.floor(wild.level * 20 * RARITY_MULT[wild.rarity])

  const battle = {
    id: crypto.randomUUID(), playerId: req.user.id,
    playerMonsterSnapshot: { ...monster },
    wildMonster: wild,
    playerCurrentHp: monster.hp, wildCurrentHp: wild.hp,
    turn: 1, isPlayerTurn: monster.speed >= wild.speed,
    log: [`Um ${wild.rarity !== 'Common' ? `[${wild.rarity}] ` : ''}${wild.species} selvagem apareceu! (Nv.${wild.level})`],
    status: 'active', xpReward,
  }
  battles.set(req.user.id, battle)
  res.json(battle)
})

app.post('/api/battle/action', requireAuth, (req, res) => {
  const battle = battles.get(req.user.id)
  if (!battle || battle.status !== 'active') return res.status(400).json({ error: 'Sem batalha ativa' })

  const { action, skillName } = req.body
  const monster = monsters.get(req.user.monsterId)
  const wild = battle.wildMonster

  if (action === 'fight' && skillName) {
    const { damage, effectiveness } = calcDamage(monster.attack, wild.defense, monster.element, wild.element, skillName)
    battle.wildCurrentHp = Math.max(0, battle.wildCurrentHp - damage)

    const eff = effectiveness === 'super' ? ' É super efetivo!' : effectiveness === 'weak' ? ' Não é muito efetivo...' : ''
    battle.log.push(`${monster.species} usou ${skillName}! Causou ${damage} de dano.${eff}`)

    if (battle.wildCurrentHp <= 0) {
      battle.status = 'victory'
      battle.log.push(`${wild.species} selvagem foi derrotado!`)
      battle.log.push(`${monster.species} ganhou ${battle.xpReward} XP!`)

      monster.xp += battle.xpReward
      while (monster.xp >= monster.xpToNextLevel) {
        monster.xp -= monster.xpToNextLevel
        monster.level++
        monster.xpToNextLevel = Math.floor(100 * Math.pow(1.2, monster.level - 1))
        monster.maxHp   = Math.floor(monster.maxHp   * 1.05)
        monster.hp      = Math.min(monster.hp + 5, monster.maxHp)
        monster.attack  = Math.floor(monster.attack  * 1.04)
        monster.defense = Math.floor(monster.defense * 1.04)
        monster.speed   = Math.floor(monster.speed   * 1.03)
        battle.log.push(`⭐ ${monster.species} subiu para Nv.${monster.level}!`)
      }
      return res.json(battle)
    }
  } else if (action === 'flee') {
    const chance = Math.min(0.9, monster.speed / (monster.speed + wild.speed) * 1.5)
    if (Math.random() < chance) {
      battle.status = 'fled'
      battle.log.push('Fugiu com sucesso!')
      battles.delete(req.user.id)
      return res.json(battle)
    }
    battle.log.push('Não conseguiu fugir!')
  }

  if (battle.status === 'active') {
    const ws  = wild.skills[Math.floor(Math.random() * wild.skills.length)]
    const { damage: wd, effectiveness: we } = calcDamage(wild.attack, monster.defense, wild.element, monster.element, ws)
    battle.playerCurrentHp = Math.max(0, battle.playerCurrentHp - wd)
    monster.hp = battle.playerCurrentHp

    const eff2 = we === 'super' ? ' Super efetivo!' : we === 'weak' ? ' Não muito efetivo...' : ''
    battle.log.push(`${wild.species} selvagem usou ${ws}! Causou ${wd} de dano.${eff2}`)

    if (battle.playerCurrentHp <= 0) {
      battle.status = 'defeat'
      monster.hp = Math.floor(monster.maxHp * 0.3)
      battle.log.push(`${monster.species} desmaiou!`)
      battle.log.push('Voltando ao Nexus Central...')
    }
    battle.turn++
  }
  res.json(battle)
})

app.get('/api/battle/state', requireAuth, (req, res) => {
  const battle = battles.get(req.user.id)
  if (!battle) return res.status(404).json({ error: 'No active battle' })
  res.json(battle)
})

// ============================================================
// SERVE GAME
// ============================================================
app.get('/game', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'game.html')))
app.get('/',     (_req, res) => res.redirect('/game'))
app.get('/healthz', (_req, res) => res.json({ status: 'ok', game: 'CRIAS', ts: new Date().toISOString() }))

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000
createServer(app).listen(PORT, () => {
  console.log(`\n🎮 CRIAS running → http://localhost:${PORT}\n`)
})
