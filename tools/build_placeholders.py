import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gen_placeholders import make_placeholder, make_generic, make_map_placeholder, make_map_generic

with open('/tmp/gamedata.json', encoding='utf-8') as f:
    data = json.load(f)

BASE = os.path.join(os.path.dirname(__file__), '..', 'images')

# 4 張通用「缺圖」預留圖，供 <img onerror> 時退回使用
make_generic(os.path.join(BASE, '_placeholder_monster.png'), 'monster')
make_generic(os.path.join(BASE, '_placeholder_item.png'), 'item')
make_generic(os.path.join(BASE, '_placeholder_weapon.png'), 'weapon')
make_generic(os.path.join(BASE, '_placeholder_armor.png'), 'armor')
make_map_generic(os.path.join(BASE, '_placeholder_map.png'))

count = 0
for slug, m in data['monsters'].items():
    path = os.path.join(BASE, 'monsters', f"{m['imgId']}.png")
    make_placeholder(path, 'monster', m['imgId'], slug)
    count += 1

for slug, it in data['items'].items():
    t = it['type']
    if t == 'weapon':
        path = os.path.join(BASE, 'equip', 'weapon', f"{it['imgId']}.png")
        make_placeholder(path, 'weapon', it['imgId'], slug)
    elif t == 'armor':
        path = os.path.join(BASE, 'equip', 'armor', f"{it['imgId']}.png")
        make_placeholder(path, 'armor', it['imgId'], slug)
    else:
        path = os.path.join(BASE, 'items', f"{it['imgId']}.png")
        make_placeholder(path, 'item', it['imgId'], slug)
    count += 1

for slug, mp in data.get('maps', {}).items():
    path = os.path.join(BASE, 'maps', f"{mp['imgId']}.png")
    make_map_placeholder(path, mp['imgId'], slug)
    count += 1

print(f"產生 {count} 張個別佔位圖 + 5 張通用佔位圖")
