#!/usr/bin/env python3
"""Compositor do mapa oficial: monta o mapa a partir de peças (map-kit) sobre
o layout declarativo, usando a COLLISION do jogo como fonte da verdade.

Uso: python3 tools/build_map.py [--collision collision.json] [--out public/mapa-oficial.jpg]

Camadas (de baixo pra cima):
  1. chão: grama em tudo; água, praça e caminhos por cima (com borda suavizada)
  2. edifícios (declarados no layout)
  3. vegetação automática: TODO tile bloqueado na COLLISION que não é água nem
     edifício vira árvore/pinheiro/pedra (variação por hash da posição) —
     é isso que garante visual == colisão sem mapear nada à mão
  4. sombras suaves sob cada prop

Assets em public/map-kit/ (ausentes viram placeholder procedural):
  tile-grama.png tile-caminho.png tile-praca.png tile-agua.png   (seamless 512px)
  prop-arvore-1.png prop-arvore-2.png prop-pinheiro.png prop-pedra.png
  prop-casa-azul.png prop-casa-marrom.png prop-arena.png
  prop-predio-roxo.png prop-shop.png prop-cupula.png             (fundo MAGENTA #FF00FF)
"""
import json, os, sys, math, hashlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
KIT = os.path.join(ROOT, 'public', 'map-kit')
layout = json.load(open(os.path.join(ROOT, 'tools', 'map_layout.json')))
coll_path = sys.argv[sys.argv.index('--collision') + 1] if '--collision' in sys.argv else None
out_path = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'public', 'mapa-oficial.jpg')

# COLLISION extraída do game.html se não fornecida
if coll_path:
    GRID = json.load(open(coll_path))
else:
    import re
    html = open(os.path.join(ROOT, 'public', 'game.html')).read()
    m = re.search(r'const COLLISION = \[(.*?)\];', html, re.S)
    GRID = [[int(v) for v in r.split(',')] for r in re.findall(r'\[([\d,\s]+)\]', m.group(1))]

T = layout['tile_px']; N = 48; W = H = N * T
def h2(x, y, salt=0):
    return int(hashlib.md5(f'{x},{y},{salt}'.encode()).hexdigest()[:8], 16)

def load_asset(name, chroma_magenta=False):
    p = os.path.join(KIT, name)
    if not os.path.exists(p): return None
    im = Image.open(p).convert('RGBA')
    if chroma_magenta:
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if r > 150 and b > 150 and g < r * 0.55 and g < b * 0.55:
                    px[x, y] = (0, 0, 0, 0)
    return im

TEX_SCALE = 256  # textura seamless cobre 4x4 tiles — detalhe em escala natural

def pano(tex):
    """pano contínuo do mapa inteiro com a textura repetida (sem emendas)"""
    t = tex.convert('RGB').resize((TEX_SCALE, TEX_SCALE), Image.LANCZOS)
    p = Image.new('RGB', (W, H))
    for y in range(0, H, TEX_SCALE):
        for x in range(0, W, TEX_SCALE):
            p.paste(t, (x, y))
    return p

def compor_terreno(base, tex, cells, feather=6):
    """compõe o pano da textura sobre a base via máscara suavizada das células"""
    if not tex or not cells: return base
    mask = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(mask)
    for (x, y) in cells:
        d.rectangle([x * T, y * T, x * T + T, y * T + T], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return Image.composite(pano(tex), base, mask)

def placeholder_tex(color, noise=18):
    im = Image.new('RGB', (128, 128), color)
    px = im.load()
    for y in range(128):
        for x in range(128):
            d = (h2(x, y, 7) % (noise * 2)) - noise
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + d)),) * 0 or (max(0,min(255,r+d)), max(0,min(255,g+d)), max(0,min(255,b+d)))
    return im.convert('RGBA')

# ── texturas ────────────────────────────────────────────────────────────
tex = {
    'grama':  load_asset('tile-grama.png')  or placeholder_tex((74, 128, 60)),
    'caminho':load_asset('tile-caminho.png')or placeholder_tex((150, 124, 88), 12),
    'praca':  load_asset('tile-praca.png')  or placeholder_tex((148, 148, 158), 10),
    'agua':   load_asset('tile-agua.png')   or placeholder_tex((38, 84, 160), 14),
}
props = {
    'arvore1': load_asset('prop-arvore-1.png', True),
    'arvore2': load_asset('prop-arvore-2.png', True),
    'pinheiro':load_asset('prop-pinheiro.png', True),
    'pedra':   load_asset('prop-pedra.png', True),
}

canvas = pano(tex['grama']) if tex['grama'] else Image.new('RGB', (W, H), (74, 128, 60))

# máscaras de terreno
water_cells, praca_cells, path_cells = set(), set(), set()
for w_ in layout['water']:
    for y in range(w_['y0'], w_['y1'] + 1):
        for x in range(w_['x0'], w_['x1'] + 1): water_cells.add((x, y))
pc = layout['praca']
for y in range(N):
    for x in range(N):
        if math.hypot(x + .5 - pc['cx'], y + .5 - pc['cy']) <= pc['raio']: praca_cells.add((x, y))
