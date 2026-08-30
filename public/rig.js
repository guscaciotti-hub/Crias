// ============================================================================
// ESTÚDIO DE OSSOS — rigging simples e animações prontas, sem Blender
//
// A ideia: em criatura pequena na tela não é preciso um esqueleto de anatomia
// correta. Bastam poucas juntas (quadril, tronco, cabeça, patas, cauda) e um
// peso por proximidade para as animações prontas — andar, atacar, parado —
// lerem como animação de verdade. O .glb sai com skin e clipes de verdade,
// então funciona no jogo e em qualquer visualizador.
// ============================================================================
import * as THREE from '/vendor/three/three.module.js';
import { GLTFLoader } from '/vendor/three/loaders/GLTFLoader.js';
import { GLTFExporter } from '/vendor/three/exporters/GLTFExporter.js';
import { OrbitControls } from '/vendor/three/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const tela = $('tela');

// ── cena ────────────────────────────────────────────────────────────────
const cena = new THREE.Scene();
cena.background = new THREE.Color(0x0a0e1a);
const cam = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
cam.position.set(0, 1.1, 2.6);
const rend = new THREE.WebGLRenderer({ antialias: true });
rend.outputColorSpace = THREE.SRGBColorSpace;
tela.appendChild(rend.domElement);
const orbita = new OrbitControls(cam, rend.domElement);
orbita.target.set(0, 0.7, 0);

cena.add(new THREE.HemisphereLight(0xdcefff, 0x223044, 2.2));
const sol = new THREE.DirectionalLight(0xffffff, 2.0);
sol.position.set(2.5, 4, 2);
cena.add(sol);
const chao = new THREE.GridHelper(4, 16, 0x2a3c60, 0x1a2740);
cena.add(chao);

function ajusta() {
  const r = tela.getBoundingClientRect();
  cam.aspect = r.width / r.height;
  cam.updateProjectionMatrix();
  rend.setPixelRatio(Math.min(2, devicePixelRatio));
  rend.setSize(r.width, r.height);
}
addEventListener('resize', ajusta); ajusta();

// ── estado ──────────────────────────────────────────────────────────────
let malha = null, modelo = null, juntas = [], selecionada = null;
let modo = 'marcar', esqueleto = null, mixer = null, acaoAtual = null;
const bolas = new THREE.Group(); cena.add(bolas);
const linhas = new THREE.Group(); cena.add(linhas);

const TIPOS = {
  quadril: { cor: 0xffd700, r: 0.055 }, tronco: { cor: 0x4dc3ff, r: 0.05 },
  cabeca:  { cor: 0x3ddc84, r: 0.05 },  cauda:  { cor: 0xff9f43, r: 0.04 },
  pata_fe: { cor: 0xff6b6b, r: 0.04 },  pata_fd: { cor: 0xff6b6b, r: 0.04 },
  pata_te: { cor: 0xc678dd, r: 0.04 },  pata_td: { cor: 0xc678dd, r: 0.04 },
  asa_e:   { cor: 0x56ccf2, r: 0.045 }, asa_d:   { cor: 0x56ccf2, r: 0.045 }
};

// ── abrir modelo ────────────────────────────────────────────────────────
$('abrir').onclick = () => $('arq').click();
$('arq').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const url = URL.createObjectURL(f);
  new GLTFLoader().load(url, g => {
    if (modelo) cena.remove(modelo);
    modelo = g.scene;
    // normaliza: escala para ~1 de altura e apoia no chão
    const caixa = new THREE.Box3().setFromObject(modelo);
    const tam = caixa.getSize(new THREE.Vector3());
    const k = 1 / Math.max(tam.x, tam.y, tam.z);
    modelo.scale.setScalar(k);
    const c2 = new THREE.Box3().setFromObject(modelo);
    modelo.position.y -= c2.min.y;
    modelo.position.x -= (c2.max.x + c2.min.x) / 2;
    modelo.position.z -= (c2.max.z + c2.min.z) / 2;
    cena.add(modelo);
    malha = null;
    modelo.traverse(o => { if (o.isMesh && !malha) malha = o; });
    limpaJuntas();
    const v = malha ? malha.geometry.attributes.position.count : 0;
    $('infoModelo').textContent = f.name + ' · ' + v.toLocaleString('pt-BR') + ' vértices';
    $('dica').textContent = 'clique no modelo para marcar a primeira junta (quadril)';
    montaAnims();
  }, undefined, err => { $('infoModelo').textContent = 'não consegui abrir: ' + err; });
};

