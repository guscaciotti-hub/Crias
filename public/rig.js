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
    modelo.userData.escBase = k;
    modelo.scale.setScalar(k);
    const c2 = new THREE.Box3().setFromObject(modelo);
    modelo.position.y -= c2.min.y;
    modelo.position.x -= (c2.max.x + c2.min.x) / 2;
    modelo.position.z -= (c2.max.z + c2.min.z) / 2;
    cena.add(modelo);
    malha = null;
    modelo.traverse(o => { if (o.isMesh && !malha) malha = o; });
    limpaJuntas();
    $('rx').value = $('ry').value = $('rz').value = 0; $('esc').value = 100;
    aplicaPose();
    const v = malha ? malha.geometry.attributes.position.count : 0;
    $('infoModelo').textContent = f.name + ' · ' + v.toLocaleString('pt-BR') + ' vértices';
    $('dica').textContent = 'clique no modelo para marcar a primeira junta (quadril)';
    montaAnims();
  }, undefined, err => { $('infoModelo').textContent = 'não consegui abrir: ' + err; });
};

// ── desfazer / refazer ──────────────────────────────────────────────────
// Clicar sem querer no modelo cria uma junta, então tudo que mexe nas juntas
// passa por aqui primeiro. Guarda o estado inteiro: é barato (são poucas
// juntas) e nunca deixa a árvore inconsistente.
const HIST = [], REFAZ = [];
function estado() {
  return juntas.map(j => ({ tipo: j.tipo, ponto: j.ponto.clone(),
                            pai: j.pai ? juntas.indexOf(j.pai) : -1 }));
}
function aplica(lista) {
  bolas.clear(); linhas.clear();
  juntas = lista.map(d => {
    const cfg = TIPOS[d.tipo] || TIPOS.tronco;
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.r, 20, 14),
      new THREE.MeshBasicMaterial({ color: cfg.cor, transparent: true, opacity: 0.92 })
    );
    g.position.copy(d.ponto);
    bolas.add(g);
    return { tipo: d.tipo, ponto: d.ponto.clone(), bola: g, pai: null };
  });
  lista.forEach((d, i) => { if (d.pai >= 0) juntas[i].pai = juntas[d.pai]; });
  selecionada = juntas[juntas.length - 1] || null;
  desenhaOssos(); listaJuntas();
  if (esqueleto) { cena.remove(esqueleto); esqueleto = null; mixer = null; }
  if (modelo) modelo.visible = true;
}
function guarda() { HIST.push(estado()); if (HIST.length > 80) HIST.shift(); REFAZ.length = 0; }
function desfazer() {
  if (!HIST.length) { $('dica').textContent = 'nada para desfazer'; return; }
  REFAZ.push(estado());
  aplica(HIST.pop());
  $('dica').textContent = 'desfeito (' + HIST.length + ' passos atrás · Ctrl+Y refaz)';
}
function refazer() {
  if (!REFAZ.length) { $('dica').textContent = 'nada para refazer'; return; }
  HIST.push(estado());
  aplica(REFAZ.pop());
  $('dica').textContent = 'refeito (' + REFAZ.length + ' à frente)';
}
$('btDesfazer').onclick = desfazer;
$('btRefazer').onclick = refazer;
addEventListener('keydown', e => {
  const k = (e.key || '').toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z' && e.shiftKey) { e.preventDefault(); refazer(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); desfazer(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); refazer(); return; }
});

