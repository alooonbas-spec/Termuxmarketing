# Social Contact Collector 0.6.1 на Android

Краткая инструкция «как включить программу» (установка, запуск, ключ, проверка): `START_RU.md`.

Эта версия запускается на телефоне через Termux и открывается в браузере как локальная web-панель. Исходный код можно смотреть и изменять в Acode.

На телефоне не нужны Docker Desktop и PostgreSQL. Данные сохраняются в локальном JSON-файле внутри защищённой папки Termux.

## Что работает на телефоне

- панель лидов `http://127.0.0.1:8080/dashboard`;
- импорт разрешённых данных и событий;
- статистика и CSV-выгрузка;
- шаблоны сообщений и кампании;
- очередь сообщений;
- несколько собственных VK-аккаунтов;
- создание черновика комментария VK;
- отдельное ручное подтверждение публикации;
- дневные лимиты, защита от дублей и журнал комментариев;
- локальная база и резервные копии;
- редактирование исходников через Acode.
- публичный HTTPS-туннель для входящих webhook;
- тестовый и постоянный режим Cloudflare Tunnel;
- автоматическая регистрация Telegram webhook;
- автозапуск приложения и постоянного туннеля через Termux:Boot.

## Важное различие

Исходники лежат в общей папке телефона, которую открывает Acode. Рабочая копия, токены и база находятся внутри Termux. Благодаря этому Acode не получает доступ к вашим секретным токенам.

```text
Downloads/social-contact-collector     Acode редактирует исходники
               ↓ sync-termux.sh
~/apps/social-contact-collector         Termux запускает рабочую копию
~/.config/social-contact-collector      секретный .env
~/.config/social-contact-collector/cloudflare-tunnel.token
                                        защищённый токен постоянного туннеля
~/.local/share/social-contact-collector локальная база
```

## 1. Установить приложения

Установите:

1. Termux из официального источника Termux: F-Droid или официальный репозиторий проекта.
2. Acode из официального магазина или с сайта Acode.

Не используйте случайные APK-сайты.

Официальные страницы:

- Termux: <https://github.com/termux/termux-app>
- Acode: <https://acode.app/>
- документация Acode: <https://docs.acode.app/user-guide/file-browser>

## 2. Скачать и распаковать архив

Скачайте архив телефонной версии и распакуйте папку в `Download`.

Ожидаемый путь:

```text
/storage/emulated/0/Download/social-contact-collector
```

Если вы выбрали другое имя папки, используйте его в командах ниже.

## 3. Разрешить Termux доступ к Downloads

Откройте Termux и выполните:

```bash
termux-setup-storage
```

Android покажет запрос доступа к файлам. Разрешите его.

После этого проверьте папку:

```bash
ls ~/storage/downloads
```

## 4. Установить программу

Перейдите в распакованную папку:

```bash
cd ~/storage/downloads/social-contact-collector
```

Запустите установку:

```bash
bash termux/install-termux.sh
```

Скрипт:

- установит Node.js 22 или новее;
- создаст защищённую рабочую папку;
- установит зависимости;
- соберёт TypeScript;
- создаст локальную базу;
- автоматически сгенерирует `ADMIN_API_KEY`.
- автоматически сгенерирует секреты webhook Telegram, VK и проверочный токен Meta.

В конце установки Termux покажет ключ примерно такого вида:

```text
ADMIN_API_KEY: 4a7f...длинная_строка...91bc
```

Сохраните его. Повторно показать ключ можно командой:

```bash
bash termux/show-key-termux.sh
```

## 5. Запустить программу

Находясь в папке проекта, выполните:

```bash
bash termux/start-termux.sh
```

Откройте панель командой:

```bash
bash termux/open-termux.sh
```

Или вручную откройте в Chrome:

```text
http://127.0.0.1:8080/dashboard
```

В шапке панели сразу видно окно для ключа и рядом кнопку `API-ключ`. Вставьте `ADMIN_API_KEY` и нажмите кнопку.

Ключ сохранится только в локальном хранилище браузера на этом телефоне.

## 6. Подключить VK-аккаунт для комментариев