// ── marcar juntas ───────────────────────────────────────────────────────
const raio = new THREE.Raycaster(), mouse = new THREE.Vector2();
rend.domElement.addEventListener('pointerdown', ev => {
  if (modo !== 'marcar' || !malha) return;
  const r = rend.domElement.getBoundingClientRect();
  mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
  mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  raio.setFromCamera(mouse, cam);
  const hit = raio.intersectObject(malha, true)[0];
  if (!hit) return;
  poeJunta($('tipoJunta').value, hit.point.clone());
});

function poeJunta(tipo, ponto) {
  const d = TIPOS[tipo] || TIPOS.tronco;
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(d.r, 20, 14),
    new THREE.MeshBasicMaterial({ color: d.cor, transparent: true, opacity: 0.92 })
  );
  g.position.copy(ponto);
  bolas.add(g);
  const j = { tipo, ponto, bola: g, pai: selecionada };
  juntas.push(j);
  selecionada = j;
  // próxima escolha: depois do quadril vem tronco, depois cabeça
  const seq = { quadril: 'tronco', tronco: 'cabeca', cabeca: 'pata_fe',
                pata_fe: 'pata_fd', pata_fd: 'pata_te', pata_te: 'pata_td', pata_td: 'cauda' };
  if (seq[tipo]) $('tipoJunta').value = seq[tipo];
  desenhaOssos();
  listaJuntas();
  $('dica').textContent = juntas.length < 3
    ? 'marque ' + ($('tipoJunta').options[$('tipoJunta').selectedIndex].text)
    : 'marque o que faltar, ou vá para as animações';
}

function desenhaOssos() {
  linhas.clear();
  for (const j of juntas) {
    if (!j.pai) continue;
    const g = new THREE.BufferGeometry().setFromPoints([j.pai.ponto, j.ponto]);
    linhas.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x8ab0dd })));
  }
}

function listaJuntas() {
  const el = $('ossos');
  el.innerHTML = '';
  juntas.forEach((j, i) => {
    const d = document.createElement('div');
    d.className = 'osso' + (j === selecionada ? ' sel' : '');
    d.innerHTML = '<span style="width:11px;height:11px;border-radius:50%;background:#' +
      (TIPOS[j.tipo] || TIPOS.tronco).cor.toString(16).padStart(6, '0') + '"></span>' +
      '<b>' + j.tipo.replace('_', ' ') + '</b>' +
      '<i>' + (j.pai ? 'liga em ' + j.pai.tipo.replace('_', ' ') : 'raiz') + '</i>';
    const x = document.createElement('button');
    x.className = 'gh'; x.textContent = '✕';
    x.onclick = ev => { ev.stopPropagation(); removeJunta(i); };
    d.appendChild(x);
    d.onclick = () => { selecionada = j; listaJuntas(); };
    el.appendChild(d);
  });
  $('baixar').disabled = $('publicar').disabled = juntas.length < 2;
}

function removeJunta(i) {
  const j = juntas[i];
  bolas.remove(j.bola);
  for (const o of juntas) if (o.pai === j) o.pai = j.pai;
  juntas.splice(i, 1);
  if (selecionada === j) selecionada = juntas[juntas.length - 1] || null;
  desenhaOssos(); listaJuntas();
}

function limpaJuntas() {
  juntas = []; selecionada = null;
  bolas.clear(); linhas.clear();
  if (esqueleto) { cena.remove(esqueleto); esqueleto = null; }
  listaJuntas();
  $('tipoJunta').value = 'quadril';
}