// ── ajustar o modelo (girar, virar de frente, tamanho) ──────────────────
// O .glb do Meshy às vezes vem deitado, de costas ou fora de escala. Acertar
// aqui antes de marcar as juntas evita rig torto — e como as juntas seguem o
// modelo, elas acompanham qualquer mudança.
function aplicaPose() {
  if (!modelo) return;
  const g = Math.PI / 180;
  modelo.rotation.set(+$('rx').value * g, +$('ry').value * g, +$('rz').value * g);
  const k = (+$('esc').value / 100) * (modelo.userData.escBase || 1);
  modelo.scale.setScalar(k);
  modelo.updateMatrixWorld(true);
  // reapoia no chão e centraliza depois de girar
  const cx = new THREE.Box3().setFromObject(modelo);
  modelo.position.y -= cx.min.y;
  modelo.position.x -= (cx.max.x + cx.min.x) / 2;
  modelo.position.z -= (cx.max.z + cx.min.z) / 2;
  modelo.updateMatrixWorld(true);
  $('rxV').textContent = $('rx').value + '°';
  $('ryV').textContent = $('ry').value + '°';
  $('rzV').textContent = $('rz').value + '°';
  $('escV').textContent = (+$('esc').value / 100).toFixed(2);
  if (juntas.length) {
    limpaJuntas();          // guarda antes: Ctrl+Z traz as juntas de volta
    $('dica').textContent = 'modelo girado — marque as juntas de novo (Ctrl+Z desfaz)';
  }
}
['rx','ry','rz','esc'].forEach(id => { $(id).oninput = aplicaPose; });
$('deitar').onclick = () => {
  $('rx').value = (+$('rx').value + 90) % 360 > 180 ? -90 : 90;
  aplicaPose();
};
$('zerar').onclick = () => {
  $('rx').value = $('ry').value = $('rz').value = 0;
  $('esc').value = 100;
  aplicaPose();
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

// O pai de cada junta vem da anatomia, não da ordem em que você clicou.
// Antes, cada junta nova se ligava na anterior e a cadeia virava uma fila
// (cauda → pata → pata → tronco), o que torcia o bicho inteiro ao animar.
const PAI_DE = {
  quadril: null, tronco: 'quadril', cabeca: 'tronco', cauda: 'quadril',
  pata_fe: 'tronco', pata_fd: 'tronco', pata_te: 'quadril', pata_td: 'quadril',
  asa_e: 'tronco', asa_d: 'tronco'
};
function achaPai(tipo) {
  if (PAI_DE[tipo] === null) return null;      // o quadril é a raiz, sempre
  let alvo = PAI_DE[tipo];
  while (alvo) {
    const j = juntas.find(x => x.tipo === alvo);
    if (j) return j;
    alvo = PAI_DE[alvo];            // sem tronco? sobe para o quadril
  }
  return juntas.find(x => !x.pai) || null;
}
// nenhuma junta pode ser ancestral dela mesma
function temCiclo(j) {
  const vistos = new Set();
  let p = j;
  while (p) { if (vistos.has(p)) return true; vistos.add(p); p = p.pai; }
  return false;
}

function poeJunta(tipo, ponto, semHistorico) {
  if (!semHistorico) guarda();
  const d = TIPOS[tipo] || TIPOS.tronco;
  const g = new THREE.Mesh(
    new THREE.SphereGeometry(d.r, 20, 14),
    new THREE.MeshBasicMaterial({ color: d.cor, transparent: true, opacity: 0.92 })
  );
  g.position.copy(ponto);
  bolas.add(g);
  const j = { tipo, ponto, bola: g, pai: achaPai(tipo) };
  juntas.push(j);
  selecionada = j;
  // uma junta criada antes do seu pai natural passa a se ligar nele
  for (const o of juntas) if (o !== j && PAI_DE[o.tipo] === tipo) o.pai = j;
  // o quadril chegou depois: quem virou raiz por falta dele volta ao lugar
  if (PAI_DE[tipo] === null) for (const o of juntas) if (o !== j && !o.pai) o.pai = j;
  for (const o of juntas) if (temCiclo(o)) o.pai = achaPai(o.tipo);
  const raizes = juntas.filter(x => !x.pai);
  if (raizes.length > 1) { const r0 = raizes.find(x => PAI_DE[x.tipo] === null) || raizes[0];
    for (const o of raizes) if (o !== r0) o.pai = r0; }
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
    d.title = 'ligada em ' + (j.pai ? j.pai.tipo : 'nada (raiz)');
    el.appendChild(d);
  });
  $('baixar').disabled = $('publicar').disabled = juntas.length < 2;
}

