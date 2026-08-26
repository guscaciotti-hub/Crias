#!/usr/bin/env python3
"""Slice a chroma-green spritesheet into individual transparent frames.

Contract: regular grid, green (#00FF00-ish) background.
Steps per cell: cut -> chroma key removal -> green de-spill -> save full cell
(all cells share the same canvas so the game's union-bbox trim aligns frames).
"""
from PIL import Image
import sys, os

SHEET = sys.argv[1]
OUT = sys.argv[2]
COLS, ROWS = 4, 3

# name mapping: (row, col) -> output filename (1-indexed)
MAPPING = {
    (1, 1): 'char4-down-0.png',
    (1, 2): 'char4-down-1.png',
    (1, 3): 'char4-down-2.png',
    (2, 1): 'char4-up-0.png',
    (2, 2): 'char4-up-1.png',
    (2, 3): 'char4-up-2.png',
    (3, 1): 'char4-left-0.png',
    (3, 2): 'char4-left-1.png',
    (3, 4): 'char4-right-0.png',
}

im = Image.open(SHEET).convert('RGBA')
W, H = im.size
cw, ch = W // COLS, H // ROWS
print(f'sheet {W}x{H}, cell {cw}x{ch}')

def is_green(r, g, b):
    return g > 90 and g > r * 1.35 and g > b * 1.35

os.makedirs(OUT, exist_ok=True)
for (row, col), name in MAPPING.items():
    x0, y0 = (col - 1) * cw, (row - 1) * ch
    cell = im.crop((x0, y0, x0 + cw, y0 + ch))
    px = cell.load()
    removed = 0
    for y in range(ch):
        for x in range(cw):
            r, g, b, a = px[x, y]
            if is_green(r, g, b):
                px[x, y] = (0, 0, 0, 0)
                removed += 1
            elif g > max(r, b):
                # de-spill: clamp green fringe to the max of the other channels
                px[x, y] = (r, max(r, b), b, a)
    # sanity: content bbox
    bbox = cell.getbbox()
    cell.save(os.path.join(OUT, name))
    print(f'{name}: bg removed {removed*100//(cw*ch)}%, content bbox={bbox}')
print('done')
