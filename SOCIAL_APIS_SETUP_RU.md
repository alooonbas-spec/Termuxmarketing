# Подключение API социальных сетей

Инструкция предназначена для Social Contact Collector `0.6.1`.

Программа автоматически отправляет сообщения только через официальные API и только пользователям, которые разрешили контакт или уже начали допустимый диалог. Не публикуйте токены и не добавляйте файл `.env` в Git.

## Поддержка платформ

| Платформа | Кабинет разработчика | Режим в приложении |
| --- | --- | --- |
| VK | [VK Developers](https://dev.vk.com/ru) | Автоматически при наличии разрешения |
| Telegram | [BotFather](https://t.me/BotFather) | Автоматически после начала диалога пользователем |
| Instagram | [Meta Developers](https://developers.facebook.com/apps/) | Автоматически в пределах правил Meta |
| Facebook | [Meta Developers](https://developers.facebook.com/apps/) | Автоматически в пределах правил Meta |
| X | [X Developer Console](https://console.x.com/) | Импорт; сообщения — ручная проверка без DM API |
| LinkedIn | [LinkedIn Developers](https://www.linkedin.com/developers/apps) | Разрешённый импорт; ручная проверка |
| Дзен | Общедоступного messaging API нет | Разрешённый импорт; ручная проверка |
| Pinterest | [Pinterest Developers](https://developers.pinterest.com/apps/) | Импорт; личная рассылка не поддерживается |
| Reddit | [Reddit Developers](https://developers.reddit.com/) | Devvit/разрешённое приложение; ручная проверка |
| Quora | Общедоступного messaging API нет | Разрешённый импорт; ручная проверка |

## 1. Telegram

### Создание бота

1. Откройте [@BotFather](https://t.me/BotFather).
2. Отправьте `/newbot`.
3. Введите название и username, заканчивающийся на `bot`.
4. Скопируйте полученный Bot API Token.

Документация: [Telegram Bot API](https://core.telegram.org/bots/api), [Bot FAQ](https://core.telegram.org/bots/faq).

### Настройки `.env`

```dotenv
TELEGRAM_BOT_TOKEN=1234567890:AAExampleToken
TELEGRAM_WEBHOOK_SECRET=длинный_случайный_секрет
```

### Установка webhook

```powershell
$Token = "ТОКЕН_БОТА"
$Secret = "СЕКРЕТ_ИЗ_ENV"
$Webhook = "https://ВАШ-ДОМЕН/webhooks/telegram"

Invoke-RestMethod `
  -Method Post `
  -Uri "https://api.telegram.org/bot$Token/setWebhook" `
  -ContentType "application/json" `
  -Body (@{
    url = $Webhook
    secret_token = $Secret
    allowed_updates = @("message")
  } | ConvertTo-Json)
```

Проверка:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$Token/getWebhookInfo"
```

Бот не может первым написать произвольному пользователю: пользователь должен предварительно запустить бота.

## 2. VK

1. Создайте или выберите сообщество VK.
2. Откройте `Управление → Работа с API`.
3. В разделе `Ключи доступа` создайте токен сообщества.
4. Разрешите работу с сообщениями сообщества.
5. В `Callback API` добавьте сервер:

```text
https://ВАШ-ДОМЕН/webhooks/vk
```

6. Скопируйте секретный ключ и строку подтверждения.

### Настройки `.env`

```dotenv
VK_ACCESS_TOKEN=токен_сообщества
VK_CALLBACK_SECRET=секрет_Callback_API
VK_CONFIRMATION_CODE=строка_подтверждения
VK_API_VERSION=5.199
```

Сообщество может отправлять сообщения только пользователям, которые разрешили их получение или уже начали диалог.

## 3. Instagram

Нужен профессиональный аккаунт `Business` или `Creator`.

1. Откройте [Meta for Developers](https://developers.facebook.com/apps/).
2. Создайте приложение.
3. Добавьте продукт Instagram.
4. Откройте `Instagram → API setup with Instagram login`.
5. Подключите профессиональный аккаунт.
6. Настройте OAuth и создайте access token.
7. Добавьте webhook:

```text
https://ВАШ-ДОМЕН/webhooks/meta
```

Документация: [Instagram API](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started), [Instagram Messaging](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/get-started).

Обычно требуются разрешения базового доступа к профессиональному аккаунту и управления сообщениями. Точный набор зависит от выбранного продукта Meta и проверки приложения.

## 4. Facebook

1. Откройте [Meta for Developers](https://developers.facebook.com/apps/).
2. Создайте Business-приложение.
3. Добавьте продукт Messenger.
4. Свяжите приложение со страницей Facebook.
5. В `Messenger → API Setup` создайте Page Access Token.
6. Добавьте webhook:

```text
https://ВАШ-ДОМЕН/webhooks/meta
```

7. Подпишите страницу на события `messages`, `messaging_postbacks`, `message_deliveries` и `message_reads`.

Документация: [Messenger Platform](https://developers.facebook.com/documentation/business-messaging/messenger-platform/overview), [Messenger Get Started](https://developers.facebook.com/documentation/business-messaging/messenger-platform/get-started).

### Общие настройки Meta

```dotenv
META_VERIFY_TOKEN=секрет_проверки_webhook
META_APP_SECRET=App_Secret
META_PAGE_ACCESS_TOKEN=Page_Access_Token
META_GRAPH_VERSION=v23.0
```

Instagram и Facebook используют общий endpoint `/webhooks/meta`, но доступность отправки определяется токеном, permissions и правилами окна общения Meta.

## 5. X

1. Откройте [X Developer Console](https://console.x.com/).
2. Зарегистрируйте developer account.
3. Создайте приложение.
4. Откройте `Keys and tokens`.
5. Сохраните API Key, API Key Secret, Bearer Token, Client ID и Client Secret.
6. Для действий от имени пользователя настройте OAuth 2.0.

Документация: [получение доступа](https://docs.x.com/x-api/getting-started/getting-access), [приложения и разрешения](https://docs.x.com/fundamentals/developer-apps).

Bearer Token предназначен преимущественно для чтения публичных данных. Для Direct Messages требуется пользовательская авторизация и доступ уровня `Read, write and DMs`. В текущем приложении X используется через защищённый импорт, а исходящие сообщения переходят в `manual_review`.

## 6. LinkedIn

1. Откройте [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps).
2. Создайте приложение и привяжите страницу компании.
3. В разделе `Auth` скопируйте Client ID и Client Secret.
4. Добавьте Authorized Redirect URL.
5. В `Products` запросите необходимые продукты.
6. Проведите OAuth 2.0 авторизацию.

Документация: [Getting Access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access), [Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow).

Расширенные разрешения LinkedIn требуют отдельного одобрения. Обычное приложение не получает свободный доступ к чужим профилям и массовым личным сообщениям. В Social Contact Collector используется разрешённый импорт и `manual_review`.

## 7. Дзен

У Дзена нет общедоступного API для массовой выгрузки пользователей, получения закрытых контактов или автоматической личной рассылки.

В приложении используются:

- разрешённые выгрузки;
- самостоятельно предоставленные контакты;
- ссылки на публичные публикации;
- ручная проверка исходящих сообщений.

Отдельные токены Дзена в `.env` не предусмотрены.

## 8. Pinterest

1. Откройте [Pinterest Developers](https://developers.pinterest.com/).
2. Перейдите в `My Apps` и создайте приложение.
3. Запросите Trial Access.
4. В `Configure` создайте тестовый token.
5. Для production настройте OAuth 2.0 и refresh token.

Документация: [OAuth Pinterest](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/), [подключение приложения](https://developers.pinterest.com/docs/getting-started/connect-app/).

Pinterest API предназначен для пинов, досок, каталогов, рекламы и аналитики, а не массовых личных сообщений. В программе исходящие сообщения переводятся в `manual_review`.

## 9. Reddit

### Рекомендуемый вариант Devvit

1. Откройте [Reddit for Developers](https://developers.reddit.com/).
2. Создайте Devvit-приложение.
3. Установите Node.js 22.2 или новее.
4. Создайте проект и выполните вход:

```powershell
npx create-devvit@latest
npx devvit login
```

5. Включите Reddit permission:

```json
{
  "permissions": {
    "reddit": true
  }
}
```

Документация: [Reddit API Overview](https://developers.reddit.com/docs/capabilities/server/reddit-api), [Devvit FAQ](https://developers.reddit.com/docs/guides/faq).

Devvit управляет аутентификацией внутри Reddit. Для самостоятельного внешнего сервиса применяется другой Data API flow и может потребоваться отдельное одобрение.

## 10. Quora

У основной платформы Quora нет общедоступного универсального API для массового чтения профилей, получения контактов и отправки личных сообщений.

Poe API принадлежит Quora, но предназначен для работы с ИИ-моделями и не предоставляет контакты или переписку пользователей Quora.

В приложении Quora работает через разрешённый импорт и `manual_review`. Отдельного токена Quora в `.env` нет.

## Итоговый блок `.env`

```dotenv
# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

# VK
VK_ACCESS_TOKEN=
VK_CALLBACK_SECRET=
VK_CONFIRMATION_CODE=
VK_API_VERSION=5.199

# Instagram и Facebook
META_VERIFY_TOKEN=
META_APP_SECRET=
META_PAGE_ACCESS_TOKEN=
META_GRAPH_VERSION=v23.0
```

После изменения `.env` пересоздайте API-контейнер:

```powershell
docker compose up -d --force-recreate api
```

Посмотреть логи:

```powershell
docker compose logs -f api
```

## Требования безопасности

- не публикуйте `.env`;
- храните токены в менеджере секретов;
- не передавайте токены в URL, сообщениях или скриншотах;
- используйте только HTTPS;
- при утечке немедленно отзывайте и перевыпускайте токен;
- не используйте cookies, пароли и неофициальные токены браузерной сессии;
- соблюдайте лимиты, правила рассылок и требования платформ;
- отправляйте сообщения только при законном основании и наличии допустимого контакта.
