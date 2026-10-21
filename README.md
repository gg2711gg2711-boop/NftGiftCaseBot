# NftGiftCase — Telegram Mini App starter

Мобильный Telegram Mini App в тёмной фиолетово-синей стилистике референсов: подарки и кейсы на PNG, горизонтальная рулетка, SVG-апгрейдер, инвентарь, Event Manager, live-лента, промокоды, referrals и демо-экран PvP.

**Статус:** runnable MVP / стартовый репозиторий. В репозитории есть код интерфейса, Express API для Cloudflare Workers, миграция D1/SQLite и утилита настройки бота. Настоящие платежи и авторизация включаются только после добавления собственных секретов, БД и HTTPS URL. Впервые открытая статическая страница по умолчанию находится в `mockMode:true` и не делает реальных платежей.

## Что внутри

```text
NftGiftCase/
├── frontend/
│   ├── index.html             # экраны Mini App
│   ├── styles.css             # glassmorphism, мобильная адаптация, анимации
│   ├── app.js                 # клиентская логика, рулетка, апгрейдер, звуки
│   ├── config.js              # адрес backend; здесь нет секретов
│   └── assets/*.png           # локальные PNG-иллюстрации предметов/кейсов
├── backend/
│   ├── app.js                 # Express API, HMAC auth, Payments, события, PvP, admin
│   └── worker.js              # Cloudflare Workers runtime entrypoint
├── db/0001_initial.sql        # таблицы + начальные кейсы/предметы/задания
├── scripts/setup-telegram.mjs # webhook, menu button, команды бота
├── .github/workflows/pages.yml# CI-деплой только демо на GitHub Pages
├── wrangler.jsonc             # настройки Cloudflare Worker + D1
├── .dev.vars.example          # пример локальных секретов Wrangler
├── .env.example               # пример локальной настройки Telegram бота
├── ARCHITECTURE.md            # схема системы, API и данных
└── DEPLOYMENT.md              # пошаговая инструкция новичку
```

## Быстро посмотреть дизайн

Нужен Node.js LTS только для запуска backend; демо-фронтенд можно посмотреть обычным статическим сервером.

```bash
cd NftGiftCase
python -m http.server 8080 --directory frontend
```

Откройте `http://127.0.0.1:8080`. Демо-режим включён в `frontend/config.js`, поэтому покупки, рулетка и баланс на этой странице — только клиентская симуляция.

## Технологии

- Frontend: HTML5, Tailwind CDN для utility-классов, CSS-переменные и custom CSS, vanilla JavaScript, SVG wheel, Web Audio API, Telegram WebApp SDK.
- Backend: Express 5 на Cloudflare Workers через `nodejs_compat` и `cloudflare:node` HTTP bridge.
- Storage: Cloudflare D1 (SQLite); миграция `db/0001_initial.sql`.
- Payments: Telegram Bot API `createInvoiceLink`, `XTR`, `pre_checkout_query`, `successful_payment`, уникальный `telegram_payment_charge_id`.

## Важные смысловые ограничения

1. **Внутренний баланс приложения — не переводимые пользователю Telegram Stars.** Пополнение внутреннего баланса оплачивается отдельным Telegram Stars invoice; внутренние кредиты используются в апгрейдере и PvP. Нельзя называть внутренние кредиты кошельком Stars.
2. Telegram Stars в Mini App используются для продажи цифровых товаров/услуг. Сервер создаёт invoice в XTR и выдаёт товар только по серверному `successful_payment` webhook; callback в браузере не является подтверждением оплаты.
3. Вывод подарка в этом starter — заявка на ручную обработку: сервер проверяет `@username`, резервирует предмет и уведомляет администратора. Интеграции с кошельком/передачей реального Telegram Gift или NFT в проекте нет; её нужно подключить к своему легальному источнику предметов.
4. Админ проверяется по Telegram ID `1080484217` на backend. Username в Telegram может измениться, поэтому ID является главным критерием. Интерфейсный флаг администратора не защищает API.
5. Случайные платные награды, PvP со ставками и вывод предметов могут подпадать под местные игровые/потребительские требования и правила Telegram. Перед реальным запуском проверьте применимые правила, возрастные ограничения, прозрачность шансов, пользовательское соглашение, поддержку и возвраты.

## Команды

```bash
npm install
npm run check
npx wrangler login
```

Полный деплой с секретами, БД и подключением Telegram описан в [DEPLOYMENT.md](DEPLOYMENT.md). Список таблиц и API — в [ARCHITECTURE.md](ARCHITECTURE.md).

## Что обязательно изменить до запуска

- `wrangler.jsonc`: заполнить `database_id`, `BOT_USERNAME`, `PUBLIC_APP_URL`, `ALLOWED_ORIGIN`.
- В `frontend/config.js`: указать `apiBase` своего Worker и поставить `mockMode: false` только после настройки backend.
- Добавить `BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` через Wrangler secrets, а не в git и не во frontend.
- Сделать публичный канал `@NftGiftCaseNews` и добавить бота администратором канала для стабильной проверки подписки.
- Протестировать invoice/payments в Telegram test environment до реального запуска.
## Gift catalogue

The home screen includes the five ordinary gift images supplied by the project owner (Мишка, Сердце, Кубок, Торт, Роза) and all 136 NFT/collectible entries listed in GiftSignal's Telegram gifts table. NFT artwork is loaded as WebP from the public TG_Photos CDN (jsDelivr); if an asset name is unavailable, the UI tries the TelegramGiftsAssests CDN and then a local fallback. Release dates and upgradeability markers are catalogue references from the source list, not a live guarantee. Prices and case probabilities are intentionally not invented; configure actual rewards separately in the admin tools.

Catalogue source: https://giftsignal.com/spisok-podarkov-v-telegram/
Image CDN reference: https://github.com/ssamy2/TelegramGiftsAssests
