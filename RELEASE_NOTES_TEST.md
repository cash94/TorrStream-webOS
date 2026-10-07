Тестовая сборка 1.0.5.

- На webOS с Chrome 94 и новее (webOS 23 и новее) общий сервер torrstream.online открывается по https. Страница по http из интернета в Chrome 120 не может обращаться к самому телевизору (Private Network Access), поэтому встроенный TorrServer на localhost был недоступен. Если https не отвечает, приложение откроется по http, как раньше. Свой адрес сервера не меняется.
- В appinfo.json добавлен splashBackground — чёрный фон заставки при запуске.

Ссылка releases/latest/download по-прежнему ведёт на 1.0.4: это pre-release.