function removeJunta(i) {
  guarda();
  const j = juntas[i];
  bolas.remove(j.bola);
  for (const o of juntas) if (o.pai === j) o.pai = j.pai;
  juntas.splice(i, 1);
  if (selecionada === j) selecionada = juntas[juntas.length - 1] || null;
  desenhaOssos(); listaJuntas();
}

function limpaJuntas(semHistorico) {
  if (!semHistorico && juntas.length) guarda();
  juntas = []; selecionada = null;
  bolas.clear(); linhas.clear();
  if (esqueleto) { cena.remove(esqueleto); esqueleto = null; }
  listaJuntas();
  $('tipoJunta').value = 'quadril';
}

// ── sugestão automática de juntas ───────────────────────────────────────
$('auto').onclick = () => {
  if (!malha) return;
  guarda();
  limpaJuntas(true);
  const cx = new THREE.Box3().setFromObject(modelo);
  const min = cx.min, max = cx.max, meio = cx.getCenter(new THREE.Vector3());
  const alt = max.y - min.y;
  // A criatura pode vir deitada em qualquer eixo: o lado MAIS COMPRIDO no
  // plano do chão é o corpo (nariz-cauda), o outro é a largura. Sem isso as
  // juntas caíam todas no meio, como aconteceu com o lobo virado em X.
  const dx = max.x - min.x, dz = max.z - min.z;
  const eixoZ = dz >= dx;                 // true: corpo ao longo do Z
  const comp = eixoZ ? dz : dx, larg = eixoZ ? dx : dz;
  // ponto no corpo: f = ao longo do comprimento (-1 nariz, +1 cauda),
  //                 l = lado (-1 esquerda, +1 direita), y = altura relativa
  const P = (f, l, y) => eixoZ
    ? new THREE.Vector3(meio.x + l * larg / 2, min.y + alt * y, meio.z + f * comp / 2)
    : new THREE.Vector3(meio.x + f * comp / 2, min.y + alt * y, meio.z + l * larg / 2);
  poeJunta('quadril', P( 0.22, 0, 0.55), true);
  poeJunta('tronco',  P(-0.05, 0, 0.62), true);
  poeJunta('cabeca',  P(-0.38, 0, 0.78), true);
  poeJunta('pata_fe', P(-0.22, -0.52, 0.12), true);
  poeJunta('pata_fd', P(-0.22,  0.52, 0.12), true);
  poeJunta('pata_te', P( 0.26, -0.52, 0.12), true);
  poeJunta('pata_td', P( 0.26,  0.52, 0.12), true);
  poeJunta('cauda',   P( 0.46, 0, 0.58), true);
  $('dica').textContent = 'juntas sugeridas — confira e ajuste o que estiver fora do lugar';
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
// Clicar no nome TOCA a prévia (era o que faltava: antes o clique só ligava
// e desligava a animação, então a primeira vez que se clicava em 'andar' ela
// sumia em vez de tocar). O ✓ ao lado é que decide se ela vai no arquivo.
let previaAtual = null;
function montaAnims() {
  const el = $('anims'); el.innerHTML = '';
  const RÓTULO = { parado: '🧍 parado', andar: '🚶 andar',
                   atacar: '⚔️ atacar', apanhar: '💥 apanhar' };
  for (const k in ANIMS) {
    const linha = document.createElement('div');
    linha.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
    const b = document.createElement('button');
    b.className = 'gh' + (previaAtual === k ? ' on' : '');
    b.textContent = RÓTULO[k];
    b.style.margin = '0';
    b.onclick = () => { previaAtual = k; montaAnims(); tocaPreview(k); };
    const inc = document.createElement('button');
    inc.className = 'gh' + (ativas[k] ? ' on' : '');
    inc.textContent = ativas[k] ? '✓' : '✗';
    inc.title = ativas[k] ? 'vai no arquivo' : 'fora do arquivo';
    inc.style.cssText = 'width:42px;margin:0';
    inc.onclick = () => { ativas[k] = !ativas[k]; montaAnims(); };
    linha.appendChild(b); linha.appendChild(inc);
    el.appendChild(linha);
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
  // Eixos do CORPO, não do mundo. A frente é do quadril para a cabeça, então
  // 'avançar' e 'dar o bote' funcionam mesmo com o modelo deitado em X — era
  // por isso que o ataque parecia tombar de lado em vez de atacar.
  const Y = new THREE.Vector3(0, 1, 0);
  let frente = new THREE.Vector3(0, 0, -1);
  const jc = juntas.find(j => j.tipo === 'cabeca'), jq = juntas.find(j => j.tipo === 'quadril');
  if (jc && jq) {
    frente = jc.ponto.clone().sub(jq.ponto);
    frente.y = 0;
    if (frente.lengthSq() < 1e-6) frente.set(0, 0, -1);
    frente.normalize();
  }
  const LADO = new THREE.Vector3().crossVectors(Y, frente).normalize();  // eixo das passadas
  const X = LADO, Z = frente;
  const faixas = (osso, tempos, angs, eixo) => new THREE.QuaternionKeyframeTrack(
    osso.name + '.quaternion', tempos,
    angs.flatMap(a => { const q = qx(osso, eixo, a); return [q.x, q.y, q.z, q.w]; })
  );

  if (ativas.parado && (tronco || quadril)) {
    const t = [], alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 1, 2], [0, 0.05, 0], LADO));
    if (cabeca) t.push(faixas(cabeca, [0, 1, 2], [0, -0.07, 0], LADO));
    if (cauda)  t.push(faixas(cauda, [0, 0.7, 1.4, 2], [0, 0.16, -0.16, 0], Y));
    saida.push(new THREE.AnimationClip('idle', 2.0, t));
  }
  if (ativas.andar && patas.length) {
    const t = [], D = 0.8;
    // trote: as patas cruzadas andam juntas, como em quadrúpede de verdade
    const ordem = ['pata_fe', 'pata_td', 'pata_fd', 'pata_te'];
    ordem.forEach((tp, i) => {
      const p = acha(tp); if (!p) return;
      const fase = i < 2 ? 1 : -1;
      t.push(faixas(p, [0, D / 4, D / 2, 3 * D / 4, D],
        [0, 0.5 * fase, 0, -0.5 * fase, 0], LADO));
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
    // recua para tomar impulso (0.16), estica no bote (0.30) e assenta (D)
    const t = [], D = 0.62, alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 0.16, 0.30, 0.44, D], [0, -0.30, 0.42, 0.10, 0], LADO));
    if (cabeca) t.push(faixas(cabeca, [0, 0.16, 0.30, 0.44, D], [0, -0.34, 0.52, 0.12, 0], LADO));
    // as patas da frente acompanham o bote, as de trás firmam o apoio
    const frentes = ['pata_fe', 'pata_fd'].map(acha).filter(Boolean);
    const tras = ['pata_te', 'pata_td'].map(acha).filter(Boolean);
    frentes.forEach(p => t.push(faixas(p, [0, 0.16, 0.30, 0.44, D], [0, -0.55, 0.75, 0.15, 0], LADO)));
    tras.forEach(p => t.push(faixas(p, [0, 0.16, 0.30, D], [0, 0.28, -0.12, 0], LADO)));
    if (cauda) t.push(faixas(cauda, [0, 0.16, 0.30, D], [0, 0.30, -0.25, 0], LADO));
    if (quadril) t.push(new THREE.VectorKeyframeTrack(
      quadril.name + '.position',
      [0, 0.16, 0.30, D],
      [quadril.position.x, quadril.position.y, quadril.position.z,
       quadril.position.x - frente.x * 0.05, quadril.position.y - 0.02, quadril.position.z - frente.z * 0.05,
       quadril.position.x + frente.x * 0.09, quadril.position.y + 0.02, quadril.position.z + frente.z * 0.09,
       quadril.position.x, quadril.position.y, quadril.position.z]));
    saida.push(new THREE.AnimationClip('attack', D, t));
  }
  if (ativas.apanhar && (tronco || quadril)) {
    const t = [], D = 0.4, alvo = tronco || quadril;
    t.push(faixas(alvo, [0, 0.1, 0.22, D], [0, 0.3, -0.15, 0], LADO));
    if (cabeca) t.push(faixas(cabeca, [0, 0.1, 0.22, D], [0, 0.4, -0.2, 0], LADO));
    saida.push(new THREE.AnimationClip('hit', D, t));
  }
  return saida;
}

