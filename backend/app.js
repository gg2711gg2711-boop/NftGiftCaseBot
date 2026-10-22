import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_ID_FALLBACK = '1080484217';
const PREMIUM_PASS_PRICE = 666;
const MAX_INIT_AGE_SECONDS = 60 * 60 * 24;

const json = (res, status, payload) => res.status(status).json(payload);
const envOf = (req) => req.cfEnv || {};
const dbOf = (req) => envOf(req).DB;
const dbFirst = (db, sql, ...args) => db.prepare(sql).bind(...args).first();
const dbAll = async (db, sql, ...args) => (await db.prepare(sql).bind(...args).all()).results || [];
const dbRun = (db, sql, ...args) => db.prepare(sql).bind(...args).run();
const id = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const fail = (res, status, message) => json(res, status, { ok: false, error: message });
function normalizeImageUrl(value) {
  const raw = String(value || '').trim();
  if (/^[a-z0-9][a-z0-9._-]{0,119}$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' && url.hostname && !url.username && !url.password) return url.href;
  } catch { /* invalid URL */ }
  return null;
}
function adminInteger(value, min, max) {
  const n = Math.trunc(Number(value));
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

function secureInt(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) throw new Error('Invalid random range');
  const ceiling = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const bytes = new Uint32Array(1);
  let n;
  do { crypto.getRandomValues(bytes); n = bytes[0]; } while (n >= ceiling);
  return n % maxExclusive;
}

function validateTelegramInitData(raw, botToken) {
  if (!raw || !botToken) throw new Error('Telegram initData or BOT_TOKEN is missing');
  const params = new URLSearchParams(raw);
  const receivedHash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!receivedHash || !Number.isFinite(authDate)) throw new Error('Malformed Telegram initData');
  const current = Math.floor(Date.now() / 1000);
  if (authDate > current + 30 || current - authDate > MAX_INIT_AGE_SECONDS) throw new Error('Telegram initData has expired');
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  // Telegram Mini Apps validation: secret key = HMAC-SHA256(key='WebAppData', message=botToken).
  // Keep 'WebAppData' as the HMAC key and the bot token as the message.
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(receivedHash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Telegram initData signature is invalid');
  const userText = params.get('user');
  if (!userText) throw new Error('Telegram user is missing from initData');
  let user;
  try { user = JSON.parse(userText); } catch { throw new Error('Telegram user payload is invalid'); }
  if (!user?.id) throw new Error('Telegram user id is missing');
  return { user, startParam: params.get('start_param') || '' };
}

async function telegramCall(env, method, body) {
  if (!env.BOT_TOKEN) throw new Error('BOT_TOKEN is not configured');
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {})
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API ${method} failed`);
  return data.result;
}

async function syncUser(db, tgUser, startParam = '') {
  const telegramId = String(tgUser.id);
  const username = tgUser.username ? String(tgUser.username).replace(/^@/, '') : null;
  await dbRun(db,
    `INSERT INTO users(telegram_id, username, first_name) VALUES(?,?,?)
     ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name, updated_at=CURRENT_TIMESTAMP`,
    telegramId, username, tgUser.first_name || 'Player');
  await dbRun(db, 'INSERT OR IGNORE INTO event_progress(telegram_id) VALUES(?)', telegramId);
  await dbRun(db, `INSERT OR IGNORE INTO user_quests(telegram_id,quest_id) SELECT ?,id FROM quests WHERE active=1`, telegramId);

  const match = /^ref_(\d{1,20})$/.exec(startParam);
  if (match && match[1] !== telegramId) {
    const referrer = await dbFirst(db, 'SELECT telegram_id FROM users WHERE telegram_id=?', match[1]);
    if (referrer) {
      const result = await dbRun(db, 'INSERT OR IGNORE INTO referrals(referrer_id,referred_id) VALUES(?,?)', match[1], telegramId);
      if ((result.meta?.changes || 0) > 0) {
        await dbRun(db, 'UPDATE users SET referrer_id=? WHERE telegram_id=? AND referrer_id IS NULL', match[1], telegramId);
        await dbRun(db, 'UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id=\'refer_1\'', match[1]);
      }
    }
  }
  return await dbFirst(db, 'SELECT telegram_id,username,first_name,balance,free_spins,premium_pass,created_at FROM users WHERE telegram_id=?', telegramId);
}

function requireTelegram(req, res, next) {
  (async () => {
    const env = envOf(req); const db = dbOf(req);
    if (!db) return fail(res, 500, 'Database binding DB is missing');
    const raw = req.get('X-Telegram-Init-Data') || req.body?.initData || '';
    if (env.DEV_AUTH === 'true' && !raw) {
      const tgUser = {
        id: env.DEV_TELEGRAM_ID || '100000001',
        username: env.DEV_TELEGRAM_USERNAME || 'demo_player',
        first_name: 'Demo'
      };
      req.user = await syncUser(db, tgUser);
      return next();
    }
    const { user, startParam } = validateTelegramInitData(raw, env.BOT_TOKEN);
    req.user = await syncUser(db, user, startParam);
    next();
  })().catch((err) => fail(res, 401, err.message || 'Telegram authorization failed'));
}

function requireAdmin(req, res, next) {
  const env = envOf(req);
  const configuredId = String(env.ADMIN_ID || ADMIN_ID_FALLBACK);
  if (String(req.user?.telegram_id) !== configuredId) return fail(res, 403, 'Admin only');
  next();
}

async function requireSubscription(req, telegramId) {
  const env = envOf(req);
  if (env.DEV_AUTH === 'true') return true;
  const channel = env.SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews';
  const member = await telegramCall(env, 'getChatMember', { chat_id: channel, user_id: Number(telegramId) });
  return ['creator', 'administrator', 'member'].includes(member.status) || (member.status === 'restricted' && member.is_member === true);
}

async function getDrop(db, caseId) {
  const caseRow = await dbFirst(db, 'SELECT * FROM cases WHERE id=? AND active=1', caseId);
  if (!caseRow) throw new Error('Кейс недоступен');
  if (caseRow.max_opens !== null && caseRow.max_opens !== undefined && caseRow.opened_count >= caseRow.max_opens) throw new Error('Лимит открытий этого кейса исчерпан');
  const items = await dbAll(db, 'SELECT * FROM case_items WHERE case_id=? AND (stock_limit IS NULL OR awarded_count < stock_limit)', caseId);
  if (!items.length) throw new Error('В этом кейсе закончились предметы');
  const totalWeight = items.reduce((sum, item) => sum + Number(item.weight), 0);
  let roll = secureInt(totalWeight);
  let drop = items[items.length - 1];
  for (const item of items) {
    roll -= Number(item.weight);
    if (roll < 0) { drop = item; break; }
  }
  return { caseRow, drop };
}

async function awardDrop(db, telegramId, item, source = 'case') {
  const inventoryId = id();
  await dbRun(db, 'INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,?,\'owned\')', inventoryId, telegramId, item.id, source);
  await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+1 WHERE id=?', item.id);
  await dbRun(db, 'INSERT INTO live_wins(telegram_id,username,item_title,image_url,value_stars) SELECT ?,COALESCE(username,\'Player\'),?,?,? FROM users WHERE telegram_id=?', telegramId, item.title, item.image_url, item.value_stars, telegramId);
  if (source !== 'upgrade' && source !== 'battle_pass' && source !== 'advent' && source !== 'admin') {
    await dbRun(db, 'UPDATE cases SET opened_count=opened_count+1 WHERE id=(SELECT case_id FROM case_items WHERE id=?)', item.id);
    await dbRun(db, `UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id IN ('open_1','open_5')`, telegramId);
  }
  await dbRun(db, `UPDATE event_progress SET xp=xp+10,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`, telegramId);
  return inventoryId;
}

async function notifyAdmin(env, text, replyMarkup) {
  try {
    await telegramCall(env, 'sendMessage', {
      chat_id: String(env.ADMIN_ID || ADMIN_ID_FALLBACK), text, parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    });
  } catch (err) {
    console.error('Admin notification failed:', err.message);
  }
}

async function createOrderAndInvoice(req, res, type, itemId, quantity, amount, title, description) {
  const env = envOf(req); const db = dbOf(req); const telegramId = String(req.user.telegram_id);
  const orderId = id(); const payload = `ngc_${orderId}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  await dbRun(db,
    'INSERT INTO orders(id,telegram_id,order_type,item_id,quantity,amount_xtr,payload,status,expires_at) VALUES(?,?,?,?,?,?,?,\'pending\',?)',
    orderId, telegramId, type, itemId || null, quantity, amount, payload, expiresAt);
  if (type === 'case_open') await dbRun(db, 'UPDATE cases SET reserved_opens=reserved_opens+? WHERE id=?', quantity, itemId);
  try {
    const invoiceUrl = await telegramCall(env, 'createInvoiceLink', {
      title: String(title).slice(0, 32), description: String(description).slice(0, 255), payload,
      provider_token: '', currency: 'XTR', prices: [{ label: String(title).slice(0, 32), amount }]
    });
    return json(res, 200, { ok: true, invoiceUrl, orderId, amountXtr: amount });
  } catch (err) {
    await dbRun(db, 'UPDATE orders SET status=\'failed\' WHERE id=?', orderId);
    if (type === 'case_open') await dbRun(db, 'UPDATE cases SET reserved_opens=MAX(0,reserved_opens-?) WHERE id=?', quantity, itemId);
    return fail(res, 502, `Не удалось создать оплату: ${err.message}`);
  }
}

