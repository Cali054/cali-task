"""Builds every brand asset from the Cali logo source image.

Lifts the emblem and wordmark off the source's background: inside the logo
shape the original pixels are kept untouched; only edges and the thin orbit
ring get partial transparency. Then exports the logo variants and favicons.

Run from this folder (needs pillow, numpy, scipy):  python build_brand_assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

HERE = Path(__file__).resolve().parent
SRC = HERE / "cali-logo-source.webp"
PUBLIC = HERE.parent.parent / "public" / "brand"
APP = HERE.parent.parent / "src" / "app"
EMBLEM_BOX = (172, 240, 768, 682)
WORD_BOX = (728, 340, 1268, 592)

# Points (full-image coords) that are definitely background, inside the emblem's outline.
EMBLEM_BG_SEEDS = [(450, 470), (600, 480), (700, 400), (690, 330), (250, 590), (300, 620), (260, 500), (640, 300)]
WORD_BG_SEEDS = [(1028, 535), (850, 470)]
# Points inside the emblem's two solid parts: the C and the star.
EMBLEM_BODY_POINTS = [(350, 480), (515, 478)]
DOT = (1226, 380, 31)  # centre x, centre y, radius of the i-dot


def sstep(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def estimate_bg(img, thresh=0.05, rounds=4):
    """Local background; falls back to a wider radius where a large shape hides it."""
    mask = np.ones(img.shape[:2], bool)
    bg = img
    for _ in range(rounds):
        layers = []
        for sigma in (22, 70):
            w = ndi.gaussian_filter(mask.astype(float), sigma)
            layers.append((np.stack([ndi.gaussian_filter(img[..., c] * mask, sigma) / (w + 1e-4) for c in range(3)], -1), w))
        trust = sstep(layers[0][1], 0.15, 0.5)[..., None]
        bg = trust * layers[0][0] + (1 - trust) * layers[1][0]
        fg = np.abs(img - bg).max(-1) > thresh
        mask = ~ndi.binary_dilation(fg, iterations=7)
    return bg


def disk(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def fill_except(edges, seeds, box):
    """Everything not reachable from the outside or from a background seed is shape."""
    x0, y0 = box[:2]
    free = ~edges
    labels, _ = ndi.label(free)
    bg_labels = set(np.unique(np.r_[labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    for sx, sy in seeds:
        bg_labels.add(labels[sy - y0, sx - x0])
    bg_labels.discard(0)
    return ~np.isin(labels, list(bg_labels))


def remove_small(mask, min_area):
    labels, n = ndi.label(mask)
    if not n:
        return mask
    areas = ndi.sum(mask, labels, range(1, n + 1))
    return np.isin(labels, [i + 1 for i, s in enumerate(areas) if s >= min_area])


def to_image(rgb, a):
    rgba = np.dstack([np.clip(rgb, 0, 1), np.clip(a, 0, 1)])
    return Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")


src = np.asarray(Image.open(SRC).convert("RGB")).astype(float) / 255
bg = estimate_bg(src)

# ---------- emblem ----------
x0, y0, x1, y1 = EMBLEM_BOX
img, b = src[y0:y1, x0:x1].copy(), bg[y0:y1, x0:x1]
diff_dark = (b - img).max(-1)
diff_light = (img - b).max(-1)
# Blank out the wordmark and tagline that intrude on the crop.
blank = np.zeros(diff_dark.shape, bool)
blank[340 - y0 :, 725 - x0 :] = True
diff_dark[blank] = diff_light[blank] = 0

edges = ndi.binary_closing(diff_dark > 0.09, structure=disk(3))
# A white highlight interrupts the top lobe's rim; trace the rim across that gap.
guide = Image.new("L", (edges.shape[1], edges.shape[0]), 0)
ImageDraw.Draw(guide).line(
    [(px - x0, py - y0) for px, py in [(565, 304), (592, 320), (618, 335), (638, 350), (650, 365), (656, 382), (656, 395)]], fill=255, width=2
)
edges |= np.asarray(guide) > 0
filled = fill_except(edges, EMBLEM_BG_SEEDS, EMBLEM_BOX)
# Opening separates the solid body from the thin orbit; regrowing inside the
# fill then restores sharp tips (star, lobes) that opening would round off.
opened, _ = ndi.label(ndi.binary_opening(filled, structure=disk(4)))
core = np.isin(opened, [opened[sy - y0, sx - x0] for sx, sy in EMBLEM_BODY_POINTS])
body = ndi.binary_dilation(core, structure=disk(1), iterations=6, mask=filled)
body_a = sstep(ndi.gaussian_filter(ndi.binary_erosion(body, iterations=1).astype(float), 0.8), 0.25, 0.8)

# The orbit is a tilted ellipse; only look for its faint ring near that path.
yy, xx = np.mgrid[y0:y1, x0:x1]
ux, uy = 0.85, -0.526
pu = (xx - 472) * ux + (yy - 452) * uy
pv = (xx - 472) * -uy + (yy - 452) * ux
radius = np.sqrt((pu / 327) ** 2 + (pv / 105) ** 2)
band = sstep(radius, 0.72, 0.8) * (1 - sstep(radius, 1.14, 1.22))
lum = img.mean(-1)
thin = np.maximum(ndi.black_tophat(lum, footprint=disk(16)), ndi.white_tophat(lum, footprint=disk(16)))
ring = sstep(thin, 0.03, 0.13) * band
ring = ring * ndi.binary_dilation(remove_small(ring > 0.25, 120), iterations=2)
ring = ring * ~ndi.binary_dilation(body, structure=disk(5))
ring = ndi.gaussian_filter(ndi.grey_closing(ring, footprint=disk(2)) * band, 0.5)
a = np.maximum(body_a, ring)
col = np.where(
    (body_a[..., None] > 0.98),
    img,
    (img - (1 - a[..., None]) * b) / np.maximum(a[..., None], 0.05),
)
# The orbit is a pale lavender glass line: smooth its colour and keep it in that
# range so it stays visible on both white and dark surfaces.
is_ring = body_a[..., None] < 0.5
weight = ndi.gaussian_filter(a, 1.5)[..., None] + 1e-4
smooth = np.stack([ndi.gaussian_filter(col[..., c] * a, 1.5) for c in range(3)], -1) / weight
col = np.where(is_ring, np.clip(smooth, [0.62, 0.66, 0.96], [0.84, 0.87, 1.0]), col)
emblem = to_image(col, a)
emblem_core = to_image(img, body_a)  # no orbit: stays legible at favicon sizes

# ---------- wordmark ----------
x0, y0, x1, y1 = WORD_BOX
img, b = src[y0:y1, x0:x1], bg[y0:y1, x0:x1]
d = (b - img).max(-1)
edges = ndi.binary_closing(d > 0.14, structure=disk(1))
word = fill_except(edges, WORD_BG_SEEDS, WORD_BOX)
word = remove_small(word, 300)
# The i-dot is a perfect circle whose pale edge fades into the background.
yy, xx = np.mgrid[y0:y1, x0:x1]
word |= (xx - DOT[0]) ** 2 + (yy - DOT[1]) ** 2 <= DOT[2] ** 2
word_a = sstep(ndi.gaussian_filter(word.astype(float), 0.6), 0.2, 0.8)
col = np.where((word_a[..., None] > 0.98), img, (img - (1 - word_a[..., None]) * b) / np.maximum(word_a[..., None], 0.05))
wordmark = to_image(col, word_a)

# Dark-mode wordmark: letters go light (lit areas keep a blue tint), the dot is untouched.
lum = col.mean(-1, keepdims=True)
light = np.array([1.0, 1.0, 1.0]) * (1 - sstep(lum, 0.12, 0.55)) + np.array([0.76, 0.82, 1.0]) * sstep(lum, 0.12, 0.55)
in_dot = ((xx - DOT[0]) ** 2 + (yy - DOT[1]) ** 2 <= (DOT[2] + 3) ** 2)[..., None]
wordmark_light = to_image(np.where(in_dot, col, light), word_a)


# ---------- exports ----------
def mono(im):
    """Single colour: shape only. Used as a CSS mask, so the colour comes from the page."""
    out = Image.new("RGBA", im.size, (255, 255, 255, 0))
    out.putalpha(im.getchannel("A"))
    return out


def lockup(emblem_im, word_im):
    """Emblem + wordmark at exactly their positions and proportions in the source."""
    ex, ey = EMBLEM_BOX[:2]
    wx, wy = WORD_BOX[:2]
    canvas = Image.new("RGBA", (WORD_BOX[2] - ex, EMBLEM_BOX[3] - ey), (0, 0, 0, 0))
    canvas.alpha_composite(emblem_im, (0, 0))
    canvas.alpha_composite(word_im, (wx - ex, wy - ey))
    return canvas


def trim(im, box=None):
    return im.crop(box or im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox())


def square(im, size, pad=0.04):
    inner = round(size * (1 - 2 * pad))
    scale = inner / max(im.size)
    fit = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(fit, ((size - fit.width) // 2, (size - fit.height) // 2))
    return out


PUBLIC.mkdir(parents=True, exist_ok=True)
primary = lockup(emblem, wordmark)
primary_box = primary.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
primary_light = lockup(emblem, wordmark_light)
emblem_t = trim(emblem)
core_t = trim(emblem_core)
outputs = {
    "cali-logo-primary.png": trim(primary, primary_box),
    "cali-logo-primary-light.png": trim(primary_light, primary_box),
    "cali-logo-primary-mono.png": mono(trim(primary, primary_box)),
    "cali-emblem.png": emblem_t,
    "cali-emblem-mono.png": mono(emblem_t),
    "cali-wordmark.png": trim(wordmark),
    "cali-wordmark-light.png": trim(wordmark_light),
}
for name, im in outputs.items():
    im.save(PUBLIC / name, optimize=True)
    print(f"{name:32} {im.width}x{im.height}")

# Favicons: under 64px the thin orbit disappears, so those sizes use the C and star only.
ico = [square(core_t, s) for s in (16, 32, 48)]
ico[-1].save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:-1])
square(emblem_t, 512).save(APP / "icon.png", optimize=True)
for s in (192, 512):
    square(emblem_t, s).save(PUBLIC / f"icon-{s}.png", optimize=True)
# Apple touch icons can't be transparent: emblem on the app's pale lavender.
touch = Image.new("RGBA", (180, 180), (238, 240, 255, 255))
touch.alpha_composite(square(emblem_t, 180, pad=0.1))
touch.convert("RGB").save(APP / "apple-icon.png", optimize=True)
