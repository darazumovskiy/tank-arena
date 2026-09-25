from pathlib import Path
from io import BytesIO
import sys
import xml.etree.ElementTree as ET
sys.path.insert(0, str(Path(__file__).parent / 'vendor'))
import resvg_py
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
body = ET.fromstring((root / 'tank/body.svg').read_text(encoding='utf-8'))
turret = ET.fromstring((root / 'tank/turret.svg').read_text(encoding='utf-8'))
for element in (body, turret):
    assert element.attrib['viewBox'] == '0 0 64 64'
    assert not any('href' in k for child in element.iter() for k in child.attrib)

def render(size, hull=0, gun=0):
    a = ''.join(ET.tostring(c, encoding='unicode') for c in body)
    b = ''.join(ET.tostring(c, encoding='unicode') for c in turret)
    markup = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 80 80"><g transform="rotate({hull} 32 32)">{a}</g><g transform="rotate({gun} 32 32)">{b}</g></svg>'
    return Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=markup, width=size, height=size, skip_system_fonts=True))).convert('RGBA')

sheet = Image.new('RGBA', (1200, 760), '#08121d')
draw = ImageDraw.Draw(sheet)
font = lambda n: ImageFont.load_default(size=n)
draw.line((64, 64, 1140, 64), fill='#50f5e7', width=2)
draw.text((64, 84), 'PARALLAX', fill='#e9f4e6', font=font(66))
draw.text((67, 163), 'YOU AIM AT THE PAST.', fill='#50f5e7', font=font(22))
draw.text((934, 93), 'ASTRA / 01', fill='#8aabb4', font=font(20))
draw.rounded_rectangle((650, 225, 1140, 595), radius=16, fill='#102330', outline='#294550', width=1)
sheet.alpha_composite(render(520, -25, -10), (65, 205))
sheet.alpha_composite(render(240, 0, 0), (664, 263))
sheet.alpha_composite(render(240, 90, 25), (884, 263))
draw = ImageDraw.Draw(sheet)
draw.text((694, 535), 'HULL + TURRET', fill='#9bbcc1', font=font(17))
draw.text((927, 535), 'FREE AIM', fill='#9bbcc1', font=font(17))
draw.text((72, 686), 'PREDICT / EVADE / REPEAT', fill='#8aabb4', font=font(17))
draw.text((688, 636), 'ACTUAL SCALE', fill='#8aabb4', font=font(16))
# A native 64 x 64 composition verifies legibility without enlargement.
native = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">{ET.tostring(body,encoding="unicode")}{ET.tostring(turret,encoding="unicode")}</svg>'
small = Image.open(BytesIO(resvg_py.svg_to_bytes(svg_string=native,width=64,height=64,skip_system_fonts=True))).convert('RGBA')
sheet.alpha_composite(small, (965, 618))
sheet.convert('RGB').save(root / 'lab/preview.png')
print('Rendered both SVG layers, independent rotation, and native 64 px preview: lab/preview.png')
