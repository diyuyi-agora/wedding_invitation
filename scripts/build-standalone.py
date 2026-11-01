"""Regenerate the offline invitation from the public source files."""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def data_url(relative):
    source = ROOT / relative
    mime = mimetypes.guess_type(source.name)[0] or 'application/octet-stream'
    return f'data:{mime};base64,{base64.b64encode(source.read_bytes()).decode()}'


def stylesheet(match):
    css = (ROOT / match[1]).read_text()
    css = re.sub(r'url\([\'"]?(assets/[^)\'"\s]+)[\'"]?\)',
                 lambda item: f'url("{data_url(item[1])}")', css)
    return f'<style>\n{css}\n</style>'


html = (ROOT / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', stylesheet, html)
html = re.sub(r'<script id="wedding-config"[^>]*></script>',
              lambda _: '<script id="wedding-config">\n' + (ROOT / 'config.js').read_text() + '</script>', html)
html = re.sub(r'  <script id="app-code"[^>]*></script>\n', '', html)
html = re.sub(r'(src|href)="(assets/[^"]+)"',
              lambda item: f'{item[1]}="{data_url(item[2])}"', html)
notices = '\n\n'.join((ROOT / name).read_text() for name in [
    'REFERENCE-LICENSE.txt', 'FONT-LICENSES.txt', 'ROUND-FONT-LICENSE.txt', '资源来源.md'])
html = html.replace('</head>', f'<script type="text/plain" id="third-party-notices">{notices}</script>\n</head>')
html = html.replace('</body>', '<script id="app-code">\n' + (ROOT / 'app.js').read_text() + '\n</script>\n</body>')
output = ROOT / '婚礼邀请函.html'
output.write_text(html)
print(f'Updated {output.name} ({output.stat().st_size:,} bytes)')
