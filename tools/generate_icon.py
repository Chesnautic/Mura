"""
generate_icon.py -- builds Mura's app icon: an original multi-petal flower
mascot in a bold, high-gloss "collectible pillow" pop-art spirit (thick
black outlines, mismatched puffy petal shapes, flat cel-shaded rainbow
palette, a small sound-wave squiggle across the face instead of a plain
smile) -- inspired by that general kawaii/pop-art flower family in the same
loose way Kami's mascot was, NOT a reproduction of any existing artist's
copyrighted work or of Kami's own character (different palette, different
petal count/shape rhythm, different face, waveform motif instead of a
sparkle-only smiley).

Produces (in ../assets/):
    icon.png                      -- master 1024x1024, transparent bg
    adaptive-icon-foreground.png  -- android foreground layer (transparent)
    adaptive-icon-background.png  -- android flat background color
    adaptive-icon-monochrome.png  -- android 13+ themed monochrome silhouette
    splash-icon.png               -- centered mark for the splash screen
    favicon.png                   -- 48x48 web favicon
    icon_preview.png              -- composited onto a backdrop, for viewing
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
CX, CY = SIZE / 2, SIZE / 2

# Mura's palette: sits in violet/magenta/teal territory -- distinct from
# Kami's hot-pink/cyan/yellow/lime/violet rotation.
PETAL_COLORS = [
    (255, 45, 149),   # magenta
    (123, 92, 255),   # electric violet
    (0, 224, 200),    # teal
    (255, 176, 32),   # marigold
    (86, 208, 255),   # sky blue
    (255, 255, 255),  # white (Mura-signature accent petal)
]

OUTLINE = (16, 12, 24, 255)
BG_SOLID = (18, 10, 30, 255)  # android adaptive-icon background color


def lighten(color, amt=0.5):
    return tuple(int(c + (255 - c) * amt) for c in color[:3])


def darken(color, amt=0.25):
    return tuple(int(c * (1 - amt)) for c in color[:3])


def petal_points(n_samples, width, length, base_offset, tip_bias=0.75, asym=0.0):
    """Petal pointing up from (CX, CY). `asym` skews the tip left/right so
    petals read as hand-placed/mismatched rather than a perfect radial
    stamp -- the Murakami-pillow "lumpy, cuddly" quality."""
    left = []
    right = []
    for i in range(n_samples + 1):
        t = i / n_samples
        w = width * (math.sin(math.pi * t) ** tip_bias)
        y = -(base_offset + t * length)
        skew = asym * width * t
        left.append((CX - w / 2 + skew, CY + y))
        right.append((CX + w / 2 + skew, CY + y))
    return left + right[::-1]


def draw_petal_layer(angle_deg, color, width, length, base_offset, asym, rounded_tip):
    layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    tip_bias = 1.3 if rounded_tip else 0.7
    pts = petal_points(24, width, length, base_offset, tip_bias=tip_bias, asym=asym)
    draw.polygon(pts, fill=(*color, 255))

    shade_pts = petal_points(20, width * 0.55, length * 0.85,
                              base_offset + length * 0.02, tip_bias=tip_bias * 1.1, asym=asym)
    shade_pts = [(x + width * 0.20, y) for x, y in shade_pts]
    draw.polygon(shade_pts, fill=(*darken(color, 0.30), 255))

    hl_pts = petal_points(16, width * 0.28, length * 0.40,
                           base_offset + length * 0.22, tip_bias=tip_bias * 1.1, asym=asym)
    hl_pts = [(x - width * 0.16, y) for x, y in hl_pts]
    draw.polygon(hl_pts, fill=(*lighten(color, 0.55), 255))

    draw.polygon(pts, outline=OUTLINE, width=14)

    return layer.rotate(angle_deg, resample=Image.BICUBIC, center=(CX, CY))


def draw_waveform_face(canvas: Image.Image, face_r: float, rng):
    """Instead of Kami's cutesy two-eyes-and-smile face, Mura's center is a
    round chrome-white dial with a little animated-looking waveform bar
    squiggle across it -- ties the mascot directly to "visualizer" while
    still reading as a friendly flower face at a glance (the two outer
    tall bars double as "eyes", the center dip as a soft smile)."""
    draw = ImageDraw.Draw(canvas)

    cream = (255, 250, 240)
    lilac_tint = (232, 224, 255)

    draw.ellipse([CX - face_r, CY - face_r, CX + face_r, CY + face_r], fill=(*cream, 255))
    draw.pieslice([CX - face_r, CY - face_r, CX + face_r, CY + face_r],
                  start=200, end=340, fill=(*lilac_tint, 255))
    draw.ellipse([CX - face_r, CY - face_r, CX + face_r, CY + face_r], outline=OUTLINE, width=16)

    # blush
    br = face_r * 0.15
    for sign in (-1, 1):
        bx = CX + sign * face_r * 0.66
        by = CY + face_r * 0.22
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(255, 150, 185, 255))

    # waveform bars across the middle -- heights sampled so it reads as a
    # little audio bar-graph "smile"
    n_bars = 9
    bar_w = face_r * 0.14
    gap = face_r * 0.045
    total_w = n_bars * bar_w + (n_bars - 1) * gap
    start_x = CX - total_w / 2
    heights = [0.30, 0.55, 0.85, 1.15, 0.5, 1.15, 0.85, 0.55, 0.30]
    bar_colors = [PETAL_COLORS[i % len(PETAL_COLORS)] for i in range(n_bars)]
    for i in range(n_bars):
        h = face_r * 0.34 * heights[i]
        bx0 = start_x + i * (bar_w + gap)
        bx1 = bx0 + bar_w
        by0 = CY - h
        by1 = CY + h
        radius = bar_w * 0.5
        draw.rounded_rectangle([bx0, by0, bx1, by1], radius=radius,
                                fill=(*bar_colors[i], 255), outline=OUTLINE, width=8)


def draw_note_sparkle(draw, cx, cy, r, color):
    """A tiny 4-point sparkle -- used sparingly as background accents."""
    pts = []
    for i in range(8):
        ang = i * math.pi / 4
        rad = r if i % 2 == 0 else r * 0.32
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=color)


def build_flower(seed=7) -> Image.Image:
    rng = np.random.default_rng(seed)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    n_petals = 12  # Kami uses 10 -- Mura reads denser/more "pillow-like"
    face_r = SIZE * 0.195
    base_offset = face_r * 0.80

    for i in range(n_petals):
        angle = i * (360.0 / n_petals) + rng.uniform(-5, 5)
        color = PETAL_COLORS[i % len(PETAL_COLORS)]
        width = SIZE * rng.uniform(0.165, 0.20)
        length = SIZE * rng.uniform(0.275, 0.315)
        asym = rng.uniform(-0.12, 0.12)
        rounded_tip = (i % 3 == 0)  # mix pointed + rounded petal shapes
        petal_layer = draw_petal_layer(angle, color, width, length, base_offset, asym, rounded_tip)
        canvas = Image.alpha_composite(canvas, petal_layer)

    draw_waveform_face(canvas, face_r, rng)

    draw = ImageDraw.Draw(canvas)
    sparkle_spots = [
        (SIZE * 0.11, SIZE * 0.15, 30, (255, 255, 255, 255)),
        (SIZE * 0.89, SIZE * 0.14, 24, (0, 224, 200, 255)),
        (SIZE * 0.90, SIZE * 0.82, 28, (255, 45, 149, 255)),
        (SIZE * 0.10, SIZE * 0.84, 20, (255, 176, 32, 255)),
    ]
    for sx, sy, sr, scol in sparkle_spots:
        draw_note_sparkle(draw, sx, sy, sr, scol)

    return canvas


def add_drop_shadow(flower: Image.Image, offset=(14, 22), blur=18) -> Image.Image:
    alpha = flower.split()[3]
    shadow = Image.new("RGBA", flower.size, (0, 0, 0, 0))
    shadow.paste((8, 0, 22, 160), mask=alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))

    out = Image.new("RGBA", flower.size, (0, 0, 0, 0))
    out.paste(shadow, offset, shadow)
    out = Image.alpha_composite(out, flower)
    return out


def make_monochrome(flower: Image.Image) -> Image.Image:
    """Android 13+ themed icons need a single-color silhouette on a
    transparent background (system applies its own tint)."""
    alpha = flower.split()[3]
    mono = Image.new("RGBA", flower.size, (0, 0, 0, 0))
    white = Image.new("RGBA", flower.size, (255, 255, 255, 255))
    mono.paste(white, (0, 0), alpha)
    return mono


def main():
    import os
    out_dir = os.path.join(os.path.dirname(__file__), "..", "assets")
    os.makedirs(out_dir, exist_ok=True)

    flower = build_flower()
    icon = add_drop_shadow(flower)

    alpha = icon.split()[3]
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    icon.putalpha(alpha)

    icon.save(os.path.join(out_dir, "icon.png"))

    # Android adaptive icon: foreground is the flower inset a bit (system
    # crops adaptive icons to various shapes, so keep the flower well
    # inside the safe zone) on a transparent layer, flat color background.
    fg_canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    scale = 0.68
    small = flower.resize((int(SIZE * scale), int(SIZE * scale)), Image.LANCZOS)
    fg_canvas.paste(small, (int((SIZE - small.width) / 2), int((SIZE - small.height) / 2)), small)
    fg_canvas.save(os.path.join(out_dir, "adaptive-icon-foreground.png"))

    bg_canvas = Image.new("RGBA", (SIZE, SIZE), BG_SOLID)
    bg_canvas.save(os.path.join(out_dir, "adaptive-icon-background.png"))

    mono = make_monochrome(fg_canvas)
    mono.save(os.path.join(out_dir, "adaptive-icon-monochrome.png"))

    # Splash: same flower, slightly smaller, transparent bg (app.json sets
    # the surrounding backgroundColor)
    splash = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sm = flower.resize((int(SIZE * 0.55), int(SIZE * 0.55)), Image.LANCZOS)
    splash.paste(sm, (int((SIZE - sm.width) / 2), int((SIZE - sm.height) / 2)), sm)
    splash.save(os.path.join(out_dir, "splash-icon.png"))

    favicon = icon.resize((48, 48), Image.LANCZOS)
    favicon.save(os.path.join(out_dir, "favicon.png"))

    grad = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
    for y in range(SIZE):
        f = y / SIZE
        grad[y, :] = [int(20 + 14 * f), int(8 + 6 * f), int(34 + 22 * f)]
    backdrop = Image.fromarray(grad, "RGB")
    backdrop.paste(icon, (0, 0), icon)
    backdrop.save(os.path.join(out_dir, "icon_preview.png"))

    print("Wrote icon.png, adaptive-icon-{foreground,background,monochrome}.png, "
          "splash-icon.png, favicon.png, icon_preview.png")


if __name__ == "__main__":
    main()