// ── montagem do esqueleto e dos pesos ───────────────────────────────────
function montaRig() {
  if (!malha || juntas.length < 2) return null;
  if (!juntas.some(j => j.tipo === 'tronco' || j.tipo === 'quadril')) {
    $('dica').textContent = '⚠ marque o QUADRIL e o TRONCO — sem eles o corpo se prende às patas e torce ao animar';
  }
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

  // Alcance por tipo de junta. Sem isto, uma pata podia ser a junta mais
  // perto de um vértice do lombo — e girar a pata torcia o corpo inteiro.
  // Membros só levam o que está por perto; o tronco e o quadril seguram o
  // resto do corpo, que é o que faz a criatura parecer firme ao andar.
  const cxAll = new THREE.Box3().setFromObject(modelo);
  const diag = cxAll.getSize(new THREE.Vector3()).length() || 1;
  const ALCANCE = {
    pata_fe: 0.30, pata_fd: 0.30, pata_te: 0.30, pata_td: 0.30,
    cauda: 0.34, asa_e: 0.38, asa_d: 0.38, cabeca: 0.30,
    tronco: Infinity, quadril: Infinity
  };
  const ehCorpo = t => t === 'tronco' || t === 'quadril';
  const temCorpo = juntas.some(j => ehCorpo(j.tipo));

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
      const alcance = (ALCANCE[j.tipo] != null ? ALCANCE[j.tipo] : 0.3) * diag;
      const d = v.distanceToSquared(j.ponto);
      // membro fora do alcance nem entra na disputa (quando há corpo para
      // segurar o vértice); sem corpo marcado, vale a proximidade pura
      if (temCorpo && !ehCorpo(j.tipo) && d > alcance * alcance) return;
      if (d < da) { db = da; b = a; da = d; a = k; }
      else if (d < db) { db = d; b = k; }
    });
    if (a < 0) {   // nada alcançou: vai para o corpo mais próximo
      juntas.forEach((j, k) => {
        if (!ehCorpo(j.tipo)) return;
        const d = v.distanceToSquared(j.ponto);
        if (d < da) { da = d; a = k; }
      });
      if (a < 0) a = 0;
    }
    // queda acentuada: o vértice fica preso à junta mais perto, e a segunda
    // só entra na costura entre as duas. Sem isso, mexer numa pata arrastava
    // o corpo todo e o bicho se desmontava.
    const ra = Math.sqrt(da), rb = Math.sqrt(db);
    const wa = 1 / (ra * ra * ra + 1e-6);
    const wb = (b >= 0 && rb < ra * 2.2) ? 1 / (rb * rb * rb + 1e-6) : 0;
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
// O .glb do Meshy carrega texturas em 2K/4K e passa do limite de envio. Como
// na batalha a criatura tem poucas dezenas de pixels, dá para encolher as
// texturas sem perda visível — e é isso que faz o arquivo caber.
function encolheTexturas(raiz, lado) {
  const feitas = new Map();
  raiz.traverse(o => {
    const m = o.material;
    if (!m) return;
    for (const mat of (Array.isArray(m) ? m : [m])) {
      for (const campo of ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
        const tex = mat[campo];
        if (!tex || !tex.image) continue;
        const w = tex.image.width || tex.image.videoWidth;
        const h = tex.image.height || tex.image.videoHeight;
        if (!w || !h || Math.max(w, h) <= lado) continue;
        const chave = tex.uuid + '@' + lado;
        let nova = feitas.get(chave);
        if (!nova) {
          const k = lado / Math.max(w, h);
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k));
          c.height = Math.max(1, Math.round(h * k));
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = true;
          g.drawImage(tex.image, 0, 0, c.width, c.height);
          nova = tex.clone();
          nova.image = c;
          nova.needsUpdate = true;
          feitas.set(chave, nova);
        }
        mat[campo] = nova;
      }
      mat.needsUpdate = true;
    }
  });
}

