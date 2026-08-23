#!/usr/bin/env python3
"""Normalize sliced frames: per-direction uniform scale, feet-anchored,
all frames on identical canvases so the game's union-bbox trim aligns."""
from PIL import Image
import os

SRC, OUT = 'frames', 'norm'
CANVAS_W, CANVAS_H = 480, 800
TARGET_H = 760  # standing-frame height inside canvas

DIRS = {
    'down':  ['char4-down-0.png', 'char4-down-1.png', 'char4-down-2.png'],
    'up':    ['char4-up-0.png', 'char4-up-1.png', 'char4-up-2.png'],
    'left':  ['char4-left-0.png', 'char4-left-1.png'],
    'right': ['char4-right-0.png'],
}

def robust_bbox(im, min_px=6, alpha=40):
    """bbox ignoring rows/cols with fewer than min_px opaque pixels (stray specks)."""
    px = im.load()
    w, h = im.size
    rows = [y for y in range(h) if sum(1 for x in range(w) if px[x, y][3] > alpha) >= min_px]
    cols = [x for x in range(w) if sum(1 for y in range(h) if px[x, y][3] > alpha) >= min_px]
    return (cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)

os.makedirs(OUT, exist_ok=True)
for d, files in DIRS.items():
    imgs = [Image.open(os.path.join(SRC, f)) for f in files]
    boxes = [robust_bbox(im) for im in imgs]
    # scale of the whole direction comes from its standing frame (index 0)
    h0 = boxes[0][3] - boxes[0][1]
    scale = TARGET_H / h0
    for f, im, bb in zip(files, imgs, boxes):
        crop = im.crop(bb)
        w, h = crop.size
        # AI sheets sometimes draw one frame at a different scale; if this frame's
        # height deviates >8% from the direction's standing frame, rescale it alone
        fscale = scale if abs(h - h0) / h0 <= 0.08 else TARGET_H / h
        nw, nh = round(w * fscale), round(h * fscale)
        crop = crop.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
        # feet on canvas bottom, horizontally centered
        canvas.paste(crop, ((CANVAS_W - nw) // 2, CANVAS_H - nh), crop)
        canvas.save(os.path.join(OUT, f))
        print(f'{f}: dir={d} scale={scale:.3f} placed {nw}x{nh}')
print('done')
