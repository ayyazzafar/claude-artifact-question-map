#!/usr/bin/env python3
"""Build a Question Map v2 page (designer's 1a Notebook + 1c rail) as one self-contained file.

Usage: python3 build.py --title "My Question Map" --topic "Project catch-up" \
         --thread "My Claude session" --out <path>/index.html [--maps maps.json] [--url <artifact url>]

Sources: template.dc.html (the designer's template; logic block ignored), logic.js (our data
layer), support.js (dc runtime, patched below so it needs no eval and no self-fetch).
Bump QM_VERSION (and VERSION) when anything changes, then rebuild and republish every map you own.
"""
import argparse, json, pathlib, re

_vf = pathlib.Path(__file__).parent / 'VERSION'
QM_VERSION = _vf.read_text().strip() if _vf.exists() else 'dev'
here = pathlib.Path(__file__).parent
p = argparse.ArgumentParser()
p.add_argument('--title', required=True)
p.add_argument('--topic', required=True)
p.add_argument('--thread', required=True)
p.add_argument('--out', required=True)
p.add_argument('--standalone', action='store_true', help='list no other maps (a map that belongs to another Claude project, e.g. the kids project)')
p.add_argument('--url', default='', help='this map\'s own artifact URL (else looked up in the maps file by --out)')
p.add_argument('--maps', default='', help='optional JSON list of your maps [{title, topic, thread, url, file}] so each map can switch to the others')
a = p.parse_args()

src = (here / 'template.dc.html').read_text()
tpl = src[src.index('<x-dc>') + len('<x-dc>'):src.rindex('</x-dc>')]
helmet = re.search(r'<helmet>(.*?)</helmet>', tpl, re.S)
tpl = tpl.replace(helmet.group(0), '')
head = helmet.group(1)

def sub(old, new, count=1):
    global tpl
    n = tpl.count(old)
    assert n == count, f'expected {count} of {old[:60]!r}, found {n}'
    tpl = tpl.replace(old, new)

SEGS = ('<sc-for list="{{ bl.segs }}" as="s"><sc-if value="{{ s.b }}"><b style="font-weight:700">{{ s.t }}</b></sc-if>'
        '<sc-if value="{{ s.c }}"><code style="font:500 .86em \'JetBrains Mono\',monospace;background:var(--soft);border:1px solid var(--line);border-radius:5px;padding:0 4px">{{ s.t }}</code></sc-if>'
        '<sc-if value="{{ s.l }}"><a href="{{ s.href }}" target="_blank" rel="noopener" style="overflow-wrap:break-word;word-break:normal">{{ s.t }}</a></sc-if>'
        '<sc-if value="{{ s.i }}"><i>{{ s.t }}</i></sc-if>'
        '<sc-if value="{{ s.x }}"><s style="text-decoration:line-through;color:var(--mute)">{{ s.t }}</s></sc-if>'
        '<sc-if value="{{ s.n }}">{{ s.t }}</sc-if></sc-for>')
