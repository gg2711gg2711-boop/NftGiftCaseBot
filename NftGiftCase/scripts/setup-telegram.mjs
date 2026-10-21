const token = process.env.BOT_TOKEN;
const appUrl = process.env.PUBLIC_APP_URL;
const webhookUrl = process.env.WEBHOOK_URL;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !appUrl || !webhookUrl || !webhookSecret) {
  console.error('Set BOT_TOKEN, PUBLIC_APP_URL, WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET before running this script.');
  process.exit(1);
}
if (!/^https:\/\//.test(appUrl) || !/^https:\/\//.test(webhookUrl)) {
  console.error('PUBLIC_APP_URL and WEBHOOK_URL must be HTTPS URLs.');
  process.exit(1);
}
if (!/^[A-Za-z0-9_-]{1,256}$/.test(webhookSecret)) {
  console.error('TELEGRAM_WEBHOOK_SECRET must contain only A-Z, a-z, 0-9, _ or - and be at most 256 chars.');
  process.exit(1);
}

async function call(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${method}: ${result.description || response.status}`);
  return result.result;
}

try {
  const webhook = await call('setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret,
    allowed_updates: ['message', 'pre_checkout_query'],
    drop_pending_updates: false
  });
  console.log('Webhook configured:', webhook);
  const menu = await call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Открыть NftGiftCase', web_app: { url: appUrl } }
  });
  console.log('Chat menu button configured:', menu);
  await call('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть NftGiftCase' },
      { command: 'help', description: 'Помощь по приложению' },
      { command: 'paysupport', description: 'Поддержка по платежам Stars' }
    ]
  });
  console.log('Bot commands configured. Open the bot and send /start to verify.');
} catch (error) {
  console.error('Telegram setup failed:', error.message);
  process.exit(1);
}