Откройте защищённые настройки:

```bash
bash termux/settings-termux.sh
```

Найдите строку:

```dotenv
VK_COMMENT_ACCOUNTS_JSON=[]
```

Для одного аккаунта замените её на одну строку:

```dotenv
VK_COMMENT_ACCOUNTS_JSON=[{"id":"main","label":"Основной VK","token":"ВАШ_ТОКЕН_VK","dailyLimit":10}]
```

Для двух аккаунтов:

```dotenv
VK_COMMENT_ACCOUNTS_JSON=[{"id":"main","label":"Основной VK","token":"ТОКЕН_1","dailyLimit":10},{"id":"second","label":"Второй VK","token":"ТОКЕН_2","dailyLimit":5}]
```

В редакторе nano:

- сохранить: `Ctrl + O`, затем `Enter`;
- выйти: `Ctrl + X`.

Примените настройки:

```bash
bash termux/stop-termux.sh
bash termux/start-termux.sh
```

Токен должен быть получен официальным OAuth-способом и иметь нужные права. Никому не отправляйте токен и не вставляйте его в чат.

## 7. Опубликовать комментарий VK

1. Откройте `http://127.0.0.1:8080/dashboard`.
2. Найдите блок `Новый комментарий VK`.
3. Выберите свой подключённый аккаунт.
4. Вставьте ссылку вида:

```text
https://vk.com/wall-123456_789
```

5. Введите текст.
6. Нажмите `Создать черновик`.
7. Проверьте аккаунт, ссылку и текст в журнале.
8. Нажмите `Подтвердить и опубликовать`.
9. Подтвердите действие в системном окне браузера.

Программа не публикует комментарий сразу после ввода текста. Для каждой публикации требуется отдельное ручное подтверждение.

## 8. Открыть проект в Acode

1. Откройте Acode.
2. Откройте файловое меню.
3. Нажмите `Open folder` или `Add path`.
4. Выберите:

```text
Download/social-contact-collector
```

5. Нажмите `Open`.

Основные файлы:

```text
src/                         исходный TypeScript-код
src/dashboard/assets.ts     интерфейс панели
src/comments/               модуль комментариев
src/connectors/             коннекторы социальных сетей
termux/                     команды для телефона
.env.termux.example         шаблон настроек, без реальных токенов
TERMUX_ACODE_GUIDE_RU.md    эта инструкция
```

Реальный файл с токенами специально не находится в открываемой Acode папке.

## 9. Применить изменения из Acode

После редактирования и сохранения файлов в Acode откройте Termux, перейдите в проект и выполните:

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/sync-termux.sh
```

Команда:

- остановит приложение, если оно работало;
- скопирует изменения в защищённую папку Termux;
- проверит TypeScript;
- пересоберёт программу;
- снова запустит её, если она была запущена.

Если в коде есть ошибка, сборка остановится и покажет имя файла и номер строки. Исправьте файл в Acode и повторите команду.

## 10. Управление программой

Запуск:

```bash
bash termux/start-termux.sh
```

Остановка:

```bash
bash termux/stop-termux.sh
```

Статус:

```bash
bash termux/status-termux.sh
```

Открыть панель:

```bash
bash termux/open-termux.sh
```

Показать журнал ошибок:

```bash
bash termux/logs-termux.sh
```

Выйти из просмотра журнала:

```text
Ctrl + C
```

Открыть настройки:

```bash
bash termux/settings-termux.sh
```

Показать API-ключ:

```bash
bash termux/show-key-termux.sh
```

## 11. Создать резервную копию

Выполните:

```bash
bash termux/backup-termux.sh
```

Копия появится здесь:

```text
Download/SocialContactCollector-Backups/collector-ДАТА-ВРЕМЯ.json
```

Файл резервной копии содержит собранные данные. Не публикуйте его и не отправляйте посторонним.

## 12. Подключить публичный HTTPS для webhook

Приложение уже содержит маршруты:

```text
/webhooks/telegram
/webhooks/vk
/webhooks/meta
```

Cloudflare Tunnel передаёт запросы с публичного HTTPS-адреса на локальный адрес `http://127.0.0.1:8080`. Открывать порты роутера, получать белый IP или отключать Android firewall не нужно.