async function processSuccessfulPayment(env, db, message, sp) {
  const payload = sp.invoice_payload;
  const order = await dbFirst(db, 'SELECT * FROM orders WHERE payload=?', payload);
  if (!order) throw new Error('Unknown invoice payload');
  if (order.status === 'paid') return { duplicate: true, order };
  if (order.status !== 'pending') throw new Error('Order is not pending');
  if (String(message.from.id) !== String(order.telegram_id) || sp.currency !== 'XTR' || Number(sp.total_amount) !== Number(order.amount_xtr)) throw new Error('Payment fields do not match order');
  const chargeId = sp.telegram_payment_charge_id;
  const inserted = await dbRun(db,
    'INSERT OR IGNORE INTO payments(order_id,telegram_id,currency,total_amount,telegram_payment_charge_id,provider_payment_charge_id) VALUES(?,?,?,?,?,?)',
    order.id, order.telegram_id, sp.currency, sp.total_amount, chargeId, sp.provider_payment_charge_id || null);
  if ((inserted.meta?.changes || 0) === 0) return { duplicate: true, order };
  const upd = await dbRun(db, 'UPDATE orders SET status=\'paid\',paid_at=CURRENT_TIMESTAMP WHERE id=? AND status=\'pending\'', order.id);
  if ((upd.meta?.changes || 0) === 0) return { duplicate: true, order };

  if (order.order_type === 'balance_topup') {
    await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', order.amount_xtr, order.telegram_id);
  } else if (order.order_type === 'case_open') {
    await dbRun(db, 'UPDATE cases SET reserved_opens=MAX(0,reserved_opens-?) WHERE id=?', order.quantity, order.item_id);
    for (let i = 0; i < order.quantity; i++) {
      const { drop } = await getDrop(db, order.item_id);
      await awardDrop(db, order.telegram_id, drop, 'case');
    }
  } else if (order.order_type === 'premium_pass') {
    await dbRun(db, 'UPDATE users SET premium_pass=1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', order.telegram_id);
    await dbRun(db, 'UPDATE event_progress SET premium_unlocked=1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', order.telegram_id);
  } else {
    throw new Error('Unknown order type');
  }

  // Pay referral reward as internal app credits; this is not a transfer of Telegram Stars.
  const payer = await dbFirst(db, 'SELECT referrer_id FROM users WHERE telegram_id=?', order.telegram_id);
  if (payer?.referrer_id) {
    const percentRow = await dbFirst(db, 'SELECT value FROM app_settings WHERE key=\'referral_percent\'');
    const pct = Math.max(0, Math.min(25, Number(percentRow?.value || env.REFERRAL_PERCENT || 5)));
    const bonus = Math.floor(order.amount_xtr * pct / 100);
    if (bonus > 0) {
      const reward = await dbRun(db,
        'INSERT OR IGNORE INTO referral_rewards(payment_charge_id,referrer_id,referred_id,amount) VALUES(?,?,?,?)',
        chargeId, payer.referrer_id, order.telegram_id, bonus);
      if ((reward.meta?.changes || 0) > 0) await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', bonus, payer.referrer_id);
    }
  }
  // Case openings are already counted in awardDrop(); do not increment open_1 twice here.
  return { duplicate: false, order };
}