old_blocks = re.search(r'<sc-for list="\{\{ rd\.blocks \}\}" as="bl">.*?</sc-for></span></div></sc-for>', tpl).group(0)
sub(old_blocks,
    '<sc-for list="{{ rd.blocks }}" as="bl"><div style="background:{{ bl.cbg }};box-shadow:{{ bl.cbar }};padding:{{ bl.cpad }};border-radius:6px;text-decoration:{{ bl.deco }};opacity:{{ bl.cop }};min-width:0">'
    '<sc-if value="{{ bl.isChgNote }}"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13.5px;color:var(--mute);border:1px dashed var(--upd);border-radius:10px;padding:6px 10px"><span style="flex:1;min-width:160px">{{ bl.chgText }}</span><button onClick="{{ bl.onChg }}" style="min-height:28px;padding:0 10px;border-radius:99px;border:1px solid var(--line2);font-weight:600;font-size:13px;white-space:nowrap">{{ bl.chgBtn }}</button></div></sc-if>'
    '<sc-if value="{{ bl.isH }}"><div style="font:600 18px/1.3 \'Newsreader\',serif;margin-top:4px;text-wrap:balance">' + SEGS + '</div></sc-if>'
    '<sc-if value="{{ bl.isBody }}"><div style="display:flex;gap:8px;padding-left:{{ bl.pad }}"><sc-if value="{{ bl.isLi }}"><span style="color:var(--mute);font-variant-numeric:tabular-nums;flex:none;min-width:14px">{{ bl.num }}</span></sc-if>'
    '<sc-if value="{{ bl.isQuote }}"><span style="flex:none;width:3px;border-radius:2px;background:var(--line2)"></span></sc-if>'
    '<span style="text-wrap:pretty;min-width:0;overflow-wrap:break-word;word-break:normal">' + SEGS + '</span></div></sc-if>'
    '<sc-if value="{{ bl.isPre }}"><pre style="margin:0;overflow-x:auto;background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:500 13px/1.5 \'JetBrains Mono\',monospace;white-space:pre">{{ bl.text }}</pre></sc-if>'
    '<sc-if value="{{ bl.isImg }}"><figure style="margin:6px 0;display:flex;flex-direction:column;gap:6px;width:{{ bl.imgW }};max-width:100%"><button onClick="{{ bl.onImg }}" title="Open full size" aria-label="Open image full size: {{ bl.alt }}" class="qm-img" style="display:block;padding:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--soft);cursor:zoom-in;max-width:100%"><img src="{{ bl.src }}" alt="{{ bl.alt }}" loading="lazy" style="display:block;width:100%;height:auto;max-height:70vh;object-fit:contain"/></button><sc-if value="{{ bl.hasCap }}"><figcaption style="font-size:13.5px;color:var(--mute);line-height:1.4">{{ bl.alt }}</figcaption></sc-if></figure></sc-if>'
    '<sc-if value="{{ bl.isHr }}"><hr style="border:0;border-top:1px solid var(--line);margin:4px 0;width:100%"></sc-if>'
    '<sc-if value="{{ bl.isTable }}"><div style="overflow-x:auto;max-width:100%;border:1px solid var(--line);border-radius:10px"><table style="border-collapse:collapse;width:100%;font-size:.94em;line-height:1.45">'
    '<sc-for list="{{ bl.rows }}" as="tr"><tr><sc-for list="{{ tr.cells }}" as="cl"><td style="padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left;font-weight:{{ cl.fw }};background:{{ cl.bg }};min-width:90px">'
    + SEGS.replace('bl.segs', 'cl.segs') + '</td></sc-for></tr></sc-for></table></div></sc-if>'
    '</div></sc-for>')

old_files = re.search(r'<sc-if value="\{\{ rd\.hasFiles \}\}">.*?</sc-if>\n', tpl).group(0)
sub(old_files,
    '<sc-if value="{{ rd.hasFiles }}"><div style="display:flex;gap:8px;flex-wrap:wrap"><sc-for list="{{ rd.files }}" as="f">'
    '<button onClick="{{ f.onOpen }}" title="Preview" style="display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:4px 10px 4px 4px;font-size:13.5px;color:var(--ink);text-decoration:none;max-width:100%;min-width:0;background:transparent;cursor:zoom-in">'
    '<sc-if value="{{ f.isImg }}"><span role="img" aria-label="Image" style="width:30px;height:30px;flex:none;border-radius:6px;background-size:cover;background-position:center;background-image:{{ f.bg }}"></span></sc-if>'
    '<sc-if value="{{ f.notImg }}"><span style="width:30px;height:30px;flex:none;border-radius:6px;background:var(--soft);display:grid;place-items:center;font:500 9px \'JetBrains Mono\',monospace">{{ f.ext }}</span></sc-if>'
    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.name }}</span></button></sc-for></div></sc-if>\n')  # v2.42: opens the attachment viewer (new tabs are blocked inside the artifact frame)

sub('<b>Couldn\'t send this question.</b> Your text is saved on this device.', '<b>{{ rd.failHead }}</b> {{ rd.failText }}')
# v2.27: the app title is the map switcher (maps sit a level above workspaces)
# v2.35: a small MAP label above it, so it never reads as a second WORKSPACE dropdown (designer review)
MAPBTN = ('<button onClick="{{ openMapPicker }}" title="Switch map" aria-label="Switch map: {{ appTitle }}" style="display:flex;align-items:center;gap:6px;min-width:0;padding:2px 6px 2px 0;border-radius:8px;color:var(--ink);text-align:left">'
          '<span style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font:500 10.5px \'JetBrains Mono\',monospace;letter-spacing:.08em;color:var(--mute)">MAP</span>'
          '<span style="font:500 SIZEpx \'Newsreader\',serif;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ appTitle }}</span></span>'
          '<span aria-hidden="true" style="color:var(--mute);font-size:12px;flex:none">▾</span></button>')
