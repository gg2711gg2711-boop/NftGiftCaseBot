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

async function writeAdminAudit(db, telegramId, action, details = {}) {
  if (!db) return;
  try {
    await dbRun(db,
      'INSERT INTO admin_audit_log(id,admin_telegram_id,action,details,created_at) VALUES(?,?,?,?,?)',
      id(), String(telegramId || ''), String(action || 'admin_action').slice(0, 100),
      JSON.stringify(details || {}).slice(0, 1200), nowIso());
  } catch (err) { console.warn('Admin audit log write failed:', err?.message || err); }
}

function adminActionLabel(req) {
  const path = String(req.path || '');
  if (path.includes('/offers')) return 'Магазин ограниченных предложений';
  if (path.includes('/broadcasts')) return 'Рассылка игрокам';
  if (path.includes('/cases')) return 'Управление кейсами';
  if (path.includes('/promocodes')) return 'Промокоды';
  if (path.includes('/balance')) return 'Изменение баланса';
  if (path.includes('/rewards')) return 'Выдача наград';
  if (path.includes('/event')) return 'Настройки события';
  if (path.includes('/quests')) return 'Редактор квестов';
  if (path.includes('/global-display')) return 'Глобальное сообщение / таймер';
  if (path.includes('/theme')) return 'Оформление приложения';
  if (path.includes('/collections')) return 'Сезонные коллекции';
  return 'Административное действие';
}
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
        await dbRun(db, `UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id IN (SELECT quest_id FROM quest_trigger_rules WHERE trigger_event='referral')`, match[1]);
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
    const path = String(req.path || '');
    const isAdmin = String(req.user?.telegram_id) === String(env.ADMIN_ID || ADMIN_ID_FALLBACK);
    // The subscription status and config endpoints must remain reachable so the client can show a gate.
    if (!isAdmin && !['/config', '/subscription/status'].includes(path)) {
      let subscribed = false;
      try { subscribed = await requireSubscription(req, req.user.telegram_id); } catch (subscriptionError) {
        console.warn('Subscription check failed:', subscriptionError?.message || subscriptionError);
      }
      if (!subscribed) return json(res, 403, {
        ok: false,
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'Сначала подпишитесь на канал @NftGiftCaseNews, затем нажмите «Проверить подписку».',
        channel: env.SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews'
      });
    }
    return next();
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
  if (env.DEV_AUTH === 'true' || String(telegramId) === String(env.ADMIN_ID || ADMIN_ID_FALLBACK)) return true;
  const db = dbOf(req);
  const userId = String(telegramId);
  // Short cache avoids calling getChatMember for every API request while still refreshing membership regularly.
  if (db) {
    try {
      const cached = await dbFirst(db, 'SELECT is_subscribed,checked_at FROM subscription_status_cache WHERE telegram_id=?', userId);
      if (cached?.checked_at && Date.now() - new Date(cached.checked_at).getTime() < 60_000) return Number(cached.is_subscribed) === 1;
    } catch { /* Continue with live verification before the migration is applied. */ }
  }
  const channel = env.SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews';
  const member = await telegramCall(env, 'getChatMember', { chat_id: channel, user_id: Number(userId) });
  const subscribed = ['creator', 'administrator', 'member'].includes(member.status) || (member.status === 'restricted' && member.is_member === true);
  if (db) {
    try { await dbRun(db, `INSERT INTO subscription_status_cache(telegram_id,is_subscribed,checked_at) VALUES(?,?,?)
      ON CONFLICT(telegram_id) DO UPDATE SET is_subscribed=excluded.is_subscribed,checked_at=excluded.checked_at`, userId, subscribed ? 1 : 0, nowIso()); }
    catch { /* The check still works without the optional cache table. */ }
  }
  return subscribed;
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

async function nextItemSerial(db, itemId) {
  const result = await db.prepare(`INSERT INTO item_serial_counters(item_id,next_serial) VALUES(?,1)
    ON CONFLICT(item_id) DO UPDATE SET next_serial=item_serial_counters.next_serial+1 RETURNING next_serial`).bind(String(itemId)).all();
  const row = result?.results?.[0];
  if (!row || !Number.isSafeInteger(Number(row.next_serial))) throw new Error('Не удалось выдать номер предмета');
  return Number(row.next_serial);
}

async function ensureInventorySerial(db, inventoryId, itemId) {
  try {
    const current = await dbFirst(db, 'SELECT serial_number FROM inventory WHERE id=?', inventoryId);
    if (current?.serial_number !== null && current?.serial_number !== undefined) return Number(current.serial_number);
    const serial = await nextItemSerial(db, itemId);
    await dbRun(db, 'UPDATE inventory SET serial_number=? WHERE id=? AND serial_number IS NULL', serial, inventoryId);
    const saved = await dbFirst(db, 'SELECT serial_number FROM inventory WHERE id=?', inventoryId);
    return Number(saved?.serial_number ?? serial);
  } catch (err) {
    // Keep older installations usable until migration 0008 has been applied.
    console.warn('Inventory serial assignment skipped:', err?.message || err);
    return null;
  }
}

function rollCraftBackground(inputCount) {
  // Weights out of 10,000. Black is always the rarest background; more inputs improve its odds.
  const tables = {
    2: [{ key:'default', weight:6400 },{ key:'blue', weight:2300 },{ key:'purple', weight:1000 },{ key:'gold', weight:250 },{ key:'black', weight:50 }],
    3: [{ key:'default', weight:5400 },{ key:'blue', weight:2400 },{ key:'purple', weight:1500 },{ key:'gold', weight:550 },{ key:'black', weight:150 }],
    4: [{ key:'default', weight:4000 },{ key:'blue', weight:2700 },{ key:'purple', weight:2200 },{ key:'gold', weight:800 },{ key:'black', weight:300 }]
  };
  const choices = tables[inputCount] || tables[2];
  let roll = secureInt(10000);
  for (const choice of choices) { roll -= choice.weight; if (roll < 0) return choice.key; }
  return 'default';
}

