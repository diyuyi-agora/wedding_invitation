(() => {
  'use strict';
  const photoSlots = [
    { index: 4, name: '登岛 · 第一眼', shape: '横图 4:3' },
    { index: 5, name: '广播 · 幸福来信', shape: '竖图 4:5' },
    { index: 6, name: '仪式 · 我愿意', shape: '横图 3:2' },
    { index: 0, name: '故事 · 最佳搭档', shape: '方图 1:1' },
    { index: 1, name: '相册 · 初见', shape: '横图 3:2' },
    { index: 2, name: '相册 · 我们', shape: '竖图 3:4' },
    { index: 3, name: '相册 · 余生', shape: '竖图 3:4' },
    { index: 7, name: '日历 · 约定这一天', shape: '横图 4:3' },
    { index: 8, name: '日程 · 一起看四季', shape: '竖图 4:5' },
    { index: 9, name: '坐标 · 有你的地方', shape: '横图 3:2' },
    { index: 10, name: '结尾 · 今日晴天', shape: '竖图 3:4' },
    { index: 11, name: '结尾 · 以后每一天', shape: '竖图 3:4' },
    { index: 12, name: '相册 · 喜服相望', shape: '横图 3:2' },
    { index: 13, name: '相册 · 你的可爱', shape: '横图 3:2' },
    { index: 14, name: '相册 · 余生官宣', shape: '竖图 2:3' },
    { index: 15, name: '相册 · 喜结良缘', shape: '竖图 2:3' },
  ];
  const defaults = { groom: '新郎', bride: '新娘', date: '', time: '', venue: '', address: '', mapUrl: '', groomPhone: '', bridePhone: '', fontData: '', fontName: '', schedule: ['15:30', '16:00', '17:00', '19:00'], photos: Array.from({ length: 16 }, () => '') };
  const initial = Object.assign({}, defaults, window.WEDDING_CONFIG || {});
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let config = Object.assign({}, initial);
  let toastTimer;
  let lastFocus;
  let receiptText = '';
  let customFont;
  let appliedFontData = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function safePhoto(src) {
    if (typeof src !== 'string' || !src) return '';
    if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(src)) return src;
    try { const url = new URL(src, location.href); return ['http:', 'https:', 'file:'].includes(url.protocol) ? src : ''; } catch { return ''; }
  }
  function normalize(value) {
    const result = Object.assign({}, defaults, value);
    ['groom', 'bride', 'date', 'time', 'venue', 'address', 'mapUrl', 'groomPhone', 'bridePhone', 'fontName'].forEach((key) => { result[key] = typeof result[key] === 'string' ? result[key].trim() : ''; });
    result.fontData = typeof result.fontData === 'string' && /^data:(font\/[^;,]+|application\/(octet-stream|x-font-ttf|font-woff));base64,[A-Za-z0-9+/=]+$/.test(result.fontData) ? result.fontData : '';
    ['groomPhone', 'bridePhone'].forEach((key) => { result[key] = result[key].replace(/[^+\d\s()-]/g, ''); });
    result.groom = result.groom || '新郎'; result.bride = result.bride || '新娘';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || Number.isNaN(new Date(`${result.date}T00:00:00+08:00`).getTime()) || new Date(`${result.date}T12:00:00Z`).toISOString().slice(0, 10) !== result.date) result.date = '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result.time)) result.time = '';
    result.schedule = defaults.schedule.map((fallback, i) => value.schedule?.[i] === '' ? '' : /^([01]\d|2[0-3]):[0-5]\d$/.test(value.schedule?.[i]) ? value.schedule[i] : fallback);
    result.photos = defaults.photos.map((_, i) => safePhoto(value.photos?.[i]));
    return result;
  }
  config = normalize(config);

  function toast(message) {
    const element = $('#toast');
    element.textContent = message; element.classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => element.classList.remove('visible'), 3600);
  }
  function formatDate(date, compact = false) {
    if (!date) return compact ? '好日子 · 待你揭晓' : '婚礼日期待填写';
    const [year, month, day] = date.split('-');
    if (compact) return `${year}.${month}.${day}`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(`${date}T12:00:00+08:00`).getUTCDay()];
    return `${year} 年 ${Number(month)} 月 ${Number(day)} 日 · 星期${weekday}`;
  }
  function renderCalendar() {
    const calendar = $('#wedding-calendar');
    calendar.replaceChildren();
    if (!config.date) {
      calendar.innerHTML = '<div class="calendar-placeholder"><svg class="icon"><use href="#i-calendar"/></svg><span>圈好我们的好日子<br>等你来，见证幸福</span></div>';
      return;
    }
    const [year, month, day] = config.date.split('-').map(Number);
    const heading = document.createElement('div'); heading.className = 'calendar-month'; heading.textContent = `${year} 年 ${month} 月`;
    const week = document.createElement('div'); week.className = 'calendar-week';
    ['日', '一', '二', '三', '四', '五', '六'].forEach((label) => { const cell = document.createElement('span'); cell.textContent = label; week.append(cell); });
    const days = document.createElement('div'); days.className = 'calendar-days';
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let i = 0; i < first; i++) days.append(document.createElement('span'));
    for (let i = 1; i <= last; i++) { const cell = document.createElement('span'); cell.textContent = i; if (i === day) { cell.className = 'wedding-day'; cell.setAttribute('aria-label', `${month}月${day}日，我们的婚礼`); cell.setAttribute('aria-current', 'date'); } days.append(cell); }
    calendar.append(heading, week, days);
  }
  async function applyFont() {
    if (config.fontData === appliedFontData) return;
    const requested = config.fontData;
    if (!requested) { if (customFont) document.fonts.delete(customFont); customFont = undefined; appliedFontData = ''; document.documentElement.style.removeProperty('--font'); return; }
    try {
      const font = await new FontFace('CustomIslandRound', `url("${requested}")`).load();
      if (config.fontData !== requested) return;
      if (customFont) document.fonts.delete(customFont);
      customFont = font; document.fonts.add(font); appliedFontData = requested;
      document.documentElement.style.setProperty('--font', "CustomIslandRound,IslandRound,IslandChinese,'PingFang SC',sans-serif");
    } catch { toast('自定义字体无法读取，已使用默认圆体。'); }
  }
  function render() {
    const fallback = { venue: '婚礼地点 · 待填写', address: '等我们选好最美的风景，就把地址寄给你。' };
    $$('[data-field]').forEach((element) => { element.textContent = config[element.dataset.field] || fallback[element.dataset.field] || ''; });
    $$('#pass-date, [data-pass-date]').forEach((element) => { element.textContent = config.date ? formatDate(config.date, true) : '婚期待定'; });
    $$('#pass-time, [data-pass-time]').forEach((element) => { element.textContent = config.time || '时间待定'; });
    $$('[data-wedding-date]').forEach((element) => { element.textContent = config.date ? formatDate(config.date, true) : '好日子 · 待揭晓'; });
    $$('[data-wedding-time]').forEach((element) => { element.textContent = config.time ? `${config.time} · 婚礼开始` : '婚礼时间待填写'; });
    $('#schedule-date').textContent = formatDate(config.date);
    const scheduleLabels = ['入席前', '婚礼开始', '仪式后', '晚宴间'];
    $$('[data-schedule]').forEach((element) => { const index = Number(element.dataset.schedule); element.textContent = config.schedule[index] || scheduleLabels[index]; });
    $('#schedule-note').textContent = config.date && config.time ? `婚礼于 ${config.time} 开始，其余环节以当日安排为准。` : '以上为参考流程，具体时间等我们揭晓。';
    renderCalendar(); applyFont();
    $$('[data-photo]').forEach((frame) => {
      const content = frame.querySelector('.photo-content');
      content.querySelector('img')?.remove();
      const src = config.photos[Number(frame.dataset.photo)];
      frame.hidden = !src;
      Array.from(content.children).forEach(element => element.toggleAttribute('hidden', Boolean(src)));
      if (src) {
        const image = new Image(); image.alt = photoSlots.find((slot) => slot.index === Number(frame.dataset.photo))?.name || '我们的婚纱照';
        image.loading = 'eager'; image.decoding = 'async'; image.fetchPriority = 'low'; image.src = src;
        image.addEventListener('error', () => { image.remove(); frame.dataset.loaded = 'false'; frame.hidden = true; });
        content.append(image); frame.dataset.loaded = 'true';
      } else { frame.dataset.loaded = 'false'; }
    });
    $$('.calendar-memory, .day-memory, .closing-memories').forEach(container => {
      container.hidden = !Array.from(container.querySelectorAll('[data-photo]')).some(frame => !frame.hidden);
    });
    $('.closing-photo-pair').dataset.photoCount = String($$('.closing-photo-pair [data-photo]').filter(frame => !frame.hidden).length);
    const named = config.groom !== '新郎' || config.bride !== '新娘';
    document.title = named ? `${config.groom} & ${config.bride} · 婚礼森友会` : '集合啦！婚礼森友会';
    $('meta[property="og:title"]').content = document.title;
    if (config.date) $('meta[property="og:description"]').content = `${formatDate(config.date)}，${config.venue || '幸福小岛'}。你来，就是最好的礼物。`;
  }
  render();

  // Start every image request during the opening, including hidden chapters.
  // Decode a few at a time to avoid a burst of work on mobile devices.
  async function preparePageImages() {
    const images = new Map();
    $$('img[src]').forEach(image => {
      image.loading = 'eager'; image.decoding = 'async';
      if (!images.has(image.src)) images.set(image.src, image);
    });
    $$('.dodo-ticket-header, .dodo-ticket-stub').forEach(element => {
      const background = getComputedStyle(element).backgroundImage;
      for (const match of background.matchAll(/url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g)) {
        const src = match[1] || match[2] || match[3];
        if (!src || images.has(src)) continue;
        const image = new Image(); image.decoding = 'async'; image.fetchPriority = 'low'; image.src = src;
        images.set(src, image);
      }
    });
    const queue = [...images.values()];
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (queue.length) {
        const image = queue.shift();
        try { await image.decode(); } catch { /* A failed image must not block the invitation. */ }
      }
    }));
  }
  preparePageImages();

  const steps = ['home', 'letter', 'boarding', 'story', 'album', 'schedule', 'rsvp'];
  let unlockedStep = 0;
  let openingComplete = false;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function updateJourney() {
    $$('[data-journey]').forEach(element => { element.hidden = steps.indexOf(element.dataset.journey) > unlockedStep; });
  }
  function goToStep(target, advance = false) {
    const index = steps.indexOf(target);
    if (!openingComplete || index < 0) return;
    if (advance && index === unlockedStep + 1 && target !== 'story') { unlockedStep = index; updateJourney(); }
    if (index > unlockedStep) { toast('先完成当前的小岛旅程，再去下一站吧 ♡'); return; }
    const section = target === 'letter' ? $('[data-journey="letter"]') : $(`#${target}`);
    section.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
    section.setAttribute('tabindex', '-1'); section.focus({ preventScroll: true });
  }
  updateJourney();
  document.addEventListener('click', event => {
    const next = event.target.closest('[data-next]');
    if (next) { event.preventDefault(); goToStep(next.dataset.next, true); return; }
    const link = event.target.closest('a[href^="#"]');
    if (link && steps.includes(link.hash.slice(1))) { event.preventDefault(); goToStep(link.hash.slice(1)); }
  });
  // Hash URLs and browser history must obey the same progression as the navigation.
  function guardHash() {
    const target = location.hash.slice(1);
    if (steps.includes(target) && (!openingComplete || steps.indexOf(target) > unlockedStep)) {
      history.replaceState(null, '', location.pathname + location.search);
      if (openingComplete) goToStep(steps[unlockedStep]);
    }
  }
  window.addEventListener('hashchange', guardHash); guardHash();

  let blessings = 0;
  let sharedStats = false;
  let statsBusy = false;
  let visitRecorded = false;
  let statsTask = Promise.resolve();
  let publishTask;
  const onlinePage = ['http:', 'https:'].includes(location.protocol);
  const apiBase = new URL('.', location.href);
  const apiUrl = path => new URL(path.replace(/^\/+/, ''), apiBase).href;
  const visitId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  function renderBlessings() {
    const status = $('#blessing-status'); status.replaceChildren();
    status.append(document.createTextNode(sharedStats ? '已收到 ' : '小岛已收到 '));
    const count = document.createElement('b'); count.id = 'blessing-count'; count.textContent = blessings.toLocaleString('zh-CN');
    status.append(count, document.createTextNode(' 份祝福'));
    $('#blessing-button').disabled = statsBusy || messageSent;
    $('#blessing-button span').textContent = messageSent ? '祝福已送达' : '写句祝福';
    $$('[data-write-blessing]').forEach(button => { button.disabled = statsBusy || messageSent; });
  }
  async function statsRequest(path, body) {
    const response = await fetch(apiUrl(path), { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Statistics unavailable');
    const data = await response.json();
    if (![data.visits, data.visitors, data.blessings].every(value => Number.isSafeInteger(value) && value >= 0) || typeof data.blessed !== 'boolean') throw new Error('Invalid statistics');
    return data;
  }
  function applyStats(data) {
    sharedStats = true; blessings = data.blessings; messageSent = data.messageSent === true;
    $('#visit-status').textContent = `小岛已迎来 ${data.visits.toLocaleString('zh-CN')} 次访问 · ${data.visitors.toLocaleString('zh-CN')} 位访客`;
    renderBlessings();
  }
  function refreshStats() {
    if (!onlinePage || statsBusy) return statsTask;
    statsBusy = true; renderBlessings();
    statsTask = (async () => {
      try { applyStats(await statsRequest(visitRecorded ? '/api/stats' : '/api/visits', visitRecorded ? undefined : { visitId })); visitRecorded = true; }
      catch { $('#visit-status').textContent = '小岛访问数据暂未连接'; }
      finally { statsBusy = false; renderBlessings(); }
    })();
    return statsTask;
  }
  let messageSent = false;
  let blessingMessages = [];
  let feedTask;
  const streams = $$('.blessing-stream');
  function renderMessages() {
    streams.forEach(stream => {
      const lanes = stream.querySelector('.stream-lanes'); lanes.replaceChildren();
      stream.querySelector('.stream-empty').hidden = blessingMessages.length > 0;
      stream.querySelector('.stream-toggle').hidden = !blessingMessages.length;
      if (!blessingMessages.length) return;
      for (let row = 0; row < Math.min(2, blessingMessages.length); row++) {
        const track = document.createElement('div'); track.className = 'stream-track';
        const items = blessingMessages.filter((_, index) => index % 2 === row).slice(0, 8);
        const group = document.createElement('div'); group.className = 'stream-group';
        items.forEach(item => { const chip = document.createElement('span'); chip.className = 'blessing-chip'; chip.textContent = `${item.name}：${item.message}`; group.append(chip); });
        track.style.setProperty('--scroll-duration', `${Math.max(24, items.reduce((total, item) => total + Math.min(item.message.length + item.name.length, 46) * 13 + 55, 0) / 35)}s`);
        // A message occupies one lane; restart only after the track has left the viewport.
        track.append(group); lanes.append(track);
      }
    });
    const history = $('#blessing-history'); history.replaceChildren();
    blessingMessages.forEach(item => { const li = document.createElement('li'); const name = document.createElement('b'); name.textContent = item.name; const message = document.createElement('p'); message.textContent = item.message; li.append(name, message); history.append(li); });
  }
  function refreshMessages(afterWrite = false) {
    if (feedTask) return afterWrite ? feedTask.then(() => refreshMessages()) : feedTask;
    $('#refresh-blessings').disabled = true;
    feedTask = (async () => {
      try {
        if (!onlinePage) throw new Error('Offline invitation');
        const response = await fetch(apiUrl('/api/blessings'), { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Blessings unavailable');
        const data = await response.json();
        if (!Array.isArray(data.messages)) throw new Error('Invalid blessings');
        blessingMessages = data.messages.filter(item => typeof item?.name === 'string' && item.name.length <= 24 && typeof item.message === 'string' && item.message.length <= 160).slice(0, 50);
        streams.forEach(stream => { stream.querySelector('.stream-empty').textContent = '还没有祝福来信，等你写下第一句 ♡'; });
        renderMessages(); $('#blessing-feed-status').textContent = blessingMessages.length ? '来自大家的真实祝福，正在飘向小岛。' : '写下的祝福会出现在这里。';
      } catch {
        streams.forEach(stream => { stream.querySelector('.stream-empty').textContent = onlinePage ? '祝福来信暂时读不到，稍后再来看看 ♡' : '联网后，就能看到大家的祝福 ♡'; });
        $('#blessing-feed-status').textContent = blessingMessages.length ? '暂时无法更新，继续展示已读取的祝福。' : '祝福暂未连接，可稍后刷新。';
      }
    })().finally(() => { feedTask = undefined; $('#refresh-blessings').disabled = false; });
    return feedTask;
  }
  streams.forEach(stream => {
    const button = stream.querySelector('.stream-toggle');
    if (reducedMotion) { button.textContent = '静态祝福'; button.disabled = true; }
    button.addEventListener('click', () => { const paused = stream.classList.toggle('is-paused'); button.setAttribute('aria-pressed', String(paused)); button.textContent = paused ? '继续弹幕' : '暂停弹幕'; });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('is-offscreen', !entry.isIntersecting)));
    streams.forEach(stream => observer.observe(stream));
  }
  document.addEventListener('visibilitychange', () => streams.forEach(stream => stream.classList.toggle('page-hidden', document.hidden)));
  $('#refresh-blessings').addEventListener('click', () => refreshMessages());
  refreshMessages();

  function openBlessing() {
    if (!openingComplete) return;
    if (messageSent) { toast('你的祝福已经在小岛上啦 ♡'); return; }
    $('#blessing-form-status').textContent = '';
    showDialog($('#blessing-dialog'));
  }
  $('#blessing-button').addEventListener('click', openBlessing);
  $$('[data-write-blessing]').forEach(button => button.addEventListener('click', openBlessing));
  function publishBlessing(payload) {
    if (publishTask) return publishTask;
    publishTask = (async () => {
      await statsTask;
      if (messageSent) return false;
      statsBusy = true; renderBlessings();
      try {
        if (!onlinePage) throw new Error('Offline invitation');
        if (!visitRecorded) { applyStats(await statsRequest('/api/visits', { visitId })); visitRecorded = true; }
        if (messageSent) return false;
        const result = await statsRequest('/api/blessings', payload);
        if (result.messageSent !== true) throw new Error('Blessing not persisted');
        applyStats(result);
        await refreshMessages(true);
        return true;
      } finally { statsBusy = false; renderBlessings(); }
    })().finally(() => { publishTask = undefined; });
    return publishTask;
  }
  $('#blessing-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (publishTask || messageSent) return;
    const form = event.currentTarget;
    const message = form.elements.message.value.trim();
    if (!message) { $('#blessing-form-status').textContent = '先写一句祝福，再寄往小岛吧。'; return; }
    const payload = { name: form.elements.name.value.trim(), message };
    $('#send-blessing').disabled = true;
    try {
      const published = await publishBlessing(payload);
      closeDialog($('#blessing-dialog')); form.reset();
      const pop = $('#blessing-pop'); pop.classList.remove('pop'); void pop.offsetWidth; pop.classList.add('pop');
      toast(published ? '祝福已寄出，正在飘向小岛 ♡' : '你之前的祝福已经送达，未重复发布 ♡'); celebrate();
    } catch { $('#blessing-form-status').textContent = '祝福暂未送达，内容已保留，请稍后再试。'; }
    finally { $('#send-blessing').disabled = false; }
  });

  renderBlessings(); refreshStats();
  window.addEventListener('online', () => { refreshStats(); refreshMessages(); });

  function enterIsland(withMusic = false) {
    const opening = $('#gift-opening'); if (opening.hidden || opening.classList.contains('leaving')) return;
    opening.classList.add('leaving');
    if (withMusic) setMusic(true, true);
    setTimeout(() => {
      opening.hidden = true; openingComplete = true;
      $('#invitation').inert = false;
      $('#hero-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' });
    }, reducedMotion ? 0 : 550);
  }
  $('#hero-title').setAttribute('tabindex', '-1');
  $('#open-gift').addEventListener('click', () => enterIsland(true));
  $('#skip-opening').addEventListener('click', () => enterIsland(true));

  function showDialog(dialog) {
    lastFocus = document.activeElement;
    dialog.showModal(); document.body.style.overflow = 'hidden';
  }
  function closeDialog(dialog) { dialog.close(); }
  $$('dialog').forEach((dialog) => {
    dialog.querySelector('[data-close]')?.addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('click', (event) => { if (event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog); });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true }); });
  });

  const flight = $('#flight-dialog');
  let flightTimers = [];
  let flightLanded = false;
  $('#board-button').addEventListener('click', () => {
    if (!openingComplete || unlockedStep < steps.indexOf('boarding') || flight.open) return;
    flightLanded = false;
    flightTimers.forEach(clearTimeout); flightTimers = [];
    flight.classList.remove('landed'); $('#flight-arrival').hidden = true;
    $('#flight-title').textContent = '幸福小岛航班，准备起飞';
    $('#flight-status').textContent = '机票已确认，请系好安全带。';
    showDialog(flight);
    const land = () => {
      flightLanded = true;
      flight.classList.add('landed');
      $('#flight-title').textContent = '欢迎抵达，幸福小岛！';
      $('#flight-status').textContent = '今天的小岛天气晴朗，两位新人正在婚礼广场等你。';
      $('#flight-arrival').hidden = false;
    };
    if (reducedMotion) land();
    else {
      flightTimers.push(setTimeout(() => { $('#flight-title').textContent = '正飞往幸福小岛…'; $('#flight-status').textContent = '穿过云朵，带着满满的期待。'; }, 1000));
      flightTimers.push(setTimeout(land, 3200));
    }
  });
  flight.addEventListener('close', () => { flightTimers.forEach(clearTimeout); flightTimers = []; });
  $('#flight-arrival').addEventListener('click', () => {
    if (!flightLanded) return;
    unlockedStep = Math.max(unlockedStep, steps.indexOf('story')); updateJourney();
    closeDialog(flight);
    setTimeout(() => goToStep('story'), 40);
  });

  const rsvpForm = $('#rsvp-form');
  rsvpForm.elements.attendance.addEventListener('change', () => { $('#guests-label').hidden = rsvpForm.elements.attendance.value === 'bless'; });
  let rsvpSubmitting = false;
  rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (rsvpSubmitting) return;
    const guest = rsvpForm.elements.guest.value.trim();
    if (!guest) { rsvpForm.elements.guest.setCustomValidity('请告诉我们你的名字。'); rsvpForm.elements.guest.reportValidity(); return; }
    rsvpForm.elements.guest.setCustomValidity('');
    const attending = rsvpForm.elements.attendance.value === 'attend';
    const count = rsvpForm.elements.guests.value;
    const writtenWish = rsvpForm.elements.wish.value.trim();
    const wish = writtenWish || '祝你们新婚快乐，往后的每一天都有爱与晴天。';
    const submit = rsvpForm.querySelector('[type=submit]');
    if (writtenWish) {
      rsvpSubmitting = true; submit.disabled = true;
      $('#rsvp-save-status').textContent = '正在寄出你的祝福…';
      try {
        const published = await publishBlessing({ name: guest, message: writtenWish });
        $('#receipt-blessing-status').textContent = published ? '这句祝福已保存，会在首页和结尾弹幕展示。' : '你之前的公开祝福已送达，本次回执不会重复发布或覆盖它。';
        $('#rsvp-save-status').textContent = '';
      } catch {
        $('#rsvp-save-status').textContent = '祝福暂未送达，填写内容已保留，请点击下方按钮重试。';
        return;
      } finally { rsvpSubmitting = false; submit.disabled = false; }
    } else {
      $('#rsvp-save-status').textContent = '';
      $('#receipt-blessing-status').textContent = '没有填写祝福文字，本次只生成赴约回执。';
    }
    const summary = attending ? `一定赴约 · 共 ${count} 位\n期待登岛，见证你们的幸福！` : '虽然无法到场，祝福一定准时抵达。';
    $('#receipt-name').textContent = `${guest} ${attending ? '准备好登岛啦' : '为你们送上祝福'}`;
    $('#receipt-summary').textContent = summary; $('#receipt-wish').textContent = wish;
    receiptText = `🏝 幸福小岛 · 婚礼回执\n致 ${config.groom} & ${config.bride}\n\n我是：${guest}\n${attending ? `一定到场，共 ${count} 位` : '远程送上祝福'}\n${config.date ? `日期：${formatDate(config.date)}\n` : ''}${config.time ? `时间：${config.time}\n` : ''}${config.venue ? `地点：${config.venue}\n` : ''}\n${wish}\n\n愿小岛的每一天，都是晴天。♡`;
    $('#rsvp-result').hidden = false; showDialog($('#rsvp-dialog'));
    $('#copy-receipt').focus(); celebrate();
  });
  rsvpForm.elements.guest.addEventListener('input', () => rsvpForm.elements.guest.setCustomValidity(''));
  $('#edit-receipt').addEventListener('click', () => { closeDialog($('#rsvp-dialog')); rsvpForm.elements.guest.focus(); });
  async function copy(text) {
    try { if (!navigator.clipboard?.writeText) throw new Error('fallback'); await navigator.clipboard.writeText(text); }
    catch {
      const input = document.createElement('textarea'); input.value = text; input.style.cssText = 'position:fixed;inset:0;opacity:.01;width:1px;height:1px';
      const parent = document.querySelector('dialog[open]') || document.body; parent.append(input); input.focus(); input.select();
      const success = document.execCommand('copy'); input.remove(); if (!success) throw new Error('copy failed');
    }
  }
  $('#copy-receipt').addEventListener('click', async () => {
    try { await copy(receiptText); toast('回执已复制，去微信发给新人吧 ♡'); }
    catch { toast('复制未成功，请长按回执文字手动复制。'); }
  });

  function celebrate() {
    if (reducedMotion) return;
    const container = $('#confetti'); container.replaceChildren();
    for (let i = 0; i < 34; i++) { const leaf = document.createElement('i'); leaf.style.setProperty('--x', `${Math.random() * 100}%`); leaf.style.setProperty('--color', ['#a9bc8d', '#d6ba83', '#d6ab95', '#b7cec1'][i % 4]); leaf.style.setProperty('--duration', `${2.5 + Math.random() * 2}s`); leaf.style.setProperty('--delay', `${Math.random() * .8}s`); leaf.style.setProperty('--rotate', `${Math.random() * 180}deg`); container.append(leaf); }
    setTimeout(() => container.replaceChildren(), 5500);
  }

  $$('.album-photo').forEach((frame) => frame.addEventListener('click', () => {
    const src = config.photos[Number(frame.dataset.photo)];
    if (!src || frame.dataset.loaded === 'false') { toast('小岛的回忆正在整理中，敬请期待 ♡'); return; }
    $('#preview-photo').src = src; showDialog($('#photo-dialog'));
  }));
  $('#map-button').addEventListener('click', async () => {
    if (config.mapUrl) { try { const url = new URL(config.mapUrl); if (url.protocol === 'https:' || url.protocol === 'http:') { window.open(url.href, '_blank', 'noopener,noreferrer'); return; } } catch {} }
    if (!config.address) { toast('幸福的坐标还在准备中，稍后告诉你 ♡'); return; }
    try { await copy(`${config.venue}\n${config.address}`); toast('婚礼地址已复制，粘贴到地图即可导航。'); } catch { toast(`婚礼地址：${config.address}`); }
  });
  function download(blob, filename) {
    const link = document.createElement('a'); const url = URL.createObjectURL(blob);
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function calendarText() {
    const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const date = new Date(`${config.date}T${config.time || config.schedule[1]}:00+08:00`);
    const stamp = (value) => value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Happiness Island//Wedding//ZH', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:wedding-${config.date}-${encodeURIComponent(config.groom)}-${encodeURIComponent(config.bride)}@happiness-island`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(date)}`, `DTEND:${stamp(new Date(date.getTime() + 3 * 3600000))}`, `SUMMARY:${escape(`${config.groom} & ${config.bride} 的婚礼`)}`, `LOCATION:${escape([config.venue, config.address].filter(Boolean).join(' · '))}`, `DESCRIPTION:${escape('欢迎登岛，见证我们的幸福。你来，就是最好的礼物。')}`, 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:明天记得来参加小岛婚礼', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
  }
  $('#calendar-button').addEventListener('click', () => {
    if (!config.date) { toast('婚期确定后，就可以把幸福记在日历里啦。'); return; }
    download(new Blob([calendarText()], { type: 'text/calendar;charset=utf-8' }), '幸福小岛-婚礼日历.ics'); toast('已生成婚礼日历，打开文件即可添加。');
  });

  const audio = $('#island-music'); audio.volume = .42;
  let musicOn = false;
  function updateMusic(on) { musicOn = on; $$('.music-button').forEach((button) => { button.setAttribute('aria-pressed', String(on)); button.setAttribute('aria-label', on ? '关闭小岛音乐' : '开启小岛音乐'); }); }
  async function setMusic(on, quiet = false) {
    try {
      if (on) await audio.play(); else audio.pause(); updateMusic(on);
      if (on && !quiet) toast('正在播放：动森 · 清晨 5 点 ♫');
    } catch { updateMusic(false); if (!quiet) toast('音乐暂未播放，请再点一下音乐按钮。'); }
  }
  $$('.music-button').forEach((button) => button.addEventListener('click', () => setMusic(!musicOn)));
  audio.addEventListener('pause', () => updateMusic(false)); audio.addEventListener('play', () => updateMusic(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden && musicOn) setMusic(false); });

  if ('IntersectionObserver' in window) {
    document.documentElement.classList.add('js-ready');
    const reveal = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('visible'); reveal.unobserve(entry.target); } }); }, { threshold: .08 });
    $$('.reveal').forEach((element) => reveal.observe(element));
  }
})();