// ── sugestão automática de juntas ───────────────────────────────────────
$('auto').onclick = () => {
  if (!malha) return;
  limpaJuntas();
  const cx = new THREE.Box3().setFromObject(modelo);
  const min = cx.min, max = cx.max, meio = cx.getCenter(new THREE.Vector3());
  const alt = max.y - min.y, comp = max.z - min.z, larg = max.x - min.x;
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // o eixo comprido do corpo vira a espinha; as patas vão nos quatro cantos
  poeJunta('quadril', P(meio.x, min.y + alt * 0.55, meio.z + comp * 0.22));
  poeJunta('tronco',  P(meio.x, min.y + alt * 0.62, meio.z - comp * 0.05));
  poeJunta('cabeca',  P(meio.x, min.y + alt * 0.80, meio.z - comp * 0.34));
  selecionada = juntas[0];
  poeJunta('pata_fe', P(meio.x - larg * 0.26, min.y + alt * 0.12, meio.z - comp * 0.22));
  selecionada = juntas[0];
  poeJunta('pata_fd', P(meio.x + larg * 0.26, min.y + alt * 0.12, meio.z - comp * 0.22));
  selecionada = juntas[0];
  poeJunta('pata_te', P(meio.x - larg * 0.26, min.y + alt * 0.12, meio.z + comp * 0.26));
  selecionada = juntas[0];
  poeJunta('pata_td', P(meio.x + larg * 0.26, min.y + alt * 0.12, meio.z + comp * 0.26));
  selecionada = juntas[0];
  poeJunta('cauda',   P(meio.x, min.y + alt * 0.58, meio.z + comp * 0.44));
  $('dica').textContent = 'juntas sugeridas — arraste a cena e ajuste o que estiver fora do lugar';
};

// ── modos ───────────────────────────────────────────────────────────────
$('modoMarcar').onclick = () => { modo = 'marcar'; orbita.enabled = false; sincModo(); };
$('modoGirar').onclick  = () => { modo = 'girar';  orbita.enabled = true;  sincModo(); };
function sincModo() {
  $('modoMarcar').classList.toggle('on', modo === 'marcar');
  $('modoGirar').classList.toggle('on', modo === 'girar');
  $('dica').textContent = modo === 'marcar'
    ? 'clique no modelo para marcar juntas' : 'arraste para girar a cena';
}
sincModo();

// ── animações prontas ───────────────────────────────────────────────────
const ANIMS = {
  parado:  { n: 'idle',   dur: 2.0 },
  andar:   { n: 'walk',   dur: 0.8 },
  atacar:  { n: 'attack', dur: 0.6 },
  apanhar: { n: 'hit',    dur: 0.4 }
};
let ativas = { parado: true, andar: true, atacar: true, apanhar: true };
function montaAnims() {
  const el = $('anims'); el.innerHTML = '';
  for (const k in ANIMS) {
    const b = document.createElement('button');
    b.className = 'gh' + (ativas[k] ? ' on' : '');
    b.textContent = { parado: '🧍 parado', andar: '🚶 andar',
                      atacar: '⚔️ atacar', apanhar: '💥 apanhar' }[k];
    b.onclick = () => {
      ativas[k] = !ativas[k];
      b.classList.toggle('on', ativas[k]);
      if (ativas[k]) tocaPreview(k);
    };
    el.appendChild(b);
  }
}
montaAnims();