export function createApp(envProvider = () => ({})) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    req.cfEnv = envProvider(req) || {};
    const env = envOf(req);
    const origin = req.headers.origin;
    const allowed = String(env.ALLOWED_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
    if (origin && (allowed.includes('*') || allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (allowed.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data, X-Telegram-Bot-Api-Secret-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  app.get('/api/health', (req, res) => json(res, 200, { ok: true, app: 'NftGiftCase', timestamp: nowIso() }));

  app.post('/api/telegram/webhook', async (req, res) => {
    const env = envOf(req); const secret = req.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) return fail(res, 401, 'Invalid webhook secret');
    try {
      const update = req.body || {};
      if (update.pre_checkout_query) {
        const q = update.pre_checkout_query;
        const order = await dbFirst(env.DB, 'SELECT * FROM orders WHERE payload=? AND status=\'pending\'', q.invoice_payload);
        const valid = order && String(order.telegram_id) === String(q.from.id) && q.currency === 'XTR' && Number(q.total_amount) === Number(order.amount_xtr) && new Date(order.expires_at).getTime() > Date.now();
        await telegramCall(env, 'answerPreCheckoutQuery', {
          pre_checkout_query_id: q.id, ok: Boolean(valid),
          ...(!valid ? { error_message: 'Заказ не найден или устарел. Закройте оплату и создайте новый заказ.' } : {})
        });
      }
      const message = update.message;
      if (message?.text && !message.successful_payment) {
        const command = message.text.trim().split(/\s+/)[0].split('@')[0];
        if (command === '/start' || command === '/help') {
          // Record /start payload referrals immediately; the invited user need not open the Mini App first.
          if (command === '/start' && message.from && env.DB) {
            const startPayload = message.text.trim().split(/\s+/)[1] || '';
            await syncUser(env.DB, message.from, startPayload);
          }
          const appUrl = env.PUBLIC_APP_URL;
          const replyMarkup = appUrl ? { inline_keyboard: [[{ text: 'Открыть NftGiftCase', web_app: { url: appUrl } }]] } : undefined;
          await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: 'Добро пожаловать в NftGiftCase. Открывайте кейсы, собирайте цифровые предметы и используйте апгрейдер. Бесплатные подарки требуют подписки на @NftGiftCaseNews. Покупки цифровых товаров проходят только через Telegram Stars.', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
        } else if (command === '/paysupport') {
          const support = String(env.SUPPORT_USERNAME || 'sork1555').replace(/^@/, '');
          await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: `Поддержка по платежам Telegram Stars: @${support}. Укажите примерное время платежа и приложите Telegram payment charge ID, если он доступен.` });
        } else if (command === '/admin') {
          const senderId = String(message.from?.id || '');
          const adminId = String(env.ADMIN_ID || ADMIN_ID_FALLBACK);
          if (senderId !== adminId) {
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id,
              text: 'Команда /admin доступна только администратору.'
            });
          } else if (!env.PUBLIC_APP_URL) {
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id,
              text: 'Не настроен адрес приложения PUBLIC_APP_URL.'
            });
          } else {
            const adminUrl = new URL(env.PUBLIC_APP_URL);
            adminUrl.searchParams.set('admin', '1');
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id,
              text: 'Панель администратора NftGiftCase:',
              reply_markup: {
                inline_keyboard: [[{
                  text: 'Открыть админку',
                  web_app: { url: adminUrl.toString() }
                }]]
              }
            });
          }
        }
      }
      if (message?.successful_payment) {
        const result = await processSuccessfulPayment(env, env.DB, message, message.successful_payment);
        if (!result.duplicate) {
          const paid = result.order;
          const notice = paid.order_type === 'case_open' ? `Оплата получена. Открытий: ${paid.quantity}. Предметы добавлены в инвентарь.`
            : paid.order_type === 'premium_pass' ? 'Premium Pass активирован.' : `Баланс приложения пополнен на ${paid.amount_xtr} кредитов.`;
          try { await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: notice }); } catch (e) { console.warn('receipt message failed', e.message); }
        }
      }
      return json(res, 200, { ok: true });
    } catch (err) {
      console.error('Webhook processing error', err.message);
      // Acknowledge only malformed/non-actionable updates; Telegram retry is useful for transient DB failures.
      return fail(res, 500, 'Webhook processing failed');
    }
  });

  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/telegram/webhook') return next();
    return requireTelegram(req, res, next);
  });

  app.get('/api/config', async (req, res) => {
    const db = dbOf(req);
    const event = await dbFirst(db, 'SELECT enabled,event_type,title,ends_at,premium_price_xtr FROM event_settings WHERE id=1');
    return json(res, 200, { ok: true, event, channel: envOf(req).SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews', botUsername: String(envOf(req).BOT_USERNAME || '').replace(/^@/, ''), referralPercent: Number(envOf(req).REFERRAL_PERCENT || 5) });
  });

  app.get('/api/me', async (req, res) => {
    const db = dbOf(req);
    const user = await dbFirst(db, 'SELECT telegram_id,username,first_name,balance,free_spins,premium_pass FROM users WHERE telegram_id=?', req.user.telegram_id);
    return json(res, 200, { ok: true, user, isAdmin: String(user.telegram_id) === String(envOf(req).ADMIN_ID || ADMIN_ID_FALLBACK) });
  });

  app.get('/api/cases', async (req, res) => {
    const db = dbOf(req);
    const cases = await dbAll(db, `SELECT c.*, COUNT(i.id) AS item_count FROM cases c LEFT JOIN case_items i ON i.case_id=c.id WHERE c.active=1 GROUP BY c.id ORDER BY c.sort_order,c.id`);
    const detailed = await Promise.all(cases.map(async (c) => ({ ...c, items: await dbAll(db, 'SELECT id,title,image_url,kind,value_stars,weight,stock_limit,awarded_count FROM case_items WHERE case_id=? AND (stock_limit IS NULL OR awarded_count < stock_limit) ORDER BY value_stars DESC', c.id) })));
    return json(res, 200, { ok: true, cases: detailed });
  });

  app.post('/api/inventory/:inventoryId/sell', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const inventoryId = String(req.params.inventoryId || '');
    const item = await dbFirst(db, `SELECT inv.id,inv.status,ci.title,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.id=? AND inv.telegram_id=?`, inventoryId, userId);
    if (!item || item.status !== 'owned') return fail(res, 409, 'Предмет не найден, уже продан или отправлен на вывод');
    const saleValue = Math.max(1, Math.floor(Number(item.value_stars || 0) * 0.7));
    const update = await dbRun(db, `UPDATE inventory SET status='sold' WHERE id=? AND telegram_id=? AND status='owned'`, inventoryId, userId);
    if ((update.meta?.changes || 0) === 0) return fail(res, 409, 'Предмет уже обрабатывается или продан');
    await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', saleValue, userId);
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
    return json(res, 200, { ok:true, saleValue, balance:Number(user?.balance || 0), message:`Предмет продан за ${saleValue} кредитов` });
  });

  app.get('/api/live-wins', async (req, res) => {
    const wins = await dbAll(dbOf(req), `SELECT id,username,item_title,image_url,value_stars,created_at FROM live_wins ORDER BY id DESC LIMIT 18`);
    return json(res, 200, { ok: true, wins });
  });

  app.get('/api/inventory', async (req, res) => {
    const db = dbOf(req);
    const items = await dbAll(db, `SELECT inv.id AS inventory_id,inv.status,inv.source,inv.created_at,ci.id AS item_id,ci.title,ci.image_url,ci.kind,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.status IN ('owned','withdraw_pending') ORDER BY inv.created_at DESC LIMIT 100`, req.user.telegram_id);
    return json(res, 200, { ok: true, items });
  });

  app.get('/api/subscription/status', async (req, res) => {
    try {
      const subscribed = await requireSubscription(req, req.user.telegram_id);
      return json(res, 200, { ok: true, subscribed, channel: envOf(req).SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews' });
    } catch (err) { return json(res, 200, { ok: true, subscribed: false, channel: envOf(req).SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews', error: err.message }); }
  });

  const claimFreeGift = async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id);
    try {
      const caseId = String(req.body?.caseId || 'daily');
      if (!['daily', 'nft-mini'].includes(caseId)) return fail(res, 400, 'Этот подарок нельзя получить бесплатно');
      const subscribed = await requireSubscription(req, userId);
      if (!subscribed) return fail(res, 403, 'Подпишитесь на канал @NftGiftCaseNews и нажмите «Проверить подписку».');
      const day = new Date().toISOString().slice(0, 10);
      const claim = await dbRun(db, 'INSERT OR IGNORE INTO free_daily_claims(telegram_id,claim_date,reward_key) VALUES(?,?,?)', userId, day, caseId);
      if ((claim.meta?.changes || 0) === 0) return fail(res, 409, 'Этот подарок уже получен сегодня.');
      const { drop } = await getDrop(db, caseId);
      const inventoryId = await awardDrop(db, userId, drop, caseId === 'daily' ? 'daily' : 'free_bonus');
      await dbRun(db, 'UPDATE free_daily_claims SET inventory_id=? WHERE telegram_id=? AND claim_date=? AND reward_key=?', inventoryId, userId, day, caseId);
      if (caseId === 'daily') await dbRun(db, `UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id='daily_1'`, userId);
      return json(res, 200, { ok: true, item: drop, inventoryId });
    } catch (err) { return fail(res, 400, err.message); }
  };
  app.post('/api/free/claim', claimFreeGift);
  app.post('/api/free/daily', claimFreeGift);

  app.post('/api/cases/open-with-balance', async (req, res) => {
    const db = dbOf(req); const telegramId = String(req.user.telegram_id);
    const caseId = String(req.body?.caseId || '');
    const quantity = Math.trunc(Number(req.body?.quantity) || 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 5) return fail(res, 400, 'Количество открытий должно быть от 1 до 5');
    const c = await dbFirst(db, 'SELECT * FROM cases WHERE id=? AND active=1 AND is_free=0', caseId);
    if (!c) return fail(res, 404, 'Платный кейс не найден или выключен');
    if (c.max_opens !== null && c.max_opens !== undefined && Number(c.opened_count) + Number(c.reserved_opens || 0) + quantity > Number(c.max_opens)) return fail(res, 409, 'Осталось меньше открытий, чем выбрано');
    const total = Number(c.price_xtr) * quantity;
    if (!Number.isSafeInteger(total) || total < 1 || total > 5000000) return fail(res, 400, 'Некорректная стоимость кейса');
    const rows = await dbAll(db, 'SELECT * FROM case_items WHERE case_id=? ORDER BY id', caseId);
    const drops = [];
    for (let i=0; i<quantity; i++) {
      const eligible = rows.filter(item => item.stock_limit === null || item.stock_limit === undefined || Number(item.awarded_count) < Number(item.stock_limit));
      if (!eligible.length) return fail(res, 409, 'В этом кейсе закончились предметы');
      const totalWeight = eligible.reduce((sum,item)=>sum+Number(item.weight||0),0);
      if (!Number.isSafeInteger(totalWeight) || totalWeight <= 0) return fail(res, 500, 'У кейса некорректно настроены шансы');
      let roll = secureInt(totalWeight); let chosen = eligible[eligible.length-1];
      for (const item of eligible) { roll -= Number(item.weight); if (roll < 0) { chosen=item; break; } }
      drops.push({ ...chosen });
      const chosenRow = rows.find(item=>item.id===chosen.id); if (chosenRow) chosenRow.awarded_count = Number(chosenRow.awarded_count||0) + 1;
    }
    const debit = await dbRun(db, 'UPDATE users SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance>=?', total, telegramId, total);
    if ((debit.meta?.changes || 0) === 0) return fail(res, 409, 'Недостаточно кредитов для открытия кейса');
    const awarded = [];
    for (const drop of drops) {
      const inventoryId = await awardDrop(db, telegramId, drop, 'case');
      awarded.push({ id:drop.id, title:drop.title, image_url:drop.image_url, kind:drop.kind, value_stars:drop.value_stars, inventoryId });
    }
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', telegramId);
    return json(res, 200, { ok:true, caseId, quantity, items:awarded, balance:Number(user?.balance || 0), spent:total });
  });

  app.post('/api/payments/invoice', async (req, res) => {
    const db = dbOf(req); const { type } = req.body || {};
    try {
      if (type === 'case_open') {
        const caseId = String(req.body.caseId || '');
        const quantity = Math.max(1, Math.min(5, Number(req.body.quantity) || 1));
        const c = await dbFirst(db, 'SELECT * FROM cases WHERE id=? AND active=1 AND is_free=0', caseId);
        if (!c) return fail(res, 404, 'Кейс не найден');
        if (c.max_opens !== null && c.max_opens !== undefined && c.opened_count + c.reserved_opens + quantity > c.max_opens) return fail(res, 409, 'Осталось меньше открытий, чем выбрано');
        return await createOrderAndInvoice(req, res, type, caseId, quantity, Number(c.price_xtr) * quantity, `Открытие: ${c.title}`, `Открыть ${quantity} × ${c.title} в NftGiftCase`);
      }
      if (type === 'balance_topup') {
        const amount = Number(req.body.amount);
        if (![50,100,250,500,1000].includes(amount)) return fail(res, 400, 'Недопустимая сумма пополнения');
        return await createOrderAndInvoice(req, res, type, null, 1, amount, `Баланс ${amount}`, `Пополнение внутреннего баланса приложения на ${amount} кредитов`);
      }
      if (type === 'premium_pass') {
        const event = await dbFirst(db, 'SELECT enabled,event_type,premium_price_xtr,title FROM event_settings WHERE id=1');
        if (!event?.enabled || event.event_type !== 'battle_pass' || (event.ends_at && new Date(event.ends_at).getTime() <= Date.now())) return fail(res, 409, 'Premium Pass сейчас недоступен');
        if (req.user.premium_pass) return fail(res, 409, 'Premium Pass уже активирован');
        return await createOrderAndInvoice(req, res, type, null, 1, Number(event.premium_price_xtr || PREMIUM_PASS_PRICE), 'Premium Pass', 'Premium ветка боевого пропуска NftGiftCase');
      }
      return fail(res, 400, 'Неизвестный тип платежа');
    } catch (err) { return fail(res, 500, err.message); }
  });

  app.post('/api/promocodes/redeem', async (req, res) => {
    const db = dbOf(req); const code = String(req.body?.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return fail(res, 400, 'Проверьте промокод');
    const promo = await dbFirst(db, 'SELECT * FROM promo_codes WHERE code=? AND active=1', code);
    if (!promo) return fail(res, 404, 'Промокод не найден или выключен');
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return fail(res, 410, 'Срок промокода истёк');
    if (promo.max_uses !== null && promo.used_count >= promo.max_uses) return fail(res, 409, 'Лимит применений исчерпан');
    const result = await dbRun(db, 'INSERT OR IGNORE INTO promo_redemptions(code,telegram_id) VALUES(?,?)', code, req.user.telegram_id);
    if ((result.meta?.changes || 0) === 0) return fail(res, 409, 'Вы уже использовали этот промокод');
    if (promo.kind === 'balance') await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', promo.amount, req.user.telegram_id);
    else await dbRun(db, 'UPDATE users SET free_spins=free_spins+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', promo.amount, req.user.telegram_id);
    await dbRun(db, 'UPDATE promo_codes SET used_count=used_count+1 WHERE code=?', code);
    return json(res, 200, { ok: true, message: promo.kind === 'balance' ? `Начислено ${promo.amount} кредитов` : `Начислено прокрутов: ${promo.amount}` });
  });

  app.post('/api/withdrawals', async (req, res) => {
    const db = dbOf(req); const user = req.user;
    if (!user.username) return fail(res, 422, 'Установите @username в Telegram перед выводом подарка.');
    const inventoryId = String(req.body?.inventoryId || '');
    const item = await dbFirst(db, `SELECT inv.id,inv.status,ci.title,ci.image_url,ci.kind,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.id=? AND inv.telegram_id=?`, inventoryId, user.telegram_id);
    if (!item || item.status !== 'owned') return fail(res, 404, 'Предмет не найден или уже зарезервирован для вывода');
    const wid = id();
    const update = await dbRun(db, `UPDATE inventory SET status='withdraw_pending' WHERE id=? AND telegram_id=? AND status='owned'`, inventoryId, user.telegram_id);
    if ((update.meta?.changes || 0) === 0) return fail(res, 409, 'Предмет уже обрабатывается');
    await dbRun(db, 'INSERT INTO withdrawals(id,telegram_id,inventory_id,status) VALUES(?,?,?,\'pending\')', wid, user.telegram_id, inventoryId);
    const mention = `@${user.username}`;
    const safeName = String(user.first_name || 'Player').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
    const safeTitle = String(item.title).replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
    const text = `<b>Заявка на вывод подарка</b>\nИгрок: ${safeName}\nID: <code>${user.telegram_id}</code>\nUsername: ${mention}\nПредмет: ${safeTitle}\nТип: ${item.kind}\nЗаявка: <code>${wid}</code>`;
    await notifyAdmin(envOf(req), text, { inline_keyboard: [[{ text: 'Написать пользователю', url: `https://t.me/${encodeURIComponent(user.username)}` }]] });
    return json(res, 201, { ok: true, message: 'Заявка отправлена администратору. Вывод выполняется вручную после проверки.' });
  });

  app.post('/api/upgrade', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id);
    const targetId = String(req.body?.targetItemId || '');
    const bet = Math.floor(Number(req.body?.bet) || 0);
    if (!Number.isSafeInteger(bet) || bet < 1 || bet > 100000) return fail(res, 400, 'Некорректная ставка');
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
    if (!user || user.balance < bet) return fail(res, 409, 'Недостаточно средств на внутреннем балансе');
    const target = await dbFirst(db, 'SELECT * FROM case_items WHERE id=?', targetId);
    if (!target) return fail(res, 404, 'Целевой предмет не найден');
    const chance = Math.min(95, Math.max(0.5, bet / Math.max(1, target.value_stars) * 100));
    const roll = secureInt(100000) / 1000;
    await dbRun(db, 'UPDATE users SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance>=?', bet, userId, bet);
    const won = roll < chance;
    let inventoryId = null;
    if (won) inventoryId = await awardDrop(db, userId, target, 'upgrade');
    return json(res, 200, { ok: true, won, chance: Number(chance.toFixed(2)), roll: Number(roll.toFixed(3)), item: won ? target : null, inventoryId, balance: (await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId)).balance });
  });

  app.get('/api/event', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id);
    const settings = await dbFirst(db, 'SELECT enabled,event_type,title,ends_at,premium_price_xtr FROM event_settings WHERE id=1')
      || { enabled:0, event_type:'battle_pass', title:'Halloween Pass', ends_at:null, premium_price_xtr:PREMIUM_PASS_PRICE };
    const progress = await dbFirst(db, 'SELECT xp,premium_unlocked,claimed_free_levels,claimed_premium_levels FROM event_progress WHERE telegram_id=?', userId);
    const quests = await dbAll(db, `SELECT q.id,q.title,q.description,q.target,q.reward_xp,COALESCE(u.progress,0) AS progress,COALESCE(u.claimed,0) AS claimed FROM quests q LEFT JOIN user_quests u ON u.quest_id=q.id AND u.telegram_id=? WHERE q.active=1 ORDER BY q.id`, userId);
    const rewards = await dbAll(db, `SELECT er.event_type,er.branch,er.level,er.item_id,ci.title,ci.image_url,ci.kind,ci.value_stars FROM event_rewards er JOIN case_items ci ON ci.id=er.item_id ORDER BY er.event_type,er.branch,er.level`);
    const rewardMap = new Map(rewards.map(r => [`${r.event_type}:${r.branch}:${r.level}`, r]));
    const adventDefaults = ['daily-teddy','daily-rocket','daily-perfume','daily-ring'];
    const today = new Date();
    const isAdventSeason = today.getUTCMonth() === 11;
    const calendar = await Promise.all(Array.from({length:24}, async (_,i) => {
      const day = i + 1;
      const configured = rewardMap.get(`advent:advent:${day}`);
      const itemId = configured?.item_id || adventDefaults[(day - 1) % adventDefaults.length];
      const item = configured || await dbFirst(db, 'SELECT id AS item_id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
      return { day, title:item?.title || `Подарок ${day}`, item_id:item?.item_id || itemId, image_url:item?.image_url || ['gift-box.png','nft-swan.png','rocket.png','perfume.png'][(day-1)%4], kind:item?.kind || 'gift', value_stars:item?.value_stars || 0, unlocked:isAdventSeason && day <= today.getUTCDate() };
    }));
    return json(res, 200, { ok:true, settings, progress:progress || { xp:0,premium_unlocked:0,claimed_free_levels:'[]',claimed_premium_levels:'[]' }, quests, calendar, rewards });
  });

  app.post('/api/event/quests/:questId/claim', async (req, res) => {
    const db = dbOf(req); const questId = String(req.params.questId);
    const quest = await dbFirst(db, `SELECT q.*,u.progress,u.claimed FROM quests q JOIN user_quests u ON u.quest_id=q.id AND u.telegram_id=? WHERE q.id=? AND q.active=1`, req.user.telegram_id, questId);
    if (!quest) return fail(res, 404, 'Задание не найдено');
    if (quest.claimed) return fail(res, 409, 'Награда уже получена');
    if (quest.progress < quest.target) return fail(res, 409, 'Задание ещё не выполнено');
    await dbRun(db, 'UPDATE user_quests SET claimed=1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id=? AND claimed=0', req.user.telegram_id, questId);
    await dbRun(db, 'UPDATE event_progress SET xp=xp+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', quest.reward_xp, req.user.telegram_id);
    return json(res, 200, { ok:true, xpGained: quest.reward_xp, message:`Получено ${quest.reward_xp} XP` });
  });

  app.post('/api/event/levels/:level/claim', async (req, res) => {
    const db = dbOf(req); const telegramId = String(req.user.telegram_id);
    const level = Math.trunc(Number(req.params.level)); const branch = req.body?.branch === 'premium' ? 'premium' : 'free';
    if (!Number.isSafeInteger(level) || level < 1 || level > 30) return fail(res, 400, 'Уровень должен быть от 1 до 30');
    const event = await dbFirst(db, 'SELECT enabled,event_type,ends_at FROM event_settings WHERE id=1');
    if (!event?.enabled || event.event_type !== 'battle_pass' || (event.ends_at && new Date(event.ends_at).getTime() <= Date.now())) return fail(res, 409, 'Battle Pass завершён или выключен');
    const progress = await dbFirst(db, 'SELECT xp,premium_unlocked,claimed_free_levels,claimed_premium_levels FROM event_progress WHERE telegram_id=?', telegramId);
    if (Number(progress?.xp || 0) < level * 100) return fail(res, 409, 'Недостаточно XP для этого уровня');
    if (branch === 'premium' && !Number(progress?.premium_unlocked)) return fail(res, 403, 'Активируйте Premium Pass');
    const field = branch === 'premium' ? 'claimed_premium_levels' : 'claimed_free_levels';
    let claimed = [];
    try { claimed = JSON.parse(progress?.[field] || '[]'); } catch { claimed = []; }
    if (claimed.includes(level)) return fail(res, 409, 'Награда уже получена');
    const configuredReward = await dbFirst(db, `SELECT ci.* FROM event_rewards er JOIN case_items ci ON ci.id=er.item_id WHERE er.event_type='battle_pass' AND er.branch=? AND er.level=?`, branch, level);
    const chosenId = branch === 'premium' && level === 30 ? 'legend-swan'
      : branch === 'premium' ? ['nft-swan-item','nft-ring-item','nft-rocket-item'][level % 3]
      : ['daily-teddy','daily-rocket','daily-perfume','daily-ring'][level % 4];
    const item = configuredReward || await dbFirst(db, 'SELECT * FROM case_items WHERE id=?', chosenId);
    if (!item) return fail(res, 500, 'Награда уровня не настроена');
    if (item.stock_limit !== null && item.stock_limit !== undefined && Number(item.awarded_count || 0) >= Number(item.stock_limit)) return fail(res, 409, 'Запас этой награды закончился. Обратись к администратору.');
    claimed.push(level);
    await dbRun(db, `UPDATE event_progress SET ${field}=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`, JSON.stringify(claimed), telegramId);
    const inventoryId = id();
    await dbRun(db, "INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,?,'owned')", inventoryId, telegramId, item.id, 'battle_pass');
    await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+1 WHERE id=?', item.id);
    await dbRun(db, "INSERT INTO live_wins(telegram_id,username,item_title,image_url,value_stars) SELECT ?,COALESCE(username,'Player'),?,?,? FROM users WHERE telegram_id=?", telegramId, item.title, item.image_url, item.value_stars, telegramId);
    return json(res, 200, { ok:true, message:`Награда уровня ${level} получена`, item, inventoryId });
  });

  app.post('/api/event/advent/:day/claim', async (req, res) => {
    const db = dbOf(req); const telegramId = String(req.user.telegram_id); const day = Math.trunc(Number(req.params.day));
    const event = await dbFirst(db, 'SELECT enabled,event_type,ends_at FROM event_settings WHERE id=1');
    if (!event?.enabled || event.event_type !== 'advent' || (event.ends_at && new Date(event.ends_at).getTime() <= Date.now())) return fail(res, 409, 'Адвент-календарь завершён или выключен');
    const today = new Date();
    if (!Number.isSafeInteger(day) || day < 1 || day > 24 || today.getUTCMonth() !== 11 || day > today.getUTCDate()) return fail(res, 409, 'Эта ячейка пока закрыта: ячейки открываются по дням декабря.');
    const configuredReward = await dbFirst(db, `SELECT ci.* FROM event_rewards er JOIN case_items ci ON ci.id=er.item_id WHERE er.event_type='advent' AND er.branch='advent' AND er.level=?`, day);
    const defaultIds = ['daily-teddy','daily-rocket','daily-perfume','daily-ring'];
    const drop = configuredReward || await dbFirst(db, 'SELECT * FROM case_items WHERE id=?', defaultIds[(day - 1) % defaultIds.length]);
    if (!drop) return fail(res, 500, 'Награда адвент-календаря не настроена');
    if (drop.stock_limit !== null && drop.stock_limit !== undefined && Number(drop.awarded_count || 0) >= Number(drop.stock_limit)) return fail(res, 409, 'Запас этой награды закончился. Выбери другой подарок в настройках события.');
    const claim = await dbRun(db, 'INSERT OR IGNORE INTO advent_claims(telegram_id,day) VALUES(?,?)', telegramId, day);
    if ((claim.meta?.changes || 0) === 0) return fail(res, 409, 'Вы уже открыли эту ячейку');
    const inventoryId = id();
    await dbRun(db, "INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,'advent','owned')", inventoryId, telegramId, drop.id);
    await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+1 WHERE id=?', drop.id);
    await dbRun(db, "INSERT INTO live_wins(telegram_id,username,item_title,image_url,value_stars) SELECT ?,COALESCE(username,'Player'),?,?,? FROM users WHERE telegram_id=?", telegramId, drop.title, drop.image_url, drop.value_stars, telegramId);
    await dbRun(db, 'UPDATE event_progress SET xp=xp+10,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', telegramId);
    return json(res, 200, { ok:true, item:drop, inventoryId });
  });

  app.post('/api/battles', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const caseId = String(req.body?.caseId || 'crate-blue');
    const c = await dbFirst(db, 'SELECT * FROM cases WHERE id=? AND active=1 AND is_free=0', caseId);
    if (!c) return fail(res, 404, 'Кейс для битвы не найден');
    const cost = Number(req.body?.entryCost ?? c.price_xtr);
    if (!Number.isSafeInteger(cost) || cost < 0 || cost > 100000) return fail(res, 400, 'Некорректная стоимость входа');
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
    if (Number(user?.balance || 0) < cost) return fail(res, 409, 'Недостаточно кредитов для входа в битву');
    const battleId = id();
    const debit = await dbRun(db, 'UPDATE users SET balance=balance-? WHERE telegram_id=? AND balance>=?', cost, userId, cost);
    if ((debit.meta?.changes || 0) === 0) return fail(res, 409, 'Недостаточно кредитов');
    await dbRun(db, 'INSERT INTO battles(id,creator_id,case_id,entry_cost,status) VALUES(?,?,?, ?,\'waiting\')', battleId, userId, caseId, cost);
    await dbRun(db, 'INSERT INTO battle_players(battle_id,telegram_id) VALUES(?,?)', battleId, userId);
    return json(res, 201, { ok:true, battle:{ id:battleId,case_id:caseId,entry_cost:cost,status:'waiting' } });
  });

  app.get('/api/battles', async (req, res) => {
    const battles = await dbAll(dbOf(req), `SELECT b.id,b.case_id,c.title AS case_title,c.image_url,b.entry_cost,b.status,b.created_at,COUNT(bp.telegram_id) AS players FROM battles b JOIN cases c ON c.id=b.case_id LEFT JOIN battle_players bp ON bp.battle_id=b.id WHERE b.status IN ('waiting','running') GROUP BY b.id ORDER BY b.created_at DESC LIMIT 30`);
    return json(res, 200, { ok:true, battles });
  });

  app.post('/api/battles/:battleId/join', async (req, res) => {
    const db = dbOf(req); const battleId = String(req.params.battleId); const userId = String(req.user.telegram_id);
    const battle = await dbFirst(db, 'SELECT * FROM battles WHERE id=? AND status=\'waiting\'', battleId);
    if (!battle) return fail(res, 404, 'Битва уже началась или не найдена');
    if (battle.creator_id === userId) return fail(res, 409, 'Нельзя присоединиться к собственной битве');
    const alreadyJoined = await dbFirst(db, 'SELECT telegram_id FROM battle_players WHERE battle_id=? AND telegram_id=?', battleId, userId);
    if (alreadyJoined) return fail(res, 409, 'Вы уже в этой битве');
    const debit = await dbRun(db, 'UPDATE users SET balance=balance-? WHERE telegram_id=? AND balance>=?', battle.entry_cost, userId, battle.entry_cost);
    if ((debit.meta?.changes || 0) === 0) return fail(res, 409, 'Недостаточно кредитов');
    const joined = await dbRun(db, 'INSERT OR IGNORE INTO battle_players(battle_id,telegram_id) VALUES(?,?)', battleId, userId);
    if ((joined.meta?.changes || 0) === 0) {
      await dbRun(db, 'UPDATE users SET balance=balance+? WHERE telegram_id=?', battle.entry_cost, userId);
      return fail(res, 409, 'Вы уже в этой битве');
    }
    await dbRun(db, 'UPDATE battles SET status=\'running\' WHERE id=? AND status=\'waiting\'', battleId);
    const players = await dbAll(db, 'SELECT telegram_id FROM battle_players WHERE battle_id=? ORDER BY joined_at LIMIT 2', battleId);
    if (players.length !== 2) return json(res, 200, { ok:true, status:'waiting' });
    const results = [];
    for (const p of players) {
      const { drop } = await getDrop(db, battle.case_id);
      const invId = await awardDrop(db, p.telegram_id, drop, 'battle');
      await dbRun(db, 'UPDATE battle_players SET score=?,drop_inventory_id=? WHERE battle_id=? AND telegram_id=?', drop.value_stars, invId, battleId, p.telegram_id);
      results.push({ userId:p.telegram_id, item:drop, inventoryId:invId, score:Number(drop.value_stars) });
    }
    const winner = results[0].score >= results[1].score ? results[0] : results[1];
    const loser = results.find(x => x.userId !== winner.userId);
    await dbRun(db, 'UPDATE inventory SET telegram_id=? WHERE id=? AND status=\'owned\'', winner.userId, loser.inventoryId);
    await dbRun(db, 'UPDATE users SET balance=balance+? WHERE telegram_id=?', Number(battle.entry_cost)*2, winner.userId);
    await dbRun(db, 'UPDATE battles SET status=\'finished\',winner_id=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?', winner.userId, battleId);
    return json(res, 200, { ok:true, status:'finished', winnerId:winner.userId, results, transferredItem:loser.item, balance:(await dbFirst(db,'SELECT balance FROM users WHERE telegram_id=?',winner.userId))?.balance });
  });

  // Admin API: all write operations are protected server-side by Telegram ID.
  app.get('/api/admin/overview', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const [userCount, orders, withdrawals, cases, promos, rewardCatalog] = await Promise.all([
      dbFirst(db, 'SELECT COUNT(*) AS n FROM users'),
      dbAll(db, 'SELECT id,telegram_id,order_type,amount_xtr,status,created_at,paid_at FROM orders ORDER BY created_at DESC LIMIT 30'),
      dbAll(db, `SELECT w.id,w.status,w.created_at,u.telegram_id,u.username,ci.title AS item_title FROM withdrawals w JOIN users u ON u.telegram_id=w.telegram_id JOIN inventory inv ON inv.id=w.inventory_id JOIN case_items ci ON ci.id=inv.item_id ORDER BY w.created_at DESC LIMIT 30`),
      // Hide internal daily reward cases and retired sample crates from the owner's case builder.
      dbAll(db, `SELECT c.* FROM cases c WHERE c.id NOT IN ('daily','nft-mini','crate-blue','crate-orange','legend') ORDER BY c.sort_order,c.created_at`),
      dbAll(db, 'SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 30'),
      dbAll(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items ORDER BY title,id')
    ]);
    const detailedCases = await Promise.all(cases.map(async c => ({
      ...c,
      items: await dbAll(db, 'SELECT id,title,image_url,kind,value_stars,weight,stock_limit,awarded_count FROM case_items WHERE case_id=? ORDER BY created_at,id', c.id)
    })));
    const event = await dbFirst(db, 'SELECT * FROM event_settings WHERE id=1') || { id:1,enabled:0,event_type:'battle_pass',title:'Halloween Pass',ends_at:null,premium_price_xtr:PREMIUM_PASS_PRICE };
    return json(res, 200, { ok:true, userCount:userCount?.n || 0, orders, withdrawals, cases:detailedCases, promos, event, rewardCatalog });
  });

  app.post('/api/admin/cases', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 180);
    const imageUrl = normalizeImageUrl(req.body?.imageUrl);
    const price = adminInteger(req.body?.priceXtr, 1, 1000000);
    const maxRaw = req.body?.maxOpens;
    const maxOpens = maxRaw === '' || maxRaw === null || maxRaw === undefined ? null : adminInteger(maxRaw, 1, 100000000);
    if (title.length < 2 || title.length > 48) return fail(res, 400, 'Название кейса должно содержать от 2 до 48 символов');
    if (!imageUrl) return fail(res, 400, 'Выбери корректную обложку кейса');
    if (price === null) return fail(res, 400, 'Цена открытия должна быть от 1 до 1 000 000 Stars');
    if (maxRaw !== '' && maxRaw !== null && maxRaw !== undefined && maxOpens === null) return fail(res, 400, 'Лимит открытий должен быть положительным целым числом');
    const caseId = `custom-${id().replaceAll('-', '').slice(0, 16)}`;
    const sort = Number((await dbFirst(db, 'SELECT COALESCE(MAX(sort_order),0)+10 AS next_sort FROM cases'))?.next_sort || 100);
    await dbRun(db, `INSERT INTO cases(id,title,description,image_url,price_xtr,is_free,active,max_opens,sort_order) VALUES(?,?,?,?,?,0,0,?,?)`, caseId, title, description, imageUrl, price, maxOpens, sort);
    return json(res, 201, { ok:true, case:await dbFirst(db, 'SELECT * FROM cases WHERE id=?', caseId) });
  });

  app.post('/api/admin/cases/:caseId/items', requireAdmin, async (req, res) => {
    const db = dbOf(req); const caseId = String(req.params.caseId || '');
    const c = await dbFirst(db, 'SELECT id FROM cases WHERE id=?', caseId);
    if (!c) return fail(res, 404, 'Кейс не найден');
    const title = String(req.body?.title || '').trim();
    const imageUrl = normalizeImageUrl(req.body?.imageUrl);
    const kindRaw = String(req.body?.kind || 'gift');
    const kind = ['nft','skin'].includes(kindRaw) ? kindRaw : (['gift','regular'].includes(kindRaw) ? 'gift' : null);
    const valueStars = adminInteger(req.body?.valueStars, 0, 100000000);
    const chancePct = Number(req.body?.chancePct);
    const stockRaw = req.body?.stockLimit;
    const stockLimit = stockRaw === '' || stockRaw === null || stockRaw === undefined ? null : adminInteger(stockRaw, 1, 100000000);
    if (title.length < 1 || title.length > 100 || !imageUrl || !kind) return fail(res, 400, 'Проверь название, изображение и тип предмета');
    if (valueStars === null) return fail(res, 400, 'Стоимость предмета должна быть целым числом от 0 до 100 000 000');
    if (!Number.isFinite(chancePct) || chancePct <= 0 || chancePct > 100) return fail(res, 400, 'Шанс должен быть больше 0 и не больше 100%');
    if (stockRaw !== '' && stockRaw !== null && stockRaw !== undefined && stockLimit === null) return fail(res, 400, 'Количество должно быть положительным целым числом или пустым');
    const duplicate = await dbFirst(db, `SELECT id FROM case_items WHERE case_id=? AND title=? AND image_url=? AND (stock_limit IS NULL OR awarded_count < stock_limit) LIMIT 1`, caseId, title, imageUrl);
    if (duplicate) return fail(res, 409, 'Этот подарок уже добавлен в данный кейс');
    const itemId = id(); const weight = Math.max(1, Math.round(chancePct * 1000));
    await dbRun(db, `INSERT INTO case_items(id,case_id,title,image_url,kind,value_stars,weight,stock_limit) VALUES(?,?,?,?,?,?,?,?)`, itemId, caseId, title, imageUrl, kind, valueStars, weight, stockLimit);
    return json(res, 201, { ok:true, item:await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars,weight,stock_limit,awarded_count FROM case_items WHERE id=?', itemId) });
  });

  app.delete('/api/admin/cases/:caseId/items/:itemId', requireAdmin, async (req, res) => {
    const db = dbOf(req); const caseId = String(req.params.caseId || ''); const itemId = String(req.params.itemId || '');
    const item = await dbFirst(db, 'SELECT id,awarded_count FROM case_items WHERE id=? AND case_id=?', itemId, caseId);
    if (!item) return fail(res, 404, 'Предмет кейса не найден');
    // Keep awarded items referentially intact in inventory, but exhaust this item's remaining stock.
    await dbRun(db, 'UPDATE case_items SET stock_limit=awarded_count WHERE id=? AND case_id=?', itemId, caseId);
    return json(res, 200, { ok:true });
  });

  app.post('/api/admin/balance', requireAdmin, async (req, res) => {
    const db = dbOf(req); const targetId = String(req.body?.telegramId || ''); const amount = Math.trunc(Number(req.body?.amount));
    const mode = req.body?.mode === 'subtract' ? 'subtract' : 'add';
    if (!/^\d{1,20}$/.test(targetId) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) return fail(res, 400, 'Некорректный пользователь или сумма');
    await dbRun(db, `INSERT OR IGNORE INTO users(telegram_id,first_name) VALUES(?,'Player')`, targetId);
    const target = await dbFirst(db, 'SELECT telegram_id FROM users WHERE telegram_id=?', targetId);
    if (!target) return fail(res, 500, 'Не удалось создать запись пользователя');
    if (mode === 'subtract') {
      const upd = await dbRun(db, 'UPDATE users SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance>=?', amount, targetId, amount);
      if ((upd.meta?.changes || 0) === 0) return fail(res, 409, 'Недостаточно средств');
    } else await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', amount, targetId);
    return json(res, 200, { ok:true, balance:(await dbFirst(db,'SELECT balance FROM users WHERE telegram_id=?',targetId)).balance });
  });

  app.post('/api/admin/rewards', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const targetId = String(req.body?.telegramId || '').trim();
    const itemId = String(req.body?.itemId || '').trim();
    const hasAmount = req.body?.amount !== undefined && req.body?.amount !== null && req.body?.amount !== '';
    const amount = hasAmount ? adminInteger(req.body.amount, 1, 1000000) : null;
    if (!/^[1-9]\d{0,19}$/.test(targetId)) return fail(res, 400, 'Некорректный Telegram ID пользователя');
    if (!itemId && !hasAmount) return fail(res, 400, 'Выбери подарок, сумму или оба варианта');
    if (hasAmount && amount === null) return fail(res, 400, 'Сумма должна быть целым числом от 1 до 1 000 000');
    await dbRun(db, `INSERT OR IGNORE INTO users(telegram_id,first_name) VALUES(?,'Player')`, targetId);
    const target = await dbFirst(db, 'SELECT telegram_id FROM users WHERE telegram_id=?', targetId);
    if (!target) return fail(res, 500, 'Не удалось создать запись пользователя');
    let item = null; let inventoryId = null;
    if (itemId) {
      item = await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
      if (!item) return fail(res, 404, 'Подарок не найден в каталоге');
      inventoryId = id();
    }
    if (amount !== null) await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', amount, targetId);
    if (item && inventoryId) {
      await dbRun(db, `INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,'admin','owned')`, inventoryId, targetId, item.id);
    }
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', targetId);
    return json(res, 200, { ok:true, telegramId:targetId, balance:Number(user?.balance || 0), item:item ? { ...item, inventoryId } : null, amount:amount || 0 });
  });

  app.patch('/api/admin/cases/:caseId', requireAdmin, async (req, res) => {
    const db = dbOf(req); const caseId = String(req.params.caseId);
    const c = await dbFirst(db, 'SELECT * FROM cases WHERE id=?', caseId);
    if (!c) return fail(res, 404, 'Кейс не найден');

    const updates = [];
    const args = [];
    if (req.body?.title !== undefined) {
      const title = String(req.body.title || '').trim();
      if (title.length < 2 || title.length > 48) return fail(res, 400, 'Название кейса должно содержать от 2 до 48 символов');
      updates.push('title=?'); args.push(title);
    }
    if (req.body?.description !== undefined) { updates.push('description=?'); args.push(String(req.body.description || '').trim().slice(0,180)); }
    if (req.body?.imageUrl !== undefined) {
      const imageUrl = normalizeImageUrl(req.body.imageUrl);
      if (!imageUrl) return fail(res, 400, 'Некорректное изображение');
      updates.push('image_url=?'); args.push(imageUrl);
    }
    if (req.body?.priceXtr !== undefined) {
      const price = adminInteger(req.body.priceXtr, 1, 1000000);
      if (price === null) return fail(res, 400, 'Цена открытия должна быть от 1 до 1 000 000 Stars');
      updates.push('price_xtr=?'); args.push(price);
    }
    let nextActive = c.active;
    if (req.body?.active !== undefined) nextActive = req.body.active ? 1 : 0;
    const maxRaw = req.body?.maxOpens;
    if (maxRaw !== undefined) {
      const maxOpens = maxRaw === '' || maxRaw === null ? null : adminInteger(maxRaw, 1, 100000000);
      if (maxRaw !== '' && maxRaw !== null && maxOpens === null) return fail(res, 400, 'Лимит открытий должен быть положительным целым числом или пустым');
      updates.push('max_opens=?'); args.push(maxOpens);
    }
    if (nextActive) {
      const available = await dbFirst(db, 'SELECT COUNT(*) AS n FROM case_items WHERE case_id=? AND (stock_limit IS NULL OR awarded_count < stock_limit)', caseId);
      if (Number(available?.n || 0) < 1) return fail(res, 400, 'Добавь хотя бы один доступный предмет перед активацией кейса');
    }
    updates.push('active=?'); args.push(nextActive);

    if (Array.isArray(req.body?.items)) {
      for (const item of req.body.items) {
        const itemId = String(item.id || '');
        const itemRow = await dbFirst(db, 'SELECT id,case_id FROM case_items WHERE id=? AND case_id=?', itemId, caseId);
        if (!itemRow) return fail(res, 400, 'Один из предметов больше не относится к выбранному кейсу');
        const itemUpdates = []; const itemArgs = [];
        if (item.chancePct !== undefined) {
          const chancePct = Number(item.chancePct);
          if (!Number.isFinite(chancePct) || chancePct <= 0 || chancePct > 100) return fail(res, 400, 'Шанс предмета должен быть больше 0 и не больше 100%');
          itemUpdates.push('weight=?'); itemArgs.push(Math.max(1, Math.round(chancePct * 1000)));
        } else if (item.weight !== undefined) {
          const weight = adminInteger(item.weight, 1, 1000000);
          if (weight === null) return fail(res, 400, 'Некорректный вес выпадения');
          itemUpdates.push('weight=?'); itemArgs.push(weight);
        }
        if (item.valueStars !== undefined) {
          const valueStars = adminInteger(item.valueStars, 0, 100000000);
          if (valueStars === null) return fail(res, 400, 'Стоимость предмета должна быть целым числом от 0 до 100 000 000');
          itemUpdates.push('value_stars=?'); itemArgs.push(valueStars);
        }
        if (Object.prototype.hasOwnProperty.call(item, 'stockLimit')) {
          const raw = item.stockLimit;
          const stockLimit = raw === '' || raw === null || raw === undefined ? null : adminInteger(raw, 1, 100000000);
          if (raw !== '' && raw !== null && raw !== undefined && stockLimit === null) return fail(res, 400, 'Количество предмета должно быть положительным целым числом или пустым');
          itemUpdates.push('stock_limit=?'); itemArgs.push(stockLimit);
        }
        if (itemUpdates.length) await dbRun(db, `UPDATE case_items SET ${itemUpdates.join(',')} WHERE id=? AND case_id=?`, ...itemArgs, itemId, caseId);
      }
    }
    if (updates.length) await dbRun(db, `UPDATE cases SET ${updates.join(',')} WHERE id=?`, ...args, caseId);
    return json(res, 200, { ok:true, case:await dbFirst(db,'SELECT * FROM cases WHERE id=?',caseId) });
  });

  app.post('/api/admin/promocodes', requireAdmin, async (req, res) => {
    const db = dbOf(req); const code = String(req.body?.code || '').trim().toUpperCase();
    const kind = req.body?.kind === 'spins' ? 'spins' : 'balance'; const amount = Math.trunc(Number(req.body?.amount));
    const maxUsesRaw = req.body?.maxUses; const maxUses = maxUsesRaw === '' || maxUsesRaw === null || maxUsesRaw === undefined ? null : Math.trunc(Number(maxUsesRaw));
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt).toISOString() : null;
    if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1))) return fail(res, 400, 'Проверьте код, размер награды и лимит');
    try {
      await dbRun(db,'INSERT INTO promo_codes(code,kind,amount,max_uses,expires_at) VALUES(?,?,?,?,?)',code,kind,amount,maxUses,expiresAt);
      return json(res, 201, { ok:true, code, kind, amount });
    } catch { return fail(res, 409, 'Такой промокод уже существует'); }
  });

  app.patch('/api/admin/promocodes/:code', requireAdmin, async (req, res) => {
    const active = req.body?.active ? 1 : 0;
    const result = await dbRun(dbOf(req), 'UPDATE promo_codes SET active=? WHERE code=?', active, String(req.params.code).toUpperCase());
    if ((result.meta?.changes || 0) === 0) return fail(res, 404, 'Промокод не найден');
    return json(res, 200, { ok:true });
  });

  app.patch('/api/admin/event', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    try {
      const enabled = req.body?.enabled ? 1 : 0;
      const eventType = req.body?.eventType === 'advent' ? 'advent' : 'battle_pass';
      const title = String(req.body?.title || (eventType === 'advent' ? 'Адвент-календарь' : 'Halloween Pass')).trim().slice(0, 80);
      const rawEnd = req.body?.endsAt;
      const endDate = rawEnd ? new Date(rawEnd) : null;
      if (rawEnd && (!endDate || !Number.isFinite(endDate.getTime()))) return fail(res, 400, 'Проверь дату окончания события');
      const endsAt = endDate ? endDate.toISOString() : null;
      const premiumPrice = Math.trunc(Number(req.body?.premiumPriceXtr ?? PREMIUM_PASS_PRICE));
      if (!title) return fail(res, 400, 'Укажи название события');
      if (!Number.isSafeInteger(premiumPrice) || premiumPrice < 1 || premiumPrice > 100000) return fail(res, 400, 'Цена Premium Pass должна быть от 1 до 100 000 Stars');
      await dbRun(db, `INSERT INTO event_settings(id,enabled,event_type,title,ends_at,premium_price_xtr,updated_at) VALUES(1,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,event_type=excluded.event_type,title=excluded.title,ends_at=excluded.ends_at,premium_price_xtr=excluded.premium_price_xtr,updated_at=CURRENT_TIMESTAMP`, enabled,eventType,title,endsAt,premiumPrice);
      const saved = await dbFirst(db, 'SELECT * FROM event_settings WHERE id=1');
      return json(res, 200, { ok:true, event:saved });
    } catch (err) {
      console.error('Admin event save failed:', err?.stack || err);
      return fail(res, 500, 'Не удалось сохранить событие. Проверь, что таблица event_settings создана в D1.');
    }
  });

  app.get('/api/global-display', async (req, res) => {
    const settings = await dbFirst(dbOf(req), 'SELECT * FROM global_display_settings WHERE id=1');
    return json(res, 200, { ok:true, settings:settings || { id:1,message_enabled:0,message_title:'Новости NftGiftCase',message_body:'',timer_enabled:0,timer_title:'До завершения события',timer_ends_at:null } });
  });

  app.patch('/api/admin/global-display', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    try {
      const messageEnabled = req.body?.messageEnabled ? 1 : 0;
      const messageTitle = String(req.body?.messageTitle || 'Новости NftGiftCase').trim().slice(0, 70);
      const messageBody = String(req.body?.messageBody || '').trim().slice(0, 260);
      const timerEnabled = req.body?.timerEnabled ? 1 : 0;
      const timerTitle = String(req.body?.timerTitle || 'До завершения события').trim().slice(0, 80);
      const rawTimerEnd = req.body?.timerEndsAt;
      const timerDate = rawTimerEnd ? new Date(rawTimerEnd) : null;
      if (rawTimerEnd && (!timerDate || !Number.isFinite(timerDate.getTime()))) return fail(res, 400, 'Проверь дату глобального таймера');
      if (timerEnabled && !timerDate) return fail(res, 400, 'Укажи дату окончания для включённого таймера');
      await dbRun(db, `INSERT INTO global_display_settings(id,message_enabled,message_title,message_body,timer_enabled,timer_title,timer_ends_at,updated_at)
        VALUES(1,?,?,?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET message_enabled=excluded.message_enabled,message_title=excluded.message_title,message_body=excluded.message_body,timer_enabled=excluded.timer_enabled,timer_title=excluded.timer_title,timer_ends_at=excluded.timer_ends_at,updated_at=CURRENT_TIMESTAMP`,
        messageEnabled,messageTitle,messageBody,timerEnabled,timerTitle,timerDate ? timerDate.toISOString() : null);
      const settings = await dbFirst(db, 'SELECT * FROM global_display_settings WHERE id=1');
      return json(res, 200, { ok:true, settings });
    } catch (err) {
      console.error('Global display save failed:', err?.stack || err);
      return fail(res, 500, 'Не удалось сохранить глобальное сообщение или таймер. Проверь миграцию базы данных.');
    }
  });

  app.post('/api/admin/event/rewards', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const eventType = req.body?.eventType === 'advent' ? 'advent' : 'battle_pass';
    const branch = String(req.body?.branch || 'free');
    const level = adminInteger(req.body?.level, 1, eventType === 'advent' ? 24 : 30);
    const itemId = String(req.body?.itemId || '').trim();
    const validBranch = eventType === 'advent' ? branch === 'advent' : ['free','premium'].includes(branch);
    if (!validBranch) return fail(res, 400, 'Неверная ветка наград для выбранного события');
    if (level === null) return fail(res, 400, eventType === 'advent' ? 'День должен быть от 1 до 24' : 'Уровень должен быть от 1 до 30');
    const item = await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
    if (!item) return fail(res, 404, 'Выбранный подарок не найден в каталоге');
    await dbRun(db, `INSERT INTO event_rewards(event_type,branch,level,item_id,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(event_type,branch,level) DO UPDATE SET item_id=excluded.item_id,updated_at=CURRENT_TIMESTAMP`, eventType,branch,level,itemId);
    return json(res, 200, { ok:true, eventType, branch, level, item });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled API error:', err?.stack || err);
    if (res.headersSent) return next(err);
    return fail(res, 500, 'Внутренняя ошибка сервера');
  });
  return app;
}