Установите компонент туннеля:

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/install-tunnel-termux.sh
```

Официальная документация:

- Cloudflare Quick Tunnels: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/>
- создание постоянного туннеля: <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/>

### Вариант A: быстрый тест без домена

Этот вариант подходит для первой проверки. Аккаунт Cloudflare и собственный домен не требуются, но адрес `*.trycloudflare.com` меняется после каждого нового запуска.

Настройте режим:

```bash
bash termux/configure-tunnel-termux.sh
```

Выберите:

```text
1 — быстрый тестовый адрес
```

Запустите:

```bash
bash termux/start-tunnel-termux.sh
```

Termux покажет три готовых URL. Повторно вывести их можно командой:

```bash
bash termux/show-webhook-urls-termux.sh
```

После каждого изменения тестового адреса снова выполните:

```bash
bash termux/configure-webhooks-termux.sh
```

Скрипт автоматически обновит адрес Telegram. В VK и Meta новый URL потребуется заменить вручную. Поэтому тестовый режим не подходит для постоянной работы.

### Вариант B: постоянный адрес на своём домене

Для webhook рекомендуется постоянный адрес, например:

```text
https://hooks.example.com
```

Понадобятся бесплатный аккаунт Cloudflare и домен, DNS которого подключён к Cloudflare.

1. Откройте Cloudflare Dashboard.
2. Перейдите `Networking → Tunnels`.
3. Нажмите `Create a tunnel`.
4. Назовите его `social-contact-collector`.
5. Выберите Linux и найдите показанную команду с длинным токеном `eyJ…`.
6. Скопируйте только токен. Не запускайте на Android команду `sudo cloudflared service install`.
7. В Termux выполните:

```bash
bash termux/configure-tunnel-termux.sh
```

8. Выберите режим `2`.
9. Введите постоянный адрес `https://hooks.example.com`.
10. Вставьте токен Cloudflare. Ввод скрыт, токен сохранится в защищённом каталоге Termux.
11. Запустите туннель:

```bash
bash termux/start-tunnel-termux.sh
```

12. Вернитесь в Cloudflare. Дождитесь состояния `Healthy` и нажмите `Continue`.
13. Откройте вкладку `Routes` и выберите `Add route → Published application`.
14. Укажите поддомен `hooks`, выберите свой домен.
15. В `Service URL` укажите:

```text
http://127.0.0.1:8080
```

16. Сохраните маршрут.
17. Проверьте:

```bash
bash termux/status-tunnel-termux.sh
```

Ожидаемый результат содержит:

```text
Статус туннеля: работает
Внешняя проверка: {"status":"ok","version":"0.6.1","storage":"json"}
```

Cloudflare Dashboard автоматически создаёт DNS-маршрут к туннелю. Токен туннеля даёт право запускать его, поэтому не отправляйте токен посторонним и не помещайте его в Acode, Git или Downloads.

## 13. Подключить webhook Telegram, VK и Meta

Сначала откройте настройки и заполните используемые платформы:

```bash
bash termux/settings-termux.sh
```

Минимальный блок выглядит так:

```dotenv
TELEGRAM_BOT_TOKEN=токен_вашего_бота
TELEGRAM_WEBHOOK_SECRET=автоматически_созданный_секрет

VK_CALLBACK_SECRET=автоматически_созданный_секрет
VK_CONFIRMATION_CODE=

META_VERIFY_TOKEN=автоматически_созданный_токен
META_APP_SECRET=App_Secret_из_Meta
```

Секреты Telegram, VK и Verify Token Meta создаются установщиком автоматически. Не заменяйте их короткими словами.

Запустите мастер:

```bash
bash termux/configure-webhooks-termux.sh
```

Он:

- проверит публичный HTTPS-адрес;
- создаст отсутствующие секреты;
- перезапустит приложение после изменения секретов;
- зарегистрирует Telegram webhook, если заполнен `TELEGRAM_BOT_TOKEN`;
- покажет URL и секрет для VK;
- покажет Callback URL и Verify Token для Meta.

