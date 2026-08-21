# Как включить программу

Эта инструкция только про запуск Social Contact Collector: установка, включение, вход в панель и проверка, что всё работает.

- Телефон (Termux) — основной способ.
- Компьютер (Windows + Docker) — в конце файла.

Подробности про Acode, комментарии VK, туннель и токены сетей: `TERMUX_ACODE_GUIDE_RU.md`, `USER_GUIDE_RU.md`, `SOCIAL_APIS_SETUP_RU.md`.

---

## Что считается «включённой» программой

Программа включена, когда одновременно верно три пункта:

1. В Termux процесс запущен (`bash termux/status-termux.sh` пишет «работает»).
2. Адрес `http://127.0.0.1:8080/health` отвечает `{"status":"ok",...}`.
3. В браузере открывается `http://127.0.0.1:8080/dashboard`, в шапке видно поле **API-ключ**, вы вставляете ключ, жмёте **Сохранить** и видите панель (цифры могут быть нулями — это нормально).

Пока ключ не введён, панель пустая. Это не поломка: без `ADMIN_API_KEY` API закрыт.

Входящие webhook из Telegram/VK/Meta — отдельный шаг (туннель). Для просмотра панели туннель не нужен.

---

## A. Телефон: первый запуск

### 1. Установить Termux

Ставьте Termux **только** с F-Droid или с официального GitHub проекта:

- https://f-droid.org/packages/com.termux/
- https://github.com/termux/termux-app

Версия из Google Play не подходит.

Откройте Termux один раз и дождитесь появления приглашения командной строки.

### 2. Дать доступ к папке Download

```bash
termux-setup-storage
```

Разрешите доступ к файлам, если Android спросит. Проверка:

```bash
ls ~/storage/downloads
```

### 3. Положить проект в Download

Нужна папка:

```text
/storage/emulated/0/Download/social-contact-collector
```

В Termux это:

```text
~/storage/downloads/social-contact-collector
```

**Вариант 1 — уже есть ZIP.** Распакуйте архив в `Download` так, чтобы внутри лежали `termux/`, `src/`, `package.json`.

**Вариант 2 — клонировать с GitHub:**

```bash
pkg update -y
pkg install -y git
cd ~/storage/downloads
git clone https://github.com/alooonbas-spec/Termuxmarketing.git social-contact-collector
cd social-contact-collector
```

Если панель раньше открывалась, но кнопка **API-ключ** ничего не делала, нужна версия с исправлением дашборда (ветка `cursor/fix-dashboard-system-f140` или уже влитый `main` после слияния). Затем:

```bash
cd ~/storage/downloads/social-contact-collector
git fetch origin
git checkout cursor/fix-dashboard-system-f140
```

### 4. Установить программу

Это делается **один раз** (или после большого обновления кода).

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/install-termux.sh
```

Скрипт поставит Node.js 22+, скопирует программу во внутреннюю папку Termux, соберёт её и создаст секретный `.env`.

В конце будет строка:

```text
ADMIN_API_KEY: ................................
```

Сохраните этот ключ. Повторно показать:

```bash
bash termux/show-key-termux.sh
```

Установка может занять несколько минут. Не закрывайте Termux, пока она не напишет «Установка завершена».

### 5. Включить программу

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/start-termux.sh
```

Ожидаемый ответ:

```text
Social Contact Collector запущен. PID: ...
Панель: http://127.0.0.1:8080/dashboard
```

Если уже запущена, скрипт так и напишет и ничего не сломает.

### 6. Открыть панель

```bash
bash termux/open-termux.sh
```

Или вручную в Chrome / Firefox:

```text
http://127.0.0.1:8080/dashboard
```

Важно:

- открывайте именно `http://127.0.0.1:8080`, не `https://` и не публичный туннель;
- панель работает, только пока Termux не выгружен и программа не остановлена.

### 7. Ввести API-ключ