async function geraGlb(ladoTextura) {
  const r = montaRig();
  if (!r) throw new Error('marque pelo menos duas juntas');
  const grupo = new THREE.Group();
  grupo.add(r.skin);
  if (ladoTextura) encolheTexturas(grupo, ladoTextura);
  const cs = clipes(r.ossos, r.mapa);
  const exp = new GLTFExporter();
  return await new Promise((ok, err) => exp.parse(grupo, ok, err,
    { binary: true, animations: cs, onlyVisible: false }));
}
$('baixar').onclick = async () => {
  try {
    $('msg').textContent = 'montando o esqueleto…';
    const bin = await geraGlb(1024);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bin], { type: 'model/gltf-binary' }));
    a.download = ($('criaId').value || 'cria') + '-animado.glb';
    a.click();
    $('msg').textContent = '✅ baixado';
  } catch (e) { $('msg').textContent = 'erro: ' + (e.message || e); }
};

const SB = 'https://gmycqvvvglexbtbqkjzi.supabase.co';
const KEY = 'sb_publishable_N4DdqinjzjnMBWsik5qj2A_ksPBX9Av';
const eDeTamanho = e => /exceed|maximum allowed size|payload|too large|413/i.test(String((e && e.message) || e));
$('publicar').onclick = async () => {
  try {
    if (!window.supabase) { $('msg').textContent = 'biblioteca carregando — tente de novo'; return; }
    const sb = window.supabase.createClient(SB, KEY);
    const id = $('criaId').value;
    // tenta com textura cheia e vai encolhendo até o servidor aceitar
    for (const lado of [1024, 512, 256, 128, 64]) {
      $('msg').textContent = 'montando (textura ' + lado + 'px)…';
      const bin = await geraGlb(lado);
      const mb = bin.byteLength / 1048576;
      $('msg').textContent = 'enviando (' + mb.toFixed(1) + ' MB)…';
      const up = await sb.storage.from('mapas').upload('crias/' + id + '.glb',
        new Blob([bin], { type: 'model/gltf-binary' }),
        { upsert: true, cacheControl: '0', contentType: 'model/gltf-binary' });
      if (!up.error) {
        $('msg').textContent = '✅ ' + id + ' publicada (' + mb.toFixed(1) +
          ' MB, textura ' + lado + 'px) — entre na caverna para ver';
        return;
      }
      if (!eDeTamanho(up.error)) throw up.error;
    }
    $('msg').textContent = 'o servidor recusou até com textura de 64px — a malha é que ' +
      'está pesada. No Meshy, baixe o modelo em Low poly (~10k triângulos).';
  } catch (e) { $('msg').textContent = 'erro: ' + (e.message || e); }
};

// lista de Crias do jogo
const CRIAS = ['ignivar','aerix','aquafy','terron','drakon','glacius','florax','toxyl',
               'ferrus','psychon','luminos','shadowyn','voltalon','tempestix','cragmite'];
$('criaId').innerHTML = CRIAS.map(c => '<option value="' + c + '">' + c + '</option>').join('');

// para depuração e testes automáticos
window.__rig = { get cena() { return cena; }, get juntas() { return juntas; },
                 get esqueleto() { return esqueleto; } };

// ── laço ────────────────────────────────────────────────────────────────
const relogio = new THREE.Clock();
(function laco() {
  requestAnimationFrame(laco);
  const dt = relogio.getDelta();
  if (mixer) mixer.update(dt);
  orbita.update();
  rend.render(cena, cam);
})();