### Telegram

После выполнения мастера проверьте регистрацию:

```bash
export BOT_TOKEN='ВАШ_TELEGRAM_BOT_TOKEN'
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
unset BOT_TOKEN
```

В ответе поле `url` должно заканчиваться на:

```text
/webhooks/telegram
```

Telegram передаёт созданный секрет в заголовке, а приложение отклоняет запросы с неправильным секретом.

### VK

1. Выполните `bash termux/configure-webhooks-termux.sh` и скопируйте показанные `Адрес сервера` и `Секретный ключ`.
2. Откройте сообщество VK.
3. Перейдите `Управление → Работа с API → Callback API`.
4. Создайте сервер.
5. Вставьте адрес вида `https://hooks.example.com/webhooks/vk`.
6. Вставьте секретный ключ из Termux.
7. Скопируйте показанный VK код подтверждения.
8. Откройте настройки:

```bash
bash termux/settings-termux.sh
```

9. Запишите код одной строкой:

```dotenv
VK_CONFIRMATION_CODE=код_из_VK
```

10. Перезапустите приложение:

```bash
bash termux/stop-termux.sh
bash termux/start-termux.sh
```

11. Вернитесь в VK и нажмите подтверждение сервера.
12. В типах событий включите как минимум `Входящее сообщение`, `Разрешение на получение сообщений` и `Запрет на получение сообщений`.

### Meta: Instagram и Facebook

1. Получите `App Secret` своего приложения в Meta for Developers.
2. Запишите его в защищённые настройки:

```dotenv
META_APP_SECRET=ваш_App_Secret
```

3. Перезапустите приложение.
4. Выполните `bash termux/configure-webhooks-termux.sh`.
5. В Meta Webhooks вставьте показанный адрес `https://hooks.example.com/webhooks/meta`.
6. В поле Verify Token вставьте значение, показанное мастером.
7. Подтвердите callback.
8. Подпишите приложение только на необходимые события Instagram/Facebook.

Входящие POST-запросы Meta проверяются по подписи `X-Hub-Signature-256`. Пока `META_APP_SECRET` не заполнен, маршрут возвращает `503` и не принимает события.

## 14. Автозапуск после перезагрузки телефона

Автозапуск включается только для постоянного туннеля, потому что тестовый адрес меняется.

1. Установите приложение Termux:Boot из того же источника, что и Termux.
2. Один раз откройте значок Termux:Boot после установки.
3. В Android отключите жёсткую оптимизацию батареи для Termux и Termux:Boot.
4. Выполните:

```bash
bash termux/enable-autostart-termux.sh
```

При следующей загрузке телефона скрипт применит wake lock, подождёт запуска Android, затем поднимет приложение и туннель.

Проверить после перезагрузки:

```bash
bash termux/status-termux.sh
bash termux/status-tunnel-termux.sh
```

Отключить автозапуск:

```bash
bash termux/disable-autostart-termux.sh
```

Официальная инструкция Termux:Boot: <https://github.com/termux/termux-boot>

## 15. Управление туннелем

Запуск:

```bash
bash termux/start-tunnel-termux.sh
```

Остановка:

```bash
bash termux/stop-tunnel-termux.sh
```

Статус и внешняя проверка:

```bash
bash termux/status-tunnel-termux.sh
```

Показать URL:

```bash
bash termux/show-webhook-urls-termux.sh
```

Журнал Cloudflare Tunnel:

```bash
bash termux/logs-tunnel-termux.sh
```

Выход из просмотра журнала:

```text
Ctrl + C
```

## 16. Ограничения и безопасность телефонного режима

