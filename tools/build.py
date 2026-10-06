"""
Сборка ipk TorrStream для webOS.

  python tools/build.py [--version 1.0.2] [--out dist]

Версию подставляет в appinfo.json (в CI — из тега), результат — пакет
com.torrstream.app_<версия>_all.ipk и его копия с постоянным именем
TorrStream-webOS.ipk. Встроенный TorrServer с 1.0.2 — в этой же сборке:
его включает фронтенд TorrStream на любом приложении webOS (torrents.js:
WebOSTorrServer; ставить свой TorrServer можно только с root).

С 1.0.4 в пакете ещё служба com.torrstream.app.service (service/) со
статическим ffprobe под armhf — названия аудиодорожек и субтитров для
встроенного плеера (player.js: webosProbeStart). ffprobe скачивается со
сборок johnvansickle.com и кэшируется в tools/.cache.
"""
import argparse, io, json, lzma, os, shutil, stat, subprocess, tarfile, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFPROBE_URL = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz'
CACHE = os.path.join(ROOT, 'tools', '.cache')


def ffprobe_binary():
    """Статический ffprobe под armhf (32-битное пространство webOS)"""
    path = os.path.join(CACHE, 'ffprobe')
    if os.path.isfile(path):
        return path
    os.makedirs(CACHE, exist_ok=True)
    print('== скачиваю', FFPROBE_URL)
    data = urllib.request.urlopen(FFPROBE_URL, timeout=300).read()
    with tarfile.open(fileobj=io.BytesIO(lzma.decompress(data))) as tar:
        member = next(m for m in tar.getmembers() if m.name.endswith('/ffprobe'))
        with open(path, 'wb') as f:
            f.write(tar.extractfile(member).read())
    return path

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

# Служба с ffprobe; права на запуск — для сборки на Linux (CI); на Windows их
# нет, и служба пробует выставить их сама при старте
svc = os.path.join(work, 'service')
shutil.copytree(os.path.join(ROOT, 'service'), svc)
shutil.copyfile(ffprobe_binary(), os.path.join(svc, 'ffprobe'))
os.chmod(os.path.join(svc, 'ffprobe'), 0o755)

os.makedirs(args.out, exist_ok=True)
subprocess.run('npx -y -p @webos-tools/cli ares-package "%s" "%s" -o "%s"' % (app, svc, args.out), shell=True, check=True)
name = '%s_%s_all.ipk' % (info['id'], info['version'])
shutil.copyfile(os.path.join(args.out, name), os.path.join(args.out, 'TorrStream-webOS.ipk'))
shutil.rmtree(work, ignore_errors=True)
print('==', name, '-> TorrStream-webOS.ipk')
