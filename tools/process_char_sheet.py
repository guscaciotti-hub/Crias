#!/usr/bin/env python3
"""Pipeline completo: spritesheet chroma 4x3 -> frames de personagem do jogo.

Uso: python3 tools/process_char_sheet.py <sheet.png> <charId> <outdir>
Ex.:  python3 tools/process_char_sheet.py "personagem 4.png" char5 public/

Contrato da sheet (4 colunas x 3 linhas, células iguais, fundo verde #00FF00):
  linha 1: frente  [parado, passo A, passo B, extra*]
  linha 2: costas  [parado, passo A, passo B, extra*]
  linha 3: perfil  [esq. parado, esq. andando, extra*, dir. parado]
  (*células extras são ignoradas)

Etapas: corte por grade -> chroma key + de-spill -> bbox robusto a pixels
espúrios -> escala uniforme por direção (outliers >8% re-escalados) ->
âncora nos pés com folga de 6px -> canvas comum 480x800.
Frames de passo com conteúdo cortado na borda da célula são substituídos
pelo espelho do passo oposto (vistas frente/costas são simétricas).
"""
from PIL import Image
import sys, os

sheet_path, char, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
COLS, ROWS = 4, 3
CANVAS_W, CANVAS_H = 800, 800  # largo o bastante p/ capas/passadas de perfil
TARGET_H, BOTTOM_PAD = 760, 6

# (linha, coluna) -> sufixo do arquivo
MAPPING = {
    (1, 1): 'down-0', (1, 2): 'down-1', (1, 3): 'down-2',
    (2, 1): 'up-0',   (2, 2): 'up-1',   (2, 3): 'up-2',
    (3, 1): 'left-0', (3, 2): 'left-1', (3, 3): 'sit-0', (3, 4): 'right-0',
}
DIRS = {
    'down':  ['down-0', 'down-1', 'down-2'],
    'up':    ['up-0', 'up-1', 'up-2'],
    'left':  ['left-0', 'left-1'],
    'right': ['right-0'],
    # 'sit' usa a escala da vista frontal: a pose é naturalmente mais baixa,
    # então não pode ditar a própria escala (senão fica gigante em pé)
    'sit':   ['sit-0'],
}
# passo A <-> passo B (para mirror fix automático quando um deles vem cortado)
STEP_TWIN = {'down-1': 'down-2', 'down-2': 'down-1', 'up-1': 'up-2', 'up-2': 'up-1'}

im = Image.open(sheet_path).convert('RGBA')
W, H = im.size
cw, ch = W // COLS, H // ROWS
print(f'sheet {W}x{H}, célula {cw}x{ch}')

def is_green(r, g, b):
    return g > 90 and g > r * 1.35 and g > b * 1.35

def robust_bbox(img, min_px=6, alpha=40):
    px = img.load()
    w, h = img.size
    rows = [y for y in range(h) if sum(1 for x in range(w) if px[x, y][3] > alpha) >= min_px]
    cols = [x for x in range(w) if sum(1 for y in range(h) if px[x, y][3] > alpha) >= min_px]
    return (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)

# 1) corte + chroma
cells = {}
for (row, col), suffix in MAPPING.items():
    x0, y0 = (col - 1) * cw, (row - 1) * ch
    cell = im.crop((x0, y0, x0 + cw, y0 + ch))
    px = cell.load()
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = px[x, y]
            if is_green(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif g > max(r, b):
                px[x, y] = (r, max(r, b), b, a)
    cells[suffix] = cell

# 2) detectar frames cortados na borda inferior da célula (pé truncado)
broken = set()
for suffix, cell in cells.items():
    bb = robust_bbox(cell)
    if bb[3] >= ch - 1 and suffix in STEP_TWIN:
        twin = STEP_TWIN[suffix]
        tb = robust_bbox(cells[twin])
        if tb[3] < ch - 1:  # o gêmeo está íntegro
            broken.add(suffix)
            print(f'{suffix}: conteúdo cortado na borda -> será espelho de {twin}')

# 3) normalizar por direção ('down' primeiro: define a escala usada por 'sit')
os.makedirs(outdir, exist_ok=True)
DOWN_SCALE = [1.0]
out_paths = {}
for d, suffixes in DIRS.items():
    boxes = {s: robust_bbox(cells[s]) for s in suffixes}
    h0 = boxes[suffixes[0]][3] - boxes[suffixes[0]][1]
    scale = TARGET_H / h0
    if d == 'sit':
        scale = DOWN_SCALE[0]  # mesma escala do personagem em pé
    for s in suffixes:
        if s in broken:
            continue
        bb = boxes[s]
        crop = cells[s].crop(bb)
        w, h = crop.size
        fscale = scale if (d == 'sit' or abs(h - h0) / h0 <= 0.08) else TARGET_H / h
        if d == 'down' and s == suffixes[0]:
            DOWN_SCALE[0] = fscale
        nw, nh = round(w * fscale), round(h * fscale)
        crop = crop.resize((nw, nh), Image.LANCZOS)
        # Âncora horizontal = centro dos PÉS (12% inferiores), não da imagem:
        # capas/braços esticados deslocam o centro do bbox e fazem o corpo
        # "pular" de lado ao alternar frames de caminhada.
        cpx = crop.load()
        y_start = max(0, nh - max(4, round(nh * 0.12)))
        sx = n_px = 0
        for y in range(y_start, nh):
            for x in range(nw):
                if cpx[x, y][3] > 40:
                    sx += x; n_px += 1
        foot_cx = (sx / n_px) if n_px else nw / 2
        canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        canvas.paste(crop, (round(CANVAS_W / 2 - foot_cx), CANVAS_H - nh - BOTTOM_PAD), crop)
        p = os.path.join(outdir, f'{char}-{s}.png')
        canvas.save(p)
        out_paths[s] = p
        print(f'{char}-{s}.png: escala {fscale:.3f}, {nw}x{nh}')

# 4) mirror fix dos quebrados
for s in broken:
    twin = STEP_TWIN[s]
    Image.open(out_paths[twin]).transpose(Image.FLIP_LEFT_RIGHT).save(
        os.path.join(outdir, f'{char}-{s}.png'))
    print(f'{char}-{s}.png: espelhado de {char}-{twin}.png')
print('done')
