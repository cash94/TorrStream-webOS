"""
Сборка ipk TorrStream для webOS.

  python tools/build.py [--version 1.0.2] [--out dist]

Версию подставляет в appinfo.json (в CI — из тега), результат — пакет
com.torrstream.app_<версия>_all.ipk и его копия с постоянным именем
TorrStream-webOS.ipk. Встроенный TorrServer с 1.0.2 — в этой же сборке:
его включает фронтенд TorrStream на любом приложении webOS (torrents.js:
WebOSTorrServer; ставить свой TorrServer можно только с root).
"""
import argparse, json, os, shutil, subprocess, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

ap = argparse.ArgumentParser()
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
json.dump(info, open(info_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=4)

os.makedirs(args.out, exist_ok=True)
subprocess.run('npx -y -p @webos-tools/cli ares-package "%s" -o "%s"' % (app, args.out), shell=True, check=True)
name = '%s_%s_all.ipk' % (info['id'], info['version'])
shutil.copyfile(os.path.join(args.out, name), os.path.join(args.out, 'TorrStream-webOS.ipk'))
shutil.rmtree(work, ignore_errors=True)
print('==', name, '-> TorrStream-webOS.ipk')
