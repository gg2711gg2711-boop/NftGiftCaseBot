# NftGiftCase — архитектура

## 1. Компоненты

```text
Telegram client
  └─ WebApp SDK → frontend/index.html + app.js + styles.css + assets/*.png
       └─ X-Telegram-Init-Data over HTTPS
           → Cloudflare Worker (Express 5)
               ├─ HMAC-SHA256 validation + auth_date freshness
               ├─ access control by numeric Telegram ID for admin routes
               ├─ Telegram Bot API (getChatMember, createInvoiceLink, webhook replies)
               └─ Cloudflare D1 (SQLite)
                    ├─ users / balances / inventory
                    ├─ cases / case_items / stock and weighted drops
                    ├─ orders / payments (idempotency by charge ID)
                    ├─ events / quests / advent claims
                    ├─ promo codes / referrals / rewards
                    └─ battles / battle players
```

### Trust boundaries

- `Telegram.WebApp.initData` — signed source sent unmodified to backend. Never use `initDataUnsafe` as identity proof.
- All prices, case contents, weights, upgrade outcomes, entitlements, balances and claim checks are decided/verified on backend. Frontend animations only show a result returned by API.
- The payment redirect / `openInvoice` result is UI information, not authoritative. Delivery happens after Telegram sends `successful_payment` to the backend webhook.
- Bot token and webhook secret are server secrets, never values in `frontend/config.js`, GitHub Pages, HTML, or JavaScript bundles.

## 2. Directory map

- `frontend/index.html` — app shell and all view templates.
- `frontend/styles.css` — mobile layout, dark theme, glow, frosted cards, roulette animation, SVG wheel, responsive breakpoints.
- `frontend/app.js` — view rendering and events; supports two modes: `mockMode:true` (design demo) or API-backed mode.
- `frontend/config.js` — `window.NGC_CONFIG = { apiBase, mockMode }`.
- `backend/app.js` — Express application; D1 helper functions; auth; Bot API calls; route handlers.
- `backend/worker.js` — Workers entrypoint. Uses Express with Wrangler's Node compatibility layer.
- `db/0001_initial.sql` — idempotent bootstrap and seeded demo cases/items.
- `scripts/setup-telegram.mjs` — `setWebhook`, `setChatMenuButton`, `/start`, `/help`, `/paysupport` commands.

## 3. Main API

All endpoints under `/api` except health and Telegram webhook require validated Telegram initData. The frontend passes it as `X-Telegram-Init-Data`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check, no auth |
| POST | `/api/telegram/webhook` | Telegram update callback protected by `X-Telegram-Bot-Api-Secret-Token` |
| GET | `/api/config` | Public-ish app configuration after auth: event, channel, bot username |
| GET | `/api/me` | Profile, internal balance, admin flag |
| GET | `/api/cases` | Cases plus item weights for odds UI |
| GET | `/api/live-wins` | Recent item wins |
| GET | `/api/inventory` | Current player's inventory |
| GET | `/api/subscription/status` | `getChatMember` membership state |
| POST | `/api/free/claim` | Daily/bonus drop after subscription check |
| POST | `/api/payments/invoice` | Create XTR invoice for case, balance top-up, or Premium Pass |
| POST | `/api/promocodes/redeem` | Redeem once per account |
| POST | `/api/withdrawals` | Create manual withdrawal request; requires username |
| POST | `/api/upgrade` | Backend-calculated upgrade chance and outcome using internal balance |
| GET | `/api/event` | Event settings, XP, quests, calendar |
| POST | `/api/event/quests/:questId/claim` | Claim finished quest XP |
| POST | `/api/event/levels/:level/claim` | Claim free/premium Battle Pass level |
| POST | `/api/event/advent/:day/claim` | Claim calendar cell once |
| GET/POST | `/api/battles` | List/create PvP matches |
| POST | `/api/battles/:battleId/join` | Join and resolve a 2-player match |
| GET | `/api/admin/overview` | Admin dashboard data |
| POST | `/api/admin/balance` | Add/remove internal app credits |
| PATCH | `/api/admin/cases/:caseId` | Price, active status, open limit and item weights |
| POST | `/api/admin/promocodes` | Create balance/spin promo |
| PATCH | `/api/admin/promocodes/:code` | Enable/disable promo |
| PATCH | `/api/admin/event` | Toggle event, type, title, end time and Premium price |

