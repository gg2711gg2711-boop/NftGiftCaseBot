# Пошаговый деплой NftGiftCase для новичка

Самый прямой бесплатный маршрут **без банковской карты** для реального API: Cloudflare Workers + D1 для backend и Cloudflare Pages для frontend. Для статического макета есть GitHub Pages demo, но не используйте его как хостинг монетизируемого приложения: GitHub прямо пишет, что Pages не предназначен для сайтов, в основном облегчающих коммерческие транзакции/SaaS. См. официальные ссылки внизу.

> Бесплатные тарифы и лимиты могут меняться. Cloudflare сейчас указывает бесплатный уровень Workers и D1; проверьте актуальные квоты в панели до публикации. Никакой сервис не может гарантировать бесплатность при любом трафике/объёме.

## Часть A — подготовить компьютер и Telegram-бота

1. Установите Node.js LTS: https://nodejs.org/ и Git: https://git-scm.com/downloads. Перезапустите терминал и проверьте:
   ```bash
   node --version
   npm --version
   git --version
   ```
2. Создайте бота через [@BotFather](https://t.me/BotFather): отправьте `/newbot`, задайте имя и username. Скопируйте токен. **Не отправляйте его никому и никогда не вставляйте в frontend или репозиторий.**
3. Создайте публичный Telegram-канал с username `@NftGiftCaseNews` (или поменяйте `SUBSCRIPTION_CHANNEL` в `wrangler.jsonc`). Добавьте бота администратором канала, чтобы `getChatMember` мог надёжно проверять подписку.
4. Запустите бота в личном чате, отправьте `/start`. Это позволит ему в дальнейшем писать админу уведомления о выводе. Админский ID в проекте — `1080484217`.

## Часть B — разместить код на GitHub

1. На GitHub создайте **пустой private repository** `NftGiftCase` (или public, если готовы раскрыть код; секретов в репозитории быть не должно).
2. Распакуйте архив, откройте терминал в папке `NftGiftCase`, затем выполните:
   ```bash
   git init
   git add .
   git commit -m "Initial NftGiftCase app"
   git branch -M main
   git remote add origin https://github.com/YOUR_GITHUB_NAME/NftGiftCase.git
   git push -u origin main
   ```
   Замените `YOUR_GITHUB_NAME` на свой логин. Никогда не добавляйте `.env` или `.dev.vars`; они исключены через `.gitignore`.

## Часть C — создать backend и D1 в Cloudflare

1. Зарегистрируйтесь в https://dash.cloudflare.com/. Для этого маршрута банковская карта не нужна по условиям бесплатного уровня, но условия signup/тарифа перепроверяйте при регистрации.
2. В терминале в папке проекта:
   ```bash
   npm install
   npx wrangler login
   ```
   Откроется браузер для авторизации.
3. Создайте D1 базу:
   ```bash
   npx wrangler d1 create nftgiftcase-db
   ```
   В выводе будет `database_id`. Откройте `wrangler.jsonc` и замените `REPLACE_WITH_D1_DATABASE_ID` на этот ID. Имя `nftgiftcase-db` оставьте таким же.
4. Примените схему и demo-данные:
   ```bash
   npm run db:remote
   ```
   Команда создаёт таблицы и 5 демонстрационных кейсов с PNG-предметами.
5. Откройте `wrangler.jsonc` и до публикации замените:
   - `BOT_USERNAME` → username вашего бота **без** `@`;
   - `PUBLIC_APP_URL` → URL frontend после части D, например `https://nftgiftcase.pages.dev`;
   - `ALLOWED_ORIGIN` → ровно origin сайта, например `https://nftgiftcase.pages.dev`, без `/` в конце и без пути;
   - `SUBSCRIPTION_CHANNEL` → `@NftGiftCaseNews` или актуальный канал;
   - проверьте `ADMIN_ID` = `1080484217`, `DEV_AUTH` = `false`.
6. Задайте backend-секреты интерактивно (вставляйте реальные значения в терминал; они не попадут в git):
   ```bash
   npx wrangler secret put BOT_TOKEN
   npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
   ```
   Для `TELEGRAM_WEBHOOK_SECRET` используйте случайную строку только из `A-Z a-z 0-9 _ -`, длиной до 256 символов; сохраните её в менеджере паролей. Она должна совпадать со значением `.env` при установке webhook.
7. Разверните Worker:
   ```bash
   npm run check
   npm run deploy
   ```
   В конце Wrangler покажет URL вида `https://nftgiftcase-api.<ваш-subdomain>.workers.dev`. Сохраните его. Проверьте в браузере `https://...workers.dev/api/health` — должен вернуться JSON с `"ok":true`.

## Часть D — frontend на Cloudflare Pages (рекомендуется для живого приложения)

1. В Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Выберите репозиторий `NftGiftCase` и ветку `main`.
3. Так как проект — статический HTML, в настройках сборки:
   - Framework preset: `None`;
   - Build command: оставить пустым (если UI требует команду, используйте `exit 0`);
   - Build output directory: `frontend`;
   - Root directory: `/` (корень репозитория).
4. Нажмите Deploy. Запишите URL Pages, например `https://nftgiftcase.pages.dev`.
5. Откройте `frontend/config.js` и укажите адрес Worker:
   ```js
   window.NGC_CONFIG = {
     apiBase: 'https://nftgiftcase-api.YOUR-SUBDOMAIN.workers.dev',
     mockMode: false
   };
   ```
   Подставьте свой точный Worker URL. Затем закоммитьте и отправьте:
   ```bash
   git add frontend/config.js
   git commit -m "Connect frontend to production API"
   git push
   ```
   Cloudflare Pages автоматически пересоберёт статику.
6. Если URL Pages отличается от того, что внесли в `wrangler.jsonc`, исправьте `PUBLIC_APP_URL` и `ALLOWED_ORIGIN`, затем снова выполните `npm run deploy`. Не используйте `ALLOWED_ORIGIN: "*"` в опубликованном production-проекте.

## Часть E — включить Telegram webhook и кнопку открытия Mini App

После публикации API и Pages получите:
- `PUBLIC_APP_URL=https://...pages.dev`
- `WEBHOOK_URL=https://...workers.dev/api/telegram/webhook`
- `BOT_TOKEN` из BotFather
- тот же `TELEGRAM_WEBHOOK_SECRET`, который ранее установили в Wrangler.

1. В корне проекта скопируйте `.env.example` в `.env` и заполните значения. `.env` предназначен только для локальной настройки, не коммитьте его.
2. Проверьте, что `PUBLIC_APP_URL` точно совпадает с URL Pages и `WEBHOOK_URL` заканчивается на `/api/telegram/webhook`.
3. Выполните:
   ```bash
   npm run telegram:setup
   ```
   Скрипт вызовет Telegram Bot API методы `setWebhook`, `setChatMenuButton` и `setMyCommands` (включая `/paysupport`). Успешный вывод подтвердит установку.
4. В `@BotFather` откройте настройки бота и при необходимости задайте Menu Button вручную (это также делает скрипт). Mini App должен открываться по HTTPS.
5. Откройте бота в Telegram и нажмите `/start` или Menu Button. Для прямого запуска можно использовать `https://t.me/YOUR_BOT_USERNAME?startapp`.

Если меняете токен, webhook URL или секрет webhook, повторите настройку и убедитесь, что `BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET` в Worker совпадают с конфигурацией.

## Часть F — проверка перед первым платёжным тестом

1. `GET https://YOUR_WORKER/api/health` должен вернуть `ok:true`.
2. Откройте Mini App именно **внутри Telegram**, а не обычной вкладкой браузера: реальная авторизация использует `window.Telegram.WebApp.initData`.
3. Убедитесь, что экран загрузил профиль/кейсы; запрос `/api/me` должен пройти HMAC-проверку.
4. Проверьте подписку: подпишитесь на `@NftGiftCaseNews`, нажмите «Проверить подписку»; затем проверьте сценарий без подписки.
5. Пройдите покупку в **тестовом окружении Telegram Stars**, прежде чем запускать реальные оплаты. Успешная оплата должна прийти в webhook, записаться в `payments`, отметить `orders.status='paid'` и выдать предмет/баланс.
6. Проверьте `/paysupport` и подготовьте рабочую процедуру возврата через `refundStarPayment` с сохранённым `telegram_payment_charge_id`. Не полагайтесь на сообщение `openInvoice` как на подтверждение оплаты.
7. Проверьте права администратора: в реальном Telegram откройте Mini App ID `1080484217`; убедитесь, что другой аккаунт не видит/не может вызывать `/api/admin/*`.

## Часть G — GitHub Pages только для бесплатного дизайн-демо

Проект включает `.github/workflows/pages.yml`, которая публикует только папку `frontend`.

1. Откройте GitHub repository → **Settings → Pages**.
2. В разделе Build and deployment выберите **GitHub Actions**.
3. Убедитесь, что workflow Pages имеет права `pages: write` и `id-token: write` (они заданы в файле).
4. Сделайте push в `main` или запустите workflow вручную через вкладку Actions.
5. В `frontend/config.js` для демонстрации оставьте `apiBase:''`, `mockMode:true`. Сайт показывает вымышленные тестовые действия, не списывает средства и не обращается к реальному API.

**Не используйте GitHub Pages для монетизируемого production-TMA:** официальные ограничения GitHub Pages говорят, что бесплатный сервис не предназначен для сайтов, главным образом обеспечивающих коммерческие транзакции или SaaS. Для live-версии используйте Cloudflare Pages/Workers либо другой хостинг, условия которого допускают такой сценарий.

## Другие бесплатные варианты backend — что учитывать

| Платформа | Подходит без карты? | Вывод |
|---|---|---|
| **Cloudflare Workers + D1** | Обычно да в рамках free quota | Рекомендованный путь: serverless API + SQL-совместимая база в одной панели; удобно для данного кода. |
| Vercel Hobby | Сервис может предлагать бесплатный уровень, но только личное/некоммерческое использование по Terms | Не рекомендую для монетизируемого приложения. |
| Koyeb | Нет, требует карточную проверку; docs упоминают $29 pre-authorisation | Исключён для условия «без карты». |
| Glitch | Нет — хостинг проектов прекращён в июле 2025 года | Не использовать для нового деплоя. |
| Railway | Условия/пробные кредиты/верификация меняются | Проверить на странице оплаты до выбора; не считать гарантированным вариантом без карты. |
| Render | Не рассматривается по вашему условию | Не используется в инструкции. |

## Официальные ссылки

- Telegram Mini Apps auth: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
- Telegram Stars payments: https://core.telegram.org/bots/payments-stars
- Cloudflare Express on Workers: https://developers.cloudflare.com/workers/tutorials/deploy-an-express-app/
- Cloudflare D1: https://developers.cloudflare.com/d1/reference/faq/
- Cloudflare Workers pricing: https://www.cloudflare.com/products/workers/
- GitHub Pages limitations: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Vercel Hobby Terms: https://vercel.com/legal/terms
- Koyeb pricing FAQ: https://www.koyeb.com/docs/faqs/pricing
- Glitch hosting shutdown: https://blog.glitch.com/post/goodbye-glitch