async function awardDrop(db, telegramId, item, source = 'case') {
  const inventoryId = id();
  await dbRun(db, 'INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,?,\'owned\')', inventoryId, telegramId, item.id, source);
  await ensureInventorySerial(db, inventoryId, item.id);
  await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+1 WHERE id=?', item.id);
  await dbRun(db, 'INSERT INTO live_wins(telegram_id,username,item_title,image_url,value_stars) SELECT ?,COALESCE(username,\'Player\'),?,?,? FROM users WHERE telegram_id=?', telegramId, item.title, item.image_url, item.value_stars, telegramId);
  if (source !== 'upgrade' && source !== 'battle_pass' && source !== 'advent' && source !== 'admin') {
    await dbRun(db, 'UPDATE cases SET opened_count=opened_count+1 WHERE id=(SELECT case_id FROM case_items WHERE id=?)', item.id);
    await dbRun(db, `UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id IN (SELECT quest_id FROM quest_trigger_rules WHERE trigger_event='case_open')`, telegramId);
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

async function answerCallback(env, callbackQueryId, text, showAlert = false) {
  try { await telegramCall(env, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text, show_alert: showAlert }); }
  catch (err) { console.warn('Callback acknowledgement failed:', err.message); }
}

async function handleTelegramCallback(env, callback) {
  const data = String(callback?.data || '');
  const actorId = String(callback?.from?.id || '');
  const adminId = String(env.ADMIN_ID || ADMIN_ID_FALLBACK);

  if (data === 'check_subscription') {
    // Force a fresh membership check when the user returns from the channel.
    if (env.DB) { try { await dbRun(env.DB, 'DELETE FROM subscription_status_cache WHERE telegram_id=?', actorId); } catch { /* cache table may not exist yet */ } }
    let subscribed = false;
    try { subscribed = await requireSubscription({ cfEnv: env }, actorId); }
    catch (err) { console.warn('Subscription callback check failed:', err.message); }
    if (!subscribed) {
      await answerCallback(env, callback.id, 'Подписка пока не найдена. Подпишитесь на канал и нажмите ещё раз.', true);
      return;
    }
    await answerCallback(env, callback.id, 'Подписка подтверждена!');
    const chatId = callback.message?.chat?.id;
    const messageId = callback.message?.message_id;
    if (chatId && messageId && env.PUBLIC_APP_URL) {
      await telegramCall(env, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text: '✅ Подписка подтверждена! Теперь можно открыть NftGiftCase.',
        reply_markup: { inline_keyboard: [[{ text: '🎁 Открыть NftGiftCase', web_app: { url: env.PUBLIC_APP_URL } }]] }
      });
    }
    return;
  }

  const withdrawalMatch = /^withdraw_(approve|reject):([0-9a-f-]{36})$/i.exec(data);
  if (!withdrawalMatch) {
    await answerCallback(env, callback.id, 'Эта кнопка больше не активна.');
    return;
  }
  if (actorId !== adminId) {
    await answerCallback(env, callback.id, 'Только администратор может обрабатывать выводы.', true);
    return;
  }
  if (!env.DB) {
    await answerCallback(env, callback.id, 'База данных недоступна.', true);
    return;
  }

  const action = withdrawalMatch[1].toLowerCase();
  const withdrawalId = withdrawalMatch[2];
  const withdrawal = await dbFirst(env.DB,
    `SELECT w.id,w.telegram_id,w.inventory_id,w.status,u.username,ci.title AS item_title
     FROM withdrawals w JOIN users u ON u.telegram_id=w.telegram_id
     JOIN inventory inv ON inv.id=w.inventory_id JOIN case_items ci ON ci.id=inv.item_id
     WHERE w.id=?`, withdrawalId);
  if (!withdrawal) {
    await answerCallback(env, callback.id, 'Заявка не найдена.', true);
    return;
  }
  if (withdrawal.status !== 'pending') {
    await answerCallback(env, callback.id, `Заявка уже обработана: ${withdrawal.status}.`, true);
    return;
  }

  if (action === 'approve') {
    const changed = await dbRun(env.DB,
      `UPDATE withdrawals SET status='approved',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'`, withdrawalId);
    if ((changed.meta?.changes || 0) === 0) {
      await answerCallback(env, callback.id, 'Заявка уже обработана.', true);
      return;
    }
    await dbRun(env.DB,
      `UPDATE inventory SET status='withdrawn',withdrawn_at=CURRENT_TIMESTAMP WHERE id=? AND telegram_id=? AND status='withdraw_pending'`,
      withdrawal.inventory_id, withdrawal.telegram_id);
    try {
      await telegramCall(env, 'sendMessage', { chat_id: withdrawal.telegram_id,
        text: `✅ Заявка на вывод подарка «${withdrawal.item_title}» подтверждена администратором. Если фактическая передача подарка ещё не завершена, администратор свяжется с вами.` });
    } catch (err) { console.warn('Could not notify user about approved withdrawal:', err.message); }
    await answerCallback(env, callback.id, 'Вывод подтверждён.');
    const chatId = callback.message?.chat?.id; const messageId = callback.message?.message_id;
    if (chatId && messageId) await telegramCall(env, 'editMessageText', {
      chat_id: chatId, message_id: messageId,
      text: `${callback.message.text || 'Заявка на вывод подарка'}\n\n✅ ВЫВОД ПОДТВЕРЖДЁН`, parse_mode: 'HTML'
    });
    return;
  }

  const changed = await dbRun(env.DB,
    `UPDATE withdrawals SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending'`, withdrawalId);
  if ((changed.meta?.changes || 0) === 0) {
    await answerCallback(env, callback.id, 'Заявка уже обработана.', true);
    return;
  }
  await dbRun(env.DB,
    `UPDATE inventory SET status='owned' WHERE id=? AND telegram_id=? AND status='withdraw_pending'`,
    withdrawal.inventory_id, withdrawal.telegram_id);
  try {
    await telegramCall(env, 'sendMessage', { chat_id: withdrawal.telegram_id,
      text: `❌ Заявка на вывод подарка «${withdrawal.item_title}» отклонена. Подарок возвращён в ваш инвентарь.` });
  } catch (err) { console.warn('Could not notify user about rejected withdrawal:', err.message); }
  await answerCallback(env, callback.id, 'Заявка отклонена, подарок возвращён игроку.');
  const chatId = callback.message?.chat?.id; const messageId = callback.message?.message_id;
  if (chatId && messageId) await telegramCall(env, 'editMessageText', {
    chat_id: chatId, message_id: messageId,
    text: `${callback.message.text || 'Заявка на вывод подарка'}\n\n❌ ВЫВОД ОТКЛОНЁН · ПОДАРОК ВОЗВРАЩЁН`, parse_mode: 'HTML'
  });
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
      if (update.callback_query) {
        await handleTelegramCallback(env, update.callback_query);
        return json(res, 200, { ok: true });
      }
      const message = update.message;
      if (message?.text && !message.successful_payment) {
        const command = message.text.trim().split(/\s+/)[0].split('@')[0];
        if (command === '/start') {
          if (message.from && env.DB) {
            const startPayload = message.text.trim().split(/\s+/)[1] || '';
            await syncUser(env.DB, message.from, startPayload);
          }
          let subscribed = false;
          try { subscribed = await requireSubscription({ cfEnv: env }, String(message.from?.id || '')); }
          catch (err) { console.warn('Could not verify subscription in /start:', err.message); }
          if (!subscribed) {
            const channelName = String(env.SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews').replace(/^@/, '');
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id,
              text: `👋 Добро пожаловать в NftGiftCase!\n\nЧтобы войти в приложение, сначала подпишитесь на наш Telegram-канал @${channelName}, затем нажмите «✅ Подтвердить подписку».`,
              reply_markup: { inline_keyboard: [
                [{ text: '📢 Подписаться на канал', url: `https://t.me/${encodeURIComponent(channelName)}` }],
                [{ text: '✅ Подтвердить подписку', callback_data: 'check_subscription' }]
              ] }
            });
          } else {
            const appUrl = env.PUBLIC_APP_URL;
            const replyMarkup = appUrl ? { inline_keyboard: [[{ text: '🎁 Открыть NftGiftCase', web_app: { url: appUrl } }]] } : undefined;
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id,
              text: '✅ Подписка подтверждена! Добро пожаловать в NftGiftCase. Открывайте кейсы и собирайте подарки.',
              ...(replyMarkup ? { reply_markup: replyMarkup } : {})
            });
          }
        } else if (command === '/help') {
          await telegramCall(env, 'sendMessage', {
            chat_id: message.chat.id,
            text: 'NftGiftCase: открывайте кейсы, собирайте подарки и выполняйте задания. Для входа в Mini App нужна подписка на @NftGiftCaseNews. Команда /start проверяет подписку, /paysupport — поддержка платежей.'
          });
        } else if (command === '/paysupport') {
          const support = String(env.SUPPORT_USERNAME || 'sork1555').replace(/^@/, '');
          await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: `Поддержка по платежам Telegram Stars: @${support}. Укажите примерное время платежа и приложите Telegram payment charge ID, если он доступен.` });
        } else if (command === '/admin') {
          const senderId = String(message.from?.id || '');
          const adminId = String(env.ADMIN_ID || ADMIN_ID_FALLBACK);
          if (senderId !== adminId) {
            await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: 'Команда /admin доступна только администратору.' });
          } else if (!env.PUBLIC_APP_URL) {
            await telegramCall(env, 'sendMessage', { chat_id: message.chat.id, text: 'Не настроен адрес приложения PUBLIC_APP_URL.' });
          } else {
            const adminUrl = new URL(env.PUBLIC_APP_URL);
            adminUrl.searchParams.set('admin', '1');
            await telegramCall(env, 'sendMessage', {
              chat_id: message.chat.id, text: 'Панель администратора NftGiftCase:',
              reply_markup: { inline_keyboard: [[{ text: 'Открыть админку', web_app: { url: adminUrl.toString() } }]] }
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

  // Public read endpoint: the selected theme is global and shared by all players.
  // If the migration is not installed yet, keep the app usable with the classic theme.
  app.get('/api/theme', async (req, res) => {
    try {
      const row = await dbFirst(dbOf(req), 'SELECT theme,updated_at FROM app_theme_settings WHERE id=1');
      return json(res, 200, { ok:true, theme:row?.theme === 'halloween' ? 'halloween' : 'normal', updatedAt:row?.updated_at || null, available:true });
    } catch (err) {
      console.warn('Theme settings are not available yet:', err?.message || err);
      return json(res, 200, { ok:true, theme:'normal', updatedAt:null, available:false });
    }
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

  // Active limited-time shop offers; dates and global/per-player stock are enforced server-side.
  app.get('/api/offers', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const now = nowIso();
    const offers = await dbAll(db, `SELECT o.*,ci.title AS reward_item_title,ci.image_url AS reward_item_image,
      COALESCE(uc.purchase_count,0) AS user_purchases
      FROM limited_offers o LEFT JOIN case_items ci ON ci.id=o.reward_item_id
      LEFT JOIN limited_offer_user_counts uc ON uc.offer_id=o.id AND uc.telegram_id=?
      WHERE o.active=1 AND o.starts_at<=? AND o.ends_at>? AND (o.max_purchases IS NULL OR o.sold_count<o.max_purchases)
        AND (o.per_user_limit IS NULL OR COALESCE(uc.purchase_count,0)<o.per_user_limit)
      ORDER BY o.ends_at ASC,o.created_at DESC`, userId, now, now);
    return json(res, 200, { ok:true, offers: offers.map(o => ({...o, remaining: o.max_purchases == null ? null : Math.max(0, Number(o.max_purchases)-Number(o.sold_count)), user_remaining: o.per_user_limit == null ? null : Math.max(0, Number(o.per_user_limit)-Number(o.user_purchases))})) });
  });

  app.post('/api/offers/:offerId/purchase', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const offerId = String(req.params.offerId || '');
    let userReserved = false; let stockReserved = false; let balanceDebited = false;
    let reservedPrice = 0; let bonusGranted = 0; let inventoryId = null; let inventoryItemId = null; let itemAwardCounted = false; let purchaseRecordId = null;
    try {
      const offer = await dbFirst(db, 'SELECT * FROM limited_offers WHERE id=?', offerId);
      if (!offer || Number(offer.active)!==1) return fail(res, 404, 'Предложение больше недоступно');
      const now = nowIso();
      if (String(offer.starts_at)>now) return fail(res, 409, 'Предложение ещё не началось');
      if (String(offer.ends_at)<=now) return fail(res, 409, 'Время предложения закончилось');
      if (!offer.reward_item_id && Number(offer.reward_credits||0)<=0) return fail(res, 409, 'У предложения нет доступной награды');
      await dbRun(db, 'INSERT OR IGNORE INTO limited_offer_user_counts(offer_id,telegram_id,purchase_count) VALUES(?,?,0)', offerId, userId);
      const userHold = await dbRun(db, 'UPDATE limited_offer_user_counts SET purchase_count=purchase_count+1 WHERE offer_id=? AND telegram_id=? AND purchase_count < ?', offerId, userId, offer.per_user_limit == null ? 100000000 : Number(offer.per_user_limit));
      if ((userHold.meta?.changes||0)===0) return fail(res, 409, 'Ты уже использовал лимит покупок этого предложения');
      userReserved = true;
      const stockHold = await dbRun(db, `UPDATE limited_offers SET sold_count=sold_count+1,updated_at=? WHERE id=? AND active=1 AND starts_at<=? AND ends_at>? AND (max_purchases IS NULL OR sold_count<max_purchases)`, now, offerId, now, now);
      if ((stockHold.meta?.changes||0)===0) { await dbRun(db, 'UPDATE limited_offer_user_counts SET purchase_count=MAX(0,purchase_count-1) WHERE offer_id=? AND telegram_id=?', offerId,userId); userReserved=false; return fail(res, 409, 'Все наборы уже куплены или предложение завершено'); }
      stockReserved = true;
      const debit = await dbRun(db, 'UPDATE users SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance>=?', Number(offer.price_credits), userId, Number(offer.price_credits));
      if ((debit.meta?.changes||0)===0) {
        await dbRun(db, 'UPDATE limited_offers SET sold_count=MAX(0,sold_count-1),updated_at=? WHERE id=?', nowIso(), offerId); stockReserved=false;
        await dbRun(db, 'UPDATE limited_offer_user_counts SET purchase_count=MAX(0,purchase_count-1) WHERE offer_id=? AND telegram_id=?', offerId,userId); userReserved=false;
        return fail(res, 409, 'Недостаточно внутренних кредитов ★');
      }
      balanceDebited = true; reservedPrice = Number(offer.price_credits);
      if (offer.reward_item_id) {
        const item = await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items WHERE id=?', offer.reward_item_id);
        if (!item) throw new Error('Предмет награды больше не существует');
        inventoryId = id(); inventoryItemId = item.id;
        await dbRun(db, `INSERT INTO inventory(id,telegram_id,item_id,source,status) VALUES(?,?,?,'limited_offer','owned')`, inventoryId,userId,item.id);
        await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+1 WHERE id=?', item.id); itemAwardCounted = true;
      }
      const bonusCredits = Number(offer.reward_credits||0);
      if (bonusCredits>0) { await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', bonusCredits,userId); bonusGranted=bonusCredits; }
      purchaseRecordId=id();
      await dbRun(db, `INSERT INTO limited_offer_purchases(id,offer_id,telegram_id,price_credits,reward_item_id,reward_credits,inventory_id,created_at) VALUES(?,?,?,?,?,?,?,?)`, purchaseRecordId,offerId,userId,Number(offer.price_credits),offer.reward_item_id||null,bonusCredits,inventoryId,nowIso());
      const updatedUser = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
      return json(res, 200, {ok:true, message:`Набор «${offer.title}» куплен!`, inventoryId, rewardCredits:bonusCredits, balance:Number(updatedUser?.balance||0)});
    } catch (err) {
      // Release temporary reservations and undo any partial reward grants if a later step fails.
      if (purchaseRecordId) { try { await dbRun(db,'DELETE FROM limited_offer_purchases WHERE id=?',purchaseRecordId); } catch {} }
      if (inventoryId) { try { await dbRun(db,'DELETE FROM inventory WHERE id=? AND telegram_id=?',inventoryId,userId); } catch {} }
      if (itemAwardCounted && inventoryItemId) { try { await dbRun(db,'UPDATE case_items SET awarded_count=MAX(0,awarded_count-1) WHERE id=?',inventoryItemId); } catch {} }
      if (bonusGranted>0) { try { await dbRun(db,'UPDATE users SET balance=MAX(0,balance-?),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?',bonusGranted,userId); } catch {} }
      if (balanceDebited) { try { await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', reservedPrice || Number((await dbFirst(db,'SELECT price_credits FROM limited_offers WHERE id=?',offerId))?.price_credits||0), userId); } catch {} }
      if (stockReserved) { try { await dbRun(db,'UPDATE limited_offers SET sold_count=MAX(0,sold_count-1),updated_at=? WHERE id=?',nowIso(),offerId); } catch {} }
      if (userReserved) { try { await dbRun(db,'UPDATE limited_offer_user_counts SET purchase_count=MAX(0,purchase_count-1) WHERE offer_id=? AND telegram_id=?',offerId,userId); } catch {} }
      console.error('Limited offer purchase failed:', err?.message||err);
      return fail(res, 500, 'Не удалось завершить покупку набора. Баланс и лимит проверены; попробуй ещё раз.');
    }
  });

  app.post('/api/inventory/:inventoryId/sell', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const inventoryId = String(req.params.inventoryId || '');
    const item = await dbFirst(db, `SELECT inv.id,inv.status,ci.title,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.id=? AND inv.telegram_id=?`, inventoryId, userId);
    if (!item || item.status !== 'owned') return fail(res, 409, 'Предмет не найден, уже продан или отправлен на вывод');
    const saleValue = Math.max(1, Math.floor(Number(item.value_stars || 0) * 0.7));
    const saleBatchId = id();
    // D1 batch is transactional; the unique sale id prevents duplicate credits on retries.
    const results = await db.batch([
      db.prepare(`UPDATE inventory SET status='sold',sale_batch_id=? WHERE id=? AND telegram_id=? AND status='owned'`).bind(saleBatchId, inventoryId, userId),
      db.prepare(`UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND EXISTS(SELECT 1 FROM inventory WHERE id=? AND telegram_id=? AND status='sold' AND sale_batch_id=?)`).bind(saleValue, userId, inventoryId, userId, saleBatchId),
      db.prepare(`DELETE FROM user_showcase_items WHERE telegram_id=? AND inventory_id=? AND EXISTS(SELECT 1 FROM inventory WHERE id=? AND sale_batch_id=?)`).bind(userId, inventoryId, inventoryId, saleBatchId)
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) === 0) return fail(res, 409, 'Предмет уже обрабатывается или продан');
    const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
    return json(res, 200, { ok:true, saleValue, balance:Number(user?.balance || 0), message:`Предмет продан за ${saleValue} кредитов` });
  });

  app.post('/api/inventory/sell-all', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id); const batchId = id();
    try {
      // A D1 batch is executed transactionally and in order. Only items still marked owned are included;
      // active marketplace listings and withdrawal requests are intentionally excluded.
      const result = await db.batch([
        db.prepare(`UPDATE inventory SET status='sold',sale_batch_id=? WHERE telegram_id=? AND status='owned'`).bind(batchId, userId),
        db.prepare(`UPDATE users SET balance=balance+COALESCE((SELECT SUM(MAX(1,CAST(ci.value_stars*0.7 AS INTEGER)))
          FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.sale_batch_id=?),0),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`).bind(userId, batchId, userId),
        db.prepare(`DELETE FROM user_showcase_items WHERE telegram_id=? AND inventory_id IN (SELECT id FROM inventory WHERE telegram_id=? AND sale_batch_id=?)`).bind(userId, userId, batchId)
      ]);
      const soldCount = Number(result?.[0]?.meta?.changes || 0);
      if (soldCount < 1) return fail(res, 409, 'Нет предметов в коллекции для продажи. Предметы на рынке и на выводе не затрагиваются.');
      const payout = await dbFirst(db, `SELECT COALESCE(SUM(MAX(1,CAST(ci.value_stars*0.7 AS INTEGER))),0) AS amount
        FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.sale_batch_id=?`, userId, batchId);
      const user = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', userId);
      return json(res, 200, {ok:true, soldCount, saleValue:Number(payout?.amount||0), balance:Number(user?.balance||0), message:`Продано предметов: ${soldCount}. Начислено ${Number(payout?.amount||0)} кредитов.`});
    } catch (err) {
      console.error('Sell-all failed:', err?.message || err);
      return fail(res, 500, 'Не удалось продать предметы. Попробуй обновить инвентарь и повторить.');
    }
  });

  app.get('/api/inventory', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id);
    const missingSerials = await dbAll(db, `SELECT inv.id,inv.item_id FROM inventory inv WHERE inv.telegram_id=? AND inv.status IN ('owned','withdraw_pending') AND inv.serial_number IS NULL ORDER BY inv.created_at,inv.id LIMIT 400`, userId).catch(() => []);
    for (const row of missingSerials) await ensureInventorySerial(db, row.id, row.item_id);
    const items = await dbAll(db, `SELECT inv.id AS inventory_id,inv.status,inv.source,inv.created_at,inv.background_key,inv.serial_number,inv.collection_id,ci.id AS item_id,ci.title,ci.image_url,ci.kind,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.status IN ('owned','withdraw_pending') ORDER BY inv.created_at DESC LIMIT 400`, userId);
    return json(res, 200, { ok: true, items });
  });

  // Public marketplace uses GiftCase's internal credits only; it never transfers Telegram Stars.
  app.get('/api/market/listings', async (req, res) => {
    const db = dbOf(req); const userId = String(req.user.telegram_id);
    const listings = await dbAll(db, `SELECT ml.id,ml.inventory_id,ml.seller_id,ml.price_credits,ml.status,ml.listed_at,
      u.username AS seller_username,u.first_name AS seller_first_name,
      inv.item_id,inv.background_key,inv.serial_number,ci.title,ci.image_url,ci.kind,ci.value_stars
      FROM market_listings ml JOIN inventory inv ON inv.id=ml.inventory_id JOIN case_items ci ON ci.id=inv.item_id
      JOIN users u ON u.telegram_id=ml.seller_id WHERE ml.status='active' AND inv.status='listed'
      ORDER BY ml.listed_at DESC LIMIT 100`);
    const myListings = await dbAll(db, `SELECT ml.id,ml.inventory_id,ml.seller_id,ml.price_credits,ml.status,ml.listed_at,
      inv.item_id,inv.background_key,inv.serial_number,ci.title,ci.image_url,ci.kind,ci.value_stars
      FROM market_listings ml JOIN inventory inv ON inv.id=ml.inventory_id JOIN case_items ci ON ci.id=inv.item_id
      WHERE ml.seller_id=? AND ml.status IN ('active','processing') ORDER BY ml.listed_at DESC LIMIT 100`, userId);
    return json(res, 200, {ok:true, listings: listings.map(row=>({...row,isMine:String(row.seller_id)===userId})), myListings});
  });

  app.post('/api/market/listings', async (req, res) => {
    const db=dbOf(req); const userId=String(req.user.telegram_id);
    const inventoryId=String(req.body?.inventoryId||'').trim(); const price=adminInteger(req.body?.priceCredits,1,1000000000);
    if(!inventoryId) return fail(res,400,'Выбери предмет из инвентаря');
    if(price===null) return fail(res,400,'Цена должна быть от 1 до 1 000 000 000 внутренних кредитов');
    const item=await dbFirst(db,`SELECT inv.id,inv.item_id,inv.status,ci.title FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.id=? AND inv.telegram_id=?`,inventoryId,userId);
    if(!item||item.status!=='owned') return fail(res,409,'Этот предмет нельзя выставить: он уже продан, выставлен или находится на выводе');
    const listingId=id();
    const changed=await dbRun(db,`UPDATE inventory SET status='listed' WHERE id=? AND telegram_id=? AND status='owned'`,inventoryId,userId);
    if((changed.meta?.changes||0)===0) return fail(res,409,'Предмет уже обрабатывается');
    try {
      await dbRun(db,`INSERT INTO market_listings(id,inventory_id,seller_id,price_credits,status,listed_at) VALUES(?,?,?,?, 'active', ?)`,listingId,inventoryId,userId,price,nowIso());
      return json(res,200,{ok:true,listingId,priceCredits:price,message:`«${item.title}» выставлен за ${price} кредитов.`});
    } catch(err) {
      await dbRun(db,`UPDATE inventory SET status='owned' WHERE id=? AND telegram_id=? AND status='listed'`,inventoryId,userId).catch(()=>{});
      if(String(err?.message||'').includes('UNIQUE')) return fail(res,409,'Этот предмет уже имеет активное объявление');
      console.error('Market listing create failed:',err?.message||err); return fail(res,500,'Не удалось создать объявление');
    }
  });

  app.post('/api/market/listings/:listingId/cancel', async (req,res)=>{
    const db=dbOf(req); const userId=String(req.user.telegram_id); const listingId=String(req.params.listingId||'');
    const listing=await dbFirst(db,`SELECT id,inventory_id,seller_id,status FROM market_listings WHERE id=?`,listingId);
    if(!listing||String(listing.seller_id)!==userId) return fail(res,404,'Объявление не найдено');
    if(listing.status!=='active') return fail(res,409,'Это объявление уже нельзя отменить');
    // First reserve the cancellation. A concurrent buyer can no longer move the listing to processing.
    const changed=await dbRun(db,`UPDATE market_listings SET status='cancelled',completed_at=? WHERE id=? AND seller_id=? AND status='active'`,nowIso(),listingId,userId);
    if((changed.meta?.changes||0)===0) return fail(res,409,'Объявление уже обрабатывается');
    const restored=await dbRun(db,`UPDATE inventory SET status='owned' WHERE id=? AND telegram_id=? AND status='listed'`,listing.inventory_id,userId);
    if((restored.meta?.changes||0)===0){
      await dbRun(db,`UPDATE market_listings SET status='active',completed_at=NULL WHERE id=? AND seller_id=? AND status='cancelled'`,listingId,userId).catch(()=>{});
      return fail(res,409,'Предмет уже обрабатывается или передан другому игроку');
    }
    return json(res,200,{ok:true,message:'Объявление отменено, подарок возвращён в инвентарь.'});
  });

  app.post('/api/market/listings/:listingId/buy', async (req,res)=>{
    const db=dbOf(req); const buyerId=String(req.user.telegram_id); const listingId=String(req.params.listingId||'');
    let listing=null; let reserved=false; let debited=false; let transferred=false; let sellerPaid=false; let committed=false;
    try {
      listing=await dbFirst(db,`SELECT ml.*,inv.item_id,inv.status AS inventory_status,ci.title FROM market_listings ml JOIN inventory inv ON inv.id=ml.inventory_id JOIN case_items ci ON ci.id=inv.item_id WHERE ml.id=?`,listingId);
      if(!listing||listing.status!=='active'||listing.inventory_status!=='listed') return fail(res,404,'Лот уже продан или снят с рынка');
      if(String(listing.seller_id)===buyerId) return fail(res,400,'Нельзя купить собственный лот');
      const reserve=await dbRun(db,`UPDATE market_listings SET status='processing' WHERE id=? AND status='active'`,listingId);
      if((reserve.meta?.changes||0)===0) return fail(res,409,'Другой игрок уже покупает этот лот');
      reserved=true;
      const price=Number(listing.price_credits); const debit=await dbRun(db,`UPDATE users SET balance=balance-?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND balance>=?`,price,buyerId,price);
      if((debit.meta?.changes||0)===0) { await dbRun(db,`UPDATE market_listings SET status='active' WHERE id=? AND status='processing'`,listingId); reserved=false; return fail(res,409,'Недостаточно внутренних кредитов ★'); }
      debited=true;
      const transfer=await dbRun(db,`UPDATE inventory SET telegram_id=?,status='owned' WHERE id=? AND telegram_id=? AND status='listed'`,buyerId,listing.inventory_id,listing.seller_id);
      if((transfer.meta?.changes||0)===0) throw new Error('Предмет больше не принадлежит продавцу');
      transferred=true;
      const fee=Math.floor(price*0.05); const sellerPayout=price-fee;
      await dbRun(db,`UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`,sellerPayout,listing.seller_id); sellerPaid=true;
      const finalized=await dbRun(db,`UPDATE market_listings SET status='sold',buyer_id=?,fee_credits=?,completed_at=? WHERE id=? AND status='processing'`,buyerId,fee,nowIso(),listingId);
      if((finalized.meta?.changes||0)===0) throw new Error('Не удалось завершить объявление');
      committed=true;
      // Keep sold items out of the seller's showcase; failure here must not undo a completed trade.
      await dbRun(db, 'DELETE FROM user_showcase_items WHERE telegram_id=? AND inventory_id=?', String(listing.seller_id), listing.inventory_id).catch(()=>{});
      return json(res,200,{ok:true,message:`Покупка успешна! «${listing.title}» теперь в твоём инвентаре.`,priceCredits:price,feeCredits:fee,sellerPayout});
    } catch(err) {
      if(!committed && listing) {
        const price=Number(listing.price_credits||0); const fee=Math.floor(price*0.05);
        if(sellerPaid) await dbRun(db,`UPDATE users SET balance=MAX(0,balance-?),updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`,price-fee,listing.seller_id).catch(()=>{});
        if(transferred) await dbRun(db,`UPDATE inventory SET telegram_id=?,status='listed' WHERE id=? AND telegram_id=? AND status='owned'`,listing.seller_id,listing.inventory_id,buyerId).catch(()=>{});
        if(debited) await dbRun(db,`UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`,price,buyerId).catch(()=>{});
        if(reserved) await dbRun(db,`UPDATE market_listings SET status='active' WHERE id=? AND status='processing'`,listingId).catch(()=>{});
      }
      console.error('Market purchase failed:',err?.message||err); return fail(res,500,'Не удалось завершить сделку. Баланс и предмет проверены; попробуй ещё раз.');
    }
  });

  app.post('/api/craft', async (req,res)=>{
    const db=dbOf(req); const userId=String(req.user.telegram_id); const raw=req.body?.inventoryIds;
    if(!Array.isArray(raw)||raw.length<2||raw.length>4) return fail(res,400,'Для крафта нужно выбрать от 2 до 4 одинаковых подарков');
    const inventoryIds=[...new Set(raw.map(v=>String(v||'').trim()).filter(Boolean))];
    if(inventoryIds.length!==raw.length) return fail(res,400,'Проверь список выбранных предметов');
    const placeholders=inventoryIds.map(()=>'?').join(',');
    const materials=await dbAll(db,`SELECT inv.id,inv.item_id,inv.status,inv.background_key,inv.serial_number,ci.title,ci.image_url,ci.kind,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.status='owned' AND inv.id IN (${placeholders})`,userId,...inventoryIds);
    if(materials.length!==inventoryIds.length) return fail(res,409,'Некоторые предметы уже проданы, выставлены на рынок или изменились');
    const itemId=materials[0].item_id;
    if(materials.some(row=>row.item_id!==itemId)) return fail(res,400,'Для крафта можно использовать только подарки одного типа');
    let resultInventoryId=null; let reservationCreated=false; let serial=null; const craftBatchId=id(); const background=rollCraftBackground(materials.length);
    try {
      const reserve=await dbRun(db,`UPDATE inventory SET status='consumed',craft_batch_id=? WHERE telegram_id=? AND status='owned' AND id IN (${placeholders})`,craftBatchId,userId,...inventoryIds);
      reservationCreated=Number(reserve.meta?.changes||0)>0;
      if(Number(reserve.meta?.changes||0)!==inventoryIds.length) throw new Error('Не удалось зарезервировать выбранные предметы: один из них уже обрабатывается');
      serial=await nextItemSerial(db,itemId); resultInventoryId=id();
      await dbRun(db,`INSERT INTO inventory(id,telegram_id,item_id,source,status,background_key,serial_number) VALUES(?,?,?,'craft','owned',?,?)`,resultInventoryId,userId,itemId,background,serial);
      await dbRun(db,`INSERT INTO craft_log(id,telegram_id,item_id,input_inventory_ids,output_inventory_id,background_key,serial_number,created_at) VALUES(?,?,?,?,?,?,?,?)`,id(),userId,itemId,JSON.stringify(inventoryIds),resultInventoryId,background,serial,nowIso());
      const output=await dbFirst(db,`SELECT inv.id AS inventory_id,inv.background_key,inv.serial_number,ci.id AS item_id,ci.title,ci.image_url,ci.kind,ci.value_stars FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.id=?`,resultInventoryId);
      await dbRun(db,`DELETE FROM user_showcase_items WHERE telegram_id=? AND inventory_id IN (${placeholders})`,userId,...inventoryIds);
      await dbRun(db,`UPDATE inventory SET craft_batch_id=NULL WHERE telegram_id=? AND status='consumed' AND craft_batch_id=?`,userId,craftBatchId);
      return json(res,200,{ok:true,item:output,background,serialNumber:serial,message:`Крафт завершён! Получен «${output.title}» #${serial} с фоном «${background}».`});
    } catch(err) {
      if(resultInventoryId) await dbRun(db,'DELETE FROM craft_log WHERE output_inventory_id=?',resultInventoryId).catch(()=>{});
      if(resultInventoryId) await dbRun(db,'DELETE FROM inventory WHERE id=?',resultInventoryId).catch(()=>{});
      if(reservationCreated) await dbRun(db,`UPDATE inventory SET status='owned',craft_batch_id=NULL WHERE telegram_id=? AND status='consumed' AND craft_batch_id=?`,userId,craftBatchId).catch(()=>{});
      console.error('Craft failed:',err?.message||err); return fail(res,500,err?.message||'Не удалось завершить крафт');
    }
  });

  app.get('/api/collections', async (req,res)=>{
    const db=dbOf(req); const userId=String(req.user.telegram_id); const now=nowIso();
    const collections=await dbAll(db,`SELECT * FROM seasonal_collections WHERE active=1 AND ends_at>? ORDER BY starts_at,title`,now);
    const data=[];
    for(const collection of collections){
      const rows=await dbAll(db,`SELECT sci.item_id,sci.is_secret,sci.is_required,ci.title,ci.image_url,ci.kind,ci.value_stars,
        (SELECT COUNT(*) FROM inventory inv WHERE inv.telegram_id=? AND inv.item_id=sci.item_id AND inv.status IN ('owned','listed')) AS owned_count
        FROM seasonal_collection_items sci JOIN case_items ci ON ci.id=sci.item_id WHERE sci.collection_id=? ORDER BY sci.is_required DESC,sci.is_secret,ci.title`,userId,collection.id);
      const required=rows.filter(x=>Number(x.is_required)===1); const completed=required.length>0&&required.every(x=>Number(x.owned_count)>0);
      const reward=await dbFirst(db,'SELECT claimed_at FROM user_collection_rewards WHERE telegram_id=? AND collection_id=?',userId,collection.id);
      data.push({...collection,items:rows.map(item=>{const hidden=Number(item.is_secret)===1&&Number(item.owned_count)===0;return {...item,title:hidden?'???':item.title,image_url:hidden?'gift-box.png':item.image_url,hidden,owned:Number(item.owned_count)>0};}),required_count:required.length,progress:required.filter(x=>Number(x.owned_count)>0).length,completed,claimed:Boolean(reward),is_live:String(collection.starts_at)<=now,can_claim:completed&&!reward&&String(collection.starts_at)<=now&&String(collection.ends_at)>now});
    }
    return json(res,200,{ok:true,collections:data});
  });

  app.post('/api/collections/:collectionId/claim', async (req,res)=>{
    const db=dbOf(req); const userId=String(req.user.telegram_id); const collectionId=String(req.params.collectionId||''); const now=nowIso();
    const collection=await dbFirst(db,`SELECT * FROM seasonal_collections WHERE id=? AND active=1 AND starts_at<=? AND ends_at>?`,collectionId,now,now);
    if(!collection) return fail(res,404,'Сезонная коллекция не активна');
    const required=await dbAll(db,`SELECT item_id FROM seasonal_collection_items WHERE collection_id=? AND is_required=1`,collectionId);
    if(!required.length) return fail(res,409,'В коллекции пока не настроены обязательные предметы');
    for(const row of required){const owned=await dbFirst(db,`SELECT id FROM inventory WHERE telegram_id=? AND item_id=? AND status IN ('owned','listed') LIMIT 1`,userId,row.item_id);if(!owned)return fail(res,409,'Коллекция ещё не собрана полностью');}
    const insert=await dbRun(db,`INSERT OR IGNORE INTO user_collection_rewards(telegram_id,collection_id,reward_title,reward_frame_key,claimed_at) VALUES(?,?,?,?,?)`,userId,collectionId,collection.reward_title,collection.reward_frame_key,now);
    if((insert.meta?.changes||0)===0) return fail(res,409,'Награда за эту коллекцию уже получена');
    return json(res,200,{ok:true,title:collection.reward_title,frameKey:collection.reward_frame_key,message:`Коллекция собрана! Получен титул «${collection.reward_title}» и рамка профиля.`});
  });

  async function buildShowcaseBundle(db, ownerId, includeEditor=false){
    const owner=await dbFirst(db,'SELECT telegram_id,username,first_name FROM users WHERE telegram_id=?',String(ownerId));
    if(!owner) return null;
    const current=await dbFirst(db,'SELECT showcase_title,frame_key,updated_at FROM user_showcases WHERE telegram_id=?',String(ownerId))||{showcase_title:'Коллекционер',frame_key:'default',updated_at:null};
    const items=await dbAll(db,`SELECT inv.id AS inventory_id,inv.item_id,inv.background_key,inv.serial_number,ci.title,ci.image_url,ci.kind,ci.value_stars
      FROM user_showcase_items usi JOIN inventory inv ON inv.id=usi.inventory_id JOIN case_items ci ON ci.id=inv.item_id
      WHERE usi.telegram_id=? AND inv.telegram_id=? AND inv.status='owned' ORDER BY usi.sort_order,usi.created_at LIMIT 6`,String(ownerId),String(ownerId));
    const unlockedRewards=await dbAll(db,'SELECT collection_id,reward_title,reward_frame_key,claimed_at FROM user_collection_rewards WHERE telegram_id=? ORDER BY claimed_at DESC',String(ownerId));
    const bundle={ok:true,profile:owner,showcase:current,items,unlockedRewards};
    if(includeEditor){bundle.availableItems=await dbAll(db,`SELECT inv.id AS inventory_id,inv.item_id,inv.background_key,inv.serial_number,ci.title,ci.image_url,ci.kind,ci.value_stars
      FROM inventory inv JOIN case_items ci ON ci.id=inv.item_id WHERE inv.telegram_id=? AND inv.status='owned' ORDER BY inv.created_at DESC LIMIT 300`,String(ownerId));}
    return bundle;
  }

  app.get('/api/showcase', async (req,res)=>{
    const userId=String(req.user.telegram_id); const bundle=await buildShowcaseBundle(dbOf(req),userId,true);
    return bundle ? json(res,200,{...bundle,isMine:true}) : fail(res,404,'Профиль не найден');
  });

  app.get('/api/showcase/:telegramId', async (req,res)=>{
    const targetId=String(req.params.telegramId||'');
    if(!/^\d{1,20}$/.test(targetId)) return fail(res,400,'Неверный ID игрока');
    const userId=String(req.user.telegram_id); const bundle=await buildShowcaseBundle(dbOf(req),targetId,targetId===userId);
    return bundle ? json(res,200,{...bundle,isMine:targetId===userId}) : fail(res,404,'Игрок не найден');
  });

  app.post('/api/showcase', async (req,res)=>{
    const db=dbOf(req); const userId=String(req.user.telegram_id); const rawIds=req.body?.inventoryIds;
    if(!Array.isArray(rawIds)||rawIds.length>6) return fail(res,400,'Можно закрепить не более 6 подарков');
    const inventoryIds=[...new Set(rawIds.map(v=>String(v||'').trim()).filter(Boolean))];
    if(inventoryIds.length!==rawIds.length) return fail(res,400,'Витрина содержит повторяющиеся или пустые предметы');
    if(inventoryIds.length){const placeholders=inventoryIds.map(()=>'?').join(',');const valid=await dbAll(db,`SELECT id FROM inventory WHERE telegram_id=? AND status='owned' AND id IN (${placeholders})`,userId,...inventoryIds);if(valid.length!==inventoryIds.length)return fail(res,409,'Выбран один или несколько предметов, которых уже нет в коллекции');}
    const title=String(req.body?.title||'Коллекционер').trim().slice(0,60); const frameKey=String(req.body?.frameKey||'default').trim();
    const rewards=await dbAll(db,'SELECT reward_title,reward_frame_key FROM user_collection_rewards WHERE telegram_id=?',userId);
    const validTitle=title==='Коллекционер'||rewards.some(r=>r.reward_title===title);
    const validFrame=frameKey==='default'||rewards.some(r=>r.reward_frame_key===frameKey);
    if(!validTitle||!validFrame)return fail(res,400,'Этот титул или рамка ещё не разблокированы');
    const statements=[
      db.prepare(`INSERT INTO user_showcases(telegram_id,showcase_title,frame_key,updated_at) VALUES(?,?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET showcase_title=excluded.showcase_title,frame_key=excluded.frame_key,updated_at=excluded.updated_at`).bind(userId,title,frameKey,nowIso()),
      db.prepare('DELETE FROM user_showcase_items WHERE telegram_id=?').bind(userId)
    ];
    for(let index=0;index<inventoryIds.length;index++) statements.push(db.prepare('INSERT INTO user_showcase_items(telegram_id,inventory_id,sort_order,created_at) VALUES(?,?,?,?)').bind(userId,inventoryIds[index],index,nowIso()));
    await db.batch(statements);
    const bundle=await buildShowcaseBundle(db,userId,true);
    return json(res,200,{...bundle,isMine:true,message:'Витрина сохранена'});
  });

  app.get('/api/live-wins', async (req, res) => {
    const wins = await dbAll(dbOf(req), `SELECT id,username,item_title,image_url,value_stars,created_at FROM live_wins ORDER BY id DESC LIMIT 18`);
    return json(res, 200, { ok: true, wins });
  });

  app.get('/api/subscription/status', async (req, res) => {
    try {
      if (req.query?.refresh === '1') { try { await dbRun(dbOf(req), 'DELETE FROM subscription_status_cache WHERE telegram_id=?', String(req.user.telegram_id)); } catch { /* cache table may not exist yet */ } }
      const subscribed = await requireSubscription(req, req.user.telegram_id);
      return json(res, 200, { ok: true, subscribed, channel: envOf(req).SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews' });
    } catch (err) { return json(res, 200, { ok: true, subscribed: false, channel: envOf(req).SUBSCRIPTION_CHANNEL || '@NftGiftCaseNews', error: `Не удалось проверить подписку. Убедитесь, что бот — администратор канала @NftGiftCaseNews. Причина: ${err.message}` }); }
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
      if (caseId === 'daily') await dbRun(db, `UPDATE user_quests SET progress=progress+1,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=? AND quest_id IN (SELECT quest_id FROM quest_trigger_rules WHERE trigger_event='daily_claim')`, userId);
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
    await notifyAdmin(envOf(req), text, { inline_keyboard: [
      [{ text: 'Написать пользователю', url: `https://t.me/${encodeURIComponent(user.username)}` }],
      [
        { text: '✅ Подтвердить вывод', callback_data: `withdraw_approve:${wid}` },
        { text: '❌ Отказать вывод', callback_data: `withdraw_reject:${wid}` }
      ]
    ] });
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
    const starRewards = await dbAll(db, `SELECT event_type,branch,level,amount FROM event_star_rewards ORDER BY event_type,branch,level`);
    const rewardMap = new Map(rewards.map(r => [`${r.event_type}:${r.branch}:${r.level}`, r]));
    const starRewardMap = new Map(starRewards.map(r => [`${r.event_type}:${r.branch}:${r.level}`, r]));
    const adventDefaults = ['daily-teddy','daily-rocket','daily-perfume','daily-ring'];
    const today = new Date();
    const isAdventSeason = today.getUTCMonth() === 11;
    const calendar = await Promise.all(Array.from({length:24}, async (_,i) => {
      const day = i + 1;
      const starReward = starRewardMap.get(`advent:advent:${day}`);
      if (starReward) return { day, title:`${Number(starReward.amount).toLocaleString('ru-RU')} ★`, reward_type:'credits', amount:Number(starReward.amount), image_url:'gift-box.png', unlocked:isAdventSeason && day <= today.getUTCDate() };
      const configured = rewardMap.get(`advent:advent:${day}`);
      const itemId = configured?.item_id || adventDefaults[(day - 1) % adventDefaults.length];
      const item = configured || await dbFirst(db, 'SELECT id AS item_id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
      return { day, title:item?.title || `Подарок ${day}`, reward_type:'gift', item_id:item?.item_id || itemId, image_url:item?.image_url || ['gift-box.png','nft-swan.png','rocket.png','perfume.png'][(day-1)%4], kind:item?.kind || 'gift', value_stars:item?.value_stars || 0, unlocked:isAdventSeason && day <= today.getUTCDate() };
    }));
    return json(res, 200, { ok:true, settings, progress:progress || { xp:0,premium_unlocked:0,claimed_free_levels:'[]',claimed_premium_levels:'[]' }, quests, calendar, rewards, starRewards });
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
    const starReward = await dbFirst(db, `SELECT amount FROM event_star_rewards WHERE event_type='battle_pass' AND branch=? AND level=?`, branch, level);
    if (starReward) {
      claimed.push(level);
      await dbRun(db, `UPDATE event_progress SET ${field}=?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?`, JSON.stringify(claimed), telegramId);
      await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', Number(starReward.amount), telegramId);
      const updatedUser = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', telegramId);
      return json(res, 200, { ok:true, rewardType:'credits', amount:Number(starReward.amount), balance:Number(updatedUser?.balance||0), message:`Получено ${Number(starReward.amount)} внутренних кредитов (★)` });
    }
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
    const starReward = await dbFirst(db, `SELECT amount FROM event_star_rewards WHERE event_type='advent' AND branch='advent' AND level=?`, day);
    if (starReward) {
      const claim = await dbRun(db, 'INSERT OR IGNORE INTO advent_claims(telegram_id,day) VALUES(?,?)', telegramId, day);
      if ((claim.meta?.changes || 0) === 0) return fail(res, 409, 'Вы уже открыли эту ячейку');
      await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', Number(starReward.amount), telegramId);
      await dbRun(db, 'UPDATE event_progress SET xp=xp+10,updated_at=CURRENT_TIMESTAMP WHERE telegram_id=?', telegramId);
      const updatedUser = await dbFirst(db, 'SELECT balance FROM users WHERE telegram_id=?', telegramId);
      return json(res, 200, { ok:true, rewardType:'credits', amount:Number(starReward.amount), balance:Number(updatedUser?.balance||0), message:`Получено ${Number(starReward.amount)} внутренних кредитов (★)` });
    }
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

  // Record successful admin mutations for the audit trail. Response is sent after the log write attempt.
  app.use('/api/admin', requireAdmin, (req, res, next) => {
    if (req.method === 'GET' || /(?:^|\/)broadcasts\/[^/]+\/process$/.test(req.path)) return next();
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      const status = Number(res.statusCode || 200);
      if (status >= 200 && status < 300 && payload?.ok !== false) {
        const details = {method:req.method, path:String(req.path||'').slice(0,180)};
        if (typeof req.body?.title === 'string') details.title = req.body.title.slice(0,80);
        if (typeof req.body?.code === 'string') details.code = req.body.code.slice(0,32);
        writeAdminAudit(dbOf(req), req.user?.telegram_id, adminActionLabel(req), details)
          .catch(() => {}).finally(() => originalJson(payload));
        return res;
      }
      return originalJson(payload);
    };
    next();
  });

  // Admin API: all write operations are protected server-side by Telegram ID.
  app.get('/api/admin/overview', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const [userCount, orders, withdrawals, cases, promos, rewardCatalog, quests, offers, broadcasts, auditLogs] = await Promise.all([
      dbFirst(db, 'SELECT COUNT(*) AS n FROM users'),
      dbAll(db, 'SELECT id,telegram_id,order_type,amount_xtr,status,created_at,paid_at FROM orders ORDER BY created_at DESC LIMIT 30'),
      dbAll(db, `SELECT w.id,w.status,w.created_at,u.telegram_id,u.username,ci.title AS item_title FROM withdrawals w JOIN users u ON u.telegram_id=w.telegram_id JOIN inventory inv ON inv.id=w.inventory_id JOIN case_items ci ON ci.id=inv.item_id ORDER BY w.created_at DESC LIMIT 30`),
      dbAll(db, `SELECT c.* FROM cases c WHERE c.id NOT IN ('daily','nft-mini','crate-blue','crate-orange','legend') ORDER BY c.sort_order,c.created_at`),
      dbAll(db, 'SELECT * FROM promo_codes ORDER BY created_at DESC LIMIT 30'),
      dbAll(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items ORDER BY title,id'),
      dbAll(db, `SELECT q.id,q.title,q.description,q.target,q.reward_xp,q.active,COALESCE(t.trigger_event,'manual') AS trigger_event FROM quests q LEFT JOIN quest_trigger_rules t ON t.quest_id=q.id ORDER BY q.id`),
      dbAll(db, `SELECT o.*,ci.title AS reward_item_title FROM limited_offers o LEFT JOIN case_items ci ON ci.id=o.reward_item_id ORDER BY o.created_at DESC LIMIT 50`),
      dbAll(db, `SELECT id,message_text,status,recipient_count,sent_count,failed_count,created_at,updated_at FROM admin_broadcasts ORDER BY created_at DESC LIMIT 10`),
      dbAll(db, 'SELECT id,admin_telegram_id,action,details,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 30')
    ]);
    const detailedCases = await Promise.all(cases.map(async c => ({
      ...c,
      items: await dbAll(db, 'SELECT id,title,image_url,kind,value_stars,weight,stock_limit,awarded_count FROM case_items WHERE case_id=? ORDER BY created_at,id', c.id)
    })));
    const collections = await dbAll(db, `SELECT sc.*,COUNT(sci.item_id) AS item_count,
      SUM(CASE WHEN sci.is_required=1 THEN 1 ELSE 0 END) AS required_count,
      SUM(CASE WHEN sci.is_secret=1 THEN 1 ELSE 0 END) AS secret_count
      FROM seasonal_collections sc LEFT JOIN seasonal_collection_items sci ON sci.collection_id=sc.id
      GROUP BY sc.id ORDER BY sc.created_at DESC LIMIT 50`);
    const event = await dbFirst(db, 'SELECT * FROM event_settings WHERE id=1') || { id:1,enabled:0,event_type:'battle_pass',title:'Halloween Pass',ends_at:null,premium_price_xtr:PREMIUM_PASS_PRICE };
    return json(res, 200, { ok:true, userCount:userCount?.n || 0, orders, withdrawals, cases:detailedCases, promos, event, rewardCatalog, quests, offers, broadcasts, auditLogs, collections });
  });

  // Admin creator for seasonal collections; secret items are optional and remain hidden until collected.
  app.post('/api/admin/collections', requireAdmin, async (req,res)=>{
    const db=dbOf(req); const body=req.body||{};
    const title=String(body.title||'').trim().slice(0,80); const description=String(body.description||'').trim().slice(0,240);
    const imageUrl=normalizeImageUrl(body.imageUrl||'case-halloween.png')||'case-halloween.png';
    const startsRaw=String(body.startsAt||''); const endsRaw=String(body.endsAt||''); const startMs=Date.parse(startsRaw); const endMs=Date.parse(endsRaw);
    const itemIds=Array.isArray(body.itemIds)?[...new Set(body.itemIds.map(v=>String(v||'').trim()).filter(Boolean))]:[];
    const secretItemId=String(body.secretItemId||'').trim();
    const rewardTitle=String(body.rewardTitle||'Коллекционер').trim().slice(0,60);
    const frameKey=String(body.frameKey||'seasonal-frame').trim().toLowerCase(); const active=body.active?1:0;
    if(title.length<3) return fail(res,400,'Название коллекции должно содержать минимум 3 символа');
    if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||startMs>=endMs) return fail(res,400,'Проверь даты начала и окончания коллекции');
    if(itemIds.length<2||itemIds.length>20) return fail(res,400,'Выбери от 2 до 20 разных предметов коллекции');
    if(secretItemId&&!itemIds.includes(secretItemId)) return fail(res,400,'Секретный предмет должен входить в выбранные предметы коллекции');
    if(!rewardTitle) return fail(res,400,'Укажи титул за коллекцию');
    if(!/^[a-z0-9_-]{2,40}$/.test(frameKey)) return fail(res,400,'ID рамки должен состоять из латинских букв, цифр, _ или -');
    const placeholders=itemIds.map(()=>'?').join(',');
    const found=await dbAll(db,`SELECT id FROM case_items WHERE id IN (${placeholders})`,...itemIds);
    if(found.length!==itemIds.length) return fail(res,400,'Один или несколько предметов больше не доступны в каталоге');
    if(itemIds.filter(itemId=>itemId!==secretItemId).length<2) return fail(res,400,'Нужно минимум 2 обязательных предмета помимо секретного');
    const collectionId=`season-${id()}`; const startsAt=new Date(startMs).toISOString(); const endsAt=new Date(endMs).toISOString();
    await dbRun(db,`INSERT INTO seasonal_collections(id,title,description,image_url,starts_at,ends_at,reward_title,reward_frame_key,active,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,collectionId,title,description,imageUrl,startsAt,endsAt,rewardTitle,frameKey,active,String(req.user?.telegram_id||''),nowIso(),nowIso());
    for(const itemId of itemIds) await dbRun(db,`INSERT INTO seasonal_collection_items(collection_id,item_id,is_secret,is_required) VALUES(?,?,?,?)`,collectionId,itemId,itemId===secretItemId?1:0,itemId===secretItemId?0:1);
    return json(res,200,{ok:true,collection:{id:collectionId,title,description,image_url:imageUrl,starts_at:startsAt,ends_at:endsAt,reward_title:rewardTitle,reward_frame_key:frameKey,active,item_count:itemIds.length,secret_count:secretItemId?1:0},message:'Сезонная коллекция создана'});
  });

  app.patch('/api/admin/collections/:collectionId/status', requireAdmin, async (req,res)=>{
    const db=dbOf(req); const active=req.body?.active?1:0; const collectionId=String(req.params.collectionId||'');
    const result=await dbRun(db,'UPDATE seasonal_collections SET active=?,updated_at=? WHERE id=?',active,nowIso(),collectionId);
    if((result.meta?.changes||0)===0) return fail(res,404,'Сезонная коллекция не найдена');
    return json(res,200,{ok:true,active:!!active,message:active?'Коллекция включена':'Коллекция отключена'});
  });

  // Create or update a time-limited offer. Price is paid with internal app credits (★), not Telegram Stars.
  app.post('/api/admin/offers', requireAdmin, async (req, res) => {
    const db=dbOf(req); const body=req.body||{};
    const title=String(body.title||'').trim().slice(0,70); const description=String(body.description||'').trim().slice(0,220);
    const imageUrl=normalizeImageUrl(body.imageUrl||'gift-box.png')||'gift-box.png';
    const price=adminInteger(body.priceCredits,0,1000000);
    const startsAtRaw=String(body.startsAt||''); const endsAtRaw=String(body.endsAt||'');
    const startsMs=Date.parse(startsAtRaw); const endsMs=Date.parse(endsAtRaw);
    const maxRaw=body.maxPurchases; const maxPurchases=maxRaw===''||maxRaw===null||maxRaw===undefined?null:adminInteger(maxRaw,1,100000000);
    const perUserRaw=body.perUserLimit; const perUserLimit=perUserRaw===''||perUserRaw===null||perUserRaw===undefined?1:adminInteger(perUserRaw,1,1000000);
    const rewardItemId=String(body.rewardItemId||'').trim()||null; const rewardCredits=body.rewardCredits===''||body.rewardCredits===null||body.rewardCredits===undefined?0:adminInteger(body.rewardCredits,0,1000000);
    const active=body.active?1:0;
    if(title.length<3) return fail(res,400,'Название предложения должно содержать минимум 3 символа');
    if(price===null) return fail(res,400,'Цена должна быть целым числом от 0 до 1 000 000 внутренних кредитов');
    if(!Number.isFinite(startsMs)||!Number.isFinite(endsMs)||startsMs>=endsMs) return fail(res,400,'Укажи корректные дату начала и дату окончания; окончание должно быть позже начала');
    if(maxRaw!==''&&maxRaw!==null&&maxRaw!==undefined&&maxPurchases===null) return fail(res,400,'Общий лимит должен быть от 1 до 100 000 000');
    if(perUserLimit===null) return fail(res,400,'Лимит на игрока должен быть от 1 до 1 000 000');
    if(rewardCredits===null) return fail(res,400,'Бонусные кредиты должны быть от 0 до 1 000 000');
    if(!rewardItemId&&rewardCredits<1) return fail(res,400,'Добавь награду: выбери подарок или укажи бонусные кредиты');
    if(rewardItemId&&!await dbFirst(db,'SELECT id FROM case_items WHERE id=?',rewardItemId)) return fail(res,404,'Выбранный предмет не найден');
    const offerId=String(body.id||'').trim()||`offer-${id()}`;
    if(body.id){
      const current=await dbFirst(db,'SELECT id,sold_count FROM limited_offers WHERE id=?',offerId);
      if(!current) return fail(res,404,'Предложение не найдено');
      if(maxPurchases!==null&&maxPurchases<Number(current.sold_count||0)) return fail(res,400,'Общий лимит не может быть меньше уже проданного количества');
      await dbRun(db,`UPDATE limited_offers SET title=?,description=?,image_url=?,price_credits=?,starts_at=?,ends_at=?,max_purchases=?,per_user_limit=?,reward_item_id=?,reward_credits=?,active=?,updated_at=? WHERE id=?`,title,description,imageUrl,price,new Date(startsMs).toISOString(),new Date(endsMs).toISOString(),maxPurchases,perUserLimit,rewardItemId,rewardCredits,active,nowIso(),offerId);
    } else {
      await dbRun(db,`INSERT INTO limited_offers(id,title,description,image_url,price_credits,starts_at,ends_at,max_purchases,per_user_limit,sold_count,reward_item_id,reward_credits,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?, ?,?)`,offerId,title,description,imageUrl,price,new Date(startsMs).toISOString(),new Date(endsMs).toISOString(),maxPurchases,perUserLimit,rewardItemId,rewardCredits,active,nowIso(),nowIso());
    }
    const offer=await dbFirst(db,'SELECT o.*,ci.title AS reward_item_title FROM limited_offers o LEFT JOIN case_items ci ON ci.id=o.reward_item_id WHERE o.id=?',offerId);
    return json(res,200,{ok:true,offer,message:body.id?'Предложение сохранено':'Предложение создано'});
  });

  app.patch('/api/admin/offers/:offerId/status', requireAdmin, async (req,res)=>{
    const db=dbOf(req); const active=req.body?.active?1:0; const offerId=String(req.params.offerId||'');
    const result=await dbRun(db,'UPDATE limited_offers SET active=?,updated_at=? WHERE id=?',active,nowIso(),offerId);
    if((result.meta?.changes||0)===0) return fail(res,404,'Предложение не найдено');
    return json(res,200,{ok:true,active:!!active,message:active?'Предложение включено':'Предложение отключено'});
  });

  app.post('/api/admin/broadcasts', requireAdmin, async (req,res)=>{
    const db=dbOf(req); const messageText=String(req.body?.message||'').trim(); const withAppButton=req.body?.withAppButton?1:0;
    if(messageText.length<2) return fail(res,400,'Напиши текст рассылки');
    if(messageText.length>3500) return fail(res,400,'Текст рассылки должен быть не длиннее 3500 символов');
    const activeBroadcast=await dbFirst(db,`SELECT id FROM admin_broadcasts WHERE status='sending' LIMIT 1`);
    if(activeBroadcast) return fail(res,409,'Уже идёт другая рассылка. Продолжи или заверши её прежде, чем создавать новую.');
    const count=Number((await dbFirst(db,'SELECT COUNT(*) AS n FROM users'))?.n||0);
    if(count<1) return fail(res,409,'В базе пока нет зарегистрированных игроков');
    const broadcastId=id(); const timestamp=nowIso();
    await dbRun(db,`INSERT INTO admin_broadcasts(id,message_text,with_app_button,status,recipient_count,sent_count,failed_count,created_at,updated_at) VALUES(?,?,?,'sending',?,0,0,?,?)`,broadcastId,messageText,withAppButton,count,timestamp,timestamp);
    await dbRun(db,`INSERT OR IGNORE INTO admin_broadcast_recipients(broadcast_id,telegram_id,status) SELECT ?,telegram_id,'pending' FROM users`,broadcastId);
    const actual=Number((await dbFirst(db,'SELECT COUNT(*) AS n FROM admin_broadcast_recipients WHERE broadcast_id=?',broadcastId))?.n||0);
    await dbRun(db,'UPDATE admin_broadcasts SET recipient_count=?,status=?,updated_at=? WHERE id=?',actual,actual?'sending':'completed',nowIso(),broadcastId);
    return json(res,200,{ok:true,broadcastId,recipientCount:actual,status:actual?'sending':'completed',message:`Рассылка создана для ${actual} пользователей. Начинаю отправку небольшими пакетами.`});
  });

  app.post('/api/admin/broadcasts/:broadcastId/process', requireAdmin, async (req,res)=>{
    const db=dbOf(req); const env=envOf(req); const broadcastId=String(req.params.broadcastId||'');
    const broadcast=await dbFirst(db,'SELECT * FROM admin_broadcasts WHERE id=?',broadcastId);
    if(!broadcast) return fail(res,404,'Рассылка не найдена');
    if(broadcast.status==='completed') return json(res,200,{ok:true,status:'completed',sent:Number(broadcast.sent_count||0),failed:Number(broadcast.failed_count||0),remaining:0});
    const recipients=await dbAll(db,`SELECT telegram_id FROM admin_broadcast_recipients WHERE broadcast_id=? AND status='pending' ORDER BY telegram_id LIMIT 10`,broadcastId);
    for(const recipient of recipients){
      try{
        const replyMarkup=Number(broadcast.with_app_button)===1&&env.PUBLIC_APP_URL?{inline_keyboard:[[{text:'🎁 Открыть GiftCase',web_app:{url:env.PUBLIC_APP_URL}}]]}:undefined;
        await telegramCall(env,'sendMessage',{chat_id:recipient.telegram_id,text:broadcast.message_text,...(replyMarkup?{reply_markup:replyMarkup}:{})});
        await dbRun(db,`UPDATE admin_broadcast_recipients SET status='sent',sent_at=? WHERE broadcast_id=? AND telegram_id=? AND status='pending'`,nowIso(),broadcastId,recipient.telegram_id);
      }catch(err){
        await dbRun(db,`UPDATE admin_broadcast_recipients SET status='failed',error_text=?,sent_at=? WHERE broadcast_id=? AND telegram_id=? AND status='pending'`,String(err?.message||'Telegram delivery failed').slice(0,180),nowIso(),broadcastId,recipient.telegram_id);
      }
    }
    const counts=await dbFirst(db,`SELECT SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending FROM admin_broadcast_recipients WHERE broadcast_id=?`,broadcastId);
    const status=Number(counts?.pending||0)>0?'sending':'completed';
    await dbRun(db,'UPDATE admin_broadcasts SET sent_count=?,failed_count=?,status=?,updated_at=? WHERE id=?',Number(counts?.sent||0),Number(counts?.failed||0),status,nowIso(),broadcastId);
    return json(res,200,{ok:true,status,sent:Number(counts?.sent||0),failed:Number(counts?.failed||0),remaining:Number(counts?.pending||0),batchProcessed:recipients.length});
  });

  app.post('/api/admin/cases', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 180);
    const imageUrl = normalizeImageUrl(req.body?.imageUrl);
    const isFree = Boolean(req.body?.isFree);
    const price = isFree ? 0 : adminInteger(req.body?.priceXtr, 1, 1000000);
    const maxRaw = req.body?.maxOpens;
    const maxOpens = maxRaw === '' || maxRaw === null || maxRaw === undefined ? null : adminInteger(maxRaw, 1, 100000000);
    if (title.length < 2 || title.length > 48) return fail(res, 400, 'Название кейса должно содержать от 2 до 48 символов');
    if (!imageUrl) return fail(res, 400, 'Выбери корректную обложку кейса');
    if (price === null) return fail(res, 400, 'Цена открытия должна быть от 1 до 1 000 000 Stars');
    if (maxRaw !== '' && maxRaw !== null && maxRaw !== undefined && maxOpens === null) return fail(res, 400, 'Лимит открытий должен быть положительным целым числом');
    const caseId = `custom-${id().replaceAll('-', '').slice(0, 16)}`;
    const sort = Number((await dbFirst(db, 'SELECT COALESCE(MAX(sort_order),0)+10 AS next_sort FROM cases'))?.next_sort || 100);
    await dbRun(db, `INSERT INTO cases(id,title,description,image_url,price_xtr,is_free,active,max_opens,sort_order) VALUES(?,?,?,?,?,?,0,?,?)`, caseId, title, description, imageUrl, price, isFree ? 1 : 0, maxOpens, sort);
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
    if (req.body?.isFree !== undefined) { updates.push('is_free=?'); args.push(req.body.isFree ? 1 : 0); }
    if (req.body?.priceXtr !== undefined) {
      const price = (req.body?.isFree === true || (req.body?.isFree === undefined && Number(c.is_free) === 1)) && Number(req.body.priceXtr) === 0 ? 0 : adminInteger(req.body.priceXtr, 1, 1000000);
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

  app.patch('/api/admin/theme', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const theme = String(req.body?.theme || '').trim();
    if (!['normal', 'halloween'].includes(theme)) return fail(res, 400, 'Выбери обычную или Halloween-тему');
    try {
      await dbRun(db, `INSERT INTO app_theme_settings(id,theme,updated_at,updated_by) VALUES(1,?,CURRENT_TIMESTAMP,?)
        ON CONFLICT(id) DO UPDATE SET theme=excluded.theme,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by`, theme, String(req.user?.telegram_id || ''));
      const saved = await dbFirst(db, 'SELECT theme,updated_at FROM app_theme_settings WHERE id=1');
      return json(res, 200, { ok:true, theme:saved?.theme === 'halloween' ? 'halloween' : 'normal', updatedAt:saved?.updated_at || null, message:theme === 'halloween' ? 'Halloween-оформление включено для всех игроков' : 'Обычное оформление восстановлено для всех игроков' });
    } catch (err) {
      console.error('Theme save failed:', err?.stack || err);
      return fail(res, 500, 'Не удалось сохранить тему. Примени миграцию db/0007_halloween_theme.sql к удалённой D1-базе и повтори попытку.');
    }
  });

  app.patch('/api/admin/global-display', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    try {
      const messageTitle = String(req.body?.messageTitle || 'Новости NftGiftCase').trim().slice(0, 70);
      const messageBody = String(req.body?.messageBody || '').trim().slice(0, 260);
      // Do not reject the entire save when the message is blank: save the timer independently.
      const messageEnabled = req.body?.messageEnabled && messageBody ? 1 : 0;
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
    const rewardType = req.body?.rewardType === 'credits' ? 'credits' : 'gift';
    const amount = rewardType === 'credits' ? adminInteger(req.body?.amount, 1, 1000000) : null;
    const itemId = String(req.body?.itemId || '').trim();
    const validBranch = eventType === 'advent' ? branch === 'advent' : ['free','premium'].includes(branch);
    if (!validBranch) return fail(res, 400, 'Неверная ветка наград для выбранного события');
    if (level === null) return fail(res, 400, eventType === 'advent' ? 'День должен быть от 1 до 24' : 'Уровень должен быть от 1 до 30');
    if (rewardType === 'credits') {
      if (amount === null) return fail(res, 400, 'Количество внутренних кредитов должно быть от 1 до 1 000 000');
      await dbRun(db, 'DELETE FROM event_rewards WHERE event_type=? AND branch=? AND level=?', eventType, branch, level);
      await dbRun(db, `INSERT INTO event_star_rewards(event_type,branch,level,amount,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(event_type,branch,level) DO UPDATE SET amount=excluded.amount,updated_at=CURRENT_TIMESTAMP`, eventType, branch, level, amount);
      return json(res, 200, { ok:true, eventType, branch, level, rewardType:'credits', amount, message:`Награда сохранена: ${amount} внутренних кредитов (★)` });
    }
    const item = await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
    if (!item) return fail(res, 404, 'Выбранный подарок не найден в каталоге');
    await dbRun(db, 'DELETE FROM event_star_rewards WHERE event_type=? AND branch=? AND level=?', eventType, branch, level);
    await dbRun(db, `INSERT INTO event_rewards(event_type,branch,level,item_id,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(event_type,branch,level) DO UPDATE SET item_id=excluded.item_id,updated_at=CURRENT_TIMESTAMP`, eventType,branch,level,itemId);
    return json(res, 200, { ok:true, eventType, branch, level, rewardType:'gift', item });
  });

  // Admin quest editor. Existing progress is preserved; all current users receive a row for a new quest.
  app.post('/api/admin/quests', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const questId = String(req.body?.id || '').trim().toLowerCase();
    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 220);
    const target = adminInteger(req.body?.target, 1, 100000);
    const rewardXp = adminInteger(req.body?.rewardXp, 1, 100000);
    const triggerEvent = ['case_open','daily_claim','referral','manual'].includes(String(req.body?.triggerEvent)) ? String(req.body.triggerEvent) : 'manual';
    const active = req.body?.active ? 1 : 0;
    if (!/^[a-z0-9_-]{2,40}$/.test(questId)) return fail(res, 400, 'ID квеста: латинские буквы, цифры, _ и -, длина 2–40');
    if (title.length < 2 || title.length > 80 || !description) return fail(res, 400, 'Название и описание квеста обязательны');
    if (target === null || rewardXp === null) return fail(res, 400, 'Цель и награда XP должны быть в диапазоне 1–100 000');
    await dbRun(db, `INSERT INTO quests(id,title,description,target,reward_xp,active) VALUES(?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,target=excluded.target,reward_xp=excluded.reward_xp,active=excluded.active`, questId,title,description,target,rewardXp,active);
    await dbRun(db, 'INSERT OR IGNORE INTO user_quests(telegram_id,quest_id) SELECT telegram_id,? FROM users', questId);
    await dbRun(db, `INSERT INTO quest_trigger_rules(quest_id,trigger_event) VALUES(?,?) ON CONFLICT(quest_id) DO UPDATE SET trigger_event=excluded.trigger_event`, questId, triggerEvent);
    const quest = await dbFirst(db, `SELECT q.id,q.title,q.description,q.target,q.reward_xp,q.active,COALESCE(t.trigger_event,'manual') AS trigger_event FROM quests q LEFT JOIN quest_trigger_rules t ON t.quest_id=q.id WHERE q.id=?`, questId);
    return json(res, 200, { ok:true, quest });
  });

  // Admin Abuse / global reward drop: grants selected internal credits and/or a selected item to all registered users.
  app.post('/api/admin/rewards/all', requireAdmin, async (req, res) => {
    const db = dbOf(req);
    const itemId = String(req.body?.itemId || '').trim();
    const hasAmount = req.body?.amount !== undefined && req.body?.amount !== null && req.body?.amount !== '';
    const amount = hasAmount ? adminInteger(req.body.amount, 1, 1000000) : null;
    if (!itemId && !hasAmount) return fail(res, 400, 'Выбери подарок, количество кредитов или оба варианта');
    if (hasAmount && amount === null) return fail(res, 400, 'Сумма кредитов должна быть от 1 до 1 000 000');
    const userCount = Number((await dbFirst(db, 'SELECT COUNT(*) AS n FROM users'))?.n || 0);
    if (userCount < 1) return fail(res, 409, 'Пока нет зарегистрированных игроков');
    let item = null; let awarded = 0;
    if (itemId) {
      item = await dbFirst(db, 'SELECT id,title,image_url,kind,value_stars FROM case_items WHERE id=?', itemId);
      if (!item) return fail(res, 404, 'Выбранный подарок не найден в каталоге');
    }
    if (amount !== null) await dbRun(db, 'UPDATE users SET balance=balance+?,updated_at=CURRENT_TIMESTAMP', amount);
    if (item) {
      const inserted = await dbRun(db, `INSERT INTO inventory(id,telegram_id,item_id,source,status)
        SELECT lower(hex(randomblob(16))),telegram_id,?,'admin_global','owned' FROM users`, item.id);
      awarded = Number(inserted.meta?.changes || userCount);
      await dbRun(db, 'UPDATE case_items SET awarded_count=awarded_count+? WHERE id=?', awarded, item.id);
    }
    return json(res, 200, { ok:true, recipients:userCount, balancePerUser:amount || 0, item:item ? { ...item } : null, giftsAwarded:awarded, message:`Глобальная раздача завершена: игроков ${userCount}${amount ? `, начислено ${amount} кредитов каждому` : ''}${item ? `, подарок «${item.title}» выдан каждому` : ''}.` });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled API error:', err?.stack || err);
    if (res.headersSent) return next(err);
    return fail(res, 500, 'Внутренняя ошибка сервера');
  });
  return app;
}
