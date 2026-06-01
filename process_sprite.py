#!/usr/bin/env python3
"""
Remove white background from sprite and inject into game.html as base64.
Usage: python3 process_sprite.py <image_path>
"""
import sys, base64, re
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'Pillow', '-q'])
    from PIL import Image

def remove_white_bg(img_path, threshold=240):
    img = Image.open(img_path).convert('RGBA')
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Remove near-white pixels
            if r > threshold and g > threshold and b > threshold:
                pixels[x, y] = (r, g, b, 0)
    return img

def crop_to_content(img):
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    return img

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_sprite.py <image_path>")
        sys.exit(1)

    img_path = sys.argv[1]
    print(f"Processing: {img_path}")

    img = remove_white_bg(img_path)
    img = crop_to_content(img)

    # Save processed PNG
    out_path = Path(img_path).stem + '_processed.png'
    img.save(out_path, 'PNG')
    print(f"Saved processed image: {out_path}")

    # Convert to base64 data URL
    with open(out_path, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    data_url = f"data:image/png;base64,{b64}"

    # Inject into game.html
    game_path = Path(__file__).parent / 'game.html'
    if not game_path.exists():
        print("game.html not found!")
        sys.exit(1)

    content = game_path.read_text(encoding='utf-8')
    # Replace the pvpnpc sprite script content
    pattern = r'(<script type="text/plain" id="d-pvpnpc-sprite">)(.*?)(</script>)'
    replacement = rf'\g<1>{data_url}\g<3>'
    new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

    if new_content == content:
        print("WARNING: Pattern not found — sprite tag not replaced")
    else:
        game_path.write_text(new_content, encoding='utf-8')
        print(f"Sprite injected into game.html ({len(b64)} chars base64)")
        print("Done! Commit and push game.html to deploy.")

if __name__ == '__main__':
    main()
