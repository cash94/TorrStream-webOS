# TorrStream для webOS (LG)

Приложение TorrStream для телевизоров LG на webOS — `.ipk`.

Как и Android-приложение, оно открывает интерфейс с сервера TorrStream
(по умолчанию общий `http://torrstream.online`, адрес можно сменить), поэтому
обновляется без переустановки. Отличие от Android — только в плеере: на webOS
видео играет встроенный плеер TorrStream через `<video>` прямо с TorrServer.
Медиаконвейер телевизора сам открывает MKV, HEVC и многоканальный звук, без
ffmpeg и серверного HLS. Поэтому TorrServer может быть и в домашней сети, и на
сервере — телевизор ходит к нему напрямую.

Во фронтенде (`public/js` TorrStream) за это отвечают:
- `config.js: detectPlatform` — webOS только по `PalmSystem` / `webOSSystem` (их даёт
  среда приложений webOS; браузер телевизора считается обычным браузером);
- `app.js: setupCheckboxes` — на webOS всегда прямой режим (`transcodingFullOnOff`),
  настройки серверного транскодирования скрыты, как в Android-приложении;
- `player.js: initTranscodingOffPlayback` — сам прямой путь: `<ts>/stream?link=…&play`,
  дорожки звука из `video.audioTracks`.

## Встроенный TorrServer

С 1.0.2 — в основной сборке (до неё была отдельная `com.torrstream.app.ts`).
Настройки → TorrServer → «Использовать TorrServer, установленный на этом
устройстве», как в Android-приложении. Сначала проверяется
`127.0.0.1:8090/echo`: если TorrServer уже работает — используется он. Иначе на
телевизоре с root (Homebrew Channel) приложение скачивает официальную сборку
YouROK `TorrServer-linux-arm7` в `/media/developer/torrstream-torrserver`,
запускает её и ставит автозапуск (`/var/lib/webosbrew/init.d`). Всё через
`luna://org.webosbrew.hbchannel.service/exec`; код — `torrents.js: WebOSTorrServer`.
Без root приложение работает как обычно.

## Названия дорожек (ffprobe)

С 1.0.4 в пакете служба `com.torrstream.app.service` (`service/`) со
статическим `ffprobe` под armhf (сборки johnvansickle.com, скачивает
`tools/build.py`). Плеер (`player.js: webosProbeStart`) спрашивает у неё потоки
файла и подписывает аудиодорожки и субтитры: название, язык, каналы, кодек,
«по умолчанию»/«принудительные». ffprobe запускается через `execFile` без
оболочки; ошибки отдаются без адреса (в нём бывают логин и пароль TorrServer).

## Что в пакете

`app/` — запускалка:
- `appinfo.json` — `disableBackHistoryAPI`: «Назад» приходит в приложение клавишей 461;
- `index.html` — при старте открывает сохранённый адрес сервера через 3 секунды;
  ОК во время отсчёта — форма смены адреса. Перед переходом проверяет
  `/api/version`: ответ должен быть версией TorrStream (иначе форма с ошибкой).

## Сборка

Тег `v*` → workflow `build.yml`: версия из тега → `ares-package` → релиз с
`TorrStream-webOS.ipk` (постоянное имя:
`releases/latest/download/TorrStream-webOS.ipk`).

Локально: `npx -p @webos-tools/cli ares-package app -o dist`.

## Установка на телевизор

**Developer Mode** (любой LG на webOS):
1. На ТВ: LG Content Store → приложение «Developer Mode», вход с учётной записью
   LG, включить Dev Mode Status и Key Server, перезагрузить ТВ.
2. На ПК: `npx -p @webos-tools/cli ares-setup-device` (IP телевизора, порт 9922,
   пользователь prisoner), затем `ares-novacom --device tv --getkey` с паролем
   (passphrase) из приложения на ТВ.
3. `ares-install --device tv TorrStream-webOS.ipk`.

Сессия Developer Mode истекает (по документации LG — через 50 часов), её
продлевает кнопка Extend в приложении на ТВ; иначе установленные так приложения
пропадают.

**Homebrew Channel** (webosbrew) — ставит ipk и обновляет их из репозиториев;
требует root или режим разработчика, зависит от модели и прошивки.
