/*
 * Служба TorrStream для webOS: ffprobe для встроенного плеера.
 *
 * Конвейер webOS отдаёт дорожки почти без подписей, и плеер (player.js:
 * webosProbeStart) спрашивает здесь потоки файла, чтобы назвать аудиодорожки
 * и субтитры по-человечески. Рядом лежит статический ffprobe под armhf
 * (johnvansickle.com, кладёт tools/build.py).
 *
 * Запускаем через execFile с аргументами списком, без оболочки: адрес приходит
 * со страницы и в командную строку как текст попадать не должен.
 *
 * rutube — ответ API RuTube (поиск, play/options) для трейлеров: сам RuTube
 * не отдаёт Access-Control-Allow-Origin, и страница его не прочитает, а
 * служба — может. Так трейлер ищется с телевизора, мимо сервера TorrStream;
 * видео телевизор берёт с RuTube сам через <video> (фронтенд, catalog.js:
 * rutubeVideoDirect).
 * ES5: на старых webOS Node.js 0.10–0.12.
 */
var Service = require('webos-service');
var execFile = require('child_process').execFile;
var dns = require('dns');
var url = require('url');
var path = require('path');
var https = require('https');
var fs = require('fs');

var service = new Service('com.torrstream.app.service');
var FFPROBE = path.join(__dirname, 'ffprobe');

// Права на запуск теряются, если ipk собирали на Windows — пробуем выставить
try { require('fs').chmodSync(FFPROBE, 493); } catch (e) { }   // 0755

service.register('ffprobe', function (message) {
    var uri = message.payload && message.payload.uri;
    if (typeof uri !== 'string' || !/^https?:\/\//i.test(uri)) {
        message.respond({ returnValue: false, errorText: 'нужен адрес http(s)' });
        return;
    }
    var u = url.parse(uri);
    // Статическому ffprobe (glibc без NSS) DNS недоступен — имя хоста разрешаем
    // здесь. Для https оставляем имя: сертификат выписан на него, не на IP
    dns.lookup(u.hostname, 4, function (err, address) {
        var target = uri;
        if (!err && address && u.protocol === 'http:') {
            target = 'http://' + (u.auth ? u.auth + '@' : '') + address + (u.port ? ':' + u.port : '') + u.path;
        }
        execFile(FFPROBE, ['-v', 'error', '-show_streams', '-print_format', 'json', target],
            { timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
            function (error, stdout, stderr) {
                if (error) {
                    // Не error.message: в нём вся командная строка, а в адресе
                    // бывают логин и пароль TorrServer
                    var first = String(stderr || '').split('\n')[0].replace(/https?:\/\/\S+/g, '<адрес>').slice(0, 200);
                    message.respond({
                        returnValue: false,
                        errorText: (error.killed ? 'нет ответа за 30 с' : 'код ' + (error.code === undefined ? '?' : error.code)) +
                            (first ? ': ' + first : '')
                    });
                    return;
                }
                message.respond({ returnValue: true, data: String(stdout) });
            });
    });
});

// ==================== RuTube ====================

var RUTUBE_TIMEOUT_MS = 15000;
var RUTUBE_MAX_BYTES = 4 * 1024 * 1024;
var RUTUBE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0 Safari/537.36 WebAppManager',
    'Accept': 'application/json',
    'Referer': 'https://rutube.ru/'
};
// Старые webOS (Node.js 0.10–0.12) не знают корня Let's Encrypt, которым
// подписан rutube.ru: с их встроенным списком запрос падает на проверке
// сертификата. Тогда повторяем со своими корнями ISRG (ca/letsencrypt.pem) —
// проверка остаётся, просто с корнем, которого в старой Node.js нет
var LE_ROOTS = null;
try { LE_ROOTS = fs.readFileSync(path.join(__dirname, 'ca', 'letsencrypt.pem'), 'utf8'); } catch (e) { }
var CERT_ERRORS = /CERT|ISSUER|SELF_SIGNED|UNABLE_TO_VERIFY|certificate/i;

function isRutubeApi(u) {
    return u && u.protocol === 'https:' && u.hostname === 'rutube.ru' && !u.port &&
        typeof u.pathname === 'string' && u.pathname.indexOf('/api/') === 0;
}

/** GET к API RuTube; done(ошибка, тело). Ошибка — {text, status} */
function rutubeGet(u, ca, done) {
    var finished = false;
    var finish = function (err, body) {
        if (finished) return;
        finished = true;
        done(err, body);
    };
    var options = { hostname: u.hostname, port: 443, path: u.path, method: 'GET', headers: RUTUBE_HEADERS };
    if (ca) { options.ca = ca; options.agent = false; }
    var req = https.request(options, function (res) {
        if (res.statusCode !== 200) {
            res.resume();
            finish({ text: 'RuTube: HTTP ' + res.statusCode, status: res.statusCode });
            return;
        }
        var chunks = [], size = 0;
        res.on('data', function (c) {
            size += c.length;
            if (size > RUTUBE_MAX_BYTES) { req.abort(); finish({ text: 'RuTube: ответ больше 4 МБ' }); return; }
            chunks.push(c);
        });
        res.on('end', function () { finish(null, Buffer.concat(chunks).toString('utf8')); });
        res.on('error', function (e) { finish({ text: 'RuTube: ' + (e.code || e.message) }); });
    });
    req.setTimeout(RUTUBE_TIMEOUT_MS, function () {
        req.abort();
        finish({ text: 'RuTube: нет ответа за ' + (RUTUBE_TIMEOUT_MS / 1000) + ' с' });
    });
    req.on('error', function (e) {
        finish({ text: 'RuTube: ' + (e.code || e.message), cert: CERT_ERRORS.test(String(e.code || '') + ' ' + String(e.message || '')) });
    });
    req.end();
}

service.register('rutube', function (message) {
    var target = message.payload && message.payload.url;
    var u = typeof target === 'string' ? url.parse(target) : null;
    if (!isRutubeApi(u)) {
        message.respond({ returnValue: false, errorText: 'нужен адрес https://rutube.ru/api/…' });
        return;
    }
    var reply = function (err, body) {
        if (err) message.respond({ returnValue: false, errorText: err.text, status: err.status || 0 });
        else message.respond({ returnValue: true, data: body });
    };
    rutubeGet(u, null, function (err, body) {
        if (err && err.cert && LE_ROOTS) { rutubeGet(u, LE_ROOTS, reply); return; }
        reply(err, body);
    });
});
