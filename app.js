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
  ];
  const defaults = { groom: '新郎', bride: '新娘', date: '', time: '', venue: '', address: '', mapUrl: '', groomPhone: '', bridePhone: '', fontData: '', fontName: '', schedule: ['15:30', '16:00', '17:00', '19:00'], photos: Array.from({ length: 12 }, () => ''), editorEnabled: true };
  const initial = Object.assign({}, defaults, window.WEDDING_CONFIG || {});
  const owner = initial.editorEnabled !== false || new URLSearchParams(location.search).get('edit') === '1';
  const storageKey = `wedding-island-draft:${initial.groom}:${initial.bride}:${initial.date}`;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  let config = Object.assign({}, initial);
  let photoDraft = [];
  let toastTimer;
  let lastFocus;
  let receiptText = '';
  let pendingPhotos = 0;
  let fontDraft = { data: '', name: '' };
  let pendingFont = false;
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
    result.schedule = defaults.schedule.map((fallback, i) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.schedule?.[i]) ? value.schedule[i] : fallback);
    result.photos = defaults.photos.map((_, i) => safePhoto(value.photos?.[i]));
    return result;
  }
  if (owner) { try { const draft = JSON.parse(localStorage.getItem(storageKey)); if (draft && typeof draft === 'object') config = Object.assign({}, config, draft); } catch {} }
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
    $$('[data-wedding-time]').forEach((element) => { element.textContent = config.time ? `${config.time} · 心动仪式` : '仪式时间待填写'; });
    $('#schedule-date').textContent = formatDate(config.date);
    $$('[data-schedule]').forEach((element) => { element.textContent = config.schedule[Number(element.dataset.schedule)]; });
    $('#schedule-note').textContent = config.date ? '把这一天交给幸福，把好心情带来就好。' : '以上为参考流程，具体时间等我们揭晓。';
    renderCalendar(); applyFont();
    $$('[data-photo]').forEach((frame) => {
      const content = frame.querySelector('.photo-content');
      content.querySelector('img')?.remove();
      const src = config.photos[Number(frame.dataset.photo)];
      if (src) {
        const image = new Image(); image.alt = photoSlots.find((slot) => slot.index === Number(frame.dataset.photo))?.name || '我们的婚纱照';
        image.loading = 'lazy'; image.decoding = 'async'; image.src = src;
        image.addEventListener('error', () => { image.remove(); frame.dataset.loaded = 'false'; });
        content.append(image); frame.dataset.loaded = 'true';
      } else { frame.dataset.loaded = 'false'; }
    });
    $('#setup-button').hidden = !owner;
    const named = config.groom !== '新郎' || config.bride !== '新娘';
    document.title = named ? `${config.groom} & ${config.bride} · 婚礼森友会` : '集合啦！婚礼森友会';
    $('meta[property="og:title"]').content = document.title;
    if (config.date) $('meta[property="og:description"]').content = `${formatDate(config.date)}，${config.venue || '幸福小岛'}。你来，就是最好的礼物。`;
  }
  render();

  const blessingKey = `wedding-island-blessings:${initial.groom}:${initial.bride}:${initial.date}`;
  let blessings = 0;
  try { blessings = Math.max(0, Math.min(999999999, Number(localStorage.getItem(blessingKey)) || 0)); } catch {}
  function renderBlessings() {
    const status = $('#blessing-status'); status.replaceChildren();
    status.append(document.createTextNode(blessings ? '你是第 ' : '已收到 '));
    const count = document.createElement('b'); count.id = 'blessing-count'; count.textContent = blessings.toLocaleString('zh-CN');
    status.append(count, document.createTextNode(blessings ? ' 位祝福者' : ' 份祝福'));
  }
  renderBlessings();
  $('#blessing-button').addEventListener('click', () => {
    blessings = Math.min(999999999, blessings + 1); renderBlessings();
    try { localStorage.setItem(blessingKey, String(blessings)); } catch {}
    const pop = $('#blessing-pop'); pop.classList.remove('pop'); void pop.offsetWidth; pop.classList.add('pop');
    toast('收到你的祝福啦！幸福值 +1 ♡'); celebrate();
  });

  let openingTimer;
  function enterIsland(withMusic = false) {
    const opening = $('#gift-opening'); if (opening.hidden || opening.classList.contains('leaving')) return;
    clearTimeout(openingTimer); opening.classList.add('leaving');
    $('#invitation').inert = false; $('#page-nav').inert = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (withMusic) setMusic(true, true);
    setTimeout(() => { opening.hidden = true; if (withMusic) $('#hero-title').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }, reducedMotion ? 0 : 550);
  }
  $('#hero-title').setAttribute('tabindex', '-1');
  $('#open-gift').addEventListener('click', () => enterIsland(true));
  $('#skip-opening').addEventListener('click', () => enterIsland(true));
  openingTimer = setTimeout(() => enterIsland(false), 3000);

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
  $('#board-button').addEventListener('click', () => {
    flightTimers.forEach(clearTimeout); flightTimers = [];
    flight.classList.remove('landed'); $('#flight-arrival').hidden = true;
    $('#flight-title').textContent = '幸福小岛航班，准备起飞';
    $('#flight-status').textContent = '机票已确认，请系好安全带。';
    showDialog(flight);
    const land = () => {
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
    closeDialog(flight);
    setTimeout(() => { $('#story').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }); }, 40);
  });

  const rsvpForm = $('#rsvp-form');
  $$('[data-rsvp]').forEach((button) => button.addEventListener('click', () => $('#rsvp').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' })));
  rsvpForm.elements.attendance.addEventListener('change', () => { $('#guests-label').hidden = rsvpForm.elements.attendance.value === 'bless'; });
  rsvpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const guest = rsvpForm.elements.guest.value.trim();
    if (!guest) { rsvpForm.elements.guest.setCustomValidity('请告诉我们你的名字。'); rsvpForm.elements.guest.reportValidity(); return; }
    rsvpForm.elements.guest.setCustomValidity('');
    const attending = rsvpForm.elements.attendance.value === 'attend';
    const count = rsvpForm.elements.guests.value;
    const wish = rsvpForm.elements.wish.value.trim() || '祝你们新婚快乐，往后的每一天都有爱与晴天。';
    const summary = attending ? `一定赴约 · 共 ${count} 位\n期待登岛，见证你们的幸福！` : '虽然无法到场，祝福一定准时抵达。';
    $('#receipt-name').textContent = `${guest} ${attending ? '准备好登岛啦' : '为你们送上祝福'}`;
    $('#receipt-summary').textContent = summary; $('#receipt-wish').textContent = wish;
    receiptText = `🏝 幸福小岛 · 婚礼回执\n致 ${config.groom} & ${config.bride}\n\n我是：${guest}\n${attending ? `一定到场，共 ${count} 位` : '远程送上祝福'}\n${config.date ? `日期：${formatDate(config.date)}\n` : ''}${config.venue ? `地点：${config.venue}\n` : ''}\n${wish}\n\n愿小岛的每一天，都是晴天。♡`;
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
    if (!src || frame.dataset.loaded === 'false') { toast(owner ? '这里留给你们的婚纱照，可在页面底部「布置我的小岛」中添加。' : '小岛的回忆正在整理中，敬请期待 ♡'); return; }
    $('#preview-photo').src = src; showDialog($('#photo-dialog'));
  }));
  $('#map-button').addEventListener('click', async () => {
    if (config.mapUrl) { try { const url = new URL(config.mapUrl); if (url.protocol === 'https:' || url.protocol === 'http:') { window.open(url.href, '_blank', 'noopener,noreferrer'); return; } } catch {} }
    if (!config.address) { toast('幸福的坐标还在准备中，稍后告诉你 ♡'); return; }
    try { await copy(`${config.venue}\n${config.address}`); toast('婚礼地址已复制，粘贴到地图即可导航。'); } catch { toast(`婚礼地址：${config.address}`); }
  });
  $$('[data-contact]').forEach((button) => button.addEventListener('click', () => {
    const person = button.dataset.contact; const phone = config[`${person}Phone`];
    if (!phone) { toast(`${person === 'groom' ? '新郎' : '新娘'}的联系电话还未填写，可直接在微信联系新人。`); return; }
    location.href = `tel:${phone.replace(/[^+\d]/g, '')}`;
  }));
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

  const setupForm = $('#setup-form');
  function renderPhotoPickers() {
    const container = $('#photo-inputs'); container.replaceChildren();
    photoSlots.forEach(({ index: i, name, shape }, position) => {
      const group = document.createElement('div');
      const label = document.createElement('label'); label.className = 'photo-picker';
      const preview = document.createElement('span'); preview.className = 'picker-preview';
      if (photoDraft[i]) { const image = new Image(); image.src = photoDraft[i]; image.alt = name; preview.append(image); }
      else { preview.innerHTML = '<svg><use href="#i-camera"/></svg>'; }
      const caption = document.createElement('span'); caption.textContent = `${String(position + 1).padStart(2, '0')} ${name}`;
      const hint = document.createElement('small'); hint.textContent = shape;
      const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif'; input.setAttribute('aria-label', `选择${name}`);
      input.addEventListener('change', async () => {
        const file = input.files[0]; if (!file) return;
        if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { toast('请选择 JPG、PNG 或 WebP 图片。'); return; }
        if (file.size > 25 * 1024 * 1024) { toast('请先将照片缩小到 25 MB 以内。'); return; }
        pendingPhotos++; $('#setup-error').textContent = '正在整理照片，请稍候…';
        try { photoDraft[i] = await resizePhoto(file); renderPhotoPickers(); $('#setup-error').textContent = ''; }
        catch { $('#setup-error').textContent = '这张照片暂时无法读取，请换一张 JPG 或 PNG。'; }
        finally { pendingPhotos--; }
      });
      label.append(preview, caption, hint, input); group.append(label);
      if (photoDraft[i]) { const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'photo-remove'; remove.textContent = '留空此位置'; remove.setAttribute('aria-label', `移除${name}`); remove.addEventListener('click', () => { photoDraft[i] = ''; renderPhotoPickers(); }); group.append(remove); }
      container.append(group);
    });
  }
  function resizePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = reject;
      reader.onload = () => {
        const image = new Image(); image.onerror = reject;
        image.onload = () => { const max = 1440; const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio); const ctx = canvas.getContext('2d'); if (!ctx) { reject(); return; } ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', .86)); };
        image.src = reader.result;
      }; reader.readAsDataURL(file);
    });
  }
  function openSetup() {
    ['groom', 'bride', 'date', 'time', 'venue', 'address', 'mapUrl', 'groomPhone', 'bridePhone'].forEach((key) => { setupForm.elements[key].value = config[key]; });
    config.schedule.forEach((time, i) => { setupForm.elements[`schedule${i}`].value = time; });
    photoDraft = config.photos.slice(); fontDraft = { data: config.fontData, name: config.fontName }; updateFontStatus(); $('#font-input').value = ''; renderPhotoPickers(); $('#setup-error').textContent = ''; showDialog($('#setup-dialog'));
  }
  $('#setup-button').addEventListener('click', openSetup);
  function collectSettings() {
    if (pendingPhotos || pendingFont) { $('#setup-error').textContent = '照片或字体还在整理，稍等一下再保存。'; return null; }
    if (!setupForm.reportValidity()) return null;
    const next = Object.assign({}, config);
    ['groom', 'bride', 'date', 'time', 'venue', 'address', 'mapUrl', 'groomPhone', 'bridePhone'].forEach((key) => { next[key] = setupForm.elements[key].value.trim(); });
    next.fontData = fontDraft.data; next.fontName = fontDraft.name;
    next.schedule = [0, 1, 2, 3].map((i) => setupForm.elements[`schedule${i}`].value);
    if (next.time) { next.schedule[1] = next.time; setupForm.elements.schedule1.value = next.time; }
    if (next.mapUrl && !/^https?:\/\//i.test(next.mapUrl)) { $('#setup-error').textContent = '地图链接需要以 https:// 或 http:// 开头。'; return null; }
    if (next.schedule.some((time, i, times) => i > 0 && time < times[i - 1])) { $('#setup-error').textContent = '请按先后顺序填写当天日程；仪式时间会同步到「心动仪式」。'; return null; }
    next.photos = photoDraft.slice(); return normalize(next);
  }
  function saveDraft() {
    try { localStorage.setItem(storageKey, JSON.stringify(config)); return true; } catch { return false; }
  }
  setupForm.addEventListener('submit', (event) => {
    event.preventDefault(); const next = collectSettings(); if (!next) return;
    config = next; render(); const stored = saveDraft(); closeDialog($('#setup-dialog'));
    toast(stored ? '小岛布置好啦，快看看你们的专属邀请 ♡' : '已更新预览；浏览器空间不足，请重新打开布置面板导出保存。');
  });
  setupForm.elements.time.addEventListener('input', () => { if (setupForm.elements.time.value) setupForm.elements.schedule1.value = setupForm.elements.time.value; });
  setupForm.elements.schedule1.addEventListener('input', () => { setupForm.elements.time.value = setupForm.elements.schedule1.value; });
  function updateFontStatus() { $('#font-status').textContent = fontDraft.data ? `已选择：${fontDraft.name}。保存后应用到全部文字，并随邀请函一起导出。` : '当前为寒蝉半圆体，非已验证的港版原字库。若你有可使用的原字体，可在这里替换全部文字。'; }
  $('#font-input').addEventListener('change', async (event) => {
    const file = event.target.files[0]; if (!file) return;
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name) || file.size > 15 * 1024 * 1024) { toast('请选择 15 MB 以内的 WOFF、WOFF2、TTF 或 OTF 字体。'); return; }
    pendingFont = true;
    try {
      const buffer = await file.arrayBuffer();
      await new FontFace('IslandFontValidation', buffer).load();
      const encoded = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(new Blob([buffer], { type: 'font/woff2' })); });
      fontDraft = { data: encoded, name: file.name }; updateFontStatus();
    } catch { toast('这个字体文件无法读取，请换一个文件。'); }
    finally { pendingFont = false; }
  });
  $('#reset-font').addEventListener('click', () => { fontDraft = { data: '', name: '' }; $('#font-input').value = ''; updateFontStatus(); });

  async function dataUrl(url) {
    const response = await fetch(url); if (!response.ok) throw new Error('asset fetch failed');
    const blob = await response.blob(); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
  }
  async function standaloneSource(next) {
    const root = document.documentElement.cloneNode(true);
    root.classList.remove('js-ready'); root.querySelectorAll('.reveal').forEach((element) => element.classList.remove('visible'));
    root.querySelector('body').style.overflow = '';
    root.style.removeProperty('--font');
    root.querySelector('#gift-opening').hidden = false; root.querySelector('#gift-opening').classList.remove('leaving');
    root.querySelector('#invitation').inert = true; root.querySelector('#page-nav').inert = true;
    root.querySelector('#blessing-status').innerHTML = '已收到 <b id="blessing-count">0</b> 份祝福';
    root.querySelector('#blessing-pop').classList.remove('pop');
    root.querySelector('#font-input').value = ''; root.querySelector('#font-status').textContent = '可上传你有权使用的字体，并随邀请函导出。';
    root.querySelectorAll('dialog').forEach((element) => element.removeAttribute('open'));
    root.querySelector('#confetti').replaceChildren(); root.querySelector('#toast').classList.remove('visible'); root.querySelector('#toast').textContent = '';
    root.querySelector('#rsvp-form').hidden = false; root.querySelector('#rsvp-result').hidden = true;
    ['#receipt-name', '#receipt-summary', '#receipt-wish', '#setup-error'].forEach((selector) => { root.querySelector(selector).textContent = ''; });
    root.querySelector('#guests-label').hidden = false;
    root.querySelector('#setup-button').hidden = true;
    root.querySelectorAll('input,textarea').forEach((element) => { element.removeAttribute('value'); if (element.tagName === 'TEXTAREA') element.textContent = ''; });
    root.querySelector('#photo-inputs').replaceChildren(); root.querySelector('#preview-photo').removeAttribute('src');
    root.querySelectorAll('button[disabled]').forEach((element) => element.removeAttribute('disabled'));
    root.querySelectorAll('.photo-content img').forEach((element) => element.remove());
    root.querySelectorAll('.music-button').forEach((button) => { button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-label', '开启小岛音乐'); });
    const exportConfig = Object.assign({}, next, { editorEnabled: false, photos: next.photos.slice() });
    for (let i = 0; i < exportConfig.photos.length; i++) { const src = exportConfig.photos[i]; if (src && !src.startsWith('data:')) exportConfig.photos[i] = await dataUrl(new URL(src, location.href).href); }
    const script = root.querySelector('#wedding-config'); script.removeAttribute('src'); script.removeAttribute('defer');
    script.textContent = `window.WEDDING_CONFIG = ${JSON.stringify(exportConfig).replace(/</g, '\\u003c')};`;
    for (const stylesheet of root.querySelectorAll('link[rel="stylesheet"]')) {
      const response = await fetch(stylesheet.href); if (!response.ok) throw new Error('css fetch failed'); let css = await response.text();
      const urls = Array.from(new Set(Array.from(css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g), (match) => match[1])));
      for (const url of urls) { if (url.startsWith('data:') || url.startsWith('#')) continue; const encoded = await dataUrl(new URL(url, stylesheet.href).href); css = css.split(url).join(encoded); }
      const style = document.createElement('style'); style.textContent = css; stylesheet.replaceWith(style);
    }
    const app = root.querySelector('#app-code');
    if (app.hasAttribute('src')) { const response = await fetch(app.src); if (!response.ok) throw new Error('js fetch failed'); app.textContent = await response.text(); app.removeAttribute('src'); app.removeAttribute('defer'); }
    // Inline scripts run after the complete DOM, including when opened directly as a file.
    app.remove(); root.querySelector('body').append(app);
    for (const image of root.querySelectorAll('img[src],audio[src],source[src],link[rel="icon"]')) { const attr = image.tagName === 'LINK' ? 'href' : 'src'; const src = image.getAttribute(attr); if (src && !src.startsWith('data:')) image.setAttribute(attr, await dataUrl(new URL(src, location.href).href)); }
    if (!root.querySelector('#third-party-notices')) {
      const notices = await Promise.all(['REFERENCE-LICENSE.txt', 'FONT-LICENSES.txt', 'ROUND-FONT-LICENSE.txt', '资源来源.md'].map(async (file) => { const response = await fetch(new URL(file, location.href)); if (!response.ok) throw new Error('notice fetch failed'); return response.text(); }));
      const notice = document.createElement('script'); notice.type = 'text/plain'; notice.id = 'third-party-notices'; notice.textContent = notices.join('\n\n'); root.querySelector('head').append(notice);
    }
    return '<!doctype html>\n' + root.outerHTML;
  }
  $('#export-button').addEventListener('click', async () => {
    const next = collectSettings(); if (!next) return;
    const button = $('#export-button'); button.disabled = true; $('#setup-error').textContent = '正在打包婚礼邀请函与照片…';
    try {
      config = next; render(); saveDraft();
      const html = await standaloneSource(next);
      download(new Blob([html], { type: 'text/html;charset=utf-8' }), '幸福小岛-婚礼邀请函.html');
      $('#setup-error').textContent = ''; toast('专属邀请函已导出，照片和婚礼信息都在里面 ♡');
    } catch { $('#setup-error').textContent = '导出未完成。请用附带的「婚礼邀请函.html」单文件版本重试，或保持本地预览服务开启。'; }
    finally { button.disabled = false; }
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
    const nav = new IntersectionObserver((entries) => { entries.forEach((entry) => { if (entry.isIntersecting) { $$('.desktop-nav a,.mobile-nav a').forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`)); } }); }, { rootMargin: '-15% 0px -65% 0px' });
    $$('main>section[id]').forEach((element) => nav.observe(element));
  }
})();