// gera os quadros de cada animação, girando as juntas certas
function clipes(ossos, mapa) {
  const saida = [];
  const acha = t => mapa[t] != null ? ossos[mapa[t]] : null;
  const patas = ['pata_fe', 'pata_fd', 'pata_te', 'pata_td'].map(acha).filter(Boolean);
  const cabeca = acha('cabeca'), tronco = acha('tronco'),
        cauda = acha('cauda'), quadril = acha('quadril');
  const asas = ['asa_e', 'asa_d'].map(acha).filter(Boolean);
  const qx = (osso, eixo, ang) => {
    const q = new THREE.Quaternion().setFromAxisAngle(eixo, ang);
    return osso.quaternion.clone().multiply(q);
  };
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const faixas = (osso, tempos, angs, eixo) => new THREE.QuaternionKeyframeTrack(
    osso.name + '.quaternion', tempos,
    angs.flatMap(a => { const q = qx(osso, eixo, a); return [q.x, q.y, q.z, q.w]; })
  );

  if (ativas.parado && (tronco || quadril)) {
    const t = [], alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 1, 2], [0, 0.06, 0], X));
    if (cabeca) t.push(faixas(cabeca, [0, 1, 2], [0, -0.08, 0], X));
    if (cauda)  t.push(faixas(cauda, [0, 0.7, 1.4, 2], [0, 0.16, -0.16, 0], Y));
    saida.push(new THREE.AnimationClip('idle', 2.0, t));
  }
  if (ativas.andar && patas.length) {
    const t = [], D = 0.8;
    patas.forEach((p, i) => {
      const fase = (i % 2) === 0 ? 1 : -1;
      t.push(faixas(p, [0, D / 4, D / 2, 3 * D / 4, D],
        [0, 0.5 * fase, 0, -0.5 * fase, 0], X));
    });
    if (quadril) t.push(new THREE.VectorKeyframeTrack(
      quadril.name + '.position',
      [0, D / 4, D / 2, 3 * D / 4, D],
      [quadril.position.x, quadril.position.y, quadril.position.z,
       quadril.position.x, quadril.position.y + 0.03, quadril.position.z,
       quadril.position.x, quadril.position.y, quadril.position.z,
       quadril.position.x, quadril.position.y + 0.03, quadril.position.z,
       quadril.position.x, quadril.position.y, quadril.position.z]));
    if (cauda) t.push(faixas(cauda, [0, D / 2, D], [0.2, -0.2, 0.2], Y));
    if (asas.length) asas.forEach((a, i) =>
      t.push(faixas(a, [0, D / 2, D], [0.5, -0.5, 0.5], i ? Z : Z)));
    saida.push(new THREE.AnimationClip('walk', D, t));
  }
  if (ativas.atacar && (tronco || quadril || cabeca)) {
    const t = [], D = 0.6, alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 0.18, 0.32, D], [0, -0.35, 0.45, 0], X));
    if (cabeca) t.push(faixas(cabeca, [0, 0.18, 0.32, D], [0, -0.3, 0.55, 0], X));
    patas.slice(0, 2).forEach(p => t.push(faixas(p, [0, 0.2, 0.34, D], [0, -0.7, 0.5, 0], X)));
    saida.push(new THREE.AnimationClip('attack', D, t));
  }
  if (ativas.apanhar && (tronco || quadril)) {
    const t = [], D = 0.4, alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 0.1, 0.22, D], [0, 0.3, -0.15, 0], X));
    if (cabeca) t.push(faixas(cabeca, [0, 0.1, 0.22, D], [0, 0.4, -0.2, 0], X));
    saida.push(new THREE.AnimationClip('hit', D, t));
  }
  return saida;
}

// ── montagem do esqueleto e dos pesos ───────────────────────────────────
function montaRig() {
  if (!malha || juntas.length < 2) return null;
  const ossos = [], mapa = {};
  juntas.forEach((j, i) => {
    const b = new THREE.Bone();
    b.name = j.tipo + '_' + i;
    ossos.push(b); mapa[j.tipo] = i;
  });
  juntas.forEach((j, i) => {
    const b = ossos[i];
    if (j.pai) {
      const ip = juntas.indexOf(j.pai);
      ossos[ip].add(b);
      b.position.copy(j.ponto).sub(j.pai.ponto);
    } else {
      b.position.copy(j.ponto);
    }
  });
  const raiz = ossos[juntas.findIndex(j => !j.pai)] || ossos[0];

  // pesos por proximidade: cada vértice segue a junta mais perto (e a segunda
  // com um resto), o que já basta em criatura pequena
  const geo = malha.geometry.clone();
  const pos = geo.attributes.position;
  const idx = [], peso = [];
  const v = new THREE.Vector3();
  const mundo = new THREE.Matrix4();
  malha.updateWorldMatrix(true, false);
  mundo.copy(malha.matrixWorld);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mundo);
    let a = -1, b = -1, da = Infinity, db = Infinity;
    juntas.forEach((j, k) => {
      const d = v.distanceToSquared(j.ponto);
      if (d < da) { db = da; b = a; da = d; a = k; }
      else if (d < db) { db = d; b = k; }
    });
    const wa = 1 / (Math.sqrt(da) + 1e-4), wb = b >= 0 ? 1 / (Math.sqrt(db) + 1e-4) * 0.55 : 0;
    const s = wa + wb;
    idx.push(a, b >= 0 ? b : a, 0, 0);
    peso.push(wa / s, wb / s, 0, 0);
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(peso, 4));

  const skin = new THREE.SkinnedMesh(geo, malha.material);
  skin.name = 'cria';
  skin.add(raiz);
  const esq = new THREE.Skeleton(ossos);
  skin.bind(esq);
  skin.position.copy(malha.getWorldPosition(new THREE.Vector3()).sub(malha.getWorldPosition(new THREE.Vector3())));
  return { skin, ossos, mapa };
}

