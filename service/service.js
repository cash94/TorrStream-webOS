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
 * ES5: на старых webOS Node.js 0.10–0.12.
 */
var Service = require('webos-service');
var execFile = require('child_process').execFile;
var dns = require('dns');
var url = require('url');
var path = require('path');

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