- Панель управления открывайте локально: `http://127.0.0.1:8080/dashboard`.
- Через домен туннеля версия 0.6.1 разрешает только `/health` и `/webhooks/*`; панель и административные API возвращают `404`.
- Все административные API дополнительно защищены `ADMIN_API_KEY`.
- Webhook без настроенного секрета возвращает `503`, с неправильным секретом или подписью — `401`.
- Не ставьте интерактивную Cloudflare Access-авторизацию перед webhook: Telegram, VK и Meta не смогут пройти страницу входа. Защиту обеспечивают их секреты и подписи.
- Исходящие API-запросы и VK-комментарии продолжают работать через интернет телефона независимо от туннеля.
- Android может остановить Termux для экономии батареи. Для длительной работы отключите жёсткую оптимизацию батареи и используйте Termux:Boot.
- После обновления кода через Acode выполните `sync-termux.sh`, затем перезапустите туннель.
- Полностью автоматическая публикация комментариев без ручного подтверждения не предусмотрена.
- Телефон остаётся менее надёжным сервером, чем VPS: при разряде, перезагрузке, потере сети или выгрузке Termux webhook временно перестанут поступать.

## 17. Диагностика

### `Permission denied` при открытии Downloads

Повторите:

```bash
termux-setup-storage
```

И проверьте разрешение Termux в настройках Android.

### `No such file or directory`

Проверьте фактическое имя папки:

```bash
ls ~/storage/downloads
```

Затем используйте найденное имя в команде `cd`.

### `Node.js 22 or newer is required`

Выполните:

```bash
pkg update
pkg upgrade
```

После обновления повторите установку.

### Панель не открывается

Проверьте статус:

```bash
bash termux/status-termux.sh
```

Посмотрите журнал:

```bash
bash termux/logs-termux.sh
```

### `cloudflared: command not found`

Выполните:

```bash
bash termux/install-tunnel-termux.sh
```

### Туннель запущен, но внешняя проверка не проходит

Проверьте журнал:

```bash
bash termux/logs-tunnel-termux.sh
```

Для постоянного режима проверьте в Cloudflare:

- состояние туннеля `Healthy`;
- наличие `Published application`;
- точный публичный hostname;
- Service URL `http://127.0.0.1:8080`;
- соответствие `PUBLIC_BASE_URL` этому hostname.

### `token-file` не поддерживается

Параметр требует `cloudflared 2025.4.0` или новее. Обновите пакет:

```bash
pkg update
pkg upgrade cloudflared
cloudflared --version
```

### Webhook возвращает `503`

Это означает, что обязательный секрет не заполнен:

- Telegram: `TELEGRAM_WEBHOOK_SECRET`;
- VK: `VK_CALLBACK_SECRET`, а для подтверждения ещё `VK_CONFIRMATION_CODE`;
- Meta POST: `META_APP_SECRET`;
- Meta verification: `META_VERIFY_TOKEN`.

Откройте настройки, заполните значение и перезапустите приложение.

### Webhook возвращает `401`

Провайдер прислал неправильный секрет или подпись. Проверьте, что значение в кабинете платформы совпадает с защищённым `.env` Termux. Не отключайте проверку секрета.

### `VK: Access denied`

Возможные причины:

- токен истёк или отозван;
- у токена нет права на публикацию;
- запись закрыта для комментариев;
- аккаунт ограничен VK;
- владелец записи запретил действие.

### `Нет настроенных аккаунтов`

Проверьте, что `VK_COMMENT_ACCOUNTS_JSON` записан одной строкой, JSON содержит двойные кавычки и после изменения приложение перезапущено.

### Порт 8080 занят

Откройте настройки:

```bash
bash termux/settings-termux.sh
```

Измените:

```dotenv
PORT=8081
```

После перезапуска панель будет доступна по адресу:

```text
http://127.0.0.1:8081/dashboard
```

В Cloudflare также измените Service URL на:

```text
http://127.0.0.1:8081
```

## Безопасность и правила платформ

- Используйте только свои аккаунты и официально полученные токены.
- Не храните реальные токены в `.env.termux.example` или исходниках Acode.
- Не загружайте папку `~/.config/social-contact-collector` в облако.
- Не публикуйте файл `cloudflare-tunnel.token` и длинный токен `eyJ…`.
- Проверяйте каждый комментарий перед публикацией.
- Не публикуйте одинаковые или нерелевантные комментарии массово.
- Соблюдайте правила VK и применимое законодательство о персональных данных и рекламе.
