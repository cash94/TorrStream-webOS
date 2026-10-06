"""
Сборка ipk: обычная и вариант со встроенным TorrServer.

  python tools/build.py [--ts] [--version 1.0.2] [--out dist]

Вариант --ts — отдельное приложение рядом с обычным: свой id
(com.torrstream.app.ts) и название, а запускалка открывает сервер с
?tsdevice=1 — по этой метке фронтенд TorrStream включает встроенный
TorrServer (torrents.js: WebOSTorrServer; нужен root через Homebrew Channel).
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ap = argparse.ArgumentParser()
ap.add_argument('--ts', action='store_true', help='вариант со встроенным TorrServer')
ap.add_argument('--version', help='версия пакета (по умолчанию из app/appinfo.json)')
ap.add_argument('--out', default=os.path.join(ROOT, 'dist'))
args = ap.parse_args()

work = tempfile.mkdtemp()
app = os.path.join(work, 'app')
shutil.copytree(os.path.join(ROOT, 'app'), app)

info_path = os.path.join(app, 'appinfo.json')
info = json.load(open(info_path, encoding='utf-8'))
if args.version:
    info['version'] = args.version
if args.ts:
    info['id'] = 'com.torrstream.app.ts'
    info['title'] = 'TorrStream + TorrServer'
    idx = os.path.join(app, 'index.html')
    s = open(idx, encoding='utf-8').read()
    assert "var EXTRA_QUERY = '';" in s
    s = s.replace("var EXTRA_QUERY = '';", "var EXTRA_QUERY = 'tsdevice=1';")
    open(idx, 'w', encoding='utf-8').write(s)
json.dump(info, open(info_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)

os.makedirs(args.out, exist_ok=True)
subprocess.run('npx -y -p @webos-tools/cli ares-package "%s" -o "%s"' % (app, args.out), shell=True, check=True)
name = '%s_%s_all.ipk' % (info['id'], info['version'])
const = 'TorrStream-webOS-TorrServer.ipk' if args.ts else 'TorrStream-webOS.ipk'
shutil.copyfile(os.path.join(args.out, name), os.path.join(args.out, const))
shutil.rmtree(work, ignore_errors=True)
print('==', name, '->', const)