## 4. Database tables

| Table | Purpose |
|---|---|
| `users` | Telegram identity, username, app balance, free spins, Premium status and referrer |
| `cases` | Case price/status/limits/open counts |
| `case_items` | Item image, type, value, weight and optional finite stock |
| `orders` | App order and expected XTR amount/payload/status/expiry |
| `payments` | Confirmed Telegram payment reference and unique charge ID |
| `inventory` | Items owned by users and status such as `owned` or `withdraw_pending` |
| `withdrawals` | Manual request queue |
| `promo_codes`, `promo_redemptions` | Promo configuration and once-per-user redemption |
| `event_settings`, `event_progress` | Global event mode/date and per-user XP/claimed levels |
| `quests`, `user_quests` | Quest definitions and progress/claimed flags |
| `live_wins` | Recent drop feed |
| `referrals`, `referral_rewards` | Referral relation and idempotent credit rewards |
| `battles`, `battle_players` | Two-player case battles and scores/drops |
| `app_settings` | Referral percentage setting |
| `free_daily_claims`, `advent_claims` | Once-per-day free drops and once-per-cell advent redemption |

## 5. Payment sequence

1. User requests invoice. Backend calculates amount from server-side case/event settings and writes pending order with a unique opaque payload.
2. Backend calls Telegram `createInvoiceLink` with `currency:'XTR'`, empty `provider_token`, and amount expressed in Stars.
3. User pays using Telegram's official UI.
4. Telegram webhook `pre_checkout_query` is checked against pending order, Telegram user ID, currency, amount and expiration, then answered with `answerPreCheckoutQuery`.
5. Telegram posts `successful_payment` within a `message` update. Backend checks payload/user/currency/amount, stores unique `telegram_payment_charge_id`, marks order paid and applies purchase delivery.
6. A repeated charge is ignored through a unique charge ID and paid-order check.

Official reference: https://core.telegram.org/bots/payments-stars

**Production-hardening note:** before a public paid launch, wrap multi-step balance/order/inventory delivery in D1 transactions/batches where possible and load-test concurrent webhook deliveries. The starter guards duplicate charge IDs, but it is not a substitute for a payment reconciliation job and operational refund workflow. Store and retain enough payment metadata to service `/paysupport`; implement and test refunds using Telegram's `refundStarPayment` method when needed.

## 6. Authorization and abuse prevention

- Auth uses Telegram's documented HMAC-SHA256 formula. The backend enforces `auth_date` freshness (24 hours max, small future-time tolerance) and compares signatures using `timingSafeEqual`.
- Admin route middleware verifies `req.user.telegram_id === ADMIN_ID`. Default ID is `1080484217`. Do not authorize by displayed username or a client-side flag.
- Subscription status comes from `getChatMember`; the bot must be an administrator in `@NftGiftCaseNews`.
- Free claims have per-day uniqueness; promo redemptions have a `(code, telegram_id)` unique key; advent claims are unique per user/day; payment charge IDs are unique.
- Do not deploy with `DEV_AUTH=true`. It intentionally bypasses Telegram authorization for a local test user.
- Add production rate limits, monitoring, database backups, refund flow, and a formal transactional ledger before real users rely on it.

## 7. Chance math and visual behavior

- Case drop selection uses server-side integer weights. A displayed chance is `weight / sum(weights)` only among items currently eligible by stock; if stock changes, the UI should refresh odds.
- Upgrade uses a backend calculation based on stake and target item value, capped to the starter's configured range. The frontend SVG wheel is only a visualization; it cannot dictate winning.
- GIFs/PNG illustrations are local `frontend/assets/*.png` files and served by the static host/CDN. Replace them only with artwork you own or have permission to use. Upload real inventory metadata and transfer mechanism separately if true on-chain/Telegram NFT delivery is required.

## 8. Limitations to address before production

- PvP starter resolves two-player games when second player joins; it requires transactional locking/idempotency and cancellation/refund logic for production.
- Withdrawals are manual notifications; no actual asset custody or automated transfer system is included.
- Advent UI/API is a scaffold, and calendar eligibility should be aligned to the actual event timezone and schedule before enabling a live seasonal campaign.
- The “Stars” label used for the payment is Telegram Stars (XTR). The in-app balance and referral rewards are internal credits, not native Stars transfer to other users.