function tocaPreview(qual) {
  const r = montaRig(); if (!r) return;
  if (esqueleto) cena.remove(esqueleto);
  esqueleto = new THREE.Group();
  esqueleto.add(r.skin);
  cena.add(esqueleto);
  if (modelo) modelo.visible = false;
  const cs = clipes(r.ossos, r.mapa);
  mixer = new THREE.AnimationMixer(r.skin);
  const nome = ANIMS[qual] ? ANIMS[qual].n : 'idle';
  const c = cs.find(x => x.name === nome) || cs[0];
  if (c) { acaoAtual = mixer.clipAction(c); acaoAtual.play(); }
  $('dica').textContent = 'prévia: ' + (c ? c.name : '—') + ' · clique em outra animação para trocar';
}

// ── exportar ────────────────────────────────────────────────────────────
async function geraGlb() {
  const r = montaRig();
  if (!r) throw new Error('marque pelo menos duas juntas');
  const grupo = new THREE.Group();
  grupo.add(r.skin);
  const cs = clipes(r.ossos, r.mapa);
  const exp = new GLTFExporter();
  return await new Promise((ok, err) => exp.parse(grupo, ok, err,
    { binary: true, animations: cs, onlyVisible: false }));
}
$('baixar').onclick = async () => {
  try {
    $('msg').textContent = 'montando o esqueleto…';
    const bin = await geraGlb();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bin], { type: 'model/gltf-binary' }));
    a.download = ($('criaId').value || 'cria') + '-animado.glb';
    a.click();
    $('msg').textContent = '✅ baixado';
  } catch (e) { $('msg').textContent = 'erro: ' + (e.message || e); }
};

const SB = 'https://gmycqvvvglexbtbqkjzi.supabase.co';
const KEY = 'sb_publishable_N4DdqinjzjnMBWsik5qj2A_ksPBX9Av';
$('publicar').onclick = async () => {
  try {
    if (!window.supabase) { $('msg').textContent = 'biblioteca carregando — tente de novo'; return; }
    $('msg').textContent = 'montando e publicando…';
    const bin = await geraGlb();
    const sb = window.supabase.createClient(SB, KEY);
    const id = $('criaId').value;
    const up = await sb.storage.from('mapas').upload('crias/' + id + '.glb',
      new Blob([bin], { type: 'model/gltf-binary' }),
      { upsert: true, cacheControl: '0', contentType: 'model/gltf-binary' });
    if (up.error) throw up.error;
    $('msg').textContent = '✅ ' + id + ' publicada — entre na caverna para ver';
  } catch (e) { $('msg').textContent = 'erro: ' + (e.message || e); }
};

// lista de Crias do jogo
const CRIAS = ['ignivar','aerix','aquafy','terron','drakon','glacius','florax','toxyl',
               'ferrus','psychon','luminos','shadowyn','voltalon','tempestix','cragmite'];
$('criaId').innerHTML = CRIAS.map(c => '<option value="' + c + '">' + c + '</option>').join('');

// ── laço ────────────────────────────────────────────────────────────────
const relogio = new THREE.Clock();
(function laco() {
  requestAnimationFrame(laco);
  const dt = relogio.getDelta();
  if (mixer) mixer.update(dt);
  orbita.update();
  rend.render(cena, cam);
})();