sub('<span style="font:500 23px \'Newsreader\',serif">Question Map</span>', MAPBTN.replace('SIZE', '21'))
sub('<span style="font:500 22px \'Newsreader\',serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ appTitle }}</span>', MAPBTN.replace('SIZE', '22'))
sub('>Settings and demo</button>', '>Settings</button>')
# v2.48: a draft Claude cancelled shows a red "Don't send" box, struck-through text, and no Copy / Mark sent
sub('<div style="font-size:16px;line-height:1.55;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal">{{ d.text }}</div>',
    '<sc-if value="{{ d.isCancelled }}"><div role="note" style="border:1.5px solid var(--del);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;font-size:14.5px;line-height:1.45"><span><b style="font-weight:700;color:var(--del)">\U0001F6AB Don\u2019t send this draft.</b> {{ d.cancelWhy }}</span>'
    '<sc-if value="{{ d.hasUseIn }}"><button onClick="{{ d.onUseIn }}" style="align-self:flex-start;min-height:32px;padding:0 12px;border-radius:99px;border:1px solid var(--line2);font-weight:600;font-size:13.5px;text-align:left">{{ d.useInLabel }}</button></sc-if></div></sc-if>'
    '<div style="font-size:16px;line-height:1.55;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;text-decoration:{{ d.deco }}">{{ d.text }}</div>')
sub('style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--backdrop)',
    'style="height:100%;display:flex;align-items:center;justify-content:center;background:var(--backdrop)')
assert '</script' not in tpl.lower()

# v2.24: every map lists the others (from ../maps.json) in its workspace switcher, opening in a new tab
try: maps = json.loads(pathlib.Path(a.maps).expanduser().read_text()) if a.maps else []
except Exception: maps = []
out_abs = str(pathlib.Path(a.out).resolve())
self_url = a.url or next((m.get('url', '') for m in maps if m.get('file') and str(pathlib.Path(m['file']).resolve()) == out_abs), '')
others = [{'title': m.get('title', ''), 'topic': m.get('topic', ''), 'thread': m.get('thread', ''), 'url': m['url']} for m in maps if m.get('url') and m.get('url') != self_url]
# v2.33 (2 Nov): the answering thread's name comes from maps.json when the map is listed there, so a thread move is one edit
self_thread = next((m.get('thread') for m in maps if self_url and m.get('url') == self_url and m.get('thread')), None)
if a.standalone: others = []
cfg = {'title': a.title, 'topic': a.topic, 'thread': self_thread or a.thread, 'selfUrl': self_url, 'maps': others}
sup = (here / 'support.js').read_text()
def patch(old, new):
    global sup
    assert sup.count(old) == 1, old
    sup = sup.replace(old, new)
patch('  function evalDcLogic(src) {\n', '  function evalDcLogic(src) {\n    if (window.__QM_LOGIC) return window.__QM_LOGIC(StreamableLogic, getReact());\n')
patch('    return {\n      template: dc.innerHTML,', '    const qmTpl = doc.getElementById("qm-tpl");\n    return {\n      template: qmTpl ? qmTpl.textContent : dc.innerHTML,')

page = f'''<title>{a.title}</title>
<meta name="qm-version" content="{QM_VERSION}">
<script type="application/json" id="claude-artifacts-manifest">{{"permissions": ["notifications", "menu-bar"]}}</script>
{head.strip()}
<style>
:root{{--page:#f7f4ee}}
@media (prefers-color-scheme: dark){{:root:not([data-theme="light"]){{--page:#1a1916;color-scheme:dark}}}}
:root[data-theme="dark"]{{--page:#1a1916;color-scheme:dark}}
html,body{{height:100%;background:var(--page)}}
.qm-img{{transition:box-shadow .15s ease}} .qm-img:hover{{box-shadow:0 2px 12px rgba(0,0,0,.12)}} .qm-img:focus-visible{{outline:2px solid var(--acc);outline-offset:2px}} .qm-navb{{transition:background .12s ease}} .qm-navb:hover:not(:disabled){{background:var(--sel)}} .qm-chipq:hover{{background:var(--soft)}} .qm-hovin{{animation:qmHovIn .18s ease}} @keyframes qmHovIn{{from{{opacity:0}}to{{opacity:1}}}} @media (prefers-reduced-motion:reduce){{.qm-hovin{{animation:none}}}} .qm-chipq:focus-visible{{outline:2px solid var(--acc);outline-offset:1px}} .qm-navb:active:not(:disabled){{transform:scale(.94)}} .qm-navb:focus-visible{{outline:2px solid var(--acc);outline-offset:1px}} .qm-hist .qm-navb:focus-visible{{outline-offset:-2px}}
</style>
<x-dc></x-dc>
<script type="text/plain" id="qm-tpl">{tpl}</script>
<script type="text/x-dc" data-dc-script>// logic is window.__QM_LOGIC below</script>
<script>window.QM_CONFIG = {json.dumps(cfg, ensure_ascii=False)}; window.__resources = {{}};</script>
<script>
{(here / 'logic.js').read_text()}
</script>
<script>
{sup}
</script>
'''
pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
pathlib.Path(a.out).write_text(page)
print('built', a.out, len(page), 'bytes')