for c in layout['caminhos']:
    (x0, y0), (x1, y1) = c['de'], c['para']; lw = c['largura']
    steps = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
    for i in range(steps + 1):
        fx, fy = x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps
        for dy in range(-(lw // 2), lw - lw // 2):
            for dx in range(-(lw // 2), lw - lw // 2):
                cx_, cy_ = int(fx + dx), int(fy + dy)
                if 0 <= cx_ < N and 0 <= cy_ < N: path_cells.add((cx_, cy_))
path_cells -= water_cells | praca_cells
canvas = compor_terreno(canvas, tex['caminho'], sorted(path_cells), feather=7)
canvas = compor_terreno(canvas, tex['praca'], sorted(praca_cells - water_cells), feather=5)
canvas = compor_terreno(canvas, tex['agua'], sorted(water_cells), feather=4)

# ── edifícios ───────────────────────────────────────────────────────────
building_cells = set()
shadow = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(shadow)
for b in layout['edificios']:
    for y in range(b['y'], b['y'] + b['h']):
        for x in range(b['x'], b['x'] + b['w']): building_cells.add((x, y))
prop_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
canvas_rgba = prop_layer  # props desenham na própria camada
for b in sorted(layout['edificios'], key=lambda e: e['y'] + e['h']):
    px0, py0, pw, ph = b['x'] * T, b['y'] * T, b['w'] * T, b['h'] * T
    im = load_asset(b['asset'], True)
    sd.ellipse([px0 + pw*0.06, py0 + ph*0.72, px0 + pw*0.94, py0 + ph*1.02], fill=90)
    if im:
        im = im.resize((pw, ph), Image.LANCZOS)
        canvas_rgba.alpha_composite(im, (px0, py0))
    else:
        d = ImageDraw.Draw(canvas_rgba)
        d.rounded_rectangle([px0+4, py0+4, px0+pw-4, py0+ph-4], 18, fill=(120, 96, 150, 255), outline=(60, 45, 80, 255), width=5)
        d.text((px0 + 14, py0 + 12), b['id'], fill=(255, 255, 255, 255))

# ── vegetação automática: bloqueado & ¬água & ¬edifício & fora da zona do orbe ──
oz = layout['orbe_zona']
veg = []
for y in range(1, N - 1):
    for x in range(1, N - 1):
        if GRID[y][x] != 1: continue
        if (x, y) in water_cells or (x, y) in building_cells: continue
        if oz['x0'] <= x <= oz['x1'] and oz['y0'] <= y <= oz['y1']: continue
        veg.append((x, y))
for (x, y) in veg:
    r = h2(x, y) % 100
    kind = 'pedra' if r < 7 else 'pinheiro' if r < 40 else 'arvore1' if r < 72 else 'arvore2'
    im = props[kind] if props[kind] else None
    cx_, cy_ = x * T + T // 2, y * T + T
    sd.ellipse([cx_ - T*0.55, cy_ - T*0.28, cx_ + T*0.55, cy_ + T*0.10], fill=70)
    if im:
        s = T * (1.55 if kind != 'pedra' else 1.0)
        w2 = int(s); h2_ = int(s * im.height / im.width)
        canvas_rgba.alpha_composite(im.resize((w2, h2_), Image.LANCZOS), (cx_ - w2 // 2, cy_ - h2_))
    else:
        d = ImageDraw.Draw(canvas_rgba)
        col = {'pedra': (130,130,135,255), 'pinheiro': (30,92,48,255), 'arvore1': (52,120,58,255), 'arvore2': (70,134,52,255)}[kind]
        rad = int(T * (0.72 if kind != 'pedra' else 0.42))
        d.ellipse([cx_-rad, cy_-T//2-rad, cx_+rad, cy_-T//2+rad], fill=col, outline=(25,60,30,255), width=3)

# aplica sombras (multiply simples)
shadow = shadow.filter(ImageFilter.GaussianBlur(T // 5))
dark = Image.new('RGBA', (W, H), (12, 18, 10, 255))
dark.putalpha(shadow.point(lambda v: int(v * 0.55)))
final = canvas.convert('RGBA')
final.alpha_composite(dark)        # sombras entre o chão e os props
final.alpha_composite(prop_layer)  # edifícios e vegetação por cima
final.convert('RGB').save(out_path, quality=90, optimize=True)
print('mapa composto:', out_path, f'{W}x{H}')
print(f'terreno: agua={len(water_cells)} praca={len(praca_cells)} caminho={len(path_cells)}')
print(f'edificios={len(layout["edificios"])} vegetacao={len(veg)} tiles')
faltando = [n for n in ['tile-grama.png','tile-caminho.png','tile-praca.png','tile-agua.png',
  'prop-arvore-1.png','prop-arvore-2.png','prop-pinheiro.png','prop-pedra.png',
  'prop-casa-azul.png','prop-casa-marrom.png','prop-arena.png','prop-predio-roxo.png',
  'prop-shop.png','prop-cupula.png'] if not os.path.exists(os.path.join(KIT, n))]
print('assets faltando (' + str(len(faltando)) + '):', ' '.join(faltando) if faltando else 'nenhum!')
