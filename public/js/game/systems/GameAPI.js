// ============================================================
// CRIAS — Game API Client
// ============================================================

const GameAPI = (() => {
  const BASE = '/api'

  function getToken() {
    return localStorage.getItem('crias_token')
  }

  function setToken(t) {
    localStorage.setItem('crias_token', t)
  }

  function clearToken() {
    localStorage.removeItem('crias_token')
    localStorage.removeItem('crias_user')
    localStorage.removeItem('crias_monster')
  }

  function saveSession(data) {
    if (data.token) setToken(data.token)
    if (data.user) localStorage.setItem('crias_user', JSON.stringify(data.user))
    if (data.monster) localStorage.setItem('crias_monster', JSON.stringify(data.monster))
  }

  function getCachedUser() {
    try { return JSON.parse(localStorage.getItem('crias_user') || 'null') } catch { return null }
  }

  function getCachedMonster() {
    try { return JSON.parse(localStorage.getItem('crias_monster') || 'null') } catch { return null }
  }

  async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' }
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`

    const opts = { method, headers }
    if (body) opts.body = JSON.stringify(body)

    const res = await fetch(BASE + path, opts)
    const data = await res.json()

    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }

  async function register(username, password) {
    const data = await request('POST', '/auth/register', { username, password })
    saveSession(data)
    return data
  }

  async function login(username, password) {
    const data = await request('POST', '/auth/login', { username, password })
    saveSession(data)
    return data
  }

  async function getMe() {
    const data = await request('GET', '/auth/me')
    if (data.monster) localStorage.setItem('crias_monster', JSON.stringify(data.monster))
    return data
  }

  async function getMonster() {
    return request('GET', '/game/monster')
  }

  async function savePosition(scene, x, y) {
    return request('POST', '/game/position', { scene, x, y }).catch(() => {})
  }

  async function startBattle(zone = 'cave') {
    return request('POST', '/battle/start', { zone })
  }

  async function battleAction(action, skillName = null) {
    return request('POST', '/battle/action', { action, skillName })
  }

  async function getBattleState() {
    return request('GET', '/battle/state')
  }

  return {
    getToken,
    setToken,
    clearToken,
    saveSession,
    getCachedUser,
    getCachedMonster,
    register,
    login,
    getMe,
    getMonster,
    savePosition,
    startBattle,
    battleAction,
    getBattleState,
  }
})()
