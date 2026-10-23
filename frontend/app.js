(() => {
  'use strict';
  const cfg = window.NGC_CONFIG || { apiBase: '', mockMode: true };
  const API_BASE = String(cfg.apiBase || '').replace(/\/$/, '');
  const MOCK = Boolean(cfg.mockMode) || !API_BASE;
  const tg = window.Telegram?.WebApp;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const S = {
    view: 'home', filter: 'all', search: '', cases: [], currentCase: null, quantity: 1,
    balance: 0, user: null, isAdmin: false, inventory: [], wins: [], config: {}, eventData: null, globalDisplay: null,
    adminOverview: null, offers: [], broadcastRunning: false, selectedTarget: null, themeMode: 'normal', upgradeBet: 5, upgradeMultiplier: 2, muted: localStorage.getItem('ngc-muted') === '1',
    demoInventory: [], lastSpin: null, caseSort: false,
    marketListings: [], craftSelected: [], collections: [], showcase: null, showcaseTargetId: null
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
  const mockEvent = { enabled: true, event_type: 'season_map', title: 'Halloween: Путь к сокровищу', ends_at: '2026-11-07T00:00:00Z', premium_price_xtr: 666 };
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
    if (!response.ok || data.ok === false) {
      const error = new Error(data.message || data.error || `Ошибка API (${response.status})`);
      error.code = data.error || data.code || '';
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function applyTheme(mode) {
    const theme = mode === 'halloween' ? 'halloween' : 'normal';
    S.themeMode = theme;
    document.documentElement.dataset.theme = theme;
    const halloweenBanner = $('#halloween-theme-banner');
    if (halloweenBanner) halloweenBanner.classList.toggle('hidden', theme !== 'halloween');
    const themeToggle = $('#admin-theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'halloween' ? '↩️ Вернуть обычный интерфейс' : '🎃 Включить Halloween';
      themeToggle.classList.toggle('halloween-restore-btn', theme === 'halloween');
    }
    const themeStatus = $('#admin-theme-status');
    if (themeStatus) themeStatus.textContent = theme === 'halloween'
      ? '🎃 Halloween включён. Оформление изменено у всех игроков.'
      : '✨ Сейчас используется обычное оформление GiftCase.';
    const themeColor = theme === 'halloween' ? '#170b19' : '#171a29';
    const backgroundColor = theme === 'halloween' ? '#100811' : '#0f1016';
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = themeColor;
    try {
      tg?.setHeaderColor?.(themeColor);
      tg?.setBackgroundColor?.(backgroundColor);
      tg?.setBottomBarColor?.(themeColor);
    } catch { /* Theme colors are optional on older Telegram clients. */ }
  }

  async function loadTheme() {
    if (MOCK) { applyTheme(S.themeMode); return; }
    try {
      const result = await api('/api/theme');
      applyTheme(result.theme);
    } catch (err) {
      console.warn('Unable to load global theme:', err.message);
      applyTheme(S.themeMode);
    }
  }

  async function toggleAdminTheme() {
    if (!S.isAdmin) return toast('Доступ запрещён', 'error');
    const nextTheme = S.themeMode === 'halloween' ? 'normal' : 'halloween';
    const button = $('#admin-theme-toggle');
    if (MOCK) {
      applyTheme(nextTheme);
      return toast('DEMO: тема переключена только в текущем окне, сервер не изменён', 'info', 4500);
    }
    if (button) button.disabled = true;
    try {
      const result = await api('/api/admin/theme', { method:'PATCH', body:{ theme:nextTheme } });
      applyTheme(result.theme);
      toast(result.message || 'Тема приложения обновлена', 'success', 4500);
    } catch (err) {
      toast(err.message || 'Не удалось сменить оформление', 'error', 5000);
    } finally {
      if (button) button.disabled = false;
    }
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
    if (view === 'shop') loadOffers().catch(err => { if (err.code === 'SUBSCRIPTION_REQUIRED') showMandatorySubscriptionModal(err.message); else console.warn('Shop refresh failed:', err.message); });
    if (view === 'market') loadMarket();
    if (view === 'craft') renderCraft();
    if (view === 'showcase') loadShowcase(S.showcaseTargetId);
    if (view === 'collections') loadCollections();
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
    S.cases = structuredClone(mockCases); S.wins = mockWins; S.config = { event: mockEvent, channel: '@NftGiftCaseNews' }; S.globalDisplay = { message_enabled:0, message_title:'Новости NftGiftCase', message_body:'', timer_enabled:0, timer_title:'До завершения события', timer_ends_at:null };
    S.offers = [{id:'demo-offer-1',title:'Golden Starter Pack',description:'Коллекционный подарок + бонусные кредиты. Только для демонстрации.',image_url:'case-rich.png',price_credits:100,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),max_purchases:50,per_user_limit:1,sold_count:13,reward_item_title:'Blue Ring',reward_item_image:'ring.png',reward_credits:50,remaining:37,user_remaining:1}];
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
      await loadTheme();
      await loadGlobalDisplay();
      try { await loadOffers(); } catch (offerError) { console.warn('Limited offers are unavailable:', offerError.message); }
      renderAll();
      if (S.isAdmin) { $('#admin-shortcut-wrap').classList.remove('hidden'); }
      if (!currentInitData()) toast('Откройте приложение из Telegram-бота для авторизации.', 'error', 5000);
    } catch (err) {
      renderAll();
      if (err.code === 'SUBSCRIPTION_REQUIRED') {
        showMandatorySubscriptionModal(err.message);
        return;
      }
      toast(`Не удалось загрузить данные: ${err.message}`, 'error', 6500);
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
    const tag = free ? 'Бесплатное открытие' : `${money(c.price_xtr, 'Stars')}`;
    const label = free ? 'Открыть бесплатно' : 'Открыть';
    const button = free ? `<button class="tag-price free" data-claim-case="${esc(c.id)}">${label}</button>` : `<button class="tag-price" data-open-case="${esc(c.id)}">${starSvg()} ${esc(c.price_xtr)} Stars</button>`;
    return `<article class="case-card" data-case-card="${esc(c.id)}"><button class="case-card-main" data-open-case="${esc(c.id)}" aria-label="Открыть ${esc(c.title)}"><div class="case-art"><img loading="lazy" src="${image}" alt="${esc(c.title)}" /></div><div class="case-card-title">${esc(c.title)}</div></button><div class="case-card-foot"><span class="tag-label">${esc(tag)}</span>${button}</div></article>`;
  }
  function renderHome() {
    // The old hard-coded free panel (daily + nft-mini) is intentionally no longer rendered.
    // Admin-created free cases remain discoverable in the cases grid and keep their free-claim action.
    const items = filteredCases().filter(c => !['daily','nft-mini'].includes(String(c.id)));
    $('#case-grid').innerHTML = items.map(c => cardMarkup(c, Number(c.is_free) === 1)).join('') || `<div class="empty-inline">Ничего не найдено</div>`;
    if (S.isAdmin) $('#admin-shortcut-wrap')?.classList.remove('hidden');
  }
  function offerDate(value, options = {}) {
    if (!value) return '—'; const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',...options});
  }
  function offerTimeLeft(value) {
    const ms = new Date(value).getTime() - Date.now(); if (!Number.isFinite(ms) || ms <= 0) return 'Завершено';
    const mins = Math.floor(ms / 60000); const days = Math.floor(mins / 1440); const hours = Math.floor((mins % 1440) / 60); const minutes = mins % 60;
    if (days > 0) return `Осталось ${days} дн. ${hours} ч.`;
    if (hours > 0) return `Осталось ${hours} ч. ${minutes} мин.`;
    return `Осталось ${Math.max(1,minutes)} мин.`;
  }
  function offerCardMarkup(offer, compact = false) {
    const image = imageSrc(offer.reward_item_image || offer.image_url || 'gift-box.png');
    const reward = [offer.reward_item_title, Number(offer.reward_credits||0)>0?`+ ${Number(offer.reward_credits).toLocaleString('ru-RU')} ★`:null].filter(Boolean).join(' ')
      || (Number(offer.reward_credits||0)>0?`${Number(offer.reward_credits).toLocaleString('ru-RU')} ★`: 'Специальный набор');
    const stock = offer.remaining == null ? 'Количество не ограничено' : `Осталось ${Math.max(0,Number(offer.remaining))} из ${Number(offer.max_purchases)}`;
    const price = Number(offer.price_credits||0) === 0 ? 'Бесплатно' : `${Number(offer.price_credits).toLocaleString('ru-RU')} ★`;
    return `<article class="limited-offer-card${compact?' compact':''}"><div class="limited-offer-art"><img loading="lazy" src="${esc(image)}" alt="${esc(offer.title)}"/><span class="limited-offer-stamp">LIMITED</span></div><div class="limited-offer-info"><div class="limited-offer-kicker">⏳ ${esc(offerTimeLeft(offer.ends_at))}</div><h3>${esc(offer.title)}</h3><p>${esc(offer.description||'Специальный набор GiftCase')}</p><div class="limited-offer-reward">🎁 ${esc(reward)}</div><div class="limited-offer-meta"><span>${esc(stock)}</span><span>До ${esc(offerDate(offer.ends_at))}</span></div><div class="limited-offer-buy"><strong>${esc(price)}</strong><button class="small-primary" data-buy-offer="${esc(offer.id)}">${Number(offer.price_credits||0)===0?'Забрать':'Купить'}</button></div></div></article>`;
  }
  function renderOffers() {
    const now=Date.now(); const offers = (Array.isArray(S.offers) ? S.offers : []).filter(o => Number(o.active ?? 1)!==0 && new Date(o.starts_at).getTime()<=now && new Date(o.ends_at).getTime()>now && (o.remaining==null||Number(o.remaining)>0) && (o.user_remaining==null||Number(o.user_remaining)>0));
    const homeSection=$('#home-offers-section'); const homeGrid=$('#home-offers-grid'); const shopGrid=$('#shop-offers-grid'); const shopEmpty=$('#shop-offers-empty');
    if(homeSection&&homeGrid){homeSection.classList.toggle('hidden',!offers.length);homeGrid.innerHTML=offers.slice(0,2).map(o=>offerCardMarkup(o,true)).join('');}
    if(shopGrid){shopGrid.innerHTML=offers.map(o=>offerCardMarkup(o,false)).join('');}
    if(shopEmpty)shopEmpty.classList.toggle('hidden',offers.length>0);
  }
  async function loadOffers() {
    if (MOCK) { renderOffers(); return; }
    const result=await api('/api/offers'); S.offers=result.offers||[]; renderOffers();
  }
  function showOfferPurchaseConfirm(offerId) {
    const offer=(S.offers||[]).find(o=>String(o.id)===String(offerId)); if(!offer)return toast('Предложение больше недоступно','error');
    if(MOCK)return toast('DEMO: покупка набора не сохраняется на сервере','info');
    const cost=Number(offer.price_credits||0)===0?'бесплатно':`${Number(offer.price_credits).toLocaleString('ru-RU')} внутренних кредитов ★`;
    openModal(`<h2 class="modal-title" id="modal-title">Подтвердить покупку</h2><p class="modal-copy">Купить набор «${esc(offer.title)}» за <b>${esc(cost)}</b>?<br/><br/>Награда: ${esc(offer.reward_item_title||'без предмета')}${Number(offer.reward_credits||0)>0?` + ${Number(offer.reward_credits).toLocaleString('ru-RU')} внутренних кредитов`:''}.<br/>Осталось: ${esc(offerTimeLeft(offer.ends_at))}.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-offer="${esc(offer.id)}">Подтвердить</button></div>`);
  }
  async function purchaseOffer(offerId) {
    if(!S.isAdmin&&MOCK)return toast('DEMO: покупка не выполняется','info');
    const btn=$(`[data-confirm-offer="${CSS.escape(String(offerId))}"]`); if(btn)btn.disabled=true;
    try { const result=await api(`/api/offers/${encodeURIComponent(offerId)}/purchase`,{method:'POST',body:{}}); closeModal(); toast(result.message||'Набор куплен','success'); if(result.balance!==undefined){S.balance=Number(result.balance);renderBalance();} await refreshUserData(); await loadOffers(); setView(S.view==='shop'?'shop':'home'); }
    catch(err){toast(err.message,'error',5500);try{await loadOffers();}catch{}}
    finally{if(btn)btn.disabled=false;}
  }

  function toLocalDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0,16);
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

  function renderGlobalDisplay() {
    const settings = S.globalDisplay || {};
    const messageEnabled = Boolean(Number(settings.message_enabled ?? settings.messageEnabled ?? 0)) && Boolean(String(settings.message_body ?? settings.messageBody ?? '').trim());
    const timerEnabled = Boolean(Number(settings.timer_enabled ?? settings.timerEnabled ?? 0));
    const wrapper = $('#global-display');
    if (!wrapper) return;
    wrapper.classList.toggle('hidden', !messageEnabled && !timerEnabled);
    $('#global-message-card').classList.toggle('hidden', !messageEnabled);
    $('#global-timer-card').classList.toggle('hidden', !timerEnabled);
    $('#global-message-title').textContent = String(settings.message_title || settings.messageTitle || 'Новости NftGiftCase');
    $('#global-message-text').textContent = String(settings.message_body || settings.messageBody || '');
    $('#global-timer-title').textContent = String(settings.timer_title || settings.timerTitle || 'До завершения события');
    updateGlobalCountdown();
  }
  function updateGlobalCountdown() {
    const settings = S.globalDisplay || {};
    const node = $('#global-countdown');
    if (!node) return;
    const raw = settings.timer_ends_at || settings.timerEndsAt;
    const baseTitle = String(settings.timer_title || settings.timerTitle || 'До завершения события');
    $('#global-timer-title').textContent = baseTitle;
    if (!raw) { node.textContent = '--:--:--'; return; }
    const end = new Date(raw).getTime();
    if (!Number.isFinite(end)) { node.textContent = 'Проверь дату'; return; }
    const remaining = Math.max(0, end - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    node.textContent = days > 0 ? `${days}д ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}` : `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
    node.classList.toggle('is-expired', totalSeconds === 0);
    if (totalSeconds === 0) $('#global-timer-title').textContent = `${baseTitle} · завершён`;
  }
  async function loadGlobalDisplay() {
    if (MOCK) { renderGlobalDisplay(); return; }
    try { const result = await api('/api/global-display'); S.globalDisplay = result.settings || null; renderGlobalDisplay(); }
    catch (err) { console.warn('Global display is not available yet:', err.message); }
  }
  function renderProfileAvatar() {
    const button = $('#profile-btn'); if (!button) return;
    const tgUser = tg?.initDataUnsafe?.user;
    const photo = tgUser?.photo_url;
    const fallback = String(tgUser?.first_name || S.user?.first_name || '•').trim().slice(0,1).toUpperCase() || '•';
    button.innerHTML = photo ? `<img class="player-avatar-image" src="${esc(photo)}" alt="Аватар игрока" referrerpolicy="no-referrer"/><span class="online-dot"></span>` : `${esc(fallback)}<span class="online-dot"></span>`;
    button.setAttribute('aria-label', `Профиль ${esc(tgUser?.first_name || S.user?.first_name || 'игрока')}`);
  }
  function renderAll() {
    renderProfileAvatar(); renderBalance(); renderLive(); renderHome(); renderOffers(); renderInventory(); renderUpgrade(); renderEvent(); renderGlobalDisplay();
    syncAdminNavigation();
  }

  function openCase(caseId) {
    const c = caseById(caseId); if (!c) return toast('Кейс не найден', 'error');
    S.currentCase = c; S.quantity = 1;
    $('#case-title').textContent = c.title; $('#case-subtitle').textContent = c.description || 'Предметы, которые могут выпасть';
    $('#case-price').textContent = Number(c.is_free) ? 'Бесплатно после подписки' : `${c.price_xtr} Stars или кредитов / открытие`;
    $$('.qty-chip').forEach(b => b.classList.toggle('active', b.dataset.qty === '1'));
    const balanceOpenButton = $('#open-case-balance-btn');
    if (balanceOpenButton) {
      balanceOpenButton.classList.toggle('hidden', Boolean(Number(c.is_free)));
      balanceOpenButton.textContent = `Открыть за ${Number(c.price_xtr)} кредитов`;
    }
    renderRoulette(c); renderOdds(c); $('#open-case-btn').textContent = Number(c.is_free) ? 'Забрать подарок' : `Оплатить ${c.price_xtr} Stars`;
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
    if (S.currentCase) {
      const total = Number(S.currentCase.price_xtr) * S.quantity;
      $('#open-case-btn').textContent = Number(S.currentCase.is_free) ? 'Забрать подарок' : `Оплатить ${total} Stars`;
      const balanceOpenButton = $('#open-case-balance-btn');
      if (balanceOpenButton) balanceOpenButton.textContent = `Открыть за ${total} кредитов`;
    }
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
    try { const result = await api('/api/subscription/status?refresh=1'); if (!result.subscribed) return toast('Подписка пока не обнаружена. Нажмите «Проверить подписку» ещё раз после подписки.', 'error'); closeModal(); await claimFree(caseId); }
    catch (err) { toast(err.message, 'error'); }
  }
  function showMandatorySubscriptionModal(message = 'Чтобы пользоваться NftGiftCase, подпишитесь на канал и подтвердите подписку.') {
    openModal(`<div class="subscription-gate"><div class="subscription-gate-icon">✦</div><h2 class="modal-title" id="modal-title">Подписка обязательна</h2><p class="modal-copy">${esc(message)}<br/><br/>1. Подпишитесь на @NftGiftCaseNews.<br/>2. Вернитесь сюда и нажмите «Подтвердить подписку».</p><div class="modal-actions subscription-gate-actions"><button class="secondary-btn" data-modal-action="subscribe">📢 Открыть канал</button><button class="primary-btn" data-check-global-subscription>✅ Подтвердить подписку</button></div></div>`);
  }
  async function checkGlobalSubscription() {
    try {
      const result = await api('/api/subscription/status?refresh=1');
      if (!result.subscribed) return toast(result.error || 'Подписка не найдена. Проверь, что бот является администратором канала @NftGiftCaseNews, затем повтори проверку.', 'error', 7000);
      closeModal();
      await loadAll();
    } catch (err) {
      if (err.code === 'SUBSCRIPTION_REQUIRED') showMandatorySubscriptionModal(err.message);
      else toast(err.message, 'error', 5000);
    }
  }
  function chooseMockDrop(c) {
    const items = c?.items || mockItems; const sum = items.reduce((v,i)=>v+Number(i.weight||1),0); let r=Math.random()*sum;
    for (const item of items) { r-=Number(item.weight||1); if (r<=0) return item; } return items[0];
  }
  async function openSelectedCase(paymentMethod = 'stars') {
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
        $('#open-case-btn').disabled=false; $('#open-case-btn').textContent=`Оплатить ${Number(c.price_xtr)*S.quantity} Stars`; const balanceBtn=$('#open-case-balance-btn'); if(balanceBtn) balanceBtn.textContent=`Открыть за ${Number(c.price_xtr)*S.quantity} кредитов`;
        toast(`Выпало: ${items.map(i=>i.title).join(', ')}`, 'success'); sound('win'); renderLive(); renderInventory(); renderOdds(c);
      },1800); return;
    }
    if (paymentMethod === 'balance') {
      try {
        const button = $('#open-case-balance-btn');
        if (button) button.disabled = true;
        $('#open-case-btn').disabled = true;
        const result = await api('/api/cases/open-with-balance', { method:'POST', body:{ caseId:c.id, quantity:S.quantity } });
        const items = result.items || [];
        const track = $('#roulette-track');
        track.style.transition = 'transform 1.7s cubic-bezier(.08,.7,.12,1)';
        track.style.transform = `translateX(-${122 * (Math.floor(track.children.length / 2) + Math.floor(Math.random() * 2))}px)`;
        for (let i=0;i<8;i++) setTimeout(()=>sound('tick'),i*120);
        setTimeout(async()=>{
          track.style.transition='none'; track.style.transform='translateX(0)';
          if (button) button.disabled = false;
          $('#open-case-btn').disabled = false;
          toast(`Выпало: ${items.map(item=>item.title).join(', ')}`, 'success', 5000);
          sound('win'); await refreshUserData();
        },1800);
      } catch (err) {
        const button = $('#open-case-balance-btn'); if (button) button.disabled = false;
        $('#open-case-btn').disabled = false; toast(err.message, 'error', 5000);
      }
      return;
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

  function saleValue(item) { return Math.max(1, Math.floor(Number(item?.value_stars || 0) * 0.7)); }
  function backgroundClass(item) { const key=String(item?.background_key||'default'); return ['default','blue','purple','gold','black'].includes(key)?`gift-bg-${key}`:'gift-bg-default'; }
  function backgroundLabel(key) { return ({default:'Обычный',blue:'Синий',purple:'Фиолетовый',gold:'Золотой',black:'Чёрный · самый редкий'})[String(key||'default')]||'Обычный'; }
  function renderInventory() {
    const items = S.inventory || []; const owned=items.filter(item=>item.status==='owned');
    $('#inventory-count').textContent=String(items.length);
    const sellAll=$('#sell-all-btn');if(sellAll){sellAll.disabled=owned.length===0;sellAll.textContent=owned.length?`Продать всё (${owned.length})`:'Продать всё';}
    $('#inventory-grid').innerHTML=items.map(item=>`<article class="inventory-card ${backgroundClass(item)}"><span class="inventory-tag">${esc(itemKind(item))}</span><img loading="lazy" src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><h3>${esc(item.title)}</h3><p>${esc(money(item.value_stars))} · ${esc(item.status==='withdraw_pending'?'На выводе':'В коллекции')}</p><p class="item-traits"><span>${esc(backgroundLabel(item.background_key))}</span><b>#${esc(item.serial_number||'—')}</b></p>${item.status==='owned'?`<div class="inventory-actions"><button class="small-primary" data-sell="${esc(item.inventory_id)}">Продать за ${saleValue(item)} ★</button><button class="secondary-btn" data-list-market="${esc(item.inventory_id)}">На рынок</button><button class="secondary-btn" data-withdraw="${esc(item.inventory_id)}">Запросить вывод</button></div>`:`<button class="secondary-btn" disabled>На обработке</button>`}</article>`).join('');
    $('#inventory-empty').classList.toggle('visible',items.length===0); $('#inventory-grid').classList.toggle('hidden',items.length===0);
    $('#upgrade-inventory').innerHTML=owned.slice(0,12).map(i=>`<button class="mini-item" data-target-item="${esc(i.item_id)}"><img src="${imageSrc(i.image_url)}" alt="${esc(i.title)}"/><strong>${esc(i.title)}</strong><small>${esc(money(i.value_stars))}</small></button>`).join('') || `<span class="muted-note">Предметы появятся здесь после открытия кейса.</span>`;
  }
  function showSellConfirm(inventoryId) {
    const item = (S.inventory || []).find(i => String(i.inventory_id) === String(inventoryId));
    if (!item || item.status !== 'owned') return toast('Этот предмет уже нельзя продать', 'error');
    const amount = saleValue(item);
    openModal(`<h2 class="modal-title" id="modal-title">Продать подарок?</h2><p class="modal-copy">${esc(item.title)} будет удалён из коллекции. На внутренний баланс будет начислено ${amount} кредитов (70% оценочной стоимости).</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-sell="${esc(inventoryId)}">Продать за ${amount}</button></div>`);
  }
  async function sellItem(inventoryId) {
    const item = (S.inventory || []).find(i => String(i.inventory_id) === String(inventoryId));
    if (!item || item.status !== 'owned') return toast('Этот предмет уже нельзя продать', 'error');
    if (MOCK) {
      const amount = saleValue(item); S.inventory = S.inventory.filter(i=>String(i.inventory_id)!==String(inventoryId));
      S.balance += amount; if (S.user) S.user.balance = S.balance; closeModal(); renderBalance(); renderInventory(); toast(`Предмет продан за ${amount} кредитов (DEMO)`, 'success'); return;
    }
    try {
      const result = await api(`/api/inventory/${encodeURIComponent(inventoryId)}/sell`, { method:'POST', body:{} });
      closeModal(); toast(`Продано за ${Number(result.saleValue).toLocaleString('ru-RU')} кредитов`, 'success'); await refreshUserData();
    } catch(err) { closeModal(); toast(err.message, 'error', 5000); }
  }
  function showSellAllConfirm() {
    const items=(S.inventory||[]).filter(item=>item.status==='owned');
    if(!items.length)return toast('Нет предметов в коллекции для продажи','error');
    const estimate=items.reduce((sum,item)=>sum+saleValue(item),0);
    openModal(`<h2 class="modal-title" id="modal-title">Продать все предметы?</h2><p class="modal-copy">Будут проданы <b>${items.length}</b> предметов из коллекции. Ориентировочное начисление — <b>${estimate.toLocaleString('ru-RU')} кредитов</b> (70% оценочной стоимости). Лоты на рынке и предметы на выводе не затрагиваются.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-sell-all>Продать всё</button></div>`);
  }
  async function sellAllInventory() {
    const button=$('[data-confirm-sell-all]');if(button)button.disabled=true;
    if(MOCK){const items=(S.inventory||[]).filter(item=>item.status==='owned');const amount=items.reduce((sum,item)=>sum+saleValue(item),0);S.inventory=S.inventory.filter(item=>item.status!=='owned');S.balance+=amount;if(S.user)S.user.balance=S.balance;closeModal();renderBalance();renderInventory();toast(`DEMO: продано ${items.length}, начислено ${amount} кредитов`,'success');return;}
    try{const result=await api('/api/inventory/sell-all',{method:'POST',body:{}});closeModal();toast(result.message||`Продано ${result.soldCount} предметов`,'success',5000);await refreshUserData();}
    catch(err){toast(err.message,'error',5000);}finally{if(button)button.disabled=false;}
  }
  function showMarketListingModal(inventoryId) {
    const item=(S.inventory||[]).find(row=>String(row.inventory_id)===String(inventoryId));
    if(!item||item.status!=='owned')return toast('Этот предмет нельзя выставить на рынок','error');
    const suggested=Math.max(1,Math.floor(Number(item.value_stars||1)));
    openModal(`<h2 class="modal-title" id="modal-title">Выставить на рынок</h2><div class="market-modal-item"><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><div><strong>${esc(item.title)}</strong><small>${esc(backgroundLabel(item.background_key))} · #${esc(item.serial_number||'—')}</small></div></div><label>Цена во внутренних кредитах ★<input id="market-listing-price" type="number" min="1" max="1000000000" value="${suggested}"/></label><p class="muted-note">Комиссия 5% удерживается с продажи. Подарок будет временно заблокирован в инвентаре, пока лот активен.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-market-list="${esc(inventoryId)}">Выставить лот</button></div>`);
  }
  async function createMarketListing(inventoryId) {
    const price=Number($('#market-listing-price')?.value); if(!Number.isSafeInteger(price)||price<1||price>1000000000)return toast('Укажи цену от 1 до 1 000 000 000 кредитов','error');
    try{const result=await api('/api/market/listings',{method:'POST',body:{inventoryId,priceCredits:price}});closeModal();toast(result.message,'success');await refreshUserData();await loadMarket();}
    catch(err){toast(err.message,'error',5000);}
  }
  async function loadMarket() {
    if(MOCK){S.marketListings=[];renderMarket();return;}
    try{const data=await api('/api/market/listings');S.marketListings=data.listings||[];S.myMarketListings=data.myListings||[];renderMarket();}
    catch(err){if(err.code==='SUBSCRIPTION_REQUIRED')showMandatorySubscriptionModal(err.message);else toast(`Не удалось загрузить рынок: ${err.message}`,'error',5000);}
  }
  function renderMarket() {
    const listings=S.marketListings||[];
    $('#market-grid').innerHTML=listings.map(item=>`<article class="market-card ${backgroundClass(item)}"><div class="market-item-art"><img loading="lazy" src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><span class="market-serial">#${esc(item.serial_number||'—')}</span></div><div class="market-card-body"><span class="inventory-tag">${esc(itemKind(item))}</span><h3>${esc(item.title)}</h3><p class="item-traits">${esc(backgroundLabel(item.background_key))}</p><p class="market-seller">Продавец: ${esc(item.seller_username?'@'+item.seller_username:item.seller_first_name||'Игрок')}</p><div class="market-price-row"><strong>${Number(item.price_credits).toLocaleString('ru-RU')} ★</strong>${String(item.seller_id)===String(S.user?.telegram_id)?'<button class="secondary-btn" data-cancel-market="'+esc(item.id)+'">Снять</button>':'<button class="small-primary" data-buy-market="'+esc(item.id)+'">Купить</button>'}</div><div class="market-card-links"><button class="text-btn market-profile-link" data-view-showcase="${esc(item.seller_id)}">Витрина →</button><button class="text-btn market-profile-link" data-price-history="${esc(item.item_id)}" data-history-background="${esc(item.background_key||'default')}">История цен ↗</button></div></div></article>`).join('');
    $('#market-empty').classList.toggle('hidden',listings.length>0);
    const mine=S.myMarketListings||[];
    $('#market-my-listings').innerHTML=mine.length?mine.map(item=>`<div class="admin-order"><span><b>${esc(item.title)}</b><br/><small>${Number(item.price_credits).toLocaleString('ru-RU')} ★ · ${esc(item.status==='processing'?'Покупается':'Активен')}</small></span>${item.status==='active'?`<button class="secondary-btn" data-cancel-market="${esc(item.id)}">Снять лот</button>`:'<span class="muted-note">В обработке</span>'}</div>`).join(''):'<p class="muted-note">У тебя пока нет активных объявлений.</p>';
  }
  function confirmMarketBuy(listingId) {
    const item=(S.marketListings||[]).find(row=>String(row.id)===String(listingId));if(!item)return toast('Лот уже недоступен','error');
    if(String(item.seller_id)===String(S.user?.telegram_id))return toast('Нельзя купить собственный лот','error');
    openModal(`<h2 class="modal-title" id="modal-title">Подтвердить покупку?</h2><p class="modal-copy">Ты покупаешь <b>${esc(item.title)}</b>, фон «${esc(backgroundLabel(item.background_key))}», номер #${esc(item.serial_number||'—')} за <b>${Number(item.price_credits).toLocaleString('ru-RU')} кредитов</b>. Передача будет выполнена сервером после списания баланса.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-market-buy="${esc(listingId)}">Купить</button></div>`);
  }
  async function buyMarketListing(listingId) {
    try{const result=await api(`/api/market/listings/${encodeURIComponent(listingId)}/buy`,{method:'POST',body:{}});closeModal();toast(result.message,'success',5000);await refreshUserData();await loadMarket();}
    catch(err){toast(err.message,'error',5000);await loadMarket();}
  }
  async function cancelMarketListing(listingId) {
    try{const result=await api(`/api/market/listings/${encodeURIComponent(listingId)}/cancel`,{method:'POST',body:{}});toast(result.message,'success');await refreshUserData();await loadMarket();}
    catch(err){toast(err.message,'error',5000);await loadMarket();}
  }
  function renderCraft() {
    const available=(S.inventory||[]).filter(item=>item.status==='owned');
    const validIds=new Set(available.map(item=>String(item.inventory_id)));
    S.craftSelected=(S.craftSelected||[]).filter(id=>validIds.has(String(id)));
    const selectedIds=new Set(S.craftSelected);const selected=available.filter(item=>selectedIds.has(String(item.inventory_id)));
    $('#craft-selection-count').textContent=`${selected.length} / 4`;
    const button=$('#craft-run-btn');if(button){button.disabled=selected.length<2||selected.length>4||new Set(selected.map(item=>item.item_id)).size>1;button.textContent=selected.length<2?'Выбери минимум 2 подарка':selected.length>4?'Можно выбрать максимум 4':`Создать новый вариант (${selected.length})`;}
    $('#craft-material-grid').innerHTML=available.map(item=>`<label class="craft-material-card ${backgroundClass(item)} ${selectedIds.has(String(item.inventory_id))?'selected':''}"><input type="checkbox" data-craft-select value="${esc(item.inventory_id)}" ${selectedIds.has(String(item.inventory_id))?'checked':''}/><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><small>${esc(backgroundLabel(item.background_key))} · #${esc(item.serial_number||'—')}</small></label>`).join('')||'<p class="muted-note">Нет предметов для крафта. Открой кейс или купи лот на рынке.</p>';
  }
  function toggleCraftSelection(inventoryId, checked) {
    const item=(S.inventory||[]).find(row=>String(row.inventory_id)===String(inventoryId));if(!item)return;
    let selected=(S.craftSelected||[]).slice();
    if(checked){
      if(selected.length>=4){toast('Можно выбрать не больше 4 предметов','error');return renderCraft();}
      const first=(S.inventory||[]).find(row=>String(row.inventory_id)===String(selected[0]));
      if(first&&first.item_id!==item.item_id){toast('Для одного крафта выбирай только одинаковые подарки','error');return renderCraft();}
      if(!selected.includes(String(inventoryId)))selected.push(String(inventoryId));
    } else selected=selected.filter(id=>id!==String(inventoryId));
    S.craftSelected=selected;renderCraft();
  }
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  function showCraftAnimation(materials) {
    const overlay=$('#craft-animation-overlay');
    const host=$('#craft-ritual-items');
    $('#craft-ritual-phase').textContent='Пробуждаем атрибуты';
    $('#craft-ritual-caption').textContent='Каждый предмет оставляет свой след';
    $('#craft-ritual-serial').textContent='#????';
    $('#craft-ritual-core').classList.remove('hidden','is-revealed');
    $('#craft-ritual-result').classList.add('hidden');
    host.innerHTML=materials.map((item,i)=>`<div class="craft-orbit-item orbit-${i+1}" style="--orbit-index:${i}"><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><span>${esc(backgroundLabel(item.background_key))}</span></div>`).join('');
    overlay.classList.remove('hidden','is-success','is-failed');
    requestAnimationFrame(()=>overlay.classList.add('is-active'));
  }
  function revealCraftAnimation(item) {
    $('#craft-ritual-phase').textContent='НОВЫЙ ЭКЗЕМПЛЯР СОЗДАН';
    $('#craft-ritual-caption').textContent=`${backgroundLabel(item.background_key||item.background)} · ${backgroundLabel(item.background_key||item.background)==='Чёрный · самый редкий'?'ЛЕГЕНДАРНАЯ НАХОДКА':'АТРИБУТ ЗАКРЕПЛЁН'}`;
    $('#craft-ritual-serial').textContent=`#${item.serial_number||item.serialNumber||'—'}`;
    $('#craft-ritual-core').classList.add('hidden');
    const result=$('#craft-ritual-result');
    result.innerHTML=`<img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><span>${esc(backgroundLabel(item.background_key||item.background))}</span>`;
    result.classList.remove('hidden');
    $('#craft-animation-overlay').classList.add('is-success');
  }
  function closeCraftAnimation() {
    const overlay=$('#craft-animation-overlay');overlay.classList.remove('is-active');
    window.setTimeout(()=>{overlay.classList.add('hidden');overlay.classList.remove('is-success','is-failed');},420);
  }
  async function performCraft() {
    const ids=S.craftSelected||[];if(ids.length<2||ids.length>4)return toast('Выбери от 2 до 4 одинаковых предметов','error');
    if(MOCK)return toast('Крафт работает только с подключённым сервером и сохранённым инвентарём','error',5000);
    const button=$('#craft-run-btn');button.disabled=true;
    const materials=(S.inventory||[]).filter(item=>ids.includes(String(item.inventory_id)));
    showCraftAnimation(materials);
    let answer=null;let problem=null;
    const pending=api('/api/craft',{method:'POST',body:{inventoryIds:ids}}).then(value=>{answer=value;}).catch(err=>{problem=err;});
    try{
      await wait(2600);
      await pending;
      if(problem) throw problem;
      $('#craft-ritual-phase').textContent='Атрибуты объединяются…';
      await wait(650);
      revealCraftAnimation(answer.item||{});
      S.craftSelected=[];
      await wait(1800);
      closeCraftAnimation();
      toast(answer.message||'Крафт завершён','success',5500);
      await refreshUserData();renderCraft();
    }catch(err){
      $('#craft-ritual-phase').textContent='Слияние прервано';
      $('#craft-ritual-caption').textContent='Предметы не были потрачены, если сервер отклонил операцию.';
      $('#craft-animation-overlay').classList.add('is-failed');
      $('#craft-ritual-core').classList.remove('hidden');$('#craft-ritual-core').innerHTML='<span>!</span>';
      await wait(850);closeCraftAnimation();toast(err.message,'error',5500);
    }finally{button.disabled=false;renderCraft();}
  }
  function renderPriceChart(history) {
    if(!history.length) return '<div class="price-history-empty"><span>◌</span><strong>Пока нет завершённых сделок</strong><small>График появится после реальных покупок на рынке.</small></div>';
    const vals=history.map(x=>Number(x.price_credits));const min=Math.min(...vals),max=Math.max(...vals);const span=Math.max(1,max-min);
    const points=vals.map((v,i)=>({x:12+(history.length===1?148:i*(296/(history.length-1))),y:82-((v-min)/span)*62}));
    const path=points.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const dots=points.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#ffe29a"><title>${vals[i].toLocaleString('ru-RU')} кредитов</title></circle>`).join('');
    return `<svg class="price-chart-svg" viewBox="0 0 320 100" role="img" aria-label="История цен по завершённым сделкам"><defs><linearGradient id="priceChartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd76a" stop-opacity=".28"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></linearGradient></defs><path d="M ${points[0].x} 94 ${points.map(p=>`L ${p.x} ${p.y}`).join(' ')} L ${points[points.length-1].x} 94 Z" fill="url(#priceChartFill)"/><path d="${path}" fill="none" stroke="#ffd76a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
  }
  async function showPriceHistory(itemId, background='default') {
    if(MOCK)return toast('История цен появится в подключённой версии после первых сделок.','info');
    openModal('<h2 class="modal-title" id="modal-title">История цен</h2><p class="modal-copy">Загружаем реальные сделки…</p>');
    try{
      const data=await api(`/api/market/price-history/${encodeURIComponent(itemId)}?background=${encodeURIComponent(background)}`);
      const summary=data.summary||{};const rows=data.history||[];
      const list=rows.slice(-8).reverse().map(row=>`<div class="price-history-row"><span>${esc(new Date(row.sold_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'}))}<small>${esc(new Date(row.sold_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))}</small></span><b>${Number(row.price_credits).toLocaleString('ru-RU')} ★</b></div>`).join('');
      $('#modal-content').innerHTML=`<h2 class="modal-title" id="modal-title">История цен</h2><div class="price-history-heading"><img src="${imageSrc(data.item.image_url)}" alt="${esc(data.item.title)}"/><div><strong>${esc(data.item.title)}</strong><small>${esc(backgroundLabel(background))} · по завершённым сделкам</small></div></div><div class="price-history-stats"><div><small>Средняя</small><strong>${summary.count?Number(summary.average).toLocaleString('ru-RU')+' ★':'—'}</strong></div><div><small>Минимум</small><strong>${summary.count?Number(summary.min).toLocaleString('ru-RU')+' ★':'—'}</strong></div><div><small>Максимум</small><strong>${summary.count?Number(summary.max).toLocaleString('ru-RU')+' ★':'—'}</strong></div></div>${renderPriceChart(rows)}<div class="price-history-title">Последние сделки · ${Number(summary.count||0)}</div><div class="price-history-list">${list||'<p class="muted-note">Реальных продаж этого варианта пока нет.</p>'}</div>`;
    }catch(err){$('#modal-content').innerHTML=`<h2 class="modal-title" id="modal-title">История цен</h2><p class="modal-copy">Не удалось загрузить историю: ${esc(err.message)}</p>`;}
  }
  async function showCollectorCodex() {
    if(MOCK){openModal(`<h2 class="modal-title" id="modal-title">📖 Кодекс коллекционера</h2><p class="modal-copy">В полной версии здесь появится история твоих находок, крафтов, редких фонов и сделок.</p>`);return;}
    openModal('<h2 class="modal-title" id="modal-title">📖 Кодекс коллекционера</h2><p class="modal-copy">Собираем историю твоих находок…</p>');
    try{
      const {stats}=await api('/api/collector/codex');
      const metrics=[['Найдено типов',stats.uniqueItems],['Все экземпляры',stats.totalFound],['Сейчас в коллекции',stats.currentItems],['Чёрные фоны',stats.blackBackgrounds],['Успешные крафты',stats.crafts],['Продажи на рынке',stats.sales],['Покупки на рынке',stats.purchases],['Завершённые сезоны',stats.seasons]];
      $('#modal-content').innerHTML=`<h2 class="modal-title" id="modal-title">📖 Кодекс коллекционера</h2><p class="modal-copy">Личная летопись GiftCase. Здесь учитываются только реальные предметы и завершённые действия.</p><div class="codex-stats-grid">${metrics.map(([name,value],i)=>`<div class="codex-stat"><span>${['💎','🎁','🧺','🖤','🛠️','💱','🛍️','🏆'][i]}</span><strong>${Number(value||0).toLocaleString('ru-RU')}</strong><small>${esc(name)}</small></div>`).join('')}</div><div class="codex-footnote">История сохраняется между сессиями и не обнуляется при завершении сезона.</div>`;
    }catch(err){$('#modal-content').innerHTML=`<h2 class="modal-title" id="modal-title">Кодекс коллекционера</h2><p class="modal-copy">Не удалось загрузить статистику: ${esc(err.message)}</p>`;}
  }

  async function loadCollections() {
    if(MOCK){S.collections=[];renderCollections();return;}
    try{const result=await api('/api/collections');S.collections=result.collections||[];renderCollections();}
    catch(err){if(err.code==='SUBSCRIPTION_REQUIRED')showMandatorySubscriptionModal(err.message);else toast(`Не удалось загрузить коллекции: ${err.message}`,'error',5000);}
  }
  function renderCollections() {
    const list=S.collections||[];
    $('#seasonal-collections-grid').innerHTML=list.map(c=>`<article class="seasonal-card"><div class="seasonal-art ${String(c.id).includes('halloween')?'seasonal-halloween':''}"><img src="${imageSrc(c.image_url)}" alt="${esc(c.title)}"/></div><div class="seasonal-card-body"><span class="eyebrow">${c.is_live?'СЕЗОН АКТИВЕН':'СКОРО'}</span><h2>${esc(c.title)}</h2><p>${esc(c.description||'Собери все предметы серии до окончания сезона.')}</p><div class="season-progress"><div><span>Прогресс коллекции</span><strong>${Number(c.progress||0)} / ${Number(c.required_count||0)}</strong></div><div class="season-progress-track"><span style="width:${c.required_count?Math.min(100,100*Number(c.progress||0)/Number(c.required_count)):0}%"></span></div></div><div class="seasonal-items-mini">${(c.items||[]).map(item=>`<div class="seasonal-mini-item ${item.owned?'owned':''} ${item.hidden?'secret':''}"><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><span>${esc(item.title)}</span>${item.is_required?'<b>•</b>':''}</div>`).join('')}</div><p class="muted-note">До: ${esc(new Date(c.ends_at).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}))}</p>${c.claimed?`<div class="season-reward-unlocked">✅ Награда получена: ${esc(c.reward_title)}</div>`:c.can_claim?`<button class="primary-btn wide-btn" data-claim-collection="${esc(c.id)}">Забрать титул и рамку</button>`:`<div class="muted-note">Награда: ${esc(c.reward_title)} · завершите обязательную серию</div>`}</div></article>`).join('');
    $('#seasonal-collections-empty').classList.toggle('hidden',list.length>0);
  }
  async function claimSeasonCollection(collectionId) {
    try{const result=await api(`/api/collections/${encodeURIComponent(collectionId)}/claim`,{method:'POST',body:{}});toast(result.message||'Награда разблокирована','success',5500);await loadCollections();await loadShowcase(null);}
    catch(err){toast(err.message,'error',5000);}
  }
  async function loadShowcase(targetId=null) {
    const wanted=targetId===null||targetId===undefined||String(targetId)===''?null:String(targetId);
    try{
      const result=await api(wanted?`/api/showcase/${encodeURIComponent(wanted)}`:'/api/showcase');
      S.showcase=result;S.showcaseTargetId=wanted;renderShowcase();
    }catch(err){$('#showcase-public-profile').innerHTML=`<div class="panel"><p class="muted-note">Не удалось открыть витрину: ${esc(err.message)}</p></div>`;$('#showcase-editor').classList.add('hidden');$('#showcase-empty').classList.add('hidden');}
  }
  function renderShowcase() {
    const data=S.showcase;if(!data)return;
    const mine=Boolean(data.isMine);const profile=data.profile||{};const showcase=data.showcase||{showcase_title:'Коллекционер',frame_key:'default'};
    $('#showcase-public-profile').innerHTML=`<div class="showcase-hero frame-${esc(['default','halloween-gold'].includes(showcase.frame_key)?showcase.frame_key:'default')}"><div class="showcase-avatar">${esc(String(profile.first_name||'G').slice(0,1).toUpperCase())}</div><div class="showcase-owner"><h2>${esc(profile.first_name||'Игрок')} ${profile.username?`<small>@${esc(profile.username)}</small>`:''}</h2><span>${esc(showcase.showcase_title||'Коллекционер')}</span><small>GiftCase · Витрина коллекционера</small></div><span class="showcase-crown">♛</span></div>`;
    $('#showcase-empty').classList.toggle('hidden',(data.items||[]).length>0);
    $('#showcase-editor').classList.toggle('hidden',!mine);
    const featured=data.items||[];
    $('#showcase-public-profile').insertAdjacentHTML('beforeend',`<div class="section-heading section-heading-spaced"><h2>${mine?'Моя коллекция':'Коллекция игрока'}</h2><span class="count-badge">${featured.length} / 6</span></div><div class="showcase-featured-grid">${featured.map(item=>`<article class="showcase-item ${backgroundClass(item)}"><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><small>${esc(backgroundLabel(item.background_key))} · #${esc(item.serial_number||'—')}</small></article>`).join('')}</div>`);
    if(!mine)return;
    const rewards=data.unlockedRewards||[];const titleSelect=$('#showcase-title-select');const frameSelect=$('#showcase-frame-select');
    const oldTitle=showcase.showcase_title||'Коллекционер';const oldFrame=showcase.frame_key||'default';
    titleSelect.innerHTML='<option value="Коллекционер">Коллекционер</option>'+rewards.map(r=>`<option value="${esc(r.reward_title)}">${esc(r.reward_title)}</option>`).join('');
    frameSelect.innerHTML='<option value="default">Стандартная</option>'+rewards.map(r=>`<option value="${esc(r.reward_frame_key)}">${esc(r.reward_title)} · рамка</option>`).join('');
    titleSelect.value=[...titleSelect.options].some(o=>o.value===oldTitle)?oldTitle:'Коллекционер';frameSelect.value=[...frameSelect.options].some(o=>o.value===oldFrame)?oldFrame:'default';
    const available=data.availableItems||[];const featuredIds=new Set(featured.map(item=>String(item.inventory_id)));
    $('#showcase-owned-grid').innerHTML=available.map(item=>`<label class="showcase-pick ${backgroundClass(item)}"><input type="checkbox" data-showcase-pick value="${esc(item.inventory_id)}" ${featuredIds.has(String(item.inventory_id))?'checked':''}/><img src="${imageSrc(item.image_url)}" alt="${esc(item.title)}"/><strong>${esc(item.title)}</strong><small>${esc(backgroundLabel(item.background_key))} · #${esc(item.serial_number||'—')}</small></label>`).join('')||'<p class="muted-note">В инвентаре пока нет предметов.</p>';
  }
  async function saveShowcase() {
    if(MOCK)return toast('Витрина требует подключённый сервер','error');
    const inventoryIds=$$('[data-showcase-pick]:checked').map(el=>el.value);if(inventoryIds.length>6)return toast('Можно выбрать не больше 6 предметов','error');
    try{const result=await api('/api/showcase',{method:'POST',body:{inventoryIds,title:$('#showcase-title-select').value,frameKey:$('#showcase-frame-select').value}});S.showcase=result;renderShowcase();toast(result.message||'Витрина сохранена','success');}
    catch(err){toast(err.message,'error',5000);}
  }
  function openPlayerShowcase(telegramId) { S.showcaseTargetId=String(telegramId); setView('showcase'); }

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
  function chooseTarget(target) {
    if (!target) return;
    S.selectedTarget=target;
    const src = imageSrc(target.image_url);
    $('#target-image').src=src;
    $('#target-title').textContent=target.title;
    $('#target-value').textContent=`Стоимость ${money(target.value_stars)}`;
    const wheelItem = $('#wheel-item-image');
    if (wheelItem) { wheelItem.src = src; wheelItem.alt = `Выбранный подарок: ${target.title}`; }
    updateUpgradeChance();
  }
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

  function defaultEventRewardId(eventType, branch, level) {
    if (eventType === 'advent') return ['daily-teddy','daily-rocket','daily-perfume','daily-ring'][(level - 1) % 4];
    if (branch === 'premium' && level === 30) return 'legend-swan';
    if (branch === 'premium') return ['nft-swan-item','nft-ring-item','nft-rocket-item'][level % 3];
    return ['daily-teddy','daily-rocket','daily-perfume','daily-ring'][level % 4];
  }
  function customEventReward(eventType, branch, level) {
    return (S.eventData?.rewards || []).find(r => r.event_type === eventType && r.branch === branch && Number(r.level) === Number(level));
  }
  function customEventStarReward(eventType, branch, level) {
    return (S.eventData?.starRewards || []).find(r => r.event_type === eventType && r.branch === branch && Number(r.level) === Number(level));
  }
  function renderEvent() {
    const data=S.eventData||{};const settings=data.settings||data.event||mockEvent;
    const beforeEnd=!settings.ends_at||new Date(settings.ends_at).getTime()>Date.now();
    const enabled=(Boolean(Number(settings.enabled)||settings.enabled===true))&&beforeEnd;
    $('#event-title').textContent=enabled?(settings.title||'Карта сезона'):'Карта сезона';
    $('#event-nav-label').textContent=enabled?'Карта сезона':'Скоро';
    $('#event-status').textContent=enabled?'АКТИВЕН':'СКОРО';
    $('#event-soon').classList.toggle('hidden',enabled);
    $('#season-map-content').classList.toggle('hidden',!enabled);
    const progress=data.progress||{xp:0,claimed_free_levels:'[]'};const xp=Number(progress.xp||0);const level=Math.min(30,Math.floor(xp/100)+1);
    $('#season-map-name').textContent=settings.title||'Halloween: Путь к сокровищу';
    $('#pass-xp-value').textContent=`${xp.toLocaleString('ru-RU')} XP`;
    $('#pass-xp-label').textContent=`Узел ${Math.min(30,Math.floor(xp/100)+1)} из 30`;
    $('#season-map-progress-fill').style.width=`${Math.min(100,xp/3000*100)}%`;
    let claimed=[];try{claimed=JSON.parse(progress.claimed_free_levels||'[]');if(!Array.isArray(claimed))claimed=[];}catch{claimed=[];}
    const eventType='season_map';
    const nodes=Array.from({length:30},(_,i)=>{
      const number=i+1,unlocked=xp>=number*100,done=claimed.includes(number);
      const configured=customEventReward(eventType,'free',number);const credits=customEventStarReward(eventType,'free',number);
      const fallback=['gift-box.png','rocket.png','perfume.png','ring.png','nft-swan.png','case-halloween.png'][i%6];
      const visual=credits?`<div class="season-map-credit"><span>★</span><b>+${Number(credits.amount).toLocaleString('ru-RU')}</b></div>`:`<img loading="lazy" src="${configured?.image_url?imageSrc(configured.image_url):asset(number===30?'case-halloween.png':fallback)}" alt="${esc(configured?.title||`Награда узла ${number}`)}"/>`;
      const title=credits?`${Number(credits.amount).toLocaleString('ru-RU')} кредитов`:configured?.title||(['Набор','Ракета','Парфюм','Кольцо','Коллекционный подарок'][i%5]);
      const state=done?'completed':unlocked?'unlocked':'locked';
      const action=done?'Забрано':unlocked?'Забрать':`${number*100} XP`;
      return `<div class="season-map-stop ${state} ${number%5===0?'season-map-milestone':''}"><span class="season-map-stop-connector" aria-hidden="true"></span><article class="season-map-node-card"><div class="season-map-node-top"><span>${number===30?'✧ СЕКРЕТНЫЙ ФИНАЛ':number%5===0?'✦ МИЛСТОУН':'УЗЕЛ '+String(number).padStart(2,'0')}</span><strong>${done?'✓':unlocked?'●':'🔒'}</strong></div><div class="season-map-node-art">${visual}</div><div class="season-map-node-title">${esc(title)}</div><small>${number*100} XP</small><button class="${done?'secondary-btn':'small-primary'}" data-claim-level="${number}" data-branch="free" ${!unlocked||done?'disabled':''}>${action}</button></article></div>`;
    });
    $('#season-map-path').innerHTML=nodes.join('');
    const quests=data.quests||[];
    $('#quests-list').innerHTML=quests.map(q=>`<article class="quest-card"><div><strong>${esc(q.title)}</strong><p>${esc(q.description)}</p><small>${Number(q.progress||0)} / ${Number(q.target)} · +${Number(q.reward_xp)} XP</small></div><button data-claim-quest="${esc(q.id)}" ${q.claimed||Number(q.progress)<Number(q.target)?'disabled':''}>${q.claimed?'Получено':'Забрать XP'}</button></article>`).join('')||'<p class="muted-note">Задания появятся после запуска события.</p>';
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
    try { const result=await api(`/api/event/advent/${day}/claim`,{method:'POST',body:{}});toast(result.message || `Получено: ${result.item?.title || 'награда'}`,'success');await refreshUserData(); } catch(err){toast(err.message,'error');}
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
      S.user=me.user;S.balance=Number(me.user.balance||0);S.isAdmin=Boolean(me.isAdmin);S.cases=cases.cases;S.inventory=inventory.items;S.wins=wins.wins;S.eventData=event;await loadTheme();await loadGlobalDisplay();renderAll();fillAdminRewardSelector();
      if(S.view==='craft')renderCraft();
      if(S.view==='market')await loadMarket();
      if(S.view==='collections')await loadCollections();
      if(S.view==='showcase')await loadShowcase(S.showcaseTargetId);
    } catch(err) {
      console.warn(err);
      if (err.code === 'SUBSCRIPTION_REQUIRED') showMandatorySubscriptionModal(err.message);
    }
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
  function fillAdminRewardSelector() {
    const select = $('#admin-reward-item');
    if (!select) return;
    const current = select.value;
    const items = allTargetItems();
    select.innerHTML = `<option value="">Не выдавать подарок</option>` + items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)} · ${esc(money(item.value_stars))}</option>`).join('');
    if (current && items.some(item=>String(item.id)===current)) select.value=current;
  }
  async function adminReward(withBalance) {
    if (!S.isAdmin) return toast('Доступ запрещён', 'error');
    if (MOCK) return toast('Демо-режим: начисления не сохраняются. Проверь frontend/config.js и опубликуй приложение с API.', 'error', 6000);
    const telegramId = String($('#admin-user-id')?.value || '').trim();
    const itemId = String($('#admin-reward-item')?.value || '').trim();
    const amount = withBalance ? Number($('#admin-balance-amount')?.value) : null;
    if (!/^\d{1,20}$/.test(telegramId)) return toast('Введи корректный Telegram ID пользователя', 'error');
    if (!itemId) return toast('Выбери подарок для выдачи', 'error');
    if (withBalance && (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000)) return toast('Сумма должна быть от 1 до 1 000 000', 'error');
    const giftBtn = $('#admin-gift-btn'); const comboBtn = $('#admin-combo-btn');
    if (giftBtn) giftBtn.disabled = true; if (comboBtn) comboBtn.disabled = true;
    try {
      const result = await api('/api/admin/rewards', { method:'POST', body:{ telegramId, itemId, ...(withBalance ? { amount } : {}) } });
      const parts = [];
      if (result.item) parts.push(`выдан подарок «${result.item.title}»`);
      if (withBalance) parts.push(`начислено ${amount} кредитов`);
      toast(`${parts.join(', ')}. Баланс: ${Number(result.balance||0).toLocaleString('ru-RU')}`, 'success', 5500);
      if (String(S.user?.telegram_id||'') === telegramId) await refreshUserData();
    } catch(err) { toast(err.message, 'error', 5500); }
    finally { if (giftBtn) giftBtn.disabled = false; if (comboBtn) comboBtn.disabled = false; }
  }
  function fillGlobalRewardSelector() {
    const select=$('#admin-global-reward-item');if(!select)return;
    const old=select.value;const items=S.adminOverview?.rewardCatalog||[];
    select.innerHTML='<option value="">Не выдавать подарок</option>'+items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)} · ${esc(money(item.value_stars))}</option>`).join('');
    if(old&&items.some(item=>String(item.id)===old))select.value=old;
  }
  function fillQuestEditor(preferredId='') {
    const select=$('#admin-quest-select');if(!select)return;
    const quests=S.adminOverview?.quests||[];const old=preferredId||select.value;
    select.innerHTML='<option value="">Новый квест…</option>'+quests.map(q=>`<option value="${esc(q.id)}">${esc(q.title)} (${esc(q.id)})${Number(q.active)?'':' · выкл.'}</option>`).join('');
    if(old&&quests.some(q=>q.id===old))select.value=old;
    const current=quests.find(q=>q.id===select.value);
    if(current){$('#admin-quest-id').value=current.id;$('#admin-quest-title').value=current.title;$('#admin-quest-description').value=current.description;$('#admin-quest-target').value=current.target;$('#admin-quest-xp').value=current.reward_xp;$('#admin-quest-trigger').value=current.trigger_event||'manual';$('#admin-quest-active').checked=Boolean(Number(current.active));}
    else if(!old){$('#admin-quest-id').value='';$('#admin-quest-title').value='';$('#admin-quest-description').value='';$('#admin-quest-target').value='1';$('#admin-quest-xp').value='25';$('#admin-quest-trigger').value='case_open';$('#admin-quest-active').checked=true;}
  }
  async function adminSaveQuest() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    if(MOCK)return toast('DEMO: квест не сохраняется на сервере','error');
    const payload={id:$('#admin-quest-id').value.trim().toLowerCase(),title:$('#admin-quest-title').value.trim(),description:$('#admin-quest-description').value.trim(),target:Number($('#admin-quest-target').value),rewardXp:Number($('#admin-quest-xp').value),triggerEvent:$('#admin-quest-trigger').value,active:$('#admin-quest-active').checked};
    if(!payload.id||!payload.title||!payload.description)return toast('Заполни ID, название и описание квеста','error');
    if(!Number.isSafeInteger(payload.target)||payload.target<1||!Number.isSafeInteger(payload.rewardXp)||payload.rewardXp<1)return toast('Цель и XP должны быть положительными целыми числами','error');
    const button=$('#admin-quest-save');button.disabled=true;
    try{const result=await api('/api/admin/quests',{method:'POST',body:payload});toast('Квест сохранён','success');await loadAdmin();fillQuestEditor(result.quest.id);await refreshUserData();}
    catch(err){toast(err.message,'error',5000);}finally{button.disabled=false;}
  }
  let pendingGlobalRewardPayload=null;
  async function adminGlobalReward() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    if(MOCK)return toast('DEMO: массовая раздача недоступна','error');
    const itemId=String($('#admin-global-reward-item').value||'').trim();
    const rawAmount=$('#admin-global-reward-amount').value.trim();
    if(!itemId&&!rawAmount)return toast('Выбери подарок и/или укажи кредиты каждому игроку','error');
    const amount=rawAmount?Number(rawAmount):null;
    if(rawAmount&&(!Number.isSafeInteger(amount)||amount<1||amount>1000000))return toast('Кредиты должны быть от 1 до 1 000 000 на игрока','error');
    const count=Number(S.adminOverview?.userCount||0);
    pendingGlobalRewardPayload={itemId,...(amount!==null?{amount}:{})};
    const item=(S.adminOverview?.rewardCatalog||[]).find(x=>x.id===itemId);
    const parts=[];if(item)parts.push(`подарок «${item.title}»`);if(amount!==null)parts.push(`${amount.toLocaleString('ru-RU')} кредитов каждому`);
    openModal(`<h2 class="modal-title" id="modal-title">💥 Admin Abuse</h2><p class="modal-copy">Подтвердите глобальную раздачу для <b>${count.toLocaleString('ru-RU')}</b> зарегистрированных игроков: ${esc(parts.join(' + '))}. Действие нельзя автоматически отменить.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-confirm-global-reward>Раздать всем</button></div>`);
  }
  async function confirmGlobalReward() {
    if(!pendingGlobalRewardPayload)return closeModal();
    const payload=pendingGlobalRewardPayload;pendingGlobalRewardPayload=null;
    const button=$('[data-confirm-global-reward]');if(button)button.disabled=true;
    try{const result=await api('/api/admin/rewards/all',{method:'POST',body:payload});closeModal();toast(result.message||'Глобальная раздача завершена','success',6500);await loadAdmin();await refreshUserData();}
    catch(err){toast(err.message,'error',6000);}
  }

  function fillOfferRewardSelector() {
    const select=$('#admin-offer-reward-item'); if(!select)return;
    const current=select.value; const items=S.adminOverview?.rewardCatalog||[];
    select.innerHTML='<option value="">Не выдавать предмет</option>'+items.map(i=>`<option value="${esc(i.id)}">${esc(i.title)} · ${esc(i.kind==='nft'?'NFT':'подарок')}</option>`).join('');
    if(current&&items.some(i=>String(i.id)===current))select.value=current;
  }
  function resetOfferEditor() {
    $('#admin-offer-id').value=''; $('#admin-offer-title').value=''; $('#admin-offer-description').value=''; $('#admin-offer-image').value='gift-box.png'; $('#admin-offer-price').value='100';
    $('#admin-offer-start').value=toLocalDateTimeInput(new Date(Date.now()+5*60000).toISOString()); $('#admin-offer-end').value=toLocalDateTimeInput(new Date(Date.now()+24*60*60000).toISOString());
    $('#admin-offer-max').value=''; $('#admin-offer-per-user').value='1'; $('#admin-offer-reward-item').value=''; $('#admin-offer-reward-credits').value='0'; $('#admin-offer-active').checked=true; $('#admin-offer-save').textContent='Создать предложение';
  }
  function fillOfferEditor(offerId) {
    const offer=(S.adminOverview?.offers||[]).find(o=>String(o.id)===String(offerId)); if(!offer)return toast('Предложение не найдено','error');
    $('#admin-offer-id').value=offer.id;$('#admin-offer-title').value=offer.title||'';$('#admin-offer-description').value=offer.description||'';$('#admin-offer-image').value=offer.image_url||'gift-box.png';$('#admin-offer-price').value=offer.price_credits??0;
    $('#admin-offer-start').value=toLocalDateTimeInput(offer.starts_at);$('#admin-offer-end').value=toLocalDateTimeInput(offer.ends_at);$('#admin-offer-max').value=offer.max_purchases??'';$('#admin-offer-per-user').value=offer.per_user_limit??1;$('#admin-offer-reward-item').value=offer.reward_item_id||'';$('#admin-offer-reward-credits').value=offer.reward_credits??0;$('#admin-offer-active').checked=Boolean(Number(offer.active));$('#admin-offer-save').textContent='Сохранить предложение';
    $('#admin-offer-title').scrollIntoView({behavior:'smooth',block:'center'});
  }
  function renderAdminOffers(offers=[]) {
    const list=$('#admin-offers-list');if(!list)return;
    const now=Date.now();
    list.innerHTML=(offers||[]).map(o=>{
      const state=!Number(o.active)?'ОТКЛЮЧЕНО':new Date(o.starts_at).getTime()>now?'ЗАПЛАНИРОВАНО':new Date(o.ends_at).getTime()<=now?'ЗАВЕРШЕНО':o.max_purchases!=null&&Number(o.sold_count)>=Number(o.max_purchases)?'ЛИМИТ ИСЧЕРПАН':'АКТИВНО';
      const stock=o.max_purchases==null?`${Number(o.sold_count||0)} покупок`:`${Number(o.sold_count||0)} / ${Number(o.max_purchases)} куплено`;
      return `<div class="admin-offer-row"><div class="admin-offer-row-main"><strong>${esc(o.title)}</strong><small>${esc(state)} · ${esc(stock)}<br/>${esc(offerDate(o.starts_at))} — ${esc(offerDate(o.ends_at))}<br/>Цена: ${Number(o.price_credits||0).toLocaleString('ru-RU')} ★ · награда: ${esc(o.reward_item_title||'без предмета')}${Number(o.reward_credits||0)>0?` + ${Number(o.reward_credits).toLocaleString('ru-RU')} ★`:''}</small></div><div class="admin-offer-actions"><button class="secondary-btn" data-admin-offer-edit="${esc(o.id)}">Изменить</button><button class="${Number(o.active)?'secondary-btn':'small-primary'}" data-admin-offer-toggle="${esc(o.id)}" data-active="${Number(o.active)?'0':'1'}">${Number(o.active)?'Выключить':'Включить'}</button></div></div>`;
    }).join('')||'<p class="muted-note">Предложений пока нет. Создай первое выше.</p>';
  }
  function renderAdminBroadcasts(items=[]) {
    const list=$('#admin-broadcasts-list');if(!list)return;
    list.innerHTML=(items||[]).map(b=>`<div class="admin-broadcast-row"><div><strong>${esc(b.status==='completed'?'Завершена':'Идёт отправка')}</strong><small>${esc(String(b.message_text||'').slice(0,105))}${String(b.message_text||'').length>105?'…':''}<br/>Отправлено ${Number(b.sent_count||0)} · ошибок ${Number(b.failed_count||0)} · всего ${Number(b.recipient_count||0)}<br/>${esc(offerDate(b.created_at))}</small></div>${b.status==='sending'?`<button class="small-primary" data-admin-broadcast-resume="${esc(b.id)}">Продолжить</button>`:''}</div>`).join('')||'<p class="muted-note">Рассылок пока нет.</p>';
  }
  function renderAdminAudit(items=[]) {
    const list=$('#admin-audit-list');if(!list)return;
    list.innerHTML=(items||[]).map(a=>{
      let details={};try{details=JSON.parse(a.details||'{}')}catch{}
      const label=details.title||details.code||details.path||'';
      return `<div class="admin-audit-row"><strong>${esc(a.action||'Действие')}</strong><small>${esc(label)}${label?' · ':''}${esc(offerDate(a.created_at))}<br/>Admin ID: ${esc(a.admin_telegram_id)}</small></div>`;
    }).join('')||'<p class="muted-note">Действий пока нет.</p>';
  }
  async function adminSaveOffer() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    const idValue=$('#admin-offer-id').value.trim(); const title=$('#admin-offer-title').value.trim(); const startRaw=$('#admin-offer-start').value; const endRaw=$('#admin-offer-end').value;
    const price=Number($('#admin-offer-price').value);const perUser=Number($('#admin-offer-per-user').value);const rewardCredits=Number($('#admin-offer-reward-credits').value||0);const rewardItemId=$('#admin-offer-reward-item').value;
    if(title.length<3)return toast('Название должно быть не короче 3 символов','error');
    if(!startRaw||!endRaw||Number.isNaN(new Date(startRaw).getTime())||Number.isNaN(new Date(endRaw).getTime())||new Date(startRaw)>=new Date(endRaw))return toast('Проверь дату и время начала/окончания','error');
    if(!Number.isSafeInteger(price)||price<0||price>1000000)return toast('Цена должна быть от 0 до 1 000 000','error');
    if(!Number.isSafeInteger(perUser)||perUser<1||perUser>1000000)return toast('Лимит на игрока должен быть минимум 1','error');
    if(!rewardItemId&&(!Number.isSafeInteger(rewardCredits)||rewardCredits<1))return toast('Выбери предмет или задай бонусные кредиты','error');
    const maxRaw=$('#admin-offer-max').value.trim();const maxPurchases=maxRaw===''?null:Number(maxRaw);
    if(maxPurchases!==null&&(!Number.isSafeInteger(maxPurchases)||maxPurchases<1))return toast('Общий лимит должен быть минимум 1','error');
    const payload={title,description:$('#admin-offer-description').value.trim(),imageUrl:$('#admin-offer-image').value,priceCredits:price,startsAt:new Date(startRaw).toISOString(),endsAt:new Date(endRaw).toISOString(),maxPurchases,perUserLimit:perUser,rewardItemId,rewardCredits,active:$('#admin-offer-active').checked,...(idValue?{id:idValue}:{})};
    const button=$('#admin-offer-save');button.disabled=true;
    try{const result=await api('/api/admin/offers',{method:'POST',body:payload});toast(result.message||'Предложение сохранено','success');await loadAdmin();resetOfferEditor();await loadOffers();}
    catch(err){toast(err.message,'error',5500);}finally{button.disabled=false;}
  }
  async function toggleAdminOffer(offerId,active) {
    try{await api(`/api/admin/offers/${encodeURIComponent(offerId)}/status`,{method:'PATCH',body:{active:Boolean(Number(active))}});toast(Number(active)?'Предложение включено':'Предложение выключено','success');await loadAdmin();await loadOffers();}
    catch(err){toast(err.message,'error',5000);}
  }
  function confirmBroadcast() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    const text=$('#admin-broadcast-text').value.trim();if(text.length<2)return toast('Напиши текст рассылки','error');if(text.length>3500)return toast('Максимум 3500 символов','error');
    const count=Number(S.adminOverview?.userCount||0);
    openModal(`<h2 id="modal-title" class="modal-title">Начать рассылку?</h2><p class="modal-copy">Сообщение будет отправлено всем ${count} зарегистрированным пользователям по очереди. Тем, кто заблокировал бота, доставка не удастся. Продолжить?</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" id="admin-broadcast-confirm">Начать</button></div>`);
  }
  async function startBroadcast() {
    const message=$('#admin-broadcast-text').value.trim(); if(!message)return toast('Напиши текст рассылки','error');
    try{
      const result=await api('/api/admin/broadcasts',{method:'POST',body:{message,withAppButton:$('#admin-broadcast-button').checked}});
      closeModal();toast(result.message||'Рассылка создана','success',4500);$('#admin-broadcast-progress').textContent=`Подготовлена рассылка для ${result.recipientCount} пользователей…`;
      await loadAdmin(); if(result.status==='sending')await runBroadcast(result.broadcastId);
    }catch(err){toast(err.message,'error',6000);}
  }
  async function runBroadcast(broadcastId) {
    if(S.broadcastRunning)return toast('Рассылка уже выполняется в этом окне','info');
    if(MOCK)return toast('DEMO: сообщения не отправляются','error');
    S.broadcastRunning=true;const progress=$('#admin-broadcast-progress');
    try{
      let status='sending';
      while(status==='sending'){
        const r=await api(`/api/admin/broadcasts/${encodeURIComponent(broadcastId)}/process`,{method:'POST',body:{}});
        status=r.status; if(progress)progress.textContent=`Рассылка: отправлено ${r.sent}, не доставлено ${r.failed}, осталось ${r.remaining}.`;
        const old=(S.adminOverview?.broadcasts||[]).find(b=>b.id===broadcastId);if(old){old.sent_count=r.sent;old.failed_count=r.failed;old.status=status;old.recipient_count=r.sent+r.failed+r.remaining;}else if(S.adminOverview){S.adminOverview.broadcasts=[{id:broadcastId,message_text:'Текущая рассылка',status,sent_count:r.sent,failed_count:r.failed,recipient_count:r.sent+r.failed+r.remaining,created_at:new Date().toISOString()},...(S.adminOverview.broadcasts||[])];}
        renderAdminBroadcasts(S.adminOverview?.broadcasts||[]);
        if(status==='sending'&&r.batchProcessed===0)throw new Error('В рассылке остались получатели, но новый пакет не обработан. Нажми «Продолжить» позже.');
      }
      if(progress)progress.textContent=`✅ Рассылка завершена. Отправлено: ${Number(S.adminOverview?.broadcasts?.find(b=>b.id===broadcastId)?.sent_count||0)}; ошибок доставки: ${Number(S.adminOverview?.broadcasts?.find(b=>b.id===broadcastId)?.failed_count||0)}.`;
      await loadAdmin();
      const final=(S.adminOverview?.broadcasts||[]).find(b=>b.id===broadcastId); if(progress&&final)progress.textContent=`✅ Рассылка завершена. Отправлено: ${Number(final.sent_count||0)}, ошибок доставки: ${Number(final.failed_count||0)}.`;
    }catch(err){if(progress)progress.textContent=`Рассылка остановлена: ${err.message}. Её можно продолжить кнопкой ниже.`;toast(err.message,'error',6500);try{await loadAdmin();}catch{}}
    finally{S.broadcastRunning=false;}
  }

  function fillAdminSeasonSelectors() {
    const itemSelect=$('#admin-season-items');const secretSelect=$('#admin-season-secret');if(!itemSelect||!secretSelect)return;
    const items=S.adminOverview?.rewardCatalog||allTargetItems();
    const previous=[...itemSelect.selectedOptions].map(o=>o.value);const oldSecret=secretSelect.value;
    itemSelect.innerHTML=items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)} · ${esc(money(item.value_stars))}</option>`).join('');
    secretSelect.innerHTML='<option value="">Нет секретного предмета</option>'+items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('');
    previous.forEach(value=>{const option=[...itemSelect.options].find(o=>o.value===value);if(option)option.selected=true;});
    if(oldSecret&&[...secretSelect.options].some(o=>o.value===oldSecret))secretSelect.value=oldSecret;
  }
  function resetSeasonEditor() {
    if(!$('#admin-season-start').value)$('#admin-season-start').value=toLocalDateTimeInput(new Date().toISOString());
    if(!$('#admin-season-end').value)$('#admin-season-end').value=toLocalDateTimeInput(new Date(Date.now()+14*86400000).toISOString());
  }
  function renderAdminSeasons(collections=[]) {
    const host=$('#admin-season-list');if(!host)return;
    host.innerHTML=collections.length?collections.map(c=>`<div class="admin-order admin-season-row"><span><b>${esc(c.title)}</b><br/><small>${Number(c.item_count||0)} предметов · ${esc(c.reward_title||'Коллекционер')} · до ${esc(new Date(c.ends_at).toLocaleDateString('ru-RU'))}</small></span><div class="admin-season-row-actions"><button class="secondary-btn" data-admin-season-items-edit="${esc(c.id)}">Заменить подарки</button><button class="secondary-btn" data-admin-season-toggle="${esc(c.id)}" data-active="${Number(c.active)?'1':'0'}">${Number(c.active)?'Отключить':'Включить'}</button></div></div>`).join(''):'<p class="muted-note">Сезонных коллекций пока нет.</p>';
  }
  function showAdminSeasonItemsEditor(collectionId) {
    const collection=(S.adminOverview?.collections||[]).find(c=>String(c.id)===String(collectionId));
    const catalog=S.adminOverview?.rewardCatalog||[];if(!collection||!catalog.length)return toast('Не удалось загрузить состав коллекции','error');
    const items=collection.items||[];const current=new Set(items.map(item=>String(item.item_id)));const secret=items.find(item=>Number(item.is_secret)===1)?.item_id||'';
    const options=catalog.map(item=>`<label class="admin-season-edit-choice"><input type="checkbox" data-season-edit-item value="${esc(item.id)}" ${current.has(String(item.id))?'checked':''}/><img src="${imageSrc(item.image_url)}" alt=""/><span><b>${esc(item.title)}</b><small>${esc(money(item.value_stars))}</small></span></label>`).join('');
    const secretOptions=`<option value="">Без секретного предмета</option>`+catalog.map(item=>`<option value="${esc(item.id)}" ${String(secret)===String(item.id)?'selected':''}>${esc(item.title)}</option>`).join('');
    openModal(`<h2 class="modal-title" id="modal-title">Заменить подарки</h2><p class="modal-copy"><b>${esc(collection.title)}</b><br/>Отметь обязательные подарки и выбери необязательную секретную находку.</p><div class="admin-season-edit-grid">${options}</div><label>Секретный необязательный подарок<select id="admin-edit-season-secret">${secretOptions}</select></label><p class="muted-note">Нужно минимум 2 обязательных предмета, плюс секретный при необходимости. Прогресс игроков пересчитается по новому составу.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Отмена</button><button class="primary-btn" data-admin-season-items-save="${esc(collectionId)}">Сохранить состав</button></div>`);
  }
  async function saveAdminSeasonItems(collectionId) {
    const itemIds=$$('[data-season-edit-item]:checked').map(input=>input.value);const secretItemId=$('#admin-edit-season-secret')?.value||'';
    if(itemIds.length<2)return toast('Выбери минимум два подарка','error');
    if(secretItemId&&!itemIds.includes(secretItemId))return toast('Секретный подарок должен входить в выбранный список','error');
    if(MOCK)return toast('DEMO: состав коллекции не сохраняется','error');
    const button=$(`[data-admin-season-items-save="${CSS.escape(String(collectionId))}"]`);if(button)button.disabled=true;
    try{const result=await api(`/api/admin/collections/${encodeURIComponent(collectionId)}/items`,{method:'PATCH',body:{itemIds,secretItemId}});closeModal();toast(result.message||'Состав коллекции обновлён','success');await loadAdmin();await loadCollections();}
    catch(err){toast(err.message,'error',5000);}finally{if(button)button.disabled=false;}
  }
  async function adminSaveSeason() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    if(MOCK)return toast('DEMO: сезон не сохраняется на сервере','error');
    const startRaw=$('#admin-season-start').value;const endRaw=$('#admin-season-end').value;
    const payload={title:$('#admin-season-title').value.trim(),description:$('#admin-season-description').value.trim(),imageUrl:$('#admin-season-image').value||'case-halloween.png',startsAt:startRaw?new Date(startRaw).toISOString():'',endsAt:endRaw?new Date(endRaw).toISOString():'',itemIds:[...$('#admin-season-items').selectedOptions].map(o=>o.value),secretItemId:$('#admin-season-secret').value,rewardTitle:$('#admin-season-reward-title').value.trim(),frameKey:$('#admin-season-frame').value.trim(),active:$('#admin-season-active').checked};
    if(!payload.title||payload.itemIds.length<2)return toast('Укажи название и выбери минимум 2 предмета','error');
    if(!payload.startsAt||!payload.endsAt||Date.parse(payload.startsAt)>=Date.parse(payload.endsAt))return toast('Проверь даты сезона','error');
    const button=$('#admin-season-save');button.disabled=true;
    try{const result=await api('/api/admin/collections',{method:'POST',body:payload});toast(result.message||'Сезон создан','success');$('#admin-season-title').value='';$('#admin-season-description').value='';await loadAdmin();}
    catch(err){toast(err.message,'error',5500);}finally{button.disabled=false;}
  }
  async function toggleAdminSeason(collectionId, active) {
    if(MOCK)return toast('DEMO: сезон не сохраняется на сервере','error');
    try{const result=await api(`/api/admin/collections/${encodeURIComponent(collectionId)}/status`,{method:'PATCH',body:{active:!active}});toast(result.message,'success');await loadAdmin();}
    catch(err){toast(err.message,'error',5000);}
  }

  async function loadAdmin(preselectId = '') {
    if(!S.isAdmin) { toast('Доступ запрещён','error');return setView('home'); }
    applyTheme(S.themeMode);
    fillGiftSelector();
    fillAdminRewardSelector();
    if(!$('#admin-offer-start').value)resetOfferEditor();
    if(MOCK) {
      const cases = adminCaseList();
      $('#admin-case-select').innerHTML=cases.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}</option>`).join('');
      if (preselectId) $('#admin-case-select').value=preselectId;
      fillAdminCase();
      resetOfferEditor(); renderAdminOffers([]); renderAdminBroadcasts([]); renderAdminAudit([]); fillAdminSeasonSelectors(); renderAdminSeasons([]); resetSeasonEditor();
      $('#admin-orders').textContent='DEMO: заказы не создаются. Изменения в демо не сохраняются в базе.';
      $('#admin-event-enabled').checked=true;$('#admin-event-type').value='season_map';$('#admin-event-title').value='Halloween: Путь к сокровищу';
      return;
    }
    try {
      const result=await api('/api/admin/overview'); S.adminOverview=result; fillEventRewardCatalog(); fillOfferRewardSelector(); renderAdminOffers(result.offers||[]); renderAdminBroadcasts(result.broadcasts||[]); renderAdminAudit(result.auditLogs||[]); fillAdminSeasonSelectors(); renderAdminSeasons(result.collections||[]); resetSeasonEditor();
      const cases=result.cases||[];
      const selected = preselectId || $('#admin-case-select').value;
      $('#admin-case-select').innerHTML=cases.map(c=>`<option value="${esc(c.id)}">${esc(c.title)}${Number(c.active)?'':' · выкл.'}</option>`).join('');
      if (selected && cases.some(c=>c.id===selected)) $('#admin-case-select').value=selected;
      fillAdminCase();
      $('#admin-event-enabled').checked=Boolean(result.event.enabled);$('#admin-event-type').value='season_map';$('#admin-event-title').value=result.event.title||'Halloween: Путь к сокровищу';$('#admin-event-price').value=666;$('#admin-event-end').value=toLocalDateTimeInput(result.event.ends_at);
      try { const gd=await api('/api/global-display'); S.globalDisplay=gd.settings; const v=gd.settings||{};$('#admin-message-enabled').checked=Boolean(Number(v.message_enabled));$('#admin-message-title').value=v.message_title||'Новости NftGiftCase';$('#admin-message-body').value=v.message_body||'';$('#admin-timer-enabled').checked=Boolean(Number(v.timer_enabled));$('#admin-timer-title').value=v.timer_title||'До завершения события';$('#admin-timer-end').value=toLocalDateTimeInput(v.timer_ends_at);renderGlobalDisplay(); } catch(err) { console.warn('Cannot load global display settings:',err.message); }
      syncEventRewardBranch();
      fillGlobalRewardSelector();
      fillQuestEditor();
      $('#admin-orders').innerHTML=(result.orders||[]).map(o=>`<div class="admin-order"><span>${esc(o.order_type)} · ${esc(o.status)}<br/><small>${esc(o.telegram_id)}</small></span><strong>${esc(o.amount_xtr)} XTR</strong></div>`).join('')||'Заказов нет';
      $('#admin-withdrawals').innerHTML=(result.withdrawals||[]).map(w=>`<div class="admin-order"><span><b>${esc(w.item_title||'Подарок')}</b><br/><small>${esc(w.username?'@'+w.username:w.telegram_id)} · ${esc(w.status)}</small></span><strong>${esc(w.id.slice(0,8))}</strong></div>`).join('')||'Заявок на вывод пока нет.';
    } catch(err){toast(err.message,'error');}
  }
  async function adminBalance(mode = 'add') {
    if (!S.isAdmin) return toast('Доступ запрещён', 'error');

    const targetId = String($('#admin-user-id')?.value || '').trim();
    const amount = Number($('#admin-balance-amount')?.value);
    if (!/^\d{1,20}$/.test(targetId)) return toast('Введи корректный Telegram ID пользователя', 'error');
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) {
      return toast('Сумма должна быть целым числом от 1 до 1 000 000', 'error');
    }
    if (MOCK) return toast('Демо-режим: начисления не сохраняются. Открой опубликованное приложение с подключённым API.', 'error', 5000);

    const creditButton = $('#admin-credit-btn');
    const debitButton = $('#admin-debit-btn');
    if (creditButton) creditButton.disabled = true;
    if (debitButton) debitButton.disabled = true;
    try {
      const result = await api('/api/admin/balance', {
        method: 'POST',
        body: { telegramId: targetId, amount, mode: mode === 'subtract' ? 'subtract' : 'add' }
      });
      const newBalance = Number(result.balance || 0);
      if (String(S.user?.telegram_id || '') === targetId) {
        S.balance = newBalance;
        if (S.user) S.user.balance = newBalance;
        renderBalance();
      }
      const action = mode === 'subtract' ? 'Списано' : 'Начислено';
      toast(`${action} ${amount} кредитов. Баланс пользователя ${targetId}: ${newBalance.toLocaleString('ru-RU')}`, 'success', 5000);
    } catch (err) {
      toast(err.message || 'Не удалось изменить баланс', 'error', 5000);
    } finally {
      if (creditButton) creditButton.disabled = false;
      if (debitButton) debitButton.disabled = false;
    }
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
    $('#admin-case-free').checked=Boolean(Number(c.is_free));
    $('#admin-case-price').disabled=Boolean(Number(c.is_free));
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
    const payload={title,description:$('#admin-new-case-description').value.trim(),imageUrl:$('#admin-new-case-image').value,priceXtr:Number($('#admin-new-case-price').value),maxOpens:$('#admin-new-case-limit').value===''?null:Number($('#admin-new-case-limit').value),isFree:$('#admin-new-case-free').checked,active:false};
    if (!title) return toast('Введи название кейса','error');
    if (!payload.isFree && (!Number.isSafeInteger(payload.priceXtr)||payload.priceXtr<1)) return toast('Цена кейса должна быть не меньше 1 Star','error');
    if (payload.isFree) payload.priceXtr=0;
    if (MOCK) {
      const id=`custom-${Date.now().toString(36)}`; const c={id,title,description:payload.description,image_url:payload.imageUrl,price_xtr:payload.priceXtr,is_free:payload.isFree?1:0,active:0,max_opens:payload.maxOpens,opened_count:0,items:[]};S.cases.push(c);
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
    const payload={title:$('#admin-case-title').value.trim(),description:$('#admin-case-description').value.trim(),imageUrl:$('#admin-case-image').value,isFree:$('#admin-case-free').checked,priceXtr:$('#admin-case-free').checked?0:Number($('#admin-case-price').value),maxOpens:$('#admin-case-limit').value===''?null:Number($('#admin-case-limit').value),active:$('#admin-case-active').checked,items};
    if(!payload.title)return toast('Название кейса не может быть пустым','error');
    if(!payload.isFree&&(!Number.isSafeInteger(payload.priceXtr)||payload.priceXtr<1))return toast('Цена кейса должна быть не меньше 1 Star','error');
    if(payload.maxOpens!==null&&(!Number.isSafeInteger(payload.maxOpens)||payload.maxOpens<1))return toast('Лимит должен быть больше нуля или пустым','error');
    if(MOCK){const c=S.cases.find(item=>item.id===caseId);if(!c)return toast('Кейс не найден','error');Object.assign(c,{title:payload.title,description:payload.description,image_url:payload.imageUrl,price_xtr:payload.priceXtr,is_free:payload.isFree?1:0,max_opens:payload.maxOpens,active:payload.active?1:0});for(const item of items){const found=c.items.find(i=>i.id===item.id);if(found){found.weight=Math.max(1,Math.round(item.chancePct*1000));found.value_stars=item.valueStars;found.stock_limit=item.stockLimit;}}if(payload.active&&!c.items.length){c.active=0;return toast('Добавь хотя бы один предмет перед активацией','error');}toast('DEMO: настройки обновлены только в текущем окне','info');renderAll();fillAdminCase();return;}
    try {await api(`/api/admin/cases/${encodeURIComponent(caseId)}`,{method:'PATCH',body:payload});toast('Настройки кейса сохранены','success');await loadAdmin(caseId);await refreshUserData();}
    catch(err){toast(err.message,'error');}
  }
  async function adminCreatePromo() {
    const payload={code:$('#admin-promo-code').value.trim().toUpperCase(),kind:$('#admin-promo-kind').value,amount:Number($('#admin-promo-amount').value),maxUses:$('#admin-promo-max').value===''?null:Number($('#admin-promo-max').value),expiresAt:$('#admin-promo-expiry').value?new Date($('#admin-promo-expiry').value).toISOString():null};
    if(MOCK)return toast('DEMO: промокод не создан','error');
    try {await api('/api/admin/promocodes',{method:'POST',body:payload});toast('Промокод создан','success');$('#admin-promo-code').value='';await loadAdmin();}catch(err){toast(err.message,'error');}
  }
  async function adminSaveEvent() {
    const rawEnd = $('#admin-event-end').value;
    const endDate = rawEnd ? new Date(rawEnd) : null;
    if (rawEnd && (!endDate || !Number.isFinite(endDate.getTime()))) return toast('Проверь дату окончания события', 'error');
    const payload={enabled:$('#admin-event-enabled').checked,eventType:$('#admin-event-type').value,title:$('#admin-event-title').value.trim(),endsAt:endDate?endDate.toISOString():null,premiumPriceXtr:Number($('#admin-event-price').value)};
    if(!payload.title)return toast('Укажи название события','error');
    if(!Number.isSafeInteger(payload.premiumPriceXtr)||payload.premiumPriceXtr<1||payload.premiumPriceXtr>100000)return toast('Цена Premium Pass должна быть от 1 до 100 000 Stars','error');
    if(MOCK){S.eventData.settings={...S.eventData.settings,...payload};toast('DEMO: Event Manager обновлён только в окне браузера','info');renderEvent();return;}
    const button=$('#admin-event-save');button.disabled=true;
    try {const result=await api('/api/admin/event',{method:'PATCH',body:payload});if(result.event)S.eventData.settings=result.event;toast('Событие сохранено','success');await refreshUserData();await loadAdmin();}
    catch(err){toast(err.message,'error',5500);}
    finally{button.disabled=false;}
  }

  async function adminSaveGlobalDisplay() {
    if (!S.isAdmin) return toast('Доступ запрещён','error');
    const rawEnd=$('#admin-timer-end').value;
    const endDate=rawEnd?new Date(rawEnd):null;
    if(rawEnd&&(!endDate||!Number.isFinite(endDate.getTime())))return toast('Проверь дату таймера','error');
    const messageBody=$('#admin-message-body').value.trim();
    const messageEnabled=$('#admin-message-enabled').checked&&Boolean(messageBody);
    const payload={messageEnabled,messageTitle:$('#admin-message-title').value.trim()||'Новости NftGiftCase',messageBody,timerEnabled:$('#admin-timer-enabled').checked,timerTitle:$('#admin-timer-title').value.trim()||'До завершения события',timerEndsAt:endDate?endDate.toISOString():null};
    if($('#admin-message-enabled').checked&&!messageBody){$('#admin-message-enabled').checked=false;toast('Текст сообщения пуст — сообщение будет выключено. Настройки таймера всё равно сохранятся.','info',4500);}
    if(payload.timerEnabled&&!payload.timerEndsAt)return toast('Укажи дату окончания таймера','error');
    if(MOCK){S.globalDisplay={message_enabled:+payload.messageEnabled,message_title:payload.messageTitle,message_body:payload.messageBody,timer_enabled:+payload.timerEnabled,timer_title:payload.timerTitle,timer_ends_at:payload.timerEndsAt};renderGlobalDisplay();return toast('DEMO: настройки сохранены только до закрытия окна','info');}
    const button=$('#admin-global-save');button.disabled=true;
    try{const result=await api('/api/admin/global-display',{method:'PATCH',body:payload});S.globalDisplay=result.settings;renderGlobalDisplay();toast('Глобальное сообщение и таймер опубликованы','success');}
    catch(err){toast(err.message,'error',5500);}
    finally{button.disabled=false;}
  }

  function fillEventRewardCatalog() {
    const select=$('#admin-event-reward-item');if(!select)return;
    const items=S.adminOverview?.rewardCatalog||[];
    const old=select.value;
    select.innerHTML=items.map(item=>`<option value="${esc(item.id)}">${esc(item.title)} · ${esc(money(item.value_stars))}</option>`).join('')||'<option value="">Каталог подарков пуст</option>';
    if(old&&items.some(item=>String(item.id)===old))select.value=old;
    syncEventRewardEditor();
  }
  function syncEventRewardBranch() {
    const branch=$('#admin-reward-branch');const level=$('#admin-reward-level');const label=$('#admin-reward-level-label');
    if(branch)branch.value='free';
    if(level){level.max='30';level.value=String(Math.min(30,Math.max(1,Number(level.value)||1)));}
    if(label)label.firstChild.textContent='Узел карты (1–30)';
    syncEventRewardEditor();
  }
  function syncEventRewardEditor() {
    const eventType=$('#admin-reward-event-type')?.value||'battle_pass';
    const branch=$('#admin-reward-branch')?.value||(eventType==='advent'?'advent':'free');
    const level=Math.max(1,Math.trunc(Number($('#admin-reward-level')?.value)||1));
    const saved=customEventReward(eventType,branch,level);
    const savedCredits=customEventStarReward(eventType,branch,level);
    const rewardType=$('#admin-event-reward-type');
    if(rewardType && document.activeElement!==rewardType)rewardType.value=savedCredits&&!saved?'credits':'gift';
    const selectedType=rewardType?.value||'gift';
    const giftWrap=$('#admin-event-gift-wrap');const amountWrap=$('#admin-event-amount-wrap');
    if(giftWrap)giftWrap.classList.toggle('hidden',selectedType==='credits');
    if(amountWrap)amountWrap.classList.toggle('hidden',selectedType!=='credits');
    if(savedCredits && $('#admin-event-reward-amount'))$('#admin-event-reward-amount').value=savedCredits.amount;
    const itemId=saved?.item_id||defaultEventRewardId(eventType,branch,level);
    const select=$('#admin-event-reward-item');
    if(select&&[...select.options].some(o=>o.value===itemId))select.value=itemId;
    const option=select?.selectedOptions?.[0];
    const preview=$('#admin-reward-preview');
    if(preview)preview.textContent=selectedType==='credits'?(savedCredits?`Сохранено: ${Number(savedCredits.amount).toLocaleString('ru-RU')} внутренних кредитов (★)`:'Задай количество внутренних кредитов для награды.'):(option?`${saved?'Сохранённая награда':'Награда по умолчанию'}: ${option.textContent}`:'Выбери подарок из каталога.');
  }
  async function adminSaveEventReward() {
    if(!S.isAdmin)return toast('Доступ запрещён','error');
    const eventType=$('#admin-reward-event-type').value;const branch=$('#admin-reward-branch').value;const level=Number($('#admin-reward-level').value);const rewardType=$('#admin-event-reward-type').value;const itemId=$('#admin-event-reward-item').value;const amount=Number($('#admin-event-reward-amount').value);
    const max=eventType==='advent'?24:30;
    if(!Number.isSafeInteger(level)||level<1||level>max)return toast(`Укажи число от 1 до ${max}`,'error');
    if(rewardType==='gift'&&!itemId)return toast('Выбери подарок','error');
    if(rewardType==='credits'&&(!Number.isSafeInteger(amount)||amount<1||amount>1000000))return toast('Количество внутренних кредитов должно быть от 1 до 1 000 000','error');
    if(MOCK)return toast('DEMO: награда не сохранена на сервере','error');
    const button=$('#admin-save-event-reward');button.disabled=true;
    try{const result=await api('/api/admin/event/rewards',{method:'POST',body:{eventType,branch,level,rewardType,...(rewardType==='credits'?{amount}:{itemId})}});toast(result.message||`Награда ${eventType==='advent'?'дня':'уровня'} ${level} сохранена`,'success');await refreshUserData();await loadAdmin();syncEventRewardEditor();}
    catch(err){toast(err.message,'error',5500);}
    finally{button.disabled=false;}
  }

  function handleClick(event) {
    const target=event.target.closest('button,[data-close-modal]');if(!target)return;
    if(target.matches('[data-close-modal]'))return closeModal();
    if(target.matches('[data-view]')) {sound();const next=target.dataset.view;if(next==='cases')S.filter='all';setView(next);return;}
    if(target.matches('[data-filter]')) {S.filter=target.dataset.filter;$$('[data-filter]').forEach(b=>b.classList.toggle('selected',b===target));renderHome();sound();return;}
    if(target.matches('[data-jump]')) {if(target.dataset.jump==='showcase')S.showcaseTargetId=null;setView(target.dataset.jump);return;}
    if(target.matches('[data-open-case]')) {openCase(target.dataset.openCase);sound();return;}
    if(target.matches('[data-claim-case]')) {claimFree(target.dataset.claimCase);return;}
    if(target.matches('[data-qty]')) {selectQuantity(target.dataset.qty);sound();return;}
    if(target.matches('[data-back]')) {setView(target.dataset.back||'home');return;}
    if(target.id==='open-case-btn') {openSelectedCase('stars');return;}
    if(target.id==='open-case-balance-btn') {openSelectedCase('balance');return;}
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
    if(target.matches('[data-sell]')) {showSellConfirm(target.dataset.sell);return;}
    if(target.matches('[data-confirm-sell]')) {sellItem(target.dataset.confirmSell);return;}
    if(target.id==='sell-all-btn') {showSellAllConfirm();return;}
    if(target.matches('[data-confirm-sell-all]')) {sellAllInventory();return;}
    if(target.matches('[data-list-market]')) {showMarketListingModal(target.dataset.listMarket);return;}
    if(target.matches('[data-confirm-market-list]')) {createMarketListing(target.dataset.confirmMarketList);return;}
    if(target.matches('[data-buy-market]')) {confirmMarketBuy(target.dataset.buyMarket);return;}
    if(target.matches('[data-confirm-market-buy]')) {buyMarketListing(target.dataset.confirmMarketBuy);return;}
    if(target.matches('[data-cancel-market]')) {cancelMarketListing(target.dataset.cancelMarket);return;}
    if(target.id==='market-refresh'||target.id==='collections-refresh') {target.id==='market-refresh'?loadMarket():loadCollections();return;}
    if(target.id==='craft-run-btn') {performCraft();return;}
    if(target.matches('[data-claim-collection]')) {claimSeasonCollection(target.dataset.claimCollection);return;}
    if(target.id==='showcase-save-btn') {saveShowcase();return;}
    if(target.matches('[data-view-showcase]')) {openPlayerShowcase(target.dataset.viewShowcase);return;}
    if(target.matches('[data-price-history]')) {showPriceHistory(target.dataset.priceHistory,target.dataset.historyBackground||'default');return;}
    if(target.id==='collector-codex-btn') {showCollectorCodex();return;}
    if(target.matches('[data-admin-season-items-edit]')) {showAdminSeasonItemsEditor(target.dataset.adminSeasonItemsEdit);return;}
    if(target.matches('[data-admin-season-items-save]')) {saveAdminSeasonItems(target.dataset.adminSeasonItemsSave);return;}
    if(target.matches('[data-confirm-withdraw]')) {withdraw(target.dataset.confirmWithdraw);return;}
    if(target.matches('[data-check-global-subscription]')) {checkGlobalSubscription();return;}
    if(target.id==='admin-shortcut'||target.id==='admin-shortcut-wrap') {setView('admin');return;}
    if(target.id==='admin-theme-toggle') {toggleAdminTheme();return;}
    if(target.id==='admin-credit-btn') {adminBalance('add');return;} if(target.id==='admin-debit-btn') {adminBalance('subtract');return;}
    if(target.id==='admin-offer-save') {adminSaveOffer();return;} if(target.id==='admin-offer-reset') {resetOfferEditor();return;}
    if(target.matches('[data-admin-offer-edit]')) {fillOfferEditor(target.dataset.adminOfferEdit);return;}
    if(target.matches('[data-admin-offer-toggle]')) {toggleAdminOffer(target.dataset.adminOfferToggle,target.dataset.active);return;}
    if(target.id==='admin-broadcast-send') {confirmBroadcast();return;} if(target.id==='admin-broadcast-confirm') {startBroadcast();return;}
    if(target.id==='admin-season-save') {adminSaveSeason();return;} if(target.matches('[data-admin-season-toggle]')) {toggleAdminSeason(target.dataset.adminSeasonToggle,target.dataset.active==='1');return;}
    if(target.matches('[data-admin-broadcast-resume]')) {runBroadcast(target.dataset.adminBroadcastResume);return;}
    if(target.matches('[data-buy-offer]')) {showOfferPurchaseConfirm(target.dataset.buyOffer);return;}
    if(target.matches('[data-confirm-offer]')) {purchaseOffer(target.dataset.confirmOffer);return;}
    if(target.id==='admin-gift-btn') {adminReward(false);return;} if(target.id==='admin-combo-btn') {adminReward(true);return;}
    if(target.id==='admin-case-save') {adminSaveCase();return;} if(target.id==='admin-create-case') {adminCreateCase();return;} if(target.id==='admin-add-item') {adminAddItem();return;} if(target.matches('[data-admin-remove-item]')) {adminRemoveItem(target.dataset.adminRemoveItem);return;} if(target.id==='admin-promo-create') {adminCreatePromo();return;} if(target.id==='admin-event-save') {adminSaveEvent();return;} if(target.id==='admin-global-save') {adminSaveGlobalDisplay();return;} if(target.id==='admin-save-event-reward') {adminSaveEventReward();return;} if(target.id==='admin-quest-save') {adminSaveQuest();return;} if(target.id==='admin-global-reward-send') {adminGlobalReward();return;} if(target.matches('[data-confirm-global-reward]')) {confirmGlobalReward();return;}
    if(target.matches('[data-event-tab]')) {$$('[data-event-tab]').forEach(b=>b.classList.toggle('selected',b===target));const quests=target.dataset.eventTab==='quests';$('#season-map-path').classList.toggle('hidden',quests);$('#quests-list').classList.toggle('hidden',!quests);return;}
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
    if(event.type==='change'&&event.target.matches('[data-craft-select]')){toggleCraftSelection(event.target.value,event.target.checked);return;}
    if(event.target.id==='search-input'){S.search=event.target.value;renderHome();}
    if(event.target.id==='bet-range'){S.upgradeBet=Number(event.target.value);updateUpgradeChance();}
    if(event.target.id==='admin-case-select')fillAdminCase();
    if(event.target.id==='admin-new-case-free')$('#admin-new-case-price').disabled=event.target.checked;
    if(event.target.id==='admin-case-free')$('#admin-case-price').disabled=event.target.checked;
    if(event.target.id==='admin-event-type')$('#admin-event-title').value='Halloween: Путь к сокровищу';
    if(event.target.id==='admin-reward-event-type'){syncEventRewardBranch();}
    if(event.target.id==='admin-reward-branch'||event.target.id==='admin-reward-level'||event.target.id==='admin-event-reward-type'){syncEventRewardEditor();}
    if(event.target.id==='admin-quest-select')fillQuestEditor(event.target.value);
  }

  // SVG wheel ticks are decorative and are rendered once; all drop images are PNGs from the project asset CDN.
  document.addEventListener('click',event=>{ const button=event.target.closest('button'); if(button) sound('click'); handleClick(event); });
  document.addEventListener('input',onInput);
  document.addEventListener('change',onInput);
  $('#modal-root').addEventListener('click',event=>{if(event.target.matches('[data-close-modal]'))closeModal();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();});
  if(tg?.BackButton) { tg.BackButton.onClick(()=>setView('home')); }
  window.addEventListener('focus',()=>{if(!MOCK)refreshUserData();});
  window.setInterval(()=>{updateGlobalCountdown();},1000);
  window.setInterval(()=>{if(!MOCK&&document.visibilityState==='visible'){api('/api/live-wins').then(r=>{S.wins=r.wins;renderLive();}).catch(()=>{});api('/api/global-display').then(r=>{S.globalDisplay=r.settings;renderGlobalDisplay();}).catch(()=>{});api('/api/theme').then(r=>{if(r.theme!==S.themeMode)applyTheme(r.theme);}).catch(()=>{});loadOffers().catch(()=>{});}},30000);
  window.addEventListener('error',event=>console.error('NftGiftCase UI error',event.message));
  syncSoundButton(); loadAll();
})();