1. Справа вверху сразу видно поле **API-ключ** — всплывающее окно больше не нужно.
2. В Termux выполните `bash termux/show-key-termux.sh` и скопируйте значение после `ADMIN_API_KEY=`.
3. Вставьте ключ в поле и нажмите **Сохранить**.

Ключ запоминается в браузере этого телефона. После этого панель показывает статистику (сначала нули) и таблицу лидов.

Если поля ключа нет или страница старая — обновите код, затем:

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/sync-termux.sh
```

Закройте вкладку браузера полностью и откройте панель заново.

---

## B. Телефон: каждый следующий раз

Программа после перезагрузки телефона сама не включается. Каждый раз:

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/start-termux.sh
bash termux/open-termux.sh
```

Если ключ уже сохраняли в этом браузере, окно можно закрыть или просто проверить, что панель загрузилась.

Остановить:

```bash
bash termux/stop-termux.sh
```

Проверить, включена ли:

```bash
bash termux/status-termux.sh
```

Смотреть журнал, если не стартует:

```bash
bash termux/logs-termux.sh
```

Выход из журнала: `Ctrl + C`.

---

## C. Если не включается

| Что видите | Что сделать |
|---|---|
| `эту команду нужно запускать в приложении Termux` | Команды вводите в Termux, не в другом терминале |
| `Приложение ещё не установлено` | Сначала `bash termux/install-termux.sh` |
| `требуется Node.js 22` | `pkg update -y && pkg upgrade -y`, затем снова установка |
| `Программа не смогла запуститься` | `bash termux/logs-termux.sh` — в конце лога будет причина |
| Страница не открывается | Проверьте статус; не используйте https; порт по умолчанию 8080 |
| `Укажите правильный API-ключ` | Ключ из `show-key-termux.sh`, без пробелов, тот же что в `.env` |
| Нет поля API-ключа в шапке | Старая версия страницы. Обновите код, `bash termux/sync-termux.sh`, закройте вкладку |
| Termux «убивается» в фоне | Настройках Android: без ограничений батареи для Termux, не закрывать свайпом |

Полезные адреса:

- здоровье: `http://127.0.0.1:8080/health`
- панель: `http://127.0.0.1:8080/dashboard`

Секреты лежат не в Download, а внутри Termux:

```text
~/.config/social-contact-collector/.env
```

Править их удобнее так:

```bash
bash termux/settings-termux.sh
```

После правки `.env` обязательно:

```bash
bash termux/stop-termux.sh
bash termux/start-termux.sh
```

---

## D. По желанию: входящие webhook

Панель уже работает локально. Туннель нужен только чтобы Telegram, VK и Meta могли **присылать события на телефон**.

```bash
cd ~/storage/downloads/social-contact-collector
bash termux/install-tunnel-termux.sh
bash termux/configure-tunnel-termux.sh
bash termux/start-tunnel-termux.sh
bash termux/configure-webhooks-termux.sh
```

Публичный адрес пропускает только `/health` и `/webhooks/*`. Панель и ключ через него не открываются — это сделано специально.

Автозапуск туннеля после перезагрузки телефона: постоянный режим Cloudflare + Termux:Boot, см. `TERMUX_ACODE_GUIDE_RU.md`.

---

## E. Компьютер: Windows и Docker

1. Установите Docker Desktop и дождитесь, пока он запустится.
2. Откройте PowerShell в папке проекта.

```powershell
Copy-Item ".env.example" ".env"
$ApiKey = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
(Get-Content ".env") -replace '^ADMIN_API_KEY=.*$', "ADMIN_API_KEY=$ApiKey" | Set-Content ".env" -Encoding utf8
$ApiKey
docker compose up --build -d
```

3. Проверьте `http://localhost:8080/health`.
4. Откройте `http://localhost:8080/dashboard` и вставьте тот же `ADMIN_API_KEY`.

Остановка: `docker compose down`. Подробности: `USER_GUIDE_RU.md`.
