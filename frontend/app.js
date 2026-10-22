(() => {
  'use strict';
  const cfg = window.NGC_CONFIG || { apiBase: '', mockMode: true };
  const API_BASE = String(cfg.apiBase || '').replace(/\/$/, '');
  const MOCK = Boolean(cfg.mockMode) || !API_BASE;
  const tg = window.Telegram?.WebApp;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const S = {
    view: 'home', filter: 'all', search: '', catalogFilter: 'all', catalogSearch: '', cases: [], currentCase: null, quantity: 1,
    balance: 0, user: null, isAdmin: false, inventory: [], wins: [], config: {}, eventData: null,
    adminOverview: null, selectedTarget: null, upgradeBet: 5, upgradeMultiplier: 2, muted: localStorage.getItem('ngc-muted') === '1',
    demoInventory: [], lastSpin: null, caseSort: false
  };
  const mockItems = [
    { id: 'daily-teddy', title: 'Плюшевый мишка', image_url: 'teddy.png', kind: 'gift', value_stars: 5, weight: 52 },
    { id: 'daily-rocket', title: 'Rocket', image_url: 'rocket.png', kind: 'gift', value_stars: 8, weight: 30 },
    { id: 'daily-perfume', title: 'Perfume Bottle', image_url: 'perfume.png', kind: 'gift', value_stars: 15, weight: 14 },
    { id: 'daily-ring', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 30, weight: 4 },
  ];
  const mockCases = [
    { id: 'daily', title: 'Подарок дня', description: 'Бесплатный ежедневный подарок', image_url: 'gift-box.png', price_xtr: 0, is_free: 1, active: 1, items: mockItems },
    { id: 'nft-mini', title: 'NFT-кейс', description: 'Коллекция цифровых подарков', image_url: 'nft-swan.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'nft-swan-item', title: 'Pink Swan', image_url: 'nft-swan.png', kind: 'nft', value_stars: 60, weight: 52 },
      { id: 'nft-perfume-item', title: 'Perfume Bottle', image_url: 'perfume.png', kind: 'gift', value_stars: 85, weight: 28 },
      { id: 'nft-ring-item', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 140, weight: 16 },
      { id: 'nft-rocket-item', title: 'Rocket', image_url: 'rocket.png', kind: 'gift', value_stars: 390, weight: 4 },
    ]},
    { id: 'rich-case', title: 'Rich Case', description: 'Золотая коллекция предметов', image_url: 'case-rich.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'rich-ring', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 190, weight: 60 }, { id: 'rich-perfume', title: 'Perfume Bottle', image_url: 'perfume.png', kind: 'gift', value_stars: 430, weight: 30 }, { id: 'rich-swan', title: 'Pink Swan', image_url: 'nft-swan.png', kind: 'nft', value_stars: 1800, weight: 10 }
    ]},
    { id: 'durov-case', title: 'Durov Case', description: 'Коллекция в стиле Telegram', image_url: 'case-durov.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'durov-rocket', title: 'Rocket', image_url: 'rocket.png', kind: 'gift', value_stars: 25, weight: 50 }, { id: 'durov-ring', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 430, weight: 35 }, { id: 'durov-swan', title: 'Pink Swan', image_url: 'nft-swan.png', kind: 'nft', value_stars: 1800, weight: 15 }
    ]},
    { id: 'march-8-case', title: '8 March Case', description: 'Праздничная коллекция', image_url: 'case-march-8.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'march-rose', title: 'Роза', image_url: 'gift-rose.png', kind: 'gift', value_stars: 10, weight: 60 }, { id: 'march-heart', title: 'Сердце', image_url: 'gift-heart.png', kind: 'gift', value_stars: 15, weight: 30 }, { id: 'march-cake', title: 'Торт', image_url: 'gift-cake.png', kind: 'gift', value_stars: 40, weight: 10 }
    ]},
    { id: 'halloween-case', title: 'Halloween Case', description: 'Мрачная коллекция подарков', image_url: 'case-halloween.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'halloween-bear', title: 'Мишка', image_url: 'gift-bear-holiday.png', kind: 'gift', value_stars: 10, weight: 60 }, { id: 'halloween-ring', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 430, weight: 30 }, { id: 'halloween-swan', title: 'Pink Swan', image_url: 'nft-swan.png', kind: 'nft', value_stars: 1800, weight: 10 }
    ]},
    { id: 'daily-case', title: 'Daily Case', description: 'Ежедневная коллекция подарков', image_url: 'case-daily.png', price_xtr: 39, is_free: 0, active: 1, items: [
      { id: 'dc-teddy', title: 'Плюшевый мишка', image_url: 'teddy.png', kind: 'gift', value_stars: 5, weight: 55 }, { id: 'dc-rose', title: 'Роза', image_url: 'gift-rose.png', kind: 'gift', value_stars: 10, weight: 35 }, { id: 'dc-ring', title: 'Blue Ring', image_url: 'ring.png', kind: 'nft', value_stars: 190, weight: 10 }
    ]}
  ];
  const mockWins = [
    { id: 1, username: 'alex_07', item_title: 'Blue Ring', image_url: 'ring.png', value_stars: 190 },
    { id: 2, username: 'mira', item_title: 'Pink Swan', image_url: 'nft-swan.png', value_stars: 60 },
    { id: 3, username: 'denis', item_title: 'Carbon Rifle', image_url: 'rifle.png', value_stars: 90 },
  ];
  const mockEvent = { enabled: true, event_type: 'battle_pass', title: 'Halloween Pass', ends_at: '2026-11-01T00:00:00Z', premium_price_xtr: 666 };
  const demoLevels = Array.from({ length: 30 }, (_, i) => ({ level: i + 1, rewardXp: 100, image_url: ['gift-box.png','rocket.png','perfume.png','ring.png','nft-swan.png'][i % 5], free: true, premium: i === 29 }));

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function asset(filename) {
    const clean = String(filename || 'gift-box.png').split('/').pop().replace(/[^a-z0-9._-]/gi, '');
    return `./assets/${clean || 'gift-box.png'}`;
  }
  function imageSrc(value) {
    const raw = String(value || 'gift-box.png').trim();
    if (/^https:\/\//i.test(raw)) { try { const url = new URL(raw); if (url.protocol === 'https:') return url.href; } catch {} }
    return asset(raw);
  }
  function starSvg(cls = 'mini-star') { return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.55 4.43 1.08 6.27L12 17.15l-5.63 2.95 1.08-6.27L2.9 9.4l6.3-.9L12 2.8Z"/></svg>`; }
  function money(value, suffix = '★') { return `${Number(value || 0).toLocaleString('ru-RU')} ${suffix}`; }
  function itemKind(item) { return item?.kind === 'nft' ? 'NFT' : item?.kind === 'skin' ? 'СКИН' : 'ПОДАРОК'; }
  function currentInitData() { return tg?.initData || ''; }

  async function api(path, options = {}) {
    if (MOCK) throw new Error('Демо-режим: серверный API отключён');
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': currentInitData(), ...(options.headers || {}) };
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
    let data = {};
    try { data = await response.json(); } catch { /* no JSON */ }
    if (!response.ok || data.ok === false) throw new Error(data.error || `Ошибка API (${response.status})`);
    return data;
  }

  function toast(message, type = 'info', duration = 3200) {
    const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message;
    $('#toast-region').append(el); window.setTimeout(() => el.remove(), duration);
  }
  function openModal(html) { $('#modal-content').innerHTML = html; $('#modal-root').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#modal-root').classList.add('hidden'); $('#modal-content').innerHTML = ''; document.body.style.overflow = ''; }
  function setView(view) {
    const requested = view;
    if (view === 'cases') { view = 'home'; S.view = 'cases'; } else S.view = view;
    $$('.view').forEach(node => node.classList.toggle('active-view', node.id === `${view}-view`));
    $$('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === S.view));
    if (view === 'inventory') renderInventory();
    if (view === 'upgrade') renderUpgrade();
    if (view === 'event') renderEvent();
    if (view === 'battles') loadBattles();
    if (view === 'admin') loadAdmin();
    if (tg?.BackButton) { view === 'home' ? tg.BackButton.hide() : tg.BackButton.show(); }
    if (requested === 'cases') { window.setTimeout(() => $('#case-grid')?.scrollIntoView({ behavior:'smooth', block:'start' }), 40); }
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function sound(type = 'click') {
    if (S.muted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx(); const now = ctx.currentTime;
      const notes = type === 'win' ? [[523,.0,.17],[659,.12,.18],[784,.24,.32]] : type === 'tick' ? [[790,0,.035]] : [[520,0,.045]];
      notes.forEach(([freq, offset, duration]) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = type === 'win' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(.0001, now + offset); gain.gain.exponentialRampToValueAtTime(type === 'win' ? .065 : .022, now + offset + .008); gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(now + offset); osc.stop(now + offset + duration + .02);
      });
      window.setTimeout(() => ctx.close().catch(()=>{}), 1000);
    } catch { /* audio is an optional enhancement */ }
  }
  function syncSoundButton() {
    const btn = $('#sound-toggle'); btn.style.color = S.muted ? '#6f7895' : '#c1c8dd'; btn.title = S.muted ? 'Включить звук' : 'Выключить звук';
    btn.setAttribute('aria-label', btn.title);
  }

  function initMock() {
    S.cases = structuredClone(mockCases); S.wins = mockWins; S.config = { event: mockEvent, channel: '@NftGiftCaseNews' };
    S.user = { telegram_id: new URLSearchParams(location.search).get('adminPreview') === '1' ? '1080484217' : '100000001', username: 'demo_player', first_name: 'Demo', balance: 255, free_spins: 1, premium_pass: 0 };
    S.balance = S.user.balance; S.isAdmin = new URLSearchParams(location.search).get('adminPreview') === '1';
    S.eventData = { settings: mockEvent, progress: { xp: 640, premium_unlocked: 0 }, quests: [
      { id:'open_1',title:'Первый кейс',description:'Откройте любой кейс',target:1,reward_xp:25,progress:1,claimed:0 },
      { id:'open_5',title:'Коллекционер',description:'Откройте 5 кейсов',target:5,reward_xp:75,progress:3,claimed:0 },
      { id:'daily_1',title:'Ежедневный подарок',description:'Заберите подарок дня',target:1,reward_xp:40,progress:0,claimed:0 }
    ], calendar: Array.from({length:24},(_,i)=>({day:i+1,image_url:['gift-box.png','nft-swan.png','rocket.png','perfume.png'][i%4],unlocked:new Date().getUTCMonth()===11&&i+1<=new Date().getUTCDate()})) };
    S.demoInventory = [
      { inventory_id:'demo-inv-1', item_id:'daily-teddy', title:'Плюшевый мишка', image_url:'teddy.png', kind:'gift', value_stars:5, status:'owned' },
      { inventory_id:'demo-inv-2', item_id:'blue-ring', title:'Blue Ring', image_url:'ring.png', kind:'nft', value_stars:190, status:'owned' }
    ]; S.inventory = S.demoInventory;
  }

  async function loadAll() {
    if (MOCK) {
      initMock(); renderAll();
      showDemoNotice();
      return;
    }
    if (tg) {
      tg.ready(); tg.expand();
      try { tg.setHeaderColor('#171a29'); tg.setBackgroundColor('#0f1016'); tg.setBottomBarColor('#171a29'); } catch { /* old Telegram client */ }
    }
    try {
      const [config, me, cases, wins, inventory, event] = await Promise.all([
        api('/api/config'), api('/api/me'), api('/api/cases'), api('/api/live-wins'), api('/api/inventory'), api('/api/event')
      ]);
      S.config = config; S.user = me.user; S.balance = Number(me.user.balance || 0); S.isAdmin = Boolean(me.isAdmin);
      S.cases = cases.cases; S.wins = wins.wins; S.inventory = inventory.items; S.eventData = event;
      renderAll();
      if (S.isAdmin) { $('#admin-shortcut-wrap').classList.remove('hidden'); }
      if (!currentInitData()) toast('Откройте приложение из Telegram-бота для авторизации.', 'error', 5000);
    } catch (err) {
      renderAll(); toast(`Не удалось загрузить данные: ${err.message}`, 'error', 6500);
      if (!currentInitData()) openModal(`<h2 class="modal-title" id="modal-title">Откройте в Telegram</h2><p class="modal-copy">Для реальной авторизации сервер проверяет подписанные данные Telegram. Откройте NftGiftCase через кнопку в боте.</p><button class="primary-btn wide-btn" data-modal-action="telegram-help">Как подключить бота</button>`);
    }
  }
  function showDemoNotice() {
    if (!$('#demo-ribbon')) {
      const node = document.createElement('div'); node.id='demo-ribbon'; node.className='demo-ribbon'; node.textContent='DEMO · Оплаты и серверные действия выключены';
      $('#main-content').prepend(node);
    }
  }

  function caseById(caseId) { return S.cases.find(c => c.id === caseId); }
  function filteredCases() {
    const term = S.search.trim().toLowerCase();
    let cases = S.cases.filter(c => c.active !== 0 && c.id !== 'daily');
    if (S.filter === 'free') cases = cases.filter(c => Number(c.is_free) === 1);
    if (S.filter === 'gift') cases = cases.filter(c => c.id === 'nft-mini' || c.items?.some(i => i.kind === 'gift' || i.kind === 'nft'));
    if (term) cases = cases.filter(c => c.title.toLowerCase().includes(term) || (c.description || '').toLowerCase().includes(term));
    if (S.caseSort) cases = [...cases].sort((a,b)=>Number(b.price_xtr)-Number(a.price_xtr));
    return cases;
  }
  function cardMarkup(c, free = false) {
    const image = imageSrc(c.image_url);
    const tag = free ? (c.id === 'daily' ? 'Подарок каждый день' : 'Подарок ждёт') : `${money(c.price_xtr, 'Stars')}`;
    const label = free ? (c.id === 'daily' ? 'Забрать' : 'Бесплатный бонус') : 'Открыть';
    const button = free ? `<button class="tag-price free" data-claim-case="${esc(c.id)}">${label}</button>` : `<button class="tag-price" data-open-case="${esc(c.id)}">${starSvg()} ${esc(c.price_xtr)} Stars</button>`;
    return `<article class="case-card" data-case-card="${esc(c.id)}"><button class="case-card-main" data-open-case="${esc(c.id)}" aria-label="Открыть ${esc(c.title)}"><div class="case-art"><img loading="lazy" src="${image}" alt="${esc(c.title)}" /></div><div class="case-card-title">${esc(c.title)}</div></button><div class="case-card-foot"><span class="tag-label">${esc(tag)}</span>${button}</div></article>`;
  }
  function renderHome() {
    const freeCases = [caseById('daily'), caseById('nft-mini')].filter(Boolean);
    $('#free-grid').innerHTML = freeCases.map(c => cardMarkup(c, true)).join('');
    const items = filteredCases().filter(c => !['daily','nft-mini'].includes(c.id));
    $('#case-grid').innerHTML = items.map(c => cardMarkup(c, false)).join('') || `<div class="empty-inline">Ничего не найдено</div>`;
    if (S.isAdmin) $('#admin-shortcut-wrap').classList.remove('hidden');
  }
  function catalogAssetUrl(item) {
    const url = String(item.image_url || '');
    if (url.startsWith('https://cdn.jsdelivr.net/gh/ssamy2/TG_Photos@main/webp/by_name/') || url.startsWith('https://cdn.jsdelivr.net/gh/ssamy2/TelegramGiftsAssests@main/webp/by_name/')) return url;
    return asset(url);
  }
  function renderGiftCatalog() {
    const source = Array.isArray(window.NGC_GIFT_CATALOG) ? window.NGC_GIFT_CATALOG : [];
    const term = String(S.catalogSearch || '').trim().toLowerCase();
    const filtered = source.filter(item => (S.catalogFilter === 'all' || item.kind === S.catalogFilter) && (!term || item.name.toLowerCase().includes(term)));
    const count = $('#gift-catalog-count');
    const grid = $('#gift-catalog-grid');
    if (!grid || !count) return;
    count.textContent = `${filtered.length} / ${source.length}`;
    grid.innerHTML = filtered.map(item => {
      const image = catalogAssetUrl(item);
      const kind = item.kind === 'nft' ? 'NFT' : 'ОБЫЧНЫЙ';
      const detail = item.kind === 'nft' ? `Выход: ${formatCatalogDate(item.release_date)} · Улучшение: ${item.upgrade_available ? 'указано' : 'не указано'}` : 'Базовый подарок';
      const fallback = item.image_fallback_url || './assets/gift-box.png';
      return `<article class="gift-catalog-card"><div class="gift-catalog-art"><img loading="lazy" decoding="async" src="${esc(image)}" data-catalog-fallback="${esc(fallback)}" alt="${esc(item.name)}" /></div><div class="gift-catalog-meta"><span class="catalog-kind ${item.kind === 'nft' ? 'nft' : 'regular'}">${kind}</span><strong title="${esc(item.name)}">${esc(item.name)}</strong><small>${esc(detail)}</small></div></article>`;
    }).join('') || `<div class="empty-inline">Подарки не найдены</div>`;
  }
  function formatCatalogDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
  }
  function renderBalance() { $('#balance-value').textContent = Number(S.balance || 0).toLocaleString('ru-RU'); }
  function renderLive() {
    const wins = S.wins?.length ? S.wins : mockWins;
    $('#live-feed').innerHTML = wins.slice(0,12).map(w => `<div class="live-card"><img loading="lazy" src="${imageSrc(w.image_url)}" alt=""/><span><b>${esc(w.username ? '@'+w.username : 'Player')} · ${esc(w.item_title)}</b><small>${esc(money(w.value_stars))}</small></span></div>`).join('');
  }
  function syncAdminNavigation() {
    const adminNav = $('#admin-nav-item');
    if (adminNav) adminNav.classList.toggle('hidden', !S.isAdmin);
    const adminShortcut = $('#admin-shortcut-wrap');
    if (adminShortcut) adminShortcut.classList.toggle('hidden', !S.isAdmin);
  }

  function renderAll() {
    renderBalance(); renderLive(); renderHome(); renderGiftCatalog(); renderInventory(); renderUpgrade(); renderEvent();
    syncAdminNavigation();
  }

  function openCase(caseId) {
    const c = caseById(caseId); if (!c) return toast('Кейс не найден', 'error');
    S.currentCase = c; S.quantity = 1;
    $('#case-title').textContent = c.title; $('#case-subtitle').textContent = c.description || 'Предметы, которые могут выпасть';
    $('#case-price').textContent = Number(c.is_free) ? 'Бесплатно после подписки' : `${c.price_xtr} Stars / открытие`;
    $$('.qty-chip').forEach(b => b.classList.toggle('active', b.dataset.qty === '1'));
    renderRoulette(c); renderOdds(c); $('#open-case-btn').textContent = Number(c.is_free) ? 'Забрать подарок' : `Открыть за ${c.price_xtr} Stars`;
    setView('case');
  }
  function renderRoulette(c) {
    const items = c.items || []; const all = [...items, ...items, ...items, ...items, ...items];
    $('#roulette-track').style.transition = 'none'; $('#roulette-track').style.transform = 'translateX(0)';
    $('#roulette-track').innerHTML = all.map((item, i) => `<div class="roulette-item" data-roulette-index="${i}"><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><small>${esc(money(item.value_stars))}</small></div>`).join('');
  }
  function renderOdds(c) {
    const items = c.items || []; const sum = items.reduce((n, i) => n + Number(i.weight || 0), 0) || 1;
    $('#odds-list').innerHTML = [...items].sort((a,b)=>Number(b.value_stars)-Number(a.value_stars)).map(item => `<article class="drop-item"><img loading="lazy" src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><small>${esc(money(item.value_stars))}</small><span class="odds">Шанс ${((Number(item.weight)/sum)*100).toFixed(2)}%</span></article>`).join('');
  }
  function selectQuantity(q) {
    S.quantity = Number(q); $$('.qty-chip').forEach(b => b.classList.toggle('active', Number(b.dataset.qty) === S.quantity));
    if (S.currentCase) $('#open-case-btn').textContent = Number(S.currentCase.is_free) ? 'Забрать подарок' : `Открыть x${q} за ${Number(S.currentCase.price_xtr)*Number(q)} Stars`;
  }
  async function claimFree(caseId) {
    if (MOCK) {
      const c = caseById(caseId); const item = chooseMockDrop(c);
      S.inventory.unshift({ inventory_id:`demo-${Date.now()}`,item_id:item.id,title:item.title,image_url:item.image_url,kind:item.kind,value_stars:item.value_stars,status:'owned' });
      toast(`Получено: ${item.title}`, 'success'); sound('win'); renderInventory(); setView('inventory'); return;
    }
    try {
      const result = await api('/api/free/claim', { method:'POST', body:{ caseId } });
      toast(`Получено: ${result.item.title}`, 'success'); sound('win'); await refreshUserData(); setView('inventory');
    } catch (err) {
      if (err.message.toLowerCase().includes('подпис') || err.message.toLowerCase().includes('channel') || err.message.includes('@NftGiftCaseNews')) return showSubscriptionModal(caseId, err.message);
      toast(err.message, 'error');
    }
  }
  function showSubscriptionModal(caseId, message = 'Для бесплатных подарков нужна подписка на канал.') {
    openModal(`<h2 class="modal-title" id="modal-title">Подпишитесь на канал</h2><p class="modal-copy">${esc(message)}<br/><br/>1. Подпишитесь на <b>@NftGiftCaseNews</b>.<br/>2. Вернитесь сюда и нажмите «Проверить подписку».</p><div class="modal-actions"><button class="secondary-btn" data-modal-action="subscribe">Открыть канал</button><button class="primary-btn" data-modal-action="check-subscription" data-case-id="${esc(caseId)}">Проверить подписку</button></div>`);
  }
  async function checkSubscription(caseId) {
    try { const result = await api('/api/subscription/status'); if (!result.subscribed) return toast('Подписка пока не обнаружена. Нажмите «Проверить подписку» ещё раз после подписки.', 'error'); closeModal(); await claimFree(caseId); }
    catch (err) { toast(err.message, 'error'); }
  }
  function chooseMockDrop(c) {
    const items = c?.items || mockItems; const sum = items.reduce((v,i)=>v+Number(i.weight||1),0); let r=Math.random()*sum;
    for (const item of items) { r-=Number(item.weight||1); if (r<=0) return item; } return items[0];
  }
  async function openSelectedCase() {
    const c = S.currentCase; if (!c) return;
    if (Number(c.is_free)) return claimFree(c.id);
    if (MOCK) {
      const total = Number(c.price_xtr) * S.quantity;
      if (S.balance < total) return showTopupModal();
      S.balance -= total; S.user.balance = S.balance; renderBalance();
      sound('click'); const items = [];
      for (let i=0;i<S.quantity;i++) items.push(chooseMockDrop(c));
      const track=$('#roulette-track'); const cardWidth=122; const chosen=items[items.length-1];
      track.style.transition='transform 1.7s cubic-bezier(.08,.7,.12,1)'; track.style.transform=`translateX(-${cardWidth*(Math.floor(track.children.length/2)+Math.floor(Math.random()*2))}px)`;
      $('#open-case-btn').disabled=true; $('#open-case-btn').textContent='Открываем…';
      for(let i=0;i<8;i++) { setTimeout(()=>sound('tick'),i*120); }
      setTimeout(()=>{
        items.forEach((item,i)=>S.inventory.unshift({inventory_id:`demo-${Date.now()}-${i}`,item_id:item.id,title:item.title,image_url:item.image_url,kind:item.kind,value_stars:item.value_stars,status:'owned'}));
        S.user.balance=S.balance; S.wins.unshift({id:Date.now(),username:'demo_player',item_title:chosen.title,image_url:chosen.image_url,value_stars:chosen.value_stars});
        $('#open-case-btn').disabled=false; $('#open-case-btn').textContent=`Открыть x${S.quantity} за ${Number(c.price_xtr)*S.quantity} Stars`;
        toast(`Выпало: ${items.map(i=>i.title).join(', ')}`, 'success'); sound('win'); renderLive(); renderInventory(); renderOdds(c);
      },1800); return;
    }
    try {
      const order = await api('/api/payments/invoice', { method:'POST', body:{ type:'case_open', caseId:c.id, quantity:S.quantity } });
      sound('click');
      if (tg?.openInvoice) tg.openInvoice(order.invoiceUrl, async (status) => { if (status === 'paid' || status === 'pending') { toast(status === 'paid' ? 'Оплата принята Telegram. Проверяем выдачу предметов…' : 'Платёж обрабатывается Telegram.', 'success'); setTimeout(refreshUserData, 1800); setTimeout(refreshUserData, 5000); } });
      else window.open(order.invoiceUrl, '_blank', 'noopener,noreferrer');
    } catch (err) { toast(err.message, 'error'); }
  }
  async function topupAmount(amount) {
    if (MOCK) { S.balance += amount; S.user.balance=S.balance; renderBalance(); closeModal(); toast(`DEMO: баланс увеличен на ${amount}`, 'success'); return; }
    try {
      const order = await api('/api/payments/invoice', { method:'POST', body:{ type:'balance_topup', amount } }); closeModal();
      if (tg?.openInvoice) tg.openInvoice(order.invoiceUrl, status => { if(status==='paid'||status==='pending') { toast('Платёж отправлен в Telegram. Баланс обновится после webhook.', 'success'); setTimeout(refreshUserData,1800); } });
      else window.open(order.invoiceUrl,'_blank','noopener,noreferrer');
    } catch(err) { toast(err.message,'error'); }
  }
  function showTopupModal() {
    const options=[50,100,250,500,1000];
    openModal(`<h2 class="modal-title" id="modal-title">Пополнить баланс</h2><p class="modal-copy">Оплата будет открыта официальным окном Telegram Stars. Кредиты баланса — внутренняя валюта NftGiftCase, это не кошелёк Telegram Stars.</p><div class="modal-grid">${options.map(n=>`<button class="modal-choice" data-topup="${n}"><span class="balance-orb">★</span><span><strong>${n} кредитов</strong><small>Оплата ${n} XTR</small></span></button>`).join('')}</div>${MOCK?'<p class="muted-note">DEMO: в этом режиме пополнение локальное, реального платежа нет.</p>':''}`);
  }

  function renderInventory() {
    const items = S.inventory || [];
    $('#inventory-count').textContent=String(items.length);
    $('#inventory-grid').innerHTML=items.map(item=>`<article class="inventory-card"><span class="inventory-tag">${esc(itemKind(item))}</span><img loading="lazy" src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><h3>${esc(item.title)}</h3><p>${esc(money(item.value_stars))} · ${esc(item.status==='withdraw_pending'?'На выводе':'В коллекции')}</p>${item.status==='owned'?`<button class="small-primary" data-withdraw="${esc(item.inventory_id)}">Запросить вывод</button>`:`<button class="secondary-btn" disabled>В обработке</button>`}</article>`).join('');
    $('#inventory-empty').classList.toggle('visible',items.length===0); $('#inventory-grid').classList.toggle('hidden',items.length===0);
    $('#upgrade-inventory').innerHTML=items.slice(0,12).map(i=>`<button class="mini-item" data-target-item="${esc(i.item_id)}"><img src="${imageSrc(i.image_url)}" alt="${esc(i.title)}"/><strong>${esc(i.title)}</strong><small>${esc(money(i.value_stars))}</small></button>`).join('') || `<span class="muted-note">Предметы появятся здесь после открытия кейса.</span>`;
  }
  function showWithdrawConfirm(inventoryId) {
    openModal(`<h2 class="modal-title" id="modal-title">Запросить вывод?</h2><p class="modal-copy">Администратор получит заявку с ID, @username и выбранным предметом. Для подачи заявки у аккаунта Telegram должен быть установлен публичный @username. Фактическую передачу проверяет администратор.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-withdraw="${esc(inventoryId)}">Отправить заявку</button></div>`);
  }
  async function withdraw(inventoryId) {
    if(MOCK) { closeModal(); return toast('DEMO: запрос вывода не отправлялся.', 'error'); }
    try { const result=await api('/api/withdrawals',{method:'POST',body:{inventoryId}}); closeModal(); toast(result.message,'success'); await refreshUserData(); }
    catch(err) { closeModal(); if(err.message.toLowerCase().includes('username')) openModal(`<h2 class="modal-title" id="modal-title">Нужен @username</h2><p class="modal-copy">Установите публичный username в Telegram: Настройки → Имя пользователя. Затем вернитесь сюда и повторите заявку.</p><button class="primary-btn wide-btn" data-modal-action="open-settings">Открыть настройки Telegram</button>`); else toast(err.message,'error'); }
  }

  function updateWheelTicks() {
    const group=$('#wheel-ticks'); if (!group || group.childElementCount) return;
    for(let i=0;i<60;i++) { const a=(Math.PI*2*i/60)-Math.PI/2; const r1=i%5===0?142:147; const r2=i%5===0?154:151; const x1=180+Math.cos(a)*r1,y1=180+Math.sin(a)*r1,x2=180+Math.cos(a)*r2,y2=180+Math.sin(a)*r2; const line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',x1);line.setAttribute('y1',y1);line.setAttribute('x2',x2);line.setAttribute('y2',y2); if(i%5===0) line.setAttribute('stroke-width','3'); group.append(line); }
  }
  function allTargetItems() { const map=new Map(); S.cases.forEach(c=>(c.items||[]).forEach(item=>{ if(!map.has(item.id)||Number(item.value_stars)>Number(map.get(item.id).value_stars)) map.set(item.id,item); })); return [...map.values()].sort((a,b)=>Number(b.value_stars)-Number(a.value_stars)); }
  function chooseTarget(target) { S.selectedTarget=target; $('#target-image').src=imageSrc(target.image_url);$('#target-title').textContent=target.title;$('#target-value').textContent=`Стоимость ${money(target.value_stars)}`;updateUpgradeChance(); }
  function updateUpgradeChance() {
    const target=S.selectedTarget||allTargetItems()[0]; const bal=Math.max(1,Number(S.balance)||0);
    const maxBet=Math.max(1,Math.min(bal,1000)); const bet= Math.max(1,Math.min(maxBet,Number(S.upgradeBet)||1)); S.upgradeBet=bet;
    $('#upgrade-bet-value').textContent=`${bet} кредит${bet===1?'':'ов'}`; $('#bet-range-label').textContent=String(bet); $('#bet-range').max=String(maxBet); $('#bet-range').value=String(Math.min(bet,maxBet));
    const chance=target?Math.min(95,Math.max(.5,bet/Math.max(1,Number(target.value_stars))*100)):0;
    $('#wheel-chance').textContent=`${chance.toFixed(1)}%`;$('#chance-label').textContent=`Шанс ${chance.toFixed(1)}%`;$('#chance-bar').style.width=`${chance}%`;
    const circumference=2*Math.PI*142; const sector=$('#chance-sector'); sector.setAttribute('stroke-dasharray',`${circumference*chance/100} ${circumference*(1-chance/100)}`); sector.setAttribute('stroke-dashoffset','0');
  }
  function renderUpgrade() {
    updateWheelTicks();
    const target=S.selectedTarget||allTargetItems()[0]; if(target) chooseTarget(target);
    $('#upgrade-inventory').innerHTML=(S.inventory||[]).slice(0,12).map(i=>`<button class="mini-item" data-target-item="${esc(i.item_id)}"><img src="${imageSrc(i.image_url)}" alt="${esc(i.title)}"/><strong>${esc(i.title)}</strong><small>${esc(money(i.value_stars))}</small></button>`).join('') || `<span class="muted-note">Предметы появятся после открытия кейсов.</span>`;
  }
  function showTargetModal() {
    const targets=allTargetItems();
    openModal(`<h2 class="modal-title" id="modal-title">Выберите предмет</h2><p class="modal-copy">Целевой предмет определяет стоимость и расчёт шанса.</p><div class="modal-grid">${targets.map(i=>`<button class="modal-choice" data-choose-target="${esc(i.id)}"><img src="${imageSrc(i.image_url)}" alt="${esc(i.title)}"/><span><strong>${esc(i.title)}</strong><small>${esc(money(i.value_stars))}</small></span></button>`).join('')}</div>`);
  }
  async function performUpgrade() {
    const target=S.selectedTarget||allTargetItems()[0]; if(!target)return toast('Нет доступных предметов','error');
    if (S.balance < S.upgradeBet) return showTopupModal();
    if(MOCK) {
      S.balance-=S.upgradeBet;S.user.balance=S.balance;renderBalance();
      const chance=Math.min(95,Math.max(.5,S.upgradeBet/Math.max(1,Number(target.value_stars))*100));
      const won=Math.random()*100<chance; $('#upgrade-wheel').style.transition='transform 2.1s cubic-bezier(.12,.7,.1,1)';$('#upgrade-wheel').style.transform=`rotate(${720+Math.random()*720}deg)`; $('#upgrade-btn').disabled=true; $('#upgrade-result').textContent='Колесо вращается…';
      setTimeout(()=>{ $('#upgrade-wheel').style.transition='none';$('#upgrade-wheel').style.transform='rotate(0deg)';$('#upgrade-btn').disabled=false;$('#upgrade-result').textContent=won?`Успех! Получен ${target.title}`:'Не повезло — попробуйте ещё раз';$('#upgrade-result').className=`upgrade-result ${won?'won':'lost'}`;if(won) {S.inventory.unshift({inventory_id:`demo-up-${Date.now()}`,item_id:target.id,title:target.title,image_url:target.image_url,kind:target.kind,value_stars:target.value_stars,status:'owned'});sound('win');} else sound('tick');renderBalance();renderInventory();updateUpgradeChance();},2200); return;
    }
    try {
      $('#upgrade-btn').disabled=true; $('#upgrade-result').textContent='Проверяем шанс на сервере…';
      const result=await api('/api/upgrade',{method:'POST',body:{targetItemId:target.id,bet:S.upgradeBet}});
      $('#upgrade-wheel').style.transition='transform 2.1s cubic-bezier(.12,.7,.1,1)';$('#upgrade-wheel').style.transform=`rotate(${720+Math.random()*720}deg)`;
      setTimeout(async()=>{ $('#upgrade-wheel').style.transition='none';$('#upgrade-wheel').style.transform='rotate(0deg)';$('#upgrade-btn').disabled=false;$('#upgrade-result').textContent=result.won?`Успех! Получен ${result.item.title}`:'Не повезло — ставка списана';$('#upgrade-result').className=`upgrade-result ${result.won?'won':'lost'}`;if(result.won)sound('win');else sound('tick');await refreshUserData();updateUpgradeChance();},2200);
    } catch(err) { $('#upgrade-btn').disabled=false; $('#upgrade-result').textContent='Выберите предмет для апгрейда';toast(err.message,'error'); }
  }

  function renderEvent() {
    const data=S.eventData||{}; const settings=data.settings||data.event||mockEvent;
    const beforeEnd = !settings.ends_at || new Date(settings.ends_at).getTime() > Date.now();
    const enabled=(Boolean(Number(settings.enabled) || settings.enabled===true)) && beforeEnd;
    $('#event-title').textContent=enabled?(settings.title||'Event'): 'Event Soon';
    $('#event-nav-label').textContent=enabled?(settings.event_type==='advent'?'Адвент':'Event Pass'):'Event Soon';
    $('#event-status').textContent=enabled?'АКТИВЕН':'СКОРО';
    $('#event-soon').classList.toggle('hidden',enabled);$('#battle-pass-content').classList.toggle('hidden',!enabled||settings.event_type==='advent');$('#advent-content').classList.toggle('hidden',!enabled||settings.event_type!=='advent');
    $('#pass-name').textContent=settings.title||'Halloween Pass';$('#premium-pass-btn').textContent=`Открыть Premium за ${settings.premium_price_xtr||666} Stars`;
    const progress=data.progress||{xp:0,premium_unlocked:0};$('#pass-xp-value').textContent=`${Number(progress.xp||0)} XP`;
    const currentLevel=Math.min(30,Math.floor(Number(progress.xp||0)/100)+1);$('#pass-xp-label').textContent=`Уровень ${currentLevel} из 30`;
    const freeClaimed=JSON.parse(progress.claimed_free_levels||'[]');const premiumClaimed=JSON.parse(progress.claimed_premium_levels||'[]');
    const levels=$('#pass-levels'); levels.innerHTML=Array.from({length:30},(_,i)=>{
      const level=i+1; const unlocked=Number(progress.xp||0)>=level*100;
      const freeDone=freeClaimed.includes(level); const premiumDone=premiumClaimed.includes(level);
      const freeImage=['gift-box.png','rocket.png','perfume.png','ring.png','nft-swan.png'][i%5];
      const premiumImage=level===30?'nft-swan.png':['nft-swan.png','ring.png','rocket.png','perfume.png'][i%4];
      const premiumReady=Number(progress.premium_unlocked||0)===1;
      return `<article class="level-card ${unlocked?'':'locked'}"><span class="level-number">LEVEL ${String(level).padStart(2,'0')}</span><strong>Уровень ${level}</strong><div class="level-rewards"><div class="level-branch free-branch"><small>FREE · ${level*100} XP</small><img loading="lazy" src="${asset(freeImage)}" alt="Бесплатная награда ${level}"/><button data-claim-level="${level}" data-branch="free" ${!unlocked||freeDone?'disabled':''}>${freeDone?'Получено':unlocked?'Забрать':'Закрыто'}</button></div><div class="level-branch premium-branch"><small>${level===30?'RARE NFT':'PREMIUM'}</small><img loading="lazy" src="${asset(premiumImage)}" alt="Premium награда ${level}"/><button data-claim-level="${level}" data-branch="premium" ${!unlocked||!premiumReady||premiumDone?'disabled':''}>${premiumDone?'Получено':!premiumReady?'Premium':unlocked?'Забрать':'Закрыто'}</button></div></div></article>`
    }).join('');
    const quests=data.quests||[];$('#quests-list').innerHTML=quests.map(q=>`<article class="quest-card"><div><strong>${esc(q.title)}</strong><p>${esc(q.description)}</p><small>${Number(q.progress||0)} / ${Number(q.target)} · +${Number(q.reward_xp)} XP</small></div><button data-claim-quest="${esc(q.id)}" ${q.claimed||Number(q.progress)<Number(q.target)?'disabled':''}>${q.claimed?'Получено':'Забрать XP'}</button></article>`).join('')||'<p class="muted-note">Задания появятся после запуска события.</p>';
    const calendar=data.calendar||[];$('#advent-grid').innerHTML=calendar.map(d=>`<button class="advent-cell ${d.unlocked?'':'locked'}" data-advent-day="${d.day}" ${d.unlocked?'':'disabled'}><strong>${d.day}</strong><img src="${imageSrc(d.image_url)}" alt="Подарок дня ${d.day}" /></button>`).join('');
  }
  async function claimLevel(level, branch='free') {
    if(MOCK) { const p=S.eventData.progress;p.xp=Number(p.xp||0);const needed=level*100;if(p.xp<needed)return toast('Недостаточно XP для этой награды','error');if(branch==='premium'&&!p.premium_unlocked)return toast('Сначала активируйте Premium Pass','error');toast(`DEMO: награда уровня ${level} доступна в полной версии`,'success');return renderEvent(); }
    try {const result=await api(`/api/event/levels/${level}/claim`,{method:'POST',body:{branch}});toast(result.message||'Награда получена','success');await refreshUserData();}catch(err){toast(err.message,'error');}
  }
  async function claimQuest(questId) {
    if(MOCK) {const q=S.eventData.quests.find(q=>q.id===questId);if(!q||q.progress<q.target)return toast('Задание ещё не выполнено','error');q.claimed=1;S.eventData.progress.xp+=q.reward_xp;toast(`Получено ${q.reward_xp} XP`,'success');renderEvent();return;}
    try {const result=await api(`/api/event/quests/${encodeURIComponent(questId)}/claim`,{method:'POST',body:{}});toast(result.message,'success');await refreshUserData();}catch(err){toast(err.message,'error');}
  }
  async function buyPremiumPass() {
    if(MOCK) return toast('DEMO: настоящий платёж не создаётся. В production используется invoice XTR.', 'error');
    try { const order=await api('/api/payments/invoice',{method:'POST',body:{type:'premium_pass'}}); if(tg?.openInvoice) tg.openInvoice(order.invoiceUrl,status=>{if(status==='paid'||status==='pending')setTimeout(refreshUserData,1800)}); else window.open(order.invoiceUrl,'_blank','noopener,noreferrer'); }
    catch(err){toast(err.message,'error');}
  }
  async function claimAdventDay(day) {
    if(MOCK) return toast('DEMO: календарь показывает доступные ячейки, выдача включается через API.', 'info');
    try { const result=await api(`/api/event/advent/${day}/claim`,{method:'POST',body:{}});toast(`Получено: ${result.item.title}`,'success');await refreshUserData(); } catch(err){toast(err.message,'error');}
  }

  async function loadBattles() {
    if(MOCK) {$('#battles-list').innerHTML=`<div class="battle-row"><img src="${asset('case-blue.png')}" alt="Кейс"/><div><strong>Битва #DEMO-01</strong><small>Сапфировый кейс · вход 79 кредитов · ожидает игрока</small></div><button class="small-primary" data-demo-battle>Присоединиться</button></div>`;return;}
    try {const result=await api('/api/battles');$('#battles-list').innerHTML=result.battles.map(b=>`<article class="battle-row"><img src="${imageSrc(b.image_url)}" alt="${esc(b.case_title)}"/><div><strong>${esc(b.case_title)}</strong><small>Вход ${esc(b.entry_cost)} кредитов · ${Number(b.players)}/2 игроков</small><small>${esc(b.status==='waiting'?'Ожидает игрока':'В игре')}</small></div><button class="small-primary" data-join-battle="${esc(b.id)}">Войти</button></article>`).join('')||'<div class="empty-inline">Открытых битв пока нет. Создайте первую.</div>';}
    catch(err){toast(err.message,'error');}
  }
  async function createBattle() {
    if(MOCK) return toast('DEMO: PvP-матчи требуют подключённого backend и баланса.', 'error');
    const chosen=caseById('crate-blue');const entryCost=Number(chosen?.price_xtr||79);
    try {const result=await api('/api/battles',{method:'POST',body:{caseId:'crate-blue',entryCost}});toast('Битва создана. Ждём соперника.','success');await loadBattles();}catch(err){toast(err.message,'error');}
  }
  async function joinBattle(battleId) {
    if(MOCK) return toast('DEMO: присоединение к битве не выполняется.', 'error');
    try {const result=await api(`/api/battles/${encodeURIComponent(battleId)}/join`,{method:'POST',body:{}});if(result.status==='finished')toast(`Битва завершена. Победитель: ${result.winnerId}`,'success');else toast('Вы присоединились к битве','success');await refreshUserData();await loadBattles();}catch(err){toast(err.message,'error');}
  }

  async function redeemPromo() {
    const code=$('#promo-input').value.trim().toUpperCase();if(!code)return toast('Введите промокод','error');
    if(MOCK) { $('#promo-input').value=''; if(code==='DEMO50'){S.balance+=50;renderBalance();return toast('DEMO: начислено 50 кредитов','success');}return toast('В демо доступен промокод DEMO50','error'); }
    try {const result=await api('/api/promocodes/redeem',{method:'POST',body:{code}});$('#promo-input').value='';toast(result.message,'success');await refreshUserData();}catch(err){toast(err.message,'error');}
  }

  async function refreshUserData() {
    if(MOCK) { renderAll(); return; }
    try {
      const [me, cases, inventory, wins, event] = await Promise.all([api('/api/me'),api('/api/cases'),api('/api/inventory'),api('/api/live-wins'),api('/api/event')]);
      S.user=me.user;S.balance=Number(me.user.balance||0);S.isAdmin=Boolean(me.isAdmin);S.cases=cases.cases;S.inventory=inventory.items;S.wins=wins.wins;S.eventData=event;renderAll();
    } catch(err) { console.warn(err); }
  }

  async function shareReferral() {
    const botName = String(S.config?.botUsername || '').replace(/^@/, '');
    if (!botName) return toast(MOCK ? 'DEMO: задайте BOT_USERNAME для генерации ссылки приглашения.' : 'Администратору нужно задать BOT_USERNAME на backend.', 'error');
    const url = `https://t.me/${botName}?start=ref_${S.user?.telegram_id || ''}`;
    const text = `Попробуй NftGiftCase: ${url}`;
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Попробуй NftGiftCase')}`);
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); toast('Реферальная ссылка скопирована','success'); }
      else openModal(`<h2 class="modal-title" id="modal-title">Ваша ссылка</h2><p class="modal-copy">${esc(url)}</p><button class="primary-btn wide-btn" data-copy-ref="${esc(url)}">Скопировать</button>`);
    } catch { toast('Не удалось открыть окно отправки. Скопируйте ссылку из профиля.', 'error'); }
  }

  function adminCaseList() {
    if (MOCK) return S.cases.filter(c => !['daily','nft-mini'].includes(c.id));
    return S.adminOverview?.cases || [];
  }
  function fillGiftSelector() {
    const select = $('#admin-gift-select');
    if (!select) return;
    const catalog = Array.isArray(window.NGC_GIFT_CATALOG) ? window.NGC_GIFT_CATALOG : [];
    select.innerHTML = catalog.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${item.kind==='nft'?'NFT':'Обычный'}</option>`).join('');
  }
  async function loadAdmin(preselectId = '') {
    if(!S.isAdmin) { toast('Доступ запрещён','error');return setView('home'); }
    fillGiftSelector();
    if(MOCK) {
      const cases = adminCaseList();
      $('#admin-case-select').innerHTML=cases.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if (preselectId) $('#admin-case-select').value=preselectId;
      fillAdminCase();
      $('#admin-orders').textContent='DEMO: заказы не создаются. Изменения в демо не сохраняются в базе.';
      $('#admin-event-enabled').checked=true;$('#admin-event-type').value='battle_pass';$('#admin-event-title').value='Halloween Pass';
      return;
    }
    try {
      const result=await api('/api/admin/overview'); S.adminOverview=result;
      const cases=result.cases||[];
      const selected = preselectId || $('#admin-case-select').value;
      $('#admin-case-select').innerHTML=cases.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}${Number(c.active)?'':' · выкл.'}</option>`).join('');
      if (selected && cases.some(c=>c.id===selected)) $('#admin-case-select').value=selected;
      fillAdminCase();
      $('#admin-event-enabled').checked=Boolean(result.event.enabled);$('#admin-event-type').value=result.event.event_type;$('#admin-event-title').value=result.event.title;$('#admin-event-price').value=result.event.premium_price_xtr;$('#admin-event-end').value=result.event.ends_at?new Date(result.event.ends_at).toISOString().slice(0,16):'';
      $('#admin-orders').innerHTML=(result.orders||[]).map(o=>`<div class="admin-order"><span>${esc(o.order_type)} · ${esc(o.status)}<br/><small>${esc(o.telegram_id)}</small></span><strong>${esc(o.amount_xtr)} XTR</strong></div>`).join('')||'Заказов нет';
    } catch(err){toast(err.message,'error');}
  }
  function fillAdminCase() {
    const caseId=$('#admin-case-select')?.value;
    const base = adminCaseList().find(c=>c.id===caseId) || adminCaseList()[0];
    if(!base) { $('#admin-case-weights').innerHTML='<p class="muted-note">Сначала создай кейс выше.</p>'; return; }
    const c = base;
    $('#admin-case-title').value=c.title||'';
    $('#admin-case-image').value=c.image_url||'case-rich.png';
    $('#admin-case-description').value=c.description||'';
    $('#admin-case-price').value=c.price_xtr ?? 39;
    $('#admin-case-limit').value=c.max_opens??'';
    $('#admin-case-active').checked=Boolean(Number(c.active));
    const items=c.items||[];
    const liveItems=items.filter(i=>i.stock_limit==null || Number(i.awarded_count||0)<Number(i.stock_limit));
    const total=liveItems.reduce((sum,i)=>sum+Number(i.weight||0),0);
    const allTotal=items.reduce((sum,i)=>sum+Number(i.weight||0),0);
    const weights=items.map(i=>{
      const exhausted=i.stock_limit!=null && Number(i.awarded_count||0)>=Number(i.stock_limit);
      const chance=exhausted ? (allTotal ? Number(i.weight||0)/allTotal*100 : 0.01) : (total ? Number(i.weight||0)/total*100 : 0.01);
      return `<div class="case-item-admin ${exhausted?'is-exhausted':''}">
        <div class="case-item-admin-top"><img src="${esc(imageSrc(i.image_url))}" alt=""/><div><strong>${esc(i.title)}</strong><small>${esc(i.kind==='nft'?'NFT':i.kind==='skin'?'Скин':'Обычный подарок')} · выпало ${Number(i.awarded_count||0)}${exhausted?' · запас исчерпан':''}</small></div><button type="button" class="remove-item-btn" data-admin-remove-item="${esc(i.id)}" title="Убрать предмет">Убрать</button></div>
        <div class="form-grid"><label>Шанс, %<input type="number" min="0.01" max="100" step="0.01" value="${chance.toFixed(2)}" data-item-chance="${esc(i.id)}" /></label><label>Стоимость, Stars<input type="number" min="0" max="100000000" value="${Number(i.value_stars||0)}" data-item-price="${esc(i.id)}" /></label></div>
        <label>Количество в кейсе <input type="number" min="1" placeholder="Без лимита" value="${i.stock_limit==null?'':Number(i.stock_limit)}" data-item-stock="${esc(i.id)}" /></label>
      </div>`;
    }).join('');
    $('#admin-case-weights').innerHTML=`<div class="case-items-heading"><strong>Предметы в кейсе (${items.length})</strong><span>Доли нормализуются до 100%</span></div>${weights||'<p class="muted-note">В этом кейсе пока нет подарков. Добавь их в блоке ниже.</p>'}`;
  }
  async function adminCreateCase() {
    const title=$('#admin-new-case-title').value.trim();
    const payload={title,description:$('#admin-new-case-description').value.trim(),imageUrl:$('#admin-new-case-image').value,priceXtr:Number($('#admin-new-case-price').value),maxOpens:$('#admin-new-case-limit').value===''?null:Number($('#admin-new-case-limit').value),active:false};
    if (!title) return toast('Введи название кейса','error');
    if (!Number.isSafeInteger(payload.priceXtr)||payload.priceXtr<1) return toast('Цена кейса должна быть не меньше 1 Star','error');
    if (MOCK) {
      const id=`custom-${Date.now().toString(36)}`; const c={id,title,description:payload.description,image_url:payload.imageUrl,price_xtr:payload.priceXtr,is_free:0,active:0,max_opens:payload.maxOpens,opened_count:0,items:[]};S.cases.push(c);
      $('#admin-new-case-title').value=''; toast('DEMO: кейс создан только в текущем окне','info'); await loadAdmin(id); $('#admin-case-select').value=id; fillAdminCase(); return;
    }
    try {const result=await api('/api/admin/cases',{method:'POST',body:payload});$('#admin-new-case-title').value='';$('#admin-new-case-description').value='';toast('Кейс создан. Теперь добавь предметы и сохрани настройки.','success');await loadAdmin(result.case.id);$('#admin-case-select').value=result.case.id;fillAdminCase();}
    catch(err){toast(err.message,'error');}
  }
  async function adminAddItem() {
    const caseId=$('#admin-case-select').value;
    const catalog=(window.NGC_GIFT_CATALOG||[]).find(item=>item.id===$('#admin-gift-select').value);
    if(!caseId) return toast('Сначала создай или выбери кейс','error');
    if(!catalog) return toast('Выбери подарок из каталога','error');
    const valueStars=Number($('#admin-item-price').value);
    const chancePct=Number($('#admin-item-chance').value);
    const stockValue=$('#admin-item-stock').value;
    const stockLimit=stockValue===''?null:Number(stockValue);
    if(!Number.isSafeInteger(valueStars)||valueStars<0) return toast('Стоимость предмета должна быть 0 или больше','error');
    if(!Number.isFinite(chancePct)||chancePct<=0||chancePct>100) return toast('Шанс должен быть от 0,01 до 100%','error');
    if(stockLimit!==null&&(!Number.isSafeInteger(stockLimit)||stockLimit<1)) return toast('Количество должно быть больше нуля или пустым','error');
    const payload={catalogId:catalog.id,title:catalog.name,imageUrl:catalog.image_url,kind:catalog.kind==='nft'?'nft':catalog.kind==='skin'?'skin':'gift',valueStars,chancePct,stockLimit};
    if(MOCK){
      const c=S.cases.find(item=>item.id===caseId);if(!c)return toast('Кейс не найден','error');
      if((c.items||[]).some(i=>i.title===payload.title&&i.image_url===payload.imageUrl))return toast('Этот подарок уже добавлен','error');
      c.items ||= [];c.items.push({id:`${caseId}-${Date.now().toString(36)}`,title:payload.title,image_url:payload.imageUrl,kind:payload.kind,value_stars:valueStars,weight:Math.max(1,Math.round(chancePct*1000)),stock_limit:stockLimit,awarded_count:0});
      fillAdminCase(); toast('DEMO: предмет добавлен только в текущем окне','success');return;
    }
    try {await api(`/api/admin/cases/${encodeURIComponent(caseId)}/items`,{method:'POST',body:payload});toast('Подарок добавлен в кейс','success');await loadAdmin(caseId);await refreshUserData();}
    catch(err){toast(err.message,'error');}
  }
  async function adminRemoveItem(itemId) {
    const caseId=$('#admin-case-select').value;
    if(!caseId||!itemId)return;
    if(!confirm('Убрать этот предмет из выпадений кейса? Уже выданные предметы останутся в инвентарях.'))return;
    if(MOCK){const c=S.cases.find(item=>item.id===caseId);if(c)c.items=(c.items||[]).filter(i=>i.id!==itemId);fillAdminCase();toast('DEMO: предмет убран только в этом окне','info');return;}
    try {await api(`/api/admin/cases/${encodeURIComponent(caseId)}/items/${encodeURIComponent(itemId)}`,{method:'DELETE'});toast('Предмет убран из выпадений','success');await loadAdmin(caseId);await refreshUserData();}
    catch(err){toast(err.message,'error');}
  }
  async function adminSaveCase() {
    const caseId=$('#admin-case-select').value;
    const itemIds=new Set($$('[data-item-chance]').map(input=>input.dataset.itemChance));
    const items=[...itemIds].map(id=>({id,chancePct:Number($(`[data-item-chance="${CSS.escape(id)}"]`).value),valueStars:Number($(`[data-item-price="${CSS.escape(id)}"]`).value),stockLimit:$(`[data-item-stock="${CSS.escape(id)}"]`).value===''?null:Number($(`[data-item-stock="${CSS.escape(id)}"]`).value)}));
    for(const item of items){if(!Number.isFinite(item.chancePct)||item.chancePct<=0||item.chancePct>100)return toast('Проверь шансы предметов: допустимо от 0,01 до 100%','error');if(!Number.isSafeInteger(item.valueStars)||item.valueStars<0)return toast('Проверь стоимость предмета','error');if(item.stockLimit!==null&&(!Number.isSafeInteger(item.stockLimit)||item.stockLimit<1))return toast('Количество должно быть больше нуля или пустым','error');}
    const payload={title:$('#admin-case-title').value.trim(),description:$('#admin-case-description').value.trim(),imageUrl:$('#admin-case-image').value,priceXtr:Number($('#admin-case-price').value),maxOpens:$('#admin-case-limit').value===''?null:Number($('#admin-case-limit').value),active:$('#admin-case-active').checked,items};
    if(!payload.title)return toast('Название кейса не может быть пустым','error');
    if(!Number.isSafeInteger(payload.priceXtr)||payload.priceXtr<1)return toast('Цена кейса должна быть не меньше 1 Star','error');
    if(payload.maxOpens!==null&&(!Number.isSafeInteger(payload.maxOpens)||payload.maxOpens<1))return toast('Лимит должен быть больше нуля или пустым','error');
    if(MOCK){const c=S.cases.find(item=>item.id===caseId);if(!c)return toast('Кейс не найден','error');Object.assign(c,{title:payload.title,description:payload.description,image_url:payload.imageUrl,price_xtr:payload.priceXtr,max_opens:payload.maxOpens,active:payload.active?1:0});for(const item of items){const found=c.items.find(i=>i.id===item.id);if(found){found.weight=Math.max(1,Math.round(item.chancePct*1000));found.value_stars=item.valueStars;found.stock_limit=item.stockLimit;}}if(payload.active&&!c.items.length){c.active=0;return toast('Добавь хотя бы один предмет перед активацией','error');}toast('DEMO: настройки обновлены только в текущем окне','info');renderAll();fillAdminCase();return;}
    try {await api(`/api/admin/cases/${encodeURIComponent(caseId)}`,{method:'PATCH',body:payload});toast('Настройки кейса сохранены','success');await loadAdmin(caseId);await refreshUserData();}
    catch(err){toast(err.message,'error');}
  }
  async function adminCreatePromo() {
    const payload={code:$('#admin-promo-code').value.trim().toUpperCase(),kind:$('#admin-promo-kind').value,amount:Number($('#admin-promo-amount').value),maxUses:$('#admin-promo-max').value===''?null:Number($('#admin-promo-max').value),expiresAt:$('#admin-promo-expiry').value?new Date($('#admin-promo-expiry').value).toISOString():null};
    if(MOCK)return toast('DEMO: промокод не создан','error');
    try {await api('/api/admin/promocodes',{method:'POST',body:payload});toast('Промокод создан','success');$('#admin-promo-code').value='';await loadAdmin();}catch(err){toast(err.message,'error');}
  }
  async function adminSaveEvent() {
    const payload={enabled:$('#admin-event-enabled').checked,eventType:$('#admin-event-type').value,title:$('#admin-event-title').value,endsAt:$('#admin-event-end').value?new Date($('#admin-event-end').value).toISOString():null,premiumPriceXtr:Number($('#admin-event-price').value)};
    if(MOCK){S.eventData.settings={...S.eventData.settings,...payload};toast('DEMO: Event Manager обновлён только в окне браузера','info');renderEvent();return;}
    try {await api('/api/admin/event',{method:'PATCH',body:payload});toast('Событие сохранено','success');await refreshUserData();}catch(err){toast(err.message,'error');}
  }

  function handleClick(event) {
    const target=event.target.closest('button,[data-close-modal]');if(!target)return;
    if(target.matches('[data-close-modal]'))return closeModal();
    if(target.matches('[data-view]')) {sound();const next=target.dataset.view;if(next==='cases')S.filter='all';setView(next);return;}
    if(target.matches('[data-filter]')) {S.filter=target.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('selected',b===target));renderHome();sound();return;}
    if(target.matches('[data-catalog-filter]')) {S.catalogFilter=target.dataset.catalogFilter;$$('[data-catalog-filter]').forEach(b=>b.classList.toggle('selected',b===target));renderGiftCatalog();sound();return;}
    if(target.matches('[data-jump]')) {setView(target.dataset.jump);return;}
    if(target.matches('[data-open-case]')) {openCase(target.dataset.openCase);sound();return;}
    if(target.matches('[data-claim-case]')) {claimFree(target.dataset.claimCase);return;}
    if(target.matches('[data-qty]')) {selectQuantity(target.dataset.qty);sound();return;}
    if(target.matches('[data-back]')) {setView(target.dataset.back||'home');return;}
    if(target.id==='open-case-btn') {openSelectedCase();return;}
    if(target.id==='topup-btn'||target.id==='balance-pill') {showTopupModal();return;}
    if(target.matches('[data-topup]')) {topupAmount(Number(target.dataset.topup));return;}
    if(target.id==='search-toggle') {$('#search-box').classList.toggle('hidden');$('#search-input').focus();return;}
    if(target.id==='search-close') {S.search='';$('#search-input').value='';$('#search-box').classList.add('hidden');renderHome();return;}
    if(target.id==='sort-btn') {S.caseSort=!S.caseSort;target.classList.toggle('selected',S.caseSort);renderHome();return;}
    if(target.id==='promo-redeem') {redeemPromo();return;}
    if(target.id==='referral-share') { shareReferral(); return; }
    if(target.id==='sound-toggle') {S.muted=!S.muted;localStorage.setItem('ngc-muted',S.muted?'1':'0');syncSoundButton();sound('click');return;}
    if(target.id==='profile-btn') {setView('inventory');return;}
    if(target.id==='more-btn') {openModal(`<h2 id="modal-title" class="modal-title">NftGiftCase</h2><p class="modal-copy">Цифровая коллекция, кейсы и апгрейдер. Оплаты проходят через Telegram Stars, а предметы и балансы ведутся на сервере.</p><div class="modal-actions"><button class="secondary-btn" data-jump="inventory">Мои предметы</button><button class="primary-btn" data-modal-action="help">Помощь</button></div>`);return;}
    if(target.id==='search-toggle')return;
    if(target.id==='target-select-btn'||target.id==='target-card') {showTargetModal();return;}
    if(target.matches('[data-choose-target]')) {const item=allTargetItems().find(i=>i.id===target.dataset.chooseTarget);if(item)chooseTarget(item);closeModal();return;}
    if(target.matches('[data-target-item]')) {const item=allTargetItems().find(i=>i.id===target.dataset.targetItem);if(item){chooseTarget(item);setView('upgrade');}return;}
    if(target.matches('[data-mult]')) {S.upgradeMultiplier=Number(target.dataset.mult);const targetItem=S.selectedTarget||allTargetItems()[0];S.upgradeBet=Math.max(1,Math.floor(Number(targetItem?.value_stars||20)/S.upgradeMultiplier));$$('[data-mult]').forEach(b=>b.classList.toggle('active',b===target));updateUpgradeChance();return;}
    if(target.id==='upgrade-btn') {performUpgrade();return;}
    if(target.id==='upgrade-info') {openModal(`<h2 class="modal-title" id="modal-title">Как работает апгрейд</h2><p class="modal-copy">Сумма ставки списывается с внутреннего баланса. Сервер рассчитывает шанс по формуле ставка / стоимость целевого предмета и проводит случайный бросок на сервере. При неудаче ставка не возвращается. В демонстрационном режиме результат локальный и не имеет денежной ценности.</p>`);return;}
    if(target.matches('[data-withdraw]')) {showWithdrawConfirm(target.dataset.withdraw);return;}
    if(target.matches('[data-confirm-withdraw]')) {withdraw(target.dataset.confirmWithdraw);return;}
    if(target.id==='admin-shortcut'||target.id==='admin-shortcut-wrap') {setView('admin');return;}
    if(target.id==='admin-credit-btn') {adminBalance('add');return;} if(target.id==='admin-debit-btn') {adminBalance('subtract');return;}
    if(target.id==='admin-case-save') {adminSaveCase();return;} if(target.id==='admin-create-case') {adminCreateCase();return;} if(target.id==='admin-add-item') {adminAddItem();return;} if(target.matches('[data-admin-remove-item]')) {adminRemoveItem(target.dataset.adminRemoveItem);return;} if(target.id==='admin-promo-create') {adminCreatePromo();return;} if(target.id==='admin-event-save') {adminSaveEvent();return;}
    if(target.matches('[data-event-tab]')) {$$('[data-event-tab]').forEach(b=>b.classList.toggle('selected',b===target));const quests=target.dataset.eventTab==='quests';$('#pass-levels').classList.toggle('hidden',quests);$('#quests-list').classList.toggle('hidden',!quests);return;}
    if(target.matches('[data-claim-level]')) {claimLevel(Number(target.dataset.claimLevel),target.dataset.branch||'free');return;}
    if(target.matches('[data-claim-quest]')) {claimQuest(target.dataset.claimQuest);return;}
    if(target.id==='premium-pass-btn') {buyPremiumPass();return;}
    if(target.matches('[data-advent-day]')) {claimAdventDay(Number(target.dataset.adventDay));return;}
    if(target.id==='create-battle-btn') {createBattle();return;}
    if(target.matches('[data-join-battle]')) {joinBattle(target.dataset.joinBattle);return;}
    if(target.matches('[data-demo-battle]')) {toast('DEMO: матчи не выполняются без backend.','error');return;}
    if(target.matches('[data-copy-ref]')) { navigator.clipboard?.writeText(target.dataset.copyRef).then(()=>{closeModal();toast('Ссылка скопирована','success');}).catch(()=>toast(target.dataset.copyRef,'info'));return;}
    if(target.dataset.modalAction==='subscribe') {tg?.openTelegramLink ? tg.openTelegramLink('https://t.me/NftGiftCaseNews') : window.open('https://t.me/NftGiftCaseNews','_blank','noopener,noreferrer');return;}
    if(target.dataset.modalAction==='check-subscription') {checkSubscription(target.dataset.caseId);return;}
    if(target.dataset.modalAction==='telegram-help') {closeModal();setView('home');toast('Настройте URL Mini App у BotFather и откройте приложение через бота.','info');return;}
    if(target.dataset.modalAction==='open-settings') {tg?.openLink?.('https://t.me/NftGiftCase');return;}
    if(target.dataset.modalAction==='help') {closeModal();openModal(`<h2 class="modal-title" id="modal-title">Помощь</h2><p class="modal-copy">Если платёж прошёл, но предмет не отобразился, дождитесь Telegram webhook и обновите приложение. Не отправляйте токен бота никому.</p>`);return;}
    if(target.matches('[data-jump="inventory"]')) {closeModal();setView('inventory');return;}
  }

  async function onInput(event) {
    if(event.target.id==='search-input'){S.search=event.target.value;renderHome();}
    if(event.target.id==='gift-catalog-search'){S.catalogSearch=event.target.value;renderGiftCatalog();}
    if(event.target.id==='bet-range'){S.upgradeBet=Number(event.target.value);updateUpgradeChance();}
    if(event.target.id==='admin-case-select')fillAdminCase();
    if(event.target.id==='admin-event-type'&&MOCK){const title=event.target.value==='advent'?'Адвент-календарь':'Halloween Pass';$('#admin-event-title').value=title;}
  }

  // SVG wheel ticks are decorative and are rendered once; all drop images are PNGs from the project asset CDN.
  document.addEventListener('error', event => { const img = event.target; if (!(img instanceof HTMLImageElement) || !img.dataset.catalogFallback) return; const fallback = img.dataset.catalogFallback; if (fallback.startsWith('https://cdn.jsdelivr.net/')) { img.dataset.catalogFallback = './assets/gift-box.png'; img.src = fallback; } else { delete img.dataset.catalogFallback; img.src = asset(fallback); } }, true);
  document.addEventListener('click',event=>{ const button=event.target.closest('button'); if(button) sound('click'); handleClick(event); });
  document.addEventListener('input',onInput);
  document.addEventListener('change',onInput);
  $('#modal-root').addEventListener('click',event=>{if(event.target.matches('[data-close-modal]'))closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});
  if(tg?.BackButton) { tg.BackButton.onClick(()=>setView('home')); }
  window.addEventListener('focus',()=>{if(!MOCK)refreshUserData();});
  window.setInterval(()=>{if(!MOCK&&document.visibilityState==='visible')api('/api/live-wins').then(r=>{S.wins=r.wins;renderLive();}).catch(()=>{});},8000);
  window.addEventListener('error',event=>console.error('NftGiftCase UI error',event.message));
  syncSoundButton(); loadAll();
})();
