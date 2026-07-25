#!/usr/bin/env python3
"""
產生怪物/道具/武器/防具的預留(placeholder)圖片。
每個資料項目一張圖，檔名＝imgId.png，內容標示分類/編號/英文id，
方便使用者知道「這個編號對應哪個怪物或道具」，之後直接用同檔名覆蓋即可自動生效。
"""
import json
from PIL import Image, ImageDraw, ImageFont
import os

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

SIZE = 128
CATEGORY_STYLE = {
    'monster': {'bg': (58, 42, 74), 'accent': (196, 132, 235), 'label': 'MONSTER'},
    'item':    {'bg': (38, 62, 58), 'accent': (110, 214, 168), 'label': 'ITEM'},
    'weapon':  {'bg': (74, 52, 30), 'accent': (235, 168, 92), 'label': 'WEAPON'},
    'armor':   {'bg': (32, 46, 68), 'accent': (110, 168, 224), 'label': 'ARMOR'},
}

def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def draw_icon(draw, kind, accent):
    cx, cy = SIZE // 2, SIZE // 2 - 8
    if kind == 'monster':
        draw.ellipse([cx-30, cy-22, cx+30, cy+22], outline=accent, width=4)
        draw.ellipse([cx-14, cy-8, cx-4, cy+2], fill=accent)
        draw.ellipse([cx+4, cy-8, cx+14, cy+2], fill=accent)
    elif kind == 'item':
        draw.polygon([(cx, cy-28), (cx+28, cy), (cx, cy+28), (cx-28, cy)], outline=accent, width=4)
    elif kind == 'weapon':
        draw.line([cx-24, cy+24, cx+24, cy-24], fill=accent, width=6)
        draw.line([cx-24, cy+24, cx-14, cy+14], fill=accent, width=6)
        draw.polygon([(cx+18,cy-30),(cx+30,cy-18),(cx+16,cy-12)], fill=accent)
    elif kind == 'armor':
        draw.polygon([(cx, cy-28), (cx+24, cy-16), (cx+24, cy+10), (cx, cy+28), (cx-24, cy+10), (cx-24, cy-16)], outline=accent, width=4)

def make_placeholder(path, kind, img_id, slug, name_zh=None):
    style = CATEGORY_STYLE[kind]
    im = Image.new('RGB', (SIZE, SIZE), style['bg'])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, SIZE-1, SIZE-1], outline=style['accent'], width=3)
    draw_icon(d, kind, style['accent'])

    f_label = font(FONT_BOLD, 13)
    f_id = font(FONT_BOLD, 15)
    f_slug = font(FONT_REG, 11)

    label = style['label']
    lw = d.textlength(label, font=f_label)
    d.text(((SIZE-lw)/2, 8), label, font=f_label, fill=style['accent'])

    idtext = f"#{img_id}"
    iw = d.textlength(idtext, font=f_id)
    d.text(((SIZE-iw)/2, SIZE-42), idtext, font=f_id, fill=(255,255,255))

    sw = d.textlength(slug, font=f_slug)
    # 若英文id太長就縮小或截斷
    if sw > SIZE - 10:
        while d.textlength(slug + "...", font=f_slug) > SIZE - 10 and len(slug) > 3:
            slug = slug[:-1]
        slug = slug + "..."
        sw = d.textlength(slug, font=f_slug)
    d.text(((SIZE-sw)/2, SIZE-22), slug, font=f_slug, fill=(210,210,210))

    im.save(path)

MAP_SIZE = (480, 270)
MAP_STYLE = {'bg': (30, 40, 34), 'accent': (140, 196, 150), 'label': 'MAP'}

def make_map_placeholder(path, img_id, slug):
    im = Image.new('RGB', MAP_SIZE, MAP_STYLE['bg'])
    d = ImageDraw.Draw(im)
    w, h = MAP_SIZE
    accent = MAP_STYLE['accent']
    d.rectangle([0, 0, w-1, h-1], outline=accent, width=3)
    # 簡易山巒剪影，示意這是地圖底圖
    horizon = int(h * 0.62)
    d.line([(0, horizon), (w, horizon)], fill=accent, width=2)
    d.polygon([(0, horizon), (90, horizon-70), (170, horizon)], outline=accent, width=3)
    d.polygon([(140, horizon), (240, horizon-100), (340, horizon)], outline=accent, width=3)
    d.polygon([(300, horizon), (390, horizon-60), (480, horizon)], outline=accent, width=3)
    d.ellipse([w-90, 30, w-40, 80], outline=accent, width=3)  # 太陽/月亮

    f_label = font(FONT_BOLD, 22)
    f_id = font(FONT_BOLD, 18)
    f_slug = font(FONT_REG, 14)

    label = MAP_STYLE['label']
    lw = d.textlength(label, font=f_label)
    d.text(((w-lw)/2, 16), label, font=f_label, fill=accent)

    idtext = f"#{img_id}"
    iw = d.textlength(idtext, font=f_id)
    d.text(((w-iw)/2, h-64), idtext, font=f_id, fill=(255,255,255))

    sw = d.textlength(slug, font=f_slug)
    d.text(((w-sw)/2, h-38), slug, font=f_slug, fill=(210,210,210))

    im.save(path)

def make_map_generic(path):
    im = Image.new('RGB', MAP_SIZE, MAP_STYLE['bg'])
    d = ImageDraw.Draw(im)
    w, h = MAP_SIZE
    accent = MAP_STYLE['accent']
    d.rectangle([0, 0, w-1, h-1], outline=accent, width=3)
    horizon = int(h * 0.62)
    d.line([(0, horizon), (w, horizon)], fill=accent, width=2)
    d.polygon([(60, horizon), (170, horizon-90), (280, horizon)], outline=accent, width=3)
    f_label = font(FONT_BOLD, 20)
    label = "NO MAP IMAGE"
    lw = d.textlength(label, font=f_label)
    d.text(((w-lw)/2, h-48), label, font=f_label, fill=(255,255,255))
    im.save(path)

def make_generic(path, kind):
    style = CATEGORY_STYLE[kind]
    im = Image.new('RGB', (SIZE, SIZE), style['bg'])
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, SIZE-1, SIZE-1], outline=style['accent'], width=3)
    draw_icon(d, kind, style['accent'])
    f_label = font(FONT_BOLD, 14)
    label = "NO IMAGE"
    lw = d.textlength(label, font=f_label)
    d.text(((SIZE-lw)/2, SIZE-26), label, font=f_label, fill=(255,255,255))
    im.save(path)

if __name__ == '__main__':
    import sys
    sys.path.insert(0, '.')
    print("this script is invoked with data passed via stdin json")
