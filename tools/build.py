#!/usr/bin/env python3
"""Build Voilà chef — static trilingual site.

    python tools/build.py            # HTML + sitemap + robots
    python tools/build.py --images   # also regenerate responsive images from source/img/*.jpg

Content: content/site.json + content/{ja,en,fr}.json. Templates: templates/*.html.
Output: /<lang>/index.html, /<lang>/<demande>.html, /<lang>/<legal>.html, sitemap.xml, robots.txt.
"""
import json, sys, time, pathlib
from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = json.loads((ROOT / 'content' / 'site.json').read_text(encoding='utf-8'))
LANGS = {l: json.loads((ROOT / 'content' / f'{l}.json').read_text(encoding='utf-8')) for l in SITE['langs']}
BUILD_ID = time.strftime('%Y%m%d%H%M')
IMG_WIDTHS = (800, 1400, 2000)
IMAGES = {  # name -> (source file, crop box or None)
    'hero': ('hero-table.jpg', None),
    'domicile': ('hero-table.jpg', (0, 420, 1560, 1536)),
    'chef-kazu': ('plat-francais.jpg', None),
    'chef-yuichiro': ('plat-japonais.jpg', None),
    'apero': ('apero.jpg', None),
    'cave': ('apero.jpg', (1380, 180, 2752, 1300)),
}


def url_for(lang, page):
    slug = LANGS[lang]['pages'][page]
    return f'/{lang}' + (f'/{slug}' if slug else '')


def picture(name, alt, sizes, cls='', eager=False):
    """<picture> with WebP + JPEG srcset. Files: assets/img/<name>-<w>.(webp|jpg)."""
    webp = ', '.join(f'/assets/img/{name}-{w}.webp {w}w' for w in IMG_WIDTHS)
    jpg = ', '.join(f'/assets/img/{name}-{w}.jpg {w}w' for w in IMG_WIDTHS)
    attrs = f'class="{cls}" ' if cls else ''
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    return Markup(
        f'<picture><source type="image/webp" srcset="{webp}" sizes="{sizes}">'
        f'<img {attrs}src="/assets/img/{name}-1400.jpg" srcset="{jpg}" sizes="{sizes}" alt="{alt}" {load}></picture>'
    )


def jsonld(lang):
    t = LANGS[lang]
    return {
        '@context': 'https://schema.org',
        '@type': ['FoodEstablishment', 'LocalBusiness'],
        'name': SITE['name'],
        'alternateName': 'ヴォワラ・シェフ',
        'description': t['meta']['index_desc'],
        'url': SITE['base_url'] + url_for(lang, 'index'),
        'image': SITE['base_url'] + SITE['og_image'],
        'email': SITE['email'],
        'servesCuisine': ['French', 'Japanese'],
        'priceRange': '$$$$',
        'address': {'@type': 'PostalAddress', 'addressLocality': 'Kyoto', 'addressRegion': 'Kyoto', 'addressCountry': 'JP'},
        'areaServed': [
            {'@type': 'Country', 'name': 'Japan'}, {'@type': 'Place', 'name': 'Bali'}, {'@type': 'Country', 'name': 'France'}
        ],
        'parentOrganization': {'@type': 'Organization', 'name': 'Voilà les enfants', 'url': SITE['school_url']},
        'makesOffer': [
            {'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': it['name'], 'description': it['text']}}
            for it in t['tables']['items']
        ],
        'inLanguage': lang,
    }


def build_html():
    env = Environment(loader=FileSystemLoader(ROOT / 'templates'), autoescape=select_autoescape(['html']), trim_blocks=True, lstrip_blocks=True)
    env.globals.update(url_for=url_for, picture=picture)
    pages = {'index': ('index.html', 'index_title', 'index_desc'), 'demande': ('demande.html', 'demande_title', 'demande_desc'), 'legal': ('legal.html', 'legal_title', 'legal_desc')}
    urls = []
    for lang, t in LANGS.items():
        out_dir = ROOT / lang
        out_dir.mkdir(exist_ok=True)
        for page, (tpl, tk, dk) in pages.items():
            html = env.get_template(tpl).render(site=SITE, t=t, page=page, page_title=t['meta'][tk], page_desc=t['meta'][dk], build_id=BUILD_ID, jsonld=jsonld(lang))
            slug = t['pages'][page] or 'index'
            (out_dir / f'{slug}.html').write_text(html, encoding='utf-8')
            urls.append((lang, page))
            print('wrote', f'{lang}/{slug}.html')
    # sitemap with hreflang
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for lang, page in urls:
        lines.append('  <url>')
        lines.append(f'    <loc>{SITE["base_url"]}{url_for(lang, page)}</loc>')
        for l in SITE['langs']:
            lines.append(f'    <xhtml:link rel="alternate" hreflang="{l}" href="{SITE["base_url"]}{url_for(l, page)}"/>')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{SITE["base_url"]}{url_for(SITE["default_lang"], page)}"/>')
        lines.append(f'    <priority>{"1.0" if page == "index" else "0.6"}</priority>')
        lines.append('  </url>')
    lines.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    (ROOT / 'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE["base_url"]}/sitemap.xml\n', encoding='utf-8')
    print('wrote sitemap.xml, robots.txt')


def build_images():
    from PIL import Image
    src = ROOT / 'source' / 'img'
    out = ROOT / 'assets' / 'img'
    out.mkdir(parents=True, exist_ok=True)
    for name, (file, box) in IMAGES.items():
        im = Image.open(src / file).convert('RGB')
        if box:
            im = im.crop(box)
        for w in IMG_WIDTHS:
            r = min(1.0, w / im.width)
            v = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS) if r < 1 else im
            v.save(out / f'{name}-{w}.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
            v.save(out / f'{name}-{w}.webp', 'WEBP', quality=78, method=6)
            print('img', f'{name}-{w}', v.size)


if __name__ == '__main__':
    if '--images' in sys.argv:
        build_images()
    build_html()
