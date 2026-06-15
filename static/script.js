const MOCK_USER = { id: null, username: 'user', display_name: 'Пользователь', activity_score: 0, star_color: '#ffffff', effect: null, skins_owned: ['white'], info: '' };

// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
(function checkAuth() {
    const raw = localStorage.getItem('star_sky_current_user');
    if (!raw && !window.location.pathname.includes('auth')) {
        window.location.href = '/auth';
        return;
    }
    if (raw) {
        try {
            const u = JSON.parse(raw);
            // display_name = имя из Telegram, username = @login из Telegram
            MOCK_USER.id           = u.id || null;
            MOCK_USER.display_name = u.display_name || u.username || 'Пользователь';
            MOCK_USER.username     = u.username || u.login || 'user';
            MOCK_USER.activity_score = u.activityScore || u.activity_score || 0;
            MOCK_USER.star_color   = u.starColor || u.star_color || '#ffffff';
            MOCK_USER.effect       = u.effect || null;
            MOCK_USER.info         = u.info || '';
        } catch(e) {}
    }
})();



// ===== СИСТЕМА СОХРАНЕНИЯ НАСТРОЕК (localStorage) =====

const SETTINGS_STORAGE_KEY = 'star_sky_settings';

// Структура сохраняемых настроек
const defaultSettings = {
  // Чат
  chatPosition: 'center',
  chatWidth: 600,
  chatHeight: 600,
  
  // Топбар
  topbarStyle: 'default',
  
  // Фон
  backgroundTheme: 'deep_space',
  animSettings: { speed: 100, intensity: 72, blur: 12, scale: 100 },
  
  // Тема чата
  chatTheme: 'cosmos',
  
  // Звук
  soundSettings: {
    mention: 'celestial',
    private: 'wind_chime',
    system: 'harp'
  },
  allSoundsMuted: false,
  
  // Профиль
  displayName: MOCK_USER.display_name || 'Пользователь',
  userInfo: MOCK_USER.info || '',
  starColor: '#ffffff',
  starEffect: null,
  
  // Звезда за курсором
  cursorStarEnabled: false,
  
  // Состояние панелей (свернуты/развернуты)
  chatCollapsed: false,
  shopCollapsed: true,
  leaderboardCollapsed: true,
  
  // Собственная тема чата
  customChatTheme: {
    bg: '#0f0f0f',
    incoming: '#1f1f1f',
    outgoing: '#8774e1',
    accent: '#8774e1',
    text: '#ffffff'
  },
  customThemeApplied: false
};

// Загрузка настроек
function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    const merged = { ...defaultSettings, ...parsed };
    // Всегда берём актуальные данные пользователя из MOCK_USER
    merged.displayName = MOCK_USER.display_name || merged.displayName || 'Пользователь';
    merged.starColor   = MOCK_USER.star_color   || merged.starColor   || '#ffffff';
    merged.starEffect  = MOCK_USER.effect        || merged.starEffect  || null;
    merged.userInfo    = MOCK_USER.info          || merged.userInfo    || '';
    return merged;
  } catch (e) {
    console.warn('Failed to load settings:', e);
    return { ...defaultSettings };
  }
}

// Сохранение настроек
function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

// Текущие настройки
let appSettings = loadSettings();


// ===== ВЫХОД ИЗ АККАУНТА =====
function logout() {
    // Очищаем данные пользователя
    localStorage.removeItem('star_sky_current_user');
    // Редирект на страницу входа
    window.location.href = '/auth';
}

  // Простой throttle
function throttle(func, delay) {
    let lastCall = 0;
    return function(...args) {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            return func.apply(this, args);
        }
    };
}

// ===== ТЕСТОВЫЕ ДАННЫЕ (без реального бэкенда) =====

// Применяем данные из localStorage сразу
(function() {
    try {
        const u = JSON.parse(localStorage.getItem('star_sky_current_user') || '{}');
        if (u && (u.display_name || u.username)) {
            MOCK_USER.id           = u.id || null;
            MOCK_USER.display_name = u.display_name || u.username || 'Пользователь';
            MOCK_USER.username     = u.username || u.login || 'user';
            MOCK_USER.activity_score = u.activityScore || u.activity_score || 0;
            MOCK_USER.star_color   = u.starColor || u.star_color || '#ffffff';
            MOCK_USER.effect       = u.effect || null;
            MOCK_USER.info         = u.info || '';
        }
    } catch(e) {}
})();

// ===== API СЛОЙ =====
const API = {
    _token() { return localStorage.getItem('star_sky_token') || ''; },
    _headers() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this._token() }; },
    async getProfile() {
        try {
            const r = await fetch('/api/auth/me', { headers: this._headers() });
            if (!r.ok) return null;
            return (await r.json()).user || null;
        } catch(e) { return null; }
    },
    async getUsers() {
        try {
            const r = await fetch('/api/users/list', { headers: this._headers() });
            if (!r.ok) return [];
            return (await r.json()).users || [];
        } catch(e) { return []; }
    },
    async getMessages(limit=50, offset=0) {
        try {
            const r = await fetch(`/api/messages/get?limit=${limit}&offset=${offset}`, { headers: this._headers() });
            if (!r.ok) return [];
            return (await r.json()).messages || [];
        } catch(e) { return []; }
    },
    async sendMessage(text, replyTo=null) {
        try {
            const r = await fetch('/api/messages/send', {
                method: 'POST', headers: this._headers(),
                body: JSON.stringify({ text, reply_to: replyTo })
            });
            if (!r.ok) return null;
            const d = await r.json();
            if (!d.success) return null;
            const msg = d.message || {};
            if (d.new_balance !== undefined) msg.new_balance = d.new_balance;
            return msg;
        } catch(e) { return null; }
    },
    async updateProfile(data) {
        try {
            const r = await fetch('/api/auth/profile', {
                method: 'PATCH', headers: this._headers(),
                body: JSON.stringify(data)
            });
            return r.ok ? (await r.json()).success : false;
        } catch(e) { return false; }
    },
    async getFriends() {
        try {
            const r = await fetch('/api/friends/list', { headers: this._headers() });
            if (!r.ok) return [];
            return (await r.json()).friends || [];
        } catch(e) { return []; }
    },
    async sendFriendRequest(username) {
        try {
            const r = await fetch('/api/friends/request', {
                method: 'POST', headers: this._headers(),
                body: JSON.stringify({ friend_username: username })
            });
            return r.ok ? (await r.json()) : null;
        } catch(e) { return null; }
    },
    async heartbeat() {
        try { await fetch('/api/users/heartbeat', { method: 'POST', headers: this._headers() }); } catch(e) {}
    },
    async getOnlineUsers() {
        try {
            const r = await fetch('/api/users/online', { headers: this._headers() });
            if (!r.ok) return null;
            return await r.json();
        } catch(e) { return null; }
    }
};

// Список пользователей — загружается с бэкенда
const MOCK_USERS = [];

// История чата — загружается с бэкенда
const MOCK_MESSAGES = [];

// ===== ЗАГРУЗКА ДАННЫХ С СЕРВЕРА =====
async function loadServerData() {
    // 1. Профиль текущего пользователя
    const profile = await API.getProfile();
    if (profile) {
        MOCK_USER.id           = profile.id;
        MOCK_USER.display_name = profile.display_name;  // имя из Telegram (first_name)
        MOCK_USER.username     = profile.username;       // @username из Telegram
        MOCK_USER.activity_score = profile.activity_score || 0;
        MOCK_USER.star_color   = profile.star_color || '#ffffff';
        MOCK_USER.effect       = profile.star_effect || null;
        MOCK_USER.info         = profile.bio || '';

        // Синхронизируем localStorage
        const stored = JSON.parse(localStorage.getItem('star_sky_current_user') || '{}');
        stored.id           = profile.id;
        stored.display_name = profile.display_name;
        stored.username     = profile.username;
        stored.login        = profile.username;
        stored.starColor    = profile.star_color || '#ffffff';
        stored.activityScore = profile.activity_score || 0;
        stored.info         = profile.bio || '';
        localStorage.setItem('star_sky_current_user', JSON.stringify(stored));

        // Обновляем UI элементы профиля
        _updateProfileUI();

        // Загружаем актуальный баланс из ActivityLog (не из кеша профиля)
        try {
            const balResp = await fetch('/api/activity/balance', { headers: API._headers() });
            if (balResp.ok) {
                const balData = await balResp.json();
                if (balData.success && typeof balData.balance === 'number') {
                    currentActivity = balData.balance;
                    MOCK_USER.activity_score = currentActivity;
                    const balEl = document.getElementById('balance-amount');
                    if (balEl) balEl.textContent = Math.floor(currentActivity);
                    if (typeof window.syncMobBalance === 'function') window.syncMobBalance();
                }
            }
        } catch(e) {
            // fallback на данные из профиля
            currentActivity = profile.activity_score || 0;
            const balEl = document.getElementById('balance-amount');
            if (balEl) balEl.textContent = Math.floor(currentActivity);
        }

        // Обновляем мою звезду на карте
        const myStar = stars.find(s => s.isMe);
        if (myStar) {
            myStar.name         = profile.display_name;
            myStar.username     = profile.username;
            myStar.display_name = profile.display_name;
            myStar.color        = profile.star_color || '#ffffff';
        }
    }

    // 2. Все пользователи → звёзды на карте
    const users = await API.getUsers();
    users.forEach(u => {
        if (u.username === MOCK_USER.username) return; // себя не дублируем
        if (stars.find(s => s.username === u.username)) return; // уже есть
        stars.push(createStarObject({
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            info: u.bio || '',
            active: u.is_online,
            activity_score: u.activity_score || 0,
            star_color: u.star_color || '#ffffff',
            days_active: u.days_active || 0,
            messages_sent: u.messages_count || 0,
            friends_count: u.friends_count || 0
        }));
    });

    // 3. История чата
    const messages = await API.getMessages(50);
    const chatEl = document.getElementById('chat-messages');
    if (chatEl && messages.length > 0) {
        messages.forEach(m => _appendServerMessage(m));
        chatEl.scrollTop = chatEl.scrollHeight;
    }

    // 4. Загружаем задания и друзей из БД
    loadTasks();
    loadFriendsFromServer();

    // 5. Heartbeat и виджет онлайна
    startHeartbeat();

    // 6. Запускаем polling чата
    startChatPolling();
}

// Обновляет все DOM-элементы профиля
function _updateProfileUI() {
    const dn = MOCK_USER.display_name || 'Пользователь';
    const un = MOCK_USER.username || 'user';

    // Десктоп — все элементы с именем
    ['profile-display-name','profile-display-name-label','profile-avatar-card-name',
     'user-label','profile-display-name-inner'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = dn;
    });
    // Десктоп — все элементы с @username
    ['profile-username-display','profile-username-display2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '@' + un;
    });
    document.querySelectorAll('.profile-handle, #profile-handle').forEach(el => {
        el.textContent = '@' + un;
    });

    // Поле редактирования имени
    const editInput = document.getElementById('edit-username-input');
    if (editInput && !editInput.dataset.userEdited) editInput.value = dn;

    // Bio
    const bioDisplay = document.getElementById('profile-bio-display');
    if (bioDisplay) bioDisplay.textContent = MOCK_USER.info || '';
    const editInfo = document.getElementById('edit-info');
    if (editInfo && !editInfo.dataset.userEdited) editInfo.value = MOCK_USER.info || '';

    // Мобильный профиль
    const mobName   = document.getElementById('mob-profile-name-lg');
    const mobHandle = document.getElementById('mob-profile-handle-lg');
    const mobAvatar = document.getElementById('mob-profile-avatar-lg');
    const mobRowName   = document.getElementById('mob-profile-row-name');
    const mobRowHandle = document.getElementById('mob-profile-row-handle');
    if (mobName)      mobName.textContent   = dn;
    if (mobHandle)    mobHandle.textContent  = '@' + un;
    if (mobAvatar)    mobAvatar.textContent  = dn.charAt(0).toUpperCase();
    if (mobRowName)   mobRowName.textContent = dn;
    if (mobRowHandle) mobRowHandle.textContent = '@' + un;

    // Заголовок панели профиля
    const profileHeaderHandle = document.querySelector('.profile-modal-handle, #profile-modal-handle');
    if (profileHeaderHandle) profileHeaderHandle.textContent = '@' + un;
}

// Добавляет сообщение с сервера в DOM чата
function _appendServerMessage(m) {
    const chatEl = document.getElementById('chat-messages');
    if (!chatEl) return;
    if (chatEl.querySelector(`[data-msg-id="${m.id}"]`)) return;
    const isMe = m.username === MOCK_USER.username;
    const div = document.createElement('div');
    div.className = 'chat-line ' + (isMe ? 'chat-me' : 'chat-other');
    div.dataset.msgId = m.id;
    // Первая буква имени для аватарки
    const initials = (m.display_name || m.username || '?')[0].toUpperCase();
    const avatarHtml = `<div class="chat-avatar"><span class="chat-avatar-text">${initials}</span><div class="chat-avatar-status offline"></div></div>`;
    div.innerHTML = `${avatarHtml}<div class="chat-username">${m.display_name || m.username}</div><div class="chat-text">${m.text}</div><div class="chat-time">${m.time || ''}</div>`;
    chatEl.appendChild(div);
}

// Polling чата каждые 5 секунд
let _chatPollInterval = null;
function startChatPolling() {
    if (_chatPollInterval) return;
    _chatPollInterval = setInterval(async () => {
        const messages = await API.getMessages(20);
        const chatEl = document.getElementById('chat-messages');
        if (!chatEl || !messages.length) return;
        let added = false;
        messages.forEach(m => {
            if (!chatEl.querySelector(`[data-msg-id="${m.id}"]`)) {
                _appendServerMessage(m);
                added = true;
            }
        });
        if (added) chatEl.scrollTop = chatEl.scrollHeight;
    }, 5000);
}

function timeStr(minAgo) {
  const d = new Date(Date.now() + minAgo * 60000);
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}

// ===== CANVAS И ЗВЁЗДЫ =====
const canvas = document.getElementById("starfield");
const ctx = canvas.getContext("2d");

// Оптимизации рендера для мобильных
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth <= 640;
const TARGET_FPS = IS_MOBILE ? 30 : 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let _lastFrameTime = 0;

// Кэш цветов: hexToRgba вызывается каждый кадр для каждой звезды
const _colorCache = new Map();
function cachedRgba(hex, alpha) {
  const key = hex + '|' + alpha.toFixed(2);
  if (_colorCache.has(key)) return _colorCache.get(key);
  const v = hexToRgba(hex, alpha);
  if (_colorCache.size > 512) _colorCache.clear();
  _colorCache.set(key, v);
  return v;
}

let stars = [];
let lastTime = 0, globalTime = 0;
let currentHoveredStar = null;
let viewportOffset = {x:0, y:0};
let isDragging = false, lastMouseX = 0, lastMouseY = 0;
let dragVelocity = {x:0, y:0};
let _dragMoved = false;
let zoom = 1.0, targetZoom = 1.0;
const MIN_ZOOM = 0.5, MAX_ZOOM = 2.0;
const MAP_SIZE = 2000, MAP_BOUNDS = MAP_SIZE / 2;
let dragIndicatorTimeout;

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function hexToRgb(hex) {
  let h = hex.replace('#','');
  if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r:parseInt(h.substring(0,2),16), g:parseInt(h.substring(2,4),16), b:parseInt(h.substring(4,6),16) };
}
function hexToRgba(hex, alpha) { const {r,g,b}=hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }

// Гауссово случайное: Box-Muller преобразование -> значение ~N(0,1)
function gaussianRand() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
// Центрированное размещение: σ = 30% от MAP_BOUNDS -> большинство звёзд ближе к центру
function gaussianMapCoord() {
  const sigma = MAP_BOUNDS * 0.35; // стандартное отклонение - 35% от границы
  let val = gaussianRand() * sigma;
  // Ограничиваем жёсткой границей, чтобы не вылетать за карту
  return Math.max(-MAP_BOUNDS * 0.92, Math.min(MAP_BOUNDS * 0.92, val));
}

function createStarObject(data) {
  return {
    userId: data.id, worldX: gaussianMapCoord(), worldY: gaussianMapCoord(),
    x:0, y:0, radius:7, username: data.username, name: data.display_name || data.username,
    info: data.info || "Нет описания", active: !!data.active, away: !!data.away, activityLevel: data.active ? 1 : 0.3,
    activityScore: data.activity_score || 0,
    daysActive: data.days_active || 0,
    messagesSent: data.messages_sent || 0,
    friendsCount: data.friends_count || 0,
    color: data.star_color || '#ffffff', targetColor: data.star_color || '#ffffff',
    colorLerpT: 1, twinklePhase: Math.random()*Math.PI*2, speedX: (Math.random()-0.5)*0.01, speedY: (Math.random()-0.5)*0.01,
    vibSpeedX: 0.02+Math.random()*0.03, vibSpeedY: 0.02+Math.random()*0.03,
    vibPhaseX: Math.random()*Math.PI*2, vibPhaseY: Math.random()*Math.PI*2
  };
}

MOCK_USERS.forEach(u => stars.push(createStarObject(u)));

// Добавляем свою звезду на карту
(function _addMystar() {
    const me = createStarObject({
        username: MOCK_USER.username,
        display_name: MOCK_USER.display_name,
        info: MOCK_USER.info || '',
        active: true,
        activity_score: MOCK_USER.activity_score,
        star_color: MOCK_USER.star_color,
    });
    me.isMe = true;
    stars.push(me);
})();

// Загружаем данные с сервера после инициализации DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { _updateProfileUI(); loadServerData(); });
} else {
    setTimeout(() => { _updateProfileUI(); loadServerData(); }, 200);
}

function worldToScreen(wx, wy) {
  return {
    x: (wx - viewportOffset.x) * zoom,
    y: (wy - viewportOffset.y) * zoom,
  };
}
function screenToWorld(sx, sy) {
  return {
    x: viewportOffset.x + sx / zoom,
    y: viewportOffset.y + sy / zoom,
  };
}

function centreViewport() {
  // Размещаем мировую точку (0,0) точно по центру экрана
  viewportOffset.x = -(canvas.width  / 2) / zoom;
  viewportOffset.y = -(canvas.height / 2) / zoom;
}

function clampViewport() {
  // Видимые полуразмеры мира при текущем зуме
  const hw = (canvas.width  / 2) / zoom;
  const hh = (canvas.height / 2) / zoom;
  viewportOffset.x = Math.max(-MAP_BOUNDS - hw, Math.min(MAP_BOUNDS - hw, viewportOffset.x));
  viewportOffset.y = Math.max(-MAP_BOUNDS - hh, Math.min(MAP_BOUNDS - hh, viewportOffset.y));
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  centreViewport();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function updateStars(delta) {
  const dt = delta * 0.06;
  globalTime += dt;
  for (const star of stars) {
    star.worldX = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, star.worldX + star.speedX*dt));
    star.worldY = Math.max(-MAP_BOUNDS, Math.min(MAP_BOUNDS, star.worldY + star.speedY*dt));
    const sc = worldToScreen(star.worldX, star.worldY);
    const baseX = sc.x, baseY = sc.y;
    if (star.active) star.activityLevel = clamp01(star.activityLevel + 0.05*dt);
    else if (star.away) star.activityLevel = clamp01(star.activityLevel - 0.002*dt);
    else star.activityLevel = clamp01(star.activityLevel - 0.0008*dt);
    star.twinklePhase += 0.002*dt;
    const k = (Math.sin(star.twinklePhase)+1)/2;
    // Единый базовый размер — одинаковый для всех, активные/онлайн чуть больше
    const BASE_R = 5.0;
    const ACTIVE_BONUS = star.active ? 2.2 : (star.away ? 0.6 : 0);
    const baseRadius = BASE_R + ACTIVE_BONUS;
    star.radius = baseRadius * (0.82 + 0.36*k) * zoom;
    // Свечение: активный = яркое, отошёл = среднее, офлайн = тусклое
    const glowBase = star.active ? 1.0 : (star.away ? 0.55 : 0.28);
    star.glow = glowBase * (0.7 + 0.3*k);

    const vibAmp = (star.active ? 3.5 : (star.away ? 1.8 : 0.8)) * zoom;
    star.x = baseX + Math.sin(globalTime*star.vibSpeedX+star.vibPhaseX)*vibAmp;
    star.y = baseY + Math.cos(globalTime*star.vibSpeedY+star.vibPhaseY)*vibAmp;
  }
}

// ===== СИСТЕМА ЗВЕЗДЫ-КУРСОРА — одиночная + последователи =====
let cursorStarEnabled = false;
let cursorStarVisible = false;
let cursorX = 0, cursorY = 0;
let cursorPhase = 0;

// Пружинная физика для своей звезды
let starSmoothX = 0, starSmoothY = 0;
let starVelX = 0, starVelY = 0;
const STAR_SPRING = 0.14;
const STAR_DAMPING = 0.72;
const STAR_OFFSET_X = 24;
const STAR_OFFSET_Y = -20;

// Шлейф персональной звезды
let cursorTrail = [];
const TRAIL_MAX = 22;

// Звёзды-последователи
const followerStars = [];
const MAX_FOLLOWERS = 5;
let followerMode = 'train';

// Кольцевой буфер позиций курсора для режима цепочки
const trailHistory = [];
const TRAIL_HISTORY_MAX = 400;

let CURSOR_STAR_COLOR = MOCK_USER.star_color || '#ffffff';
let _previewActive = false;
let _previewOrigColor = CURSOR_STAR_COLOR;
let _previewBtn = null;

const throttledMouseMove = throttle(function(e) {
  if (!cursorStarEnabled && followerStars.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  cursorX = e.clientX - rect.left;
  cursorY = e.clientY - rect.top;
  cursorStarVisible = true;
  trailHistory.push({ x: cursorX, y: cursorY });
  if (trailHistory.length > TRAIL_HISTORY_MAX) trailHistory.shift();
}, 16);

canvas.addEventListener('mousemove', throttledMouseMove);
canvas.addEventListener('mouseleave', () => {
  cursorStarVisible = false;
  cursorTrail = [];
});

// Клик по звезде-курсору или последователю по сглаженным позициям
canvas.addEventListener('click', e => {
  if (!cursorStarEnabled && followerStars.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const HIT = 14;
  if (cursorStarEnabled) {
    const sx = starSmoothX + STAR_OFFSET_X, sy = starSmoothY + STAR_OFFSET_Y;
    if (Math.hypot(mx - sx, my - sy) < HIT) {
      const myStar = stars.find(s => s.username === MOCK_USER.username);
      if (myStar) { showStarCard(myStar); return; }
    }
  }
  for (const f of followerStars) {
    if (f.smoothX !== undefined && Math.hypot(mx - f.smoothX, my - f.smoothY) < HIT) {
      const s = stars.find(st => st.username === f.user.username);
      if (s) { showStarCard(s); return; }
    }
  }
});

// Куда последователь хочет попасть — только в режиме цепочки
function getFollowerTarget(follower, idx) {
  const TARGET_DIST = 52 * (idx + 1);
  if (trailHistory.length < 2) return { x: cursorX, y: cursorY };
  let walked = 0;
  for (let i = trailHistory.length - 1; i > 0; i--) {
    const a = trailHistory[i], b = trailHistory[i - 1];
    const seg = Math.hypot(a.x - b.x, a.y - b.y);
    walked += seg;
    if (walked >= TARGET_DIST) {
      const excess = walked - TARGET_DIST;
      const t = excess / seg;
      return { x: a.x * (1-t) + b.x * t, y: a.y * (1-t) + b.y * t };
    }
  }
  return { x: trailHistory[0].x, y: trailHistory[0].y };
}

function drawOneStar(x, y, color, radius, label, alpha, trailPts, effectId) {
  if (trailPts && trailPts.length > 1) {
    trailPts.forEach((p, i) => {
      const prog = (i + 1) / trailPts.length;
      const a = prog * 0.32 * (1 - p.age / 500) * alpha;
      const r = Math.max(0.3, radius * prog * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(color, a);
      ctx.shadowColor = hexToRgba(color, a * 0.6);
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
    });
  }

  // Рендер эффекта вокруг звезды
  if (effectId) {
    const t = performance.now() / 1000;
    ctx.save();
    if (effectId === 'pulse') {
      const s = 0.5 + 0.5 * Math.abs(Math.sin(t * 3));
      ctx.beginPath(); ctx.arc(x, y, radius * (2 + s * 1.2), 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.4 * (1 - s * 0.5));
      ctx.lineWidth = 2.5; ctx.stroke();
    } else if (effectId === 'rainbow') {
      const hue = (t * 100) % 360;
      ctx.beginPath(); ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue},100%,65%,0.55)`;
      ctx.lineWidth = 2.5; ctx.shadowColor = `hsl(${hue},100%,65%)`; ctx.shadowBlur = 12; ctx.stroke();
    } else if (effectId === 'shimmer') {
      for (let i = 0; i < 3; i++) {
        const phase = t * 2.5 + i * 2.1;
        const aa = 0.22 * Math.abs(Math.sin(phase));
        ctx.beginPath(); ctx.arc(x, y, radius * (1.8 + i * 0.7), 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(color, aa); ctx.lineWidth = 1.5; ctx.stroke();
      }
    } else if (effectId === 'sparkle') {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + t * 1.5;
        const dist = radius * (1.8 + 0.5 * Math.sin(t * 4 + i));
        const sa = 0.75 * Math.abs(Math.sin(t * 3 + i));
        ctx.beginPath(); ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 2, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(color, sa); ctx.shadowColor = hexToRgba(color, sa); ctx.shadowBlur = 6; ctx.fill();
      }
    } else if (effectId === 'glow') {
      const gr = radius * (2.8 + 0.5 * Math.sin(t * 2));
      const grad = ctx.createRadialGradient(x, y, radius * 0.5, x, y, gr);
      grad.addColorStop(0, hexToRgba(color, 0.5)); grad.addColorStop(1, hexToRgba(color, 0));
      ctx.beginPath(); ctx.arc(x, y, gr, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    } else if (effectId === 'wave') {
      [1.8, 2.8].forEach((mult, i) => {
        const wr = radius * (mult + 0.4 * Math.sin(t * 2.5 + i));
        ctx.beginPath(); ctx.arc(x, y, wr, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(color, 0.3 - i * 0.1); ctx.lineWidth = 1.5 - i * 0.3; ctx.stroke();
      });
    } else if (effectId === 'pulsar') {
      [1.6, 2.6, 3.6].forEach((mult, i) => {
        const phase = (t * 2 - i * 0.45) % 1;
        const rr = radius * mult * phase;
        const aa = 0.55 * (1 - phase);
        if (aa > 0.01) { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.strokeStyle = hexToRgba(color, aa); ctx.lineWidth = 1.5; ctx.stroke(); }
      });
    } else if (effectId === 'nebula') {
      const hue = (t * 35) % 360;
      const grad2 = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 3.2);
      grad2.addColorStop(0, `hsla(${hue},80%,70%,0.28)`); grad2.addColorStop(0.5, `hsla(${(hue+60)%360},80%,60%,0.1)`); grad2.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2); ctx.fillStyle = grad2; ctx.fill();
    } else if (effectId === 'galaxy') {
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.9;
        const dist2 = radius * (2.2 + 0.5 * Math.sin(t * 1.5 + i));
        ctx.beginPath(); ctx.arc(x + Math.cos(angle) * dist2, y + Math.sin(angle) * dist2, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(i/8)*360},90%,70%,0.75)`; ctx.fill();
      }
    } else if (effectId === 'black_hole') {
      const grad3 = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.8);
      grad3.addColorStop(0, 'rgba(0,0,0,0.92)'); grad3.addColorStop(0.35, hexToRgba(color, 0.45)); grad3.addColorStop(1, 'transparent');
      ctx.beginPath(); ctx.arc(x, y, radius * 3.8, 0, Math.PI * 2); ctx.fillStyle = grad3; ctx.fill();
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6);
      ctx.beginPath(); ctx.ellipse(0, 0, radius * 3.2, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.5); ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(color, alpha * 0.92);
  ctx.shadowColor = hexToRgba(color, 1);
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.font = '500 10px "Unbounded",sans-serif';
    ctx.fillStyle = hexToRgba(color, alpha * 0.8);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(label, x + radius + 5, y - 4);
    ctx.restore();
  }
}

function drawCursorStar(dt) {
  if (!cursorStarVisible) return;
  const safeDt = Math.min(dt, 50);
  cursorPhase += safeDt * 0.0025;

  if (cursorStarEnabled) {
    const targetX = cursorX + STAR_OFFSET_X;
    const targetY = cursorY + STAR_OFFSET_Y;
    starVelX += (targetX - starSmoothX) * STAR_SPRING;
    starVelY += (targetY - starSmoothY) * STAR_SPRING;
    starVelX *= STAR_DAMPING;
    starVelY *= STAR_DAMPING;
    starSmoothX += starVelX;
    starSmoothY += starVelY;
    const pulse = 1 + 0.12 * Math.sin(cursorPhase * 2.5);
    const radius = 6 * pulse;

    cursorTrail.push({ x: starSmoothX, y: starSmoothY, age: 0 });
    if (cursorTrail.length > TRAIL_MAX) cursorTrail.shift();
    cursorTrail.forEach(p => { p.age += safeDt; });
    cursorTrail = cursorTrail.filter(p => p.age < 600);

    // Передаём currentEffect для рендера активного эффекта на звезде-курсоре
    drawOneStar(starSmoothX, starSmoothY, CURSOR_STAR_COLOR, radius, MOCK_USER.display_name, 1.0, cursorTrail, currentEffect);
  }

  // Пружинная физика звёзд-последователей
  followerStars.forEach((f, idx) => {
    // Фаза орбиты растёт с постоянной скоростью
    f.phase += safeDt * 0.0018;

    const target = getFollowerTarget(f, idx);
    if (f.smoothX === undefined) { f.smoothX = target.x; f.smoothY = target.y; f.vx = 0; f.vy = 0; }

    // Чуть более мягкая пружина, чем у своей звезды
    const sp = 0.13;
    const dm = 0.72;
    f.vx = (f.vx + (target.x - f.smoothX) * sp) * dm;
    f.vy = (f.vy + (target.y - f.smoothY) * sp) * dm;
    f.smoothX += f.vx;
    f.smoothY += f.vy;

    const color = f.user.star_color || '#8774e1';
    const fR = 5.5 * (1 + 0.08 * Math.sin(cursorPhase * 2.5 + idx * 1.2));
    drawOneStar(f.smoothX, f.smoothY, color, fR, f.user.display_name, 0.88, null);
  });
}

// Управление последователями
function addFollower(user) {
  if (followerStars.length >= MAX_FOLLOWERS) return false;
  if (followerStars.some(f => f.user.username === user.username)) return false;
  if (user.username === MOCK_USER.username) return false;
  followerStars.push({ user, phase: (followerStars.length / MAX_FOLLOWERS) * Math.PI * 2, 
    smoothX: cursorX, smoothY: cursorY, vx: 0, vy: 0 });
  updateFollowerUI();
  return true;
}
function removeFollower(username) {
  const idx = followerStars.findIndex(f => f.user.username === username);
  if (idx >= 0) { followerStars.splice(idx, 1); updateFollowerUI(); }
}
function updateFollowerUI() {
  const list = document.getElementById('follower-stars-list');
  if (!list) return;
  list.innerHTML = '';
  if (followerStars.length === 0) {
    list.innerHTML = '<div style="color:#3d5473;font-size:11px;text-align:center;padding:8px;">Никто не добавлен</div>';
  } else {
    followerStars.forEach(f => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(109,74,255,0.08);';
      item.innerHTML = `
        <div style="width:10px;height:10px;border-radius:50%;background:${f.user.star_color||'#8774e1'};box-shadow:0 0 6px ${f.user.star_color||'#8774e1'}88;flex-shrink:0;"></div>
        <span style="flex:1;font-size:11px;color:#c4cfe8;">${f.user.display_name}</span>
        <button onclick="removeFollower('${f.user.username}')" style="border:none;background:rgba(239,68,68,0.15);color:#ef4444;border-radius:6px;padding:2px 8px;font-size:10px;cursor:pointer;font-family:inherit;">✕</button>`;
      list.appendChild(item);
    });
  }
  const counter = document.getElementById('follower-count');
  if (counter) counter.textContent = `${followerStars.length}/${MAX_FOLLOWERS}`;
  // Синхронизация списка последователей для мобильных
  if (typeof window.updateMobFollowerList === 'function') window.updateMobFollowerList();
}


// ===== QUADTREE - пространственное разделение для оптимизации рендера =====
class QuadTree {
  constructor(bounds, capacity = 8, maxDepth = 6, depth = 0) {
    this.bounds = bounds;
    this.capacity = capacity;
    this.maxDepth = maxDepth;
    this.depth = depth;
    this.points = [];
    this.divided = false;
  }
  contains(star) {
    const b = this.bounds;
    return star.x >= b.x && star.x < b.x + b.w && star.y >= b.y && star.y < b.y + b.h;
  }
  intersects(range) {
    const b = this.bounds;
    return !(range.x > b.x + b.w || range.x + range.w < b.x || range.y > b.y + b.h || range.y + range.h < b.y);
  }
  insert(star) {
    if (!this.contains(star)) return false;
    if (this.points.length < this.capacity || this.depth >= this.maxDepth) {
      this.points.push(star); return true;
    }
    if (!this.divided) this._subdivide();
    return this.ne.insert(star) || this.nw.insert(star) || this.se.insert(star) || this.sw.insert(star);
  }
  _subdivide() {
    const {x, y, w, h} = this.bounds;
    const hw = w/2, hh = h/2, d = this.depth+1;
    this.ne = new QuadTree({x: x+hw, y, w: hw, h: hh}, this.capacity, this.maxDepth, d);
    this.nw = new QuadTree({x, y, w: hw, h: hh}, this.capacity, this.maxDepth, d);
    this.se = new QuadTree({x: x+hw, y: y+hh, w: hw, h: hh}, this.capacity, this.maxDepth, d);
    this.sw = new QuadTree({x, y: y+hh, w: hw, h: hh}, this.capacity, this.maxDepth, d);
    this.divided = true;
  }
  query(range, found = []) {
    if (!this.intersects(range)) return found;
    for (const p of this.points) {
      if (p.x >= range.x && p.x < range.x + range.w && p.y >= range.y && p.y < range.y + range.h) found.push(p);
    }
    if (this.divided) {
      this.ne.query(range, found);
      this.nw.query(range, found);
      this.se.query(range, found);
      this.sw.query(range, found);
    }
    return found;
  }
}

let _quadTree = null;
let _qtDirty = true;

function rebuildQuadTree() {
  // Границы по всему canvas
  _quadTree = new QuadTree({x: 0, y: 0, w: canvas.width, h: canvas.height});
  for (const star of stars) _quadTree.insert(star);
  _qtDirty = false;
}

function drawStars() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const PADDING = 40;
  const vp = {
    x: -PADDING, y: -PADDING,
    w: canvas.width + PADDING * 2,
    h: canvas.height + PADDING * 2
  };

  let visibleStars;
  if (stars.length >= 200) {
    rebuildQuadTree();
    visibleStars = _quadTree.query(vp);
  } else {
    visibleStars = stars.filter(s =>
      s.x >= vp.x && s.x < vp.x + vp.w && s.y >= vp.y && s.y < vp.y + vp.h
    );
  }

  if (IS_MOBILE) {
    const byColor = new Map();
    for (const star of visibleStars) {
      const alpha = star.activityLevel > 0.3 ? star.glow : star.glow * 0.5;
      const fill = cachedRgba(star.color, alpha);
      if (!byColor.has(fill)) byColor.set(fill, []);
      byColor.get(fill).push(star);
    }

    // Рисуем каждую группу цвета одним path
    for (const [fill, group] of byColor) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const star of group) {
        ctx.moveTo(star.x + star.radius, star.y);
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  } else {

    // Десктопный путь: полное качество со свечением
    for (const star of visibleStars) {
      const isMyStar = star.username === MOCK_USER.username;
      ctx.save();
      if (star.activityLevel > 0.3) {
        ctx.fillStyle = cachedRgba(star.color, star.glow);
        ctx.shadowColor = cachedRgba(star.color, 1);
        ctx.shadowBlur = 32 * star.glow;
      } else {
        ctx.fillStyle = cachedRgba(star.color, star.glow * 0.5);
        ctx.shadowColor = cachedRgba(star.color, 0.5);
        ctx.shadowBlur = 15 * star.glow;
      }
      ctx.translate(star.x, star.y);
      ctx.beginPath();
      ctx.arc(0, 0, star.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Применяем эффект прямо на своей звезде
      if (isMyStar && currentEffect) {
        drawOneStar(star.x, star.y, star.color, star.radius, null, star.glow, null, currentEffect);
      }
    }
  }

  if (cursorStarEnabled || followerStars.length > 0) drawCursorStar(lastDt);
}

let lastDt = 16;
function animate(timestamp) {
  requestAnimationFrame(animate);

  // Ограничение FPS на мобильных для экономии батареи
  if (IS_MOBILE) {
    const elapsed = timestamp - _lastFrameTime;
    if (elapsed < FRAME_TIME - 2) return;
    _lastFrameTime = timestamp - (elapsed % FRAME_TIME);
  }

  if (!lastTime) lastTime = timestamp;
  const delta = Math.min(timestamp - lastTime, 64);
  lastTime = timestamp;
  lastDt = delta;
  updateStars(delta);
  drawStars();
}
requestAnimationFrame(animate);

function getStarAtPosition(x, y) {
  const isMob = window.innerWidth <= 640;
  const HIT_EXTRA = isMob ? 26 : 8;
  const MIN_HIT = isMob ? 34 : 15;
  let best = null, bestDist2 = Infinity;
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const sc = worldToScreen(s.worldX, s.worldY);
    const dx = x - sc.x, dy = y - sc.y;
    const d2 = dx*dx + dy*dy;
    const threshold = Math.max((s.radius || 5) + HIT_EXTRA, MIN_HIT);
    if (d2 <= threshold*threshold && d2 < bestDist2) {
      best = s; bestDist2 = d2;
    }
  }
  return best;
}

// ===== ПЕРЕТАСКИВАНИЕ И МАСШТАБИРОВАНИЕ =====
const dragIndicator = document.getElementById("drag-indicator");
const zoomLevel = document.getElementById("zoom-level");
const tooltip = document.getElementById("tooltip");

function showDragIndicator() {
  dragIndicator.classList.add("visible");
  clearTimeout(dragIndicatorTimeout);
  dragIndicatorTimeout = setTimeout(() => dragIndicator.classList.remove("visible"), 2000);
}

canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;
  isDragging = true; _dragMoved = false;
  lastMouseX = e.clientX; lastMouseY = e.clientY;
  canvas.style.cursor = "grabbing"; dragVelocity = {x:0,y:0}; showDragIndicator();
});
window.addEventListener("mousemove", e => {
  if (!isDragging) return;
  const dx = e.clientX-lastMouseX, dy = e.clientY-lastMouseY;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) _dragMoved = true;
  viewportOffset.x -= dx/zoom; viewportOffset.y -= dy/zoom;
  clampViewport();
  dragVelocity.x = Math.max(-50, Math.min(50, dx));
  dragVelocity.y = Math.max(-50, Math.min(50, dy));
  lastMouseX = e.clientX; lastMouseY = e.clientY;
  showDragIndicator();
});
window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false; canvas.style.cursor = "grab";
  function applyInertia() {
    dragVelocity.x *= 0.92; dragVelocity.y *= 0.92;
    viewportOffset.x -= (dragVelocity.x/zoom)*0.5;
    viewportOffset.y -= (dragVelocity.y/zoom)*0.5;
    clampViewport();
    if (Math.abs(dragVelocity.x) > 0.5 || Math.abs(dragVelocity.y) > 0.5) requestAnimationFrame(applyInertia);
  }
  applyInertia();
});

canvas.addEventListener("wheel", e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX-rect.left, mouseY = e.clientY-rect.top;

  // Мировая точка под курсором — должна оставаться неподвижной при зуме
  const anchor = screenToWorld(mouseX, mouseY);
  const delta = -Math.sign(e.deltaY)*0.1;
  targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom+delta));
  function animateZoom() {
    const diff = targetZoom-zoom;
    if (Math.abs(diff) < 0.001) { zoom = targetZoom; zoomLevel.innerHTML = `<svg width="16" height="16"><use href="#icon-search"/></svg> ${zoom.toFixed(1)}x`; return; }
    zoom += diff*0.2;

    // Удерживаем якорную точку на том же пикселе экрана
    viewportOffset.x = anchor.x - mouseX/zoom;
    viewportOffset.y = anchor.y - mouseY/zoom;
    clampViewport();
    zoomLevel.innerHTML = `<svg width="16" height="16"><use href="#icon-search"/></svg> ${zoom.toFixed(1)}x`;
    requestAnimationFrame(animateZoom);
  }
  animateZoom();
}, {passive:false});

// Touch support (улучшенный - надёжный тап по звезде + порог drag)
let lastTouchDist = 0;
let _touchStartX = 0, _touchStartY = 0, _touchStartTime = 0;
const _TOUCH_SLOP = 10;
canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 2) {
    lastTouchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    isDragging = false;
    _dragMoved = true;
  } else if (e.touches.length === 1) {
    isDragging = true;
    _dragMoved = false;
    const t = e.touches[0];
    lastMouseX = t.clientX; lastMouseY = t.clientY;
    _touchStartX = t.clientX; _touchStartY = t.clientY;
    _touchStartTime = Date.now();
  }
}, {passive: true});
canvas.addEventListener("touchmove", e => {
  if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
    const scale = dist/lastTouchDist;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom*scale));
    lastTouchDist = dist;
    zoomLevel.innerHTML = `<svg width="16" height="16"><use href="#icon-search"/></svg> ${zoom.toFixed(1)}x`;
    _dragMoved = true;
  } else if (isDragging) {
    const t = e.touches[0];
    if (Math.abs(t.clientX - _touchStartX) > _TOUCH_SLOP || Math.abs(t.clientY - _touchStartY) > _TOUCH_SLOP) {
      _dragMoved = true;
      e.preventDefault();
      const dx = t.clientX - lastMouseX, dy = t.clientY - lastMouseY;
      viewportOffset.x -= dx/zoom; viewportOffset.y -= dy/zoom;
      clampViewport();
      lastMouseX = t.clientX; lastMouseY = t.clientY;
    }
  }
}, {passive: false});
canvas.addEventListener("touchend", (e) => {
  const wasDragging = isDragging;
  const moved = _dragMoved;
  isDragging = false;

  // Прямой тап по звезде (synthesized click на мобилке не всегда срабатывает)
  if (wasDragging && !moved && e.changedTouches && e.changedTouches.length === 1) {
    const t = e.changedTouches[0];
    if (Date.now() - _touchStartTime < 600) {
      const rect = canvas.getBoundingClientRect();
      const star = getStarAtPosition(t.clientX - rect.left, t.clientY - rect.top);
      if (star) {
        const overlay = document.getElementById('star-card-overlay');
        if (cardStar === star && overlay && overlay.classList.contains('visible')) {
          hideStarCard();
        } else {
          showStarCard(star);
        }
        e.preventDefault();
      }
    }
  }

  // Блокируем synthesized click (он дублирует логику), сбрасываем позже
  _dragMoved = true;
  setTimeout(() => { _dragMoved = false; }, 350);
}, {passive: false});


// ===== ПОДСКАЗКА И НАВЕДЕНИЕ НА ЗВЕЗДУ =====
const starCard = document.getElementById('star-card');
let cardStar = null;

function positionEl(el, x, y, w, h) {
  const W = window.innerWidth, H = window.innerHeight;
  let left = x + 18, top = y - h / 2;
  if (left + w > W - 8) left = x - w - 14;
  if (top < 8) top = 8;
  if (top + h > H - 8) top = H - h - 8;
  el.style.left = left + 'px';
  el.style.top  = top + 'px';
}

function showHoverTip(star, x, y) {
  const online = star.active;
  const away = star.away;
  const st = (typeof getUserStatus === 'function') ? getUserStatus(star) : null;
  const statusClass = online ? 'online' : (away ? 'away' : '');
  const statusText = online ? 'В сети' : (away ? 'Нет на месте' : 'Не в сети');
  tooltip.innerHTML = `
    <div class="tt-tip-name">${star.name || star.username}</div>
    <div class="tt-tip-handle">@${star.username}</div>
    ${st ? `<div style="font-size:9px;margin:2px 0 1px;color:${st.color};">${st.label}</div>` : ''}
    <div class="tt-tip-status ${statusClass}">
      <div class="tt-tip-dot ${statusClass}"></div>
      ${statusText}
    </div>`;
  positionEl(tooltip, x, y, 190, st ? 88 : 72);
  tooltip.classList.add('visible');
}

function hideHoverTip() {
  tooltip.classList.remove('visible');
}

canvas.addEventListener('mousemove', e => {
  if (isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const star = getStarAtPosition(e.clientX - rect.left, e.clientY - rect.top);
  if (star !== currentHoveredStar) {
    currentHoveredStar = star;
    if (star) {
      showHoverTip(star, e.clientX, e.clientY);
      canvas.style.cursor = 'pointer';
    } else {
      hideHoverTip();
      canvas.style.cursor = 'grab';
    }
  } else if (star) {
    positionEl(tooltip, e.clientX, e.clientY, 180, 72);
  }
});

canvas.addEventListener('mouseleave', () => {
  currentHoveredStar = null;
  canvas.style.cursor = 'grab';
  hideHoverTip();
});

// ===== КАРТОЧКА ЗВЕЗДЫ =====
function getColorName(hex) {
  const map = {'#ffffff':'Белый','#ef4444':'Красный','#3b82f6':'Синий','#22c55e':'Зелёный',
    '#eab308':'Жёлтый','#a855f7':'Фиолет','#ec4899':'Розовый','#00ffff':'Неон',
    '#6d4aff':'Сиреневый','#38bdf8':'Голубой'};
  return map[hex.toLowerCase()] || hex;
}

// Все возможные статусы
const ALL_STATUSES = [
  { id: 'status1', label: 'status1', color: '#e879f9',
    req: 'Очки ≥ 800, дней ≥ 200, сообщений ≥ 3000, друзей ≥ 50',
    desc: 'Text preview',
    check: (s) => s.activityScore>=800 && s.daysActive>=200 && s.messagesSent>=3000 && s.friendsCount>=50 },
  { id: 'status2', label: 'status2', color: '#fbbf24',
    req: 'Очки ≥ 600, дней ≥ 150, сообщений ≥ 2000',
    desc: 'Text preview',
    check: (s) => s.activityScore>=600 && s.daysActive>=150 && s.messagesSent>=2000 },
  { id: 'status3', label: 'status3', color: '#38bdf8',
    req: 'Очки ≥ 450, сообщений ≥ 1500, дней ≥ 90',
    desc: 'Text preview',
    check: (s) => s.activityScore>=450 && s.messagesSent>=1500 && s.daysActive>=90 },
  { id: 'status4', label: 'status4', color: '#c4b5fd',
    req: 'Друзей ≥ 30, очков ≥ 300, сообщений ≥ 500',
    desc: 'Text preview',
    check: (s) => s.friendsCount>=30 && s.activityScore>=300 && s.messagesSent>=500 },
  { id: 'status5', label: 'status5', color: '#34d399',
    req: 'Онлайн, очков ≥ 200, сообщений ≥ 700, дней ≥ 30',
    desc: 'Text preview',
    check: (s) => s.active && s.activityScore>=200 && s.messagesSent>=700 && s.daysActive>=30 },
  { id: 'status6', label: 'status6', color: '#818cf8',
    req: 'Дней ≥ 60, сообщений ≥ 400, очков ≥ 120',
    desc: 'Text preview',
    check: (s) => s.daysActive>=60 && s.messagesSent>=400 && s.activityScore>=120 },
  { id: 'status7', label: 'status7', color: '#f97316',
    req: 'Сообщений ≥ 300 и очков ≥ 80',
    desc: 'Text preview',
    check: (s) => s.messagesSent>=300 && s.activityScore>=80 },
  { id: 'status8', label: 'status8', color: '#4ade80',
    req: 'Дней ≥ 30, очков ≥ 50',
    desc: 'Text preview',
    check: (s) => s.daysActive>=30 && s.activityScore>=50 },
];

// Возвращает МАССИВ всех заслуженных статусов для звезды
function getEarnedStatuses(star) {
  return ALL_STATUSES.filter(st => st.check(star));
}

// Возвращает ОДИН статус (наивысший) или null если не заслужен
function getUserStatus(star) {
  const earned = getEarnedStatuses(star);
  return earned.length > 0 ? earned[0] : null;
}

// Возвращает выбранный пользователем статус (или наивысший)
function getDisplayStatus(star) {
  const earned = getEarnedStatuses(star);
  if (earned.length === 0) return null;
  // Если у звезды есть выбранный статус - показываем его
  if (star._selectedStatusId) {
    const sel = earned.find(s => s.id === star._selectedStatusId);
    if (sel) return sel;
  }
  return earned[0];
}
function buildStarCard(star) {
  const online = star.active;
  const score = Math.round(star.activityScore || 0);
  const isMe = star.username === MOCK_USER.username;
  const color = star.color || '#ffffff';

  // Дополнительные данные для расширенного профиля
  const uid = star.userId || 1;
  const joinDate = `${String(uid % 28 + 1).padStart(2,'0')}.${String(uid % 12 + 1).padStart(2,'0')}.2024`;
  const msgCount = star.messagesSent || Math.round(score * 3.7 + 12);
  const status = typeof getDisplayStatus === 'function' ? getDisplayStatus(star) : getUserStatus(star);
  const friendState = friendsMap[star.username] || 'none';
  const isFriend = friendState === 'friends';

  // Генерируем случайные маленькие звёзды для hero-блока
  const starDots = Array.from({length: 32}, () => {
    const x = Math.random()*100, y = Math.random()*100;
    const s = 0.8 + Math.random()*2.2;
    const op = 0.15 + Math.random()*0.65;
    const d = 2 + Math.random()*5;
    const delay = -(Math.random()*5);
    return `<div class="sc-hero-star-dot" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;background:#fff;--op:${op};--d:${d}s;--delay:${delay}s"></div>`;
  }).join('');

  // Удаляем устаревшую внешнюю кнопку закрытия
  let _scCloseExisting = document.getElementById('sc-close-btn');
  if (_scCloseExisting) _scCloseExisting.remove();

  starCard.innerHTML = `
    <!-- Кнопка закрытия — позиционируется относительно #star-card -->
    <button class="sc-close" id="sc-close-btn">
      <svg width="30" height="30"><use href="#icon-close"/></svg>
    </button>

    <!-- Hero-баннер -->
    <div class="sc-hero">
      <div class="sc-hero-bg" style="background:linear-gradient(135deg,${color}30 0%,rgba(109,74,255,0.2) 60%,rgba(8,12,26,0) 100%)"></div>
      <div class="sc-hero-stars">${starDots}</div>
      <div class="sc-hero-bottom"></div>
    </div>

    <!-- Тело -->
    <div class="sc-body">
      <div class="sc-identity">
        <div class="sc-avatar">
          <div class="sc-avatar-star-big" style="background:radial-gradient(circle at 35% 35%,#fff4,transparent 60%),${color};box-shadow:0 0 24px ${color}bb;"></div>
          ${isFriend ? `<div style="position:absolute;bottom:-3px;right:-3px;width:16px;height:16px;border-radius:50%;background:#22c55e;border:2px solid rgba(8,12,26,0.98);display:flex;align-items:center;justify-content:center;font-size:8px;">👥</div>` : ''}
        </div>
        <div class="sc-name-block">
          <div class="sc-name sc-copyable" data-copy="${star.name || star.username}" title="Нажмите, чтобы скопировать">${star.name || star.username}</div>
          <br>
          <div class="sc-handle sc-copyable" data-copy="@${star.username}" title="Нажмите, чтобы скопировать">@${star.username}</div>
          <br>
          ${status ? `<div class="sc-rank-badge" style="margin-top:5px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${status.color};background:${status.color}18;border:1px solid ${status.color}44;padding:3px 9px;border-radius:5px;display:inline-flex;align-items:center;cursor:default;">${status.label}</div>` : ''}
          ${status ? `<div style="font-size:9px;color:#4a6080;margin-top:3px;line-height:1.3;">${status.desc}</div>` : ''}
        </div>
        <div class="sc-online-pill ${online ? 'online' : (star.away ? 'away' : 'offline')}" style="margin-top:7px;align-self:flex-end;">
          <div class="sc-online-dot"></div>
          ${online ? 'В сети' : (star.away ? 'Нет на месте' : 'Офлайн')}
        </div>
      </div>

      <div class="sc-bio ${star.info ? '' : 'empty'}">${star.info || ''}</div>

      <div class="sc-stats">
        <div class="sc-stat">
          <div class="sc-stat-icon"><svg width="16" height="16"><use href="#icon-points"/></svg></div>
          <div class="sc-stat-val">${score}</div>
          <div class="sc-stat-lbl">Очки</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-icon"><svg width="16" height="16"><use href="#icon-chat"/></svg></div>
          <div class="sc-stat-val">${msgCount}</div>
          <div class="sc-stat-lbl">Сообщений</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-icon" style="color:${color};filter:drop-shadow(0 0 4px ${color})">●</div>
          <div class="sc-stat-val" style="font-size:11px;color:#c9a84c;line-height:1.2">${getColorName(color)}</div>
          <div class="sc-stat-lbl">Цвет</div>
        </div>
        <div class="sc-stat">
          <div class="sc-stat-icon"><svg width="16" height="16"><use href="#icon-calendar"/></svg></div>
          <div class="sc-stat-val" style="font-size:11px;line-height:1.2">${joinDate}</div>
          <div class="sc-stat-lbl" style="text-align: center;">Дата регистрации</div>
        </div>
      </div>

      <!-- Дополнительная информация -->
      <div class="sc-extra-info">
        <div class="sc-extra-row">
          <span class="sc-extra-label"><svg width="13" height="13"><use href="#icon-activity-small"/></svg> Активность</span>
          <div class="sc-activity-bar"><div class="sc-activity-fill" style="width:${Math.min(100, score/6.5)}%;background:linear-gradient(90deg,${color},${color}88)"></div></div>
          <span class="sc-extra-val">${score > 500 ? 'Высокая' : score > 150 ? 'Средняя' : 'Низкая'}</span>
        </div>
      </div>

      <div class="sc-actions">
        <button class="sc-btn sc-btn-primary" id="sc-chat-btn" ${isMe ? 'disabled' : ''}>
          <svg width="18" height="18"><use href="#icon-chat"/></svg>
          ${isMe ? 'Это вы' : 'Написать'}
        </button>
        ${!isMe ? `<button class="sc-btn sc-btn-friend" id="sc-friend-btn" data-username="${star.username}" data-state="none">
          <svg width="35" height="35"><use href="#icon-add"/></svg>
          В друзья
        </button>` : ''}

      </div>
    </div>`;

  starCard.querySelector('#sc-close-btn').addEventListener('click', ev => {
    ev.stopPropagation(); hideStarCard();
  });

  // Копирование по клику: имя и хэндл
  starCard.querySelectorAll('.sc-copyable').forEach(el => {
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      const text = el.dataset.copy || el.textContent.replace().trim();
      navigator.clipboard?.writeText(text).catch(() => {});
      const existing = document.getElementById('sc-copy-toast');
      if (existing) existing.remove();
      const toast = document.createElement('div');
      toast.id = 'sc-copy-toast';
      toast.textContent = `Скопировано: ${text}`;
      toast.style.cssText = `
        position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
        background:rgba(109,74,255,0.85); color:#e8efff;
        padding:7px 18px; border-radius:99px; font-size:12px; font-weight:600;
        font-family:'Unbounded',sans-serif; letter-spacing:0.02em;
        backdrop-filter:blur(16px); border:1px solid rgba(109,74,255,0.5);
        box-shadow:0 4px 20px rgba(109,74,255,0.4); z-index:9999;
        animation:scCopyFade 1.8s ease forwards; pointer-events:none;
      `;
      if (!document.getElementById('sc-copy-keyframes')) {
        const s = document.createElement('style');
        s.id = 'sc-copy-keyframes';
        s.textContent = `@keyframes scCopyFade{0%{opacity:0;transform:translateX(-50%) translateY(8px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}75%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-6px)}}`;
        document.head.appendChild(s);
      }
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 1900);
    });
  });
  const chatBtn = starCard.querySelector('#sc-chat-btn');
  if (chatBtn && !chatBtn.disabled) {
    chatBtn.addEventListener('click', ev => {
      ev.stopPropagation(); hideStarCard();
      const targetUsername = star.username;
      // Мобильные: открываем приватную вкладку с нужным контейнером
      if (window.innerWidth <= 640) {
        const mobChatSheet = document.getElementById('mob-chat-sheet');
        if (mobChatSheet) {
          mobChatSheet.classList.add('open');
          // Используем openMobPrivateChat — корректно обрабатывает заголовок и контейнер
          if (typeof openMobPrivateChat === 'function') {
            openMobPrivateChat(targetUsername);
          }
          setTimeout(() => document.getElementById('mob-chat-input')?.focus(), 300);
        }
      } else {
        // Десктоп: сначала раскрываем оверлей чата
        const chatOverlay = document.getElementById('chat-overlay');
        if (chatOverlay && chatOverlay.classList.contains('collapsed')) {
          chatOverlay.classList.remove('collapsed');
        }
        if (typeof window.openPrivateChat === 'function') {
          window.openPrivateChat(targetUsername);
        } else {
          // Запасной вариант: вручную открываем панель приватного чата
          if (!privateChats[targetUsername]) privateChats[targetUsername] = [];
          if (typeof openPrivateChat === 'function') openPrivateChat(targetUsername);
          if (typeof switchChatTab === 'function') switchChatTab('private');
          const ir = document.getElementById('chat-input-row');
          if (ir) ir.style.display = '';
        }
        // Фокус с задержкой, чтобы DOM обновился
        setTimeout(() => document.getElementById('chat-input')?.focus(), 100);
      }
    });
  }
  // Кнопка подписки — добавить звезду в последователи курсора
  const followBtn = starCard.querySelector('#sc-follow-btn');
  if (followBtn) {
    const isAlreadyFollowing = followerStars.some(f => f.user.username === star.username);
    if (isAlreadyFollowing) {
      followBtn.textContent = '✓ Следует';
      followBtn.style.cssText += ';background:rgba(249,115,22,0.15);border-color:rgba(249,115,22,0.4);color:#f97316;';
    } else if (followerStars.length >= MAX_FOLLOWERS) {
      followBtn.textContent = '★ Макс 5';
      followBtn.disabled = true;
      followBtn.style.opacity = '0.5';
    }
    followBtn.addEventListener('click', ev => {
      ev.stopPropagation();
      if (followerStars.some(f => f.user.username === star.username)) {
        removeFollower(star.username);
        followBtn.textContent = '★';
        followBtn.style.cssText = '';
        addChatLine(`Звезда @${star.username} убрана из следующих`, 'chat-system');
      } else {
        const mockUser = MOCK_USERS.find(u => u.username === star.username);
        if (mockUser && addFollower(mockUser)) {
          followBtn.textContent = '✓ Следует';
          followBtn.style.cssText += ';background:rgba(249,115,22,0.15);border-color:rgba(249,115,22,0.4);color:#f97316;';
          addChatLine(`✨ @${star.username} теперь следует за курсором`, 'chat-system');
        }
      }
    });
  }

  const friendBtn = starCard.querySelector('#sc-friend-btn');
  if (friendBtn) {
    // Восстанавливаем состояние дружбы, если уже установлено
    const savedState = friendsMap[star.username] || 'none';
    updateFriendBtn(friendBtn, savedState);

    friendBtn.addEventListener('click', async ev => {
      ev.stopPropagation();
      const state = friendBtn.dataset.state;
      if (state === 'friends') return;
      if (state === 'none') {
        updateFriendBtn(friendBtn, 'pending');
        playSound(soundSettings.system);
        const res = await API.sendFriendRequest(star.username);
        if (res && res.success) {
          if (res.became_friends) {
            friendsMap[star.username] = 'friends';
            updateFriendBtn(friendBtn, 'friends');
            addChatLine(`🤝 Вы теперь друзья с @${star.username}!`, 'chat-system');
          } else {
            friendsMap[star.username] = 'pending';
            addChatLine(`📤 Запрос в друзья отправлен @${star.username}`, 'chat-system');
          }
        } else {
          friendsMap[star.username] = 'none';
          updateFriendBtn(friendBtn, 'none');
          showToast(res && res.message ? '❌ ' + res.message : '❌ Ошибка');
        }
      }
    });
  }
}

const friendsMap = {};

// Сохранение и загрузка списка друзей
const FRIENDS_STORAGE_KEY = 'star_sky_friends_v1';

function saveFriends() {
  try {
    localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friendsMap));
  } catch(e) {}
}

function loadFriends() {
  try {
    const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(friendsMap, saved);
    }
  } catch(e) {}
}

// Загружаем сразу
loadFriends();
function updateFriendBtn(btn, state) {
  btn.dataset.state = state;
  btn.className = 'sc-btn sc-btn-friend';
  if (state === 'pending') {
    btn.classList.add('pending');
    btn.innerHTML = `<svg width="14" height="14"><use href="#icon-refresh"/></svg> Запрос отправлен`;
  } else if (state === 'friends') {
    btn.classList.add('friends');
    btn.innerHTML = `<svg width="14" height="14"><use href="#icon-check"/></svg> В друзьях`;
  } else {
    btn.innerHTML = `<svg width="30" height="30"><use href="#icon-add"/></svg> Добавить в друзья`;
  }
}

function showStarCard(star) {
  cardStar = star;
  buildStarCard(star);
  document.getElementById('star-card-overlay').classList.add('visible');
  hideHoverTip();
}

function hideStarCard() {
  document.getElementById('star-card-overlay').classList.remove('visible');
  cardStar = null;
}

canvas.addEventListener('click', e => {
  if (_dragMoved) { _dragMoved = false; return; }
  const rect = canvas.getBoundingClientRect();
  const star = getStarAtPosition(e.clientX - rect.left, e.clientY - rect.top);
  if (!star) return;
  if (cardStar === star && document.getElementById('star-card-overlay').classList.contains('visible')) {
    hideStarCard(); return;
  }
  showStarCard(star);
});

// Клик по имени в чате -> открыть карточку звезды
function _findStarByName(rawName) {
  const name = rawName.replace('@','').trim();
  let found = stars.find(s =>
    s.display_name === rawName || s.username === name || s.display_name === name
  );
  // Запасной вариант — MOCK_USERS
  if (!found && typeof MOCK_USERS !== 'undefined') {
    const mu = MOCK_USERS.find(u => u.display_name === rawName || u.username === name || u.display_name === name);
    if (mu) found = stars.find(s => s.username === mu.username) || mu;
  }
  return found || null;
}

function _setupChatUsernameClick(containerId) {
  const container = document.getElementById(containerId);
  if (!container || container._starCardClickSet) return;
  container._starCardClickSet = true;
  container.addEventListener('click', (e) => {
    const usernameEl = e.target.closest('.chat-username');
    if (!usernameEl) return;
    const line = usernameEl.closest('.chat-line');
    // Разрешаем все строки (включая chat-me, но пропускаем системные)
    if (!line || line.classList.contains('chat-system')) return;
    const rawName = usernameEl.textContent.trim();
    const starObj = _findStarByName(rawName);
    if (starObj) {
      e.stopPropagation();
      if (typeof showStarCard === 'function') showStarCard(starObj);
    }
  });
}

// Настраиваем на всех контейнерах чата (десктоп + мобильные, общий + приват)
setTimeout(() => {
  ['chat-messages', 'mob-chat-messages', 'private-messages', 'mob-private-messages', 
  'mob-favorites-messages'].forEach(id => {
    _setupChatUsernameClick(id);
  });
}, 600);

// Повторная настройка при открытии приватного чата (сообщения грузятся лениво)
document.addEventListener('privateChatOpened', () => {
  setTimeout(() => {
    _setupChatUsernameClick('private-messages');
    _setupChatUsernameClick('mob-private-messages');
  }, 300);
});

document.getElementById('star-card-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('star-card-overlay')) hideStarCard();
});

// ===== ДАННЫЕ И РЕНДЕР МАГАЗИНА =====
const shopItems = {
  basicColors: [
    {id:"white", name:"Белый", color:"#ffffff", cost:0, type:"color", default:true},
    {id:"red", name:"Красный", color:"#ef4444", cost:50, type:"color"},
    {id:"blue", name:"Синий", color:"#3b82f6", cost:50, type:"color"},
    {id:"green", name:"Зеленый", color:"#22c55e", cost:50, type:"color"},
    {id:"yellow", name:"Желтый", color:"#eab308", cost:50, type:"color"},
    {id:"purple", name:"Фиолетовый", color:"#a855f7", cost:50, type:"color"},
    {id:"orange", name:"Оранжевый", color:"#f97316", cost:50, type:"color"},
    {id:"pink", name:"Розовый", color:"#ec4899", cost:50, type:"color"},
  ],
  neonColors: [
    {id:"neon_blue", name:"Неон синий", color:"#00ffff", cost:150, type:"color"},
    {id:"neon_green", name:"Неон зеленый", color:"#00ff00", cost:150, type:"color"},
    {id:"neon_pink", name:"Неон розовый", color:"#ff00ff", cost:150, type:"color"},
    {id:"neon_orange", name:"Неон оранжевый", color:"#ff9900", cost:150, type:"color"},
    {id:"neon_purple", name:"Неон фиолетовый", color:"#cc00ff", cost:150, type:"color"},
    {id:"neon_red", name:"Неон красный", color:"#ff3300", cost:150, type:"color"},
  ],
  cosmicColors: [
    {id:"cosmic_purple", name:"Космический пурпур", color:"#9933ff", cost:300, type:"color"},
    {id:"cosmic_blue", name:"Космическая синь", color:"#3366ff", cost:300, type:"color"},
    {id:"cosmic_red", name:"Красная туманность", color:"#ff3366", cost:300, type:"color"},
    {id:"cosmic_green", name:"Зеленая комета", color:"#33ff99", cost:300, type:"color"},
    {id:"cosmic_gold", name:"Золотое солнце", color:"#ffcc00", cost:300, type:"color"},
    {id:"cosmic_silver", name:"Серебряная луна", color:"#ccccff", cost:300, type:"color"},
  ],
  effects: [
    {id:"pulse", name:"Пульсация", cost:200, type:"effect"},
    {id:"rainbow", name:"Радуга", cost:350, type:"effect"},
    {id:"shimmer", name:"Мерцание", cost:250, type:"effect"},
    {id:"sparkle", name:"Искры", cost:300, type:"effect"},
    {id:"glow", name:"Свечение", cost:200, type:"effect"},
    {id:"wave", name:"Волна", cost:280, type:"effect"},
  ],
  specialEffects: [
    {id:"pulsar", name:"Пульсар", cost:500, type:"effect"},
    {id:"nebula", name:"Туманность", cost:550, type:"effect"},
    {id:"galaxy", name:"Галактика", cost:600, type:"effect"},
    {id:"black_hole", name:"Черная дыра", cost:650, type:"effect"},
  ]
};

let currentStarColor = "#ffffff", currentEffect = null, currentActivity = 0;
const currentSkinsOwned = ["white"];

function updateProfileEffectLabel() {
  const el = document.getElementById('profile-effect-name');
  if (!el) return;
  if (currentEffect) {
    const all = [...shopItems.effects, ...shopItems.specialEffects];
    const found = all.find(i => i.id === currentEffect);
    el.textContent = found ? found.name : currentEffect;
    el.style.background = 'rgba(249,115,22,0.15)';
    el.style.color = '#f97316';
    el.style.border = '1px solid rgba(249,115,22,0.35)';
  } else {
    el.textContent = 'нет';
    el.style.background = '';
    el.style.color = '';
    el.style.border = '';
  }
}

// Предпросмотр на canvas
let _previewOrigEffect = null;
function startPreview(color, effectId, name, btn) {
  stopPreview(false);
  _previewActive = true;
  _previewOrigColor = currentStarColor;
  _previewOrigEffect = currentEffect;
  _previewBtn = btn;
  if (btn) btn.classList.add('previewing');

  // Применяем цвет на звезду test_user прямо на карте
  const myStar = stars.find(s => s.username === MOCK_USER.username);
  if (myStar) {
    myStar._origColor = myStar.color;
    if (color) {
      myStar.color = color;
      myStar.targetColor = color;
    }
  }

  // Применяем эффект глобально (рендерится на все звёзды через currentEffect,
  // но пока в превью — только временно)
  if (effectId) currentEffect = effectId;

  focusOnUser(MOCK_USER.username);

  // Уведомление
  const toast = document.getElementById('skin-preview-toast');
  const toastText = document.getElementById('skin-preview-toast-text');
  if (toast && toastText) {
    toastText.textContent = 'Предпросмотр: ' + name;
    toast.classList.add('visible');
  }
}

let _previewForceEnabled = false;
function stopPreview(restoreBtn = true) {
  if (!_previewActive) return;
  _previewActive = false;
  const myStar = stars.find(s => s.username === MOCK_USER.username);
  if (myStar && myStar._origColor !== undefined) {
    myStar.color = myStar._origColor;
    myStar.targetColor = myStar._origColor;
    delete myStar._origColor;
  }
  // Восстанавливаем оригинальный эффект
  currentEffect = _previewOrigEffect;
  _previewOrigEffect = null;
  // Не трогаем cursorStarEnabled - мы его теперь не включаем
  if (_previewBtn && restoreBtn) _previewBtn.classList.remove('previewing');
  _previewBtn = null;
  // Убираем подсветку предпросмотра эффекта
  document.querySelectorAll('.effect-preview.previewing-active').forEach(el => el.classList.remove('previewing-active'));
  const toast = document.getElementById('skin-preview-toast');
  if (toast) toast.classList.remove('visible');
}

// Останавливаем предпросмотр по клику вне панели магазина
document.addEventListener('mousedown', (e) => {
  if (_previewActive && !e.target.closest('#skin-panel')) stopPreview();
});

function renderShop() {
  function makeGrid(gridEl, items) {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    items.forEach(item => {
      const isEquipped = (item.color && item.color === currentStarColor) || (item.id === currentEffect);
      const owned = currentSkinsOwned.includes(item.id);

      const card = document.createElement('div');
      card.className = 'skin-item' + (isEquipped ? ' selected' : '');

      // Область предпросмотра
      const preview = document.createElement('div');
      preview.className = 'skin-preview';
      if (item.color) {
        const ring = document.createElement('div'); ring.className = 'orb-ring';
        const cp = document.createElement('div');
        cp.className = 'color-preview';
        const glow = shopLighten(item.color);
        cp.style.cssText = `background:radial-gradient(circle at 35% 35%,${glow},${item.color},${shopDarken(item.color)});box-shadow:0 0 16px ${item.color}99,0 0 32px ${item.color}44;`;
        preview.appendChild(ring);
        preview.appendChild(cp);
      } else {
        const ep = document.createElement('div');
        ep.className = 'effect-preview ' + item.id;
        preview.appendChild(ep);
      }

      // Информация
      const info = document.createElement('div');
      info.className = 'skin-info';
      const costClass = item.cost === 0 ? 'free' : '';
      info.innerHTML = `<div class="skin-name">${item.name}</div><div class="skin-cost ${costClass}">${item.cost === 0 ? '✓' : '<svg width="12" height="12" style="vertical-align:middle"><use href="#icon-points"/></svg>'} ${item.cost === 0 ? 'Бесплатно' : item.cost + ' очков'}</div>${owned && !isEquipped ? '<div class="skin-owned">✓ В коллекции</div>' : ''}`;

      // Кнопка предпросмотра — по клику фокусирует на свою звезду
      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'skin-preview-btn';
      eyeBtn.title = 'Предпросмотр на звезде';
      eyeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (_previewActive && _previewBtn === eyeBtn) {
          stopPreview();
        } else {
          startPreview(item.color || null, item.id || null, item.name, eyeBtn);
          focusOnUser(MOCK_USER.username);
        }
      });

      // Кнопка покупки/выбора
      const btn = document.createElement('button');
      btn.className = 'skin-buy-btn';
      if (isEquipped) {
        btn.className += ' equipped'; btn.textContent = 'Экипировано'; btn.disabled = true;
      } else if (owned || item.cost === 0) {
        btn.className += ' select'; btn.textContent = 'Выбрать';
        btn.onclick = (e) => {
          e.stopPropagation();
          stopPreview();
          if (item.color) {
            currentStarColor = item.color; CURSOR_STAR_COLOR = currentStarColor;
            const myStar = stars.find(s => s.username === MOCK_USER.username);
            if (myStar) { myStar.color = currentStarColor; myStar.targetColor = currentStarColor; }
            if (typeof saveStarColor === 'function') saveStarColor(currentStarColor);
          } else {
            currentEffect = item.id;
            updateProfileEffectLabel();
            if (typeof saveStarEffect === 'function') saveStarEffect(currentEffect);
          }
          currentSkinsOwned.includes(item.id) || currentSkinsOwned.push(item.id);
          renderShop();
        };
      } else {
        btn.className += ' buy'; btn.innerHTML = item.cost + ' <svg width="11" height="11" style="vertical-align:middle"><use href="#icon-points"/></svg>';
        btn.onclick = (e) => {
          e.stopPropagation();
          if (currentActivity >= item.cost) {
            stopPreview();
            currentActivity -= item.cost;
            currentSkinsOwned.push(item.id);
            document.getElementById('balance-amount').textContent = currentActivity;
            if (typeof window.syncMobBalance === 'function') window.syncMobBalance();
            if (item.color) {
              currentStarColor = item.color; CURSOR_STAR_COLOR = currentStarColor;
              const myStar = stars.find(s => s.username === MOCK_USER.username);
              if (myStar) { myStar.color = currentStarColor; myStar.targetColor = currentStarColor; }
              if (typeof saveStarColor === 'function') saveStarColor(currentStarColor);
            } else {
              currentEffect = item.id;
              updateProfileEffectLabel();
              if (typeof saveStarEffect === 'function') saveStarEffect(currentEffect);
            }
            renderShop();
            if (typeof renderMobShop === 'function') renderMobShop();
          } else {
            showToast('❌ Недостаточно очков!');
          }
        };
      }

      card.appendChild(preview);
      card.appendChild(info);
      const btnWrap = document.createElement('div');
      btnWrap.className = 'skin-buy-btn-wrap';
      btnWrap.appendChild(btn);
      btnWrap.appendChild(eyeBtn);
      card.appendChild(btnWrap);
      gridEl.appendChild(card);
    });
  }

  makeGrid(document.getElementById('basic-colors-grid'), shopItems.basicColors);
  makeGrid(document.getElementById('neon-colors-grid'), shopItems.neonColors);
  makeGrid(document.getElementById('cosmic-colors-grid'), shopItems.cosmicColors);
  makeGrid(document.getElementById('effects-grid'), shopItems.effects);
  makeGrid(document.getElementById('special-effects-grid'), shopItems.specialEffects);
}

// Мобильная версия — рендерит в mob-* сетки, та же логика
function renderMobShop() {
  function makeGrid(gridEl, items) {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    items.forEach(item => {
      const isEquipped = (item.color && item.color === currentStarColor) || (item.id === currentEffect);
      const owned = currentSkinsOwned.includes(item.id);

      const card = document.createElement('div');
      card.className = 'skin-item' + (isEquipped ? ' selected' : '');

      const preview = document.createElement('div');
      preview.className = 'skin-preview';
      if (item.color) {
        const ring = document.createElement('div'); ring.className = 'orb-ring';
        const cp = document.createElement('div');
        cp.className = 'color-preview';
        const glow = shopLighten(item.color);
        cp.style.cssText = `background:radial-gradient(circle at 35% 35%,${glow},${item.color},${shopDarken(item.color)});box-shadow:0 0 16px ${item.color}99,0 0 32px ${item.color}44;`;
        preview.appendChild(ring);
        preview.appendChild(cp);
      } else {
        const ep = document.createElement('div');
        ep.className = 'effect-preview ' + item.id;
        preview.appendChild(ep);
      }

      const info = document.createElement('div');
      info.className = 'skin-info';
      const costClass = item.cost === 0 ? 'free' : '';
      info.innerHTML = `<div class="skin-name">${item.name}</div><div class="skin-cost ${costClass}">${item.cost === 0 ? '✓' : '<svg width="12" height="12" style="vertical-align:middle"><use href="#icon-star"/></svg>'} ${item.cost === 0 ? 'Бесплатно' : item.cost + ' очков'}</div>${owned && !isEquipped ? '<div class="skin-owned">✓ В коллекции</div>' : ''}`;

      const btn = document.createElement('button');
      btn.className = 'skin-buy-btn';
      if (isEquipped) {
        btn.className += ' equipped'; btn.textContent = 'Экипировано'; btn.disabled = true;
      } else if (owned || item.cost === 0) {
        btn.className += ' select'; btn.textContent = 'Выбрать';
        btn.onclick = (e) => {
          e.stopPropagation();
          if (item.color) currentStarColor = item.color; else currentEffect = item.id;
          currentSkinsOwned.includes(item.id) || currentSkinsOwned.push(item.id);
          CURSOR_STAR_COLOR = currentStarColor;
          renderMobShop(); renderShop();
        };
      } else {
        btn.className += ' buy'; btn.innerHTML = item.cost + ' <svg width="11" height="11" style="vertical-align:middle"><use href="#icon-star"/></svg>';
        btn.onclick = (e) => {
          e.stopPropagation();
          if (currentActivity >= item.cost) {
            currentActivity -= item.cost;
            currentSkinsOwned.push(item.id);
            document.getElementById('balance-amount').textContent = currentActivity;
            if (typeof window.syncMobBalance === 'function') window.syncMobBalance();
            if (item.color) currentStarColor = item.color; else currentEffect = item.id;
            CURSOR_STAR_COLOR = currentStarColor;
            renderMobShop(); renderShop();
            if (typeof refreshMobProfile === 'function') refreshMobProfile();
          } else {
            showToast('❌ Недостаточно очков!');
          }
        };
      }

      const btnWrap = document.createElement('div');
      btnWrap.className = 'skin-buy-btn-wrap';
      btnWrap.appendChild(btn);
      card.appendChild(preview);
      card.appendChild(info);
      card.appendChild(btnWrap);
      gridEl.appendChild(card);
    });
  }

  makeGrid(document.getElementById('mob-basic-colors-grid'), shopItems.basicColors);
  makeGrid(document.getElementById('mob-neon-colors-grid'), shopItems.neonColors);
  makeGrid(document.getElementById('mob-cosmic-colors-grid'), shopItems.cosmicColors);
  makeGrid(document.getElementById('mob-effects-grid'), shopItems.effects);
  makeGrid(document.getElementById('mob-special-effects-grid'), shopItems.specialEffects);
  // Прокрутка вверх после рендера
  requestAnimationFrame(() => {
    const b = document.querySelector('#mob-shop-sheet .mob-sheet-body');
    if (b) b.scrollTop = 0;
  });
}

// Цветовые хелперы для градиента orb (только для магазина, с префиксом во избежание конфликта)
function shopLighten(hex) {
  const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return `rgb(${Math.min(255,r+70)},${Math.min(255,g+70)},${Math.min(255,b+70)})`;
}
function shopDarken(hex) {
  const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return `rgb(${Math.max(0,r-60)},${Math.max(0,g-60)},${Math.max(0,b-60)})`;
}


// ===== ЗАДАНИЯ =====
// ===== ЗАДАНИЯ (данные из БД) =====
let tasks = [];

async function loadTasks() {
  try {
    const r = await fetch('/api/tasks/list', { headers: API._headers() });
    if (!r.ok) return;
    const d = await r.json();
    if (d.success) {
      tasks = d.tasks;
      renderTasks();
      if (typeof renderMobTasks === 'function') renderMobTasks();
    }
  } catch(e) { console.error('loadTasks error', e); }
}

async function claimTask(id) {
  try {
    const r = await fetch(`/api/tasks/claim/${id}`, { method: 'POST', headers: API._headers() });
    if (!r.ok) return;
    const d = await r.json();
    if (d.success) {
      currentActivity = d.new_balance;
      MOCK_USER.activity_score = currentActivity;
      const balEl = document.getElementById('balance-amount');
      if (balEl) balEl.textContent = Math.floor(currentActivity);
      if (typeof window.syncMobBalance === 'function') window.syncMobBalance();
      showToast(`+${d.reward} очков активности!`);
      await loadTasks();
    } else {
      showToast('❌ ' + (d.message || 'Ошибка'));
    }
  } catch(e) { console.error('claimTask error', e); }
}

function renderTasks() {
  const list = document.getElementById('tasks-list');
  list.innerHTML = '';
  tasks.forEach(task => {
    const div = document.createElement('div');
    div.className = `task-item${task.completed?' completed':''}`;
    const pct = Math.round((task.progress/task.target)*100);
    div.innerHTML = `
      <div class="task-header"><span class="task-name">${task.name}</span><span class="task-reward">+${task.reward} <svg width="11" height="11" style="vertical-align:middle"><use href="#icon-points"/></svg></span></div>
      <div class="task-progress"><div class="task-progress-fill" style="width:${pct}%"></div></div>
      <div class="task-status">
        <span class="task-progress-text">${task.progress}/${task.target}</span>
        ${task.claimed ? '<span class="task-claim-btn completed">Получено</span>' : task.completed ? `<button class="task-claim-btn" onclick="claimTask('${task.id}')">Получить</button>` : `<span class="task-progress-text">${task.description}</span>`}
      </div>`;
    list.appendChild(div);
  });
}
window.claimTask = function(id) {
  const t = tasks.find(x=>x.id===id);
  if(t&&t.completed&&!t.claimed) { claimTask(t.id); }
};


// ===== ЛИДЕРБОРД =====
function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '';
  const sorted = [...MOCK_USERS].sort((a,b)=>(b.activity_score||0)-(a.activity_score||0));
  sorted.forEach((u, i) => {
    let rankClass = ''; if(i===0)rankClass='top-1'; else if(i===1)rankClass='top-2'; else if(i===2)rankClass='top-3';
    const tmpStar = { activityScore: u.activity_score||0, daysActive: u.days_active||0, messagesSent: u.messages_sent||0, friendsCount: u.friends_count||0, active: !!u.active };
    const st = typeof getUserStatus === 'function' ? getUserStatus(tmpStar) : null;
    const bgColor = st ? st.color + '18' : 'transparent';
    const borderColor = st ? st.color + '50' : 'transparent';
    const div = document.createElement('div');
    div.className = 'leaderboard-item';
    div.innerHTML = `
      <div class="leaderboard-rank ${rankClass}">${i+1}</div>
      <div class="leaderboard-info">
        <div class="leaderboard-name">${u.display_name}</div>
        <div class="leaderboard-username">@${u.username}</div>
        ${st ? `<div class="lb-status-badge" style="color:${st.color};background:${bgColor};border-color:${borderColor};">${st.label}</div>` : ''}
      </div>
      <div class="leaderboard-right">
        <div class="leaderboard-score"><svg width="11" height="11" style="vertical-align:middle;margin-right:2px"><use href="#icon-points"/></svg> ${u.activity_score}</div>
      </div>`;
    div.onclick = () => focusOnUser(u.username);
    list.appendChild(div);
  });
}

function focusOnUser(username) {
  const star = stars.find(s=>s.username===username);
  if (!star) return;
  viewportOffset.x = star.worldX - (canvas.width/2)/zoom;
  viewportOffset.y = star.worldY - (canvas.height/2)/zoom;
  clampViewport();
}


// ===== АКТИВНЫЕ ПОЛЬЗОВАТЕЛИ В ЧАТЕ =====
function renderActiveUsers() {
  const el = document.getElementById('active-users');
  if (!el) return;
  el.innerHTML = '';
  const online = MOCK_USERS.filter(u => u.active && u.username !== MOCK_USER.username);
  // Добавляем текущего пользователя
  const allOnline = [{ username: MOCK_USER.username, display_name: MOCK_USER.display_name, isMe: true }, ...online];
  if (!allOnline.length) { el.innerHTML = '<div class="user-tag" style="opacity:0.5">Нет активных</div>'; return; }
  allOnline.forEach(u => {
    const tag = document.createElement('div');
    tag.className = 'user-tag' + (u.isMe ? ' user-tag-me' : '');
    tag.textContent = '@' + u.username + (u.isMe ? ' (вы)' : '');
    tag.onclick = () => focusOnUser(u.username);
    el.appendChild(tag);
  });
}


// ===== МИНИ-АВАТАРКИ СООБЩЕНИЙ + СТАТУС СЕТИ =====
function _findUserByDisplay(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (typeof MOCK_USERS !== 'undefined') {
    const byName = MOCK_USERS.find(u => (u.display_name || '').toLowerCase() === lower);
    if (byName) return byName;
    const byUser = MOCK_USERS.find(u => (u.username || '').toLowerCase() === lower);
    if (byUser) return byUser;
  }
  return null;
}

// Определяет, является ли цвет тёмным (для выбора цвета текста на аватарке)
function _isDarkColor(hex) {
  if (!hex || hex[0] !== '#') return false;
  const v = hex.length === 4
    ? hex.slice(1).split('').map(c => parseInt(c + c, 16))
    : [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  if (v.some(Number.isNaN)) return false;
  const lum = (0.299*v[0] + 0.587*v[1] + 0.114*v[2]) / 255;
  return lum < 0.55;
}

// Добавляет .chat-avatar в сообщение, если его ещё нет
function _ensureChatAvatar(line) {
  if (!line || line.nodeType !== 1) return;
  if (line.classList.contains('chat-system')) return;
  if (!line.classList.contains('chat-line')) return;
  if (line.querySelector(':scope > .chat-avatar')) return;

  const isMe = line.classList.contains('chat-me');
  const usernameEl = line.querySelector(':scope > .chat-username');
  const displayName = (usernameEl?.textContent || '').trim();

  // Определяем автора: для своих сообщений - текущий пользователь
  let user = _findUserByDisplay(displayName);
  if (!user && isMe) {
    user = (typeof MOCK_USER !== 'undefined') ? MOCK_USER : null;
  }

  const color = (user && user.star_color) || '#8774e1';
  const initial = (displayName || (isMe ? 'Я' : '?')).trim().charAt(0).toUpperCase() || '?';
  const online = user ? !!user.active : isMe;
  const textColor = _isDarkColor(color) ? '#f5f7ff' : '#0b0f1a';

  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.style.background = color;
  avatar.style.color = textColor;
  avatar.style.boxShadow = `0 0 7px ${color}80`;
  avatar.setAttribute('aria-hidden', 'true');
  avatar.innerHTML = `<span class="chat-avatar-text">${initial}</span><div class="chat-avatar-status ${online ? 'online' : 'offline'}" title="${online ? 'В сети' : 'Офлайн'}"></div>`;

  line.prepend(avatar);
}

// Включает MutationObserver на контейнере, чтобы аватарки добавлялись для всех существующих
// и любых новых сообщений автоматически
function _installChatAvatars(container) {
  if (!container || container._chatAvatarObs) return;
  container.querySelectorAll(':scope > .chat-line').forEach(_ensureChatAvatar);
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach(n => {
        if (n.nodeType === 1 && n.classList && n.classList.contains('chat-line')) {
          _ensureChatAvatar(n);
        }
      });
    }
  });
  obs.observe(container, { childList: true });
  container._chatAvatarObs = obs;
}

// Инициализация для всех известных контейнеров + опрос новых (con-chat-msgs появляется по требованию)
(function _initChatAvatars() {
  const ids = [
    'chat-messages', 'chat-private-messages',
    'mob-chat-messages', 'mob-private-messages',
    'chat-favorites-messages', 'mob-favorites-messages',
    'con-chat-msgs'
  ];
  function installAll() {
    ids.forEach(id => {
      const c = document.getElementById(id);
      if (c) _installChatAvatars(c);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAll);
  } else {
    installAll();
  }
  // На случай, если панель созвездий создаётся позднее
  setInterval(installAll, 2500);
})();


// ===== ЧАТ =====
function addChatLine(text, cls) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-line ' + cls;

  const isCollapsed = chatOverlay.classList.contains('collapsed');

  if (cls === 'chat-system') {
    div.innerHTML = text;

    // подсветка системного
    if (isCollapsed) notifyChat('system');

  } else {
    const now = new Date();
    const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');

    const msgText = typeof text === 'object' ? text.text : text;

    div.innerHTML = `
      <div class="chat-username">${text.username||''}</div>
      <div class="chat-text">${msgText}</div>
      <div class="chat-time">${t}</div>
    `;

    // Упоминание
    if (msgText && msgText.includes('@' + MOCK_USER.username) && isCollapsed) {
        notifyChat('mention');
    }

    // обычное входящее
    if (cls === 'chat-other' && isCollapsed) {
        notifyChat('system');
    }
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function loadMockMessages() {
  if (loadChatMessages()) return;
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '';
  MOCK_MESSAGES.forEach((m, idx) => {
    const div = document.createElement('div');
    const isMe = m.username === MOCK_USER.username;
    div.className = 'chat-line ' + (isMe ? 'chat-me' : 'chat-other');
    const mid = 'mock_' + idx;
    div.dataset.msgId = mid;
    div.dataset.reactionKey = 'gen:' + mid;
    div.innerHTML = `<div class="chat-username">${m.display_name}</div><div class="chat-text">${m.text}</div><div class="chat-time">${m.time}</div>`;
    msgs.appendChild(div);
    if (typeof applyStoredReactions === 'function') applyStoredReactions(div);
  });
  msgs.scrollTop = msgs.scrollHeight;
  // Сохраняем, чтобы при следующих отправках/перезагрузках работать с единым списком
  saveChatMessages();
}


// ===== ПОИСК =====
function doSearch(query) {
  const results = document.getElementById('search-results');
  const q = query.trim().toLowerCase();
  if (!q) { results.innerHTML = ''; return; }
  const found = MOCK_USERS.filter(u => u.username.includes(q) || (u.display_name||'').toLowerCase().includes(q));
  results.innerHTML = '';
  if (!found.length) { results.innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px;">Не найдено</div>'; return; }
  found.forEach(u => {
    const div = document.createElement('div');
    div.className = 'search-result-item';
    div.innerHTML = `<span class="username">@${u.username}</span> — ${u.display_name} ${u.active?'🟢':'⚫'}`;
    div.onclick = () => { focusOnUser(u.username); document.getElementById('search-panel').classList.remove('visible'); isSearchOpen = false; };
    results.appendChild(div);
  });
}


// ===== СОСТОЯНИЕ UI =====
let isProfileOpen = false, isSearchOpen = false, isTasksOpen = false, isLeaderboardOpen = false;
const chatOverlay = document.getElementById('chat-overlay');

function closeAllModals(except) {
  if (except !== 'profile') { document.getElementById('profile-modal-overlay')?.classList.remove('visible'); isProfileOpen = false; }
  if (except !== 'search') { document.getElementById('search-panel')?.classList.remove('visible'); isSearchOpen = false; }
  if (except !== 'tasks') { document.getElementById('tasks-modal-overlay')?.classList.remove('visible'); isTasksOpen = false; }
  if (except !== 'leaderboard') { document.getElementById('leaderboard-modal-overlay')?.classList.remove('visible'); isLeaderboardOpen = false; }
}
// Устаревший алиас
const closeAllPanels = closeAllModals;

document.getElementById('user-profile').addEventListener('click', () => {
  isProfileOpen = !isProfileOpen;
  closeAllModals(isProfileOpen ? 'profile' : null);
  document.getElementById('profile-modal-overlay')?.classList.toggle('visible', isProfileOpen);
  if (isProfileOpen) updateProfileRankBadge();
});
function updateProfileRankBadge() {
  const badge = document.getElementById('profile-rank-badge-el');
  if (!badge) return;
  const myStar = stars.find(s => s.username === MOCK_USER.username) || {
    activityScore: MOCK_USER.activity_score || 0,
    daysActive: 42, messagesSent: 555, friendsCount: 7, active: true
  };
  const status = typeof getDisplayStatus === 'function' ? getDisplayStatus(myStar) : (typeof getUserStatus === 'function' ? getUserStatus(myStar) : null);
  if (!status) {
    badge.style.color = '#4a6080';
    badge.style.background = 'rgba(255,255,255,0.04)';
    badge.style.border = '1px solid rgba(255,255,255,0.08)';
    badge.innerHTML = 'нет статуса';
    badge.title = 'Продолжай общаться, чтобы заслужить статус';
    return;
  }
  badge.style.color = status.color;
  badge.style.background = status.color + '18';
  badge.style.border = '1px solid ' + status.color + '44';
  badge.innerHTML = status.label;
  badge.title = status.desc || '';
}

// Рендер вкладки «Статусы» в профиле
function renderStatusesTab() {
  const container = document.getElementById('profile-statuses-content');
  if (!container) return;
  const myStar = stars.find(s => s.username === MOCK_USER.username) || {
    activityScore: MOCK_USER.activity_score || 0, daysActive: 42,
    messagesSent: 555, friendsCount: 7, active: true
  };
  const earned = typeof getEarnedStatuses === 'function' ? getEarnedStatuses(myStar) : [];
  const selectedId = myStar._selectedStatusId || (earned[0] ? earned[0].id : null);

  container.innerHTML = '';

  // Заголовок
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom:14px;';
  header.innerHTML = `
    <div style="font-size:18px;font-weight:700;color:#e2e8f5;margin-bottom:4px;">Статусные бэйджи</div>
    <div class="status-earned-count" style="font-size:13px;">Заработано: <strong>${earned.length}</strong> из <strong>${ALL_STATUSES.length}</strong>
      ${earned.length > 1 ? ' — <span style="color:#a5b8f0;font-size:13px;">нажмите на заработанный статус, чтобы выбрать отображаемый</span>' : ''}</div>`;
  container.appendChild(header);

  // Карточки статусов
  const grid = document.createElement('div');
  grid.className = 'status-grid';

  ALL_STATUSES.forEach(st => {
    const isEarned = earned.some(e => e.id === st.id);
    const isSelected = isEarned && st.id === selectedId;
    const card = document.createElement('div');
    card.className = 'status-card' + (isEarned ? ' earned' : '') + (isSelected ? ' selected-status' : '');
    card.style.setProperty('--sc', st.color);
    // Конвертация hex в rgb для rgba
    const hex = st.color.replace('#','');
    const r = parseInt(hex.substring(0,2),16);
    const g = parseInt(hex.substring(2,4),16);
    const b = parseInt(hex.substring(4,6),16);
    card.style.setProperty('--scr', `${r},${g},${b}`);

    card.innerHTML = `
      <div class="status-card-header">
        <div class="status-chip" style="color:${st.color};background:${st.color}18;border-color:${st.color}44;">${st.label}</div>
        ${isEarned ? '' : '<span class="status-card-lock">🔒</span>'}
        <span class="status-card-sel">✓ Отображается</span>
      </div>
      <div class="status-card-desc">${st.desc}</div>
      <div class="status-card-req">${st.req}</div>`;

    if (isEarned) {
      card.addEventListener('click', () => {
        myStar._selectedStatusId = st.id;
        // Обновляем отображение бейджа
        updateProfileRankBadge();
        // Перерисовываем вкладку для отображения нового выбора
        renderStatusesTab();
      });
    }

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

document.getElementById('search-btn').addEventListener('click', () => {
  isSearchOpen = !isSearchOpen;
  closeAllModals(isSearchOpen ? 'search' : null);
  document.getElementById('search-panel')?.classList.toggle('visible', isSearchOpen);
  if (isSearchOpen) document.getElementById('search-input')?.focus();
});
document.getElementById('tasks-btn').addEventListener('click', () => {
  isTasksOpen = !isTasksOpen;
  closeAllModals(isTasksOpen ? 'tasks' : null);
  document.getElementById('tasks-modal-overlay')?.classList.toggle('visible', isTasksOpen);
});
document.getElementById('leaderboard-btn').addEventListener('click', () => {
  isLeaderboardOpen = !isLeaderboardOpen;
  closeAllModals(isLeaderboardOpen ? 'leaderboard' : null);
  document.getElementById('leaderboard-modal-overlay')?.classList.toggle('visible', isLeaderboardOpen);
  if (isLeaderboardOpen) renderLeaderboard();
});
// Кнопки закрытия модалок
document.getElementById('profile-modal-close')?.addEventListener('click', () => { document.getElementById('profile-modal-overlay').classList.remove('visible'); isProfileOpen = false; });
document.getElementById('tasks-modal-close')?.addEventListener('click', () => { document.getElementById('tasks-modal-overlay').classList.remove('visible'); isTasksOpen = false; });
document.getElementById('leaderboard-modal-close')?.addEventListener('click', () => { document.getElementById('leaderboard-modal-overlay').classList.remove('visible'); isLeaderboardOpen = false; });

// Переключение вкладок навигации профиля
(function() {
  function initProfileNav() {
    document.querySelectorAll('.profile-nav-item[data-profile-tab]').forEach(item => {
      if (item._pnInit) return; item._pnInit = true;
      item.addEventListener('click', () => {
        const tab = item.dataset.profileTab;
        document.querySelectorAll('.profile-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.profile-section').forEach(s => s.classList.remove('active'));
        item.classList.add('active');
        const sec = document.getElementById('profile-tab-' + tab);
        if (sec) sec.classList.add('active');
        if (tab === 'statuses') renderStatusesTab();
      });
    });
  }
  new MutationObserver(initProfileNav).observe(document.body, { childList: true, subtree: true });
  setTimeout(initProfileNav, 300);
})();
// Закрытие по клику на фон оверлея
['profile-modal-overlay','tasks-modal-overlay','leaderboard-modal-overlay'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => {
    if (e.target === document.getElementById(id)) {
      document.getElementById(id).classList.remove('visible');
      if (id === 'profile-modal-overlay') isProfileOpen = false;
      if (id === 'tasks-modal-overlay') isTasksOpen = false;
      if (id === 'leaderboard-modal-overlay') isLeaderboardOpen = false;
    }
  });
});
document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('settings-modal-overlay').classList.add('visible');
  closeAllModals(null);
  buildBgGrid(); buildChatThemeGrid();
});
// Отключение всех звуков
document.addEventListener('click', (e) => {
  if (!e.target.closest('#mute-all-btn')) return;
  allSoundsMuted = !allSoundsMuted;
  const label = document.getElementById('mute-all-label');
  const btn = document.getElementById('mute-all-btn');
  const icon = document.getElementById('mute-all-icon');
  if (label) label.textContent = allSoundsMuted ? 'Включить уведомления' : 'Заглушить все уведомления';
  if (btn) {
    btn.style.borderColor = allSoundsMuted ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.35)';
    btn.style.background = allSoundsMuted ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)';
    btn.style.color = allSoundsMuted ? '#4ade80' : '#f87171';
  }
  // Меняем иконку настроек в соответствии с состоянием
  if (icon) {
    icon.innerHTML = `<use href="#${allSoundsMuted ? 'icon-volumeoff' : 'icon-volumeon'}"/>`;
  }
  // Синхронизация кнопки быстрого мута
  const qb = document.getElementById('quick-mute-btn');
  if (qb) {
    qb.classList.toggle('muted', allSoundsMuted);
    qb.title = allSoundsMuted ? 'Включить звуковые уведомления' : 'Отключить все звуковые уведомления';
    if (allSoundsMuted) {
      qb.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeoff"/></svg>`;
    } else {
      qb.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeon"/></svg>`;
    }
  }
});

document.getElementById('settings-close-btn').addEventListener('click', () => {
  document.getElementById('settings-modal-overlay').classList.remove('visible');
});

// Навигация боковой панели настроек
document.querySelectorAll('.settings-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    const panelId = 'panel-' + item.dataset.panel;
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('active');
    if (item.dataset.panel === 'background') buildBgGrid();
    if (item.dataset.panel === 'chattheme') { const g = document.getElementById('chat-theme-grid'); if (g) { g.innerHTML=''; delete g.dataset.built; } buildChatThemeGrid(); }
  });
});

// Обработчики s-btn (позиция/размер чата)
document.querySelectorAll('.s-btn[data-position]').forEach(btn => {
  btn.addEventListener('click', () => {
    const pos = btn.dataset.position;
    chatOverlay.classList.remove('position-left','position-center','position-right');
    chatOverlay.classList.add('position-' + pos);
    document.querySelectorAll('.s-btn[data-position]').forEach(b => b.classList.toggle('active', b.dataset.position === pos));
    // Синхронизация устаревших [data-position] preset-btn
    document.querySelectorAll('[data-position]').forEach(b => b.classList.toggle('active', b.dataset.position === pos));
  });
});
document.querySelectorAll('.s-btn[data-width]').forEach(btn => {
  btn.addEventListener('click', () => {
    chatOverlay.style.width = btn.dataset.width + 'px';
    document.querySelectorAll('.s-btn[data-width]').forEach(b => b.classList.toggle('active', b.dataset.width === btn.dataset.width));
    document.querySelectorAll('[data-width]').forEach(b => b.classList.toggle('active', b.dataset.width === btn.dataset.width));
  });
});
document.querySelectorAll('.s-btn[data-height]').forEach(btn => {
  btn.addEventListener('click', () => {
    const h = btn.dataset.height + 'px';
    chatOverlay.style.maxHeight = h;
    chatOverlay.style.height    = h;
    document.querySelectorAll('.s-btn[data-height]').forEach(b => b.classList.toggle('active', b.dataset.height === btn.dataset.height));
    document.querySelectorAll('[data-height]').forEach(b => b.classList.toggle('active', b.dataset.height === btn.dataset.height));
  });
});
// Звуковой движок Web Audio
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

const soundDefs = {

  // Стеклянные колокольчики 
  wind_chime: (ctx) => {
    const t = ctx.currentTime;
    const notes = [880, 1108.73, 1318.51, 880];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.08);
        gain.gain.linearRampToValueAtTime(0.14, t + i * 0.08 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.8);
        osc.start(t + i * 0.08);
        osc.stop(t + i * 0.08 + 0.8);
    });
},

  // Колокол с эхом
  bell_echo: (ctx) => {
    const t = ctx.currentTime;
    const mainGain = ctx.createGain();
    mainGain.connect(ctx.destination);
    mainGain.gain.value = 0.22;
    
    const playNote = (freq, delay, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(mainGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(0.16, t + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + duration);
        osc.start(t + delay);
        osc.stop(t + delay + duration);
    };
    
    playNote(660, 0, 0.7);
    playNote(830, 0.15, 0.6);
    playNote(523, 0.3, 0.5);
},

  // Арфа
  harp: (ctx) => {
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 523.25, 440];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.5);
        osc.start(t + i * 0.12);
        osc.stop(t + i * 0.12 + 0.5);
    });
},

  // Синт-пинг с фильтром
  synth: (ctx) => {
    const t = ctx.currentTime;
    [[440, 0, 'sawtooth', 0.09], [660, 0.1, 'square', 0.07]].forEach(([freq, delay, type, vol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 1100;
      osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(vol, t + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.4);
      osc.start(t + delay); osc.stop(t + delay + 0.4);
    });
  },

  // Космический ping - нарастающий свист
  space: (ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.18);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.45);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.start(t); osc.stop(t + 0.6);
  },

  // Мягкий колокол
  soft_bell: (ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(660, t + 0.2);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.start(t);
    osc.stop(t + 0.6);
},

  // Флейта мечты (notification tap)
  flute_dream: (ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 0.8;
    osc.frequency.setValueAtTime(587.33, t);
    osc.frequency.exponentialRampToValueAtTime(523.25, t + 0.4);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.start(t);
    osc.stop(t + 0.9);
},

  // Небесная сфера
  celestial: (ctx) => {
    const t = ctx.currentTime;
    const notes = [220, 330, 440, 330, 220];
    notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.055, t + i * 0.15 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.15 + 0.7);
        osc.start(t + i * 0.15);
        osc.stop(t + i * 0.15 + 0.7);
    });
},
};

let currentSound = 'celestial';

let allSoundsMuted = false;

// Кнопка быстрого мута (рядом с zoom-level)
(function() {
  const qb = document.getElementById('quick-mute-btn');
  if (!qb) return;
  function syncQuickMute() {
    qb.classList.toggle('muted', allSoundsMuted);
    qb.title = allSoundsMuted ? 'Включить звуковые уведомления' : 'Отключить все звуковые уведомления';
    // Синхронизация SVG-иконки
    if (allSoundsMuted) {
      qb.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeoff"/></svg>`;
    } else {
      qb.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeon"/></svg>`;
    }
    // Также синхронизируем кнопку мута в панели настроек
    const label = document.getElementById('mute-all-label');
    const btn = document.getElementById('mute-all-btn');
    const icon = document.getElementById('mute-all-icon');
    if (label) label.textContent = allSoundsMuted ? 'Включить уведомления' : 'Заглушить все уведомления';
    if (btn) {
      btn.style.borderColor = allSoundsMuted ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.35)';
      btn.style.background = allSoundsMuted ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.06)';
      btn.style.color = allSoundsMuted ? '#4ade80' : '#f87171';
    }
    if (icon) {
      icon.innerHTML = `<use href="#${allSoundsMuted ? 'icon-volumeoff' : 'icon-volumeon'}"/>`;
    }
  }
  qb.addEventListener('click', () => {
    allSoundsMuted = !allSoundsMuted;
    syncQuickMute();
  });
  syncQuickMute();
})();

function playSound(name) {
  if (allSoundsMuted) return;
  try {
    const ctx = getAudioCtx();
    const fn = soundDefs[name] || soundDefs.wind_chime;
    fn(ctx);
  } catch(e) { console.warn('Audio error:', e); }
}

// Настройки звука по событиям
const soundSettings = {
  mention: 'celestial',
  private: 'wind_chime',
  system: 'harp',
};

document.querySelectorAll('.s-btn[data-sound-type]').forEach(btn => {
  btn.addEventListener('click', () => {
    const type = btn.dataset.soundType;
    const sound = btn.dataset.sound;
    soundSettings[type] = sound;
    // Обновляем активное состояние только внутри той же группы
    document.querySelectorAll(`.s-btn[data-sound-type="${type}"]`).forEach(b =>
      b.classList.toggle('active', b.dataset.sound === sound));
    playSound(sound);
  });
});

// Устаревший обработчик звука (на всякий случай)
document.querySelectorAll('.s-btn[data-sound]:not([data-sound-type])').forEach(btn => {
  btn.addEventListener('click', () => {
    currentSound = btn.dataset.sound;
    document.querySelectorAll('.s-btn[data-sound]:not([data-sound-type])').forEach(b =>
      b.classList.toggle('active', b.dataset.sound === currentSound));
    playSound(currentSound);
  });
});


// ===== ПЕРЕКЛЮЧАТЕЛЬ СТИЛЯ ВЕРХНЕЙ ПАНЕЛИ =====
let currentTopbarStyle = 'default';

// Динамическое позиционирование панели: размещение рядом с кнопкой-триггером
function positionPanelNearBtn(panelId, btnEl, preferSide) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const rect = btnEl.getBoundingClientRect();
  const panelW = panel.offsetWidth || parseInt(getComputedStyle(panel).width) || 280;
  const gap = 8;
  let top = rect.bottom + gap;
  let left;
  // Пытаемся выровнять правый край панели по правому краю кнопки
  if (preferSide === 'left') {
    left = rect.left;
  } else {
    left = rect.right - panelW;
  }
  // Ограничиваем рамками viewport
  if (left < 8) left = 8;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  if (top + 300 > window.innerHeight - 8) top = rect.top - 300 - gap;
  panel.style.setProperty('top', top + 'px', 'important');
  panel.style.setProperty('left', left + 'px', 'important');
  panel.style.setProperty('right', 'auto', 'important');
  // Для tasks-panel с transform:translate(-50%)
  if (panelId === 'tasks-panel') {
    panel.style.setProperty('transform', 'none', 'important');
    panel.style.setProperty('left', (rect.left - panelW/2 + rect.width/2) + 'px', 'important');
  }
}

// Переопределяем обработчики кнопок для динамического позиционирования
function rewireButtonsForDynamic() {
  const pairs = [
    { btnId: 'user-profile', panelId: 'profile-panel', side: 'right' },
    { btnId: 'search-btn', panelId: 'search-panel', side: 'right' },
    { btnId: 'tasks-btn', panelId: 'tasks-panel', side: 'center' },
    { btnId: 'leaderboard-btn', panelId: 'leaderboard-panel', side: 'right' }
  ];
  pairs.forEach(({ btnId, panelId, side }) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    // Используем capture observer при следующем открытии
    btn.addEventListener('click', () => {
      setTimeout(() => {
        const panel = document.getElementById(panelId);
        if (panel && panel.classList.contains('visible')) {
          positionPanelNearBtn(panelId, btn, side);
        }
        // Лидерборд — особый случай
        if (panelId === 'leaderboard-panel' && !panel?.classList.contains('collapsed')) {
          positionPanelNearBtn(panelId, btn, side);
        }
      }, 10);
    });
  });
}
rewireButtonsForDynamic();


// ===== ДВИЖОК СТИЛЕЙ ВЕРХНЕЙ ПАНЕЛИ =====

const _origSnapshot = {};

function _saveOrig(id) {
  if (_origSnapshot[id]) return;
  const el = document.getElementById(id);
  if (!el || !el.parentElement) return;
  _origSnapshot[id] = {
    parent: el.parentElement,
    index: Array.from(el.parentElement.children).indexOf(el)
  };
}

function _restore(id) {
  const el = document.getElementById(id);
  const snap = _origSnapshot[id];
  if (!el || !snap) return;
  const siblings = Array.from(snap.parent.children).filter(c => c !== el);
  const ref = siblings[snap.index] ?? null;
  ref ? snap.parent.insertBefore(el, ref) : snap.parent.appendChild(el);
}

const ALL_BTN_IDS = ['user-profile','search-btn','tasks-btn','leaderboard-btn', 'settings-btn','friends-btn','logout-btn'];

// Сохраняем оригиналы при парсинге скрипта (DOM готов, стили ещё не применены)
ALL_BTN_IDS.forEach(_saveOrig);

let splitIconOrder = [
  { action: 'profile', side: 'left' },
  { action: 'search', side: 'left' },
  { action: 'tasks', side: 'left' },
  { action: 'leaderboard', side: 'left' },
  { action: 'settings', side: 'right' },
  { action: 'friends', side: 'right' },
  { action: 'logout', side: 'right' },
];

// Метаданные иконок для рендера разделённых полос
const SPLIT_ICON_META = {
  profile: { title: 'Профиль', color: '#38bdf8', svg: '#icon-activity' },
  search: { title: 'Поиск', color: '', svg: '#icon-search' },
  tasks: { title: 'Задания', color: '#4ade80', svg: '#icon-tasks' },
  leaderboard: { title: 'Таблица лидеров', color: '#fbbf24', svg: '#icon-leaderboard' },
  settings: { title: 'Настройки', color: '', svg: '#icon-settings' },
  friends: { title: 'Друзья', color: 'ffffff', svg: '#icon-friends' },
  logout: { title: 'Выйти', color: '#ef4444', svg: '#icon-logout' },
};

function _renderSplitStrips() {
  const leftStrip = document.getElementById('top-bar-left-strip');
  const rightStrip = document.getElementById('top-bar-right-strip');
  if (!leftStrip || !rightStrip) return;

  leftStrip.innerHTML = '';
  rightStrip.innerHTML = '';

  const profileEl = document.getElementById('user-profile');
  const labelText = document.getElementById('user-label')?.textContent || 'Профиль';

  splitIconOrder.forEach(({ action, side }) => {
    const strip = side === 'left' ? leftStrip : rightStrip;

    if (action === 'profile') {
      // Рендерим реальную кнопку-капсулу профиля
      const profileBtn = document.createElement('div');
      profileBtn.id = 'user-profile-split';
      profileBtn.style.cssText = `
        display:flex;align-items:center;gap:6px;padding:4px 10px;
        border-radius:999px;background:rgba(2,6,23,0.45);
        border:1px solid rgba(56,189,248,0.7);cursor:pointer;
        transition:all 0.15s ease;animation:userGlow 4s ease-in-out infinite;
        font-size:11px;color:#e5e7eb;flex-shrink:0;
      `;
      profileBtn.innerHTML = `
        <div style="width:18px;height:18px;border-radius:999px;background:radial-gradient(circle at 30% 30%,#0ea5e9,#4f46e5);
        box-shadow:0 0 14px rgba(37,99,235,0.6);flex-shrink:0;animation:avatarPulse 3s ease-in-out infinite;"></div>
        <span style="white-space:nowrap;">${labelText}</span>
      `;
      profileBtn.addEventListener('click', () => profileEl?.click());
      strip.appendChild(profileBtn);
      return;
    }

    const meta = SPLIT_ICON_META[action];
    if (!meta) return;
    const btn = document.createElement('div');
    btn.className = 'icon-btn-clone';
    btn.dataset.action = action;
    btn.title = meta.title;
    if (meta.color) btn.style.color = meta.color;
    btn.innerHTML = `<svg width="17" height="17"><use href="${meta.svg}"/></svg>`;

    if (action === 'friends') {
      btn.style.position = 'relative';
      const mainBadge = document.getElementById('friends-badge');
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'friends-badge-split' + (mainBadge?.classList.contains('visible') ? ' visible' : '');
      badgeSpan.id = 'friends-badge-split';
      badgeSpan.textContent = mainBadge?.textContent || '';
      btn.appendChild(badgeSpan);
    }

    btn.addEventListener('click', () => {
      const map = {
        search:'search-btn', tasks:'tasks-btn', leaderboard:'leaderboard-btn',
        settings:'settings-btn', friends:'friends-btn', logout:'logout-btn'
      };
      if (map[action]) document.getElementById(map[action])?.click();
    });

    strip.appendChild(btn);
  });
}

// Главный применитель стилей
function applyTopbarStyle(style) {
  currentTopbarStyle = style;
  const topBar = document.getElementById('top-bar');
  const topLeft = document.getElementById('top-left');
  const topCenter = document.getElementById('top-center');
  const topRight = document.getElementById('top-right');

  // Полный сброс
  document.body.classList.remove('topbar-split');
  if (topBar) {
    topBar.classList.remove('style-minimal', 'style-transparent');
    topBar.style.display = '';
  }
  ALL_BTN_IDS.forEach(_restore);

  // При выходе из split возвращаем карусель-виджет в исходный #top-center
  // и убираем разделитель-ленту, если они остались от прошлого переключения
  const carouselEl = document.getElementById('top-carousel');
  const brandPill = document.getElementById('top-bar-brand');
  const oldDivider = brandPill ? brandPill.querySelector('.brand-split-divider') : null;
  if (oldDivider) oldDivider.remove();
  if (carouselEl && topCenter && carouselEl.parentElement !== topCenter) {
    topCenter.appendChild(carouselEl);
  }

  // Применяем выбранный стиль
  if (style === 'default') {
    // ничего — сброса выше достаточно

  } else if (style === 'split') {
    document.body.classList.add('topbar-split');
    _renderSplitStrips();
    // В центральной пилюле оставляем только виджет-карусель (логотип и подпись
    // скрыты через CSS при body.topbar-split). Разделитель не нужен
    if (brandPill && carouselEl && carouselEl.parentElement !== brandPill) {
      brandPill.appendChild(carouselEl);
    }
    // Синхронизация бейджа друзей
    const splitBadge = document.getElementById('friends-badge-split');
    const mainBadge = document.getElementById('friends-badge');
    if (splitBadge && mainBadge) {
      splitBadge.textContent = mainBadge.textContent;
      splitBadge.classList.toggle('visible', mainBadge.classList.contains('visible'));
    }

  } else if (style === 'minimal') {
    topBar.classList.add('style-minimal');

  } else if (style === 'transparent') {
    topBar.classList.add('style-transparent');
  }

  // Обновляем активную карточку в выборе
  document.querySelectorAll('.topbar-style-card').forEach(card => {
    card.classList.toggle('active', card.dataset.topbarStyle === style);
  });

  // Показ/скрытие UI перетаскивания в настройках
  const splitReorderSection = document.getElementById('split-reorder-section');
  if (splitReorderSection) {
    splitReorderSection.style.display = style === 'split' ? 'block' : 'none';
  }
}

document.querySelectorAll('.topbar-style-card').forEach(card => {
  card.addEventListener('click', () => applyTopbarStyle(card.dataset.topbarStyle));
});


// ===== UI ПЕРЕТАСКИВАНИЯ РАЗДЕЛЁННОЙ ПАНЕЛИ =====

function buildSplitReorderUI() {
  const container = document.getElementById('split-reorder-section');
  if (!container) return;

  const LABELS = {
    profile: 'Профиль', search: 'Поиск', tasks: 'Задания', leaderboard: 'Таблица',
    settings: 'Настройки', friends: 'Друзья', logout: 'Выход'
  };
  const ICONS = {
    profile: '#icon-activity', search: '#icon-search', tasks: '#icon-tasks',
    leaderboard: '#icon-leaderboard', settings: '#icon-settings',
    friends: '#icon-friends', logout: '#icon-logout'
  };
  const COLORS = {
    profile: '#38bdf8', tasks: '#4ade80', leaderboard: '#fbbf24',
    friends: 'ffffff', logout: '#ef4444'
  };

  function render() {
    container.innerHTML = `
      <div style="font-size:11px;font-weight:600;color:#6b84a8;margin-bottom:10px;letter-spacing:0.04em;">
        ПОРЯДОК ИКОНОК - РАЗДЕЛЁННЫЙ СТИЛЬ
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        ${['left','right'].map(side => `
          <div>
            <div style="font-size:10px;color:#4a6080;margin-bottom:6px;text-align:center;padding:3px 8px;background:rgba(109,74,255,0.08);border-radius:6px;
            border:1px solid rgba(109,74,255,0.15);">
              ${side === 'left' ? '◀ Левая панель' : 'Правая панель ▶'}
            </div>
            <div class="split-reorder-col" data-side="${side}"style="min-height:40px;display:flex;flex-direction:column;gap:4px;padding:6px;border-radius:10px;
            background:rgba(109,74,255,0.04);border:1px solid rgba(109,74,255,0.1);">
              ${splitIconOrder.filter(i => i.side === side).map(({action}) => `
                <div class="split-reorder-item" draggable="true" data-action="${action}"style="display:flex;align-items:center;gap:8px;
                padding:6px 8px;border-radius:8px;background:rgba(8,12,26,0.4);border:1px solid rgba(109,74,255,0.18);cursor:grab;transition:all 0.15s;user-select:none;">
                  <svg width="14" height="14" style="color:${COLORS[action]||'#8ba3f0'};flex-shrink:0">
                    <use href="${ICONS[action]}"/>
                  </svg>
                  <span style="font-size:10px;color:#c4cfe8;flex:1;">${LABELS[action]}</span>
                  <span style="font-size:9px;color:#3d5473;cursor:grab;">⠿</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div style="font-size:9px;color:#3d5473;margin-top:8px;text-align:center;">
        Перетащите иконку между колонками или внутри колонки чтобы изменить порядок
      </div>
    `;

    // Подключаем drag-and-drop
    let dragSrc = null;
    container.querySelectorAll('.split-reorder-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        dragSrc = item;
        item.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.action);
      });
      item.addEventListener('dragend', () => {
        item.style.opacity = '';
        container.querySelectorAll('.split-reorder-col').forEach(c => {
          c.style.background = 'rgba(109,74,255,0.04)';
          c.style.borderColor = 'rgba(109,74,255,0.1)';
        });
      });
      item.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSrc && dragSrc !== item) {
          const col = item.closest('.split-reorder-col');
          const items = [...col.querySelectorAll('.split-reorder-item')];
          const rect = item.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          col.insertBefore(dragSrc, e.clientY < mid ? item : item.nextSibling);
        }
      });
    });

    container.querySelectorAll('.split-reorder-col').forEach(col => {
      col.addEventListener('dragover', e => {
        e.preventDefault();
        col.style.background = 'rgba(109,74,255,0.1)';
        col.style.borderColor = 'rgba(109,74,255,0.3)';
        // Если перетаскиваем над колонкой (не элементом), добавляем в конец
        if (dragSrc && e.target === col) {
          col.appendChild(dragSrc);
        }
      });
      col.addEventListener('dragleave', () => {
        col.style.background = 'rgba(109,74,255,0.04)';
        col.style.borderColor = 'rgba(109,74,255,0.1)';
      });
      col.addEventListener('drop', e => {
        e.preventDefault();
        col.style.background = 'rgba(109,74,255,0.04)';
        col.style.borderColor = 'rgba(109,74,255,0.1)';
        // Перестраиваем splitIconOrder из состояния DOM
        _commitSplitOrder();
        _renderSplitStrips();
      });
    });
  }

  function _commitSplitOrder() {
    const newOrder = [];
    ['left','right'].forEach(side => {
      const col = container.querySelector(`.split-reorder-col[data-side="${side}"]`);
      if (!col) return;
      col.querySelectorAll('.split-reorder-item').forEach(item => {
        newOrder.push({ action: item.dataset.action, side });
      });
    });
    splitIconOrder = newOrder;
  }

  render();
}

// Инициализация UI перетаскивания после загрузки DOM
buildSplitReorderUI();


// ===== ПАНЕЛЬ ДРУЗЕЙ (данные из БД) =====
const pendingRequests = {}; // { userId: { username, display_name, star_color } }

let isFriendsModalOpen = false;
let currentFriendsTab = 'friends';
let _friendsList = []; // кеш списка друзей из API

async function loadFriendsFromServer() {
  try {
    const [fr, pr] = await Promise.all([
      fetch('/api/friends/list', { headers: API._headers() }).then(r => r.json()),
      fetch('/api/friends/pending', { headers: API._headers() }).then(r => r.json())
    ]);
    if (fr.success) {
      _friendsList = fr.friends;
      // Синхронизируем friendsMap
      Object.keys(friendsMap).forEach(k => { if (friendsMap[k] === 'friends') delete friendsMap[k]; });
      fr.friends.forEach(u => { friendsMap[u.username] = 'friends'; });
    }
    if (pr.success) {
      Object.keys(pendingRequests).forEach(k => delete pendingRequests[k]);
      pr.pending.forEach(u => { pendingRequests[u.id] = u; });
    }
    renderFriendsPanel();
  } catch(e) { console.error('loadFriends error', e); }
}

function openFriendsModal() {
  isFriendsModalOpen = true;
  document.getElementById('friends-modal-overlay').classList.add('visible');
  loadFriendsFromServer();
}
function closeFriendsModal() {
  isFriendsModalOpen = false;
  document.getElementById('friends-modal-overlay').classList.remove('visible');
}

function renderFriendsPanel() {
  const tab = currentFriendsTab;
  const container = document.getElementById('friends-list-container');
  container.innerHTML = '';

  const pendingList = Object.values(pendingRequests);
  document.getElementById('friends-count-badge').textContent = _friendsList.length;
  document.getElementById('pending-count-badge').textContent = pendingList.length;

  const topBadge = document.getElementById('friends-badge');
  if (pendingList.length > 0) { topBadge.textContent = pendingList.length; topBadge.classList.add('visible'); }
  else { topBadge.classList.remove('visible'); }
  const splitBadge = document.getElementById('friends-badge-split');
  if (splitBadge) {
    splitBadge.textContent = topBadge.textContent;
    splitBadge.classList.toggle('visible', topBadge.classList.contains('visible'));
  }

  const list = document.createElement('div');
  list.className = 'friends-list';

  if (tab === 'friends') {
    if (!_friendsList.length) {
      list.innerHTML = `<div class="friends-empty"><div class="friends-empty-icon">👥</div>Нет друзей<br><small style="color:#3d5473;margin-top:6px;display:block">Нажмите на звезду, чтобы добавить</small></div>`;
    } else {
      _friendsList.forEach(u => list.appendChild(makeFriendItem(u)));
    }
  } else if (tab === 'pending') {
    if (!pendingList.length) {
      list.innerHTML = `<div class="friends-empty"><div class="friends-empty-icon">⏳</div>Нет входящих запросов</div>`;
    } else {
      pendingList.forEach(user => {
        const pi = document.createElement('div');
        pi.className = 'pending-item';
        pi.innerHTML = `
          <div class="friend-avatar" style="background:${user.star_color}22;border-radius:12px;">
            <div style="width:24px;height:24px;border-radius:50%;background:${user.star_color};box-shadow:0 0 8px ${user.star_color}88;"></div>
          </div>
          <div class="pending-info">
            <div class="pending-name">${user.display_name}</div>
            <div class="pending-sub">@${user.username} · хочет добавить вас</div>
          </div>
          <div class="pending-btns">
            <button class="pending-accept" data-uid="${user.id}">✓ Принять</button>
            <button class="pending-reject" data-uid="${user.id}">Х</button>
          </div>`;
        pi.querySelector('.pending-accept').addEventListener('click', async () => {
          const res = await fetch(`/api/friends/accept/${user.id}`, { method: 'POST', headers: API._headers() });
          const d = await res.json();
          if (d.success) {
            friendsMap[user.username] = 'friends';
            addChatLine(`🤝 Вы приняли запрос в друзья от @${user.username}!`, 'chat-system');
            await loadFriendsFromServer();
          }
        });
        pi.querySelector('.pending-reject').addEventListener('click', async () => {
          await fetch(`/api/friends/reject/${user.id}`, { method: 'DELETE', headers: API._headers() });
          await loadFriendsFromServer();
        });
        list.appendChild(pi);
      });
    }
  } else if (tab === 'online') {
    const online = _friendsList.filter(u => u.is_online);
    if (!online.length) {
      list.innerHTML = `<div class="friends-empty"><div class="friends-empty-icon">🟢</div>Нет онлайн друзей</div>`;
    } else {
      online.forEach(u => list.appendChild(makeFriendItem(u)));
    }
  }

  container.appendChild(list);
}

function makeFriendItem(user) {
  const item = document.createElement('div');
  item.className = 'friend-item';
  const color = user.star_color || '#8774e1';
  item.innerHTML = `
    <div class="friend-avatar" style="background:${color}22;border-radius:12px;">
      <div style="width:22px;height:22px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}88;"></div>
      <div class="friend-status-dot ${user.is_online ? 'online' : 'offline'}"></div>
    </div>
    <div class="friend-info">
      <div class="friend-name">${user.display_name || user.username}</div>
      <div class="friend-handle">@${user.username} · ${user.is_online ? '🟢 онлайн' : '⚫ офлайн'}</div>
    </div>
    <div class="friend-actions">
      <button class="friend-action-btn" title="Написать" data-msg="${user.username}">
        <svg width="13" height="13"><use href="#icon-chat"/></svg>
      </button>
      <button class="friend-action-btn" title="Найти на карте" data-find="${user.username}">
        <svg width="13" height="13"><use href="#icon-search"/></svg>
      </button>
      <button class="friend-action-btn remove" title="Удалить из друзей" data-remove="${user.id}">
        <svg width="13" height="13"><use href="#icon-remove"/></svg>
      </button>
    </div>`;
  item.querySelector('[data-find]').addEventListener('click', () => { focusOnUser(user.username); closeFriendsModal(); });
  item.querySelector('[data-msg]').addEventListener('click', () => {
    closeFriendsModal();
    if (typeof openPrivateChat === 'function') openPrivateChat(user.username);
  });
  item.querySelector('[data-remove]').addEventListener('click', async () => {
    await fetch(`/api/friends/remove/${user.id}`, { method: 'DELETE', headers: API._headers() });
    friendsMap[user.username] = 'none';
    addChatLine(`❌ @${user.username} удалён из друзей`, 'chat-system');
    await loadFriendsFromServer();
  });
  return item;
}

// Переключение вкладок

// Переключение вкладок
document.querySelectorAll('.friends-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    currentFriendsTab = tab.dataset.ftab;
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.toggle('active', t.dataset.ftab === currentFriendsTab));
    renderFriendsPanel();
  });
});

// Кнопка друзей -> открыть модалку
document.getElementById('friends-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (isFriendsModalOpen) closeFriendsModal();
  else openFriendsModal();
});

// Кнопка закрытия внутри модалки
document.getElementById('friends-modal-close').addEventListener('click', closeFriendsModal);

// Закрытие по клику на фон оверлея
document.getElementById('friends-modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('friends-modal-overlay')) closeFriendsModal();
});



// НАСТРОЙКА АНИМИРОВАННОГО ФОНА
let animSettings = { speed: 100, intensity: 72, blur: 12, scale: 100 };

const ANIM_PRESETS = {
  chill: { speed: 30, intensity: 45, blur: 20, scale: 120 },
  normal: { speed: 100, intensity: 72, blur: 12, scale: 100 },
  energetic: { speed: 220, intensity: 110, blur: 7, scale: 90 },
  hypnotic: { speed: 160, intensity: 140, blur: 4, scale: 150 },
};

function applyAnimPreset(name) {
  const p = ANIM_PRESETS[name];
  if (!p) return;
  document.getElementById('anim-speed').value = p.speed;
  document.getElementById('anim-intensity').value = p.intensity;
  document.getElementById('anim-blur').value = p.blur;
  document.getElementById('anim-scale').value = p.scale;
  document.querySelectorAll('.anim-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === name));
  updateAnimSettings();
}

function updateAnimSettings() {
  const speed = parseInt(document.getElementById('anim-speed').value);
  const intensity = parseInt(document.getElementById('anim-intensity').value);
  const blur = Math.max(5, parseInt(document.getElementById('anim-blur').value));
  const scale = parseInt(document.getElementById('anim-scale').value);
  animSettings = { speed, intensity, blur, scale };
  // Персистим настройки анимации, чтобы они переживали перезагрузку.
  if (typeof updateSetting === 'function') updateSetting('animSettings', animSettings);

  const mul = speed / 100;
  document.getElementById('anim-speed-val').textContent = mul.toFixed(1) + '×';
  document.getElementById('anim-intensity-val').textContent = intensity + '%';
  document.getElementById('anim-blur-val').textContent = blur + 'vw';
  document.getElementById('anim-scale-val').textContent = scale + '%';

  const walpole   = document.getElementById('bg-walpole');
  const wilvander = document.getElementById('bg-wilvander');

  if (walpole && walpole.style.display !== 'none') {
    walpole.style.filter = `blur(${blur}vw)`;
    const dur1 = Math.round(22000 / mul);
    const dur2 = Math.round(16000 / mul);
    const shapes = walpole.querySelectorAll('.walpole-shape');
    shapes.forEach((s, i) => {
      s.style.animationDuration = (i === 0 ? dur1 : dur2) + 'ms';
      s.style.opacity = (intensity / 100) * 0.72;
      s.style.transform = `scale(${scale / 100})`;
    });
  }
  if (wilvander && wilvander.style.display !== 'none') {
    const g = wilvander.querySelector('.wilvander-gradient');
    if (g) {
      const sz = Math.round(750 * (scale / 100));
      g.style.setProperty('--size', sz + 'px');
      g.style.setProperty('--speed', Math.round(50 / mul) + 's');
      g.style.filter = `blur(${sz / 5}px) brightness(${intensity / 72})`;
    }
  }
  if (currentBgId === 'default') {
    document.body.style.animationDuration = Math.round(35000 / mul) + 'ms';
  }
}

['anim-speed','anim-intensity','anim-blur','anim-scale'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', () => {
    document.querySelectorAll('.anim-preset-btn').forEach(b => b.classList.remove('active'));
    updateAnimSettings();
  });
});

document.querySelectorAll('.anim-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => applyAnimPreset(btn.dataset.preset));
});

let animModalOpen = false;

function positionAnimModal(triggerEl) {
  const modal = document.getElementById('anim-customizer-modal');
  if (!modal) return;

  if (animModalOpen && modal.classList.contains('visible')) {
    closeAnimModal();
    return;
  }

  // Позиционируем рядом с кнопкой-триггером
  const rect = triggerEl.getBoundingClientRect();
  const modalW = 280, modalH = 300;
  let left = rect.right + 8;
  let top = rect.top;

  // Ограничиваем рамками viewport
  if (left + modalW > window.innerWidth - 10) left = rect.left - modalW - 8;
  if (top + modalH > window.innerHeight - 10) top = window.innerHeight - modalH - 10;
  if (top < 10) top = 10;
  if (left < 10) left = 10;

  modal.style.left = left + 'px';
  modal.style.top = top + 'px';
  modal.classList.add('visible');
  animModalOpen = true;
}

function closeAnimModal() {
  const modal = document.getElementById('anim-customizer-modal');
  if (modal) modal.classList.remove('visible');
  animModalOpen = false;
}

document.getElementById('anim-modal-close')?.addEventListener('click', closeAnimModal);
document.addEventListener('click', (e) => {
  const modal = document.getElementById('anim-customizer-modal');
  if (animModalOpen && modal && !modal.contains(e.target) && !e.target.closest('.bg-card-anim-btn')) {
    closeAnimModal();
  }
});


// ===== РЕДАКТОР КАСТОМНОЙ ТЕМЫ ЧАТА =====
const cteIds = ['bg','incoming','outgoing','accent','text'];
const cteVarMap = {
  bg: { vars: ['--tg-bg','--tg-surface','--tg-surface-light','--tg-surface-dark'], preview: '--cte-bg' },
  incoming: { vars: ['--tg-message-incoming'], preview: '--cte-incoming' },
  outgoing: { vars: ['--tg-message-outgoing'], preview: '--cte-outgoing' },
  accent: { vars: ['--tg-accent','--tg-accent-hover'], preview: null },
  text: { vars: ['--tg-text','--tg-message-incoming-text','--tg-message-outgoing-text'], preview: '--cte-text' },
};

cteIds.forEach(id => {
  const inp = document.getElementById('cte-' + id);
  const hex = document.getElementById('cte-' + id + '-hex');
  if (!inp) return;
  inp.addEventListener('input', () => {
    const val = inp.value;
    if (hex) hex.textContent = val;
    const preview = document.getElementById('cte-preview');
    if (cteVarMap[id].preview && preview) preview.style.setProperty(cteVarMap[id].preview, val);
  });
});

document.getElementById('apply-custom-theme-btn')?.addEventListener('click', () => {
  const root = document.getElementById('chat-overlay');
  if (!root) return;
  // Убираем все применённые классы темы чата
  root.className = root.className.replace(/\btheme-\S+/g,'').trim();
  // Применяем CSS-переменные к оверлею чата
  cteIds.forEach(id => {
    const inp = document.getElementById('cte-' + id);
    if (!inp) return;
    const val = inp.value;
    cteVarMap[id].vars.forEach(v => root.style.setProperty(v, val));
    // Также тонируем варианты surface для фона
    if (id === 'bg') {
      root.style.setProperty('--tg-surface', val + 'dd');
      root.style.setProperty('--tg-surface-light', val + 'bb');
      root.style.setProperty('--tg-surface-dark', val + 'ff');
    }
    if (id === 'accent') {
      root.style.setProperty('--tg-accent-hover', val + 'cc');
      root.style.setProperty('--tg-reply-indicator', val);
    }
  });
  // Обновляем активное состояние в сетке тем чата
  document.querySelectorAll('.chat-theme-card').forEach(c => c.classList.remove('active'));
  addChatLine('🎨 Кастомная тема применена!', 'chat-system');
});

document.getElementById('logout-btn').addEventListener('click', () => logout());
document.getElementById('logout-profile-btn').addEventListener('click', () => logout());

// Кнопка прикрепления файлов (изображения + файлы)
(function() {
  const attachBtn = document.getElementById('file-attach-btn');
  if (!attachBtn) return;
  // Создаём скрытый input — принимаем все типы файлов
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.html,.js,.json,.csv';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = (ev) => {
      fileInput.value = '';
      // Направляем в нужный контейнер по активной вкладке
      const isPrivate = document.getElementById('tab-private')?.classList.contains('active');
      const msgs = document.getElementById(isPrivate ? 'chat-private-messages' : 'chat-messages');
      if (!msgs) return;
      const div = document.createElement('div');
      div.className = 'chat-line chat-me';
      const now = new Date();
      const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
      if (isPrivate) {
        div.dataset.msgId = typeof _nextMsgId === 'function' ? _nextMsgId() : Date.now();
      } else {
        _assignGenMsgId(div);
      }
      if (isImage) {
        div.innerHTML = `<div class="chat-username">${MOCK_USER.display_name || MOCK_USER.username}</div><div class="chat-text"><img src="${ev.target.result}" style="max-width:260px;max-height:220px;border-radius:12px;display:block;margin-top:4px;cursor:pointer;" alt="${file.name}"></div><div class="chat-time">${t}</div>`;
      } else {
        const sizeStr = file.size < 1024 ? file.size + ' Б' : file.size < 1048576 ? (file.size/1024).toFixed(1) + ' КБ' : (file.size/1048576).toFixed(1) + ' МБ';
        div.innerHTML = `<div class="chat-username">${MOCK_USER.display_name || MOCK_USER.username}</div><div class="chat-text"><a href="${ev.target.result}" download="${file.name}" style="display:flex;align-items:center;gap:10px;background:rgba(135,116,225,0.1);border:1px solid rgba(135,116,225,0.25);border-radius:12px;padding:10px 14px;text-decoration:none;color:inherit;min-width:200px;max-width:260px;cursor:pointer;"><div style="width:36px;height:36px;border-radius:8px;background:rgba(135,116,225,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8774e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#e2e8f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</div><div style="font-size:10px;color:#8774e1;margin-top:3px;">Нажмите, чтобы скачать · ${sizeStr}</div></div></a></div><div class="chat-time">${t}</div>`;
      }
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      if (!isPrivate && typeof saveChatMessages === 'function') saveChatMessages();
    };
    reader.readAsDataURL(file);
    attachBtn.style.color = 'var(--tg-accent)';
    setTimeout(() => { attachBtn.style.color = ''; }, 800);
  });
})();

// Переключение звезды-курсора
document.getElementById('cursor-star-btn')?.addEventListener('click', () => {
  cursorStarEnabled = !cursorStarEnabled;
  cursorTrail = [];
  cursorStarVisible = false;
  const status = document.getElementById('cursor-star-status');
  const btn = document.getElementById('cursor-star-btn');
  if (status) status.textContent = cursorStarEnabled ? 'вкл' : 'выкл';
  if (btn) {
    btn.style.borderColor = cursorStarEnabled ? 'rgba(249,115,22,0.5)' : 'rgba(109,74,255,0.35)';
    btn.style.background = cursorStarEnabled ? 'rgba(249,115,22,0.12)' : 'rgba(109,74,255,0.1)';
    btn.style.color = cursorStarEnabled ? '#f97316' : '#a5b8f0';
  }
  // Синхронизация мобильного курсора убрана
});

// Переключение чата
document.getElementById('chat-header').addEventListener('click', () => {
  chatOverlay.classList.toggle('collapsed');
});

// Переключение панели магазина
document.getElementById('skin-header')?.addEventListener('click', () => {
  const panel = document.getElementById('skin-panel');
  const toggle = document.getElementById('skin-toggle');
  if (!panel) return;
  const isCollapsed = panel.classList.toggle('collapsed');
  if (!isCollapsed) {
    renderShop();
    const body = document.getElementById('skin-body');
    if (body) body.scrollTop = 0;
  }
});


// ===== КОНТЕКСТНОЕ МЕНЮ — правый клик по сообщениям: копирование, ответ, реакция, пересылка =====
let _ctxTarget = null;

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','⭐','👏'];

// Хранилище избранного (в памяти)
const favorites = [];

// Строим HTML контекстного меню
(function buildContextMenu() {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  menu.innerHTML = `
    <div class="context-menu-item" id="ctx-copy">
      <svg width="14" height="14"><use href="#icon-copy"/></svg> 
      Копировать
    </div>
    <div class="context-menu-item ctx-image-only" id="ctx-copy-image" style="display:none;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      Копировать изображение
    </div>
    <div class="context-menu-item ctx-image-only" id="ctx-save-image" style="display:none;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Сохранить изображение
    </div>
    <div class="context-menu-item" id="ctx-reply">
      <svg width="14" height="14"><use href="#icon-reply"/></svg> 
      Ответить
    </div>
    <div class="context-menu-item" id="ctx-forward">
      <svg width="14" height="14"><use href="#icon-send"/></svg> 
      Переслать
    </div>
    <div class="context-menu-item ctx-own-only" id="ctx-edit" style="display:none;color:#a78bfa;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 
        Редактировать
    </div>
    <div class="context-menu-item ctx-own-only" id="ctx-delete" style="display:none;color:#ef4444;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> 
        Удалить
    </div>
    <div class="ctx-divider" style="height:1px;background:rgba(109,74,255,0.12);margin:3px 4px;"></div>
    <div style="padding:4px 8px 6px;">
      <div style="font-size:10px;color:#4a6080;margin-bottom:5px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;">
        Реакция
        </div>
      <div id="ctx-reactions" style="display:flex;gap:3px;flex-wrap:wrap;">
        ${REACTION_EMOJIS.map(em => `<div class="ctx-reaction-btn" data-emoji="${em}">${em}</div>`).join('')}
      </div>
    </div>`;

  const style = document.createElement('style');
  style.textContent = `
    .ctx-reaction-btn {
      width:30px;height:30px;border-radius:8px;display:flex;align-items:center;
      justify-content:center;font-size:16px;cursor:pointer;
      transition:background 0.12s,transform 0.1s;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;
    }
    .ctx-reaction-btn:hover { background:rgba(109,74,255,0.2); transform:scale(1.2); }
    .msg-reactions { display:flex;flex-wrap:wrap;gap:3px;margin-top:5px; }
    .msg-reaction-chip {
      display:inline-flex;align-items:center;gap:3px;
      padding:2px 8px 2px 5px;border-radius:999px;
      background:rgba(109,74,255,0.1);border:1px solid rgba(109,74,255,0.2);
      font-size:14px;cursor:pointer;transition:all 0.12s;
      font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;
      user-select:none;
    }
    .msg-reaction-chip:hover { background:rgba(109,74,255,0.2); }
    .msg-reaction-chip.mine { background:rgba(109,74,255,0.22);border-color:rgba(109,74,255,0.5); }
    .msg-reaction-count { font-size:11px;font-weight:700;color:#8ba3f0;font-family:'Unbounded',sans-serif; }
  `;
  document.head.appendChild(style);
})();

function showContextMenu(e, msgEl) {
  e.preventDefault();
  e.stopPropagation();
  _ctxTarget = msgEl;
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  const isOwn = msgEl.classList.contains('chat-me');
  // Определяем, есть ли в сообщении изображение — пункты «Копировать/Сохранить
  // изображение» появляются только для image-сообщений
  const imgEl = msgEl.querySelector('.chat-text img');
  const hasImage = !!imgEl;
  // Если в сообщении только картинка без текста, скрываем стандартное «Копировать»
  const textContent = (msgEl.querySelector('.chat-text')?.textContent || '').trim();
  // «Редактировать» прячем для изображений — редактировать можно только текст
  document.getElementById('ctx-edit')  && (document.getElementById('ctx-edit').style.display   = (isOwn && !hasImage) ? 'flex' : 'none');
  document.getElementById('ctx-delete') && (document.getElementById('ctx-delete').style.display = isOwn ? 'flex' : 'none');
  document.getElementById('ctx-copy-image') && (document.getElementById('ctx-copy-image').style.display = hasImage ? 'flex' : 'none');
  document.getElementById('ctx-save-image') && (document.getElementById('ctx-save-image').style.display = hasImage ? 'flex' : 'none');
  document.getElementById('ctx-copy')   && (document.getElementById('ctx-copy').style.display       = textContent ? 'flex' : 'none');
  menu.style.display = 'block';
  // Высота меню зависит от количества видимых пунктов
  const ownRows = isOwn ? ((hasImage ? 0 : 1) /*edit*/ + 1 /*delete*/) : 0;
  const baseRows = (textContent ? 1 : 0) + 1 /*reply*/ + 1 /*forward*/ + ownRows;
  const imageRows = hasImage ? 2 : 0;
  const mw = 210;
  const mh = 70 /*реакции*/ + (baseRows + imageRows) * 32 + 12;
  let x = e.clientX;
  let top = e.clientY - mh - 6;
  if (top < 8) top = e.clientY + 8;
  if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
  if (x < 8) x = 8;
  menu.style.left = x + 'px';
  menu.style.top = top + 'px';
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  if (menu) menu.style.display = 'none';
  _ctxTarget = null;
}

// Привязываем контекстное меню к сообщениям через делегирование событий
['chat-messages','chat-private-messages'].forEach(id => {
  const container = document.getElementById(id);
  if (!container) return;
  container.addEventListener('contextmenu', e => {
    const line = e.target.closest('.chat-line:not(.chat-system)');
    if (!line) return;
    showContextMenu(e, line);
  });
});

// Привязываем контекстное меню к чату созвездий через делегирование
document.addEventListener('contextmenu', e => {
  const msgsCont = document.getElementById('con-chat-msgs');
  if (!msgsCont) return;
  const line = e.target.closest('#con-chat-msgs .chat-line:not(.chat-system)');
  if (!line) return;
  showContextMenu(e, line);
});

// Копирование
document.getElementById('ctx-copy')?.addEventListener('click', () => {
  if (!_ctxTarget) return;
  const text = _ctxTarget.querySelector('.chat-text')?.textContent || _ctxTarget.textContent;
  navigator.clipboard?.writeText(text).catch(() => {});
  hideContextMenu();
});

// Копирование/сохранение изображения — общие хелперы для контекстных меню чата
async function copyChatImageToClipboard(imgEl) {
  if (!imgEl || !imgEl.src) return false;
  try {
    const res = await fetch(imgEl.src);
    let blob = await res.blob();
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      canvas.getContext('2d').drawImage(bmp, 0, 0);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    }
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    }
  } catch (err) {
    console.warn('copy image failed:', err);
  }
  return false;
}

async function downloadChatImage(imgEl) {
  if (!imgEl || !imgEl.src) return;
  let url = imgEl.src;
  let revoke = false;
  let ext = 'png';
  try {
    const res = await fetch(imgEl.src);
    const blob = await res.blob();
    ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    url = URL.createObjectURL(blob);
    revoke = true;
  } catch (_) {
    // Фолбэк на прямой src (например data:URL) — сработает download-атрибут
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = (imgEl.alt && imgEl.alt.trim()) || `image-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Копировать изображение
document.getElementById('ctx-copy-image')?.addEventListener('click', async () => {
  if (!_ctxTarget) return;
  const img = _ctxTarget.querySelector('.chat-text img');
  hideContextMenu();
  if (img) await copyChatImageToClipboard(img);
});

// Сохранить изображение
document.getElementById('ctx-save-image')?.addEventListener('click', async () => {
  if (!_ctxTarget) return;
  const img = _ctxTarget.querySelector('.chat-text img');
  hideContextMenu();
  if (img) await downloadChatImage(img);
});

// Ответ
document.getElementById('ctx-reply')?.addEventListener('click', () => {
  if (!_ctxTarget) return;
  const username = _ctxTarget.querySelector('.chat-username')?.textContent || '';
  // Получаем текст из .chat-text, пропуская вложенный блок ответа
  const chatTextEl = _ctxTarget.querySelector('.chat-text');
  const text = chatTextEl ? chatTextEl.textContent.trim() : '';
  const preview = text.slice(0, 60) + (text.length > 60 ? '…' : '');
  const msgId = _ctxTarget.dataset.msgId || '';

  // Убеждаемся, что у сообщения есть ID (назначаем, если отсутствует)
  if (!_ctxTarget.dataset.msgId) {
    const newId = typeof _nextMsgId === 'function' ? _nextMsgId() : Date.now();
    _ctxTarget.dataset.msgId = newId;
  }
  const finalId = _ctxTarget.dataset.msgId;

  const isMobile = window.innerWidth <= 640;

  if (isMobile) {
    // Мобильный индикатор ответа
    const mobReplyEl = document.getElementById('mob-reply-indicator');
    const mobReplyText = document.getElementById('mob-reply-text');
    if (mobReplyEl && mobReplyText) {
      mobReplyText.innerHTML = `<strong style="color:#a78bfa">${username}:</strong> ${preview}`;
      mobReplyEl.classList.add('active');
      mobReplyEl.dataset.replyAuthor = username;
      mobReplyEl.dataset.replyQuote = preview;
      mobReplyEl.dataset.replyMsgId = finalId;
    }
    document.getElementById('mob-chat-input')?.focus();
  } else {
    // Десктопный индикатор ответа
    const replyEl = document.getElementById('reply-indicator');
    const replyText = document.getElementById('reply-text');
    if (replyEl && replyText) {
      replyText.innerHTML = `<svg width="12" height="12"><use href="#icon-reply"/></svg> <strong style="color:var(--tg-accent)">${username}:</strong> ${preview}`;
      replyEl.classList.add('active');
      replyEl.dataset.replyAuthor = username;
      replyEl.dataset.replyQuote = preview;
      replyEl.dataset.replyMsgId = finalId;
    }
    document.getElementById('chat-input')?.focus();
  }
  hideContextMenu();
});

// Отмена ответа (десктоп)
document.getElementById('reply-cancel')?.addEventListener('click', () => {
  const replyEl = document.getElementById('reply-indicator');
  if (replyEl) {
    replyEl.classList.remove('active');
    delete replyEl.dataset.replyAuthor;
    delete replyEl.dataset.replyQuote;
    delete replyEl.dataset.replyMsgId;
  }
});

// Отмена ответа (мобильные) — через делегирование событий для динамического DOM
document.addEventListener('click', (e) => {
  if (e.target.id === 'mob-reply-cancel' || e.target.closest('#mob-reply-cancel')) {
    const el = document.getElementById('mob-reply-indicator');
    if (el) {
      el.classList.remove('active');
      delete el.dataset.replyAuthor;
      delete el.dataset.replyQuote;
      delete el.dataset.replyMsgId;
    }
  }
});

// Переход к цитируемому сообщению по клику на блок ответа
document.addEventListener('click', (e) => {
  const block = e.target.closest('.chat-reply-block');
  if (!block) return;
  const targetId = block.dataset.jumpTo;
  if (!targetId) return;
  // Поиск во всех контейнерах сообщений, включая избранное
  const containers = ['chat-messages', 'chat-private-messages', 'chat-favorites-messages', 'mob-chat-messages', 'mob-private-messages'];
  let found = null;
  for (const cid of containers) {
    const c = document.getElementById(cid);
    if (!c) continue;
    found = c.querySelector(`[data-msg-id="${targetId}"]`) || c.querySelector(`[data-fav-id="${targetId}"]`);
    if (found) break;
  }
  if (!found) return;
  found.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Подсветка вспышкой
  found.style.transition = 'background 0.2s';
  const origBg = found.style.background;
  found.style.background = 'rgba(135,116,225,0.35)';
  setTimeout(() => { found.style.background = origBg; }, 1200);
});

// Переслать в избранное
document.getElementById('ctx-forward')?.addEventListener('click', () => {
  if (!_ctxTarget) return;
  const username = _ctxTarget.querySelector('.chat-username')?.textContent || 'Unknown';
  const text = _ctxTarget.querySelector('.chat-text')?.textContent || '';
  const time = _ctxTarget.querySelector('.chat-time')?.textContent || '';
  hideContextMenu();
  showForwardPicker({ username, text, time });
});

// Выбор получателя пересылки
function showForwardPicker(entry) {
  document.getElementById('_forward-picker-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = '_forward-picker-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:500;
    background:rgba(1,7,18,0.55);
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:_fpFadeIn 0.18s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes _fpFadeIn { from{opacity:0} to{opacity:1} }
    @keyframes _fpSlideIn { from{opacity:0;transform:scale(0.93) translateY(14px)} to{opacity:1;transform:scale(1) translateY(0)} }
    ._fp-item {
      display:flex;align-items:center;gap:10px;padding:10px 14px;
      border-radius:12px;cursor:pointer;transition:background 0.12s,border-color 0.12s;
      background:rgba(109,74,255,0.04);border:1px solid rgba(109,74,255,0.1);
    }
    ._fp-item:hover { background:rgba(109,74,255,0.13);border-color:rgba(109,74,255,0.28); }
    ._fp-item-icon {
      width:36px;height:36px;border-radius:10px;flex-shrink:0;
      display:flex;align-items:center;justify-content:center;font-size:18px;
    }
    ._fp-item-name { font-size:12px;font-weight:600;color:#c4cfe8; }
    ._fp-item-sub  { font-size:10px;color:#4a6080;margin-top:1px; }
    ._fp-divider   { font-size:9px;font-weight:700;color:#4a6080;text-transform:uppercase;letter-spacing:.06em;padding:6px 2px 4px;margin-top:4px; }
  `;
  document.head.appendChild(style);

  // Строим список получателей
  const destinations = [];

  // 1. Избранное (всегда первое, закреплено)
  destinations.push({
    type: 'favorites',
    icon: '⭐',
    iconBg: 'linear-gradient(135deg,rgba(251,191,36,0.25),rgba(249,115,22,0.15))',
    iconBorder: '1px solid rgba(251,191,36,0.3)',
    name: 'Избранное',
    sub: 'Личное пространство',
    group: null,
    pinned: true
  });

  // 2. Приватные чаты с известными пользователями (из MOCK_USERS, кроме себя)
  if (typeof MOCK_USERS !== 'undefined') {
    const friends = MOCK_USERS.filter(u => u.username !== MOCK_USER.username);
    friends.forEach(u => {
      destinations.push({
        type: 'private',
        icon: u.display_name.charAt(0).toUpperCase(),
        iconBg: `radial-gradient(circle at 30% 30%, ${u.star_color || '#7c3aed'}, rgba(0,0,0,0.3))`,
        iconBorder: `1px solid ${u.star_color || '#7c3aed'}55`,
        name: u.display_name,
        sub: '@' + u.username,
        username: u.username,
        color: u.star_color,
        group: 'private'
      });
    });
  }

  // 3. Созвездия (из localStorage)
  let conGroups = [];
  try { conGroups = JSON.parse(localStorage.getItem('star_sky_constellations_v2') || '[]'); } catch(e) {}
  conGroups.forEach(g => {
    destinations.push({
      type: 'constellation',
      icon: '✦',
      iconBg: 'linear-gradient(135deg,rgba(14,165,233,0.2),rgba(124,58,237,0.15))',
      iconBorder: '1px solid rgba(56,189,248,0.25)',
      name: g.name,
      sub: (g.members.length + 1) + ' участн.',
      groupId: g.id,
      group: 'constellation'
    });
  });

  // Блок предпросмотра
  const previewText = (entry.text || '').slice(0, 80) + (entry.text?.length > 80 ? '…' : '');

  // Строим HTML элементов
  let itemsHtml = '';
  let lastGroup = 'pinned';
  destinations.forEach(d => {
    const grp = d.pinned ? 'pinned' : d.group;
    if (grp !== lastGroup) {
      const labels = { private: 'Личные сообщения', constellation: 'Созвездия' };
      if (labels[grp]) itemsHtml += `<div class="_fp-divider">${labels[grp]}</div>`;
      lastGroup = grp;
    }
    itemsHtml += `
      <div class="_fp-item" data-fp-type="${d.type}" data-fp-username="${d.username||''}" data-fp-groupid="${d.groupId||''}">
        <div class="_fp-item-icon" style="background:${d.iconBg};border:${d.iconBorder};">${d.icon}</div>
        <div>
          <div class="_fp-item-name">${d.name}</div>
          <div class="_fp-item-sub">${d.sub}</div>
        </div>
      </div>`;
  });

  const modal = document.createElement('div');
  modal.style.cssText = `
    background:rgba(8,12,24,0.6);
    backdrop-filter:blur(32px) saturate(170%);-webkit-backdrop-filter:blur(32px) saturate(170%);
    border:1px solid rgba(109,74,255,0.22);border-radius:22px;
    box-shadow:0 32px 64px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.04);
    width:340px;max-width:calc(100vw - 32px);max-height:calc(100vh - 80px);
    display:flex;flex-direction:column;overflow:hidden;
    animation:_fpSlideIn 0.22s cubic-bezier(0.34,1.2,0.64,1);
  `;
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;border-bottom:1px solid rgba(109,74,255,0.1);flex-shrink:0;">
      <div>
        <div style="font-size:15px;font-weight:700;background:linear-gradient(135deg,#f8fafc,#c4b5fd);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">
          Переслать
          </div>
        <div style="font-size:10px;color:#4a6080;margin-top:2px;">Выберите куда переслать сообщение</div>
      </div>
      <button id="_fp-close" style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(109,74,255,0.2);background:rgba(109,74,255,0.08);color:#8ba3f0;cursor:pointer;
      display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">
      ×
      </button>
    </div>
    <div style="padding:10px 14px;border-bottom:1px solid rgba(109,74,255,0.08);flex-shrink:0;background:rgba(109,74,255,0.03);">
      <div style="font-size:10px;color:#4a6080;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">
        Сообщение
        </div>
      <div style="font-size:12px;color:#8ba3f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
        <span style="color:#6b84a8;">${entry.username}: </span>${previewText || '—'}
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:10px 12px 14px;display:flex;flex-direction:column;gap:4px;">
      ${itemsHtml}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.style.animation = '';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.15s';
    setTimeout(() => overlay.remove(), 160);
  };

  modal.querySelector('#_fp-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  modal.querySelectorAll('._fp-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.dataset.fpType;
      const savedAt = new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});

      if (type === 'favorites') {
        const favEntry = { username: entry.username, text: entry.text, time: entry.time, savedAt };
        if (typeof addToFavorites === 'function') addToFavorites(favEntry);
        else { favorites.push(favEntry); typeof renderFavoritesChat === 'function' && renderFavoritesChat(); }
        if (typeof showToast === 'function') showToast('⭐ Переслано в избранное');
      }
      else if (type === 'private') {
        const targetUsername = item.dataset.fpUsername;
        const fwdText = `↩ ${entry.username}: ${(entry.text||'').slice(0,80)}${(entry.text||'').length>80?'…':''}`;
        if (targetUsername && typeof privateChats !== 'undefined') {
          if (!privateChats[targetUsername]) privateChats[targetUsername] = [];
          const pmsg = {
            id: Date.now() + '_fwd_' + Math.random().toString(36).slice(2),
            text: fwdText,
            isMe: true,
            time: savedAt,
            ts: Date.now()
          };
          privateChats[targetUsername].push(pmsg);
          if (typeof savePrivateChats === 'function') savePrivateChats();
          // Если чат этого пользователя открыт — добавляем в реальном времени
          if (typeof currentPrivateUser !== 'undefined' && currentPrivateUser === targetUsername) {
            if (typeof appendPrivateMessage === 'function') appendPrivateMessage(pmsg, true);
          }
        }
        if (typeof showToast === 'function') showToast('💬 Переслано в личные');
      }
      else if (type === 'constellation') {
        const gId = item.dataset.fpGroupid;
        let conGroups2 = [];
        try { conGroups2 = JSON.parse(localStorage.getItem('star_sky_constellations_v2') || '[]'); } catch(e) {}
        const g = conGroups2.find(x => x.id === gId);
        if (g) {
          if (!g.messages) g.messages = [];
          const myName = (typeof appSettings !== 'undefined' && appSettings.displayName) || MOCK_USER.display_name || 'Пользователь';
          const now2 = new Date();
          const t2 = now2.getHours().toString().padStart(2,'0')+':'+now2.getMinutes().toString().padStart(2,'0');
          g.messages.push({
            id: Date.now(), author: myName,
            text: `↩ ${entry.username}: ${entry.text}`,
            time: t2, isMe: true, ts: Date.now()
          });
          try { localStorage.setItem('star_sky_constellations_v2', JSON.stringify(conGroups2)); } catch(e) {}
          // Если это созвездие открыто — добавляем в реальном времени
          const conMsgs = document.getElementById('con-chat-msgs');
          const conPanel = document.getElementById('con-panel');
          if (conMsgs && conPanel && conPanel.classList.contains('visible')) {
            const curActive = document.querySelector('#con-chat-view.visible');
            if (curActive) {
              const div = document.createElement('div');
              div.className = 'chat-line chat-me';
              div.innerHTML = `<div class="chat-username">${myName}</div><div class="chat-text">↩ ${entry.username}: ${(entry.text||'').slice(0,80)}</div><div class="chat-time">${t2}</div>`;
              conMsgs.appendChild(div);
              conMsgs.scrollTop = conMsgs.scrollHeight;
            }
          }
        }
        if (typeof showToast === 'function') showToast('✦ Переслано в созвездие');
      }

      close();
    });
  });
}

// Удаление своего сообщения
document.getElementById('ctx-delete')?.addEventListener('click', () => {
  if (!_ctxTarget) return;
  const el = _ctxTarget;
  hideContextMenu();
  el.style.transition = 'opacity 0.2s, transform 0.2s, max-height 0.25s';
  el.style.opacity = '0'; el.style.transform = 'scaleY(0.5)'; el.style.overflow = 'hidden';
  setTimeout(() => el.remove(), 250);
});

// Редактирование своего сообщения
document.getElementById('ctx-edit')?.addEventListener('click', () => {
  if (!_ctxTarget) return;
  const msgEl = _ctxTarget;
  hideContextMenu();
  if (msgEl.querySelector('.chat-edit-wrap')) return;
  const textEl = msgEl.querySelector('.chat-text');
  if (!textEl) return;
  const originalText = textEl.textContent;
  msgEl.style.outline = '2px solid rgba(135,116,225,0.7)';
  msgEl.style.outlineOffset = '2px';
  msgEl.style.borderRadius = '12px';
  const wrap = document.createElement('div');
  wrap.className = 'chat-edit-wrap';
  wrap.style.cssText = 'display:flex;align-items:flex-start;gap:5px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.1);';
  const inp = document.createElement('textarea');
  inp.value = originalText; inp.rows = 1;
  inp.style.cssText = 'flex:1;background:rgba(0,0,0,0.25);border:1px solid rgba(135,116,225,0.45);border-radius:10px;padding:6px 10px;color:inherit;font-family:"Unbounded",sans-serif;font-size:12px;outline:none;min-width:0;resize:none;overflow:hidden;line-height:1.4;';
  const autoResize = () => { inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; };
  inp.addEventListener('input', autoResize); setTimeout(autoResize, 0);
  const saveBtn = document.createElement('button');
  saveBtn.style.cssText = 'width:28px;height:28px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;background:rgba(135,116,225,0.85);color:#fff;display:flex;align-items:center;justify-content:center;';
  saveBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  const cancelBtn = document.createElement('button');
  cancelBtn.style.cssText = 'width:28px;height:28px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;background:rgba(255,255,255,0.08);color:#8e8e8e;display:flex;align-items:center;justify-content:center;';
  cancelBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  wrap.appendChild(inp); wrap.appendChild(saveBtn); wrap.appendChild(cancelBtn);
  msgEl.appendChild(wrap); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  function applyEdit() {
    const t = inp.value.trim();
    if (t && t !== originalText) {
      textEl.textContent = t;
      let mark = msgEl.querySelector('.chat-edited-mark');
      if (!mark) {
        mark = document.createElement('span');
        mark.className = 'chat-edited-mark';
        mark.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-left:4px;font-style:italic;';
        mark.textContent = ' изм.';
        const timeEl = msgEl.querySelector('.chat-time');
        if (timeEl) timeEl.appendChild(mark); else msgEl.appendChild(mark);
      }
      // Сохраняем в соответствующее хранилище
      const isInPrivateMessages = !!msgEl.closest('#chat-private-messages');
      const isInConChat = !!msgEl.closest('#con-chat-msgs');
      if (isInPrivateMessages && typeof currentPrivateUser !== 'undefined' && currentPrivateUser) {
        // Обновляем хранилище приватного чата
        const msgId = msgEl.dataset.msgId;
        if (msgId && privateChats[currentPrivateUser]) {
          const stored = privateChats[currentPrivateUser].find(m => m.id === msgId);
          if (stored) { stored.text = t; stored.edited = true; }
        }
        savePrivateChats();
      } else if (isInConChat) {
        // Чат созвездия — пока без хранилища, пропускаем
      } else {
        saveChatMessages();
      }
    }
    msgEl.style.outline = ''; wrap.remove();
  }
  function cancelEdit() { msgEl.style.outline = ''; wrap.remove(); }
  saveBtn.addEventListener('click', applyEdit);
  cancelBtn.addEventListener('click', cancelEdit);
  inp.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();applyEdit();} if(e.key==='Escape')cancelEdit(); });
});

// Хранилище реакций: переживают перезагрузку страницы
const REACTIONS_STORAGE_KEY = 'star_sky_reactions_v1';
let _reactionStore = {};
try {
  const _rr = localStorage.getItem(REACTIONS_STORAGE_KEY);
  if (_rr) _reactionStore = JSON.parse(_rr) || {};
} catch(e) { _reactionStore = {}; }

function _saveReactions() {
  try { localStorage.setItem(REACTIONS_STORAGE_KEY, JSON.stringify(_reactionStore)); } catch(e) {}
}

// Реакции для несохраняемых сообщений (общий чат) - живут только в рамках страницы
const _transientReactions = new WeakMap();

function _getReactionEntry(msgEl) {
  const key = msgEl.dataset.reactionKey;
  if (key) return { entry: _reactionStore[key] || null, persistent: true, key };
  return { entry: _transientReactions.get(msgEl) || null, persistent: false, key: null };
}

function _setReactionEntry(msgEl, entry) {
  const key = msgEl.dataset.reactionKey;
  if (key) {
    if (!entry || (!entry.mine && !Object.keys(entry.counts || {}).length)) {
      delete _reactionStore[key];
    } else {
      _reactionStore[key] = entry;
    }
    _saveReactions();
  } else {
    if (!entry || (!entry.mine && !Object.keys(entry.counts || {}).length)) {
      _transientReactions.delete(msgEl);
    } else {
      _transientReactions.set(msgEl, entry);
    }
  }
}

// Перерисовывает панель реакций в msgEl
function _renderReactionBar(msgEl) {
  const { entry } = _getReactionEntry(msgEl);
  let reactBar = msgEl.querySelector('.msg-reactions');

  const counts = (entry && entry.counts) || {};
  const emojis = Object.keys(counts).filter(em => counts[em] > 0);
  if (!emojis.length) {
    if (reactBar) reactBar.remove();
    return;
  }

  if (!reactBar) {
    reactBar = document.createElement('div');
    reactBar.className = 'msg-reactions';
    msgEl.appendChild(reactBar);
  }
  reactBar.innerHTML = '';
  emojis.forEach(em => {
    const chip = document.createElement('div');
    chip.className = 'msg-reaction-chip' + (entry && entry.mine === em ? ' mine' : '');
    chip.dataset.emoji = em;
    chip.innerHTML = `${em}<span class="msg-reaction-count">${counts[em]}</span>`;
    chip.addEventListener('click', () => addReactionToMessage(msgEl, em));
    reactBar.appendChild(chip);
  });
}

// Восстанавливает реакции на сообщении после рендера
function applyStoredReactions(msgEl) {
  if (!msgEl) return;
  _renderReactionBar(msgEl);
}

// Реакции — максимум 1 на сообщение (с заменой)
document.getElementById('ctx-reactions')?.addEventListener('click', e => {
  const btn = e.target.closest('.ctx-reaction-btn');
  if (!btn || !_ctxTarget) return;
  addReactionToMessage(_ctxTarget, btn.dataset.emoji);
  hideContextMenu();
});

function addReactionToMessage(msgEl, emoji) {
  const { entry: existing } = _getReactionEntry(msgEl);
  const entry = existing ? { mine: existing.mine, counts: { ...(existing.counts || {}) } } : { mine: null, counts: {} };

  if (entry.mine === emoji) {
    // Повторное нажатие той же реакции - снимаем свой голос
    entry.counts[emoji] = Math.max(0, (entry.counts[emoji] || 1) - 1);
    entry.mine = null;
  } else {
    // Смена реакции - уменьшаем счётчик предыдущей (если была)
    if (entry.mine) {
      entry.counts[entry.mine] = Math.max(0, (entry.counts[entry.mine] || 1) - 1);
    }
    entry.counts[emoji] = (entry.counts[emoji] || 0) + 1;
    entry.mine = emoji;
  }

  // Чистим нулевые счётчики
  Object.keys(entry.counts).forEach(em => {
    if (!entry.counts[em] || entry.counts[em] <= 0) delete entry.counts[em];
  });

  _setReactionEntry(msgEl, entry);
  _renderReactionBar(msgEl);
}

// Уведомление notification
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(12px);
      background:rgba(10,14,28,0.45);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(109,74,255,0.3);
      color:#c4cfe8;font-size:12px;font-family:'Unbounded',sans-serif;font-weight:500;
      padding:9px 18px;border-radius:999px;z-index:999;pointer-events:none;
      opacity:0;transition:opacity 0.18s ease,transform 0.18s ease;
      box-shadow:0 8px 24px rgba(0,0,0,0.6);backdrop-filter:blur(12px);`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(12px)';
  }, 2200);
}


// ===== ИЗБРАННОЕ - ЛИЧНОЕ ПРОСТРАНСТВО =====
const FAV_STORAGE_KEY = 'star_sky_favorites_v2';

// Загружаем сохранённые сообщения из localStorage
let favMessages = [];
(function loadFavMessages() {
  try {
    const raw = localStorage.getItem(FAV_STORAGE_KEY);
    if (raw) favMessages = JSON.parse(raw);
  } catch(e) { favMessages = []; }
})();

function saveFavMessages() {
  try { localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favMessages)); } catch(e) {}
}

function getFavDateLabel(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderFavoritesChat() {
  const container = document.getElementById('chat-favorites-messages');
  if (!container) return;
  container.innerHTML = '';
  // Старые favorites (пересланные из чата)
  const forwarded = favorites.map(f => ({
    id: 'fwd_' + Math.random(),
    type: 'forwarded',
    text: f.text,
    author: f.username,
    ts: Date.now(),
    time: f.savedAt,
    date: getFavDateLabel(Date.now())
  }));

  // Объединяем: сначала пересланные (если есть), потом личные
  const allMsgs = [...forwarded, ...favMessages].sort((a, b) => (a.ts || 0) - (b.ts || 0));

  if (allMsgs.length === 0) {
    const ph = document.createElement('div');
    ph.className = 'fav-empty-placeholder';
    ph.innerHTML = `
      <div class="fav-empty-icon"><svg width="32" height="32"><use href="#icon-star"/></svg></div>
      <div><strong style="color:#6b84a8;">Личное пространство</strong></div>
      <div>Пишите заметки, сохраняйте<br>фото и важные мысли.</div>
      <div style="font-size:10px;color:#2d3e55;">Только вы видите это пространство.<br>Правый клик на сообщение → «Переслать»</div>`;
    container.appendChild(ph);
    return;
  }

  let lastDate = '';
  allMsgs.forEach((msg) => {
    const dateLabel = msg.date || getFavDateLabel(msg.ts || Date.now());
    if (dateLabel !== lastDate) {
      lastDate = dateLabel;
      const div = document.createElement('div');
      div.className = 'fav-date-divider';
      div.textContent = dateLabel;
      container.appendChild(div);
    }

    // Стиль chat-line: пересланные = chat-other (слева), личные = chat-me (справа)
    const isForwarded = msg.type === 'forwarded';
    const line = document.createElement('div');
    line.className = 'chat-line ' + (isForwarded ? 'chat-other' : 'chat-me');
    line.dataset.favId = msg.id;
    line.dataset.msgId = msg.id;
    line.dataset.reactionKey = 'fav:' + msg.id;

    const replyBlock = (msg.replyAuthor && msg.replyQuote)
      ? `<div class="chat-reply-block" data-jump-to="${msg.replyMsgId || ''}"><div class="chat-reply-author">↩ ${msg.replyAuthor}</div><div class="chat-reply-text">${msg.replyQuote}</div></div>`
      : '';

    let bodyContent = '';
    if (isForwarded) {
      bodyContent = `<div style="font-size:10px;color:#8ba3f0;margin-bottom:3px;opacity:0.8;">↩ от ${msg.author || 'Чат'}</div>${msg.text || ''}`;
    } else if (msg.image) {
      bodyContent = `<img src="${msg.image}" alt="фото" style="max-width:100%;max-height:200px;border-radius:8px;display:block;margin-top:2px;">`;
    } else {
      bodyContent = msg.text || '';
    }

    line.innerHTML = `
      <div class="chat-username">${isForwarded ? (msg.author || 'Чат') : 'Я'}</div>
      ${replyBlock}
      <div class="chat-text">${bodyContent}</div>
      <div class="chat-time">${msg.time || ''}</div>`;

    line.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      showFavContextMenu(e, msg, line);
    });
    container.appendChild(line);
    if (typeof applyStoredReactions === 'function') applyStoredReactions(line);
  });
  // Прокрутка вниз после рендера
  requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
}

// Устаревший алиас
function renderFavorites() { renderFavoritesChat(); }

// Контекстное меню для избранного (копирование + удаление + редактирование)
function showFavContextMenu(e, msg, lineEl) {
  const isPersonal = msg.type !== 'forwarded';
  let menu = document.getElementById('fav-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'fav-context-menu';
    menu.className = 'context-menu';
    menu.style.cssText = 'display:none;position:fixed;z-index:300;';
    document.body.appendChild(menu);
  }
  // Изображение в карточке избранного — для image-only пунктов меню
  const favImgEl = lineEl?.querySelector('.chat-text img') || null;
  const hasFavImage = !!favImgEl;
  const favHasText = !!(msg.text && msg.text.trim());
  menu.innerHTML = `
    <div class="context-menu-item" id="fav-ctx-reply">
      <svg width="14" height="14"><use href="#icon-reply"/></svg> 
      Ответить
    </div>
    ${(isPersonal && !hasFavImage) ? `
    <div class="context-menu-item" id="fav-ctx-edit">
      <svg width="14" height="14"><use href="#icon-edit"/></svg> 
      Редактировать
    </div>` : ''}
    ${favHasText ? `
    <div class="context-menu-item" id="fav-ctx-copy">
      <svg width="14" height="14"><use href="#icon-copy"/></svg> 
      Копировать
    </div>` : ''}
    ${hasFavImage ? `
    <div class="context-menu-item" id="fav-ctx-copy-image">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      Копировать изображение
    </div>
    <div class="context-menu-item" id="fav-ctx-save-image">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Сохранить изображение
    </div>` : ''}
    <div class="ctx-divider" style="height:1px;background:rgba(109,74,255,0.12);margin:3px 4px;"></div>
    <div class="context-menu-item" id="fav-ctx-delete" style="color:#ef4444;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg> 
        Удалить
    </div>`;
  menu.style.display = 'block';
  const _favRows = 1 /*reply*/ + ((isPersonal && !hasFavImage) ? 1 : 0) + (favHasText ? 1 : 0) + (hasFavImage ? 2 : 0) + 1 /*delete*/;
  const mw = 210, mh = _favRows * 32 + 16;
  let x = e.clientX;
  let top = e.clientY - mh - 6;
  if (top < 8) top = e.clientY + 8;
  if (x + mw > window.innerWidth - 8) x = window.innerWidth - mw - 8;
  if (x < 8) x = 8;
  menu.style.left = x + 'px';
  menu.style.top = top + 'px';

  const closeFavMenu = () => { menu.style.display = 'none'; };

  // Ответ - fills fav-reply-indicator exactly like main chat
  menu.querySelector('#fav-ctx-reply').addEventListener('click', () => {
    closeFavMenu();
    const txt = msg.text ? msg.text.slice(0, 80) + (msg.text.length > 80 ? '…' : '') : '📷 Фото';
    const from = msg.author ? `@${msg.author}` : 'Я';
    const favReplyEl = document.getElementById('fav-reply-indicator');
    const favReplyText = document.getElementById('fav-reply-text');
    if (favReplyEl && favReplyText) {
      favReplyText.innerHTML = `<svg width="12" height="12"><use href="#icon-reply"/></svg> <strong style="color:var(--tg-accent)">${from}:</strong> ${txt}`;
      favReplyEl.classList.add('active');
      favReplyEl.dataset.replyAuthor = from;
      favReplyEl.dataset.replyQuote = txt;
      favReplyEl.dataset.replyMsgId = msg.id || '';
    }
    document.getElementById('fav-input')?.focus();
  }, { once: true });

  // Редактирование — инлайн-редактирование только для личных текстовых сообщений
  if (isPersonal && !hasFavImage) {
    menu.querySelector('#fav-ctx-edit')?.addEventListener('click', () => {
      closeFavMenu();
      if (lineEl.querySelector('.fav-edit-wrap')) return;
      const textEl = lineEl.querySelector('.chat-text');
      if (!textEl) return;
      const originalText = textEl.textContent;
      lineEl.style.outline = '2px solid rgba(135,116,225,0.7)';
      lineEl.style.outlineOffset = '2px';
      lineEl.style.borderRadius = '12px';
      const wrap = document.createElement('div');
      wrap.className = 'fav-edit-wrap';
      wrap.style.cssText = 'display:flex;align-items:flex-start;gap:5px;margin-top:5px;padding-top:5px;border-top:1px solid rgba(255,255,255,0.1);';
      const inp = document.createElement('textarea');
      inp.value = originalText; inp.rows = 1;
      inp.style.cssText = 'flex:1;background:rgba(0,0,0,0.25);border:1px solid rgba(135,116,225,0.45);border-radius:10px;padding:6px 10px;color:inherit;font-family:"Unbounded",sans-serif;font-size:12px;outline:none;min-width:0;resize:none;overflow:hidden;line-height:1.4;';
      const autoResize = () => { inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; };
      inp.addEventListener('input', autoResize); setTimeout(autoResize, 0);
      const saveBtn = document.createElement('button');
      saveBtn.style.cssText = 'width:28px;height:28px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;background:rgba(135,116,225,0.85);color:#fff;display:flex;align-items:center;justify-content:center;';
      saveBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      const cancelBtn = document.createElement('button');
      cancelBtn.style.cssText = 'width:28px;height:28px;border-radius:8px;border:none;cursor:pointer;flex-shrink:0;background:rgba(255,255,255,0.08);color:#8e8e8e;display:flex;align-items:center;justify-content:center;';
      cancelBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      wrap.appendChild(inp); wrap.appendChild(saveBtn); wrap.appendChild(cancelBtn);
      lineEl.appendChild(wrap); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);

      function applyFavEdit() {
        const t = inp.value.trim();
        if (t && t !== originalText) {
          textEl.textContent = t;
          // Обновляем в хранилище
          const stored = favMessages.find(m => m.id === msg.id);
          if (stored) { stored.text = t; saveFavMessages(); }
          // Помечаем как отредактировано
          let mark = lineEl.querySelector('.chat-edited-mark');
          if (!mark) {
            mark = document.createElement('span');
            mark.className = 'chat-edited-mark';
            mark.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-left:4px;font-style:italic;';
            mark.textContent = ' изм.';
            const timeEl = lineEl.querySelector('.chat-time');
            if (timeEl) timeEl.appendChild(mark); else lineEl.appendChild(mark);
          }
        }
        lineEl.style.outline = ''; wrap.remove();
      }
      function cancelFavEdit() { lineEl.style.outline = ''; wrap.remove(); }
      saveBtn.addEventListener('click', applyFavEdit);
      cancelBtn.addEventListener('click', cancelFavEdit);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); applyFavEdit(); } if (e.key === 'Escape') cancelFavEdit(); });
    }, { once: true });
  }

  menu.querySelector('#fav-ctx-copy')?.addEventListener('click', () => {
    const text = msg.text || lineEl.querySelector('.chat-text')?.textContent || '';
    navigator.clipboard?.writeText(text.trim()).catch(() => {});
    closeFavMenu();
  }, { once: true });

  menu.querySelector('#fav-ctx-copy-image')?.addEventListener('click', async () => {
    closeFavMenu();
    if (favImgEl) await copyChatImageToClipboard(favImgEl);
  }, { once: true });

  menu.querySelector('#fav-ctx-save-image')?.addEventListener('click', async () => {
    closeFavMenu();
    if (favImgEl) await downloadChatImage(favImgEl);
  }, { once: true });

  menu.querySelector('#fav-ctx-delete').addEventListener('click', () => {
    if (msg.type === 'forwarded') {
      const fi = favorites.findIndex(f => f.savedAt === msg.time && f.username === msg.author);
      if (fi >= 0) favorites.splice(fi, 1);
      renderFavoritesChat();
    } else {
      favMessages = favMessages.filter(m => m.id !== msg.id);
      saveFavMessages();
      lineEl.style.transition = 'opacity 0.2s';
      lineEl.style.opacity = '0';
      setTimeout(() => lineEl.remove(), 210);
    }
    closeFavMenu();
  }, { once: true });

  const outsideClick = (ev) => {
    if (!menu.contains(ev.target)) {
      closeFavMenu();
      document.removeEventListener('click', outsideClick);
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClick), 10);
}

// Добавление пересланного сообщения в избранное (старый API)
function addToFavorites(entry) {
  favorites.push(entry);
  renderFavoritesChat();
  if (typeof window.renderMobFavorites === 'function') window.renderMobFavorites();
  showToast('✦ Сохранено в избранное');
}

// Отправка личного сообщения в избранное
function sendFavMessage(text, imageData, replyAuthor, replyQuote, replyMsgId) {
  if (!text && !imageData) return;
  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const msg = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
    type: 'personal',
    text: text || '',
    image: imageData || null,
    replyAuthor: replyAuthor || '',
    replyQuote: replyQuote || '',
    replyMsgId: replyMsgId || '',
    ts: Date.now(),
    time,
    date: getFavDateLabel(Date.now())
  };
  favMessages.push(msg);
  saveFavMessages();

  const container = document.getElementById('chat-favorites-messages');
  if (container) {
    const ph = container.querySelector('.fav-empty-placeholder');
    if (ph) ph.remove();

    // Стиль chat-line для личных сообщений
    const line = document.createElement('div');
    line.className = 'chat-line chat-me';
    line.dataset.favId = msg.id;
    line.dataset.msgId = msg.id;
    const rb = (msg.replyAuthor && msg.replyQuote)
      ? `<div class="chat-reply-block" data-jump-to="${msg.replyMsgId}"><div class="chat-reply-author">↩ ${msg.replyAuthor}</div><div class="chat-reply-text">${msg.replyQuote}</div></div>`
      : '';
    const body = msg.image
      ? `<img src="${msg.image}" alt="фото" style="max-width:100%;max-height:200px;border-radius:8px;display:block;margin-top:2px;">`
      : msg.text;
    line.innerHTML = `<div class="chat-username">Я</div>${rb}<div class="chat-text">${body}</div><div class="chat-time">${time}</div>`;
    line.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      showFavContextMenu(e, msg, line);
    });
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }
}

// Закрытие контекстного меню
document.addEventListener('click', e => {
  const menu = document.getElementById('context-menu');
  if (menu && menu.style.display !== 'none' && !menu.contains(e.target)) hideContextMenu();
});
document.addEventListener('contextmenu', e => {
  const line = e.target.closest('.chat-line:not(.chat-system)');
  if (!line) { e.preventDefault(); hideContextMenu(); }
});


// ===== ПЕРЕКЛЮЧЕНИЕ ТАБОВ ЧАТА =====
function switchChatTab(tab) {
  document.getElementById('tab-public')?.classList.toggle('active', tab === 'public');
  document.getElementById('tab-private')?.classList.toggle('active', tab === 'private');
  document.getElementById('tab-favorites')?.classList.toggle('active', tab === 'favorites');

  // Высота overlay
  const co = document.getElementById('chat-overlay');
  if (co) {
    co.style.maxHeight = '';
    co.style.height = (typeof appSettings !== 'undefined' && appSettings.chatHeight)
      ? appSettings.chatHeight + 'px' : '';
  }

  // Видимость блоков
  const elPublic = document.getElementById('chat-messages');
  const elPrivate = document.getElementById('chat-private-pane');
  const elFav = document.getElementById('chat-favorites-pane');
  const elAuTitle = document.getElementById('active-users-title');
  const elAuDiv = document.getElementById('active-users');
  const elInputRow = document.getElementById('chat-input-row');

  if (elPublic) elPublic.style.display = tab === 'public' ? 'flex' : 'none';
  if (elPrivate) elPrivate.style.display = tab === 'private' ? 'flex' : 'none';
  if (elFav) elFav.style.display = tab === 'favorites' ? 'flex' : 'none';
  if (elAuTitle) elAuTitle.style.display = tab === 'public' ? '' : 'none';
  if (elAuDiv) elAuDiv.style.display = tab === 'public' ? '' : 'none';

  // Строка ввода
  if (elInputRow) {
    elInputRow.style.display = (tab === 'favorites' || tab === 'private') ? 'none' : '';
  }

  // При входе в приватный таб
  if (tab === 'private') {
    if (currentPrivateUser) {
      _pm_showChat(currentPrivateUser);
    } else {
      _pm_showList();
    }
  }

  // Сброс лейбла таба при уходе в публичный
  if (tab === 'public') {
    _pm_setTabLabel(null);
    const inp = document.getElementById('chat-input');
    if (inp) inp.placeholder = 'Напишите сообщение...';
  }
}

document.getElementById('tab-public')?.addEventListener('click', () => switchChatTab('public'));
document.getElementById('tab-private')?.addEventListener('click', () => switchChatTab('private'));
document.getElementById('tab-favorites')?.addEventListener('click', () => {
  switchChatTab('favorites');
  if (typeof renderFavoritesChat === 'function') renderFavoritesChat();
});


// ===== ПРИВАТНЫЙ ЧАТ =====
const PM_STORAGE_KEY = 'star_sky_private_msgs_v1';
const PM_LAST_USER_KEY = 'star_sky_private_last_user_v1';
const PM_PINNED_KEY = 'star_sky_private_pinned_v1';

let privateChats = {};
let currentPrivateUser = null;
let pinnedChats = new Set();

// Загрузка из localStorage
(function _pm_load() {
  try { const r = localStorage.getItem(PM_STORAGE_KEY); if (r) privateChats = JSON.parse(r); } catch(e) { privateChats = {}; }
  try { const r = localStorage.getItem(PM_LAST_USER_KEY); if (r && privateChats[r]) currentPrivateUser = r; } catch(e) {}
  try { const r = localStorage.getItem(PM_PINNED_KEY); if (r) pinnedChats = new Set(JSON.parse(r)); } catch(e) {}
})();

function savePrivateChats() {
  // Сохраняем личные сообщения только для реального авторизованного пользователя
  if (typeof _isRealUser === 'function' && !_isRealUser()) return;
  try { localStorage.setItem(PM_STORAGE_KEY, JSON.stringify(privateChats)); } catch(e) {}
}
function _pm_savePinned() {
  try { localStorage.setItem(PM_PINNED_KEY, JSON.stringify([...pinnedChats])); } catch(e) {}
}
function _pm_saveLastUser() {
  try {
    if (currentPrivateUser) localStorage.setItem(PM_LAST_USER_KEY, currentPrivateUser);
    else localStorage.removeItem(PM_LAST_USER_KEY);
  } catch(e) {}
}

// Получение данных пользователя
function getPrivateUserInfo(username) {
  const u = (typeof MOCK_USERS !== 'undefined' ? MOCK_USERS : []).find(x => x.username === username);
  return u || { username, display_name: username, star_color: '#6d4aff', active: false };
}

// Лейбл таба
function _pm_setTabLabel(displayName) {
  const privTab = document.getElementById('tab-private');
  if (!privTab) return;
  if (displayName) {
    privTab.innerHTML = `<svg width="16" height="16" style="flex-shrink:0"><use href="#icon-user"/></svg><span> ${displayName}</span>`;
  } else {
    privTab.innerHTML = `<svg width="16" height="16" style="flex-shrink:0"><use href="#icon-user"/></svg><span id="tab-private-label"> Приватный</span>`;
  }
}

// Показать список диалогов
function _pm_showList() {
  const listView = document.getElementById('pm-list-view');
  const chatView = document.getElementById('pm-chat-view');
  if (listView) listView.style.display = 'flex';
  if (chatView) chatView.style.display = 'none';
  const ir = document.getElementById('chat-input-row');
  if (ir) ir.style.display = 'none';
  _pm_renderList();
}

// Показать конкретный диалог
function _pm_showChat(username) {
  const u = getPrivateUserInfo(username);
  const color = u.star_color || '#6d4aff';

  const listView = document.getElementById('pm-list-view');
  const chatView = document.getElementById('pm-chat-view');
  if (listView) listView.style.display = 'none';
  if (chatView) chatView.style.display = 'flex';

  const avatarEl = document.getElementById('pm-chat-avatar');
  const nameEl = document.getElementById('pm-chat-name');
  const handleEl = document.getElementById('pm-chat-handle');
  const statusEl = document.getElementById('pm-chat-status');

  if (avatarEl) {
    avatarEl.textContent = u.display_name.charAt(0).toUpperCase();
    avatarEl.style.background = `radial-gradient(circle at 35% 35%, ${color}cc, ${color}44)`;
  }
  if (nameEl) nameEl.textContent = u.display_name;
  if (handleEl) handleEl.textContent = '@' + u.username;
  if (statusEl) {
    statusEl.textContent = u.active ? '● онлайн' : '● офлайн';
    statusEl.className = u.active ? 'online' : 'offline';
  }

  const ir = document.getElementById('chat-input-row');
  if (ir) ir.style.display = '';
  const inp = document.getElementById('chat-input');
  if (inp) {
    inp.placeholder = `Написать ${u.display_name}…`;
    setTimeout(() => inp.focus(), 60);
  }

  _pm_setTabLabel(u.display_name);
  _pm_renderMessages(username);
}


function _pm_renderList() {
  const listEl = document.getElementById('pm-list-body');
  if (!listEl) return;
  listEl.innerHTML = '';

  const all = Object.keys(privateChats);
  if (!all.length) {
    listEl.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon">💬</div>Нет диалогов.<br>Откройте карточку звезды,<br>чтобы начать переписку.</div>`;
    return;
  }

  // Сортируем: закреплённые первые, затем по времени последнего сообщения
  const pinned = all.filter(u => pinnedChats.has(u));
  const normal = all.filter(u => !pinnedChats.has(u));

  const sortByTime = arr => arr.slice().sort((a, b) => {
    const ta = (privateChats[a]?.slice(-1)[0]?.ts) || 0;
    const tb = (privateChats[b]?.slice(-1)[0]?.ts) || 0;
    return tb - ta;
  });

  const renderSection = (users, label) => {
    if (!users.length) return;
    if (label) {
      const lbl = document.createElement('div');
      lbl.className = 'pm-section-label';
      lbl.textContent = label;
      listEl.appendChild(lbl);
    }
    sortByTime(users).forEach(un => _pm_renderItem(listEl, un));
  };

  renderSection(pinned, pinned.length ? 'Закреплённые' : null);
  renderSection(normal, pinned.length ? '💬 Все диалоги' : null);
}

function _pm_renderItem(listEl, un) {
  const u = getPrivateUserInfo(un);
  const msgs = privateChats[un] || [];
  const last = msgs[msgs.length - 1];
  const isPinned = pinnedChats.has(un);
  const preview = last
    ? (last.isMe ? '➤ ' : '') + (last.text.length > 28 ? last.text.slice(0, 28) + '…' : last.text)
    : 'Нет сообщений';
  const color = u.star_color || '#6d4aff';

  const isMuted = isPmUserMuted(un);

  const item = document.createElement('div');
  item.className = 'pm-item';
  if (isPinned) item.style.borderColor = 'rgba(109,74,255,0.25)';
  if (isMuted) item.dataset.muted = '1';

  item.innerHTML = `
    <div class="pm-item-avatar" style="background:radial-gradient(circle at 35% 35%,${color}cc,${color}44);border:1px solid ${color}44;">
      ${u.display_name.charAt(0).toUpperCase()}
      ${isMuted ? '<div class="pm-item-muted-mark">🔇</div>' : ''}
      <div class="pm-item-dot ${u.active ? 'on' : 'off'}"></div>
    </div>
    <div class="pm-item-info">
      <div class="pm-item-name">${u.display_name}${isPinned ? ' <span class="pm-item-pin-mark"><svg width="16" height="16"><use href="#icon-pin"/></svg></span>' : ''}</div>
      <div class="pm-item-preview">${preview}</div>
    </div>
    <div class="pm-item-actions">
      <button class="pm-item-action-btn pm-pin-btn${isPinned ? ' pin-active' : ''}" title="${isPinned ? 'Открепить' : 'Закрепить'}"><svg width="16" height="16"><use href="#icon-pin"/></svg></button>
      <button class="pm-item-action-btn mute pm-mute-btn${isMuted ? ' mute-active' : ''}" title="${isMuted ? 'Включить уведомления' : 'Заглушить'}"><svg width="16" height="16"><use href="#icon-volumeoff"/></svg></button>
      <button class="pm-item-action-btn del pm-del-btn" title="Удалить переписку"><svg width="16" height="16"><use href="#icon-trash"/></svg></button>
    </div>
    ${last ? `<div class="pm-item-time">${last.time || ''}</div>` : ''}
  `;

  // Клик по основной части - открываем чат
  item.addEventListener('click', e => {
    if (e.target.closest('.pm-item-actions')) return;
    currentPrivateUser = un;
    _pm_saveLastUser();
    if (!privateChats[un]) privateChats[un] = [];
    _pm_showChat(un);
  });

  // Кнопка заглушить/включить
  item.querySelector('.pm-mute-btn').addEventListener('click', e => {
    e.stopPropagation();
    togglePmUserMute(un);
    _pm_renderList();
  });

  // Кнопка закрепить/открепить
  item.querySelector('.pm-pin-btn').addEventListener('click', e => {
    e.stopPropagation();
    if (pinnedChats.has(un)) pinnedChats.delete(un);
    else pinnedChats.add(un);
    _pm_savePinned();
    _pm_renderList();
  });

  // Кнопка удалить
  item.querySelector('.pm-del-btn').addEventListener('click', e => {
    e.stopPropagation();
    _pm_confirmDelete(un);
  });

  listEl.appendChild(item);
}

// Диалог подтверждения удаления
let _pm_deleteTarget = null;

function _pm_confirmDelete(username) {
  _pm_deleteTarget = username;
  const u = getPrivateUserInfo(username);
  const nameEl = document.getElementById('pm-confirm-username');
  if (nameEl) nameEl.textContent = u.display_name;
  const overlay = document.getElementById('pm-confirm-overlay');
  if (overlay) overlay.classList.add('visible');
}

function _pm_closeConfirm() {
  _pm_deleteTarget = null;
  const overlay = document.getElementById('pm-confirm-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function _pm_executeDelete() {
  const un = _pm_deleteTarget;
  if (!un) return;
  _pm_closeConfirm();

  // Удаляем переписку
  delete privateChats[un];
  pinnedChats.delete(un);
  savePrivateChats();
  _pm_savePinned();

  // Если удаляем открытый чат - возвращаемся в список
  if (currentPrivateUser === un) {
    currentPrivateUser = null;
    _pm_saveLastUser();
    _pm_setTabLabel(null);
    const inp = document.getElementById('chat-input');
    if (inp) inp.placeholder = 'Напишите сообщение...';
  }
  _pm_showList();

  // Уведомление
  if (typeof showToast === 'function') showToast('🗑️ Переписка удалена');
}

// Обработчики кнопок модалки
function _pm_initConfirmHandlers() {
  const cancelBtn = document.getElementById('pm-confirm-cancel');
  const okBtn = document.getElementById('pm-confirm-ok');
  const overlay = document.getElementById('pm-confirm-overlay');
  if (cancelBtn && !cancelBtn._pmHandlerAdded) {
    cancelBtn.addEventListener('click', _pm_closeConfirm);
    cancelBtn._pmHandlerAdded = true;
  }
  if (okBtn && !okBtn._pmHandlerAdded) {
    okBtn.addEventListener('click', _pm_executeDelete);
    okBtn._pmHandlerAdded = true;
  }
  if (overlay && !overlay._pmHandlerAdded) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _pm_closeConfirm();
    });
    overlay._pmHandlerAdded = true;
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _pm_initConfirmHandlers);
} else {
  _pm_initConfirmHandlers();
}

// Кнопка удаления в шапке открытого диалога
document.getElementById('pm-delete-btn')?.addEventListener('click', () => {
  if (currentPrivateUser) _pm_confirmDelete(currentPrivateUser);
});


function _pm_renderMessages(username) {
  const container = document.getElementById('chat-private-messages');
  if (!container) return;
  container.innerHTML = '';

  const history = privateChats[username] || [];
  if (!history.length) {
    const ph = document.createElement('div');
    ph.style.cssText = 'text-align:center;padding:28px 12px;color:#3d5473;font-size:11px;line-height:2;';
    ph.innerHTML = '<div style="font-size:24px;margin-bottom:8px;opacity:0.4">💬</div>Начало переписки';
    container.appendChild(ph);
    return;
  }

  history.forEach(m => _pm_appendMsg(m, false));
  container.scrollTop = container.scrollHeight;
}

// Добавить одно сообщение
function appendPrivateMessage(msg, scroll) { _pm_appendMsg(msg, scroll); }

function _pm_appendMsg(msg, scroll) {
  const container = document.getElementById('chat-private-messages');
  if (!container) return;

  const u = msg.isMe
    ? ((typeof appSettings !== 'undefined' && appSettings.displayName) || 'Вы')
    : getPrivateUserInfo(currentPrivateUser || msg.username || '').display_name;

  const editedMark = msg.edited
    ? '<span class="chat-edited-mark" style="font-size:9px;color:rgba(255,255,255,0.4);margin-left:4px;font-style:italic;"> изм.</span>'
    : '';

  const div = document.createElement('div');
  div.className = 'chat-line ' + (msg.isMe ? 'chat-me' : 'chat-other');
  const _pmId = msg.id || Date.now();
  div.dataset.msgId = _pmId;
  div.dataset.reactionKey = 'pm:' + (currentPrivateUser || '') + ':' + _pmId;
  div.innerHTML = `<div class="chat-username">${u}</div><div class="chat-text">${msg.text}</div><div class="chat-time">${msg.time}${editedMark}</div>`;
  div.addEventListener('contextmenu', e => { if (typeof showContextMenu === 'function') showContextMenu(e, div); });
  container.appendChild(div);
  if (typeof applyStoredReactions === 'function') applyStoredReactions(div);
  if (scroll) container.scrollTop = container.scrollHeight;

  // Уведомление о входящем сообщении (с проверкой на мьют)
  if (!msg.isMe) {
    const senderUsername = currentPrivateUser || msg.username || '';
    const isMuted = typeof isPmUserMuted === 'function' && isPmUserMuted(senderUsername);
    if (!isMuted) {
      if (typeof window.addNotification === 'function') {
        window.addNotification('message', u, (msg.text || '').slice(0, 80));
      }
    }
  }
}

// Отправить сообщение
function sendPrivateMessage(text) {
  if (!text || !currentPrivateUser) return;
  const now = new Date();
  const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  const msg = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2),
    text, isMe: true, time, ts: Date.now()
  };
  if (!privateChats[currentPrivateUser]) privateChats[currentPrivateUser] = [];
  privateChats[currentPrivateUser].push(msg);
  savePrivateChats();
  _pm_appendMsg(msg, true);
}

// Кнопка Назад
document.getElementById('pm-back-btn')?.addEventListener('click', () => {
  currentPrivateUser = null;
  _pm_saveLastUser();
  _pm_setTabLabel(null);
  const inp = document.getElementById('chat-input');
  if (inp) inp.placeholder = 'Напишите сообщение...';
  _pm_showList();
});

// Инициализация при загрузке
(function _pm_init() {
  function _doInit() {
    if (currentPrivateUser) {
      _pm_setTabLabel(getPrivateUserInfo(currentPrivateUser).display_name);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _doInit);
  else setTimeout(_doInit, 50);
})();


// ===== ЕДИНАЯ ТОЧКА ВХОДА - открыть приватный чат с пользователем =====
function openPrivateChat(username) {
  if (!privateChats[username]) privateChats[username] = [];
  currentPrivateUser = username;
  _pm_saveLastUser();

  const conPanel = document.getElementById('con-panel');
  if (conPanel) conPanel.classList.remove('visible');
  document.getElementById('tab-constellation')?.classList.remove('active');

  const co = document.getElementById('chat-overlay');
  if (co && co.classList.contains('collapsed')) co.classList.remove('collapsed');

  switchChatTab('private');
}

// Экспортируем глобально
window.openPrivateChat = openPrivateChat;

// Инициализация поля ввода избранного
(function initFavInput() {
  const input = document.getElementById('fav-input');
  const sendBtn = document.getElementById('fav-send');
  const attachBtn = document.getElementById('fav-attach-btn');
  const fileInput = document.getElementById('fav-file-input');
  const emojiBtnFav = document.getElementById('fav-emoji-btn');

  if (!input || !sendBtn) return;

  // Отмена ответа в избранном
  document.getElementById('fav-reply-cancel')?.addEventListener('click', () => {
    const ri = document.getElementById('fav-reply-indicator');
    if (ri) {
      ri.classList.remove('active');
      delete ri.dataset.replyAuthor;
      delete ri.dataset.replyQuote;
      delete ri.dataset.replyMsgId;
    }
  });

  function doSend() {
    const text = input.value.trim();
    if (!text) return;
    const favReplyEl = document.getElementById('fav-reply-indicator');
    const replyAuthor = favReplyEl?.dataset?.replyAuthor || '';
    const replyQuote = favReplyEl?.dataset?.replyQuote || '';
    const replyMsgId = favReplyEl?.dataset?.replyMsgId || '';
    if (favReplyEl) {
      favReplyEl.classList.remove('active');
      delete favReplyEl.dataset.replyAuthor;
      delete favReplyEl.dataset.replyQuote;
      delete favReplyEl.dataset.replyMsgId;
    }
    sendFavMessage(text, null, replyAuthor, replyQuote, replyMsgId);
    input.value = '';
    input.focus();
  }

  sendBtn.addEventListener('click', doSend);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
  });

  // Прикрепление файла
  attachBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = ev => { fileInput.value = ''; sendFavMessage('', ev.target.result); };
      reader.readAsDataURL(file);
    } else {
      fileInput.value = '';
      sendFavMessage(`📎 ${file.name} (${(file.size / 1024).toFixed(1)} КБ)`, null);
    }
  });

  // Эмодзи - перемещаем пикер в body, чтобы не скрывался вместе с chat-input-row
  emojiBtnFav.addEventListener('click', e => {
    e.stopPropagation();
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    if (emojiPickerOpen && picker.dataset.favTarget === '1') {
      closeEmojiPicker();
      return;
    }
    if (emojiPickerOpen) closeEmojiPicker();
    if (!picker._favOrigParent) picker._favOrigParent = picker.parentElement;
    document.body.appendChild(picker);
    picker.dataset.favTarget = '1';
    delete picker.dataset.mobTarget;
    openEmojiPicker();
    requestAnimationFrame(() => {
      const btnRect = emojiBtnFav.getBoundingClientRect();
      const pickerW = picker.offsetWidth || 300;
      const pickerH = picker.offsetHeight || 340;
      let left = btnRect.right - pickerW;
      let top = btnRect.top - pickerH - 8;
      if (left < 8) left = 8;
      if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
      if (top < 8) top = btnRect.bottom + 8;
      picker.style.position = 'fixed';
      picker.style.left = left + 'px';
      picker.style.top = top + 'px';
      picker.style.zIndex = '400';
    });
  });
})();

// Отправка сообщения
document.getElementById('chat-send').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });


// ЭМОДЗИ-ПИКЕР
const EMOJI_CATS = {
  smileys: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😙','😚','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🫡','🤫','🤔','🫠','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😔','😪','🤤','😴','🥱','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥸','😎','🧐','🤓','😭','😢','😟','😤','😠','😡','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  gestures: ['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','🫦'],
  hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💔','🫀','♥️','💟','❣️','💌','💋','🥰','😍','😘'],
  nature: ['🌱','🌿','🍀','🌲','🌳','🌴','🌵','🎋','🎍','🍁','🍂','🍃','🪷','🌸','🌺','🌻','🌹','🥀','🌷','🌼','💐','🍄','🪸','🐚','🌾','🌏','🌍','🌎','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌙','🌚','🌛','🌜','☀️','🌝','⭐','🌟','💫','✨','⚡','☄️','🌈','🌤','⛅','🌦','🌧','⛈','🌩','🌨','❄️','☃️','⛄','🌬','💨','🌪','🌫','🌊','🌀'],
  food: ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🍳','🧇','🥞','🧈','🍞','🥐','🥖','🫓','🥨','🥯','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🥮','🍡','🥟','🥠','🥡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','☕','🫖','🧋','🥤','🍵','🍶','🥛','🍼','🫗','🍺','🍻','🥂','🍷','🫙'],
  travel: ['✈️','🛫','🛬','🛩','💺','🚀','🛸','🚁','🛶','⛵','🚤','🛥','🛳','⛴','🚢','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕','🚖','🚗','🚙','🛻','🚚','🚛','🚜','🏎','🏍','🛵','🛺','🚲','🛴','🛹','🛼','🚏','🛣','🛤','⛽','🛞','🚦','🚥','🗺','🧭','🏔','⛰','🌋','🏕','🏖','🏜','🏝','🏛','🏗','🏘','🏚','🏠','🏡','🏢','🏣','🏤','🏥','🗼','🗽'],
  objects: ['💡','🔦','🕯','🪔','💰','💳','💎','⚖️','🔑','🗝','🔐','🔒','🔓','🚪','🪑','🛋','🪞','🖥','💻','🖨','⌨️','🖱','📱','☎️','📟','📺','📷','📸','🎥','📽','🎞','📞','📠','📡','🔬','🔭','🧬','🩺','🩻','💊','🩹','🩼','🪄','🎩','🎭','🎪','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🪕','🎻','🎲','♟','🎯','🎱','🎮','🕹','🎰','🧩','🎈','🎉','🎊','🎀','🎁','🪩'],
  symbols: ['✨','💥','🔥','🌊','💫','⭐','🌟','✅','❌','❓','❗','💢','💬','💭','💤','🔔','🔕','🎵','🎶','🔇','🔈','🔉','🔊','📣','📢','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸','🔹','🔺','🔻','💠','🔘','🔲','🔳','▪️','▫️','◾','◽','◼️','◻️','🏁','🚩','🎌','🏴','🏳','🔱','📛','🎗','🏅','🥇','🥈','🥉','🏆','🎖','🎗'],
};

let currentEmojiCat = 'smileys';
let emojiPickerOpen = false;

function renderEmojiGrid(emojis) {
  const grid = document.getElementById('emoji-grid');
  if (!grid) return;
  grid.innerHTML = '';
  emojis.forEach(em => {
    const cell = document.createElement('div');
    cell.className = 'emoji-cell';
    cell.title = em;
    cell.textContent = em;
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      const picker = document.getElementById('emoji-picker');
      const isMobTarget = picker && picker.dataset.mobTarget === '1';
      const isFavTarget = picker && picker.dataset.favTarget === '1';
      const isConTarget = picker && picker.dataset.conTarget === '1';
      let inp;
      if (isFavTarget) {
        inp = document.getElementById('fav-input');
      } else if (isConTarget) {
        inp = document.getElementById('con-chat-inp');
      } else if (isMobTarget) {
        inp = document.getElementById('mob-chat-input');
      } else {
        inp = document.getElementById('chat-input');
      }
      if (inp) {
        const pos = inp.selectionStart ?? inp.value.length;
        inp.value = inp.value.slice(0, pos) + em + inp.value.slice(pos);
        inp.selectionStart = inp.selectionEnd = pos + [...em].length;
        inp.focus();
      }
    });
    grid.appendChild(cell);
  });
}

function openEmojiPicker() {
  emojiPickerOpen = true;
  const picker = document.getElementById('emoji-picker');
  picker.classList.add('visible');
  renderEmojiGrid(EMOJI_CATS[currentEmojiCat]);
  const searchEl = document.getElementById('emoji-search');
  if (searchEl) {
    searchEl.value = '';
    // Фокус только на десктопе — на мобильных это открывает клавиатуру и скрывает пикер
    if (window.innerWidth > 640) searchEl.focus();
  }
}
function closeEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  if (picker) {
    // Возвращаем в исходный родитель (mobile, fav или созвездие перенесли его в body)
    const origParent = picker._origParent || picker._favOrigParent || picker._conOrigParent;
    if (origParent && picker.parentElement === document.body) {
      origParent.appendChild(picker);
    }
    delete picker._origParent;
    delete picker._favOrigParent;
    delete picker._conOrigParent;
    delete picker.dataset.mobTarget;
    delete picker.dataset.favTarget;
    delete picker.dataset.conTarget;
    picker.style.cssText = '';
  }
  emojiPickerOpen = false;
  document.getElementById('emoji-picker')?.classList.remove('visible');
}

document.getElementById('emoji-btn')?.addEventListener('click', (e) => {
  e.stopPropagation();
  if (emojiPickerOpen) { closeEmojiPicker(); return; }
  openEmojiPicker();
  // Умное позиционирование: если пикер выходит за правый край — выравниваем влево
  const picker = document.getElementById('emoji-picker');
  const row = document.getElementById('chat-input-row');
  if (picker && row) {
    const rowRect = row.getBoundingClientRect();
    const pickerW = 300;
    // По умолчанию right:0 (выровнен вправо). Проверяем, не выходит ли за левый край.
    if (rowRect.right - pickerW < 0) {
      picker.style.right = 'auto';
      picker.style.left = '0';
    } else {
      picker.style.right = '0';
      picker.style.left = 'auto';
    }
  }
});

document.querySelectorAll('.emoji-cat-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    currentEmojiCat = btn.dataset.cat;
    document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === currentEmojiCat));
    document.getElementById('emoji-search').value = '';
    renderEmojiGrid(EMOJI_CATS[currentEmojiCat]);
  });
});

// Карта названий эмодзи для поиска
const EMOJI_NAMES = {
  '😀':'grinning smile смех улыбка',
  '😃':'smiley smile смайл',
  '😄':'smile радость smiling',
  '😁':'grin ухмылка teeth',
  '😆':'laughing laughing смех',
  '😅':'sweat nervous нервный',
  '🤣':'rofl rolling floor смех',
  '😂':'joy tears cry смех слёзы',
  '🙂':'slightly smile слегка',
  '😊':'blush смущение happy',
  '😇':'innocent ангел angel',
  '🥰':'love hearts любовь влюблённый',
  '😍':'heart eyes eyes любовь',
  '🤩':'star excited восторг',
  '😘':'kiss поцелуй love',
  '😋':'yum вкусно tongue',
  '😛':'tongue язык',
  '😜':'wink tongue подмигивание',
  '🤪':'crazy zany безумный',
  '😝':'tongue squinting гримаса',
  '😎':'sunglasses cool крутой',
  '🤓':'nerd nerdy умник очки',
  '🤗':'hug обнять hugging',
  '🤔':'think thinking думать',
  '🤫':'shush тихо silence',
  '😐':'neutral нейтральный',
  '😑':'expressionless deadpan',
  '😏':'smirk ухмылка',
  '😒':'unamused недовольный',
  '🙄':'eye roll закатить глаза',
  '😬':'grimace нервный grin',
  '😔':'pensive грустный sad',
  '😪':'sleepy сонный tired',
  '😴':'sleeping спать sleep',
  '🥱':'yawn зевать bored',
  '😷':'mask маска sick больной',
  '🤒':'sick fever больной',
  '🤕':'hurt injured травма',
  '🤢':'nausea тошнота sick',
  '🤮':'vomiting рвота sick',
  '🤧':'sneeze чихать cold',
  '🥵':'hot жарко overheating',
  '🥶':'cold холодно freezing',
  '🥴':'woozy dizzy head',
  '😵':'dizzy головокружение',
  '🤯':'mind blown взрыв мозга',
  '🤠':'cowboy ковбой hat',
  '😈':'devil дьявол evil злой',
  '👿':'angry devil злой',
  '💀':'skull череп death смерть',
  '☠️':'skull crossbones пират death',
  '💩':'poop какашка',
  '🤡':'clown клоун',
  '👻':'ghost призрак',
  '👽':'alien инопланетянин',
  '🤖':'robot робот',
  '😭':'crying cry плакать рыдать tears',
  '😢':'cry tears слеза грустить',
  '😟':'worried тревога',
  '😤':'steam frustrated',
  '😠':'angry злой mad',
  '😡':'rage ярость anger',
  '🤬':'cursing мат swearing',
  '👋':'wave привет hello рука',
  '🤚':'raised back hand рука стоп',
  '✋':'stop стоп raised hand',
  '🖖':'vulcan star trek',
  '👌':'ok окей perfect',
  '✌️':'peace victory победа мир',
  '🤞':'lucky fingers удача',
  '🤟':'love you рок',
  '🤘':'rock sign рок',
  '🤙':'call me позвони',
  '👈':'point left влево указать',
  '👉':'point right вправо указать',
  '👆':'point up вверх указать',
  '👇':'point down вниз указать',
  '👍':'thumbs up лайк like',
  '👎':'thumbs down dislike дизлайк',
  '✊':'raised fist кулак',
  '👊':'punch удар',
  '👏':'clap аплодисменты хлопать',
  '🙌':'raise hands ура celebrate',
  '🤲':'palms up ладони',
  '🤝':'handshake рукопожатие',
  '🙏':'pray молиться thanks спасибо',
  '💪':'muscle сила strong мышца',
  '👀':'eyes глаза watch смотреть',
  '🫶':'heart hands любовь сердце',
  '❤️':'heart red love красное сердце любовь',
  '🧡':'orange heart оранжевый',
  '💛':'yellow heart жёлтый',
  '💚':'green heart зелёный',
  '💙':'blue heart синий',
  '💜':'purple heart фиолетовый',
  '🖤':'black heart чёрный',
  '🤍':'white heart белый',
  '🤎':'brown heart коричневый',
  '💕':'two hearts два сердца love',
  '💞':'revolving hearts любовь',
  '💓':'beating heart биение',
  '💗':'growing heart рост',
  '💖':'sparkling heart блеск',
  '💘':'arrow heart стрела',
  '💝':'ribbon heart бант',
  '💔':'broken heart разбитое сердце',
  '❤️‍🔥':'fire heart огонь страсть',
  '🌱':'seedling plant росток растение',
  '🌿':'herb grass трава зелень',
  '🍀':'clover клевер lucky',
  '🌲':'evergreen tree ёлка',
  '🌳':'tree дерево forest',
  '🌴':'palm tree пальма',
  '🌵':'cactus кактус',
  '🌸':'cherry blossom сакура цветок',
  '🌺':'hibiscus flower цветок',
  '🌻':'sunflower подсолнух',
  '🌹':'rose роза',
  '🥀':'wilted flower вялый',
  '🌷':'tulip тюльпан',
  '🌼':'daisy ромашка',
  '💐':'bouquet букет цветы',
  '🍁':'maple leaf клён осень',
  '🍂':'leaves autumn листья осень',
  '🍃':'leaves листья green',
  '🍄':'mushroom гриб',
  '🌙':'moon lunar луна ночь night',
  '⭐':'star звезда',
  '🌟':'glowing star сверкающая звезда',
  '💫':'dizzy star кружок',
  '✨':'sparkles блеск sparkling',
  '⚡':'lightning молния bolt',
  '🔥':'fire огонь flame пожар hot',
  '🌊':'wave волна water море ocean',
  '❄️':'snowflake снежинка winter зима',
  '☃️':'snowman снеговик',
  '⛄':'snowman снеговик',
  '🌈':'rainbow радуга colorful',
  '☀️':'sun sunny солнце',
  '🌧':'rain дождь rainy',
  '⛈':'thunderstorm гроза',
  '🌪':'tornado tornado вихрь',
  '💨':'wind ветер breeze',
  '🌍':'earth world земля глобус',
  '🪐':'planet планета saturn',
  '🍕':'pizza пицца',
  '🍔':'burger hamburger бургер',
  '🍟':'fries chips картошка',
  '🌭':'hotdog хотдог',
  '🍿':'popcorn попкорн cinema',
  '🥐':'croissant круассан',
  '🍞':'bread хлеб',
  '🥖':'baguette багет',
  '🧀':'cheese сыр',
  '🥚':'egg яйцо',
  '🍳':'frying egg жарить',
  '🥓':'bacon бекон',
  '🍗':'chicken leg курица',
  '🍖':'meat мясо',
  '🌮':'taco тако',
  '🌯':'wrap ролл',
  '🥗':'salad салат',
  '🍣':'sushi суши roll',
  '🍜':'noodles лапша ramen',
  '🍝':'pasta паста spaghetti',
  '🍛':'curry карри',
  '🍚':'rice рис',
  '🍱':'bento box lunch',
  '🍰':'cake slice торт',
  '🎂':'birthday cake торт день рождения',
  '🧁':'cupcake кекс',
  '🍩':'donut пончик',
  '🍪':'cookie печенье',
  '🍫':'chocolate шоколад',
  '🍬':'candy конфета sweet',
  '🍭':'lollipop леденец',
  '🍦':'ice cream мороженое',
  '☕':'coffee кофе hot',
  '🧋':'bubble tea boba чай',
  '🍵':'tea чай green',
  '🧃':'juice сок',
  '🥛':'milk молоко',
  '🍺':'beer пиво',
  '🥂':'champagne шампанское toast',
  '🍷':'wine вино',
  '🍸':'cocktail коктейль',
  '🥤':'drink напиток cup',
  '🍎':'apple яблоко red',
  '🍊':'orange апельсин citrus',
  '🍋':'lemon лимон citrus',
  '🍇':'grapes виноград',
  '🍓':'strawberry клубника berry',
  '🍑':'peach персик',
  '🍒':'cherry вишня',
  '🍌':'banana банан',
  '🍉':'watermelon арбуз',
  '🍍':'pineapple ананас',
  '🥑':'avocado авокадо',
  '🥕':'carrot морковь vegetable',
  '🌽':'corn кукуруза maize',
  '🌶':'chili pepper перец острый',
  '✈️':'airplane самолёт fly полёт',
  '🚀':'rocket ракета space космос',
  '🛸':'ufo нло flying saucer',
  '🚁':'helicopter вертолёт',
  '🚗':'car машина автомобиль',
  '🚕':'taxi такси',
  '🚌':'bus автобус',
  '🚂':'train поезд locomotive',
  '🚢':'ship корабль cruise',
  '⛵':'sailboat парусник',
  '🏠':'house дом home',
  '🏢':'office building офис',
  '🏪':'store магазин shop',
  '🏖':'beach пляж summer',
  '🏔':'mountain гора',
  '🌋':'volcano вулкан',
  '🏕':'camping кемпинг tent',
  '🗼':'tower башня tokyo',
  '🗽':'statue liberty свобода',
  '💡':'idea idea лампочка идея light',
  '🔦':'flashlight фонарь',
  '🔑':'key ключ',
  '🔒':'lock замок closed',
  '🔓':'unlock открыть',
  '🚪':'door дверь',
  '📱':'phone телефон mobile',
  '💻':'laptop ноутбук computer',
  '🖥':'desktop компьютер',
  '⌨️':'keyboard клавиатура',
  '🖱':'mouse мышь',
  '📷':'camera камера photo фото',
  '🎥':'video camera видео',
  '📺':'tv television телевизор',
  '📻':'radio радио',
  '📡':'satellite спутник',
  '🔬':'microscope микроскоп',
  '🔭':'telescope телескоп',
  '🔔':'bell звонок notification уведомление',
  '🔕':'mute bell тихо',
  '📚':'books книги study учёба',
  '📖':'book книга read читать',
  '📝':'memo write писать заметка',
  '✉️':'envelope letter письмо email',
  '📩':'inbox входящие',
  '📤':'outbox исходящие send',
  '🗑':'trash bin мусор',
  '📌':'pushpin pin прикрепить',
  '🎵':'music note нота musical',
  '🎶':'music notes ноты мелодия',
  '🎸':'guitar гитара music',
  '🎹':'piano keyboard пианино',
  '🥁':'drums барабаны',
  '🎷':'saxophone саксофон jazz',
  '🎺':'trumpet труба brass',
  '🎻':'violin скрипка',
  '🎤':'microphone mic микрофон',
  '🎧':'headphones наушники audio',
  '🎮':'game controller игра gaming геймер',
  '🕹':'joystick джойстик arcade',
  '🎯':'bullseye target мишень цель',
  '🎲':'dice кубик игра random',
  '🃏':'card карта joker',
  '🏆':'trophy кубок cup победа winner',
  '🥇':'gold medal first gold золото',
  '🥈':'silver medal second серебро',
  '🥉':'bronze third medal бронза',
  '🏅':'medal медаль award',
  '🎖':'military medal',
  '🎗':'ribbon лента',
  '🎁':'gift present подарок',
  '🎉':'party праздник celebrate ура',
  '🎊':'confetti конфетти',
  '🎈':'balloon воздушный шар',
  '🎀':'bow ribbon бант',
  '💰':'money cash деньги',
  '💳':'card credit bank карта',
  '💎':'diamond алмаз jewel',
  '👑':'crown корона king queen',
  '💄':'lipstick губная помада',
  '💍':'ring кольцо',
  '🪄':'magic wand волшебная палочка',
  '🔮':'crystal ball предсказание',
  '🧸':'teddy bear медведь игрушка',
  '🪩':'disco ball дискотека',
  '✨':'sparkles блеск shine',
  '💥':'explosion взрыв boom',
  '💢':'anger злость',
  '💬':'speech bubble dialog сообщение',
  '💭':'thought думать мысль',
  '💤':'sleep zzz спать',
  '❌':'x cross нет no wrong',
  '✅':'check да yes ok галочка',
  '❓':'question mark вопрос',
  '❗':'exclamation exclaim восклицание',
  '⚠️':'warning caution внимание',
  '🚫':'no prohibited запрет нельзя',
  '🆒':'cool крутой',
  '🆕':'new новый',
  '💯':'100 hundred perfect сто',
  '🔴':'red circle красный',
  '🟠':'orange circle оранжевый',
  '🟡':'yellow circle жёлтый',
  '🟢':'green circle зелёный',
  '🔵':'blue circle синий',
  '🟣':'purple circle фиолетовый',
  '⚫':'black circle чёрный',
  '⚪':'white circle белый',
  '♾️':'infinity бесконечность',
};

// Поиск эмодзи — в реальном времени, работает с русскими и английскими ключевыми словами
function searchEmojis(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) {
    renderEmojiGrid(EMOJI_CATS[currentEmojiCat]);
    return;
  }
  const words = q.split(' ').filter(Boolean);
  const scored = [];
  Object.entries(EMOJI_NAMES).forEach(function(entry) {
    const em = entry[0], name = entry[1];
    let score = 0;
    words.forEach(function(w) {
      if (name === q) score += 100;
      else if (name.startsWith(w)) score += 30;
      else if (name.includes(w)) score += 15;
    });
    if (score > 0) scored.push({ em: em, score: score });
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  var res = scored.map(function(x) { return x.em; });
  renderEmojiGrid(res.length ? res.slice(0, 80) : []);
}

(function() {
  var emojiSearchEl = document.getElementById('emoji-search');
  if (!emojiSearchEl) return;
  emojiSearchEl.addEventListener('input', function() {
    searchEmojis(emojiSearchEl.value);
  });
  emojiSearchEl.addEventListener('keydown', function(e) {
    e.stopPropagation();
  });
})();

document.addEventListener('click', (e) => {
  const picker = document.getElementById('emoji-picker');
  if (!emojiPickerOpen || !picker) return;
  // Не закрываем, если клик по самой панели эмодзи
  if (picker.contains(e.target)) return;
  // Не закрываем, если клик по любой из кнопок-источников эмодзи (обычный чат, созвездия, избранное, моб.)
  const sources = ['emoji-btn','con-emoji-btn','fav-emoji-btn','mob-emoji-btn'];
  for (const id of sources) {
    const b = document.getElementById(id);
    if (b && b.contains(e.target)) return;
  }
  closeEmojiPicker();
});

let msgCount = 0;
let _msgIdCounter = 0;

function _nextMsgId() {
  _msgIdCounter++;
  return 'm_' + Date.now().toString(36) + '_' + _msgIdCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}
// Устанавливает и msgId, и ключ реакций на элементе сообщения общего чата
function _assignGenMsgId(div, id) {
  const mid = id || _nextMsgId();
  div.dataset.msgId = mid;
  div.dataset.reactionKey = 'gen:' + mid;
  return mid;
}
function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  // Направляем в приватный чат, если активна приватная вкладка и выбран пользователь
  const isPrivate = document.getElementById('tab-private')?.classList.contains('active');
  if (isPrivate) {
    if (typeof currentPrivateUser !== 'undefined' && currentPrivateUser) {
      input.value = '';
      sendPrivateMessage(text);
    }
    return;
  }

  input.value = '';
  const now = new Date();
  const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const msgs = document.getElementById('chat-messages');
  // Читаем контекст ответа
  const replyEl = document.getElementById('reply-indicator');
  const replyAuthor = replyEl?.dataset?.replyAuthor || '';
  const replyQuote = replyEl?.dataset?.replyQuote || '';
  const replyMsgId = replyEl?.dataset?.replyMsgId || '';
  const replyBlock = (replyAuthor && replyQuote)
    ? `<div class="chat-reply-block" data-jump-to="${replyMsgId}"><div class="chat-reply-author">↩ ${replyAuthor}</div><div class="chat-reply-text">${replyQuote}</div></div>`
    : '';
  // Очищаем индикатор ответа
  if (replyEl) {
    replyEl.classList.remove('active');
    delete replyEl.dataset.replyAuthor;
    delete replyEl.dataset.replyQuote;
    delete replyEl.dataset.replyMsgId;
  }
  const div = document.createElement('div');
  div.className = 'chat-line chat-me';
  _assignGenMsgId(div);
  const displayName = MOCK_USER.display_name || MOCK_USER.username || 'Я';
  div.innerHTML = `<div class="chat-username">${displayName}</div>${replyBlock}<div class="chat-text">${text}</div><div class="chat-time">${t}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  msgCount++;
  saveChatMessages();
  // Отправляем на сервер
  API.sendMessage(text, replyMsgId || null).then(serverMsg => {
    if (serverMsg && serverMsg.id) {
      div.dataset.msgId = serverMsg.id;
      if (serverMsg.new_balance !== undefined) {
        animateBalance(serverMsg.new_balance);
      }
      // Прогресс задания "5 сообщений в день"
      fetch('/api/tasks/progress/daily_message', { method:'POST', headers: API._headers() })
        .then(r => r.json()).then(d => { if (d && d.success) loadTasks(); }).catch(() => {});
    }
  });
}


// ===== СОХРАНЕНИЕ ЧАТА В localStorage =====
const CHAT_STORAGE_KEY = 'star_sky_chat_v1';
const CHAT_MAX_MESSAGES = 200;

function serializeChatMsg(div) {
  const username = div.querySelector('.chat-username')?.textContent || '';
  const textEl = div.querySelector('.chat-text');
  const time = div.querySelector('.chat-time')?.textContent?.replace(' изм.','').trim() || '';
  const edited = !!div.querySelector('.chat-edited-mark');
  const isMe = div.classList.contains('chat-me');
  const msgId = div.dataset.msgId || '';
  // Изображение или текст
  const img = textEl?.querySelector('img');
  const video = textEl?.querySelector('video');
  let content = '', contentType = 'text';
  if (img) { content = img.src; contentType = 'image'; }
  else if (video) { content = video.src; contentType = 'video'; }
  else content = textEl?.innerHTML || '';
  return { username, content, contentType, time, edited, isMe, msgId };
}

// Возвращает true только если в localStorage есть реальный (не тестовый) авторизованный пользователь
function _isRealUser() {
  try {
    const raw = localStorage.getItem('star_sky_current_user');
    if (!raw) return false;
    const u = JSON.parse(raw);
    // Реальный пользователь имеет login, который не является заглушкой
    return !!(u && u.login && u.login !== MOCK_USER.username && u.login !== 'demo');
  } catch(e) { return false; }
}

(function _clearTestUserData() {
  if (_isRealUser()) return;
  try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch(e) {}
  try { localStorage.removeItem('star_sky_private_msgs_v1'); } catch(e) {}
  try { localStorage.removeItem('star_sky_private_last_user_v1'); } catch(e) {}
  if (typeof privateChats !== 'undefined') { privateChats = {}; }
  if (typeof currentPrivateUser !== 'undefined') { currentPrivateUser = null; }
})();

function saveChatMessages() {
  // Общий чат сохраняется только для реальных пользователей; для тестовых/demo
  // сообщения не должны переживать перезагрузку
  if (!_isRealUser()) return;
  try {
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    const arr = [];
    msgs.querySelectorAll('.chat-line:not(.chat-system)').forEach(div => {
      const m = serializeChatMsg(div);
      if (m.msgId) arr.push(m);
    });
    // Ограничиваем количество сохраняемых сообщений.
    const trimmed = arr.slice(-CHAT_MAX_MESSAGES);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch(e) {}
}

function loadChatMessages() {
  // Для тестовых пользователей ничего не грузим - пусть рендерятся свежие MOCK_MESSAGES.
  if (!_isRealUser()) return false;
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !data.length) return false;
    const msgs = document.getElementById('chat-messages');
    if (!msgs) return false;
    msgs.innerHTML = '';
    data.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-line ' + (m.isMe ? 'chat-me' : 'chat-other');
      if (m.msgId) {
        div.dataset.msgId = m.msgId;
        div.dataset.reactionKey = 'gen:' + m.msgId;
      }
      let contentHtml = '';
      if (m.contentType === 'image') {
        contentHtml = `<img src="${m.content}" style="max-width:260px;max-height:220px;border-radius:12px;display:block;margin-top:4px;cursor:pointer;" alt="image">`;
      } else if (m.contentType === 'video') {
        contentHtml = `<video src="${m.content}" controls style="max-width:260px;border-radius:12px;display:block;margin-top:4px;"></video>`;
      } else {
        contentHtml = m.content;
      }
      const editedMark = m.edited ? '<span class="chat-edited-mark" style="font-size:9px;color:rgba(255,255,255,0.4);margin-left:4px;font-style:italic;"> изм.</span>' : '';
      div.innerHTML = `<div class="chat-username">${m.username}</div><div class="chat-text">${contentHtml}</div><div class="chat-time">${m.time}${editedMark}</div>`;
      msgs.appendChild(div);
      if (typeof applyStoredReactions === 'function') applyStoredReactions(div);
    });
    msgs.scrollTop = msgs.scrollHeight;
    return true;
  } catch(e) { return false; }
}


// ===== ПЕРЕКЛЮЧЕНИЕ СВОРАЧИВАНИЯ АКТИВНЫХ ПОЛЬЗОВАТЕЛЕЙ =====
(function() {
    const title = document.getElementById('active-users-title');
    const wrap = document.getElementById('active-users-wrap');
    if (!title || !wrap) return;

    title.classList.add('collapsed');
    wrap.classList.add('hidden');
    // На всякий случай удаляем старое сохранение, чтобы оно не мешало
    try { localStorage.removeItem('star_sky_au_collapsed'); } catch(e) {}

    title.addEventListener('click', () => {
        const isNowCollapsed = !title.classList.contains('collapsed');
        title.classList.toggle('collapsed', isNowCollapsed);
        wrap.classList.toggle('hidden', isNowCollapsed);
    });
})();


// ===== PM-ITEM MUTE (заглушить звуки и уведомления от пользователя) =====
const PM_MUTED_KEY = 'star_sky_pm_muted_v1';
let mutedPmUsers = new Set();
try { const r = localStorage.getItem(PM_MUTED_KEY); if (r) mutedPmUsers = new Set(JSON.parse(r)); } catch(e) {}

function _pm_saveMuted() {
    try { localStorage.setItem(PM_MUTED_KEY, JSON.stringify([...mutedPmUsers])); } catch(e) {}
}

function isPmUserMuted(username) { return mutedPmUsers.has(username); }
function togglePmUserMute(username) {
    if (mutedPmUsers.has(username)) mutedPmUsers.delete(username);
    else mutedPmUsers.add(username);
    _pm_saveMuted();
}

const _origSendMessage = window.sendMessage;

// Поиск
document.getElementById('search-go').addEventListener('click', () => doSearch(document.getElementById('search-input').value));
document.getElementById('search-input').addEventListener('input', e => doSearch(e.target.value));
document.getElementById('search-random').addEventListener('click', () => {
  const randomUser = MOCK_USERS[Math.floor(Math.random()*MOCK_USERS.length)];
  focusOnUser(randomUser.username);
  document.getElementById('search-panel').classList.remove('visible');
  isSearchOpen = false;
});

// Редактирование имени пользователя
document.getElementById('edit-username-btn').addEventListener('click', () => {
  const inp = document.getElementById('edit-username-input');
  const btn = document.getElementById('save-username-btn');
  const visible = inp.style.display === 'block';
  inp.style.display = visible ? 'none' : 'block';
  btn.style.display = visible ? 'none' : 'flex';
  if (!visible) { inp.value = MOCK_USER.display_name || ''; inp.focus(); }
});
// Загрузка аватара
document.getElementById('avatar-file-input')?.addEventListener('change', function() {
  const file = this.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const display = document.getElementById('profile-avatar-display');
    if (display) {
      display.innerHTML = '';
      display.style.background = 'none';
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:16px;display:block;';
      display.appendChild(img);
    }
    const topAvatar = document.getElementById('user-avatar');
    if (topAvatar) {
      topAvatar.style.background = 'none';
      topAvatar.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
  };
  reader.readAsDataURL(file);
  this.value = '';
});

// Редактирование отображаемого имени — логин не меняется
document.getElementById('save-username-btn')?.addEventListener('click', () => {
  const val = document.getElementById('edit-username-input')?.value.trim();
  if (!val) return;
  ['profile-display-name','profile-display-name-label','profile-avatar-card-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
  const userLabel = document.getElementById('user-label');
  if (userLabel) userLabel.textContent = val;
  const btn = document.getElementById('save-username-btn');
  if (btn) {
    btn.innerHTML = '<svg width="13" height="13"><use href="#icon-save"/></svg> Сохранено ✓';
    setTimeout(() => { btn.innerHTML = '<svg width="13" height="13"><use href="#icon-save"/></svg> Сохранить имя'; }, 1500);
  }
});

document.getElementById('save-info').addEventListener('click', () => {
  const val = document.getElementById('edit-info')?.value.trim();
  const bioDisplay = document.getElementById('profile-bio-display');
  if (bioDisplay && val) bioDisplay.textContent = val;
  const btn = document.getElementById('save-info');
  btn.textContent = '✓ Сохранено';
  setTimeout(() => { btn.innerHTML = '<svg width="16" height="16"><use href="#icon-save"/></svg> Сохранить изменения'; }, 1500);
});

// Кнопки модалки приватного чата
document.getElementById('private-accept').addEventListener('click', () => document.getElementById('private-modal').classList.remove('visible'));
document.getElementById('private-reject').addEventListener('click', () => document.getElementById('private-modal').classList.remove('visible'));

// Закрытие настроек по клику на оверлей
document.getElementById('settings-modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('settings-modal-overlay'))
    document.getElementById('settings-modal-overlay').classList.remove('visible');
});



// ===== ВИДЖЕТ ОНЛАЙН — реальные данные =====
async function updateOnlineWidget() {
    const data = await API.getOnlineUsers();
    if (!data || !data.success) return;
    const online = data.online;
    const count = data.count;
    document.querySelectorAll('.online-count').forEach(el => el.textContent = count);
    const el = document.getElementById('active-users');
    if (!el) return;
    el.innerHTML = '';
    if (!online.length) {
        el.innerHTML = '<div class="user-tag" style="opacity:0.5">Нет активных</div>';
        return;
    }
    online.forEach(u => {
        const tag = document.createElement('div');
        tag.className = 'user-tag';
        tag.textContent = '@' + u.username + (u.username === MOCK_USER.username ? ' (вы)' : '');
        tag.onclick = () => focusOnUser(u.username);
        el.appendChild(tag);
    });
    const onlineIds = new Set(online.map(u => u.id));
    if (typeof stars !== 'undefined') {
        stars.forEach(s => { if (!s.isMe) s.active = onlineIds.has(s.id); });
    }
}

function startHeartbeat() {
    if (!localStorage.getItem('star_sky_token')) return;
    API.heartbeat();
    updateOnlineWidget();
    setInterval(() => { API.heartbeat(); updateOnlineWidget(); }, 30000);
}


// ===== АНИМАЦИЯ ОБНОВЛЕНИЯ БАЛАНСА =====
function animateBalance(newVal) {
    const old = currentActivity;
    const diff = newVal - old;
    currentActivity = newVal;
    MOCK_USER.activity_score = newVal;

    // Обновляем числа
    const balEls = [
        document.getElementById('balance-amount'),
        document.getElementById('mob-balance-amount')
    ];
    balEls.forEach(el => { if (el) el.textContent = Math.floor(newVal); });
    if (typeof window.syncMobBalance === 'function') window.syncMobBalance();

    if (diff === 0) return;
    // Показываем +N / -N анимацию
    const sign = diff > 0 ? '+' : '';
    const color = diff > 0 ? '#4ade80' : '#f87171';
    const popup = document.createElement('div');
    popup.textContent = sign + Math.round(diff);
    popup.style.cssText = [
        'position:fixed', 'z-index:99999',
        'font-size:18px', 'font-weight:700',
        'color:' + color,
        'text-shadow:0 0 12px ' + color,
        'pointer-events:none',
        'transition:all 1s ease',
        'opacity:1'
    ].join(';');
    // Позиционируем рядом с балансом
    const ref = document.getElementById('balance-amount') || document.getElementById('mob-balance-amount');
    if (ref) {
        const r = ref.getBoundingClientRect();
        popup.style.left = (r.left + r.width/2 - 20) + 'px';
        popup.style.top = (r.top - 10) + 'px';
    } else {
        popup.style.right = '20px'; popup.style.top = '80px';
    }
    document.body.appendChild(popup);
    requestAnimationFrame(() => {
        popup.style.transform = 'translateY(-40px)';
        popup.style.opacity = '0';
    });
    setTimeout(() => popup.remove(), 1100);
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
renderShop();
renderLeaderboard();
renderActiveUsers();
loadMockMessages();
// Загружаем задания и друзей из БД после авторизации
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('star_sky_token')) {
    loadTasks();
    loadFriendsFromServer();
  }
});


// ===== СИСТЕМА СТАТУСА ОТСУТСТВИЯ =====
(function() {
  // Текущий пользователь
  const MY_USERNAME = MOCK_USER.username;
  let _awayTimer = null;
  const AWAY_TIMEOUT = 60000;

  function getMyStarObj() {
    return stars.find(s => s.username === MY_USERNAME);
  }

  function setMyStatus(status) {
    const me = getMyStarObj();
    if (!me) return;
    if (status === 'online') {
      me.active = true;
      me.away = false;
    } else {
      me.active = false;
      me.away = true;
    }
    // Обновить иконку в топбаре
    const dot = document.getElementById('user-status-dot');
    if (dot) {
      dot.style.background = status === 'online' ? '#22c55e' : '#fbbf24';
      dot.title = status === 'online' ? 'В сети' : 'Нет на месте';
    }
  }

  function resetAwayTimer() {
    if (document.hidden) return;
    setMyStatus('online');
    clearTimeout(_awayTimer);
    _awayTimer = setTimeout(() => setMyStatus('away'), AWAY_TIMEOUT);
  }

  // Страница скрыта -> away сразу
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(_awayTimer);
      setMyStatus('away');
    } else {
      resetAwayTimer();
    }
  });

  // Любое взаимодействие на вкладке -> онлайн
  const ACTIVITY_EVENTS = ['mousemove','mousedown','keydown','touchstart','wheel'];
  ACTIVITY_EVENTS.forEach(ev => {
    document.addEventListener(ev, resetAwayTimer, { passive: true });
  });

  // Запуск
  resetAwayTimer();
})();

// ===== ORB BACKGROUND (WebGL shader - vanilla порт react-bits "Orb") =====
const _orbState = {
  gl: null, program: null, rafId: 0, canvas: null,
  loc: null, lastResizeW: 0, lastResizeH: 0,
};

function _compileOrbShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('Orb shader compile error:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function startOrbBackground() {
  let canvas = document.getElementById('bg-orb-canvas');
  if (!canvas) return;
  if (_orbState.rafId) return;

  let gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false })
        || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl || gl.isContextLost()) {
    const fresh = canvas.cloneNode(false);
    canvas.parentNode && canvas.parentNode.replaceChild(fresh, canvas);
    canvas = fresh;
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false })
      || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  }
  if (!gl || gl.isContextLost()) return;
  _orbState.gl = gl;
  _orbState.canvas = canvas;
  gl.clearColor(0, 0, 0, 0);

  const vert = 'attribute vec2 position; attribute vec2 uv; varying vec2 vUv;'
    + 'void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }';

  const frag = [
    'precision highp float;',
    'uniform float iTime; uniform vec3 iResolution; uniform float hue;',
    'uniform float hover; uniform float rot; uniform float hoverIntensity;',
    'uniform float brightness;',
    'uniform vec3 backgroundColor; varying vec2 vUv;',
    'vec3 rgb2yiq(vec3 c){ float y=dot(c,vec3(0.299,0.587,0.114)); float i=dot(c,vec3(0.596,-0.274,-0.322)); float q=dot(c,vec3(0.211,-0.523,0.312)); return vec3(y,i,q); }',
    'vec3 yiq2rgb(vec3 c){ float r=c.x+0.956*c.y+0.621*c.z; float g=c.x-0.272*c.y-0.647*c.z; float b=c.x-1.106*c.y+1.703*c.z; return vec3(r,g,b); }',
    'vec3 adjustHue(vec3 color,float hueDeg){ float hueRad=hueDeg*3.14159265/180.0; vec3 yiq=rgb2yiq(color); float cA=cos(hueRad); float sA=sin(hueRad); float i=yiq.y*cA-yiq.z*sA; float q=yiq.y*sA+yiq.z*cA; yiq.y=i; yiq.z=q; return yiq2rgb(yiq); }',
    'vec3 hash33(vec3 p3){ p3=fract(p3*vec3(0.1031,0.11369,0.13787)); p3+=dot(p3,p3.yxz+19.19); return -1.0+2.0*fract(vec3(p3.x+p3.y,p3.x+p3.z,p3.y+p3.z)*p3.zyx); }',
    'float snoise3(vec3 p){ const float K1=0.333333333; const float K2=0.166666667;',
    '  vec3 i=floor(p+(p.x+p.y+p.z)*K1);',
    '  vec3 d0=p-(i-(i.x+i.y+i.z)*K2);',
    '  vec3 e=step(vec3(0.0),d0-d0.yzx);',
    '  vec3 i1=e*(1.0-e.zxy);',
    '  vec3 i2=1.0-e.zxy*(1.0-e);',
    '  vec3 d1=d0-(i1-K2);',
    '  vec3 d2=d0-(i2-K1);',
    '  vec3 d3=d0-0.5;',
    '  vec4 h=max(0.6-vec4(dot(d0,d0),dot(d1,d1),dot(d2,d2),dot(d3,d3)),0.0);',
    '  vec4 n=h*h*h*h*vec4(dot(d0,hash33(i)),dot(d1,hash33(i+i1)),dot(d2,hash33(i+i2)),dot(d3,hash33(i+1.0)));',
    '  return dot(vec4(31.316),n); }',
    'vec4 extractAlpha(vec3 cIn){ float a=max(max(cIn.r,cIn.g),cIn.b); return vec4(cIn.rgb/(a+1e-5),a); }',
    'const vec3 baseColor1=vec3(0.611765,0.262745,0.996078);',
    'const vec3 baseColor2=vec3(0.298039,0.760784,0.913725);',
    'const vec3 baseColor3=vec3(0.062745,0.078431,0.600000);',
    'const float innerRadius=0.6; const float noiseScale=0.65;',
    'float light1(float I,float A,float d){ return I/(1.0+d*A); }',
    'float light2(float I,float A,float d){ return I/(1.0+d*d*A); }',
    'vec4 drawOrb(vec2 uv){',
    '  vec3 c1=adjustHue(baseColor1,hue); vec3 c2=adjustHue(baseColor2,hue); vec3 c3=adjustHue(baseColor3,hue);',
    '  float ang=atan(uv.y,uv.x); float len=length(uv); float invLen=len>0.0?1.0/len:0.0;',
    '  float bgLum=dot(backgroundColor,vec3(0.299,0.587,0.114));',
    '  float n0=snoise3(vec3(uv*noiseScale,iTime*0.5))*0.5+0.5;',
    '  float r0=mix(mix(innerRadius,1.0,0.4),mix(innerRadius,1.0,0.6),n0);',
    '  float d0=distance(uv,(r0*invLen)*uv);',
    '  float v0=light1(1.0,10.0,d0);',
    '  v0*=smoothstep(r0*1.05,r0,len);',
    '  float innerFade=smoothstep(r0*0.8,r0*0.95,len);',
    '  v0*=mix(innerFade,1.0,bgLum*0.7);',
    '  float cl=cos(ang+iTime*2.0)*0.5+0.5;',
    '  float a=iTime*-1.0; vec2 pos=vec2(cos(a),sin(a))*r0;',
    '  float d=distance(uv,pos); float v1=light2(1.5,5.0,d); v1*=light1(1.0,50.0,d0);',
    '  float v2=smoothstep(1.0,mix(innerRadius,1.0,n0*0.5),len);',
    '  float v3=smoothstep(innerRadius,mix(innerRadius,1.0,0.5),len);',
    '  vec3 colBase=mix(c1,c2,cl); float fadeAmt=mix(1.0,0.1,bgLum);',
    '  vec3 darkCol=mix(c3,colBase,v0); darkCol=(darkCol+v1)*v2*v3; darkCol=clamp(darkCol,0.0,1.0);',
    '  vec3 lightCol=(colBase+v1)*mix(1.0,v2*v3,fadeAmt); lightCol=mix(backgroundColor,lightCol,v0); lightCol=clamp(lightCol,0.0,1.0);',
    '  vec3 finalCol=mix(darkCol,lightCol,bgLum);',
    '  return extractAlpha(finalCol);',
    '}',
    'vec4 mainImage(vec2 fragCoord){',
    '  vec2 center=iResolution.xy*0.5; float size=min(iResolution.x,iResolution.y);',
    '  vec2 uv=(fragCoord-center)/size*2.0;',
    '  float angle=rot; float s=sin(angle); float c=cos(angle);',
    '  uv=vec2(c*uv.x-s*uv.y, s*uv.x+c*uv.y);',
    '  uv.x+=hover*hoverIntensity*0.18*sin(uv.y*8.0+iTime*1.1);',
    '  uv.y+=hover*hoverIntensity*0.18*sin(uv.x*8.0+iTime*1.1);',
    '  return drawOrb(uv);',
    '}',
    'void main(){ vec2 fc=vUv*iResolution.xy; vec4 col=mainImage(fc); float b=max(brightness,0.0); gl_FragColor=vec4(col.rgb*col.a*b, col.a*min(b,1.0)); }'
  ].join('\n');

  const vs = _compileOrbShader(gl, gl.VERTEX_SHADER, vert);
  const fs = _compileOrbShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('Orb program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  _orbState.program = prog;
  gl.useProgram(prog);

  // Fullscreen triangle (overdrawn), с UV в диапазоне 0..1
  const posLoc = gl.getAttribLocation(prog, 'position');
  const uvLoc = gl.getAttribLocation(prog, 'uv');
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 2,0, 0,2]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  _orbState.loc = {
    iTime: gl.getUniformLocation(prog, 'iTime'),
    iResolution: gl.getUniformLocation(prog, 'iResolution'),
    hue: gl.getUniformLocation(prog, 'hue'),
    hover: gl.getUniformLocation(prog, 'hover'),
    rot: gl.getUniformLocation(prog, 'rot'),
    hoverIntensity: gl.getUniformLocation(prog, 'hoverIntensity'),
    brightness: gl.getUniformLocation(prog, 'brightness'),
    backgroundColor: gl.getUniformLocation(prog, 'backgroundColor'),
  };

  // Базовые параметры; hoverIntensity/time mul/scale теперь живут в animSettings и читаются каждый кадр
  const params = { hue: 0, bgColor: [0, 0, 0] };
  let mouseBoost = 0, hoverVal = 1, rotVal = 0, lastT = 0, orbTime = 0;
  const ROT_SPEED = 0.18;

  function resize() {
    const container = document.getElementById('bg-orb');
    if (!container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const pxW = Math.max(1, Math.floor(w * dpr));
    const pxH = Math.max(1, Math.floor(h * dpr));
    if (pxW !== _orbState.lastResizeW || pxH !== _orbState.lastResizeH) {
      canvas.width = pxW; canvas.height = pxH;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      gl.viewport(0, 0, pxW, pxH);
      _orbState.lastResizeW = pxW; _orbState.lastResizeH = pxH;
    }
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const sz = Math.min(r.width, r.height);
    const uvX = ((x - r.width / 2) / sz) * 2.0;
    const uvY = ((y - r.height / 2) / sz) * 2.0;
    // При наведении мышью добавляем бонусное «колыхание» поверх постоянного изгибания
    mouseBoost = Math.sqrt(uvX * uvX + uvY * uvY) < 0.9 ? 0.6 : 0;
  }
  function onLeave() { mouseBoost = 0; }

  _orbState._onMove = onMove;
  _orbState._onLeave = onLeave;
  _orbState._onResize = resize;
  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);

  resize();

  function frame(t) {
    _orbState.rafId = requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    const dt = Math.min((t - lastT) * 0.001, 0.1);
    lastT = t;

    // Читаем пользовательские настройки анимации. Используем дефолты, если их ещё нет
    const as = (typeof animSettings === 'object' && animSettings) ? animSettings : { speed: 100, intensity: 72, blur: 12, scale: 100 };
    const speedMul = Math.max(0.05, (as.speed || 100) / 100);
    const intensity01 = Math.max(0.0, (as.intensity || 72) / 100);
    const scale01 = Math.max(0.3, (as.scale || 100) / 100);
    const blurVw = Math.max(0, as.blur || 0);

    orbTime += dt * speedMul;

    const targetHover = 1.0 + mouseBoost;
    hoverVal += (targetHover - hoverVal) * 0.08;
    const hoverIntensity = 0.55;
    const brightness = intensity01 / 0.72;

    canvas.style.transformOrigin = '50% 50%';
    canvas.style.transform = 'scale(' + scale01.toFixed(3) + ')';

    const blurCss = Math.max(0, (blurVw - 5) * 0.45);
    const orbLayer = document.getElementById('bg-orb');
    if (orbLayer) orbLayer.style.filter = blurCss > 0 ? `blur(${blurCss.toFixed(2)}vw)` : '';

    resize();
    gl.useProgram(prog);
    gl.uniform1f(_orbState.loc.iTime, orbTime);
    gl.uniform3f(_orbState.loc.iResolution, canvas.width, canvas.height, canvas.width / canvas.height);
    gl.uniform1f(_orbState.loc.hue, params.hue);
    gl.uniform1f(_orbState.loc.hoverIntensity, hoverIntensity);
    gl.uniform1f(_orbState.loc.brightness, brightness);
    gl.uniform3fv(_orbState.loc.backgroundColor, params.bgColor);
    gl.uniform1f(_orbState.loc.hover, hoverVal);
    // Базовое вращение - медленное и постоянное, отдельно от hover-буста
    rotVal += dt * ROT_SPEED * speedMul * (1.0 + mouseBoost);
    gl.uniform1f(_orbState.loc.rot, rotVal);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  _orbState.rafId = requestAnimationFrame(frame);
}

function stopOrbBackground() {
  if (_orbState.rafId) {
    cancelAnimationFrame(_orbState.rafId);
    _orbState.rafId = 0;
  }
  const canvas = _orbState.canvas;
  if (canvas) canvas.style.transform = '';
  const orbLayer = document.getElementById('bg-orb');
  if (orbLayer) orbLayer.style.filter = '';
  if (canvas && _orbState._onMove) canvas.removeEventListener('mousemove', _orbState._onMove);
  if (canvas && _orbState._onLeave) canvas.removeEventListener('mouseleave', _orbState._onLeave);
  if (_orbState._onResize) window.removeEventListener('resize', _orbState._onResize);
  _orbState.gl = null;
  _orbState.program = null;
  _orbState.canvas = null;
  _orbState.loc = null;
  _orbState.lastResizeW = 0;
  _orbState.lastResizeH = 0;
}

// ===== SOFT AURORA BACKGROUND (WebGL shader - vanilla порт react-bits "SoftAurora") =====
const _auroraState = {
  gl: null, program: null, rafId: 0, canvas: null,
  loc: null, lastResizeW: 0, lastResizeH: 0,
};

function startSoftAuroraBackground() {
  let canvas = document.getElementById('bg-aurora-canvas');
  if (!canvas) return;
  if (_auroraState.rafId) return;

  let gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false })
        || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl || gl.isContextLost()) {
    const fresh = canvas.cloneNode(false);
    canvas.parentNode && canvas.parentNode.replaceChild(fresh, canvas);
    canvas = fresh;
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false })
      || canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  }
  if (!gl || gl.isContextLost()) return;
  _auroraState.gl = gl;
  _auroraState.canvas = canvas;
  gl.clearColor(0, 0, 0, 0);

  const vert = 'attribute vec2 position; attribute vec2 uv; varying vec2 vUv;'
    + 'void main(){ vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }';

  const frag = [
    'precision highp float;',
    'uniform float uTime; uniform vec3 uResolution;',
    'uniform float uSpeed; uniform float uScale; uniform float uBrightness;',
    'uniform vec3 uColor1; uniform vec3 uColor2;',
    'uniform float uNoiseFreq; uniform float uNoiseAmp;',
    'uniform float uBandHeight; uniform float uBandSpread;',
    'uniform float uOctaveDecay; uniform float uLayerOffset; uniform float uColorSpeed;',
    'uniform vec2 uMouse; uniform float uMouseInfluence; uniform float uEnableMouse;',
    'varying vec2 vUv;',
    '#define TAU 6.28318',
    'vec3 gradientHash(vec3 p){',
    '  p=vec3(dot(p,vec3(127.1,311.7,234.6)),dot(p,vec3(269.5,183.3,198.3)),dot(p,vec3(169.5,283.3,156.9)));',
    '  vec3 h=fract(sin(p)*43758.5453123);',
    '  float phi=acos(2.0*h.x-1.0); float theta=TAU*h.y;',
    '  return vec3(cos(theta)*sin(phi),sin(theta)*cos(phi),cos(phi));',
    '}',
    'float quinticSmooth(float t){ float t2=t*t; float t3=t*t2; return 6.0*t3*t2-15.0*t2*t2+10.0*t3; }',
    'vec3 cosineGradient(float t,vec3 a,vec3 b,vec3 c,vec3 d){ return a+b*cos(TAU*(c*t+d)); }',
    'float perlin3D(float amp,float freq,float px,float py,float pz){',
    '  float x=px*freq; float y=py*freq;',
    '  float fx=floor(x); float fy=floor(y); float fz=floor(pz);',
    '  float cx=ceil(x);  float cy=ceil(y);  float cz=ceil(pz);',
    '  vec3 g000=gradientHash(vec3(fx,fy,fz));',
    '  vec3 g100=gradientHash(vec3(cx,fy,fz));',
    '  vec3 g010=gradientHash(vec3(fx,cy,fz));',
    '  vec3 g110=gradientHash(vec3(cx,cy,fz));',
    '  vec3 g001=gradientHash(vec3(fx,fy,cz));',
    '  vec3 g101=gradientHash(vec3(cx,fy,cz));',
    '  vec3 g011=gradientHash(vec3(fx,cy,cz));',
    '  vec3 g111=gradientHash(vec3(cx,cy,cz));',
    '  float d000=dot(g000,vec3(x-fx,y-fy,pz-fz));',
    '  float d100=dot(g100,vec3(x-cx,y-fy,pz-fz));',
    '  float d010=dot(g010,vec3(x-fx,y-cy,pz-fz));',
    '  float d110=dot(g110,vec3(x-cx,y-cy,pz-fz));',
    '  float d001=dot(g001,vec3(x-fx,y-fy,pz-cz));',
    '  float d101=dot(g101,vec3(x-cx,y-fy,pz-cz));',
    '  float d011=dot(g011,vec3(x-fx,y-cy,pz-cz));',
    '  float d111=dot(g111,vec3(x-cx,y-cy,pz-cz));',
    '  float sx=quinticSmooth(x-fx); float sy=quinticSmooth(y-fy); float sz=quinticSmooth(pz-fz);',
    '  float lx00=mix(d000,d100,sx); float lx10=mix(d010,d110,sx);',
    '  float lx01=mix(d001,d101,sx); float lx11=mix(d011,d111,sx);',
    '  float ly0=mix(lx00,lx10,sy); float ly1=mix(lx01,lx11,sy);',
    '  return amp*mix(ly0,ly1,sz);',
    '}',
    'float auroraGlow(float t,vec2 shift){',
    '  vec2 uv=gl_FragCoord.xy/uResolution.y;',
    '  uv+=shift;',
    '  float noiseVal=0.0; float freq=uNoiseFreq; float amp=uNoiseAmp;',
    '  vec2 samplePos=uv*uScale;',
    '  for(float i=0.0;i<3.0;i+=1.0){',
    '    noiseVal+=perlin3D(amp,freq,samplePos.x,samplePos.y,t);',
    '    amp*=uOctaveDecay; freq*=2.0;',
    '  }',
    '  float yBand=uv.y*10.0-uBandHeight*10.0;',
    '  return 0.3*max(exp(uBandSpread*(1.0-1.1*abs(noiseVal+yBand))),0.0);',
    '}',
    'void main(){',
    '  vec2 uv=gl_FragCoord.xy/uResolution.xy;',
    '  float t=uSpeed*0.4*uTime;',
    '  vec2 shift=vec2(0.0);',
    '  if(uEnableMouse>0.5){ shift=(uMouse-0.5)*uMouseInfluence; }',
    '  vec3 col=vec3(0.0);',
    '  col+=0.99*auroraGlow(t,shift)*cosineGradient(uv.x+uTime*uSpeed*0.2*uColorSpeed,vec3(0.5),vec3(0.5),vec3(1.0),vec3(0.3,0.20,0.20))*uColor1;',
    '  col+=0.99*auroraGlow(t+uLayerOffset,shift)*cosineGradient(uv.x+uTime*uSpeed*0.1*uColorSpeed,vec3(0.5),vec3(0.5),vec3(2.0,1.0,0.0),vec3(0.5,0.20,0.25))*uColor2;',
    '  col*=uBrightness;',
    '  float alpha=clamp(length(col),0.0,1.0);',
    '  gl_FragColor=vec4(col,alpha);',
    '}'
  ].join('\n');

  const vs = _compileOrbShader(gl, gl.VERTEX_SHADER, vert);
  const fs = _compileOrbShader(gl, gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('SoftAurora program link error:', gl.getProgramInfoLog(prog));
    return;
  }
  _auroraState.program = prog;

  // Полноэкранный треугольник (OGL Triangle): позиция (-1,-1),(3,-1),(-1,3) + uv
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const posLoc = gl.getAttribLocation(prog, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uvBuf = gl.createBuffer();
  const uvLoc = gl.getAttribLocation(prog, 'uv');
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 2,0, 0,2]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

  _auroraState.loc = {
    uTime: gl.getUniformLocation(prog, 'uTime'),
    uResolution: gl.getUniformLocation(prog, 'uResolution'),
    uSpeed: gl.getUniformLocation(prog, 'uSpeed'),
    uScale: gl.getUniformLocation(prog, 'uScale'),
    uBrightness: gl.getUniformLocation(prog, 'uBrightness'),
    uColor1: gl.getUniformLocation(prog, 'uColor1'),
    uColor2: gl.getUniformLocation(prog, 'uColor2'),
    uNoiseFreq: gl.getUniformLocation(prog, 'uNoiseFreq'),
    uNoiseAmp: gl.getUniformLocation(prog, 'uNoiseAmp'),
    uBandHeight: gl.getUniformLocation(prog, 'uBandHeight'),
    uBandSpread: gl.getUniformLocation(prog, 'uBandSpread'),
    uOctaveDecay: gl.getUniformLocation(prog, 'uOctaveDecay'),
    uLayerOffset: gl.getUniformLocation(prog, 'uLayerOffset'),
    uColorSpeed: gl.getUniformLocation(prog, 'uColorSpeed'),
    uMouse: gl.getUniformLocation(prog, 'uMouse'),
    uMouseInfluence: gl.getUniformLocation(prog, 'uMouseInfluence'),
    uEnableMouse: gl.getUniformLocation(prog, 'uEnableMouse'),
  };

  const params = {
    color1: [0.968, 0.968, 0.968],
    color2: [0.882, 0.000, 1.000],
    noiseFreq: 2.5,
    noiseAmp: 1.0,
    bandHeight: 0.5,
    bandSpread: 1.0,
    octaveDecay: 0.1,
    layerOffset: 0.0,
    colorSpeed: 1.0,
    mouseInfluence: 0.25,
  };

  let targetMx = 0.5, targetMy = 0.5, curMx = 0.5, curMy = 0.5;
  let lastT = 0;

  function resize() {
    const container = document.getElementById('bg-aurora');
    if (!container) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const pxW = Math.max(1, Math.floor(w * dpr));
    const pxH = Math.max(1, Math.floor(h * dpr));
    if (pxW !== _auroraState.lastResizeW || pxH !== _auroraState.lastResizeH) {
      canvas.width = pxW; canvas.height = pxH;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      gl.viewport(0, 0, pxW, pxH);
      _auroraState.lastResizeW = pxW; _auroraState.lastResizeH = pxH;
    }
  }

  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    targetMx = (e.clientX - r.left) / Math.max(1, r.width);
    targetMy = 1.0 - (e.clientY - r.top) / Math.max(1, r.height);
  }
  function onLeave() { targetMx = 0.5; targetMy = 0.5; }

  _auroraState._onMove = onMove;
  _auroraState._onLeave = onLeave;
  _auroraState._onResize = resize;
  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mouseleave', onLeave);

  resize();

  let auroraTime = 0;

  function frame(t) {
    _auroraState.rafId = requestAnimationFrame(frame);
    if (!lastT) lastT = t;
    const dt = Math.min((t - lastT) * 0.001, 0.1);
    lastT = t;

    const as = (typeof animSettings === 'object' && animSettings) ? animSettings : { speed: 100, intensity: 72, blur: 12, scale: 100 };
    const speedMul    = Math.max(0.05, (as.speed || 100) / 100);
    const intensity01 = Math.max(0.0,  (as.intensity || 72) / 100);
    const scale01     = Math.max(0.3,  (as.scale || 100) / 100);
    const blurVw      = Math.max(0,    as.blur || 0);

    auroraTime += dt * speedMul;

    const brightness = intensity01 / 0.72;

    const blurCss = Math.max(0, (blurVw - 5) * 0.45);
    const layer = document.getElementById('bg-aurora');
    if (layer) layer.style.filter = blurCss > 0 ? ('blur(' + blurCss.toFixed(2) + 'vw)') : '';

    resize();

    curMx += 0.05 * (targetMx - curMx);
    curMy += 0.05 * (targetMy - curMy);

    gl.useProgram(prog);
    gl.uniform1f(_auroraState.loc.uTime, auroraTime);
    gl.uniform3f(_auroraState.loc.uResolution, canvas.width, canvas.height, canvas.width / Math.max(1, canvas.height));
    gl.uniform1f(_auroraState.loc.uSpeed, 0.6);
    gl.uniform1f(_auroraState.loc.uScale, 1.5 / scale01);
    gl.uniform1f(_auroraState.loc.uBrightness, brightness);
    gl.uniform3fv(_auroraState.loc.uColor1, params.color1);
    gl.uniform3fv(_auroraState.loc.uColor2, params.color2);
    gl.uniform1f(_auroraState.loc.uNoiseFreq, params.noiseFreq);
    gl.uniform1f(_auroraState.loc.uNoiseAmp, params.noiseAmp);
    gl.uniform1f(_auroraState.loc.uBandHeight, params.bandHeight);
    gl.uniform1f(_auroraState.loc.uBandSpread, params.bandSpread);
    gl.uniform1f(_auroraState.loc.uOctaveDecay, params.octaveDecay);
    gl.uniform1f(_auroraState.loc.uLayerOffset, params.layerOffset);
    gl.uniform1f(_auroraState.loc.uColorSpeed, params.colorSpeed);
    gl.uniform2f(_auroraState.loc.uMouse, curMx, curMy);
    gl.uniform1f(_auroraState.loc.uMouseInfluence, params.mouseInfluence);
    gl.uniform1f(_auroraState.loc.uEnableMouse, 1.0);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  _auroraState.rafId = requestAnimationFrame(frame);
}

function stopSoftAuroraBackground() {
  if (_auroraState.rafId) {
    cancelAnimationFrame(_auroraState.rafId);
    _auroraState.rafId = 0;
  }
  const canvas = _auroraState.canvas;
  const layer = document.getElementById('bg-aurora');
  if (layer) layer.style.filter = '';
  if (canvas && _auroraState._onMove)  canvas.removeEventListener('mousemove', _auroraState._onMove);
  if (canvas && _auroraState._onLeave) canvas.removeEventListener('mouseleave', _auroraState._onLeave);
  if (_auroraState._onResize) window.removeEventListener('resize', _auroraState._onResize);
  _auroraState.gl = null;
  _auroraState.program = null;
  _auroraState.canvas = null;
  _auroraState.loc = null;
  _auroraState.lastResizeW = 0;
  _auroraState.lastResizeH = 0;
}


// ===== ФОНОВЫЕ ТЕМЫ =====

const BG_THEMES = [
  // Анимированные
  { id: 'default', label: 'По умолчанию', desc: 'Оригинальный градиент', group: 'animated' },
  { id: 'walpole', label: 'Цветные формы', desc: 'Вращающиеся фигуры', group: 'animated' },
  { id: 'wilvander', label: 'Синий туман', desc: 'Пульсирующий blob', group: 'animated' },
  { id: 'orb', label: 'Орб', desc: 'Плазменная сфера (WebGL)', group: 'animated' },
  { id: 'soft_aurora', label: 'Мягкое сияние', desc: 'Переливы сияния (WebGL)', group: 'animated' },

  // Статичные
  { id: 'deep_space', label: 'Глубокий космос', desc: 'Тёмно-синий с туманностью', group: 'static',
    css: 'radial-gradient(ellipse at 20% 20%, #0d1b4b 0%, #010712 50%), radial-gradient(ellipse at 80% 80%, #1a0a3b 0%, transparent 50%)' },
  { id: 'aurora', label: 'Аврора', desc: 'Зелёное северное сияние', group: 'static',
    css: 'linear-gradient(160deg, #030f0a 0%, #04291a 30%, #052e1c 50%, #0a1628 75%, #050b18 100%)' },
  { id: 'nebula_red', label: 'Красная туманность', desc: 'Огненные тона', group: 'static',
    css: 'radial-gradient(ellipse at 30% 40%, #2a0a0a 0%, #130606 40%, #080008 100%)' },
  { id: 'sunset', label: 'Космический закат',  desc: 'Пурпур и янтарь', group: 'static',
    css: 'linear-gradient(135deg, #0a0412 0%, #1a0633 25%, #2d0b4e 45%, #3b0f5c 60%, #1a0820 100%)' },
  { id: 'ocean', label: 'Глубокий океан', desc: 'Синий абисс', group: 'static',
    css: 'linear-gradient(180deg, #000d1a 0%, #001830 30%, #002040 60%, #001428 100%)' },
  { id: 'forest', label: 'Ночной лес', desc: 'Тёмно-зелёный мрак', group: 'static',
    css: 'linear-gradient(160deg, #020a04 0%, #061408 30%, #0a1e0c 55%, #030d05 100%)' },
  { id: 'void', label: 'Пустота', desc: 'Чистый чёрный', group: 'static',
    css: '#000000' },
  { id: 'galaxy', label: 'Галактика', desc: 'Молочный путь', group: 'static',
    css: 'radial-gradient(ellipse at 50% 50%, #0e0c1e 0%, #060410 40%, #030208 100%)' },
];

let currentBgId = 'deep_space';
let gridBuilt = false;

// Скрываем все слои
function hideAllBgLayers() {
  ['bg-walpole','bg-wilvander','bg-orb','bg-aurora'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  // Останавливаем WebGL-рендеры, если они были активны — чтобы не греть GPU впустую
  if (typeof stopOrbBackground === 'function') stopOrbBackground();
  if (typeof stopSoftAuroraBackground === 'function') stopSoftAuroraBackground();
}

// Применяем тему
function applyBgTheme(theme) {
  const blobWrap = document.getElementById('bg-blobs');
  hideAllBgLayers();
  blobWrap.classList.remove('visible');
  const nb = document.getElementById('starfield-background');
  const ov = document.getElementById('nebula-overlay');

  if (theme.group === 'static') {
    document.body.style.animation = 'none';
    document.body.style.backgroundSize = '';
    document.body.style.background = theme.css;
    if (nb) nb.style.background = 'none';
    if (ov) ov.style.background = 'none';
    currentBgId = theme.id;
    updateBgGrid();
    if (typeof updateSetting === 'function') updateSetting('backgroundTheme', theme.id);
    return;
  }
  if (theme.id === 'default') {
    document.body.style.background = 'linear-gradient(-45deg,#010712,#080d16,#0d1322,#121826,#1a1440)';
    document.body.style.backgroundSize = '400% 400%';
    document.body.style.animation = 'gradientShift 35s ease infinite';
    if (nb) nb.style.cssText = '';
    if (ov) ov.style.cssText = '';
    currentBgId = theme.id;
    updateBgGrid();
    if (typeof updateSetting === 'function') updateSetting('backgroundTheme', theme.id);
    return;
  }
  document.body.style.animation = 'none';
  document.body.style.backgroundSize = '';
  if (nb) nb.style.background = 'none';
  if (ov) ov.style.background = 'none';
  blobWrap.classList.add('visible');
  const cfg = {
    walpole: { id: 'bg-walpole', display: 'grid', bg: '#000000' },
    wilvander: { id: 'bg-wilvander', display: 'flex', bg: '#071c39' },
    orb: { id: 'bg-orb', display: 'block', bg: '#000000' },
    soft_aurora: { id: 'bg-aurora', display: 'block', bg: '#000000' },
  }[theme.id];
  if (!cfg) return;
  document.body.style.background = cfg.bg;
  const layer = document.getElementById(cfg.id);
  if (layer) layer.style.display = cfg.display;
  if (theme.id === 'orb' && typeof startOrbBackground === 'function') startOrbBackground();
  if (theme.id === 'soft_aurora' && typeof startSoftAuroraBackground === 'function') startSoftAuroraBackground();
  currentBgId = theme.id;
  updateBgGrid();
  if (typeof updateSetting === 'function') updateSetting('backgroundTheme', theme.id);
}

// Предпросмотр на canvas
function makeBgPreview(theme) {
  const cv = document.createElement('canvas');
  cv.width = 160; cv.height = 90;
  const x = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const fill = (style) => { x.fillStyle = style; x.fillRect(0,0,W,H); };
  const radial = (cx,cy,r,c0,c1,alpha) => {
    const rg = x.createRadialGradient(cx*W,cy*H,0,cx*W,cy*H,r*W);
    rg.addColorStop(0,c0); rg.addColorStop(1,c1);
    x.globalAlpha = alpha||1; x.fillStyle = rg; x.fillRect(0,0,W,H); x.globalAlpha = 1;
  };
  if (theme.id === 'default') {
    const g = x.createLinearGradient(0,0,W,H);
    g.addColorStop(0,'#010712'); g.addColorStop(0.5,'#080d16'); g.addColorStop(1,'#1a1440');
    fill(g); radial(0.2,0.7,0.4,'rgba(139,92,246,0.22)','transparent'); radial(0.8,0.2,0.35,'rgba(59,130,246,0.18)','transparent');
  } else if (theme.id === 'walpole') {
    fill('#000'); x.globalCompositeOperation = 'screen';
    radial(0.35,0.5,0.5,'hotpink','transparent',0.8); radial(0.65,0.5,0.5,'cyan','transparent',0.7);
    x.globalCompositeOperation = 'source-over';
  } else if (theme.id === 'wilvander') {
    fill('#071c39'); radial(0.5,0.5,0.5,'rgba(59,130,246,0.7)','transparent'); radial(0.6,0.4,0.35,'rgba(52,211,153,0.5)','transparent');
  } else if (theme.id === 'orb') {
    fill('#000000');
    radial(0.5, 0.5, 0.55, 'rgba(156,67,254,0.85)', 'transparent', 0.9);
    radial(0.42, 0.45, 0.38, 'rgba(76,194,233,0.7)', 'transparent', 0.7);
    radial(0.58, 0.55, 0.22, 'rgba(255,255,255,0.45)', 'transparent', 0.8);
    radial(0.5, 0.5, 0.48, 'rgba(16,20,153,0.35)', 'transparent', 0.5);
  } else if (theme.id === 'soft_aurora') {
    fill('#000000');
    x.globalCompositeOperation = 'screen';
    radial(0.25, 0.55, 0.55, 'rgba(225,0,255,0.55)', 'transparent', 0.85);
    radial(0.75, 0.45, 0.55, 'rgba(247,247,247,0.45)', 'transparent', 0.75);
    radial(0.5,  0.65, 0.40, 'rgba(180,120,255,0.35)', 'transparent', 0.6);
    x.globalCompositeOperation = 'source-over';
  } else if (theme.id === 'deep_space') {
    fill('#010712'); radial(0.2,0.2,0.6,'rgba(30,60,180,0.5)','transparent'); radial(0.8,0.8,0.4,'rgba(100,40,160,0.4)','transparent');
  } else if (theme.id === 'aurora') {
    const g2 = x.createLinearGradient(0,0,W,H);
    g2.addColorStop(0,'#030f0a'); g2.addColorStop(0.5,'#052e1c'); g2.addColorStop(1,'#050b18');
    fill(g2); radial(0.5,0.2,0.5,'rgba(20,180,80,0.35)','transparent'); radial(0.3,0.5,0.3,'rgba(30,220,120,0.2)','transparent');
  } else if (theme.id === 'nebula_red') {
    const g3 = x.createLinearGradient(0,0,W,H);
    g3.addColorStop(0,'#130606'); g3.addColorStop(1,'#080008');
    fill(g3); radial(0.3,0.4,0.5,'rgba(200,20,20,0.4)','transparent'); radial(0.7,0.6,0.3,'rgba(180,60,0,0.3)','transparent');
  } else if (theme.id === 'sunset') {
    const g4 = x.createLinearGradient(0,0,W,H);
    g4.addColorStop(0,'#0a0412'); g4.addColorStop(0.5,'#2d0b4e'); g4.addColorStop(1,'#1a0820');
    fill(g4); radial(0.5,0.3,0.5,'rgba(180,60,240,0.3)','transparent'); radial(0.7,0.7,0.3,'rgba(240,100,30,0.2)','transparent');
  } else if (theme.id === 'ocean') {
    const g5 = x.createLinearGradient(0,0,0,H);
    g5.addColorStop(0,'#000d1a'); g5.addColorStop(1,'#001428');
    fill(g5); radial(0.5,0.5,0.6,'rgba(0,60,140,0.4)','transparent');
  } else if (theme.id === 'forest') {
    const g6 = x.createLinearGradient(0,0,W,H);
    g6.addColorStop(0,'#020a04'); g6.addColorStop(0.5,'#0a1e0c'); g6.addColorStop(1,'#030d05');
    fill(g6); radial(0.5,0.3,0.5,'rgba(0,80,20,0.35)','transparent');
  } else if (theme.id === 'void') {
    fill('#000000');
  } else if (theme.id === 'galaxy') {
    const g7 = x.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.6);
    g7.addColorStop(0,'#1a1535'); g7.addColorStop(0.4,'#0e0c1e'); g7.addColorStop(1,'#030208');
    fill(g7); radial(0.5,0.5,0.2,'rgba(180,160,255,0.15)','transparent');
  }
  for(let i=0;i<36;i++){
    x.beginPath(); x.arc(Math.random()*W,Math.random()*H,Math.random()*0.9+0.2,0,Math.PI*2);
    x.fillStyle=`rgba(255,255,255,${Math.random()*0.7+0.2})`; x.fill();
  }
  return cv.toDataURL();
}


// ===== ТЕМЫ ЧАТА =====
const CHAT_THEMES = [
  {
    id: 'cosmos',
    name: 'Космос',
    vars: {
      '--tg-bg': '#08101e',
      '--tg-surface': '#0e1928',
      '--tg-surface-light': '#152235',
      '--tg-surface-dark': '#060d18',
      '--tg-text': '#e2e8f5',
      '--tg-text-secondary': '#6b84a8',
      '--tg-accent': '#6d4aff',
      '--tg-accent-hover': '#5538e0',
      '--tg-border': 'rgba(109,74,255,0.2)',
      '--tg-message-outgoing': '#3730a3',
      '--tg-message-incoming': '#0e1928',
      '--tg-message-outgoing-text': '#e2e8f5',
      '--tg-message-incoming-text': '#e2e8f5',
    },
    preview: { bg:'#08101e', incoming:'#0e1928', outgoing:'#3730a3', text:'#e2e8f5' },
  },

  {
    id: 'nebula',
    name: 'Туманность',
    vars: {
      '--tg-bg': '#0d0818',
      '--tg-surface': '#150e28',
      '--tg-surface-light': '#1e1535',
      '--tg-surface-dark': '#0a0612',
      '--tg-text': '#ede8ff',
      '--tg-text-secondary': '#7a6aaa',
      '--tg-accent': '#9b6dff',
      '--tg-accent-hover': '#7c4de0',
      '--tg-border': 'rgba(155,109,255,0.22)',
      '--tg-message-outgoing': '#5b21b6',
      '--tg-message-incoming': '#150e28',
      '--tg-message-outgoing-text': '#ede8ff',
      '--tg-message-incoming-text': '#ede8ff',
    },
    preview: { bg:'#0d0818', incoming:'#150e28', outgoing:'#5b21b6', text:'#ede8ff' },
  },

  {
    id: 'aurora',
    name: 'Аврора',
    vars: {
      '--tg-bg': '#071410',
      '--tg-surface': '#0d1e18',
      '--tg-surface-light': '#142a22',
      '--tg-surface-dark': '#040e0a',
      '--tg-text': '#e0f5ee',
      '--tg-text-secondary': '#5a8a76',
      '--tg-accent': '#2dd4bf',
      '--tg-accent-hover': '#1baa97',
      '--tg-border': 'rgba(45,212,191,0.2)',
      '--tg-message-outgoing': '#0f5a4a',
      '--tg-message-incoming': '#0d1e18',
      '--tg-message-outgoing-text': '#e0f5ee',
      '--tg-message-incoming-text': '#e0f5ee',
    },
    preview: { bg:'#071410', incoming:'#0d1e18', outgoing:'#0f5a4a', text:'#e0f5ee' },
  },

  {
    id: 'midnight',
    name: 'Полночь',
    vars: {
      '--tg-bg': '#040608',
      '--tg-surface': '#080c12',
      '--tg-surface-light': '#0e1520',
      '--tg-surface-dark': '#020304',
      '--tg-text': '#ccd6f0',
      '--tg-text-secondary': '#445570',
      '--tg-accent': '#38bdf8',
      '--tg-accent-hover': '#0ea5e9',
      '--tg-border': 'rgba(56,189,248,0.18)',
      '--tg-message-outgoing': '#0c3c5c',
      '--tg-message-incoming': '#080c12',
      '--tg-message-outgoing-text': '#ccd6f0',
      '--tg-message-incoming-text': '#ccd6f0',
    },
    preview: { bg:'#040608', incoming:'#080c12', outgoing:'#0c3c5c', text:'#ccd6f0' },
  },

  {
    id: 'ember',
    name: 'Эмбер',
    vars: {
      '--tg-bg': '#100802',
      '--tg-surface': '#1c1006',
      '--tg-surface-light': '#261608',
      '--tg-surface-dark': '#0a0500',
      '--tg-text': '#f5e6d0',
      '--tg-text-secondary': '#8a6040',
      '--tg-accent': '#f97316',
      '--tg-accent-hover': '#ea6608',
      '--tg-border': 'rgba(249,115,22,0.2)',
      '--tg-message-outgoing': '#7c2d12',
      '--tg-message-incoming': '#1c1006',
      '--tg-message-outgoing-text': '#f5e6d0',
      '--tg-message-incoming-text': '#f5e6d0',
    },
    preview: { bg:'#100802', incoming:'#1c1006', outgoing:'#7c2d12', text:'#f5e6d0' },
  },

  {
    id: 'rose',
    name: 'Роза',
    vars: {
      '--tg-bg': '#100810',
      '--tg-surface': '#1a0e1c',
      '--tg-surface-light': '#241428',
      '--tg-surface-dark': '#0a040c',
      '--tg-text': '#f5e0f5',
      '--tg-text-secondary': '#8a5a8a',
      '--tg-accent': '#e879f9',
      '--tg-accent-hover': '#d946ef',
      '--tg-border': 'rgba(232,121,249,0.2)',
      '--tg-message-outgoing': '#701a75',
      '--tg-message-incoming': '#1a0e1c',
      '--tg-message-outgoing-text':'#f5e0f5',
      '--tg-message-incoming-text':'#f5e0f5',
    },
    preview: { bg:'#100810', incoming:'#1a0e1c', outgoing:'#701a75', text:'#f5e0f5' },
  },

  ,{
    id: 'glass',
    name: 'Liquid Glass',
    special: 'theme-glass',
    beta: true,
    vars: {
      '--tg-text': '#f0f4ff',
      '--tg-text-secondary': 'rgba(220,230,255,0.55)',
      '--tg-accent': '#a78bfa',
      '--tg-accent-hover': '#8b5cf6',
      '--tg-border': 'rgba(255,255,255,0.18)',
      '--tg-message-outgoing': 'rgba(109,74,255,0.28)',
      '--tg-message-incoming': 'rgba(255,255,255,0.08)',
      '--tg-message-outgoing-text': '#eeeeff',
      '--tg-message-incoming-text': '#f0f4ff',
    },
    preview: { bg:'rgba(18,14,36,0.15)', incoming:'rgba(255,255,255,0.12)', outgoing:'rgba(109,74,255,0.3)', text:'#f0f4ff', glass: true },
  },
  
  {
    id: 'transparent',
    name: 'Прозрачный',
    special: 'theme-transparent',
    vars: {
      '--tg-text': '#e2e8f5',
      '--tg-text-secondary': '#6b84a8',
      '--tg-accent': '#6d4aff',
      '--tg-accent-hover': '#5538e0',
      '--tg-border': 'rgba(109,74,255,0.18)',
      '--tg-message-outgoing-text': '#e2e8f5',
      '--tg-message-incoming-text': '#e2e8f5',
    },
    preview: { bg:'rgba(8,16,30,0.35)', incoming:'rgba(14,25,40,0.6)', outgoing:'rgba(55,48,163,0.6)', text:'#e2e8f5', transparent: true },
  },
];

let currentChatThemeId = 'cosmos';

function applyChatTheme(theme) {
  const root = document.documentElement;
  const overlay = document.getElementById('chat-overlay');

  // Убираем все специальные классы тем
  overlay.classList.remove('theme-glass', 'theme-transparent');

  // Применяем CSS-переменные
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));

  // Применяем специальный класс оверлея, если нужно
  if (theme.special) {
    overlay.classList.add(theme.special);
  }

  currentChatThemeId = theme.id;
  updateChatThemeGrid();
  if (typeof updateSetting === 'function') {
    updateSetting('chatTheme', theme.id);
    updateSetting('customThemeApplied', false);
  }
}

function updateChatThemeGrid() {
  document.querySelectorAll('.chat-theme-card').forEach(card => {
    card.classList.toggle('active', card.dataset.themeId === currentChatThemeId);
  });
}

function buildChatThemeGrid() {
  const grid = document.getElementById('chat-theme-grid');
  if (!grid || grid.dataset.built) return;
  grid.dataset.built = '1';

  const regularThemes = CHAT_THEMES.filter(t => !t.beta);
  const betaThemes = CHAT_THEMES.filter(t => t.beta);

  function makeCard(theme) {
    const card = document.createElement('div');
    card.className = 'chat-theme-card' + (theme.id === currentChatThemeId ? ' active' : '');
    card.dataset.themeId = theme.id;

    const preview = document.createElement('div');
    preview.className = 'chat-theme-preview';
    preview.style.background = theme.preview.bg;
    if (theme.preview.glass) {
      preview.style.backdropFilter = 'blur(16px)';
      preview.style.background = 'rgba(40,30,80,0.25)';
    }

    const msg1 = document.createElement('div');
    msg1.className = 'ctp-msg';
    msg1.style.background = theme.preview.incoming;
    msg1.style.color = theme.preview.text;
    if (theme.preview.glass) {
      msg1.style.backdropFilter = 'blur(8px)';
      msg1.style.border = '1px solid rgba(255,255,255,0.18)';
      msg1.style.boxShadow = 'inset 1px 1px 0 -1px rgba(255,255,255,0.5)';
    }
    msg1.textContent = 'Привет! 👋';

    const msg2 = document.createElement('div');
    msg2.className = 'ctp-msg me';
    msg2.style.background = theme.preview.outgoing;
    msg2.style.color = theme.preview.text;
    if (theme.preview.glass) {
      msg2.style.backdropFilter = 'blur(8px)';
      msg2.style.border = '1px solid rgba(109,74,255,0.4)';
      msg2.style.boxShadow = 'inset 1px 1px 0 -1px rgba(255,255,255,0.4)';
    }
    msg2.textContent = 'Здравствуй ✨';

    preview.appendChild(msg1);
    preview.appendChild(msg2);

    const name = document.createElement('div');
    name.className = 'chat-theme-name';
    name.textContent = theme.name;

    const check = document.createElement('div');
    check.className = 'chat-theme-check';
    check.innerHTML = '<svg width="8" height="8"><use href="#icon-check"/></svg>';

    card.appendChild(preview);
    card.appendChild(name);
    card.appendChild(check);
    card.addEventListener('click', () => applyChatTheme(theme));
    return card;
  }

  // Обычные темы
  const lblMain = document.createElement('div');
  lblMain.className = 'ctg-section-label';
  lblMain.textContent = 'Выберите тему';
  grid.appendChild(lblMain);

  const mainGrid = document.createElement('div');
  mainGrid.className = 'ctg-grid';
  regularThemes.forEach(t => mainGrid.appendChild(makeCard(t)));
  grid.appendChild(mainGrid);

  // Бета-темы
  if (betaThemes.length) {
    const lblBeta = document.createElement('div');
    lblBeta.className = 'ctg-section-label';
    lblBeta.innerHTML = '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.35);color:#fbbf24;letter-spacing:0.05em;">БЕТА</span>';
    grid.appendChild(lblBeta);

    const betaGrid = document.createElement('div');
    betaGrid.className = 'ctg-grid';
    betaThemes.forEach(t => betaGrid.appendChild(makeCard(t)));
    grid.appendChild(betaGrid);
  }
}

// Apply default theme on load - только если нет сохранённых настроек
(function() {
  try {
    const saved = JSON.parse(localStorage.getItem('star_sky_settings') || '{}');
    if (!saved.chatTheme && !saved.customThemeApplied) {
      applyChatTheme(CHAT_THEMES[0]);
    }
  } catch(e) { applyChatTheme(CHAT_THEMES[0]); }
})();

function buildBgGrid() {
  const grid = document.getElementById('bg-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const animated = BG_THEMES.filter(t => t.group === 'animated');
  const staticBg = BG_THEMES.filter(t => t.group === 'static');

  function makeSection(labelText, themes) {
    const lbl = document.createElement('div');
    lbl.className = 'bg-section-label';
    lbl.textContent = labelText;
    grid.appendChild(lbl);

    const cardsRow = document.createElement('div');
    cardsRow.className = 'bg-cards-grid';

    themes.forEach(theme => {
      const card = document.createElement('div');
      card.className = 'bg-card' + (theme.id === currentBgId ? ' active' : '');
      card.dataset.bgId = theme.id;

      const img = document.createElement('img');
      img.className = 'bg-card-preview';
      img.src = makeBgPreview(theme);
      img.alt = theme.label;

      const nameEl = document.createElement('div');
      nameEl.className = 'bg-card-name';
      nameEl.textContent = theme.label;

      const check = document.createElement('div');
      check.className = 'bg-card-check';
      check.innerHTML = '<svg width="8" height="8"><use href="#icon-check"/></svg>';

      card.appendChild(img);
      card.appendChild(nameEl);
      card.appendChild(check);

      // Кнопка настройки анимации только на анимированных темах
      if (theme.group === 'animated') {
        const animBtn = document.createElement('div');
        animBtn.className = 'bg-card-anim-btn';
        animBtn.title = 'Настройка анимации';
        animBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
        animBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          positionAnimModal(animBtn);
        });
        card.appendChild(animBtn);
      }

      card.addEventListener('click', () => {
        applyBgTheme(theme);
      });

      cardsRow.appendChild(card);
    });

    grid.appendChild(cardsRow);
  }

  makeSection('Анимированные', animated);
  makeSection('Статичные', staticBg);
}

function updateBgGrid() {
  document.querySelectorAll('.bg-card').forEach(card => {
    card.classList.toggle('active', card.dataset.bgId === currentBgId);
  });
}


// ===== ЭФФЕКТ СВЕЧЕНИЯ ГРАНИЦЫ =====
(function() {
  const GLOW_SELECTOR = [
    '.s-btn',
    '.sc-btn',
    '.skin-buy-btn',
    '.task-claim-btn',
    '.chat-tab',
    '.preset-btn',
    '.sound-s-btn',
  ].join(', ');

  function initGlow(el) {
    if (el.dataset.glowInit) return;
    el.dataset.glowInit = '1';
    el.classList.add('bg-glow-target');
    const span = document.createElement('span');
    span.className = 'btn-edge-light';
    el.appendChild(span);
  }

  function attachAll() {
    document.querySelectorAll(GLOW_SELECTOR).forEach(initGlow);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAll);
  } else {
    attachAll();
  }

  new MutationObserver(attachAll).observe(document.body, { childList: true, subtree: true });
})();

/* ===== МОБИЛЬНАЯ ВЕРСИЯ — элементы интерфейса (header, sheets, backdrop) ===== */
(function() {
  if (window.innerWidth > 640) return;

  const isMobile = () => window.innerWidth <= 640;
  if (!isMobile()) return;

  // Создаём мобильный header (вторая часть ниже)
  const header = document.createElement('div');
  header.id = 'mob-header';
  document.body.appendChild(header);

  // Backdrop для шторок
  const backdrop = document.createElement('div');
  backdrop.id = 'mob-sheet-backdrop';
  document.body.appendChild(backdrop);


  // ШТОРКА ЧАТА
  const chatSheet = document.createElement('div');
  chatSheet.id = 'mob-chat-sheet';
  chatSheet.className = 'mob-sheet open';
  chatSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="18" height="18"><use href="#icon-chat"/></svg> Общий чат
      </div>
      <button class="mob-sheet-close" data-close-sheet="chat">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <div id="mob-chat-tabs">
        <button class="mob-chat-tab active" data-tab="public">Общий</button>
        <button class="mob-chat-tab" data-tab="private">Приватный</button>
        <button class="mob-chat-tab" data-tab="favorites"><svg width="13" height="13" style="vertical-align:middle"><use href="#icon-star"/></svg></button>
      </div>
      <div id="mob-favorites-messages"></div>
      <div id="mob-private-messages" style="display:none;"></div>
      <div id="mob-chat-messages"></div>
      <div id="mob-reply-indicator">
        <svg width="11" height="11"><use href="#icon-reply"/></svg>
        <div id="mob-reply-text"></div>
        <button id="mob-reply-cancel">✕</button>
      </div>
      <div id="mob-chat-input-row">
        <button id="mob-emoji-btn" title="Эмодзи" style="width:36px;height:36px;flex-shrink:0;border-radius:10px;border:1px solid rgba(109,74,255,0.2);background:rgba(109,74,255,0.08);font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;">😊</button>
        <button id="mob-attach-btn" title="Прикрепить изображение" style="width:36px;height:36px;flex-shrink:0;border-radius:10px;border:1px solid rgba(109,74,255,0.2);background:rgba(109,74,255,0.08);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.15s;color:#8b9fd4;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="2"/><path d="M3 16l5-5 4 4 3-3 6 5"/></svg></button>
        <input type="file" id="mob-file-input" accept="image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.html,.js,.json,.csv" style="display:none;">
        <div id="mob-chat-input-wrap">
          <textarea id="mob-chat-input" rows="1" placeholder="Сообщение..."></textarea>
        </div>
        <button id="mob-chat-send">
          <svg width="18" height="18"><use href="#icon-send"/></svg>
        </button>
      </div>
    </div>`;
  document.body.appendChild(chatSheet);


  // ШТОРКА ПОИСКА
  const searchSheet = document.createElement('div');
  searchSheet.id = 'mob-search-sheet';
  searchSheet.className = 'mob-sheet';
  searchSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="18" height="18"><use href="#icon-search"/></svg> Поиск звёзд
      </div>
      <button class="mob-sheet-close" data-close-sheet="search">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <input type="text" id="mob-search-input" placeholder="Введите имя..." autocomplete="off">
      <div id="mob-search-results"></div>
      <div id="mob-search-actions">
        <button id="mob-search-go">
          <svg width="14" height="14"><use href="#icon-search"/></svg> Найти
        </button>
        <button id="mob-search-random">
          <svg width="14" height="14"><use href="#icon-refresh"/></svg> Случайно
        </button>
      </div>
    </div>`;
  document.body.appendChild(searchSheet);


  // ШТОРКА ЛИДЕРБОРДА
  const lbSheet = document.createElement('div');
  lbSheet.id = 'mob-lb-sheet';
  lbSheet.className = 'mob-sheet';
  lbSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="18" height="18"><use href="#icon-leaderboard"/></svg> Таблица лидеров
      </div>
      <button class="mob-sheet-close" data-close-sheet="lb">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <div id="mob-lb-list"></div>
    </div>`;
  document.body.appendChild(lbSheet);


  // ШТОРКА ЗАДАНИЙ
  const tasksSheet = document.createElement('div');
  tasksSheet.id = 'mob-tasks-sheet';
  tasksSheet.className = 'mob-sheet';
  tasksSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="18" height="18"><use href="#icon-tasks"/></svg> Задания
      </div>
      <button class="mob-sheet-close" data-close-sheet="tasks">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <div id="mob-tasks-list"></div>
    </div>`;
  document.body.appendChild(tasksSheet);


  // ШТОРКА ПРОФИЛЯ
  const profileSheet = document.createElement('div');
  profileSheet.id = 'mob-profile-sheet';
  profileSheet.className = 'mob-sheet';
  profileSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="18" height="18"><use href="#icon-user"/></svg> Мой профиль
      </div>
      <button class="mob-sheet-close" data-close-sheet="profile">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <!-- Hero-секция -->
      <div id="mob-profile-hero">
        <div id="mob-profile-avatar-lg">${MOCK_USER.display_name.charAt(0).toUpperCase()}</div>
        <div id="mob-profile-name-lg">${MOCK_USER.display_name}</div>
        <div id="mob-profile-handle-lg">@${MOCK_USER.username}</div>
        <div id="mob-profile-stats">
          <div class="mob-profile-stat">
            <div class="mob-profile-stat-val" id="mob-stat-score">0</div>
            <div class="mob-profile-stat-label">Очков</div>
          </div>
          <div class="mob-profile-stat">
            <div class="mob-profile-stat-val" id="mob-stat-friends">0</div>
            <div class="mob-profile-stat-label">Друзей</div>
          </div>
          <div class="mob-profile-stat">
            <div class="mob-profile-stat-val" id="mob-stat-rank" style="font-size:9px;line-height:1.3;">✨ Метеорит</div>
            <div class="mob-profile-stat-label">Статус</div>
          </div>
        </div>
      </div>

      <!-- Секции -->
      <div id="mob-profile-sections">
        <!-- Секция информации -->
        <div class="mob-profile-section">
          <div class="mob-profile-section-title">👤 Аккаунт</div>
          <div class="mob-profile-row">
            <span class="mob-profile-row-label">Имя</span>
            <span class="mob-profile-row-val">${MOCK_USER.display_name}</span>
          </div>
          <div class="mob-profile-row">
            <span class="mob-profile-row-label">Хэндл</span>
            <span class="mob-profile-row-val" id="mob-profile-row-handle">@${MOCK_USER.username}</span>
          </div>
          <div class="mob-profile-row">
            <span class="mob-profile-row-label">Статус</span>
            <span class="mob-profile-row-val" style="color:#22c55e;">🟢 В сети</span>
          </div>
        </div>
        <!-- Настройки и выход -->
        <div class="mob-profile-section">
          <div class="mob-profile-section-title">⚙️ Управление</div>
          <div class="mob-profile-row" style="border-bottom:none; padding-bottom:4px;">
            <button id="mob-logout-btn" style="width:100%;padding:9px;border-radius:9px;border:1px solid rgba(239,68,68,0.35);background:rgba(239,68,68,0.08);color:#ef4444;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;transition:all 0.2s;">
              🚪 Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>

    </div>`;
  document.body.appendChild(profileSheet);


  // ШТОРКА МАГАЗИНА
  const shopSheet = document.createElement('div');
  shopSheet.id = 'mob-shop-sheet';
  shopSheet.className = 'mob-sheet';
  shopSheet.innerHTML = `
    <div class="mob-sheet-handle"></div>
    <div class="mob-sheet-header">
      <div class="mob-sheet-title">
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="1.5"/><path d="M16 10a4 4 0 01-8 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        Магазин звёзд
      </div>
      <div id="mob-shop-balance"><span id="mob-balance-amount">0</span><em>очков</em></div>
      <button class="mob-sheet-close" data-close-sheet="shop">
        <svg width="30" height="30"><use href="#icon-close"/></svg>
      </button>
    </div>
    <div class="mob-sheet-body">
      <div class="skin-section" id="mob-shop-tab-colors-basic">
        <div class="skin-section-label"><span class="ssl-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg></span> Базовые цвета <span class="ssl-line"></span></div>
        <div class="skin-grid" id="mob-basic-colors-grid"></div>
      </div>
      <div class="skin-section" id="mob-shop-tab-colors-neon">
        <div class="skin-section-label"><span class="ssl-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> Неон <span class="ssl-line"></span></div>
        <div class="skin-grid" id="mob-neon-colors-grid"></div>
      </div>
      <div class="skin-section" id="mob-shop-tab-colors-cosmic">
        <div class="skin-section-label"><span class="ssl-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span> Космические <span class="ssl-line"></span></div>
        <div class="skin-grid" id="mob-cosmic-colors-grid"></div>
      </div>
      <div class="skin-section" id="mob-shop-tab-effects">
        <div class="skin-section-label"><span class="ssl-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/><path d="M19 3L19.75 5.25L22 6L19.75 6.75L19 9L18.25 6.75L16 6L18.25 5.25L19 3Z"/><path d="M5 17L5.5 18.5L7 19L5.5 19.5L5 21L4.5 19.5L3 19L4.5 18.5L5 17Z"/></svg></span> Эффекты <span class="ssl-line"></span></div>
        <div class="skin-grid" id="mob-effects-grid"></div>
      </div>
      <div class="skin-section" id="mob-shop-tab-effects-special">
        <div class="skin-section-label"><span class="ssl-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 18 3 22 9 12 22 2 9"/><polyline points="22 9 12 9 6 3"/><line x1="12" y1="9" x2="12" y2="22"/></svg></span> Особые <span class="ssl-line"></span></div>
        <div class="skin-grid" id="mob-special-effects-grid"></div>
      </div>
    </div>`;
  document.body.appendChild(shopSheet);

  // Синхронизация отображения баланса — глобальная для renderMobShop
  window.syncMobBalance = function() {
    const el = document.getElementById('mob-balance-amount');
    if (el) el.textContent = currentActivity;
  };

  // Мобильный профиль: синхронизация данных и привязка действий
  function refreshMobProfile() {
    // Синхронизация очков
    const scoreEl = document.getElementById('mob-stat-score');
    if (scoreEl) scoreEl.textContent = currentActivity;
    // Синхронизация бейджа статуса
    const rankEl = document.getElementById('mob-stat-rank');
    if (rankEl && typeof getUserStatus === 'function') {
      const myStar = stars.find(s => s.username === MOCK_USER.username);
      if (myStar) {
        const st = getDisplayStatus ? getDisplayStatus(myStar) : getUserStatus(myStar);
        if (st) {
          rankEl.textContent = st.label;
          rankEl.style.color = st.color;
          rankEl.title = st.desc;
        } else {
          rankEl.textContent = '—';
          rankEl.style.color = '#4a6080';
          rankEl.title = 'Статус пока не заслужен';
        }
      }
    }
    // Синхронизация имени цвета звезды
    const colorLabel = document.getElementById('mob-star-color-label');
    if (colorLabel) {
      const allItems = [...shopItems.basicColors, ...shopItems.neonColors, ...shopItems.cosmicColors];
      const found = allItems.find(i => i.color === currentStarColor);
      colorLabel.textContent = found ? found.name : currentStarColor;
    }
    // Синхронизация имени эффекта
    const effLabel = document.getElementById('mob-star-effect-label');
    if (effLabel) {
      const allEff = [...shopItems.effects, ...shopItems.specialEffects];
      const foundEff = allEff.find(i => i.id === currentEffect);
      effLabel.textContent = foundEff ? foundEff.name : '—';
    }
    // Синхронизация статуса звезды-курсора
    syncMobCursorUI();
  }

  // (кнопки магазина/друзей в профиле убраны)

  // Заполняем чат мобильными сообщениями
  function loadMobMessages() {
    const container = document.getElementById('mob-chat-messages');
    if (!container) return;
    container.innerHTML = '';
    (typeof MOCK_MESSAGES !== 'undefined' ? MOCK_MESSAGES : []).forEach((m, idx) => {
      const div = document.createElement('div');
      const isMe = m.username === MOCK_USER.username;
      div.className = 'chat-line ' + (isMe ? 'chat-me' : 'chat-other');
      const id = 'mock_' + idx;
      div.dataset.msgId = id;
      div.dataset.reactionKey = 'gen:' + id;
      div.innerHTML = `<div class="chat-username">${m.display_name}</div><div class="chat-text">${m.text}</div><div class="chat-time">${m.time}</div>`;
      container.appendChild(div);
      if (typeof applyStoredReactions === 'function') applyStoredReactions(div);
    });
    container.scrollTop = container.scrollHeight;
  }

  // Заполняем лидерборд
  function loadMobLeaderboard() {
    const el = document.getElementById('mob-lb-list');
    if (!el || typeof MOCK_USERS === 'undefined') return;
    el.innerHTML = '';
    const sorted = [...MOCK_USERS].sort((a,b)=>(b.activity_score||0)-(a.activity_score||0));
    sorted.forEach((u, i) => {
      const div = document.createElement('div');
      div.className = 'mob-lb-item';
      let rankClass = ''; if(i===0)rankClass='r1'; else if(i===1)rankClass='r2'; else if(i===2)rankClass='r3';
      const tmpStar = { activityScore: u.activity_score||0, daysActive: u.days_active||0, messagesSent: u.messages_sent||0, friendsCount: u.friends_count||0, active: !!u.active };
      const st = typeof getUserStatus === 'function' ? getUserStatus(tmpStar) : null;
      const bgColor = st ? st.color + '18' : 'transparent';
      const borderColor = st ? st.color + '50' : 'transparent';
      div.innerHTML = `
        <div class="mob-lb-rank ${rankClass}">${i+1}</div>
        <div class="mob-lb-info">
          <div class="mob-lb-name">${u.display_name}</div>
          <div class="mob-lb-handle">@${u.username}</div>
          ${st ? `<div style="display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:8px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${st.color};background:${bgColor};border:1px solid ${borderColor};margin-top:2px;">${st.label}</div>` : ''}
        </div>
        <div class="mob-lb-score"><svg width="11" height="11" style="vertical-align:middle;margin-right:2px"><use href="#icon-star"/></svg> ${u.activity_score}</div>`;
      div.onclick = () => {
        if (typeof focusOnUser === 'function') focusOnUser(u.username);
        closeAllSheets();
      };
      el.appendChild(div);
    });
  }

  // Заполняем задания
  function loadMobTasks() {
    const el = document.getElementById('mob-tasks-list');
    if (!el || typeof tasks === 'undefined') return;
    el.innerHTML = '';
    tasks.forEach(task => {
      const div = document.createElement('div');
      div.className = `task-item${task.completed?' completed':''}`;
      const pct = Math.round((task.progress/task.target)*100);
      div.innerHTML = `
        <div class="task-header"><span class="task-name">${task.name}</span><span class="task-reward">+${task.reward} <svg width="11" height="11" style="vertical-align:middle"><use href="#icon-points"/></svg></span></div>
        <div class="task-progress"><div class="task-progress-fill" style="width:${pct}%"></div></div>
        <div class="task-status">
          <span class="task-progress-text">${task.progress}/${task.target}</span>
          ${task.claimed ? '<span class="task-claim-btn completed">Получено</span>' : task.completed ? `<button class="task-claim-btn" onclick="claimTask('${task.id}')">Получить</button>` : `<span class="task-progress-text">${task.description}</span>`}
        </div>`;
      el.appendChild(div);
    });
  }


  // УПРАВЛЕНИЕ ШТОРКАМИ
  const sheetMap = {
    chat: document.getElementById('mob-chat-sheet'),
    search: document.getElementById('mob-search-sheet'),
    lb: document.getElementById('mob-lb-sheet'),
    tasks: document.getElementById('mob-tasks-sheet'),
    profile: document.getElementById('mob-profile-sheet'),
    shop: document.getElementById('mob-shop-sheet'),
  };
  let activeSheet = 'chat';

  function openSheet(name) {
    if (activeSheet && activeSheet !== name) {
      sheetMap[activeSheet]?.classList.remove('open');
    }
    activeSheet = name;
    const el = sheetMap[name];
    if (!el) return;
    el.classList.add('open');

    // Ленивая загрузка
    if (name === 'lb') loadMobLeaderboard();
    if (name === 'tasks') loadMobTasks();
    if (name === 'chat') { loadMobMessages(); }
    if (name === 'shop') {
      renderMobShop();
      if (typeof window.syncMobBalance === 'function') window.syncMobBalance();
      // Сброс прокрутки вверх после рендера
      requestAnimationFrame(() => {
        const b = document.querySelector('#mob-shop-sheet .mob-sheet-body');
        if (b) { b.scrollTop = 0; }
      });
    }
    if (name === 'profile') { if (typeof refreshMobProfile === 'function') refreshMobProfile(); if (typeof updateMobFollowerList === 'function') updateMobFollowerList(); }

    // Показываем backdrop только для шторок, кроме чата
    if (name !== 'chat') backdrop.classList.add('visible');
    else backdrop.classList.remove('visible');
  }

  function closeAllSheets() {
    document.querySelectorAll('.mob-sheet').forEach(s => s.classList.remove('open'));
    backdrop.classList.remove('visible');
    activeSheet = null;
  }

  function closeSheet(name) {
    sheetMap[name]?.classList.remove('open');
    if (activeSheet === name) {
      backdrop.classList.remove('visible');
      activeSheet = null;
    }
  }

  // Экспортируем управление шторками для мобильного drawer'а
  window._mobOpenSheet = openSheet;
  window._mobCloseSheet = closeSheet;
  window._mobCloseAllSheets = closeAllSheets;

  // Кнопки закрытия внутри шторок
  document.querySelectorAll('[data-close-sheet]').forEach(btn => {
    btn.addEventListener('click', () => closeSheet(btn.dataset.closeSheet));
  });

  // Клик по backdrop закрывает шторку
  backdrop.addEventListener('click', closeAllSheets);


  // ФУНКЦИОНАЛЬНОСТЬ ЧАТА
  loadMobMessages();

  // Переключение вкладок мобильного чата (общий / приват / избранное)
  function setMobChatTab(tab) {
    const msgs = document.getElementById('mob-chat-messages');
    const favs = document.getElementById('mob-favorites-messages');
    const privMsgs = document.getElementById('mob-private-messages');
    const inputRow = document.getElementById('mob-chat-input-row');
    const sheetTitle = document.querySelector('#mob-chat-sheet .mob-sheet-title');
    document.querySelectorAll('.mob-chat-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    // Сначала скрываем все контейнеры
    if (msgs) msgs.style.display = 'none';
    if (favs) favs.style.display = 'none';
    if (privMsgs) privMsgs.style.display = 'none';
    if (inputRow) inputRow.style.display = '';

    if (tab === 'public') {
      if (msgs) msgs.style.display = 'flex';
      if (sheetTitle) sheetTitle.innerHTML = '<svg width="18" height="18"><use href="#icon-chat"/></svg> Общий чат';

      loadMobMessages();
    } else if (tab === 'private') {
      if (privMsgs) { privMsgs.style.display = 'flex'; }
      // Заголовок обновляется через openMobPrivateChat
    } else if (tab === 'favorites') {
      if (favs) { favs.style.display = 'block'; renderMobFavorites(); }
      if (inputRow) inputRow.style.display = 'none';
      if (sheetTitle) sheetTitle.innerHTML = '<svg width="18" height="18"><use href="#icon-chat"/></svg> Избранное';
    }
  }

  // Открытие приватного чата на мобильных с конкретным пользователем
  function openMobPrivateChat(targetName) {
    const privMsgs = document.getElementById('mob-private-messages');
    const sheetTitle = document.querySelector('#mob-chat-sheet .mob-sheet-title');

    // Устанавливаем заголовок
    if (sheetTitle) sheetTitle.innerHTML = `<svg width="16" height="16"><use href="#icon-user"/></svg> 💬 ${targetName}`;
    // Очищаем и добавляем системное сообщение
    if (privMsgs) {
      // Добавляем приветствие, только если чат с этим пользователем ещё не открыт
      const existing = privMsgs.querySelector('.priv-partner-label');
      const partnerName = existing ? existing.dataset.name : '';
      if (partnerName !== targetName) {
        privMsgs.innerHTML = '';
        const intro = document.createElement('div');
        intro.className = 'chat-line chat-system priv-partner-label';
        intro.dataset.name = targetName;
        intro.textContent = `💬 Приватный чат с ${targetName}`;
        privMsgs.appendChild(intro);
      }
    }
    setMobChatTab('private');
  }
  window.openMobPrivateChat = openMobPrivateChat;

  document.getElementById('mob-chat-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.mob-chat-tab');
    if (!btn) return;
    setMobChatTab(btn.dataset.tab);
  });

  function renderMobFavorites() {
    const container = document.getElementById('mob-favorites-messages');
    if (!container) return;
    container.innerHTML = '';
    if (typeof favorites === 'undefined' || favorites.length === 0) {
      container.innerHTML = '<div style="color:#4a6080;font-size:12px;text-align:center;padding:32px 16px;line-height:1.8;"><svg width="24" height="24" style="display:block;margin:0 auto 8px"><use href="#icon-star"/></svg> Здесь будут<br>сохранённые сообщения.<br><span style="font-size:11px;color:#3d5473;">Долгий тап по сообщению →<br>Переслать</span></div>';
      return;
    }
    [...favorites].reverse().forEach((f, i) => {
      const realIdx = favorites.length - 1 - i;
      const card = document.createElement('div');
      card.className = 'chat-line chat-other';
      card.style.cssText = 'position:relative;padding-right:36px;';
      card.innerHTML = `<div class="chat-username">${f.username}</div><div class="chat-text">${f.text}</div><div class="chat-time">${f.savedAt}</div>`;
      const del = document.createElement('button');
      del.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.15);border:none;color:#ef4444;border-radius:6px;width:24px;height:24px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      del.textContent = '✕';
      del.addEventListener('click', () => {
        favorites.splice(realIdx, 1);
        if (typeof renderFavorites === 'function') renderFavorites();
        renderMobFavorites();
      });
      card.appendChild(del);
      container.appendChild(card);
    });
    container.scrollTop = container.scrollHeight;
  }
  window.renderMobFavorites = renderMobFavorites;

  const mobInput = document.getElementById('mob-chat-input');
  const mobSend = document.getElementById('mob-chat-send');

  function sendMobMessage() {
    const text = mobInput.value.trim();
    if (!text) return;
    // Определяем активную вкладку — отправляем в нужный контейнер
    const activeTab = document.querySelector('.mob-chat-tab.active')?.dataset.tab || 'public';
    const containerId = activeTab === 'private' ? 'mob-private-messages' : 'mob-chat-messages';
    const container = document.getElementById(containerId);
    if (!container) return;
    // Читаем контекст мобильного ответа
    const mobReplyEl = document.getElementById('mob-reply-indicator');
    const replyAuthor = mobReplyEl?.dataset?.replyAuthor || '';
    const replyQuote = mobReplyEl?.dataset?.replyQuote || '';
    const replyMsgId = mobReplyEl?.dataset?.replyMsgId || '';
    const replyBlock = (replyAuthor && replyQuote)
      ? `<div class="chat-reply-block" data-jump-to="${replyMsgId}"><div class="chat-reply-author">↩ ${replyAuthor}</div><div class="chat-reply-text">${replyQuote}</div></div>`
      : '';
    // Очищаем мобильный индикатор ответа
    if (mobReplyEl) {
      mobReplyEl.classList.remove('active');
      delete mobReplyEl.dataset.replyAuthor;
      delete mobReplyEl.dataset.replyQuote;
      delete mobReplyEl.dataset.replyMsgId;
    }
    const div = document.createElement('div');
    div.className = 'chat-line chat-me';
    if (activeTab === 'public') {
      _assignGenMsgId(div);
    } else {
      div.dataset.msgId = typeof _nextMsgId === 'function' ? _nextMsgId() : Date.now();
    }
    const now = new Date();
    const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    div.innerHTML = `<div class="chat-username">${MOCK_USER.display_name || MOCK_USER.username}</div>${replyBlock}<div class="chat-text">${text}</div><div class="chat-time">${t}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    mobInput.value = '';
    mobInput.style.height = '';
    // Зеркалим на десктоп только для общего чата
    if (activeTab === 'public' && typeof addChatLine === 'function') addChatLine({username: MOCK_USER.display_name || MOCK_USER.username, text}, 'chat-me');
    if (activeTab === 'public' && typeof saveChatMessages === 'function') saveChatMessages();
  }

  mobSend.addEventListener('click', sendMobMessage);
  mobInput.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMobMessage();} });

  // Кнопка эмодзи мобильных -> переиспользуем десктопный пикер
  document.getElementById('mob-emoji-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const picker = document.getElementById('emoji-picker');
    if (!picker) return;
    if (picker.classList.contains('visible')) {
      picker.classList.remove('visible');
      if (typeof closeEmojiPicker === 'function') closeEmojiPicker();
      return;
    }
    // Помечаем как мобильную цель для вставки эмодзи в mob-chat-input
    picker.dataset.mobTarget = '1';
    // Перемещаем пикер в body, чтобы обойти overflow:hidden на mob-chat-sheet
    if (picker.parentElement !== document.body) {
      picker._origParent = picker.parentElement;
      document.body.appendChild(picker);
    }
    // Фиксированная позиция над нижней навигацией
    picker.style.cssText = 'position:fixed!important;bottom:80px!important;left:8px!important;right:8px!important;top:auto!important;width:auto!important;max-width:none!important;z-index:99999!important;display:block!important;';
    if (typeof openEmojiPicker === 'function') {
      openEmojiPicker();
    } else {
      picker.classList.add('visible');
      if (typeof renderEmojiGrid === 'function' && typeof EMOJI_CATS !== 'undefined') renderEmojiGrid(EMOJI_CATS[0]);
    }
  });
  mobInput.addEventListener('input', () => {
    mobInput.style.height = ''; mobInput.style.height = Math.min(mobInput.scrollHeight, 80) + 'px';
  });


  // ПОИСК
  const mobSearchInput = document.getElementById('mob-search-input');
  const mobSearchResults = document.getElementById('mob-search-results');

  function doMobSearch(q) {
    if (!mobSearchResults) return;
    mobSearchResults.innerHTML = '';
    const query = q.trim().toLowerCase();
    if (!query || typeof MOCK_USERS === 'undefined') return;
    const found = MOCK_USERS.filter(u => u.username.includes(query) || (u.display_name||'').toLowerCase().includes(query));
    if (!found.length) { mobSearchResults.innerHTML = '<div style="color:#94a3b8;font-size:13px;padding:8px 0;">Не найдено</div>'; return; }
    found.forEach(u => {
      const div = document.createElement('div');
      div.className = 'mob-search-item';
      div.innerHTML = `
        <div class="mob-search-dot" style="background:${u.star_color||'#fff'};box-shadow:0 0 6px ${u.star_color||'#fff'}88"></div>
        <div>
          <div class="mob-search-name">${u.display_name}</div>
          <div class="mob-search-handle">@${u.username} ${u.active?'🟢':'⚫'}</div>
        </div>`;
      div.onclick = () => {
        if (typeof focusOnUser === 'function') focusOnUser(u.username);
        closeAllSheets();
      };
      mobSearchResults.appendChild(div);
    });
  }

  if (mobSearchInput) {
    mobSearchInput.addEventListener('input', () => doMobSearch(mobSearchInput.value));
  }
  document.getElementById('mob-search-go')?.addEventListener('click', () => doMobSearch(mobSearchInput.value));
  document.getElementById('mob-search-random')?.addEventListener('click', () => {
    if (typeof MOCK_USERS === 'undefined') return;
    const r = MOCK_USERS[Math.floor(Math.random()*MOCK_USERS.length)];
    if (typeof focusOnUser === 'function') focusOnUser(r.username);
    closeAllSheets();
  });

  // Кнопка прикрепления изображений в мобильном чате
  document.getElementById('mob-attach-btn')?.addEventListener('click', () => {
    document.getElementById('mob-file-input')?.click();
  });
  document.getElementById('mob-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const container = document.getElementById('mob-chat-messages');
      if (!container) return;
      const div = document.createElement('div');
      div.className = 'chat-line chat-me';
      const now = new Date();
      const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
      if (isImage) {
        div.innerHTML = `<div class="chat-username">${MOCK_USER.display_name || MOCK_USER.username}</div><div class="chat-text"><img src="${ev.target.result}" style="max-width:200px;max-height:180px;border-radius:10px;display:block;cursor:pointer;" alt="image"></div><div class="chat-time">${t}</div>`;
      } else {
        const sizeStr = file.size < 1024 ? file.size + ' Б' : file.size < 1048576 ? (file.size/1024).toFixed(1) + ' КБ' : (file.size/1048576).toFixed(1) + ' МБ';
        div.innerHTML = `<div class="chat-username">${MOCK_USER.display_name || MOCK_USER.username}</div><div class="chat-text"><a href="${ev.target.result}" download="${file.name}" style="display:flex;align-items:center;gap:10px;background:rgba(135,116,225,0.1);border:1px solid rgba(135,116,225,0.25);border-radius:12px;padding:10px 14px;text-decoration:none;color:inherit;min-width:180px;max-width:220px;cursor:pointer;"><div style="width:34px;height:34px;border-radius:8px;background:rgba(135,116,225,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8774e1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#e2e8f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</div><div style="font-size:10px;color:#8774e1;margin-top:3px;">Нажмите, чтобы скачать · ${sizeStr}</div></div></a></div><div class="chat-time">${t}</div>`;
      }
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  // Кнопка выхода в мобильном профиле
  document.addEventListener('click', (e) => {
    if (e.target.closest('#mob-logout-btn')) {
      const desktopLogout = document.getElementById('logout-btn');
      if (desktopLogout) desktopLogout.click();
      else {
        // Запасной вариант: показываем подтверждение
        if (confirm('Выйти из аккаунта?')) {
          showToast('👋 Выход из аккаунта...');
        }
      }
    }
  });

  // Касание по canvas для открытия карточки звезды
  const cvs = document.getElementById('starfield');
  let mobTouchStartX = 0, mobTouchStartY = 0, mobTouchMoved = false;
  cvs.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    mobTouchStartX = e.touches[0].clientX;
    mobTouchStartY = e.touches[0].clientY;
    mobTouchMoved = false;
  }, {passive: true});
  cvs.addEventListener('touchmove', e => {
    if (e.touches.length !== 1) return;
    if (Math.abs(e.touches[0].clientX - mobTouchStartX) > 8 || Math.abs(e.touches[0].clientY - mobTouchStartY) > 8) mobTouchMoved = true;
  }, {passive: true});
  cvs.addEventListener('touchend', e => {
    if (mobTouchMoved) return;
    const rect = cvs.getBoundingClientRect();
    const t = e.changedTouches[0];
    if (typeof getStarAtPosition === 'function') {
      const star = getStarAtPosition(t.clientX - rect.left, t.clientY - rect.top);
      if (star && typeof showStarCard === 'function') {
        e.preventDefault();
        showStarCard(star);
      }
    }
  }, {passive: false});

  // Контекстное меню по долгому нажатию в мобильном чате
  let _mobLongPressTimer = null;
  let _mobLongPressTarget = null;

  function startMobLongPress(e, msgEl) {
    _mobLongPressTarget = msgEl;
    _mobLongPressTimer = setTimeout(() => {
      if (!_mobLongPressTarget) return;
      // Вибрация, если поддерживается
      if (navigator.vibrate) navigator.vibrate(30);
      // Используем позицию касания для размещения меню
      const touch = e.touches ? e.touches[0] : e;
      const fakeEvent = {
        preventDefault: () => {},
        stopPropagation: () => {},
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
      showContextMenu(fakeEvent, _mobLongPressTarget);
      _mobLongPressTarget = null;
    }, 500);
  }

  function cancelMobLongPress() {
    clearTimeout(_mobLongPressTimer);
    _mobLongPressTimer = null;
  }

  const mobChatMsgs = document.getElementById('mob-chat-messages');
  if (mobChatMsgs) {
    mobChatMsgs.addEventListener('touchstart', (e) => {
      const line = e.target.closest('.chat-line:not(.chat-system)');
      if (!line) return;
      startMobLongPress(e, line);
    }, { passive: true });
    mobChatMsgs.addEventListener('touchend', cancelMobLongPress, { passive: true });
    mobChatMsgs.addEventListener('touchmove', cancelMobLongPress, { passive: true });
  }

  // Жест свайпа вниз на шторках
  let sheetSwipeStartY = 0;
  document.querySelectorAll('.mob-sheet').forEach(sheet => {
    sheet.addEventListener('touchstart', e => { sheetSwipeStartY = e.touches[0].clientY; }, {passive: true});
    sheet.addEventListener('touchend', e => {
      const dy = e.changedTouches[0].clientY - sheetSwipeStartY;
      if (dy > 80) {
        const id = sheet.id.replace('mob-','').replace('-sheet','');
        closeSheet(id);
      }
    }, {passive: true});
  });

})();

/* ===== МОБИЛЬНАЯ ВЕРСИЯ — содержимое header, drawer, FAB чата ===== */
(function () {
  if (window.innerWidth > 640) return;

  function $(id) { return document.getElementById(id); }

  function readUserInfo() {
    let initials = MOCK_USER.display_name.charAt(0).toUpperCase() || '?', userName = MOCK_USER.display_name || 'Пользователь', score = MOCK_USER.activity_score || 0;
    try {
      const raw = localStorage.getItem('star_sky_current_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u) {
          if (u.username) {
            userName = u.username;
            initials = String(u.username).trim().charAt(0).toUpperCase() || 'Т';
          }
          if (typeof u.activityScore === 'number') score = u.activityScore;
        }
      } else if (typeof MOCK_USER !== 'undefined' && MOCK_USER && MOCK_USER.display_name) {
        userName = MOCK_USER.display_name;
        initials = String(MOCK_USER.display_name).trim().charAt(0).toUpperCase();
        if (typeof MOCK_USER.activity_score === 'number') score = MOCK_USER.activity_score;
      }
    } catch (e) {}
    return { initials: initials, userName: userName, score: score };
  }

  function svgIcon(name, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '"><use href="#icon-' + name + '"/></svg>';
  }

  function apply() {
    const header = $('mob-header');
    if (!header) { setTimeout(apply, 50); return; }

    const info = readUserInfo();

    // Глушим виджеты/карусель/их таймеры на мобилке
    try {
      document.body.classList.add('mobile-no-toasts');

      // 1. Форсируем отключение автопрокрутки карусели в сохранённых настройках
      try {
        const raw = localStorage.getItem('star_sky_settings');
        const s = raw ? JSON.parse(raw) : {};
        s.carouselAutoScroll = false;
        s.carouselShowToast = false;
        localStorage.setItem('star_sky_settings', JSON.stringify(s));
      } catch (e) {}
      if (typeof window._carouselSetAutoScroll === 'function') window._carouselSetAutoScroll(false);
      
      // 2. Оборачиваем showToast, чтобы виджетные сообщения молчали
      if (typeof window.showToast === 'function' && !window._origShowToast) {
        window._origShowToast = window.showToast;
        const BLOCK = [
          /виджет/i, /widget/i,
          /автопрокрутка/i, /карусел/i,
          /онлайн/i, /погода/i, /weather/i
        ];
        window.showToast = function (msg) {
          try {
            const s = String(msg == null ? '' : msg);
            if (!s.trim()) return; // пустые/«технические» тосты — игнорируем
            for (let i = 0; i < BLOCK.length; i++) if (BLOCK[i].test(s)) return;
          } catch (e) {}
          return window._origShowToast.apply(this, arguments);
        };
      }

      // 3. Прячем все всплывающие виджет-модалки и их бэкдропы сразу на старте
      ['online-modal','weather-modal','widget-carousel-settings'].forEach(function(id){
        const el = document.getElementById(id);
        if (el) { el.classList.remove('visible'); el.style.display = 'none'; }
      });
      document.querySelectorAll('.widget-modal-overlay').forEach(function(o){
        o.classList.remove('visible'); o.style.display = 'none';
      });
    } catch (e) {}


    header.innerHTML =
      '<button class="nm-icon-btn" id="nm-menu-btn" aria-label="Меню">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
          '<line x1="4" y1="7" x2="20" y2="7"/>' +
          '<line x1="4" y1="12" x2="20" y2="12"/>' +
          '<line x1="4" y1="17" x2="20" y2="17"/>' +
        '</svg>' +
      '</button>' +
      '<div id="nm-title">STAR SKY</div>' +
      '<button class="nm-icon-btn" id="nm-notif-btn" aria-label="Уведомления" style="position:relative;">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>' +
          '<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' +
        '</svg>' +
        '<span class="nm-notif-dot" id="nm-notif-dot" style="display:none;"></span>' +
      '</button>' +
      '<button class="nm-avatar-btn" id="nm-avatar-btn" aria-label="Профиль">' + info.initials + '</button>';

    const chatSheet = $('mob-chat-sheet');

    if (chatSheet) {
      const prev = chatSheet.style.transition;
      chatSheet.style.transition = 'none';
      chatSheet.classList.remove('open');
      void chatSheet.offsetHeight;
      requestAnimationFrame(function () { chatSheet.style.transition = prev; });
    }

    const overlay = document.createElement('div');
    overlay.id = 'nm-drawer-overlay';
    document.body.appendChild(overlay);

    const drawer = document.createElement('div');
    drawer.id = 'nm-drawer';
    drawer.innerHTML =
      '<div id="nm-drawer-head">' +
        '<div id="nm-drawer-avatar">' + info.initials + '</div>' +
        '<div id="nm-drawer-name">' + info.userName + '</div>' +
        '<div id="nm-drawer-score">⭐ ' + info.score + ' активности</div>' +
      '</div>' +
      '<div id="nm-drawer-items">' +
        '<button class="nm-drawer-item" data-action="profile">' + svgIcon('user') + '<span class="nm-drawer-label">Профиль</span></button>' +
        '<button class="nm-drawer-item" data-action="search">' + svgIcon('search') + '<span class="nm-drawer-label">Поиск звёзд</span></button>' +
        '<button class="nm-drawer-item" data-action="leaderboard">' + svgIcon('leaderboard') + '<span class="nm-drawer-label">Топ лидеров</span></button>' +
        '<button class="nm-drawer-item" data-action="tasks">' + svgIcon('tasks') + '<span class="nm-drawer-label">Задания<span class="nm-badge-pill" id="nm-tasks-badge" style="display:none;">0</span></span></button>' +
        '<button class="nm-drawer-item" data-action="shop">' + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>' + '<span class="nm-drawer-label">Магазин</span></button>' +
        '<div class="nm-drawer-divider"></div>' +
        '<button class="nm-drawer-item nm-danger" data-action="logout">' + svgIcon('logout') + '<span class="nm-drawer-label">Выйти</span></button>' +
      '</div>';
    document.body.appendChild(drawer);

    const fab = document.createElement('button');
    fab.id = 'nm-chat-fab';
    fab.setAttribute('aria-label', 'Открыть чат');
    fab.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      '</svg>' +
      '<span class="nm-fab-badge" id="nm-fab-badge">0</span>';
    document.body.appendChild(fab);

    const backdrop = $('mob-sheet-backdrop');

    function openDrawer() { drawer.classList.add('open'); overlay.classList.add('visible'); }
    function closeDrawer() { drawer.classList.remove('open'); overlay.classList.remove('visible'); }

    function openSheetByName(name) {
      const map = {
        profile: 'mob-profile-sheet',
        search: 'mob-search-sheet',
        leaderboard: 'mob-lb-sheet',
        tasks: 'mob-tasks-sheet',
        shop: 'mob-shop-sheet'
      };
      const id = map[name];
      if (!id) return;
      document.querySelectorAll('.mob-sheet').forEach(function (s) {
        if (s.id !== id) s.classList.remove('open');
      });
      const el = $(id);
      if (el) el.classList.add('open');
      if (backdrop) backdrop.classList.add('visible');
    }

    $('nm-menu-btn').addEventListener('click', openDrawer);
    overlay.addEventListener('click', closeDrawer);

    $('nm-avatar-btn').addEventListener('click', function () {
      openSheetByName('profile');
    });

    // Кнопка уведомлений - открывает существующую панель
    const notifBtn = $('nm-notif-btn');
    if (notifBtn) {
      notifBtn.addEventListener('click', function () {
        if (typeof window.openNotifPanel === 'function') {
          window.openNotifPanel();
        } else {
          // fallback - через элемент
          const o = document.getElementById('notif-panel-overlay');
          if (o) o.classList.add('visible');
        }
      });
    }

    // Синхронизация красной точки на кнопке уведомлений
    function syncNotifDot() {
      try {
        const dot = $('nm-notif-dot');
        if (!dot) return;
        let unread = 0;
        if (typeof window.getUnreadNotifCount === 'function') unread = window.getUnreadNotifCount();
        else if (typeof window._unreadNotifCount === 'number') unread = window._unreadNotifCount;
        dot.style.display = unread > 0 ? 'block' : 'none';
      } catch (e) {}
    }
    syncNotifDot();
    setInterval(syncNotifDot, 3000);

    fab.addEventListener('click', function () {
      if (!chatSheet) return;
      chatSheet.classList.add('open');
      if (backdrop) backdrop.classList.remove('visible');
      document.querySelectorAll('.mob-sheet').forEach(function (s) {
        if (s.id !== 'mob-chat-sheet') s.classList.remove('open');
      });
      const msgs = $('mob-chat-messages');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    });

    drawer.addEventListener('click', function (e) {
      const item = e.target.closest('.nm-drawer-item');
      if (!item) return;
      const act = item.getAttribute('data-action');
      closeDrawer();
      setTimeout(function () {
        if (act === 'logout') {
          if (typeof logout === 'function') logout();
          return;
        }
        // Используем внутренний openSheet (он ленивый: грузит данные: leaderboard/tasks/shop/profile)
        const nameMap = { profile: 'profile', search: 'search', leaderboard: 'lb', tasks: 'tasks', shop: 'shop' };
        const internal = nameMap[act];
        if (internal && typeof window._mobOpenSheet === 'function') {
          window._mobOpenSheet(internal);
          return;
        }
        // Fallback - ручной путь, если что-то не проинициализировалось
        openSheetByName(act);
      }, 180);
    });

    // Заставляем все существующие кнопки закрытия шторок работать как закрытие
    document.querySelectorAll('[data-close-sheet]').forEach(function (btn) {
      // Дополнительно прячем backdrop и закрываем drawer (на случай промахов)
      btn.addEventListener('click', function () {
        if (backdrop) backdrop.classList.remove('visible');
      });
    });

    window.syncMobAvatar = function () {
      const i = readUserInfo();
      const a1 = $('nm-avatar-btn'); if (a1) a1.textContent = i.initials;
      const a2 = $('nm-drawer-avatar'); if (a2) a2.textContent = i.initials;
      const n = $('nm-drawer-name'); if (n) n.textContent = i.userName;
      const s = $('nm-drawer-score'); if (s) s.textContent = '⭐ ' + i.score + ' активности';
    };

    function refreshTaskBadge() {
      try {
        const sheet = $('mob-tasks-sheet');
        if (!sheet) return;
        const total = sheet.querySelectorAll('.mob-task-item, [data-task-id]').length;
        const done = sheet.querySelectorAll('.mob-task-item.completed, [data-task-done="true"]').length;
        const left = Math.max(0, total - done);
        const b = $('nm-tasks-badge');
        if (b) {
          if (left > 0) { b.textContent = String(left); b.style.display = ''; }
          else b.style.display = 'none';
        }
      } catch (e) {}
    }
    setTimeout(refreshTaskBadge, 1200);
    setInterval(refreshTaskBadge, 8000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();

// ===== PATCHNOTES — TIMELINE PRO =====
let PATCH_NOTES = [];

async function loadPatchNotes() {
    try {
        const response = await fetch('patchnotes.json');
        if (!response.ok) throw new Error('Не удалось загрузить patchnotes.json');

        PATCH_NOTES = await response.json();

        // Обновляем виджет «Пре-релиз · ДД.ММ.ГГГГ» в карусели
        updateTestBadgeVersion();

        // Перерисовываем модалки патчноутов под новые данные
        if (typeof buildPatchnotes === 'function') buildPatchnotes();
        if (typeof updateAboutInfo === 'function') updateAboutInfo();

    } catch (error) {
        console.error('❌ Ошибка загрузки патчноутов:', error);

        PATCH_NOTES = [{
            date: "—",
            current: true,
            changes: [{ type: "section", title: "Ошибка" }, { type: "fix", text: "Не удалось загрузить список обновлений" }]
        }];
        if (typeof buildPatchnotes === 'function') buildPatchnotes();
    }
}

// Обновление версии в виджете «Пре-релиз» (карусель верхней панели)
function updateTestBadgeVersion() {
    const testItems = document.querySelectorAll('.carousel-item[data-type="test"]');
    if (testItems.length === 0) return;

    let dateText = '—';
    if (typeof PATCH_NOTES !== 'undefined' && Array.isArray(PATCH_NOTES) && PATCH_NOTES.length > 0) {
        const currentVersion = PATCH_NOTES.find(p => p.current === true);
        if (currentVersion && currentVersion.date) {
            dateText = currentVersion.date;
        } else {
            const latest = PATCH_NOTES[PATCH_NOTES.length - 1];
            if (latest && latest.date) {
                dateText = latest.date;
            }
        }
    }

    testItems.forEach(item => {
        // Поддержка нового виджета build-widget
        const buildDate = item.querySelector('.build-widget-date');
        if (buildDate) buildDate.textContent = dateText;
        // Совместимость со старой разметкой (если осталась где-то)
        const versionSpan = item.querySelector('.test-version-span');
        if (versionSpan) versionSpan.textContent = dateText;
    });
}

// Запускаем загрузку как можно раньше
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPatchNotes);
} else {
  loadPatchNotes();
}

/* ----- Таблицы соответствия типов и тегов ----- */
const typeLabels = {
  new: 'Добавлено',
  chan: 'Изменено',
  upd: 'Улучшено',
  fix: 'Исправлено',
  fix_mob: 'Исправлено (моб.)',
  rem: 'Удалено'
};

/* ----- Меты секций и теги (автодетект) ----- */
const PN_TYPE_TO_SECTION = {
  new: 'Добавлено',
  upd: 'Улучшено',
  chan: 'Изменено',
  fix: 'Исправлено',
  fix_mob: 'Исправлено (моб.)',
  rem: 'Удалено',
};
const PN_SECTION_META = {
  'Добавлено':         { key: 'added',    short: 'Добавлено',  svg: 'icon-pn-plus'  },
  'Улучшено':          { key: 'improved', short: 'Улучшено',   svg: 'icon-pn-up'    },
  'Изменено':          { key: 'changed',  short: 'Изменено',   svg: 'icon-pn-edit'  },
  'Исправлено':        { key: 'fixed',    short: 'Исправлено', svg: 'icon-pn-tool'  },
  'Исправлено (моб.)': { key: 'fix_mob',  short: 'Моб. фикс',  svg: 'icon-pn-phone' },
  'Удалено':           { key: 'removed',  short: 'Удалено',    svg: 'icon-pn-trash' },
};
const PN_SECTION_ORDER = ['added', 'improved', 'changed', 'fixed', 'fix_mob', 'removed'];

const PN_MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

function pnEscapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function pnEscapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pnHighlight(text, query) {
  const t = pnEscapeHtml(text);
  if (!query) return t;
  const q = query.trim();
  if (q.length < 2) return t;
  const re = new RegExp(`(${pnEscapeRegExp(q)})`, 'gi');
  return t.replace(re, '<mark class="pn-hl">$1</mark>');
}
function pnParseDate(d) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(d || '');
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: parseInt(m[2], 10), year: parseInt(m[3], 10) };
}
function pnMonthLabel(d) {
  const p = pnParseDate(d);
  if (!p) return '—';
  return `${PN_MONTHS_RU[p.month - 1]} ${p.year}`;
}
function pnGroupSections(p) {
  const sections = [];
  let cur = null;
  for (const ch of (p.changes || [])) {
    if (ch.type === 'section') {
      if (cur && cur.items.length) sections.push(cur);
      const meta = PN_SECTION_META[ch.title] || { key: 'added', short: ch.title, svg: 'icon-pn-plus' };
      cur = { title: ch.title, key: meta.key, short: meta.short, svg: meta.svg, items: [] };
    } else if (cur) {
      cur.items.push({ text: ch.text || '', type: ch.type });
    }
  }
  if (cur && cur.items.length) sections.push(cur);
  return sections;
}

/* ----- Глобальное состояние Timeline ----- */
let PN_VERSIONS = [];
let PN_CURRENT_INDEX = -1;
const PN_LS_LAST_VISIT = 'pn_last_visit_ts';
const PN_LS_KNOWN_DATES = 'pn_known_dates';
const PN_LS_COLLAPSED_MONTHS = 'pn_collapsed_months';

function pnRebuildModel() {
  // от новой к старой (в JSON старые сверху, актуальная в конце)
  const list = [...PATCH_NOTES].reverse();
  PN_VERSIONS = list.map((p, i) => {
    const sections = pnGroupSections(p);
    const total = sections.reduce((s, sec) => s + sec.items.length, 0);
    const versionLabel = p.version
      ? p.version.replace(/^Версия\s+/i, 'v ')
      : `v ${PATCH_NOTES.length - i}`;
    return {
      idx: i,
      raw: p,
      version: versionLabel,
      date: p.date,
      current: !!p.current,
      sections,
      total,
    };
  });
  PN_CURRENT_INDEX = PN_VERSIONS.findIndex(v => v.current);
  if (PN_CURRENT_INDEX < 0 && PN_VERSIONS.length) PN_CURRENT_INDEX = 0;
}

/* ----- buildPatchnotes — публичная точка входа: пересобирает модель и
   перерисовывает обе модалки (Timeline + «последний патчноут»). ----- */
function buildPatchnotes() {
  pnRebuildModel();
  if (typeof window.__pnRefresh === 'function') window.__pnRefresh();
  if (typeof window.__lpnRefresh === 'function') window.__lpnRefresh();
}

/* ----- Рендер одной секции ----- */
function pnRenderSection(sec, query) {
  const itemsHtml = sec.items
    .map((it) => `<div class="pn-item-row"><span class="pn-item-row-text">${pnHighlight(it.text, query)}</span></div>`)
    .join('');
  const iconHtml = sec.svg ? `<svg width="12" height="12"><use href="#${sec.svg}"/></svg>` : '';
  return `
    <div class="pn-section pn-sec--${sec.key}" data-sec-key="${sec.key}">
      <div class="pn-section-head">
        <div class="pn-section-title">${iconHtml}${pnEscapeHtml(sec.short)}</div>
        <div class="pn-section-count">${sec.items.length}</div>
      </div>
      <div class="pn-section-list">${itemsHtml}</div>
    </div>
  `;
}

/* ============================================================
   Timeline Pro: главная модалка «История изменений»
   ============================================================ */
(function pnInit() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    const overlay   = document.getElementById('patchnotes-overlay');
    const modal     = document.getElementById('patchnotes-modal');
    const closeBtn  = document.getElementById('patchnotes-close');
    const openBtn   = document.getElementById('open-patchnotes-btn');
    if (!overlay || !modal) return;

    const listEl    = document.getElementById('patchnotes-list');
    const sideFoot  = document.getElementById('pn-side-foot');
    const searchEl  = document.getElementById('pn-search');
    const jumpBtn   = document.getElementById('pn-jumpcurrent');
    const typeChips = document.getElementById('pn-type-chips');
    const versionEl = document.getElementById('pn-version');
    const dateEl    = document.getElementById('pn-date');
    const currentEl = document.getElementById('pn-current');

    const statsEl   = document.getElementById('pn-stats');
    const bodyEl    = document.getElementById('pn-body');
    const stickyEl  = modal.querySelector('.pn-detail-stickyhead');
    const progressEl = document.getElementById('pn-progress');
    const unreadEl   = document.getElementById('pn-unread');
    const calendarEl = document.getElementById('pn-calendar');
    const toastEl    = document.getElementById('pn-toast');
    const toggleAllBtn = document.getElementById('pn-toggle-all');
    const copyBtn   = document.getElementById('pn-copy');
    const shareBtn  = document.getElementById('pn-share');

    /* state */
    let active = 0;
    let query = '';
    let view = 'list';                         // list | calendar
    let typeFilter = new Set();                // Set<key>
    let collapsed = new Set();                 // section keys collapsed in current detail
    let allCollapsed = false;
    let collapsedMonths = loadCollapsedMonths(); // ключ месяца → "YYYY-MM"

    function loadCollapsedMonths() {
      try { return new Set(JSON.parse(localStorage.getItem(PN_LS_COLLAPSED_MONTHS) || '[]')); }
      catch { return new Set(); }
    }
    function saveCollapsedMonths() {
      try { localStorage.setItem(PN_LS_COLLAPSED_MONTHS, JSON.stringify([...collapsedMonths])); } catch (_) {}
    }

    /* helpers */
    function getKnownDates() {
      try { return new Set(JSON.parse(localStorage.getItem(PN_LS_KNOWN_DATES) || '[]')); }
      catch { return new Set(); }
    }
    function setKnownDates(set) {
      try { localStorage.setItem(PN_LS_KNOWN_DATES, JSON.stringify([...set])); } catch (_) {}
    }
    function unreadCount() {
      const known = getKnownDates();
      return PN_VERSIONS.filter(v => !known.has(v.date)).length;
    }
    function markAllRead() {
      const known = getKnownDates();
      PN_VERSIONS.forEach(v => known.add(v.date));
      setKnownDates(known);
      try { localStorage.setItem(PN_LS_LAST_VISIT, String(Date.now())); } catch (_) {}
      updateOpenBtnBadge();
    }
    function updateOpenBtnBadge() {
      if (!openBtn) return;
      const cnt = unreadCount();
      const existing = openBtn.querySelector('.pn-open-badge');
      if (cnt > 0) {
        if (existing) {
          existing.textContent = cnt;
        } else {
          const sp = document.createElement('span');
          sp.className = 'pn-open-badge';
          sp.textContent = cnt;
          sp.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#a3e635;color:#0a0e1c;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #050714;line-height:1;';
          openBtn.style.position = openBtn.style.position || 'relative';
          openBtn.appendChild(sp);
        }
      } else if (existing) {
        existing.remove();
      }
    }

    function matchesQuery(v, q) {
      if (!q) return true;
      const Q = q.toLowerCase();
      if ((v.date || '').toLowerCase().includes(Q)) return true;
      if ((v.version || '').toLowerCase().includes(Q)) return true;
      return v.sections.some(s => s.items.some(it => it.text.toLowerCase().includes(Q)));
    }
    function matchesTypeFilter(v) {
      if (typeFilter.size === 0) return true;
      return v.sections.some(s => typeFilter.has(s.key));
    }
    function passes(v) { return matchesQuery(v, query) && matchesTypeFilter(v); }

    function showToast(text) {
      if (!toastEl) return;
      toastEl.textContent = text;
      toastEl.classList.add('visible');
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toastEl.classList.remove('visible'), 1700);
    }

    /* renderers */
    function renderTypeChips() {
      if (!typeChips) return;
      const all = `<button class="pn-chip ${typeFilter.size === 0 ? 'active' : ''}" data-type="">Все типы</button>`;
      const items = PN_SECTION_ORDER.map(k => {
        const meta = Object.values(PN_SECTION_META).find(m => m.key === k);
        if (!meta) return '';
        const active = typeFilter.has(k) ? 'active' : '';
        return `<button class="pn-chip pn-sec--${k} ${active}" data-type="${k}">
          <span class="pn-chip-dot"></span>${pnEscapeHtml(meta.short)}
        </button>`;
      }).join('');
      typeChips.innerHTML = all + items;
      typeChips.querySelectorAll('.pn-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.getAttribute('data-type');
          if (!t) typeFilter.clear();
          else if (typeFilter.has(t)) typeFilter.delete(t);
          else typeFilter.add(t);
          renderTypeChips();
          renderList();
          renderDetail();
          renderCalendar();
        });
      });
    }

    function monthKey(date) {
      const p = pnParseDate(date);
      return p ? `${p.year}-${String(p.month).padStart(2, '0')}` : '';
    }

    function renderList() {
      if (!listEl) return;
      const items = PN_VERSIONS.filter(passes);
      const known = getKnownDates();
      const visibleCount = items.length;
      const total = PN_VERSIONS.length;
      const activePos = items.findIndex(v => v.idx === active) + 1;
      if (progressEl) progressEl.textContent = `${activePos > 0 ? activePos : '—'} из ${visibleCount} (всего ${total})`;
      if (visibleCount === 0) {
        listEl.innerHTML = `<div class="pn-detail-empty">Ничего не найдено</div>`;
        renderSideFoot();
        return;
      }
      // группируем по месяцам (с сохранением порядка)
      const monthBuckets = [];
      const byMonthKey = new Map();
      for (const v of items) {
        const mk = monthKey(v.date);
        const ml = pnMonthLabel(v.date);
        if (!byMonthKey.has(mk)) {
          const bucket = { mk, ml, vs: [] };
          byMonthKey.set(mk, bucket);
          monthBuckets.push(bucket);
        }
        byMonthKey.get(mk).vs.push(v);
      }
      let html = '';
      for (const b of monthBuckets) {
        const isCollapsed = collapsedMonths.has(b.mk);
        html += `<div class="pn-month ${isCollapsed ? 'collapsed' : ''}" data-mk="${b.mk}" role="button" tabindex="0">
          <span class="pn-month-label">${pnEscapeHtml(b.ml)}</span>
          <span class="pn-month-count">${b.vs.length}</span>
          <svg class="pn-month-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;
        html += `<div class="pn-month-group ${isCollapsed ? 'collapsed' : ''}" data-mk="${b.mk}">`;
        for (const v of b.vs) {
          const dots = v.sections
            .map(s => `<span class="pn-dot pn-sec--${s.key}"></span>`)
            .join('');
          const isActive = v.idx === active;
          const isUnread = !known.has(v.date);
          html += `
            <div class="pn-item ${v.current ? 'current' : ''} ${isActive ? 'active' : ''}" data-idx="${v.idx}">
              <div class="pn-item-info">
                <div class="pn-item-date">
                  ${isUnread ? '<span class="pn-new-dot"></span>' : ''}
                  ${pnEscapeHtml(v.date)}
                </div>
                <div class="pn-item-meta">${dots}</div>
              </div>
              ${v.current ? '<span class="pn-current-pill" style="font-size:9px;padding:2px 7px;">Сейчас</span>' : ''}
            </div>
          `;
        }
        html += `</div>`;
      }
      listEl.innerHTML = html;
      listEl.querySelectorAll('.pn-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx, 10);
          select(idx);
        });
      });
      listEl.querySelectorAll('.pn-month').forEach(el => {
        const toggle = () => {
          const mk = el.dataset.mk;
          const wasCollapsed = collapsedMonths.has(mk);
          if (wasCollapsed) collapsedMonths.delete(mk);
          else collapsedMonths.add(mk);
          saveCollapsedMonths();
          const nowCollapsed = !wasCollapsed;
          el.classList.toggle('collapsed', nowCollapsed);
          const grp = listEl.querySelector(`.pn-month-group[data-mk="${mk}"]`);
          if (grp) grp.classList.toggle('collapsed', nowCollapsed);
        };
        el.addEventListener('click', toggle);
        el.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
        });
      });
      renderSideFoot();
    }

    function renderSideFoot() {
      if (!sideFoot) return;
      const total = PN_VERSIONS.reduce((s, v) => s + v.total, 0);
      const lastDate = PN_VERSIONS[0]?.date || '—';
      const firstDate = PN_VERSIONS[PN_VERSIONS.length - 1]?.date || '—';
      const monthsSpan = (() => {
        const a = pnParseDate(firstDate); const b = pnParseDate(lastDate);
        if (!a || !b) return '—';
        return `${PN_MONTHS_RU[a.month - 1]} ${a.year} → ${PN_MONTHS_RU[b.month - 1]} ${b.year}`;
      })();
      sideFoot.innerHTML = `
        <div class="row"><span>Версий</span><b>${PN_VERSIONS.length}</b></div>
        <div class="row"><span>Изменений</span><b>${total}</b></div>
        <div class="row"><span>Период</span><b>${pnEscapeHtml(monthsSpan)}</b></div>
      `;
    }

    function renderDetail() {
      if (!bodyEl) return;
      const v = PN_VERSIONS[active];
      if (!v) {
        if (versionEl) versionEl.textContent = 'v —';
        if (dateEl) dateEl.textContent = '— · —';
        if (currentEl) currentEl.style.display = 'none';
        if (statsEl) statsEl.innerHTML = '';
        bodyEl.innerHTML = `<div class="pn-detail-empty">Версия не выбрана</div>`;
        return;
      }
      // fade
      [stickyEl, statsEl, bodyEl].forEach(el => el && el.classList.add('fading'));
      requestAnimationFrame(() => {
        if (versionEl) versionEl.textContent = v.version;
        if (dateEl) dateEl.textContent = `${v.date} · ${pnMonthLabel(v.date)}`;
        if (currentEl) currentEl.style.display = v.current ? 'inline-flex' : 'none';

        if (statsEl) statsEl.innerHTML = v.sections
          .map(s => `<span class="pn-stat pn-sec--${s.key}"><svg width="11" height="11"><use href="#${s.svg}"/></svg>${pnEscapeHtml(s.short)} · ${s.items.length}</span>`)
          .join('');

        // Применяем фильтр по типу
        let secs = v.sections;
        if (typeFilter.size) secs = secs.filter(s => typeFilter.has(s.key));
        if (!secs.length) {
          bodyEl.innerHTML = `<div class="pn-detail-empty">В этой версии нет изменений по выбранным фильтрам</div>`;
        } else {
          bodyEl.innerHTML = secs.map(s => {
            const html = pnRenderSection(s, query);
            if (allCollapsed || collapsed.has(s.key)) {
              return html.replace('class="pn-section', 'class="pn-section collapsed');
            }
            return html;
          }).join('');
        }
        // секции — клик по заголовку сворачивает
        bodyEl.querySelectorAll('.pn-section').forEach(secEl => {
          const head = secEl.querySelector('.pn-section-head');
          const key = secEl.getAttribute('data-sec-key');
          head.addEventListener('click', () => {
            if (collapsed.has(key)) collapsed.delete(key);
            else collapsed.add(key);
            secEl.classList.toggle('collapsed');
          });
        });

        // URL deep-link
        try {
          const newHash = `#v=${v.date}`;
          if (overlay.classList.contains('visible') && location.hash !== newHash) {
            history.replaceState(null, '', newHash);
          }
        } catch (_) {}

        [stickyEl, statsEl, bodyEl].forEach(el => el && el.classList.remove('fading'));
      });
    }

    function renderCalendar() {
      if (!calendarEl) return;
      // группируем версии по году-месяцу
      const visible = PN_VERSIONS.filter(passes);
      const byMonth = new Map();
      visible.forEach(v => {
        const p = pnParseDate(v.date); if (!p) return;
        const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
        if (!byMonth.has(key)) byMonth.set(key, { year: p.year, month: p.month, vs: [] });
        byMonth.get(key).vs.push(v);
      });
      const keys = [...byMonth.keys()].sort().reverse();
      const dayHeads = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
      let html = '';
      keys.forEach(k => {
        const m = byMonth.get(k);
        const monthName = `${PN_MONTHS_RU[m.month - 1]} ${m.year}`;
        const totalChanges = m.vs.reduce((s, v) => s + v.total, 0);
        // дни месяца
        const daysInMonth = new Date(m.year, m.month, 0).getDate();
        const firstDay = new Date(m.year, m.month - 1, 1).getDay(); // 0=вс
        const offset = (firstDay + 6) % 7; // понедельник = 0
        let cells = '';
        dayHeads.forEach(dh => { cells += `<div class="pn-cal-dayhead">${dh}</div>`; });
        for (let i = 0; i < offset; i++) cells += `<div class="pn-cal-cell empty"></div>`;
        for (let d = 1; d <= daysInMonth; d++) {
          const dd = String(d).padStart(2, '0');
          const mm = String(m.month).padStart(2, '0');
          const dateStr = `${dd}.${mm}.${m.year}`;
          const v = m.vs.find(x => x.date === dateStr);
          if (v) {
            const dots = v.sections
              .slice(0, 4)
              .map(s => `<span class="pn-sec--${s.key}"></span>`)
              .join('');
            cells += `<div class="pn-cal-cell has-release ${v.current ? 'current' : ''}" data-idx="${v.idx}" title="${pnEscapeHtml(v.date)}">${d}<div class="pn-cal-cell-dots">${dots}</div></div>`;
          } else {
            cells += `<div class="pn-cal-cell">${d}</div>`;
          }
        }
        html += `
          <div class="pn-cal-month">
            <div class="pn-cal-month-title">
              ${pnEscapeHtml(monthName)}
              <span class="pn-cal-month-stats">${m.vs.length} релиз(ов) · ${totalChanges} изменен.</span>
            </div>
            <div class="pn-cal-grid">${cells}</div>
          </div>
        `;
      });
      calendarEl.innerHTML = html || `<div class="pn-detail-empty">Нет данных</div>`;
      calendarEl.querySelectorAll('.pn-cal-cell.has-release').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.dataset.idx, 10);
          setView('list');
          select(idx);
        });
      });
    }

    function setView(v) {
      view = v;
      modal.classList.toggle('pn--calendar', view === 'calendar');
      modal.querySelectorAll('.pn-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.pnView === view);
      });
      if (view === 'calendar') renderCalendar();
    }

    function select(idx) {
      active = idx;
      const v = PN_VERSIONS[active];
      if (v) {
        // помечаем как прочитанную
        const known = getKnownDates();
        if (!known.has(v.date)) { known.add(v.date); setKnownDates(known); }
        // если месяц активной версии свёрнут — разворачиваем
        const mk = monthKey(v.date);
        if (mk && collapsedMonths.has(mk)) {
          collapsedMonths.delete(mk);
          saveCollapsedMonths();
        }
      }
      renderList();
      renderDetail();
      // прокрутить активную версию в видимую область
      setTimeout(() => {
        const el = listEl?.querySelector('.pn-item.active');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      }, 30);
    }

    function open() {
      pnRebuildModel();
      // deep-link
      const m = /#v=(\d{2}\.\d{2}\.\d{4})/.exec(location.hash || '');
      if (m) {
        const idx = PN_VERSIONS.findIndex(v => v.date === m[1]);
        if (idx >= 0) active = idx;
        else active = PN_CURRENT_INDEX >= 0 ? PN_CURRENT_INDEX : 0;
      } else {
        active = PN_CURRENT_INDEX >= 0 ? PN_CURRENT_INDEX : 0;
      }
      setView('list');
      collapsed.clear();
      allCollapsed = false;
      // активный месяц всегда раскрыт при открытии
      if (PN_VERSIONS[active]) {
        const mk = monthKey(PN_VERSIONS[active].date);
        if (mk) collapsedMonths.delete(mk);
        saveCollapsedMonths();
      }

      renderTypeChips();
      renderList();
      renderDetail();
      renderCalendar();

      // непрочитанные → пилюля в шапке
      const cnt = unreadCount();
      if (unreadEl) {
        if (cnt > 0) { unreadEl.textContent = `${cnt} непрочит.`; unreadEl.style.display = 'inline-flex'; }
        else { unreadEl.style.display = 'none'; }
      }

      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';

      // помечаем все прочитанными при открытии
      setTimeout(() => { markAllRead(); }, 600);

      // прокрутить активную в центр
      setTimeout(() => {
        const el = listEl?.querySelector('.pn-item.active');
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
      }, 80);
    }
    function close() {
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
      try {
        if (location.hash && location.hash.startsWith('#v=')) {
          history.replaceState(null, '', location.pathname + location.search);
        }
      } catch (_) {}
    }

    /* listeners */
    if (openBtn) openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    modal.querySelectorAll('.pn-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => setView(btn.dataset.pnView));
    });

    if (searchEl) {
      searchEl.addEventListener('input', e => {
        query = e.target.value || '';
        const v = PN_VERSIONS[active];
        if (query && v && !matchesQuery(v, query)) {
          const first = PN_VERSIONS.find(x => matchesQuery(x, query));
          if (first) active = first.idx;
        }
        renderList();
        renderDetail();
      });
    }
    if (jumpBtn) jumpBtn.addEventListener('click', () => {
      if (PN_CURRENT_INDEX >= 0) select(PN_CURRENT_INDEX);
    });

    if (toggleAllBtn) toggleAllBtn.addEventListener('click', () => {
      allCollapsed = !allCollapsed;
      collapsed.clear();
      renderDetail();
    });

    if (copyBtn) copyBtn.addEventListener('click', () => {
      const v = PN_VERSIONS[active]; if (!v) return;
      const lines = [`${v.version} · ${v.date}`];
      v.sections.forEach(s => {
        lines.push('');
        lines.push(`▾ ${s.short}`);
        s.items.forEach(it => lines.push(`• ${it.text}`));
      });
      const text = lines.join('\n');
      try {
        navigator.clipboard.writeText(text).then(() => showToast('Скопировано'));
      } catch (_) { showToast('Не удалось скопировать'); }
    });

    if (shareBtn) shareBtn.addEventListener('click', () => {
      const v = PN_VERSIONS[active]; if (!v) return;
      const url = `${location.origin}${location.pathname}#v=${encodeURIComponent(v.date)}`;
      try {
        navigator.clipboard.writeText(url).then(() => showToast('Ссылка скопирована'));
      } catch (_) { showToast('Не удалось скопировать ссылку'); }
    });

    /* keyboard */
    document.addEventListener('keydown', (e) => {
      const isOpen = overlay.classList.contains('visible');
      if (!isOpen) return;
      // не реагируем на Esc/стрелки если фокус во input/textarea
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea';

      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === '/' && !inField) {
        e.preventDefault();
        searchEl?.focus();
        return;
      }
      if (e.key === 'ArrowDown' && !inField) {
        e.preventDefault();
        const items = PN_VERSIONS.filter(passes);
        const i = items.findIndex(v => v.idx === active);
        const next = items[Math.min(items.length - 1, i + 1)];
        if (next) select(next.idx);
        return;
      }
      if (e.key === 'ArrowUp' && !inField) {
        e.preventDefault();
        const items = PN_VERSIONS.filter(passes);
        const i = items.findIndex(v => v.idx === active);
        const prev = items[Math.max(0, i - 1)];
        if (prev) select(prev.idx);
        return;
      }
    });

    // Экспорт в обновлятор для buildPatchnotes()
    window.__pnRefresh = function () {
      if (!overlay.classList.contains('visible')) {
        // если модалка закрыта — просто обновим бейдж непрочитанных и закончим
        updateOpenBtnBadge();
        return;
      }
      // если открыта — мягко перерисуем всё
      const cur = PN_VERSIONS[active];
      if (!cur) {
        active = PN_CURRENT_INDEX >= 0 ? PN_CURRENT_INDEX : 0;
      }
      renderTypeChips();
      renderList();
      renderDetail();
      renderCalendar();
    };

    updateOpenBtnBadge();
  }
})();

/* ============================================================
   Модалка «Последний патчноут» (ЛКМ по виджету сборки)
   ============================================================ */
(function lpnInit() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  function boot() {
    const overlay   = document.getElementById('latest-patchnote-overlay');
    if (!overlay) return;
    const modal     = document.getElementById('latest-patchnote-modal');
    const closeBtn  = document.getElementById('latest-patchnote-close');
    const closeBtn2 = document.getElementById('latest-patchnote-close-btn');
    const verEl     = document.getElementById('lpn-version');
    const dateEl    = document.getElementById('lpn-date');
    const statsEl   = document.getElementById('lpn-stats');
    const bodyEl    = document.getElementById('lpn-body');
    const openHist  = document.getElementById('lpn-open-history');

    function fillContent() {
      pnRebuildModel();
      const v = PN_CURRENT_INDEX >= 0 ? PN_VERSIONS[PN_CURRENT_INDEX] : PN_VERSIONS[0];
      if (!v) {
        if (verEl) verEl.textContent = 'v —';
        if (dateEl) dateEl.textContent = '—';
        if (statsEl) statsEl.innerHTML = '';
        if (bodyEl) bodyEl.innerHTML = `<div class="pn-detail-empty">Нет данных</div>`;
        return;
      }
      if (verEl) verEl.textContent = v.version;
      if (dateEl) dateEl.textContent = `${v.date} · ${pnMonthLabel(v.date)}`;
      if (statsEl) statsEl.innerHTML = v.sections
        .map(s => `<span class="pn-stat pn-sec--${s.key}"><svg width="11" height="11"><use href="#${s.svg}"/></svg>${pnEscapeHtml(s.short)} · ${s.items.length}</span>`)
        .join('');
      if (bodyEl) bodyEl.innerHTML = v.sections.length
        ? v.sections.map(s => pnRenderSection(s, '')).join('')
        : `<div class="pn-detail-empty">Нет изменений</div>`;
    }

    function open() {
      fillContent();
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }

    if (closeBtn)  closeBtn.addEventListener('click', close);
    if (closeBtn2) closeBtn2.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });

    if (openHist) openHist.addEventListener('click', () => {
      close();
      const btn = document.getElementById('open-patchnotes-btn');
      if (btn) setTimeout(() => btn.click(), 200);
    });

    // Экспорт API (ЛКМ по виджету сборки и т.п.)
    window.openLatestPatchnoteModal = open;
    window.closeLatestPatchnoteModal = close;
    window.__lpnRefresh = fillContent;
  }
})();

// ===== Модалка «Разработчики» =====
(function initDevsModal() {
  function bind() {
    const overlay = document.getElementById('devs-modal-overlay');
    const openBtn = document.getElementById('open-devs-btn');
    const closeBtn = document.getElementById('devs-modal-close');
    if (!overlay || !openBtn) return false;
    if (overlay.dataset.bound === '1') return true;
    overlay.dataset.bound = '1';

    function open() {
      overlay.classList.add('visible');
      document.body.style.overflow = 'hidden';
      // запускаем staggered-анимацию заново при каждом открытии
      overlay.querySelectorAll('.dev-card').forEach((card) => {
        card.style.animation = 'none';
        // принудительный reflow для рестарта CSS-анимации
        // eslint-disable-next-line no-unused-expressions
        card.offsetWidth;
        card.style.animation = '';
      });
      const focusable = overlay.querySelector('.devs-modal-close');
      if (focusable) setTimeout(() => focusable.focus(), 50);
    }
    function close() {
      overlay.classList.remove('visible');
      document.body.style.overflow = '';
    }

    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      open();
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) close();
    });

    // экспортируем для возможного использования из других мест
    window.openDevsModal = open;
    window.closeDevsModal = close;
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    if (!bind()) {
      // элементов ещё нет — подождём, пока их вставит остальной код
      const t = setInterval(() => { if (bind()) clearInterval(t); }, 200);
      setTimeout(() => clearInterval(t), 6000);
    }
  }
})();

// ===== (старый scroll-transfer аккордеона удалён вместе с переходом на Timeline Pro)

// Применение всех сохраненных настроек при загрузке
function applyAllSavedSettings() {
  // 1. Чат
  const chatOverlay = document.getElementById('chat-overlay');
  if (chatOverlay) {
    // Позиция
    chatOverlay.classList.remove('position-left', 'position-center', 'position-right');
    chatOverlay.classList.add(`position-${appSettings.chatPosition}`);
    
    // Размеры
    chatOverlay.style.width = `${appSettings.chatWidth}px`;
    chatOverlay.style.maxHeight = `${appSettings.chatHeight}px`;
    chatOverlay.style.height = `${appSettings.chatHeight}px`;

    // Синхронизация active кнопок
    document.querySelectorAll('.s-btn[data-position]').forEach(b =>
      b.classList.toggle('active', b.dataset.position === appSettings.chatPosition));
    document.querySelectorAll('[data-position]').forEach(b =>
      b.classList.toggle('active', b.dataset.position === appSettings.chatPosition));
    document.querySelectorAll('.s-btn[data-width]').forEach(b =>
      b.classList.toggle('active', b.dataset.width === String(appSettings.chatWidth)));
    document.querySelectorAll('[data-width]').forEach(b =>
      b.classList.toggle('active', b.dataset.width === String(appSettings.chatWidth)));
    document.querySelectorAll('.s-btn[data-height]').forEach(b =>
      b.classList.toggle('active', b.dataset.height === String(appSettings.chatHeight)));
    document.querySelectorAll('[data-height]').forEach(b =>
      b.classList.toggle('active', b.dataset.height === String(appSettings.chatHeight)));
    
    // Свернутость
    if (appSettings.chatCollapsed) {
      chatOverlay.classList.add('collapsed');
    } else {
      chatOverlay.classList.remove('collapsed');
    }
  }
  
  // 2. Топбар
  if (typeof applyTopbarStyle === 'function') {
    applyTopbarStyle(appSettings.topbarStyle);
  }
  
  // 3. Фон + параметры анимации
  if (appSettings.animSettings) {
    const as = appSettings.animSettings;
    if (typeof animSettings === 'object') {
      animSettings.speed = typeof as.speed === 'number' ? as.speed : animSettings.speed;
      animSettings.intensity = typeof as.intensity === 'number' ? as.intensity : animSettings.intensity;
      animSettings.blur = typeof as.blur === 'number' ? as.blur : animSettings.blur;
      animSettings.scale = typeof as.scale === 'number' ? as.scale : animSettings.scale;
    }
    const sEl = document.getElementById('anim-speed'); if (sEl) sEl.value = as.speed;
    const iEl = document.getElementById('anim-intensity'); if (iEl) iEl.value = as.intensity;
    const bEl = document.getElementById('anim-blur'); if (bEl) bEl.value = as.blur;
    const scEl = document.getElementById('anim-scale'); if (scEl) scEl.value = as.scale;

    if (typeof updateAnimSettings === 'function') updateAnimSettings();
  }
  const bgTheme = BG_THEMES.find(t => t.id === appSettings.backgroundTheme);
  if (bgTheme && typeof applyBgTheme === 'function') {
    applyBgTheme(bgTheme);
  }
  
  // 4. Иконки
  if (typeof applyIconPack === 'function') {
    applyIconPack(appSettings.iconPack);
  }
  
  // 5. Тема чата
  const chatTheme = CHAT_THEMES.find(t => t.id === appSettings.chatTheme);
  if (chatTheme && typeof applyChatTheme === 'function') {
    applyChatTheme(chatTheme);
  } else if (appSettings.customThemeApplied && typeof applyCustomChatTheme === 'function') {
    applyCustomChatTheme(appSettings.customChatTheme);
  }
  
  // 6. Звук
  soundSettings.mention = appSettings.soundSettings.mention;
  soundSettings.private = appSettings.soundSettings.private;
  soundSettings.system = appSettings.soundSettings.system;
  allSoundsMuted = appSettings.allSoundsMuted;
  
  // Обновляем UI звуковых кнопок
  document.querySelectorAll('.s-btn[data-sound-type]').forEach(btn => {
    const type = btn.dataset.soundType;
    const sound = btn.dataset.sound;
    btn.classList.toggle('active', soundSettings[type] === sound);
  });
  
  // Обновляем кнопку отключения звука
  const muteBtn = document.getElementById('quick-mute-btn');
  if (muteBtn) {
    muteBtn.classList.toggle('muted', allSoundsMuted);
    if (allSoundsMuted) {
      muteBtn.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeoff"/></svg>`;
    } else {
      muteBtn.innerHTML = `<svg width="18" height="18"><use href="#icon-volumeon"/></svg>`;
    }
  }
  
  // 8. Профиль
  const nameEls = ['profile-display-name', 'profile-display-name-label', 'user-label'];
  nameEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = appSettings.displayName;
  });
  
  const infoEl = document.getElementById('edit-info');
  if (infoEl) infoEl.value = appSettings.userInfo;
  
  // 9. Цвет звезды
  currentStarColor = appSettings.starColor;
  CURSOR_STAR_COLOR = currentStarColor;
  
  // 10. Эффект звезды
  currentEffect = appSettings.starEffect;
  
  // 11. Звезда за курсором
  cursorStarEnabled = appSettings.cursorStarEnabled;
  const cursorStatus = document.getElementById('cursor-star-status');
  const cursorBtn = document.getElementById('cursor-star-btn');
  if (cursorStatus) cursorStatus.textContent = cursorStarEnabled ? 'вкл' : 'выкл';
  if (cursorBtn) {
    cursorBtn.style.borderColor = cursorStarEnabled ? 'rgba(249,115,22,0.5)' : 'rgba(109,74,255,0.35)';
    cursorBtn.style.background = cursorStarEnabled ? 'rgba(249,115,22,0.12)' : 'rgba(109,74,255,0.1)';
    cursorBtn.style.color = cursorStarEnabled ? '#f97316' : '#a5b8f0';
  }
  
  const leaderboardPanel = document.getElementById('leaderboard-panel');
  if (leaderboardPanel) {
    if (appSettings.leaderboardCollapsed) {
      leaderboardPanel.classList.add('collapsed');
    } else {
      leaderboardPanel.classList.remove('collapsed');
    }
  }
  
  // Обновляем UI кнопок чата
  document.querySelectorAll('.s-btn[data-position]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.position === appSettings.chatPosition);
  });
  document.querySelectorAll('.s-btn[data-width]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.width) === appSettings.chatWidth);
  });
  document.querySelectorAll('.s-btn[data-height]').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.height) === appSettings.chatHeight);
  });
  
  // Обновляем магазин
  if (typeof renderShop === 'function') renderShop();
  if (typeof renderMobShop === 'function') renderMobShop();
  
  // Обновляем профиль
  if (typeof refreshMobProfile === 'function') refreshMobProfile();
}

// Функция для обновления конкретной настройки
function updateSetting(key, value) {
  appSettings[key] = value;
  saveSettings(appSettings);
}

// Функция для обновления вложенных настроек
function updateNestedSetting(path, value) {
  const parts = path.split('.');
  let target = appSettings;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) target[parts[i]] = {};
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
  saveSettings(appSettings);
}

// Обертка для сохранения при изменении настроек
function saveOnChange() {
  // Чат
  document.querySelectorAll('.s-btn[data-position]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('chatPosition', btn.dataset.position);
    });
  });
  
  document.querySelectorAll('.s-btn[data-width]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('chatWidth', parseInt(btn.dataset.width));
    });
  });
  
  document.querySelectorAll('.s-btn[data-height]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateSetting('chatHeight', parseInt(btn.dataset.height));
    });
  });
  
  // Топбар
  document.querySelectorAll('.topbar-style-card').forEach(card => {
    card.addEventListener('click', () => {
      updateSetting('topbarStyle', card.dataset.topbarStyle);
    });
  });
  
  // Фон
  document.querySelectorAll('.bg-card').forEach(card => {
    card.addEventListener('click', () => {
      updateSetting('backgroundTheme', card.dataset.bgId);
    });
  });
  
  // Иконки
  document.querySelectorAll('.icon-pack-card').forEach(card => {
    card.addEventListener('click', () => {
      updateSetting('iconPack', card.dataset.pack);
    });
  });
  
  // Тема чата
  CHAT_THEMES.forEach(theme => {
    const card = document.querySelector(`.chat-theme-card[data-theme-id="${theme.id}"]`);
    if (card) {
      card.addEventListener('click', () => {
        updateSetting('chatTheme', theme.id);
        updateSetting('customThemeApplied', false);
      });
    }
  });
  
  // Звук
  document.querySelectorAll('.s-btn[data-sound-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      updateNestedSetting(`soundSettings.${btn.dataset.soundType}`, btn.dataset.sound);
    });
  });
  
  // Отключение звука
  const muteBtn = document.getElementById('quick-mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      updateSetting('allSoundsMuted', !appSettings.allSoundsMuted);
    });
  }
  
  // Сворачивание чата
  const chatHeader = document.getElementById('chat-header');
  if (chatHeader) {
    chatHeader.addEventListener('click', () => {
      setTimeout(() => {
        const collapsed = document.getElementById('chat-overlay').classList.contains('collapsed');
        updateSetting('chatCollapsed', collapsed);
      }, 50);
    });
  }
  
  // Сворачивание магазина
  const shopHeader = document.getElementById('skin-header');
  if (shopHeader) {
    shopHeader.addEventListener('click', () => {
      setTimeout(() => {
        const collapsed = document.getElementById('skin-panel').classList.contains('collapsed');
        updateSetting('shopCollapsed', collapsed);
      }, 50);
    });
  }
}

// Применение кастомной темы чата
function applyCustomChatTheme(theme) {
  const root = document.getElementById('chat-overlay');
  if (!root) return;
  
  root.className = root.className.replace(/\btheme-\S+/g, '').trim();
  
  const cteVarMap = {
    bg: { vars: ['--tg-bg', '--tg-surface', '--tg-surface-light', '--tg-surface-dark'] },
    incoming: { vars: ['--tg-message-incoming'] },
    outgoing: { vars: ['--tg-message-outgoing'] },
    accent: { vars: ['--tg-accent', '--tg-accent-hover'] },
    text: { vars: ['--tg-text', '--tg-message-incoming-text', '--tg-message-outgoing-text'] }
  };
  
  Object.entries(theme).forEach(([key, value]) => {
    const mapping = cteVarMap[key];
    if (mapping) {
      mapping.vars.forEach(v => root.style.setProperty(v, value));
    }
  });
  
  // Сохраняем в настройки
  updateSetting('customChatTheme', theme);
  updateSetting('customThemeApplied', true);
  updateSetting('chatTheme', 'custom');
}

// Кнопка применения кастомной темы
const applyCustomBtn = document.getElementById('apply-custom-theme-btn');
if (applyCustomBtn) {
  applyCustomBtn.addEventListener('click', () => {
    const customTheme = {
      bg: document.getElementById('cte-bg').value,
      incoming: document.getElementById('cte-incoming').value,
      outgoing: document.getElementById('cte-outgoing').value,
      accent: document.getElementById('cte-accent').value,
      text: document.getElementById('cte-text').value
    };
    applyCustomChatTheme(customTheme);
  });
}

// Сохранение имени пользователя
const saveNameBtn = document.getElementById('save-username-btn');
if (saveNameBtn) {
  saveNameBtn.addEventListener('click', () => {
    const newName = document.getElementById('edit-username-input').value.trim();
    if (newName) {
      updateSetting('displayName', newName);
    }
  });
}

// Сохранение информации о себе
const saveInfoBtn = document.getElementById('save-info');
if (saveInfoBtn) {
  saveInfoBtn.addEventListener('click', () => {
    const newInfo = document.getElementById('edit-info').value;
    updateSetting('userInfo', newInfo);
  });
}

// Сохранение цвета звезды при покупке
function saveStarColor(color) {
  updateSetting('starColor', color);
}

// Сохранение эффекта звезды
function saveStarEffect(effect) {
  updateSetting('starEffect', effect);
}

// Сохранение состояния звезды за курсором
function saveCursorStarState(enabled) {
  updateSetting('cursorStarEnabled', enabled);
}

// Экспортируем функции для использования в других частях кода
window.saveSettings = saveSettings;
window.loadSettings = loadSettings;
window.updateSetting = updateSetting;
window.saveStarColor = saveStarColor;
window.saveStarEffect = saveStarEffect;
window.saveCursorStarState = saveCursorStarState;
window.applyAllSavedSettings = applyAllSavedSettings;
window.applyCustomChatTheme = applyCustomChatTheme;

// Запуск сохранения при изменениях
document.addEventListener('DOMContentLoaded', () => {
  applyAllSavedSettings();
  saveOnChange();
});
// Также применяем немедленно (если DOM уже готов)
if (document.readyState !== 'loading') {
  applyAllSavedSettings();
  saveOnChange();
}

// ===== АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ ДАТЫ В "О ПРОЕКТЕ" =====
function updateAboutInfo() {
    const dateEl = document.getElementById('about-date');

    if (!dateEl) {
        console.warn('❌ Элемент about-date не найден');
        return;
    }

    if (!PATCH_NOTES || PATCH_NOTES.length === 0) {
        dateEl.textContent = 'Неизвестно';
        return;
    }

    // ПОИСК САМОЙ НОВОЙ ВЕРСИИ (с current: true или самую последнюю по массиву)
    let latest = PATCH_NOTES[0];

    // Если есть версия с current: true - используем её в приоритете
    const currentVersion = PATCH_NOTES.find(p => p.current === true);
    if (currentVersion) {
        latest = currentVersion;
    }

    dateEl.textContent = latest.date || 'Дата неизвестна';
}

// Запускаем с небольшой задержкой и несколькими попытками
function initAboutInfo() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateAboutInfo);
    } else {
        updateAboutInfo();
    }

    // Дополнительные попытки на случай поздней загрузки панели
    setTimeout(updateAboutInfo, 400);
    setTimeout(updateAboutInfo, 1200);
}

initAboutInfo();

// Функция для создания модального окна для элементов "БЕТА" в стиле сайта
function initBetaClickModal() {
    // Стили для модального окна (добавляются один раз)
    if (!document.getElementById('beta-modal-styles')) {
        const style = document.createElement('style');
        style.id = 'beta-modal-styles';
        style.textContent = `
            .beta-modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                background: rgba(1, 7, 18, 0.5);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.25s ease, visibility 0.25s ease;
            }
            .beta-modal-overlay.visible {
                opacity: 1;
                visibility: visible;
            }
            .beta-modal {
                width: 380px;
                max-width: calc(100vw - 32px);
                background: rgba(8, 12, 24, 0.45);
                border: 1px solid rgba(109, 74, 255, 0.25);
                border-radius: 24px;
                box-shadow: 0 32px 64px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 60px rgba(109, 74, 255, 0.1);
                backdrop-filter: blur(32px) saturate(170%);
                -webkit-backdrop-filter: blur(32px) saturate(170%);
                transform: scale(0.92) translateY(16px);
                transition: transform 0.28s cubic-bezier(0.34, 1.2, 0.64, 1);
                overflow: hidden;
            }
            .beta-modal-overlay.visible .beta-modal {
                transform: scale(1) translateY(0);
            }
            .beta-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 18px 12px;
                border-bottom: 1px solid rgba(109, 74, 255, 0.12);
                background: rgba(109, 74, 255, 0.05);
            }
            .beta-modal-header-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .beta-modal-icon {
                width: 34px;
                height: 34px;
                border-radius: 10px;
                background: linear-gradient(135deg, #fbbf24, #f97316);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                box-shadow: 0 0 14px rgba(251, 191, 36, 0.3);
                flex-shrink: 0;
            }
            .beta-modal-title {
                font-size: 15px;
                font-weight: 700;
                background: linear-gradient(135deg, #f8fafc, #c4b5fd);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .beta-modal-subtitle {
                font-size: 10px;
                color: #4a6080;
                margin-top: 2px;
            }
            .beta-modal-close-btn {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                border: 1px solid rgba(255, 255, 255, 0.14);
                background: rgba(0, 0, 0, 0.45);
                color: #a0b4d0;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, color 0.18s ease;
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
                flex-shrink: 0;
                font-size: 14px;
            }
            .beta-modal-close-btn:hover {
                background: rgba(239, 68, 68, 0.3);
                color: #ef4444;
                border-color: rgba(239, 68, 68, 0.5);
                transform: scale(1.1);
            }
            .beta-modal-body {
                padding: 18px 20px 20px;
            }
            .beta-modal-text {
                font-size: 13px;
                color: #6b84a8;
                line-height: 1.6;
                margin-bottom: 16px;
            }
            .beta-modal-warning {
                background: rgba(251, 191, 36, 0.08);
                border: 1px solid rgba(251, 191, 36, 0.15);
                border-radius: 12px;
                padding: 10px 12px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .beta-modal-warning-icon {
                font-size: 16px;
                flex-shrink: 0;
            }
            .beta-modal-warning-text {
                font-size: 11px;
                color: #fbbf24;
                line-height: 1.4;
            }
            .beta-modal-footer {
                display: flex;
                gap: 10px;
            }
            .beta-modal-btn {
                flex: 1;
                padding: 10px;
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.07);
                background: rgba(255, 255, 255, 0.04);
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                color: #94a3b8;
                transition: all 0.18s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                font-family: 'Unbounded', sans-serif;
            }
            .beta-modal-btn-primary {
                background: linear-gradient(135deg, rgba(109, 74, 255, 0.22), rgba(56, 189, 248, 0.18));
                border-color: rgba(109, 74, 255, 0.45);
                color: #d0daf5;
                box-shadow: 0 0 12px rgba(109, 74, 255, 0.2);
            }
            .beta-modal-btn-primary:hover {
                background: linear-gradient(135deg, rgba(109, 74, 255, 0.32), rgba(56, 189, 248, 0.26));
                border-color: rgba(109, 74, 255, 0.65);
                color: #e8efff;
                box-shadow: 0 0 20px rgba(109, 74, 255, 0.35);
                transform: translateY(-1px);
            }
            .beta-cursor {
                cursor: pointer;
            }
        `;
        document.head.appendChild(style);
    }

    // Создаем модальное окно, если его еще нет
    let modalOverlay = document.getElementById('beta-modal-overlay');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'beta-modal-overlay';
        modalOverlay.className = 'beta-modal-overlay';
        modalOverlay.innerHTML = `
            <div class="beta-modal">
                <div class="beta-modal-header">
                    <div class="beta-modal-header-left">
                        <div class="beta-modal-icon">⚠️</div>
                        <div>
                            <div class="beta-modal-title">Бета-функция</div>
                            <div class="beta-modal-subtitle">Экспериментальная возможность</div>
                        </div>
                    </div>
                    <button class="beta-modal-close-btn">
                        <svg width="30" height="30"><use href="#icon-close"/></svg>
                    </button>
                </div>
                <div class="beta-modal-body">
                    <div class="beta-modal-text">
                        Эта функция находится в стадии активной разработки.
                    </div>
                    <div class="beta-modal-warning">
                        <div class="beta-modal-warning-icon">⚠️</div>
                        <div class="beta-modal-warning-text">
                            Некоторые элементы могут работать нестабильно или измениться в будущем.
                        </div>
                    </div>
                    <div class="beta-modal-footer">
                        <button class="beta-modal-btn beta-modal-btn-primary" id="beta-modal-ok">Понятно</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalOverlay);

        // Закрытие по кнопке
        const closeBtn = modalOverlay.querySelector('#beta-modal-ok');
        const closeX = modalOverlay.querySelector('.beta-modal-close-btn');
        
        closeBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('visible');
        });
        closeX.addEventListener('click', () => {
            modalOverlay.classList.remove('visible');
        });

        // Закрытие по клику на оверлей
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                modalOverlay.classList.remove('visible');
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('visible')) {
                modalOverlay.classList.remove('visible');
            }
        });
    }

    // Находим все элементы с текстом "БЕТА"
    const betaElements = [];

    document.querySelectorAll('*').forEach(el => {
        for (let node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === 'БЕТА') {
                if (!betaElements.includes(el.parentElement)) {
                    betaElements.push(el.parentElement);
                }
                break;
            }
        }
        if (el.getAttribute && el.getAttribute('title') === 'БЕТА' && !betaElements.includes(el)) {
            betaElements.push(el);
        }
    });

    // Также ищем элементы с классом beta-badge
    document.querySelectorAll('.beta-badge, .topbar-style-card.beta .tscard-name, .ctg-section-label span').forEach(el => {
        if (el.textContent.trim() === 'БЕТА' || el.textContent.includes('БЕТА')) {
            if (!betaElements.includes(el)) betaElements.push(el);
        }
    });

    const uniqueElements = [...new Set(betaElements)];

    function showBetaModal(e) {
        e.stopPropagation();
        modalOverlay.classList.add('visible');
    }

    uniqueElements.forEach(el => {
        el.removeEventListener('click', showBetaModal);
        el.addEventListener('click', showBetaModal);
        el.classList.add('beta-cursor');
    });
}

// Запуск
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBetaClickModal);
} else {
    initBetaClickModal();
}

// Наблюдение за новыми элементами
const betaModalObserver = new MutationObserver(() => {
    initBetaClickModal();
});
betaModalObserver.observe(document.body, { childList: true, subtree: true });


// ===== ПОЛНОЭКРАННЫЙ ЧАТ =====
(function() {
    const fsBtn = document.getElementById('chat-fullscreen-btn');
    const chatOverlay = document.getElementById('chat-overlay');
    if (!fsBtn || !chatOverlay) return;

    fsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isFs = chatOverlay.classList.toggle('fullscreen');
        // Убедиться что чат раскрыт
        if (isFs) {
            chatOverlay.classList.remove('collapsed');
            // Убрать position классы - fullscreen сам по себе
            chatOverlay.style.removeProperty('left');
            chatOverlay.style.removeProperty('right');
            chatOverlay.style.removeProperty('transform');
        }
        fsBtn.title = isFs ? 'Свернуть' : 'На весь экран';
    });

    // Клавиша Escape выходит из fullscreen
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && chatOverlay.classList.contains('fullscreen')) {
            chatOverlay.classList.remove('fullscreen');
            fsBtn.title = 'На весь экран';
        }
    });
})();


// ===== ВКЛЮЧЕНИЕ АНИМАЦИЙ ПОСЛЕ ЗАГРУЗКИ =====
(function() {
    // Определяем мобильное устройство
    const IS_MOBILE_ANIM = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    // На мобильных устройствах анимации НЕ включаем
    if (IS_MOBILE_ANIM) {
        return;
    }
    
    // На ПК включаем после 3 кадров
    let frames = 0;
    
    function enableAnimations() {
        frames++;
        
        if (frames >= 3) {
            document.body.classList.add('animations-enabled');
            return;
        }
        
        requestAnimationFrame(enableAnimations);
    }
    
    // Запускаем после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            requestAnimationFrame(enableAnimations);
        });
    } else {
        requestAnimationFrame(enableAnimations);
    }
})();


// ===== ПОИСК ПО НАСТРОЙКАМ =====
(function() {
    function initSettingsSearch() {
        const searchInput = document.getElementById('settings-search-input');
        const searchStatus = document.getElementById('settings-search-status');
        
        if (!searchInput) return;
        
        // Словарь ключевых слов для каждого раздела настроек
        const panelKeywords = {
            'chat': ['чат', 'положение', 'ширина', 'высота', 'сообщения', 'окно чата', 'размер чата', 'chat', 'position', 'width', 'height', 'messages', 'chat window'],
            'chattheme': ['тема чата', 'оформление чата', 'цвет чата', 'фон чата', 'своя тема', 'chat theme', 'chat colors', 'background', 'incoming', 'outgoing', 'custom theme', 'liquid glass', 'прозрачный', 'космос', 'туманность', 'аврора', 'полночь', 'эмбер', 'роза'],
            'topbar': ['верхняя панель', 'топбар', 'стиль', 'разделённый', 'прозрачный', 'минимальный', 'по умолчанию', 'topbar', 'style', 'split', 'transparent', 'minimal', 'default', 'иконки', 'порядок'],
            'background': ['фон', 'звёздное поле', 'анимация', 'статичный', 'космос', 'туманность', 'background', 'stars', 'animated', 'static', 'space', 'nebula', 'galaxy', 'wallpaper', 'walpole', 'wilvander', 'deep space', 'aurora', 'sunset', 'ocean', 'forest', 'void'],
            'sound': ['звук', 'уведомления', 'звук уведомлений', 'звук чата', 'упоминание', 'личное сообщение', 'системные сообщения', 'заглушить', 'sound', 'notifications', 'mention', 'private message', 'system message', 'mute', 'колокол', 'хрусталь', 'Арфа', 'синтез', 'космос', 'Мягкий колокол', 'Флейта', 'Небесная сфера'], 'behaviour': ['поведение', 'модальные', 'закрывать', 'всплывающие', 'backdrop', 'behaviour', 'behavior', 'modals', 'notifications', 'close', 'popup'],
            'appearance': ['тема', 'оформление', 'appearance', 'theme', 'color scheme', 'схема', 'тема оформления'],
            'about': ['о проекте', 'версия', 'разработчики', 'обновления', 'патчноут', 'about', 'version', 'developers', 'patchnotes', 'update', 'история']
        };
        
        function getPanelKeywords(panelId) {
            return panelKeywords[panelId] || [];
        }
        
        function searchSettings(query) {
            const searchTerm = query.toLowerCase().trim();
            const navItems = document.querySelectorAll('.settings-nav-item');
            const navDividers = document.querySelectorAll('.settings-nav-divider');
            const sectionLabels = document.querySelectorAll('.settings-nav-section-label');
            
            // Сбрасываем подсветку и фильтры
            navItems.forEach(item => {
                item.classList.remove('highlight-match');
                item.classList.remove('filtered-out');
            });
            navDividers.forEach(div => div.classList.remove('filtered-out'));
            sectionLabels.forEach(label => label.classList.remove('filtered-out'));
            
            if (searchStatus) searchStatus.style.display = 'none';
            
            if (!searchTerm) {
                return;
            }
            
            let matchFound = false;
            const matchedPanels = new Set();
            
            // Проверяем каждый пункт навигации
            navItems.forEach(item => {
                const panelId = item.dataset.panel;
                const itemText = item.textContent.toLowerCase();
                const keywords = getPanelKeywords(panelId);
                
                let isMatch = itemText.includes(searchTerm);
                
                if (!isMatch) {
                    for (const kw of keywords) {
                        if (kw.toLowerCase().includes(searchTerm) || searchTerm.includes(kw.toLowerCase())) {
                            isMatch = true;
                            break;
                        }
                    }
                }
                
                if (isMatch) {
                    matchFound = true;
                    matchedPanels.add(panelId);
                    item.classList.add('highlight-match');
                    item.classList.remove('filtered-out');
                    
                    // Показываем родительский заголовок секции
                    let parent = item.parentElement;
                    while (parent && parent !== document.getElementById('settings-nav')) {
                        if (parent.classList && parent.classList.contains('settings-nav-section-label')) {
                            parent.classList.remove('filtered-out');
                        }
                        parent = parent.parentElement;
                    }
                } else {
                    item.classList.add('filtered-out');
                }
            });
            
            // Скрываем разделители и заголовки секций, если все их элементы скрыты
            sectionLabels.forEach(label => {
                let hasVisibleItem = false;
                let nextElement = label.nextElementSibling;
                while (nextElement && nextElement.classList && nextElement.classList.contains('settings-nav-item')) {
                    if (!nextElement.classList.contains('filtered-out')) {
                        hasVisibleItem = true;
                        break;
                    }
                    nextElement = nextElement.nextElementSibling;
                }
                if (!hasVisibleItem) {
                    label.classList.add('filtered-out');
                }
            });
            
            navDividers.forEach(div => {
                let prevVisible = false;
                let nextVisible = false;
                let prev = div.previousElementSibling;
                let next = div.nextElementSibling;
                
                while (prev) {
                    if (prev.classList && !prev.classList.contains('filtered-out') && 
                        (prev.classList.contains('settings-nav-item') || prev.classList.contains('settings-nav-section-label'))) {
                        prevVisible = true;
                        break;
                    }
                    prev = prev.previousElementSibling;
                }
                
                while (next) {
                    if (next.classList && !next.classList.contains('filtered-out') && 
                        (next.classList.contains('settings-nav-item') || next.classList.contains('settings-nav-section-label'))) {
                        nextVisible = true;
                        break;
                    }
                    next = next.nextElementSibling;
                }
                
                if (!prevVisible || !nextVisible) {
                    div.classList.add('filtered-out');
                }
            });
            
            // Обновляем статус поиска
            if (searchStatus) {
                if (!matchFound) {
                    searchStatus.textContent = '❌ Ничего не найдено. Попробуйте другие ключевые слова.';
                    searchStatus.style.display = 'block';
                } else {
                    searchStatus.textContent = `🔍 Найдено ${matchedPanels.size} раздел(ов)`;
                    searchStatus.style.display = 'block';
                }
            }
            
            // Если найдено ровно одно совпадение, автоматически переключаемся
            if (matchedPanels.size === 1) {
                const matchedPanelId = Array.from(matchedPanels)[0];
                const targetItem = document.querySelector(`.settings-nav-item[data-panel="${matchedPanelId}"]`);
                if (targetItem && !targetItem.classList.contains('active')) {
                    targetItem.click();
                    const activePanel = document.getElementById(`panel-${matchedPanelId}`);
                    if (activePanel) {
                        activePanel.classList.add('highlighted-panel');
                        setTimeout(() => {
                            activePanel.classList.remove('highlighted-panel');
                        }, 1000);
                    }
                }
            }
        }
        
        // Дебаунс для поиска
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchSettings(this.value);
            }, 200);
        });
        
        // Очистка поиска при закрытии настроек
        const settingsModal = document.getElementById('settings-modal-overlay');
        if (settingsModal) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.attributeName === 'class') {
                        if (!settingsModal.classList.contains('visible')) {
                            searchInput.value = '';
                            searchSettings('');
                            document.querySelectorAll('.settings-nav-item').forEach(item => {
                                item.classList.remove('filtered-out', 'highlight-match');
                            });
                            document.querySelectorAll('.settings-nav-divider, .settings-nav-section-label').forEach(el => {
                                el.classList.remove('filtered-out');
                            });
                            if (searchStatus) searchStatus.style.display = 'none';
                        }
                    }
                });
            });
            observer.observe(settingsModal, { attributes: true });
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsSearch);
    } else {
        initSettingsSearch();
    }
})();


// ===== БЕСКОНЕЧНАЯ КАРУСЕЛЬ С ПЛАВНОЙ ФИЗИЧЕСКОЙ ПРОКРУТКОЙ =====
(function() {
    // Данные для карусели
    const carouselItems = [
        { id: 'online', name: 'Онлайн', action: 'online' },
        { id: 'notif', name: 'Уведомления', action: 'notif' },
        { id: 'test', name: 'Пре-релизная сборка', action: 'test' },
        { id: 'datetime', name: 'Время', action: null },
        { id: 'weather', name: 'Погода', action: 'weather' }
    ];
    
    // Создаем 3 полных копии для бесконечности
    const TOTAL_COPIES = 3;
    let allItems = [];
    for (let i = 0; i < TOTAL_COPIES; i++) {
        allItems.push(...carouselItems);
    }
    
    // Начинаем с центрального блока
    const START_INDEX = Math.floor(allItems.length / 2);
    let currentRealIndex = START_INDEX;
    let currentItemIndex = 0;
    
    let isAnimating = false;
    let animationTimeout = null;
    let autoScrollInterval = null;
    let autoScrollEnabled = true;
    let autoScrollDelay = 4000;
    let showToastEnabled = true;

    // Состояние виджета погоды. Объявляем здесь, чтобы buildCarousel и
    // autoFetchWeatherBg могли безопасно читать значения до того, как
    // данные будут прочитаны из localStorage. Без этих объявлений
    // `weatherData`/`weatherCity` бросали ReferenceError и ломали
    // инициализацию карусели (виджеты переставали переключаться).
    let weatherCity = 'Москва';
    let weatherData = {
        temp: '+0',
        condition: 'Нет данных',
        icon: '🌡️',
        feels: null,
        wind: null,
        humidity: null,
        isDay: null
    };

// Запуск автоматической прокрутки
function startAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
    // Проверяем переменную (обновляется тоглом мгновенно)
    if (!autoScrollEnabled) return;

    autoScrollInterval = setInterval(() => {
        if (!isAnimating && !isDragging) {
            switchTo(1);
        }
    }, autoScrollDelay);
}

// Остановка автоматической прокрутки
function stopAutoScroll() {
    if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
        autoScrollInterval = null;
    }
}

    const track = document.getElementById('carousel-track');
    const carousel = document.getElementById('top-carousel');
    const itemHeight = 36;
    
    // Физика прокрутки
    let touchStartY = 0;
    let touchCurrentY = 0;
    let startTransformY = 0;
    let velocity = 0;
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let isDragging = false;
    let dragStartIndex = 0;
    
    // Создаем DOM элементы
    function buildCarousel() {
        if (!track) return;
        track.innerHTML = '';
        
        allItems.forEach((item, idx) => {
            const newItem = document.createElement('div');
            newItem.className = 'carousel-item';
            newItem.setAttribute('data-type', item.id);
            newItem.setAttribute('data-idx', idx);
            newItem.style.cssText = `
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                padding: 0 16px;
                border-radius: 999px;
                cursor: ${item.action === null ? 'default' : 'pointer'};
                white-space: nowrap;
                flex-shrink: 0;
                width: 100%;
                box-sizing: border-box;
            `;
            
            const styles = {
                online: 'background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);',
                notif: 'background: rgba(139,74,255,0.10); border: 1px solid rgba(139,74,255,0.3);',
                test: 'background: rgba(109,74,255,0.18); border: 1px solid rgba(109,74,255,0.45);',
                datetime:'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);',
                weather: 'background: rgba(168,85,247,0.08); border: 1px solid rgba(168,85,247,0.2);'
            };
            newItem.style.cssText += styles[item.id] || styles.datetime;
            
            if (item.id === 'online') {
                newItem.innerHTML = `
                    <div style="display: flex; gap: 3px;">
                        <span class="online-dot" style="width: 7px; height: 7px; background: #22c55e; border-radius: 50%; box-shadow: 0 0 6px #22c55e; animation: onlinePulse 1.5s infinite;"></span>
                        <span class="online-dot" style="width: 7px; height: 7px; background: #22c55e; border-radius: 50%; opacity: 0.7; animation: onlinePulse 1.5s infinite 0.3s;"></span>
                        <span class="online-dot" style="width: 7px; height: 7px; background: #22c55e; border-radius: 50%; opacity: 0.4; animation: onlinePulse 1.5s infinite 0.6s;"></span>
                    </div>
                    <span style="font-size: 14px; font-weight: 600; color: #4ade80;"><span class="online-count">8</span> в сети</span>
                    <div style="width: 1px; height: 12px; background: rgba(34,197,94,0.2);"></div>
                    <span style="font-size: 14px; color: #6b84a8;"><span class="total-stars">20</span> звёзд</span>
                `;
            } else if (item.id === 'notif') {
                newItem.innerHTML = `
                    <div class="carousel-notif-dot" id="carousel-notif-dot"></div>
                    <span class="carousel-notif-count" id="carousel-notif-count">0 уведомлений</span>
                    <div class="carousel-notif-sep"></div>
                    <span class="carousel-notif-label" id="carousel-notif-label">Всё тихо</span>
                `;
            } else if (item.id === 'test') {
    // Виджет «Пре-релиз · ДД.ММ.ГГГГ» — дата из PATCH_NOTES (current)
    let dateText = '—';
    if (typeof PATCH_NOTES !== 'undefined' && Array.isArray(PATCH_NOTES)) {
        const currentVersion = PATCH_NOTES.find(p => p.current === true);
        if (currentVersion && currentVersion.date) {
            dateText = currentVersion.date;
        } else {
            const latest = PATCH_NOTES[PATCH_NOTES.length - 1];
            if (latest && latest.date) dateText = latest.date;
        }
    }
        newItem.innerHTML = `
        <div class="build-widget">
            <span class="build-widget-label">Пре-релиз</span>
            <div class="build-widget-sep"></div>
            <span class="build-widget-date test-version-span">${dateText}</span>
        </div>
    `;
        // ПКМ по виджету → полная история изменений (Timeline)
        newItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const btn = document.getElementById('open-patchnotes-btn');
            if (btn) btn.click();
            else {
                const ov = document.getElementById('patchnotes-overlay');
                if (ov) {
                    ov.classList.add('visible');
                    document.body.style.overflow = 'hidden';
                }
            }
        });
            } else if (item.id === 'datetime') {
                newItem.innerHTML = `
                    <span style="font-size: 15px; font-weight: 500; color: #c4cfe8;"><span class="live-time">--:--</span></span>
                    <div style="width: 1px; height: 12px; background: rgba(255,255,255,0.1);"></div>
                    <span style="font-size: 15px; color: #6b84a8;"><span class="live-date">--.--</span></span>
                `;
            } else if (item.id === 'weather') {
                newItem.innerHTML = `
                    <span style="font-size:14px;flex-shrink:0;" class="weather-icon">${weatherData.icon}</span>
                    <span style="font-size:14px;font-weight:500;color:#c4b5fd;flex-shrink:0;" class="weather-temp">${weatherData.temp}°C</span>
                    <div class="weather-vslide-wrap" style="flex:1;min-width:0;overflow:hidden;position:relative;height:18px;">
                      <div class="weather-vslide-track" style="display:flex;text-align:center;flex-direction:column;gap:0;transition:transform 0.4s cubic-bezier(0.25,0.9,0.4,1);">
                        <div class="weather-vslide-item weather-city" style="height:18px;line-height:18px;font-size:14px;color:#4a6080;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${weatherCity}</div>
                        <div class="weather-vslide-item weather-condition" style="height:18px;line-height:18px;font-size:14px;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${weatherData.condition}</div>
                        <div class="weather-vslide-item weather-extra-feels" style="height:18px;line-height:18px;font-size:14px;color:#7dd3fc;display:none;white-space:nowrap;">🌡️ <b class="weather-feels-val">—</b></div>
                        <div class="weather-vslide-item weather-extra-wind" style="height:18px;line-height:18px;font-size:14px;color:#7dd3fc;display:none;white-space:nowrap;">💨 <b class="weather-wind-val">—</b></div>
                        <div class="weather-vslide-item weather-extra-humidity" style="height:18px;line-height:18px;font-size:14px;color:#4ade80;display:none;white-space:nowrap;">💧 <b class="weather-humidity-val">—</b></div>
                        <div class="weather-vslide-item weather-extra-time" style="height:18px;line-height:18px;font-size:14px;color:#fbbf24;display:none;white-space:nowrap;">🌅 <b class="weather-time-label">—</b></div>
                      </div>
                    </div>
                    <div class="weather-vslide-timer" style="width:2px;height:20px;background:rgba(168,85,247,0.15);border-radius:1px;overflow:hidden;flex-shrink:0;margin-left:2px;">
                      <div class="weather-vslide-progress" style="width:100%;height:100%;background:rgba(168,85,247,0.6);transform-origin:top;transform:scaleY(0);border-radius:1px;"></div>
                    </div>
                `;
            }
            
            track.appendChild(newItem);
        });
        
        // Устанавливаем начальную позицию
        updatePosition(currentRealIndex, false);
    }
    
    // Обновление позиции трека
    function updatePosition(index, useTransition = true) {
        if (!track) return;
        const newY = -index * itemHeight;
        
        if (useTransition) {
            track.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
            track.style.transform = `translateY(${newY}px)`;
        } else {
            track.style.transition = 'none';
            track.style.transform = `translateY(${newY}px)`;
        }
    }
    
    // Переключение на соседний элемент с циклической навигацией
function switchTo(delta) {
    if (isAnimating) return;
    
    let newIndex = currentRealIndex + delta;
    const totalItems = allItems.length;
    
    // Циклическая навигация (бесконечная карусель)
    if (newIndex < 0) {
        newIndex = totalItems - 1;
    } else if (newIndex >= totalItems) {
        newIndex = 0;
    }
    
    isAnimating = true;
    
    updatePosition(newIndex, true);
    
    if (animationTimeout) clearTimeout(animationTimeout);
    animationTimeout = setTimeout(() => {
        currentRealIndex = newIndex;
        isAnimating = false;
        
        // Корректируем индекс для бесконечности
        normalizeIndex();
        
        // Обновляем данные
        updateCurrentItemData();
        
        // Показываем тост только если включен
        let toastEnabled = true;
        try {
            const saved = localStorage.getItem('star_sky_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (typeof settings.carouselShowToast !== 'undefined') {
                    toastEnabled = settings.carouselShowToast;
                }
            }
        } catch(e) {}
        
        if (toastEnabled) {
            const directionText = delta > 0 ? '' : '';
            showToast(directionText);
        }
    }, 300);
}
    
// Нормализация индекса для бесконечности (без рывков)
function normalizeIndex() {
    const originalLength = carouselItems.length;
    const totalLength = allItems.length;
    const centerBlockStart = Math.floor(totalLength / 2) - Math.floor(originalLength / 2);
    const centerBlockEnd = centerBlockStart + originalLength;
    
    let needCorrection = false;
    let newIndex = currentRealIndex;
    
    if (currentRealIndex < centerBlockStart) {
        newIndex = currentRealIndex + originalLength;
        needCorrection = true;
    } else if (currentRealIndex >= centerBlockEnd) {
        newIndex = currentRealIndex - originalLength;
        needCorrection = true;
    }
    
    if (needCorrection) {
        // Мгновенно перемещаем без анимации
        track.style.transition = 'none';
        track.style.transform = `translateY(-${newIndex * itemHeight}px)`;
        currentRealIndex = newIndex;
        // Восстанавливаем анимацию
        setTimeout(() => {
            if (track) track.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
        }, 50);
    }
    
    // Обновляем текущий индекс в оригинальном массиве
    currentItemIndex = ((currentRealIndex % originalLength) + originalLength) % originalLength;
    // Сохраняем последний выбранный виджет
    try { localStorage.setItem('star_sky_last_widget', String(currentItemIndex)); } catch(e) {}
}
    
    // Получение текущего элемента
    function getCurrentItem() {
    const originalLength = carouselItems.length;
    let idx = currentRealIndex % originalLength;
    // Защита от отрицательных индексов
    if (idx < 0) idx += originalLength;
    return carouselItems[idx];
}
    
    // Обновление данных текущего элемента
    function updateCurrentItemData() {
        const item = getCurrentItem();
        
        if (item.id === 'online') {
            updateOnlineStats();
        } else if (item.id === 'datetime') {
            updateDateTime();
        } else if (item.id === 'weather') {
            updateWeatherDisplay();
            setTimeout(startWeatherTickers, 50);
        }
        
        // Эффект пульсации
        const activeItem = track?.children[currentRealIndex];
        if (activeItem && item.action !== null) {
            activeItem.style.transform = 'scale(1.02)';
            setTimeout(() => {
                if (activeItem) activeItem.style.transform = '';
            }, 200);
        }
    }
    
    function updateOnlineStats() {
        const onlineSpans = document.querySelectorAll('.online-count');
        const totalSpans = document.querySelectorAll('.total-stars');
        if (onlineSpans.length && typeof MOCK_USERS !== 'undefined') {
            const onlineCount = MOCK_USERS.filter(u => u.active).length + 1; // +1 текущий пользователь
            const totalCount = MOCK_USERS.length + 1; // +1 текущий пользователь
            onlineSpans.forEach(span => span.textContent = onlineCount);
            totalSpans.forEach(span => span.textContent = totalCount);
        }
    }
    
    function updateDateTime() {
        const timeSpans = document.querySelectorAll('.live-time');
        const dateSpans = document.querySelectorAll('.live-date');
        if (timeSpans.length) {
            const now = new Date();
            timeSpans.forEach(span => span.textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
            dateSpans.forEach(span => span.textContent = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
        }
    }
    
    // Настройки отображения погоды (сохраняются)
    let weatherDisplayFields = JSON.parse(localStorage.getItem('star_sky_weather_fields') || 'null') || {
      condition: true, city: true, feels: true, wind: true, humidity: true, timeOfDay: true
    };
    let weatherTickerEnabled = localStorage.getItem('star_sky_weather_ticker') !== 'false';

    function saveWeatherDisplaySettings() {
      localStorage.setItem('star_sky_weather_fields', JSON.stringify(weatherDisplayFields));
      localStorage.setItem('star_sky_weather_ticker', String(weatherTickerEnabled));
    }

    function updateWeatherDisplay() {
        const icons = document.querySelectorAll('.weather-icon');
        const temps = document.querySelectorAll('.weather-temp');
        icons.forEach(el => el.textContent = weatherData.icon);
        temps.forEach(el => el.textContent = weatherData.temp + '°C');

        // Обновляем элементы условий погоды и города
        document.querySelectorAll('.weather-condition').forEach(el => el.textContent = weatherData.condition);
        document.querySelectorAll('.weather-city').forEach(el => el.textContent = weatherCity);

        // Обновляем значения дополнительных полей
        const feels = weatherData.feels != null ? (weatherData.feels > 0 ? '+' : '') + weatherData.feels + '°C' : '—';
        const wind  = weatherData.wind  != null ? weatherData.wind + ' км/ч' : '—';
        const hum   = weatherData.humidity != null ? weatherData.humidity + '%' : '—';
        const tod   = weatherData.isDay != null ? (weatherData.isDay ? 'День' : 'Ночь') : '—';
        document.querySelectorAll('.weather-feels-val').forEach(el => el.textContent = feels);
        document.querySelectorAll('.weather-wind-val').forEach(el => el.textContent = wind);
        document.querySelectorAll('.weather-humidity-val').forEach(el => el.textContent = hum);
        document.querySelectorAll('.weather-time-label').forEach(el => el.textContent = tod);

        // Показ/скрытие дополнительных полей в зависимости от настроек и наличия данных
        const hasExtras = weatherData.feels != null;
        document.querySelectorAll('.weather-extra-feels').forEach(el => {
          el.style.display = (weatherDisplayFields.feels && hasExtras) ? '' : 'none';
        });
        document.querySelectorAll('.weather-extra-wind').forEach(el => {
          el.style.display = (weatherDisplayFields.wind && hasExtras) ? '' : 'none';
        });
        document.querySelectorAll('.weather-extra-humidity').forEach(el => {
          el.style.display = (weatherDisplayFields.humidity && hasExtras) ? '' : 'none';
        });
        document.querySelectorAll('.weather-extra-time').forEach(el => {
          el.style.display = (weatherDisplayFields.timeOfDay && hasExtras) ? '' : 'none';
        });
        document.querySelectorAll('.weather-condition').forEach(el => {
          el.style.display = weatherDisplayFields.condition ? '' : 'none';
        });
        document.querySelectorAll('.weather-city').forEach(el => {
          el.style.display = weatherDisplayFields.city ? '' : 'none';
        });
    }

    function startWeatherTickers() { 
    // Проверяем, не запущен ли уже тикер
    if (window._weatherTickersRunning) return;
    window._weatherTickersRunning = true;
    
    if (typeof startWeatherVSlide === 'function') {
        startWeatherVSlide();
    }
}

// Вертикальная карусель для деталей виджета погоды
let _weatherVSlideIntervals = [];


// ===== БЕСКОНЕЧНАЯ ВЕРТИКАЛЬНАЯ КАРУСЕЛЬ ДЛЯ ПОГОДЫ =====
(function() {
    // Глобальный массив для хранения интервалов
    window._weatherVSlideIntervals = [];
    let _isRunning = false;
    let _initTimeout = null;

    function stopAllIntervals() {
        if (window._weatherVSlideIntervals) {
            window._weatherVSlideIntervals.forEach(id => clearInterval(id));
            window._weatherVSlideIntervals = [];
        }
    }

    function startWeatherVSlide() {
        // Предотвращаем множественные запуски
        if (_initTimeout) clearTimeout(_initTimeout);
        
        _initTimeout = setTimeout(() => {
            stopAllIntervals();

            document.querySelectorAll('.weather-vslide-wrap').forEach(wrap => {
                const track = wrap.querySelector('.weather-vslide-track');
                if (!track) return;

                // Собираем ВСЕ элементы
                const allItems = Array.from(track.querySelectorAll('.weather-vslide-item'));
                // Фильтруем только видимые элементы
                let visibleItems = allItems.filter(el => el.style.display !== 'none');
                if (visibleItems.length <= 1) {
                    track.style.transition = 'none';
                    track.style.transform = 'translateY(0)';
                    return;
                }

                const TOTAL_COPIES = 3;
                let infiniteItems = [];
                for (let i = 0; i < TOTAL_COPIES; i++) {
                    infiniteItems.push(...visibleItems);
                }

                // Очищаем трек и заполняем его бесконечным массивом
                const originalChildren = Array.from(track.children);
                originalChildren.forEach(child => child.remove());

                infiniteItems.forEach(item => {
                    const clone = item.cloneNode(true);
                    clone.style.display = '';
                    track.appendChild(clone);
                });

                const newAllItems = Array.from(track.children);
                const itemHeight = 18;
                const startIndex = visibleItems.length;
                let currentIdx = startIndex;

                function updatePosition(index, useTransition = true) {
                    const newY = -index * itemHeight;
                    if (useTransition) {
                        track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.9, 0.4, 1)';
                        track.style.transform = `translateY(${newY}px)`;
                    } else {
                        track.style.transition = 'none';
                        track.style.transform = `translateY(${newY}px)`;
                    }
                }

                // Бесконечная нормализация - всегда держим индекс в пределах центрального блока
                function normalizeIndex() {
                    const originalLength = visibleItems.length;
                    const centerStart = originalLength;
                    const centerEnd = centerStart + originalLength;

                    let needCorrection = false;
                    let newIndex = currentIdx;

                    if (currentIdx < centerStart) {
                        newIndex = currentIdx + originalLength;
                        needCorrection = true;
                    } else if (currentIdx >= centerEnd) {
                        newIndex = currentIdx - originalLength;
                        needCorrection = true;
                    }

                    if (needCorrection) {
                        // Мгновенное перемещение без анимации
                        updatePosition(newIndex, false);
                        currentIdx = newIndex;
                    }
                }

                function goToNext() {
                    currentIdx++;
                    updatePosition(currentIdx, true);
                    // Нормализуем индекс после завершения анимации
                    setTimeout(() => {
                        normalizeIndex();
                    }, 400);
                }

                // Устанавливаем начальную позицию
                updatePosition(startIndex, false);
                currentIdx = startIndex;

                const progressEl = wrap.parentElement?.querySelector('.weather-vslide-progress');
                function animateProgress() {
                    if (!progressEl) return;
                    progressEl.style.transition = 'none';
                    progressEl.style.transform = 'scaleY(0)';
                    void progressEl.offsetHeight;
                    progressEl.style.transition = 'transform 3s linear';
                    progressEl.style.transform = 'scaleY(1)';
                }

                // Запускаем только если тикер включен
                const isTickerEnabled = localStorage.getItem('star_sky_weather_ticker') !== 'false';
                if (isTickerEnabled) {
                    const startDelayId = setTimeout(() => {
                        animateProgress();
                    }, 100);
                    const intervalId = setInterval(() => {
                        goToNext();
                        animateProgress();
                    }, 3000);
                    window._weatherVSlideIntervals.push(intervalId);
                }
            });
            _initTimeout = null;
        }, 50);
    }

    function refreshWeatherCarousel() {
    window._weatherTickersRunning = false;
    if (window._weatherVSlideIntervals) {
        window._weatherVSlideIntervals.forEach(id => clearInterval(id));
        window._weatherVSlideIntervals = [];
    }
    startWeatherVSlide();
}

    // Перехватываем обновление погоды
    const originalUpdateWeatherDisplay = window.updateWeatherDisplay;
    window.updateWeatherDisplay = function() {
        if (originalUpdateWeatherDisplay) originalUpdateWeatherDisplay();
        refreshWeatherCarousel();
    };

    // Экспортируем функции
    window.startWeatherVSlide = startWeatherVSlide;
    window.refreshWeatherCarousel = refreshWeatherCarousel;
})();
    
    // Всплывающая подсказка
    let toastTimeout;

    function showToast(directionIcon) {
    // Проверяем включены ли тосты (переменная + localStorage)
    if (!showToastEnabled && !isToastEnabled()) return;
    
    let toast = document.getElementById('carousel-switch-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'carousel-switch-toast';
        toast.style.cssText = `
            position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
            background: rgba(2,6,23,0.85); backdrop-filter: blur(12px);
            padding: 4px 12px; border-radius: 20px;
            font-size: 11px; color: #a5b8f0; z-index: 1000;
            opacity: 0; transition: opacity 0.2s ease;
            pointer-events: none; white-space: nowrap;
            border: 1px solid rgba(109,74,255,0.3);
        `;
        document.body.appendChild(toast);
    }
    const item = getCurrentItem();
    const prefix = directionIcon ? `${directionIcon} ` : '';
    toast.textContent = `${prefix}${item.name}`;
    toast.style.opacity = '1';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.style.opacity = '0'; }, 800);
}

(function addDateTimeClickHandler() {
    const checkInterval = setInterval(() => {
        const track = document.getElementById('carousel-track');
        if (!track) return;
        
        // Находим все элементы виджета времени
        const dateTimeItems = document.querySelectorAll('.carousel-item[data-type="datetime"]');
        
        dateTimeItems.forEach(item => {
            if (item._clickHandled) return;
            item._clickHandled = true;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                // Используем существующий тост
                let toast = document.getElementById('carousel-switch-toast');
                if (!toast) {
                    toast = document.createElement('div');
                    toast.id = 'carousel-switch-toast';
                    toast.style.cssText = `
                        position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
                        background: rgba(2,6,23,0.85); backdrop-filter: blur(12px);
                        padding: 4px 12px; border-radius: 20px;
                        font-size: 11px; color: #a5b8f0; z-index: 1000;
                        opacity: 0; transition: opacity 0.2s ease;
                        pointer-events: none; white-space: nowrap;
                        border: 1px solid rgba(109,74,255,0.3);
                    `;
                    document.body.appendChild(toast);
                }
                
                // Получаем имя виджета из атрибута или текста
                const itemName = 'Время';
                toast.textContent = `${itemName}`;
                toast.style.opacity = '1';
                
                if (window.toastTimeout) clearTimeout(window.toastTimeout);
                window.toastTimeout = setTimeout(() => { 
                    toast.style.opacity = '0'; 
                }, 800);
            });
        });
        
        // Если все виджеты времени обработаны, можно остановить интервал
        const allItems = document.querySelectorAll('.carousel-item[data-type="datetime"]');
        const allHandled = Array.from(allItems).every(item => item._clickHandled);
        if (allHandled && allItems.length > 0) {
            clearInterval(checkInterval);
        }
    }, 500);
})();
    

    // ===== МОДАЛЬНЫЕ ОКНА =====
    let onlineModal = null;
    let weatherModal = null;
    
    function showOnlineUsersModal() {
    document.getElementById('_online-overlay')?.remove();

    const onlineUsers = typeof MOCK_USERS !== 'undefined' 
        ? MOCK_USERS.filter(u => u.active && u.username !== MOCK_USER.username) 
        : [];

    const overlay = document.createElement('div');
    overlay.id = '_online-overlay';
    overlay.className = 'widget-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'widget-modal';
    modal.style.cssText = `background:rgba(6,10,22,0.72);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border:1px solid rgba(34,197,94,0.18);border-radius:28px;box-shadow:0 40px 80px rgba(0,0,0,0.95),0 0 0 1px rgba(255,255,255,0.04),0 0 60px rgba(34,197,94,0.06);width:420px;max-width:calc(100vw - 40px);max-height:82vh;display:flex;flex-direction:column;overflow:hidden;transform:scale(0.92) translateY(16px);transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);`;

    const buildUserCard = (u) => `
        <div class="online-user-item" data-username="${u.username}"
             style="display:flex;align-items:center;gap:13px;padding:11px 14px;
                    border-radius:16px;margin:0 12px 6px;cursor:pointer;
                    transition:all 0.18s cubic-bezier(0.4,0,0.2,1);
                    background:rgba(34,197,94,0.04);
                    border:1px solid rgba(34,197,94,0.1);"
             onmouseover="this.style.background='rgba(34,197,94,0.09)';this.style.borderColor='rgba(34,197,94,0.25)';this.style.transform='translateX(3px)';"
             onmouseout="this.style.background='rgba(34,197,94,0.04)';this.style.borderColor='rgba(34,197,94,0.1)';this.style.transform='';">
            <div style="position:relative;flex-shrink:0;">
                <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,${u.star_color||'#38bdf8'},rgba(109,74,255,0.7));display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;color:white;box-shadow:0 4px 12px rgba(0,0,0,0.4),0 0 16px ${u.star_color||'rgba(56,189,248,0.3)'}40;">${(u.display_name||'?')[0].toUpperCase()}</div>
                <div style="position:absolute;bottom:-2px;right:-2px;width:13px;height:13px;background:#22c55e;border-radius:50%;border:2.5px solid rgba(6,10,22,0.95);box-shadow:0 0 8px rgba(34,197,94,0.8);animation:onlinePulse 2.5s ease-in-out infinite;"></div>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;color:#e8f4e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;">${u.display_name}</div>
                <div style="font-size:10px;color:#3d7a5a;">@${u.username}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:4px;background:rgba(34,197,94,0.12);padding:3px 8px;border-radius:999px;border:1px solid rgba(34,197,94,0.2);">
                    <div style="width:5px;height:5px;background:#4ade80;border-radius:50%;box-shadow:0 0 4px #4ade80;"></div>
                    <span style="font-size:9px;color:#4ade80;font-weight:700;letter-spacing:0.05em;">ОНЛАЙН</span>
                </div>
            </div>
        </div>`;

    const usersList = onlineUsers.length > 0
        ? onlineUsers.map(buildUserCard).join('')
        : `<div style="text-align:center;padding:56px 24px;color:#2d5a42;">
               <div style="font-size:48px;margin-bottom:14px;opacity:0.35;filter:grayscale(0.3);">🌌</div>
               <div style="font-size:13px;font-weight:600;color:#3d7a5a;margin-bottom:4px;">Никого нет онлайн</div>
               <div style="font-size:10px;color:#1e3d2a;">Загляни позже!</div>
           </div>`;

    modal.innerHTML = `
        <div style="position:relative;padding:22px 22px 16px;flex-shrink:0;overflow:hidden;">
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(34,197,94,0.08) 0%,transparent 60%);pointer-events:none;"></div>
            <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;background:radial-gradient(circle,rgba(34,197,94,0.12),transparent 70%);pointer-events:none;"></div>
            <div style="display:flex;align-items:flex-start;gap:14px;position:relative;">
                <div style="flex:1;min-width:0;">
                    <div style="font-size:18px;font-weight:800;letter-spacing:-0.3px;background:linear-gradient(135deg,#f0fff4 30%,#86efac);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:4px;">Сейчас онлайн</div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div style="width:7px;height:7px;background:#22c55e;border-radius:50%;box-shadow:0 0 6px rgba(34,197,94,0.8);animation:onlinePulse 2s ease-in-out infinite;"></div>
                        <span style="font-size:11px;color:#4ade80;font-weight:600;">${onlineUsers.length} ${onlineUsers.length === 1 ? 'пользователь' : onlineUsers.length < 5 ? 'пользователя' : 'пользователей'} в сети</span>
                    </div>
                </div>
                <button class="widget-modal-close" id="online-modal-close" style="flex-shrink:0;">
                  <svg width="30" height="30"><use href="#icon-close"/></svg>
                </button>
            </div>
            <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(34,197,94,0.2),transparent);margin-top:16px;"></div>
        </div>
        <div style="overflow-y:auto;flex:1;padding:8px 0 16px;scrollbar-width:thin;scrollbar-color:rgba(34,197,94,0.3) transparent;">
            ${usersList}
        </div>`;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            requestAnimationFrame(() => {
            overlay.classList.add('visible');
            modal.style.transform = 'scale(1) translateY(0)';
        });

        const closeModal = () => {
        overlay.classList.remove('visible');
        modal.style.transform = 'scale(0.95) translateY(8px)';
        setTimeout(() => overlay.remove(), 250);
        onlineModal = null;
    };

    modal.querySelector('#online-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', e => {
        if (e.target === overlay && window._backdropCloseEnabled !== false) closeModal();
    });

    // Клик по пользователю -> открыть его звезду
    modal.querySelectorAll('.online-user-item').forEach(item => {
        item.addEventListener('click', () => {
            const uname = item.dataset.username;
            if (!uname) return;
            // Ищем реальный объект звезды из массива stars (с правильными полями)
            let starObj = (typeof stars !== 'undefined' && Array.isArray(stars))
                ? stars.find(s => s.username === uname)
                : null;
            // Запасной вариант - создаём объект через createStarObject из MOCK_USERS
            if (!starObj && typeof MOCK_USERS !== 'undefined') {
                const mu = MOCK_USERS.find(u => u.username === uname);
                if (mu && typeof createStarObject === 'function') starObj = createStarObject(mu);
            }
            closeModal();
            if (starObj && typeof showStarCard === 'function') {
                setTimeout(() => showStarCard(starObj), 280);
            }
        });
    });
}
    
    function showTestBadgeModal() {
    // ЛКМ по виджету «Пре-релиз» → отдельная модалка с последним патчноутом
    if (typeof window.openLatestPatchnoteModal === 'function') {
        window.openLatestPatchnoteModal();
    }
}
    
    function showWeatherSettingsModal() {
        document.getElementById('_weather-overlay')?.remove();

        // WMO-код погоды -> иконка + подпись
        function wmoToWeather(code) {
            const map = {
                0: { icon:'☀️', label:'Ясно' },
                1: { icon:'🌤️', label:'Преимущественно ясно' },
                2: { icon:'⛅', label:'Переменная облачность' },
                3: { icon:'☁️', label:'Пасмурно' },
                45: { icon:'🌫️', label:'Туман' },
                48: { icon:'🌫️', label:'Изморозь' },
                51: { icon:'🌦️', label:'Слабая морось' },
                53: { icon:'🌦️', label:'Морось' },
                55: { icon:'🌧️', label:'Сильная морось' },
                61: { icon:'🌧️', label:'Лёгкий дождь' },
                63: { icon:'🌧️', label:'Дождь' },
                65: { icon:'🌧️', label:'Сильный дождь' },
                71: { icon:'🌨️', label:'Лёгкий снег' },
                73: { icon:'❄️', label:'Снег' },
                75: { icon:'❄️', label:'Сильный снег' },
                80: { icon:'🌦️', label:'Ливень' },
                81: { icon:'🌧️', label:'Сильный ливень' },
                95: { icon:'⛈️', label:'Гроза' },
                99: { icon:'⛈️', label:'Гроза с градом' },
            };
            return map[code] || { icon:'🌡️', label:'Неизвестно' };
        }

        const overlay = document.createElement('div');
        overlay.id = '_weather-overlay';
        overlay.className = 'widget-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'widget-modal';
        modal.style.cssText = `
            background:rgba(8,12,24,0.55);
            backdrop-filter:blur(32px) saturate(170%);-webkit-backdrop-filter:blur(32px) saturate(170%);
            border:1px solid rgba(168,85,247,0.25);border-radius:24px;
            box-shadow:0 32px 64px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.04),0 0 50px rgba(168,85,247,0.08);
            width:380px;max-width:calc(100vw - 40px);overflow:hidden;
            transform:scale(0.92) translateY(16px);
            transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);`;

        modal.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;padding:18px 20px 14px;
                        border-bottom:1px solid rgba(168,85,247,0.1);background:rgba(168,85,247,0.04);flex-shrink:0;">
                <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,rgba(168,85,247,0.3),rgba(109,74,255,0.2));
                            border:1px solid rgba(168,85,247,0.35);display:flex;align-items:center;
                            justify-content:center;font-size:20px;flex-shrink:0;box-shadow:0 0 14px rgba(168,85,247,0.25);">🌍</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:16px;font-weight:700;background:linear-gradient(135deg,#f8fafc,#c4b5fd);
                                -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Погода</div>
                    <div style="font-size:10px;color:#6b80a0;margin-top:1px;">Автообновление · Open-Meteo</div>
                </div>
                <button class="widget-modal-close" id="weather-close-btn">
                  <svg width="30" height="30"><use href="#icon-close"/></svg>
                </button>
            </div>
            <div style="padding:16px 18px 20px;">
                <!-- Поиск города -->
                <div style="font-size:10px;font-weight:700;color:#6b84a8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px;">Город</div>
                <div style="position:relative;margin-bottom:14px;">
                  <div style="display:flex;gap:8px;">
                    <div style="position:relative;flex:1;">
                      <input type="text" id="weather-city-input" value="${weatherCity}" placeholder="Введите город..."
                             style="width:100%;padding:10px 13px;border-radius:11px;border:1px solid rgba(168,85,247,0.3);
                                    background:rgba(168,85,247,0.07);color:#e2e8f5;font-size:13px;outline:none;
                                    font-family:'Unbounded',sans-serif;box-sizing:border-box;transition:border-color 0.15s;">
                      <div id="weather-city-suggestions" style="display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;
                           background:rgba(8,12,24,0.95);border:1px solid rgba(168,85,247,0.3);border-radius:11px;
                           overflow:hidden;z-index:10;box-shadow:0 8px 24px rgba(0,0,0,0.6);backdrop-filter:blur(16px);max-height:200px;overflow-y:auto;"></div>
                    </div>
                    <button id="weather-fetch-btn"
                            style="padding:10px 16px;border-radius:11px;border:1px solid rgba(168,85,247,0.4);
                                   background:linear-gradient(135deg,rgba(168,85,247,0.2),rgba(56,189,248,0.1));
                                   color:#c4b5fd;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;
                                   font-family:'Unbounded',sans-serif;transition:all 0.15s;flex-shrink:0;">Найти</button>
                  </div>
                </div>

                <!-- Карточка погоды -->
                <div id="weather-card" style="border-radius:16px;border:1px solid rgba(168,85,247,0.15);
                                              background:linear-gradient(135deg,rgba(168,85,247,0.07),rgba(56,189,248,0.04));
                                              padding:20px 18px;text-align:center;margin-bottom:14px;min-height:140px;
                                              display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;">
                    <div id="weather-status" style="font-size:12px;color:#6b84a8;">Введите город и нажмите «Найти»</div>
                </div>

                <!-- Доп. параметры (появляются после загрузки) -->
                <div id="weather-extras" style="display:none;gap:6px;grid-template-columns:1fr 1fr;"></div>

                <!-- Настройки виджета -->
                <div id="weather-widget-settings" style="margin-top:14px;padding:12px 14px;border-radius:14px;background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.12);">
                  <div style="font-size:10px;font-weight:700;color:#6b84a8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Виджет</div>

                  <!-- Переключатель бегущей строки -->
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div style="font-size:11px;color:#a5b8f0;display:flex;align-items:center;gap:6px;">
                      <span>🎞️</span> Авто-смена деталей
                    </div>
                    <div id="weather-ticker-toggle" style="position:relative;display:inline-block;width:38px;height:20px;cursor:pointer;" title="Вкл/выкл прокрутку">
                      <div id="weather-ticker-track" style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:20px;transition:background 0.25s;"></div>
                      <div id="weather-ticker-knob" style="position:absolute;height:16px;width:16px;bottom:2px;background:white;border-radius:50%;transition:transform 0.25s;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
                    </div>
                  </div>

                  <!-- Отдельный тогл показа названия города -->
                  <div class="weather-city-toggle-row">
                    <div class="wc-label">
                      <span class="wc-title">📍 Показывать город</span>
                      <span class="wc-hint">Название города на виджете погоды</span>
                    </div>
                    <div id="weather-city-toggle" style="position:relative;display:inline-block;width:44px;height:22px;cursor:pointer;flex-shrink:0;">
                      <div id="weather-city-track" style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:22px;transition:background 0.25s;"></div>
                      <div id="weather-city-knob" style="position:absolute;height:18px;width:18px;bottom:2px;background:white;border-radius:50%;transition:transform 0.25s;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>
                    </div>
                  </div>

                  <!-- Чекбоксы полей -->
                  <div style="font-size:9px;color:#4a6080;text-transform:uppercase;letter-spacing:0.05em;margin:8px 0 6px;">Показывать в виджете</div>
                  <div id="weather-field-checks" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                  </div>
                </div>

                <button id="weather-apply-btn" style="display:none;width:100%;padding:11px;border-radius:12px;
                        border:1px solid rgba(34,197,94,0.35);background:linear-gradient(135deg,rgba(34,197,94,0.15),rgba(16,185,129,0.08));
                        color:#4ade80;font-size:11px;font-weight:700;cursor:default;margin-top:12px;
                        font-family:'Unbounded',sans-serif;align-items:center;justify-content:center;gap:6px;pointer-events:none;">
                    ✓ Виджет обновлён автоматически
                </button>
            </div>`;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => requestAnimationFrame(() => {
            overlay.classList.add('visible');
            modal.style.transform = 'scale(1) translateY(0)';
        }));

        const closeWeather = () => {
            overlay.classList.remove('visible');
            modal.style.transform = 'scale(0.95) translateY(8px)';
            setTimeout(() => overlay.remove(), 250);
            weatherModal = null;
        };

        const cityInput = modal.querySelector('#weather-city-input');
        const fetchBtn = modal.querySelector('#weather-fetch-btn');
        const card = modal.querySelector('#weather-card');
        const extras = modal.querySelector('#weather-extras');
        const applyBtn = modal.querySelector('#weather-apply-btn');
        let fetchedData = null;
        let fetchedCity = '';

        cityInput.addEventListener('focus', () => cityInput.style.borderColor = 'rgba(168,85,247,0.65)');
        cityInput.addEventListener('blur', () => { cityInput.style.borderColor = 'rgba(168,85,247,0.3)'; setTimeout(() => { suggestionsEl.style.display = 'none'; }, 180); });
        cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') { suggestionsEl.style.display = 'none'; fetchBtn.click(); } });

        const suggestionsEl = modal.querySelector('#weather-city-suggestions');
        let suggestTimer = null;

        cityInput.addEventListener('input', () => {
            clearTimeout(suggestTimer);
            const q = cityInput.value.trim();
            if (q.length < 2) { suggestionsEl.style.display = 'none'; return; }
            suggestTimer = setTimeout(async () => {
                try {
                    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ru&format=json`);
                    const data = await res.json();
                    if (!data.results || !data.results.length) { suggestionsEl.style.display = 'none'; return; }
                    suggestionsEl.innerHTML = '';
                    data.results.forEach(loc => {
                        const cityName = loc.name;
                        const country = loc.country || '';
                        const label = country ? `${cityName}, ${country}` : cityName;
                        const item = document.createElement('div');
                        item.style.cssText = 'padding:9px 14px;cursor:pointer;font-size:12px;color:#c4cfe8;border-bottom:1px solid rgba(168,85,247,0.08);transition:background 0.12s;display:flex;align-items:center;gap:8px;';
                        item.innerHTML = `<span style="font-size:14px;">📍</span><div><div style="font-size:12px;color:#e2e8f5;">${cityName}</div><div style="font-size:10px;color:#4a6080;">${country}</div></div>`;
                        item.addEventListener('mouseenter', () => item.style.background = 'rgba(168,85,247,0.12)');
                        item.addEventListener('mouseleave', () => item.style.background = '');
                        item.addEventListener('mousedown', () => {
                            cityInput.value = label;
                            suggestionsEl.style.display = 'none';
                            // Прямой запрос по сохранённым координатам — без геокодирования
                            _pendingGeoLat = loc.latitude;
                            _pendingGeoLon = loc.longitude;
                            _pendingGeoLabel = label;
                            fetchBtn.click();
                        });
                        suggestionsEl.appendChild(item);
                    });
                    suggestionsEl.style.display = 'block';
                } catch(e) { suggestionsEl.style.display = 'none'; }
            }, 320);
        });

        // Сохраняем координаты из автодополнения, чтобы не геокодировать повторно
        let _pendingGeoLat = null, _pendingGeoLon = null, _pendingGeoLabel = null;

        function setLoading() {
            card.innerHTML = `<div style="font-size:24px;margin-bottom:8px;animation:shopRing 1s linear infinite;">⏳</div><div style="font-size:12px;color:#6b84a8;">Загрузка данных...</div>`;
            extras.style.display = 'none';
            applyBtn.style.display = 'none';
        }

        function setError(msg) {
            card.innerHTML = `<div style="font-size:28px;margin-bottom:8px;">❌</div><div style="font-size:12px;color:#f87171;">${msg}</div>`;
            extras.style.display = 'none';
            applyBtn.style.display = 'none';
        }

        function setWeather(data, cityName) {
            const w = wmoToWeather(data.current.weather_code);
            const temp = Math.round(data.current.temperature_2m);
            const feels = Math.round(data.current.apparent_temperature);
            const wind = Math.round(data.current.wind_speed_10m);
            const humidity = data.current.relative_humidity_2m;
            const isDay = data.current.is_day;

            card.innerHTML = `
                <div style="font-size:52px;margin-bottom:6px;filter:drop-shadow(0 0 12px rgba(168,85,247,0.4));">${w.icon}</div>
                <div style="font-size:36px;font-weight:800;color:#e2e8f5;letter-spacing:-1px;line-height:1;">${temp > 0 ? '+' : ''}${temp}°C</div>
                <div style="font-size:13px;font-weight:600;color:#c4b5fd;margin-top:4px;">${w.label}</div>
                <div style="font-size:11px;color:#4a6080;margin-top:2px;">${cityName}</div>
            `;

            extras.style.cssText = 'display:grid;gap:6px;grid-template-columns:1fr 1fr;margin-bottom:0;';
            extras.innerHTML = `
                <div style="padding:10px 12px;border-radius:12px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.12);display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">🌡️</span>
                    <div><div style="font-size:9px;color:#4a6080;text-transform:uppercase;letter-spacing:.05em;">Ощущается</div><div style="font-size:13px;font-weight:700;color:#a5b8f0;">${feels > 0 ? '+' : ''}${feels}°C</div></div>
                </div>
                <div style="padding:10px 12px;border-radius:12px;background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.12);display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">💨</span>
                    <div><div style="font-size:9px;color:#4a6080;text-transform:uppercase;letter-spacing:.05em;">Ветер</div><div style="font-size:13px;font-weight:700;color:#7dd3fc;">${wind} км/ч</div></div>
                </div>
                <div style="padding:10px 12px;border-radius:12px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.12);display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">💧</span>
                    <div><div style="font-size:9px;color:#4a6080;text-transform:uppercase;letter-spacing:.05em;">Влажность</div><div style="font-size:13px;font-weight:700;color:#4ade80;">${humidity}%</div></div>
                </div>
                <div style="padding:10px 12px;border-radius:12px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.12);display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;">${isDay ? '☀️' : '🌙'}</span>
                    <div><div style="font-size:9px;color:#4a6080;text-transform:uppercase;letter-spacing:.05em;">Время суток</div><div style="font-size:13px;font-weight:700;color:#fbbf24;">${isDay ? 'День' : 'Ночь'}</div></div>
                </div>
            `;

            applyBtn.style.cssText = 'display:flex;width:100%;padding:11px;border-radius:12px;border:1px solid rgba(168,85,247,0.4);background:linear-gradient(135deg,rgba(168,85,247,0.22),rgba(56,189,248,0.12));color:#c4b5fd;font-size:12px;font-weight:700;cursor:pointer;margin-top:14px;font-family:\'Unbounded\',sans-serif;transition:all 0.15s;align-items:center;justify-content:center;gap:6px;';
            applyBtn.innerHTML = 'Применить для виджета';

            fetchedData = { temp: (temp > 0 ? '+' : '') + temp, condition: w.label, icon: w.icon, feels, wind, humidity, isDay };
            fetchedCity = cityName;

            // Автоматически применяем данные погоды к виджету
            weatherData = fetchedData;
            weatherCity = fetchedCity;
            localStorage.setItem('star_sky_weather_city', weatherCity);
            localStorage.setItem('star_sky_weather_data', JSON.stringify(weatherData));
            updateWeatherDisplay();
            setTimeout(updateCurrentItemData, 100);
        }

        async function doFetch() {
            const city = cityInput.value.trim();
            if (!city) return;
            setLoading();

            try {
                let lat, lon, displayName;

                // Если координаты уже выбраны из автодополнения — используем их напрямую
                if (_pendingGeoLat !== null && _pendingGeoLon !== null) {
                    lat = _pendingGeoLat;
                    lon = _pendingGeoLon;
                    displayName = _pendingGeoLabel || city;
                    _pendingGeoLat = null; _pendingGeoLon = null; _pendingGeoLabel = null;
                } else {
                    // Геокодирование города -> lat/lon через Open-Meteo geocoding API
                    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`);
                    const geoData = await geoRes.json();
                    if (!geoData.results || !geoData.results.length) { setError('Город не найден. Попробуйте по-английски.'); return; }
                    const loc = geoData.results[0];
                    lat = loc.latitude;
                    lon = loc.longitude;
                    displayName = loc.name + (loc.country ? ', ' + loc.country : '');
                }

                // Получаем погоду
                const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh&timezone=auto`);
                const wxData = await wxRes.json();
                setWeather(wxData, displayName);
            } catch(e) {
                setError('Ошибка сети. Проверьте подключение.');
            }
        }

        fetchBtn.addEventListener('click', doFetch);

        // Переключатель бегущей строки
        const tickerToggle = modal.querySelector('#weather-ticker-toggle');
        const tickerTrack = modal.querySelector('#weather-ticker-track');
        const tickerKnob = modal.querySelector('#weather-ticker-knob');
        function applyTickerToggleUI() {
          tickerTrack.style.background = weatherTickerEnabled ? 'rgba(168,85,247,0.6)' : 'rgba(109,74,255,0.2)';
          tickerKnob.style.transform = weatherTickerEnabled ? 'translateX(18px)' : 'translateX(2px)';
        }
        applyTickerToggleUI();
        tickerToggle.addEventListener('click', () => {
          weatherTickerEnabled = !weatherTickerEnabled;
          applyTickerToggleUI();
          saveWeatherDisplaySettings();
          updateWeatherDisplay();
        });

        // Тогл «Показывать город» — дублирует поле city, но отдельно для удобства
        const cityToggleEl = modal.querySelector('#weather-city-toggle');
        const cityTrackEl = modal.querySelector('#weather-city-track');
        const cityKnobEl = modal.querySelector('#weather-city-knob');
        function applyWeatherCityToggleUI() {
          const on = !!weatherDisplayFields.city;
          cityTrackEl.style.background = on ? 'rgba(168,85,247,0.6)' : 'rgba(109,74,255,0.22)';
          cityKnobEl.style.transform = on ? 'translateX(24px)' : 'translateX(2px)';
        }
        applyWeatherCityToggleUI();
        cityToggleEl.addEventListener('click', () => {
          weatherDisplayFields.city = !weatherDisplayFields.city;
          applyWeatherCityToggleUI();
          saveWeatherDisplaySettings();
          updateWeatherDisplay();
        });

        // Чекбоксы полей (город вынесен в отдельный тогл выше)
        const WEATHER_FIELDS = [
          { key: 'condition', label: '🌤️ Состояние' },
          { key: 'feels', label: '🌡️ Ощущается' },
          { key: 'wind', label: '💨 Ветер' },
          { key: 'humidity', label: '💧 Влажность' },
          { key: 'timeOfDay', label: '🌅 Время суток' },
        ];
        const checksContainer = modal.querySelector('#weather-field-checks');
        WEATHER_FIELDS.forEach(f => {
          const row = document.createElement('label');
          row.style.cssText = 'display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:9px;background:rgba(109,74,255,0.06);border:1px solid rgba(109,74,255,0.12);cursor:pointer;transition:background 0.15s;font-size:10px;color:#a5b8f0;user-select:none;';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!weatherDisplayFields[f.key];
          cb.style.cssText = 'accent-color:#a78bfa;width:14px;height:14px;flex-shrink:0;cursor:pointer;';
          cb.addEventListener('change', () => {
            weatherDisplayFields[f.key] = cb.checked;
            saveWeatherDisplaySettings();
            updateWeatherDisplay();
          });
          row.appendChild(cb);
          row.appendChild(document.createTextNode(f.label));
          row.addEventListener('mouseenter', () => row.style.background = 'rgba(109,74,255,0.14)');
          row.addEventListener('mouseleave', () => row.style.background = 'rgba(109,74,255,0.06)');
          checksContainer.appendChild(row);
        });

        applyBtn.addEventListener('click', () => {
            if (fetchedData) {
                weatherData = fetchedData;
                weatherCity = fetchedCity;
                localStorage.setItem('star_sky_weather_city', weatherCity);
                localStorage.setItem('star_sky_weather_data', JSON.stringify(weatherData));
                updateWeatherDisplay();
                closeWeather();
                showToastMessage('🌍 Погода сохранена: ' + fetchedCity);
                setTimeout(updateCurrentItemData, 100);
            }
        });

        modal.querySelector('#weather-close-btn').addEventListener('click', closeWeather);
        overlay.addEventListener('click', e => {
            if (e.target === overlay && window._backdropCloseEnabled !== false) closeWeather();
        });

        // Автозагрузка, если город уже установлен
        if (weatherCity && weatherCity !== 'Москва') { setTimeout(doFetch, 300); }

        weatherModal = overlay;
    }
    
    function showToastMessage(msg) {
        let toast = document.getElementById('weather-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'weather-toast';
            toast.style.cssText = `
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                background: rgba(2,6,23,0.85); backdrop-filter: blur(12px);
                padding: 8px 20px; border-radius: 20px;
                font-size: 12px; color: #c4b5fd; z-index: 10000;
                opacity: 0; transition: opacity 0.2s ease;
                pointer-events: none; white-space: nowrap;
                border: 1px solid rgba(168,85,247,0.3);
            `;
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; }, 2000);
    }
    
    // Эффект размытия
    function addBlurEffect() {
        if (!carousel) return;
        carousel.style.transition = 'filter 0.1s ease';
        setTimeout(() => {
            setTimeout(() => { if (carousel) carousel.style.transition = ''; }, 150);
        }, 150);
    }
    

    // ===== ОБРАБОТЧИКИ =====
    
    // Колесико мыши
    let wheelTimer = null;
    let wheelAccumulator = 0;
    
    function handleWheel(e) {
        if (autoScrollEnabled) {
            stopAutoScroll();
            setTimeout(() => startAutoScroll(), autoScrollDelay);
        }
        e.preventDefault();
        if (isAnimating) return;
        
        addBlurEffect();
        
        wheelAccumulator += e.deltaY > 0 ? 1 : -1;
        
        if (wheelTimer) clearTimeout(wheelTimer);
        
        if (Math.abs(wheelAccumulator) >= 1) {
            switchTo(wheelAccumulator > 0 ? 1 : -1);
            wheelAccumulator = 0;
        }
        
        wheelTimer = setTimeout(() => { wheelAccumulator = 0; }, 200);
    }
    
    // Клик
    function handleClick(e) {
        e.stopPropagation();
        const item = getCurrentItem();

        if (item.action === null) return;

        if (item.id === 'online') showOnlineUsersModal();
        else if (item.id === 'notif') { if (typeof window.openNotifPanel === 'function') window.openNotifPanel(); }
        else if (item.id === 'test') showTestBadgeModal();
        else if (item.id === 'weather') showWeatherSettingsModal();

        // Перезапускаем автопрокрутку только если она включена
        if (autoScrollEnabled) {
            stopAutoScroll();
            startAutoScroll();
        }
    }
    
    // Свайпы
    let touchDeltaY = 0;
    
    function handleTouchStart(e) {
        if (autoScrollEnabled) {
            stopAutoScroll();
        }
        if (isAnimating) return;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        dragStartIndex = currentRealIndex;
        isDragging = true;
        touchDeltaY = 0;
        
        if (track) track.style.transition = 'none';
    }
    
    function handleTouchMove(e) {
        if (!isDragging) return;
        touchDeltaY = e.touches[0].clientY - touchStartY;
        
        const newY = -(dragStartIndex * itemHeight) + touchDeltaY;
        if (track) track.style.transform = `translateY(${newY}px)`;
    }
    
    function handleTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        const deltaY = e.changedTouches[0].clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        if (Math.abs(deltaY) > 20 && deltaTime < 300) {
            addBlurEffect();
            switchTo(deltaY > 0 ? -1 : 1);
        } else {
            updatePosition(currentRealIndex, true);
        }

        // Перезапускаем автопрокрутку только если она включена
        if (autoScrollEnabled) {
            stopAutoScroll();
            startAutoScroll();
        }
    }

    // Загрузка сохранённого города погоды
function loadWeatherCity() {
    try {
        const saved = localStorage.getItem('star_sky_weather_city');
        if (saved) {
            weatherCity = saved;
            // Если есть сохранённые данные — сразу обновляем
            const savedData = localStorage.getItem('star_sky_weather_data');
            if (savedData) weatherData = JSON.parse(savedData);
        }
    } catch(e) {}
}
loadWeatherCity();

    // Фоновое обновление погоды
    async function autoFetchWeatherBg() {
        if (!weatherCity) return;
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherCity)}&count=1&language=ru&format=json`);
            const geoData = await geoRes.json();
            if (!geoData.results || !geoData.results.length) return;
            const loc = geoData.results[0];
            const cityName = loc.name + (loc.country ? ", " + loc.country : "");
            const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day&wind_speed_unit=kmh&timezone=auto`);
            const wxData = await wxRes.json();
            const wmo = wxData.current.weather_code;
            const WMO_MAP = {0:"☀️",1:"🌤️",2:"⛅",3:"☁️",45:"🌫️",48:"🌫️",51:"🌦️",53:"🌦️",55:"🌧️",61:"🌧️",63:"🌧️",65:"🌧️",71:"❄️",73:"❄️",75:"❄️",80:"🌦️",81:"🌧️",82:"🌧️",95:"⛈️",96:"⛈️",99:"⛈️"};
            const WMO_LABELS = {0:"Ясно",1:"Преимущественно ясно",2:"Переменная облачность",3:"Пасмурно",45:"Туманно",51:"Небольшой дождь",53:"Дождь",55:"Проливной дождь",61:"Дождь",63:"Дождь",65:"Сильный дождь",71:"Снег",73:"Умеренный снег",75:"Сильный снег",80:"Ливень",81:"Сильный ливень",82:"Проливной ливень",95:"Гроза",96:"Гроза с градом",99:"Сильная гроза"};
            const icon = WMO_MAP[wmo] || "🌡️";
            const label = WMO_LABELS[wmo] || "Неизвестно";
            const temp = Math.round(wxData.current.temperature_2m);
            const feels = Math.round(wxData.current.apparent_temperature);
            const wind = Math.round(wxData.current.wind_speed_10m);
            const humidity = wxData.current.relative_humidity_2m;
            const isDay = wxData.current.is_day;
            const newData = { temp: (temp > 0 ? "+" : "") + temp, condition: label, icon, feels, wind, humidity, isDay };
            weatherData = newData;
            weatherCity = cityName;
            localStorage.setItem("star_sky_weather_city", weatherCity);
            localStorage.setItem("star_sky_weather_data", JSON.stringify(weatherData));
            updateWeatherDisplay();
            setTimeout(updateCurrentItemData, 100);
        } catch(e) {}
    }
    setTimeout(autoFetchWeatherBg, 1500);
    setInterval(autoFetchWeatherBg, 30 * 60 * 1000);
    
// Инициализация
function initCarousel() {
    if (!track || !carousel) return;
    
    buildCarousel();
    updateOnlineStats();
    updateDateTime();
    // Инициализация бегущей строки погоды после построения карусели
    setTimeout(startWeatherTickers, 200);
    
    // Загружаем настройки из localStorage
    try {
        const saved = localStorage.getItem('star_sky_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (typeof settings.carouselAutoScroll !== 'undefined') {
                autoScrollEnabled = settings.carouselAutoScroll;
            }
            if (typeof settings.carouselShowToast !== 'undefined') {
                showToastEnabled = settings.carouselShowToast;
            }
        }
    } catch(e) {}
    
    // Восстанавливаем последний выбранный виджет
    let restoredWidget = null;
    try {
        const lastWidgetIdx = localStorage.getItem('star_sky_last_widget');
        if (lastWidgetIdx !== null) {
            const idx = parseInt(lastWidgetIdx, 10);
            if (!isNaN(idx) && idx >= 0 && idx < carouselItems.length) {
                restoredWidget = carouselItems[idx].id;
            }
        }
    } catch(e) {}

    // Находим индекс элемента в ЦЕНТРЕ бесконечного массива
    const centerBlockStart = Math.floor(allItems.length / 2) - Math.floor(carouselItems.length / 2);
    let targetIndex = -1;
    const targetId = restoredWidget || 'online';

    for (let i = centerBlockStart; i < allItems.length; i++) {
        if (allItems[i].id === targetId) {
            targetIndex = i;
            break;
        }
    }
    
    if (targetIndex !== -1) {
        currentRealIndex = targetIndex;
        updatePosition(currentRealIndex, false);
        updateCurrentItemData();
    }
    
    setInterval(updateDateTime, 60000);
    setInterval(updateOnlineStats, 30000);
    
    carousel.addEventListener('wheel', handleWheel, { passive: false });
    carousel.addEventListener('click', handleClick);
    carousel.addEventListener('touchstart', handleTouchStart, { passive: false });
    carousel.addEventListener('touchmove', handleTouchMove, { passive: false });
    carousel.addEventListener('touchend', handleTouchEnd);
    
    // Запускаем автопрокрутку
    startAutoScroll();

    // Экспортируем управление в window для доступа из тоглов
    window._carouselSetAutoScroll = function(enabled) {
        autoScrollEnabled = enabled;
        stopAutoScroll();
        if (enabled) startAutoScroll();
    };
    window._carouselSetToast = function(enabled) {
        showToastEnabled = enabled;
    };
    window._carouselGetAutoScroll = function() { return autoScrollEnabled; };
    window._carouselGetToast = function() { return showToastEnabled; };
}
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCarousel);
    } else {
        setTimeout(initCarousel, 100);
    }
})();

// Настройка переключателей карусели
(function initCarouselTogglesFixed() {
    function updateToggleUI(toggleContainer, isActive) {
        const track = toggleContainer.querySelector('.toggle-track');
        const knob = toggleContainer.querySelector('.toggle-knob');
        if (track && knob) {
            if (isActive) {
                track.style.background = '#6d4aff';
                knob.style.transform = 'translateX(22px)';
            } else {
                track.style.background = 'rgba(109,74,255,0.25)';
                knob.style.transform = 'translateX(0)';
            }
        }
    }
    
    function saveSetting(key, value) {
        try {
            const saved = localStorage.getItem('star_sky_settings');
            let settings = saved ? JSON.parse(saved) : {};
            settings[key] = value;
            localStorage.setItem('star_sky_settings', JSON.stringify(settings));
        } catch(e) {}
    }
    
    function initToggles() {
        const autoToggleContainer = document.querySelector('.custom-toggle[data-toggle="auto"]');
        const toastToggleContainer = document.querySelector('.custom-toggle[data-toggle="toast"]');
        
        if (!autoToggleContainer || !toastToggleContainer) return;
        
        // Загружаем сохранённые настройки
        const autoEnabled = isAutoScrollEnabled();
        const toastEnabled = isToastEnabled();

        // Синхронизируем с каруселью
        if (typeof window._carouselSetAutoScroll === 'function') window._carouselSetAutoScroll(autoEnabled);
        if (typeof window._carouselSetToast === 'function') window._carouselSetToast(toastEnabled);
        
        // Обновляем UI
        updateToggleUI(autoToggleContainer, autoEnabled);
        updateToggleUI(toastToggleContainer, toastEnabled);
        
        // Обработчик для автопрокрутки
        autoToggleContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            const newState = !isAutoScrollEnabled();
            saveSetting('carouselAutoScroll', newState);

            // Применяем сразу через экспортированную функцию
            if (typeof window._carouselSetAutoScroll === 'function') {
                window._carouselSetAutoScroll(newState);
            }

            updateToggleUI(autoToggleContainer, newState);
        });
        
        // Обработчик для тостов
        toastToggleContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            const newState = !isToastEnabled();
            saveSetting('carouselShowToast', newState);

            if (typeof window._carouselSetToast === 'function') {
                window._carouselSetToast(newState);
            }

            updateToggleUI(toastToggleContainer, newState);
        });
    }
    
    // Ждём появления элементов
    const checkInterval = setInterval(() => {
        const toggles = document.querySelectorAll('.custom-toggle');
        if (toggles.length >= 2) {
            clearInterval(checkInterval);
            initToggles();
        }
    }, 100);
})();

// Слушаем изменения в localStorage (из других вкладок)
window.addEventListener('storage', function(e) {
    if (e.key === 'star_sky_settings') {
        const autoEnabled = isAutoScrollEnabled();
        const toastEnabled = isToastEnabled();

        if (typeof window._carouselSetAutoScroll === 'function') {
            window._carouselSetAutoScroll(autoEnabled);
        }
        if (typeof window._carouselSetToast === 'function') {
            window._carouselSetToast(toastEnabled);
        }

        // Обновляем UI переключателей без перезагрузки
        const autoToggle = document.querySelector('.custom-toggle[data-toggle="auto"]');
        const toastToggle = document.querySelector('.custom-toggle[data-toggle="toast"]');
        if (autoToggle) {
            const track = autoToggle.querySelector('.toggle-track');
            const knob = autoToggle.querySelector('.toggle-knob');
            if (track) track.style.background = autoEnabled ? '#6d4aff' : 'rgba(109,74,255,0.25)';
            if (knob) knob.style.transform = autoEnabled ? 'translateX(22px)' : 'translateX(0)';
        }
        if (toastToggle) {
            const track = toastToggle.querySelector('.toggle-track');
            const knob = toastToggle.querySelector('.toggle-knob');
            if (track) track.style.background = toastEnabled ? '#6d4aff' : 'rgba(109,74,255,0.25)';
            if (knob) knob.style.transform = toastEnabled ? 'translateX(22px)' : 'translateX(0)';
        }
    }
});

// Функция для проверки включена ли автопрокрутка из настроек
function isAutoScrollEnabled() {
    try {
        const saved = localStorage.getItem('star_sky_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (typeof settings.carouselAutoScroll !== 'undefined') {
                return settings.carouselAutoScroll;
            }
        }
    } catch(e) {}
    return true;
}

// Функция для проверки включены ли тосты из настроек
function isToastEnabled() {
    try {
        const saved = localStorage.getItem('star_sky_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            if (typeof settings.carouselShowToast !== 'undefined') {
                return settings.carouselShowToast;
            }
        }
    } catch(e) {}
    return true;
}


// ===== СИСТЕМА УВЕДОМЛЕНИЙ =====
(function() {
    // Хранилище
    const MAX_NOTIFS = 50;
    let notifications = [];
    let unreadCount = 0;
    let panelOpen = false;

    // Типы уведомлений
    const NOTIF_TYPES = {
        mention: { icon: '@', label: 'Упоминание' },
        message: { icon: '💬', label: 'Сообщение' },
        system: { icon: '⚡', label: 'Система' },
        friend: { icon: '👥', label: 'Друзья' },
    };

    // Добавление уведомления
    function addNotification(type, title, text, opts = {}) {
        const id = Date.now() + Math.random();
        const now = new Date();
        const time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        const notif = { id, type, title, text, time, read: false, ...opts };

        notifications.unshift(notif);
        if (notifications.length > MAX_NOTIFS) notifications.pop();
        unreadCount++;

        updateCarouselWidget();
        if (!panelOpen) showPopup(notif);
        if (panelOpen) renderPanel();

        // Воспроизводим звук уведомления
        try {
            if (typeof playSound === 'function' && !allSoundsMuted) {
                const snd = type === 'mention' ? (soundSettings && soundSettings.mention || 'bell_echo')
                          : type === 'message' ? (soundSettings && soundSettings.private || 'harp')
                          : (soundSettings && soundSettings.system || 'synth');
                playSound(snd);
            }
        } catch(e) {}

        return id;
    }

    // Popup под топбаром
    const stack = document.getElementById('notif-stack');
    const POPUP_DURATION = 4500;

    function showPopup(notif) {
        if (!stack) return;
        // Проверяем тогл всплывающих уведомлений
        if (typeof window._isNotifPopupEnabled === 'function' && !window._isNotifPopupEnabled()) return;
        if (window._notifPopupEnabled === false) return;
        const typeInfo = NOTIF_TYPES[notif.type] || NOTIF_TYPES.system;

        const el = document.createElement('div');
        el.className = `notif-popup type-${notif.type}`;
        el.dataset.notifId = notif.id;
        el.innerHTML = `
            <div class="notif-popup-icon">${typeInfo.icon}</div>
            <div class="notif-popup-body">
                <div class="notif-popup-title">${notif.title}</div>
                <div class="notif-popup-text">${notif.text}</div>
            </div>
            <button class="notif-popup-close" title="Закрыть">✕</button>
            <div class="notif-popup-bar" style="animation-duration:${POPUP_DURATION}ms"></div>
        `;

        stack.appendChild(el);
        // Анимация появления
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));

        const dismiss = () => removePopup(el);

        el.querySelector('.notif-popup-close').addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss();
        });
        el.addEventListener('click', () => {
            markRead(notif.id);
            dismiss();
            handleNotifAction(notif);
        });

        const timer = setTimeout(dismiss, POPUP_DURATION);
        el._timer = timer;
    }

    function removePopup(el) {
        clearTimeout(el._timer);
        el.classList.add('hiding');
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 200);
    }

    // Обновление виджета карусели
    function updateCarouselWidget() {
        const dot = document.getElementById('carousel-notif-dot');
        const count = document.getElementById('carousel-notif-count');
        const label = document.getElementById('carousel-notif-label');
        if (!dot || !count || !label) return;

        if (unreadCount > 0) {
            dot.classList.add('has-unread');
            count.classList.add('has-unread');
            count.textContent = unreadCount + (unreadCount === 1 ? ' уведомление' : unreadCount < 5 ? ' уведомления' : ' уведомлений');
            // Последнее уведомление как превью
            const last = notifications.find(n => !n.read);
            if (last) label.textContent = last.title;
        } else {
            dot.classList.remove('has-unread');
            count.classList.remove('has-unread');
            count.textContent = 'Всё прочитано';
            label.textContent = 'Всё тихо';
        }
    }

    // Панель уведомлений
    function buildPanelHTML() {
        if (notifications.length === 0) {
            return `<div style="text-align:center;padding:36px 16px;color:#3d5473;font-size:12px;line-height:1.8;">
                        <div style="font-size:32px;margin-bottom:10px;opacity:0.5;">🔔</div>
                        Уведомлений пока нет
                    </div>`;
        }
        return notifications.map(n => {
            const typeInfo = NOTIF_TYPES[n.type] || NOTIF_TYPES.system;
            const unreadDot = n.read ? '' : `<div style="width:6px;height:6px;border-radius:50%;background:#6d4aff;box-shadow:0 0 5px rgba(109,74,255,0.8);flex-shrink:0;"></div>`;
            const actionHint = n.type==='mention' ? `<div style="font-size:9px;color:#7c5cfc;margin-top:3px;">↗ Перейти к сообщению</div>`
                             : n.type==='friend'  ? `<div style="font-size:9px;color:#ec4899;margin-top:3px;">↗ Открыть запросы в друзья</div>`
                             : n.type==='message' ? `<div style="font-size:9px;color:#38bdf8;margin-top:3px;">↗ Открыть чат</div>`
                             : '';
            return `
            <div class="notif-panel-item type-${n.type}${n.read ? ' read' : ''}" data-notif-id="${n.id}" style="
                display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
                border-radius:12px;cursor:pointer;transition:background 0.15s;
                background:${n.read ? 'transparent' : 'rgba(109,74,255,0.06)'};
                border:1px solid ${n.read ? 'rgba(255,255,255,0.04)' : 'rgba(109,74,255,0.15)'};
                margin-bottom:5px;
            ">
                <div style="width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;
                    background:${n.type==='mention'?'rgba(139,74,255,0.18)':n.type==='friend'?'rgba(236,72,153,0.12)':n.type==='system'?'rgba(251,191,36,0.10)':'rgba(56,189,248,0.10)'};
                    border:1px solid ${n.type==='mention'?'rgba(139,74,255,0.3)':n.type==='friend'?'rgba(236,72,153,0.25)':n.type==='system'?'rgba(251,191,36,0.2)':'rgba(56,189,248,0.2)'};
                ">${typeInfo.icon}</div>
                <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
                        ${unreadDot}
                        <span style="font-size:11px;font-weight:700;color:${n.read?'#6b84a8':'#c4cfe8'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${n.title}</span>
                        <span style="font-size:9px;color:#3d5473;margin-left:auto;flex-shrink:0;">${n.time}</span>
                    </div>
                    <div style="font-size:10px;color:#4a6080;overflow:hidden;text-overflow:ellipsis;">${n.text}</div>
                    ${actionHint}
                </div>
            </div>`;
        }).join('');
    }

    function renderPanel() {
        const body = document.getElementById('notif-panel-body');
        if (body) body.innerHTML = buildPanelHTML();
        document.querySelectorAll('.notif-panel-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = parseFloat(el.dataset.notifId);
                const notif = notifications.find(x => x.id === id);
                markRead(id);
                updateCarouselWidget();
                // Закрываем панель и выполняем навигацию
                const overlay = document.getElementById('notif-panel-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.pointerEvents = 'none';
                    const panel = document.getElementById('notif-panel');
                    if (panel) panel.style.transform = 'scale(0.95) translateY(8px)';
                    panelOpen = false;
                    setTimeout(() => { overlay.remove(); if (notif) handleNotifAction(notif); }, 200);
                } else if (notif) {
                    handleNotifAction(notif);
                }
            });
        });
    }

    // Навигация по уведомлению
    function handleNotifAction(notif) {
        if (!notif) return;
        // Переход к сообщению (упоминание или личное сообщение)
        if (notif.msgId) {
            const containers = ['chat-messages','chat-private-messages','mob-chat-messages','mob-private-messages'];
            let found = null;
            for (const cid of containers) {
                const c = document.getElementById(cid);
                if (!c) continue;
                found = c.querySelector(`[data-msg-id="${notif.msgId}"]`);
                if (found) break;
            }
            if (found) {
                // Открываем чат если нужно
                const chatOverlayEl = document.getElementById('chat-overlay');
                if (chatOverlayEl && chatOverlayEl.classList.contains('collapsed')) {
                    chatOverlayEl.classList.remove('collapsed');
                }
                // Переключаем на нужную вкладку
                const inPrivate = found.closest('#chat-private-messages');
                if (typeof switchChatTab === 'function') switchChatTab(inPrivate ? 'private' : 'public');
                setTimeout(() => {
                    found.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    found.style.transition = 'background 0.2s';
                    const orig = found.style.background;
                    found.style.background = 'rgba(135,116,225,0.4)';
                    setTimeout(() => { found.style.background = orig; }, 1400);
                }, 150);
                return;
            }
        }
        // Заявка в друзья
        if (notif.type === 'friend') {
            const pendingTab = document.querySelector('.friends-tab[data-ftab="pending"]');
            if (pendingTab) pendingTab.click();
            if (typeof openFriendsModal === 'function') openFriendsModal();
            return;
        }
        // Упоминание/сообщение без msgId - открываем чат
        if (notif.type === 'mention' || notif.type === 'message') {
            const chatOverlayEl = document.getElementById('chat-overlay');
            if (chatOverlayEl && chatOverlayEl.classList.contains('collapsed')) chatOverlayEl.classList.remove('collapsed');
            if (typeof switchChatTab === 'function') switchChatTab('public');
            const msgs = document.getElementById('chat-messages');
            if (msgs) setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 100);
        }
    }
    window.handleNotifAction = handleNotifAction;

    function markRead(id) {
        const n = notifications.find(x => x.id === id);
        if (n && !n.read) { n.read = true; unreadCount = Math.max(0, unreadCount - 1); }
        updateCarouselWidget();
    }

    function markAllRead() {
        notifications.forEach(n => { n.read = true; });
        unreadCount = 0;
        updateCarouselWidget();
        renderPanel();
    }

    function openNotifPanel() {
        if (document.getElementById('notif-panel-overlay')) {
            document.getElementById('notif-panel-overlay').classList.add('visible');
            panelOpen = true;
            renderPanel();
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'notif-panel-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:200;
            background:rgba(1,7,18,0.5);
            backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
            display:flex;align-items:center;justify-content:center;
            padding:16px;
            opacity:0;transition:opacity 0.2s ease;
            pointer-events:none;
        `;

        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.style.cssText = `
            width:460px;max-width:calc(100vw - 32px);
            max-height:calc(100vh - 32px);
            background:rgba(8,12,24,0.55);
            backdrop-filter:blur(32px) saturate(160%);-webkit-backdrop-filter:blur(32px) saturate(160%);
            border:1px solid rgba(109,74,255,0.25);
            border-radius:24px;
            box-shadow:0 28px 60px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.03),0 0 50px rgba(109,74,255,0.1);
            display:flex;flex-direction:column;overflow:hidden;
            transform:scale(0.92) translateY(16px);
            transition:transform 0.25s cubic-bezier(0.34,1.3,0.64,1);
        `;

        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid rgba(109,74,255,0.12);background:rgba(109,74,255,0.04);flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#6d4aff,#ec4899);display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(109,74,255,0.4);flex-shrink:0;font-size:18px;"><svg width="25" height="25"><use href="#icon-notif"/></svg></div>
                    <div>
                        <div style="font-size:16px;font-weight:700;background:linear-gradient(135deg,#f8fafc,#c4b5fd);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">Уведомления</div>
                        <div id="notif-panel-subtitle" style="font-size:10px;color:#4a6080;margin-top:2px;">Загрузка...</div>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <button id="notif-mark-all" style="padding:6px 12px;margin-right:32px;border-radius:9px;border:1px solid rgba(109,74,255,0.25);background:rgba(109,74,255,0.08);color:#8ba3f0;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;">Прочитать всё</button>
                    <button class="widget-modal-close" id="notif-panel-close">
                      <svg width="30" height="30"><use href="#icon-close"/></svg>
                    </button>
                </div>
            </div>
            <div id="notif-panel-body" style="flex:1;overflow-y:auto;padding:10px 12px 14px;scrollbar-width:thin;scrollbar-color:rgba(109,74,255,0.3) transparent;"></div>
        `;

        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(() => requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            panel.style.transform = 'scale(1) translateY(0)';
        }));

        panelOpen = true;
        renderPanel();

        // Subtitle
        const sub = document.getElementById('notif-panel-subtitle');
        if (sub) sub.textContent = notifications.length + ' ' + (notifications.length === 1 ? 'уведомление' : notifications.length < 5 ? 'уведомления' : 'уведомлений');

        // Close
        const close = () => {
            overlay.style.opacity = '0';
            panel.style.transform = 'scale(0.95) translateY(8px)';
            overlay.style.pointerEvents = 'none';
            panelOpen = false;
            setTimeout(() => overlay.remove(), 220);
        };

        document.getElementById('notif-panel-close').addEventListener('click', close);
        document.getElementById('notif-mark-all').addEventListener('click', () => { markAllRead(); const sub = document.getElementById('notif-panel-subtitle'); if(sub) sub.textContent = notifications.length + ' уведомлений'; });
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
    }

    // Экспортируем
    window.addNotification = addNotification;
    window.openNotifPanel = openNotifPanel;

    // Перехватываем notifyChat
    window.notifyChat = function(type, opts = {}) {
        if (type === 'mention') {
            addNotification('mention', opts.title || 'Упоминание', opts.text || 'Вас упомянули в чате', opts);
        } else if (type === 'system') {
            addNotification('system', opts.title || 'Системное', opts.text || 'Новое системное сообщение', opts);
        } else if (type === 'message') {
            addNotification('message', opts.title || 'Новое сообщение', opts.text || 'Входящее сообщение', opts);
        }
    };

    // Патчим addChatMessage чтобы перехватывать упоминания
    // Дожидаемся DOMContentLoaded, потом оборачиваем
    const _patchChat = () => {
        // Перехватываем добавление сообщений через MutationObserver на chat-messages
        const chatMsgs = document.getElementById('chat-messages');
        if (!chatMsgs) return;

        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const textEl = node.querySelector?.('.chat-text');
                    const text = textEl?.textContent || '';
                    const usernameEl = node.querySelector?.('.chat-username');
                    const username = usernameEl?.textContent || 'Пользователь';

                    if (node.classList.contains('chat-system')) {
                        const msg = node.textContent?.trim() || 'Системное сообщение';
                        addNotification('system', 'Система', msg.slice(0, 80));
                    } else if (node.classList.contains('chat-other')) {
                        const msgId = node.dataset.msgId || '';
                        if (text.includes('@' + MOCK_USER.username) || text.toLowerCase().includes(MOCK_USER.display_name.toLowerCase())) {
                            addNotification('mention', `${username} упомянул вас`, text.slice(0, 80), { msgId });
                        } else {
                            addNotification('message', username, text.slice(0, 80), { msgId });
                        }
                    }
                });
            });
        });

        observer.observe(chatMsgs, { childList: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _patchChat);
    } else {
        setTimeout(_patchChat, 500);
    }


    // Обновляем виджет при открытии настроек карусели (DOM может ещё не быть готов)
    setTimeout(updateCarouselWidget, 1200);
})();


// ===== ПОВЕДЕНИЕ: ТОГЛ ЗАКРЫВАТЬ ПО КЛИКУ НА ФОНЕ + POPUP-УВЕДОМЛЕНИЯ =====
(function() {
    const SK = 'star_sky_settings';

    function loadSetting(key, def) {
        try { const s = JSON.parse(localStorage.getItem(SK) || '{}'); return key in s ? s[key] : def; }
        catch(e) { return def; }
    }
    function saveSetting(key, val) {
        try { const s = JSON.parse(localStorage.getItem(SK) || '{}'); s[key] = val; localStorage.setItem(SK, JSON.stringify(s)); }
        catch(e) {}
    }

    // Состояние
    window._backdropCloseEnabled = loadSetting('backdropClose', true);
    window._notifPopupEnabled = loadSetting('notifPopupEnabled', true);

    // Рендер тогла
    function renderToggle(trackId, knobId, enabled) {
        const track = document.getElementById(trackId);
        const knob = document.getElementById(knobId);
        if (!track || !knob) return;
        track.style.background = enabled ? '#6d4aff' : 'rgba(109,74,255,0.25)';
        knob.style.transform = enabled ? 'translateX(24px)' : 'translateX(2px)';
    }

    // Инициализация тоглов
    function initToggles() {
        renderToggle('backdrop-close-track', 'backdrop-close-knob', window._backdropCloseEnabled);
        renderToggle('popup-notif-track', 'popup-notif-knob', window._notifPopupEnabled);

        const backdropEl = document.getElementById('backdrop-close-toggle');
        if (backdropEl && !backdropEl._init) {
            backdropEl._init = true;
            backdropEl.addEventListener('click', () => {
                window._backdropCloseEnabled = !window._backdropCloseEnabled;
                saveSetting('backdropClose', window._backdropCloseEnabled);
                renderToggle('backdrop-close-track', 'backdrop-close-knob', window._backdropCloseEnabled);
            });
        }

        const popupEl = document.getElementById('popup-notif-toggle');
        if (popupEl && !popupEl._init) {
            popupEl._init = true;
            popupEl.addEventListener('click', () => {
                window._notifPopupEnabled = !window._notifPopupEnabled;
                saveSetting('notifPopupEnabled', window._notifPopupEnabled);
                renderToggle('popup-notif-track', 'popup-notif-knob', window._notifPopupEnabled);
                syncNotifMuteBtn();
            });
        }
    }

    // Синхронизация кнопки notif-mute с тоглом
    function syncNotifMuteBtn() {
        const btn = document.getElementById('notif-popup-mute-btn');
        if (!btn) return;
        const enabled = window._notifPopupEnabled;
        btn.classList.toggle('notif-muted', !enabled);
        btn.title = enabled ? 'Отключить всплывающие уведомления' : 'Включить всплывающие уведомления';
    }

    // Перехват backdrop-кликов для всех модалок
    document.addEventListener('click', function(e) {
        if (window._backdropCloseEnabled) return;
        const el = e.target;
        // Список оверлеев, которые закрываются по клику на фон
        const overlayIds = [
            'star-card-overlay', 'friends-modal-overlay', 'settings-modal-overlay',
            'image-modal-overlay', 'private-modal', 'latest-patchnote-overlay',
            'patchnotes-overlay', 'leaderboard-modal-overlay', 'tasks-modal-overlay',
            'profile-modal-overlay'
        ];
        const overlayClasses = ['panel-modal-overlay', 'widget-modal-overlay'];

        const isOverlay = overlayIds.includes(el.id) ||
            overlayClasses.some(c => el.classList.contains(c));

        if (isOverlay && e.target === el) {
            e.stopImmediatePropagation();
        }
    }, true);

    // MutationObserver - ждём появления тоглов в DOM (настройки открываются по клику)
    let _initDone = false;
    function tryInit() {
        if (_initDone) return;
        const t1 = document.getElementById('backdrop-close-toggle');
        const t2 = document.getElementById('popup-notif-toggle');
        if (t1 && t2) { _initDone = true; initToggles(); }
    }

    new MutationObserver(tryInit).observe(document.body, { childList: true, subtree: true });
    setTimeout(tryInit, 300);
    setTimeout(tryInit, 1000); // запасная попытка

    // Экспортируем для системы уведомлений
    window._isNotifPopupEnabled = () => window._notifPopupEnabled;
})();


// ===== КНОПКА POPUP-MUTE РЯДОМ С КНОПКОЙ ЗВУКА =====
(function() {
    function initMuteGroup() {
        const group = document.getElementById('mute-btn-group');
        const muteBtn = document.getElementById('quick-mute-btn');
        const notifBtn = document.getElementById('notif-popup-mute-btn');
        if (!group || !muteBtn || !notifBtn) return;

        // Hover на любую из двух кнопок — показываем вторую
        let hideTimer = null;

        function showExtra() {
            clearTimeout(hideTimer);
            group.classList.add('show-extra');
        }
        function scheduleHide() {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => group.classList.remove('show-extra'), 200);
        }

        muteBtn.addEventListener('mouseenter', showExtra);
        muteBtn.addEventListener('mouseleave', scheduleHide);
        notifBtn.addEventListener('mouseenter', showExtra);
        notifBtn.addEventListener('mouseleave', scheduleHide);

        // Клик на notif-popup-mute-btn
        notifBtn.addEventListener('click', () => {
            window._notifPopupEnabled = !window._notifPopupEnabled;
            try {
                const s = JSON.parse(localStorage.getItem('star_sky_settings') || '{}');
                s.notifPopupEnabled = window._notifPopupEnabled;
                localStorage.setItem('star_sky_settings', JSON.stringify(s));
            } catch(e) {}

            const enabled = window._notifPopupEnabled;
            notifBtn.classList.toggle('notif-muted', !enabled);
            notifBtn.title = enabled ? 'Отключить всплывающие уведомления' : 'Включить всплывающие уведомления';

            // Синхронизируем тогл в настройках
            const track = document.getElementById('popup-notif-track');
            const knob = document.getElementById('popup-notif-knob');
            if (track) track.style.background = enabled ? '#6d4aff' : 'rgba(109,74,255,0.25)';
            if (knob) knob.style.transform = enabled ? 'translateX(24px)' : 'translateX(2px)';

            if (typeof showToast === 'function') {
                showToast(enabled ? '🔔 Всплывающие уведомления включены' : '🔕 Всплывающие уведомления отключены');
            }
        });

        // Начальное состояние кнопки
        const enabled = window._notifPopupEnabled !== false;
        notifBtn.classList.toggle('notif-muted', !enabled);
        notifBtn.title = enabled ? 'Отключить всплывающие уведомления' : 'Включить всплывающие уведомления';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMuteGroup);
    } else {
        initMuteGroup();
    }
})();


// ===== ПОИСК ПО ЧАТУ =====
(function() {
    let searchMatches = [];
    let searchCurrentIdx = -1;
    let searchActive = false;

    // Сохраняем оригинальный innerHTML для каждой строки
    const originalHTML = new WeakMap();

    function getActiveContainer() {
        const priv = document.getElementById('chat-private-messages');
        if (priv && priv.style.display !== 'none' && priv.children.length > 0) return priv;
        return document.getElementById('chat-messages');
    }

    function clearHighlights() {
        searchMatches.forEach(el => {
            const orig = originalHTML.get(el);
            if (orig !== undefined) {
                el.innerHTML = orig;
            }
            el.classList.remove('chat-search-match', 'chat-search-current');
        });
        searchMatches = [];
        searchCurrentIdx = -1;
        updateCount();
    }

    function escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function runSearch(query) {
        clearHighlights();
        if (!query || query.length < 1) return;

        const container = getActiveContainer();
        if (!container) return;

        const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
        const lines = container.querySelectorAll('.chat-line');

        lines.forEach(line => {
            // Ищем только в .chat-text внутри строки
            const textEl = line.querySelector('.chat-text');
            if (!textEl) return;

            const plainText = textEl.textContent || '';
            if (!plainText.toLowerCase().includes(query.toLowerCase())) return;

            // Сохраняем оригинал всей строки
            if (!originalHTML.has(line)) {
                originalHTML.set(line, line.innerHTML);
            }

            // Подсвечиваем только в .chat-text через innerHTML замену
            const origTextHTML = textEl.innerHTML;
            // Заменяем только в текстовых нодах, не задевая теги
            const newHTML = origTextHTML.replace(regex,
                '<mark class="chat-search-highlight">$1</mark>');
            textEl.innerHTML = newHTML;

            line.classList.add('chat-search-match');
            searchMatches.push(line);
        });

        if (searchMatches.length > 0) {
            searchCurrentIdx = 0;
            applyCurrentHighlight();
        }
        updateCount();
    }

    function applyCurrentHighlight() {
        searchMatches.forEach((el, i) => {
            el.classList.toggle('chat-search-current', i === searchCurrentIdx);
        });
        const cur = searchMatches[searchCurrentIdx];
        if (cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function goToMatch(delta) {
        if (searchMatches.length === 0) return;
        searchCurrentIdx = (searchCurrentIdx + delta + searchMatches.length) % searchMatches.length;
        applyCurrentHighlight();
        updateCount();
    }

    function updateCount() {
        const el = document.getElementById('chat-search-count');
        if (!el) return;
        if (searchMatches.length === 0) {
            const input = document.getElementById('chat-search-input');
            el.textContent = (input && input.value.trim()) ? 'Не найдено' : '';
            el.style.color = '#ef4444';
        } else {
            el.textContent = `${searchCurrentIdx + 1} / ${searchMatches.length}`;
            el.style.color = '#a5b8f0';
        }
    }

    function openSearch() {
        const bar = document.getElementById('chat-search-bar');
        const btn = document.getElementById('chat-search-toggle-btn');
        searchActive = true;
        bar && bar.classList.add('visible');
        btn && btn.classList.add('active');
        setTimeout(() => document.getElementById('chat-search-input')?.focus(), 80);
    }

    function closeSearch() {
        const bar = document.getElementById('chat-search-bar');
        const btn = document.getElementById('chat-search-toggle-btn');
        const inp = document.getElementById('chat-search-input');
        const clr = document.getElementById('chat-search-clear');
        searchActive = false;
        bar && bar.classList.remove('visible');
        btn && btn.classList.remove('active');
        if (inp) inp.value = '';
        if (clr) clr.style.display = 'none';
        clearHighlights();
    }

    function init() {
        const toggleBtn = document.getElementById('chat-search-toggle-btn');
        const closeBtn = document.getElementById('chat-search-close');
        const input = document.getElementById('chat-search-input');
        const clearBtn = document.getElementById('chat-search-clear');
        const prevBtn = document.getElementById('chat-search-prev');
        const nextBtn = document.getElementById('chat-search-next');

        if (!toggleBtn || !input) return;

        toggleBtn.addEventListener('click', () => searchActive ? closeSearch() : openSearch());
        closeBtn?.addEventListener('click', closeSearch);
        prevBtn?.addEventListener('click', () => goToMatch(-1));
        nextBtn?.addEventListener('click', () => goToMatch(1));

        let timer;
        input.addEventListener('input', () => {
            const v = input.value;
            if (clearBtn) clearBtn.style.display = v ? 'block' : 'none';
            clearTimeout(timer);
            timer = setTimeout(() => runSearch(v.trim()), 150);
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                goToMatch(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
                closeSearch();
            }
        });

        clearBtn?.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            clearHighlights();
            input.focus();
        });


    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // MutationObserver для ожидания элементов вместо магической задержки
        if (document.getElementById('chat-search-toggle-btn')) {
            init();
        } else {
            const obs = new MutationObserver(() => {
                if (document.getElementById('chat-search-toggle-btn')) {
                    obs.disconnect();
                    init();
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }
    }
})();


// ===== СОЗВЕЗДИЯ - ПРИВАТНЫЕ ГРУППОВЫЕ ЧАТЫ =====
(function initConstellations() {
  // CSS
  const style = document.createElement('style');
  style.textContent = `
    .chat-tab-constellation { border:1px solid rgba(56,189,248,0.3)!important; color:#38bdf8!important; }
    .chat-tab-constellation:hover { background:rgba(56,189,248,0.1)!important; }
    .chat-tab-constellation.active { background:rgba(56,189,248,0.18)!important; border-color:rgba(56,189,248,0.6)!important; color:#bae6fd!important; }

    /* Панель созвездий (внутри chat-messages-container) */
    #con-panel { display:none;flex-direction:column;flex:1;min-height:0; }
    #con-panel.visible { display:flex; }

    /* Список групп */
    #con-groups-view { display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden; }
    #con-groups-header { display:flex;align-items:center;justify-content:space-between;padding:10px 12px 8px;border-bottom:1px solid rgba(56,189,248,0.12);flex-shrink:0; }
    #con-groups-title { font-size:12px;font-weight:700;color:#7dd3fc;display:flex;align-items:center;gap:7px; }
    #con-add-btn { padding:5px 11px;border-radius:8px;border:1px solid rgba(56,189,248,0.35);background:rgba(56,189,248,0.07);color:#38bdf8;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;transition:all 0.15s; }
    #con-add-btn:hover { background:rgba(56,189,248,0.16); }
    #con-list { flex:1;overflow-y:auto;padding:8px 10px;display:flex;flex-direction:column;gap:5px; }
    .c-item { display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;border:1px solid rgba(56,189,248,0.12);background:rgba(56,189,248,0.04);transition:all 0.15s;cursor:pointer; }
    .c-item:hover { background:rgba(56,189,248,0.09);border-color:rgba(56,189,248,0.28); }
    .c-item-icon { width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,rgba(14,165,233,0.3),rgba(124,58,237,0.2));border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0; }
    .c-item-info { flex:1;min-width:0; }
    .c-item-name { font-size:11px;font-weight:700;color:#c4cfe8; }
    .c-item-members { font-size:9px;color:#4a6080;margin-top:2px; }
    .c-del-btn { padding:5px 8px;border-radius:7px;border:1px solid rgba(239,68,68,0.18);background:rgba(239,68,68,0.05);color:#ef4444;font-size:11px;cursor:pointer;transition:all 0.15s;line-height:1;flex-shrink:0; }
    .c-del-btn:hover { background:rgba(239,68,68,0.2); }

    /* Форма создания */
    #con-create-view { display:none;flex-direction:column;flex:1;min-height:0; }
    #con-create-view.visible { display:flex; }
    #con-create-hdr { display:flex;align-items:center;gap:8px;padding:10px 12px 8px;border-bottom:1px solid rgba(56,189,248,0.12);flex-shrink:0; }
    #con-back-btn { padding:4px 9px;border-radius:7px;border:1px solid rgba(56,189,248,0.2);background:transparent;color:#4a7fa8;font-size:10px;cursor:pointer;font-family:inherit;transition:all 0.15s; }
    #con-back-btn:hover { background:rgba(56,189,248,0.08);color:#7dd3fc; }
    #con-create-body { flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:9px; }
    .c-input { background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.22);border-radius:10px;padding:9px 12px;color:#e2e8f5;font-family:'Unbounded',sans-serif;font-size:11px;outline:none;width:100%;box-sizing:border-box; }
    .c-input:focus { border-color:rgba(56,189,248,0.6); }
    .c-section-lbl { font-size:9px;color:#4a6080;font-weight:700;letter-spacing:0.06em;text-transform:uppercase; }
    #c-member-search { background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.18);border-radius:8px;padding:7px 10px;color:#e2e8f5;font-family:'Unbounded',sans-serif;font-size:10px;outline:none;width:100%;box-sizing:border-box; }
    #c-member-search:focus { border-color:rgba(56,189,248,0.45); }
    .c-member-grid { display:flex;flex-wrap:wrap;gap:5px;max-height:120px;overflow-y:auto; }
    .c-chip { display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;border:1px solid rgba(109,74,255,0.2);background:rgba(109,74,255,0.06);color:#8ba3f0;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.12s;user-select:none; }
    .c-chip:hover { border-color:rgba(109,74,255,0.4); }
    .c-chip.sel { background:rgba(56,189,248,0.18);border-color:rgba(56,189,248,0.5);color:#38bdf8; }
    .c-chip.hidden { display:none; }
    .c-submit { padding:10px;border-radius:11px;border:none;background:linear-gradient(135deg,#0ea5e9,#7c3aed);color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:filter 0.15s; }
    .c-submit:hover { filter:brightness(1.12); }

    /* Чат группы */
    #con-chat-view { display:none;flex-direction:column;flex:1;min-height:0; }
    #con-chat-view.visible { display:flex; }
    .con-chat-header { display:flex;align-items:center;gap:8px;padding:8px 10px 6px;border-bottom:1px solid rgba(56,189,248,0.12);flex-shrink:0; }
    .con-messages { flex:1;overflow-y:auto;padding:8px 6px 4px;display:flex;flex-direction:column;gap:4px;font-family:'Unbounded',sans-serif;scrollbar-width:thin;scrollbar-color:rgba(56,189,248,0.2) transparent; }
    .con-input-row { display:flex;align-items:flex-end;gap:6px;padding:10px 0 0 0;border-top:1px solid var(--tg-border);flex-shrink:0; }
    .con-input-wrap { flex:1;display:flex;align-items:center;gap:4px;background:rgba(56,189,248,0.05);border:1px solid rgba(56,189,248,0.2);border-radius:22px;padding:0 6px 0 12px;transition:border-color 0.2s; }
    .con-input-wrap:focus-within { border-color:rgba(56,189,248,0.5); }
    .con-input { flex:1;border:none;background:transparent;color:#e2e8f5;font-size:12px;padding:10px 0;outline:none;font-family:'Unbounded',sans-serif; }
    .con-send-btn { height:34px;padding:0 14px;border-radius:20px;border:none;background:linear-gradient(135deg,#0ea5e9,#7c3aed);color:#fff;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0; }

    /* Диалог подтверждения удаления */
    #con-confirm-overlay { position:fixed;inset:0;z-index:9999;background:rgba(1,7,18,0.7);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:none;align-items:center;justify-content:center; }
    #con-confirm-overlay.visible { display:flex; }
    #con-confirm-box { width:320px;max-width:calc(100vw - 32px);background:rgba(10,14,28,0.9);border:1px solid rgba(239,68,68,0.3);border-radius:18px;padding:24px 22px;box-shadow:0 24px 60px rgba(0,0,0,0.9);animation:cModalIn 0.18s cubic-bezier(0.34,1.56,0.64,1); }
    #con-confirm-title { font-size:14px;font-weight:700;color:#f8fafc;margin-bottom:8px; }
    #con-confirm-desc { font-size:11px;color:#6b84a8;line-height:1.6;margin-bottom:20px; }
    #con-confirm-btns { display:flex;gap:8px;justify-content:flex-end; }
    .con-confirm-cancel { padding:8px 16px;border-radius:9px;border:1px solid rgba(109,74,255,0.25);background:transparent;color:#8ba3f0;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s; }
    .con-confirm-cancel:hover { background:rgba(109,74,255,0.1); }
    .con-confirm-del { padding:8px 16px;border-radius:9px;border:none;background:rgba(239,68,68,0.18);color:#ef4444;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid rgba(239,68,68,0.3);transition:all 0.15s; }
    .con-confirm-del:hover { background:rgba(239,68,68,0.35); }
  `;
  document.head.appendChild(style);

  // Данные
  const SK = 'star_sky_constellations_v2';
  let groups = [];
  try { groups = JSON.parse(localStorage.getItem(SK) || '[]'); } catch(e) { groups = []; }
  function save() { try { localStorage.setItem(SK, JSON.stringify(groups)); } catch(e) {} }

  let activeGroupId = null;

  // Добавляем вкладку "Созвездия" в таббар
  function ensureConstellationTab() {
    if (document.getElementById('tab-constellation')) return;
    const searchBtn = document.getElementById('chat-search-toggle-btn');
    if (!searchBtn) return;
    const btn = document.createElement('button');
    btn.id = 'tab-constellation';
    btn.className = 'chat-tab chat-tab-constellation';
    btn.title = 'Созвездия — приватные группы';
    btn.innerHTML = `✦ Созвездия`;
    btn.addEventListener('click', openConstellationPanel);
    searchBtn.parentNode.insertBefore(btn, searchBtn);
  }

  // Создаём панель созвездий внутри чата
  function ensurePanel() {
    if (document.getElementById('con-panel')) return;
    const container = document.getElementById('chat-messages-container');
    if (!container) return;
    const panel = document.createElement('div');
    panel.id = 'con-panel';
    panel.innerHTML = `
      <!-- Список групп -->
      <div id="con-groups-view">
        <div id="con-groups-header">
          <div id="con-groups-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/></svg>
            Созвездия
          </div>
          <button id="con-add-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Создать
          </button>
        </div>
        <div id="con-list"></div>
      </div>
      <!-- Форма создания -->
      <div id="con-create-view">
        <div id="con-create-hdr">
          <button id="con-back-btn">← Назад</button>
          <div style="font-size:11px;font-weight:700;color:#7dd3fc;">Новое созвездие</div>
        </div>
        <div id="con-create-body">
          <input class="c-input" id="c-name-inp" placeholder="Название созвездия..." maxlength="40"/>
          <div class="c-section-lbl">Участники</div>
          <input id="c-member-search" placeholder="Поиск по имени..."/>
          <div class="c-member-grid" id="c-member-grid"></div>
          <button class="c-submit" id="c-submit">✦ Создать созвездие</button>
        </div>
      </div>
      <!-- Чат группы -->
      <div id="con-chat-view">
        <div class="con-chat-header" id="con-chat-hdr"></div>
        <div class="con-messages" id="con-chat-msgs"></div>
        <div class="con-input-row" id="con-chat-input-row" style="position:relative;">
          <div class="chat-input-wrapper" style="flex:1;min-width:0;display:flex;align-items:center;gap:2px;background:var(--tg-surface);border-radius:22px;padding:0 4px 0 12px;border:1px solid var(--tg-border);transition:all 0.2s ease;">
            <input class="con-input" id="con-chat-inp" placeholder="Напишите сообщение..." style="border:none;background:transparent;color:var(--tg-text);font-size:13px;padding:11px 0;outline:none;flex:1;min-width:0;font-family:inherit;"/>
            <button id="con-emoji-btn" title="Смайлики" style="width:30px;height:30px;border-radius:50%;border:none;background:transparent;color:var(--tg-text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;flex-shrink:0;"><svg width="20" height="20"><use href="#icon-smile"/></svg></button>
            <button id="con-attach-btn" title="Прикрепить файл" style="width:30px;height:30px;border-radius:50%;border:none;background:transparent;color:var(--tg-text-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s ease;flex-shrink:0;"><svg width="20" height="20"><use href="#icon-attach"/></svg></button>
          </div>
          <input type="file" id="con-file-input" accept="image/*,video/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.html,.js,.json,.csv" style="display:none;">
          <button class="con-send-btn" id="con-chat-send" style="height:38px;padding:0 16px;border-radius:20px;border:none;background:var(--tg-accent);color:white;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;white-space:nowrap;flex-shrink:0;font-family:inherit;"><svg width="16" height="16"><use href="#icon-send"/></svg> Отправить</button>
        </div>
      </div>
    `;
    container.appendChild(panel);

    // Обработчики
    document.getElementById('con-add-btn').addEventListener('click', showCreateView);
    document.getElementById('con-back-btn').addEventListener('click', showGroupsList);
    document.getElementById('c-submit').addEventListener('click', createGroup);
    document.getElementById('c-member-search').addEventListener('input', filterChips);

    // Отправка сообщения
    const inp = document.getElementById('con-chat-inp');
    document.getElementById('con-chat-send').addEventListener('click', doSend);
    inp.addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();} });

    // Прикрепление файла в созвездии
    const conAttachBtn = document.getElementById('con-attach-btn');
    const conFileInput = document.getElementById('con-file-input');
    if (conAttachBtn && conFileInput) {
      conAttachBtn.addEventListener('click', e => { e.stopPropagation(); conFileInput.click(); });
      conFileInput.addEventListener('change', () => {
        const file = conFileInput.files && conFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          conFileInput.value = '';
          doSendAttachment(file, ev.target.result);
        };
        reader.readAsDataURL(file);
        conAttachBtn.style.color = 'var(--tg-accent)';
        setTimeout(() => { conAttachBtn.style.color = ''; }, 800);
      });
    }

    // Эмодзи-пикер в созвездии
    const conEmojiBtn = document.getElementById('con-emoji-btn');
    if (conEmojiBtn) {
      conEmojiBtn.addEventListener('click', e => {
        e.stopPropagation();
        const picker = document.getElementById('emoji-picker');
        if (!picker) return;
        // Закрываем, если уже открыт для созвездий
        if (typeof emojiPickerOpen !== 'undefined' && emojiPickerOpen && picker.dataset.conTarget === '1') {
          if (typeof closeEmojiPicker === 'function') closeEmojiPicker();
          return;
        }
        if (typeof emojiPickerOpen !== 'undefined' && emojiPickerOpen && typeof closeEmojiPicker === 'function') closeEmojiPicker();
        // Переносим пикер в body, чтобы не скрывался вместе со скрытым chat-input-row
        if (!picker._conOrigParent) picker._conOrigParent = picker.parentElement;
        document.body.appendChild(picker);
        picker.dataset.conTarget = '1';
        delete picker.dataset.favTarget;
        delete picker.dataset.mobTarget;
        if (typeof openEmojiPicker === 'function') openEmojiPicker();
        // Позиционируем над кнопкой после отрисовки
        requestAnimationFrame(() => {
          const btnRect = conEmojiBtn.getBoundingClientRect();
          const pickerW = picker.offsetWidth || 300;
          const pickerH = picker.offsetHeight || 340;
          let left = btnRect.right - pickerW;
          let top = btnRect.top - pickerH - 8;
          if (left < 8) left = 8;
          if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
          if (top < 8) top = btnRect.bottom + 8;
          picker.style.position = 'fixed';
          picker.style.left = left + 'px';
          picker.style.top = top + 'px';
          picker.style.zIndex = '400';
        });
      });
    }

    renderList();
  }

  // Диалог подтверждения удаления
  function ensureConfirm() {
    if (document.getElementById('con-confirm-overlay')) return;
    const el = document.createElement('div');
    el.id = 'con-confirm-overlay';
    el.innerHTML = `
      <div id="con-confirm-box">
        <div id="con-confirm-title">Удалить созвездие?</div>
        <div id="con-confirm-desc"></div>
        <div id="con-confirm-btns">
          <button class="con-confirm-cancel" id="con-confirm-cancel">Отмена</button>
          <button class="con-confirm-del" id="con-confirm-del">Удалить</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.getElementById('con-confirm-cancel').addEventListener('click', hideConfirm);
    el.addEventListener('click', e => { if (e.target === el) hideConfirm(); });
  }

  let _pendingDeleteId = null;
  function showConfirm(gId) {
    ensureConfirm();
    const g = groups.find(x => x.id === gId);
    if (!g) return;
    _pendingDeleteId = gId;
    document.getElementById('con-confirm-desc').textContent = `Созвездие «${g.name}» и вся переписка в нём будут удалены навсегда.`;
    document.getElementById('con-confirm-overlay').classList.add('visible');
    document.getElementById('con-confirm-del').onclick = () => {
      const idToDelete = _pendingDeleteId;
      hideConfirm();
      deleteGroup(idToDelete);
    };
  }
  function hideConfirm() {
    document.getElementById('con-confirm-overlay')?.classList.remove('visible');
    _pendingDeleteId = null;
  }

  function deleteGroup(gId) {
    groups = groups.filter(x => x.id !== gId);
    save();
    if (activeGroupId === gId) {
      activeGroupId = null;
      showGroupsList();
    }
    renderList();
  }

  // Переключение видов
  function showGroupsList() {
    document.getElementById('con-groups-view').style.display = 'flex';
    document.getElementById('con-create-view').classList.remove('visible');
    document.getElementById('con-chat-view').classList.remove('visible');
    renderList();
  }

  function showCreateView() {
    document.getElementById('con-groups-view').style.display = 'none';
    document.getElementById('con-create-view').classList.add('visible');
    document.getElementById('con-chat-view').classList.remove('visible');
    buildMemberChips();
    document.getElementById('c-name-inp').focus();
  }

  function showChatView(gId) {
    const g = groups.find(x => x.id === gId);
    if (!g) return;
    activeGroupId = gId;
    document.getElementById('con-groups-view').style.display = 'none';
    document.getElementById('con-create-view').classList.remove('visible');
    document.getElementById('con-chat-view').classList.add('visible');

    // Заголовок чата
    const hdr = document.getElementById('con-chat-hdr');
    hdr.innerHTML = `
      <button style="padding:4px 9px;border-radius:7px;border:1px solid rgba(56,189,248,0.2);background:transparent;color:#4a7fa8;font-size:10px;cursor:pointer;font-family:inherit;transition:all 0.15s;" id="con-back-from-chat">← Назад</button>
      <div style="width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,rgba(14,165,233,0.3),rgba(124,58,237,0.2));border:1px solid rgba(56,189,248,0.25);display:flex;align-items:center;justify-content:center;font-size:12px;">✦</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:#bae6fd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
        <div style="font-size:9px;color:#4a6080;">${g.members.length+1} участников</div>
      </div>`;
    document.getElementById('con-back-from-chat').addEventListener('click', showGroupsList);

    // Сообщения
    const msgsCont = document.getElementById('con-chat-msgs');
    msgsCont.innerHTML = '';
    (g.messages || []).forEach(m => appendGroupMsg(msgsCont, m));
    if (!(g.messages || []).length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;padding:28px 16px;color:#3d5473;font-size:11px;line-height:1.8;';
      empty.innerHTML = '<div style="font-size:24px;opacity:0.3;margin-bottom:6px;">✦</div>Начните общение в созвездии!';
      msgsCont.appendChild(empty);
    }
    document.getElementById('con-chat-inp').placeholder = `Сообщение в ${g.name}…`;
    document.getElementById('con-chat-inp').value = '';
    setTimeout(() => { msgsCont.scrollTop = msgsCont.scrollHeight; }, 50);
  }

  function _makeMsgId() {
    return String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function doSend() {
    const g = groups.find(x => x.id === activeGroupId);
    if (!g) return;
    const inp = document.getElementById('con-chat-inp');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    const now = new Date();
    const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const name = MOCK_USER.display_name || (typeof appSettings!=='undefined'&&appSettings.displayName) || 'Пользователь';
    const m = { id: _makeMsgId(), author: name, text, time: t, isMe: true, ts: Date.now() };
    if (!g.messages) g.messages = [];
    g.messages.push(m);
    save();
    const msgsCont = document.getElementById('con-chat-msgs');
    const empty = msgsCont.querySelector('[style*="text-align:center"]');
    if (empty) empty.remove();
    appendGroupMsg(msgsCont, m);
    msgsCont.scrollTop = msgsCont.scrollHeight;
    // Авто-ответ
    if (g.members.length && Math.random() > 0.45) {
      const un = g.members[Math.floor(Math.random()*g.members.length)];
      const user = (typeof MOCK_USERS!=='undefined'?MOCK_USERS:[]).find(x=>x.username===un);
      const dname = user ? user.display_name : un;
      const replies = ['Понял! 👍','Интересно ✨','Согласен!','Хорошая идея 🌟','Ок!'];
      setTimeout(() => {
        const t2 = new Date(); const ts = t2.getHours().toString().padStart(2,'0')+':'+t2.getMinutes().toString().padStart(2,'0');
        const reply = { id: _makeMsgId(), author: dname, text: replies[Math.floor(Math.random()*replies.length)], time: ts, isMe: false, ts: Date.now() };
        g.messages.push(reply); save();
        if (activeGroupId === g.id) {
          appendGroupMsg(msgsCont, reply);
          msgsCont.scrollTop = msgsCont.scrollHeight;
        }
      }, 1200 + Math.random()*1500);
    }
  }

  // Отправка файла/изображения в созвездие
  function doSendAttachment(file, dataUrl) {
    const g = groups.find(x => x.id === activeGroupId);
    if (!g) return;
    const now = new Date();
    const t = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    const name = MOCK_USER.display_name || (typeof appSettings!=='undefined'&&appSettings.displayName) || 'Пользователь';
    const isImage = file.type && file.type.startsWith('image/');
    let text = '';
    if (isImage) {
      text = `<img src="${dataUrl}" style="max-width:260px;max-height:220px;border-radius:12px;display:block;margin-top:4px;" alt="${file.name}">`;
    } else {
      const sizeStr = file.size < 1024 ? file.size + ' Б'
        : file.size < 1048576 ? (file.size/1024).toFixed(1) + ' КБ'
        : (file.size/1048576).toFixed(1) + ' МБ';
      text = `<a href="${dataUrl}" download="${file.name}" style="display:flex;align-items:center;gap:10px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.25);border-radius:12px;padding:10px 14px;text-decoration:none;color:inherit;min-width:200px;max-width:260px;cursor:pointer;"><div style="width:36px;height:36px;border-radius:8px;background:rgba(56,189,248,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;color:#e2e8f5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${file.name}</div><div style="font-size:10px;color:#38bdf8;margin-top:3px;">Нажмите, чтобы скачать · ${sizeStr}</div></div></a>`;
    }
    const m = { id: _makeMsgId(), author: name, text, time: t, isMe: true, ts: Date.now() };
    if (!g.messages) g.messages = [];
    g.messages.push(m);
    save();
    const msgsCont = document.getElementById('con-chat-msgs');
    const empty = msgsCont && msgsCont.querySelector('[style*="text-align:center"]');
    if (empty) empty.remove();
    if (msgsCont) {
      appendGroupMsg(msgsCont, m);
      msgsCont.scrollTop = msgsCont.scrollHeight;
    }
  }

  // Открытие панели созвездий (вместо модального окна)
  function openConstellationPanel() {
    ensurePanel();
    // Активируем вкладку
    document.querySelectorAll('#chat-tabs .chat-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-constellation')?.classList.add('active');
    // Скрываем все стандартные панели
    const hideIds = ['chat-messages','chat-private-pane','chat-favorites-pane','chat-private-messages','active-users-title','active-users'];
    hideIds.forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const mainInput = document.getElementById('chat-input-row');
    if (mainInput) mainInput.style.display = 'none';
    const replyInd = document.getElementById('reply-indicator');
    if (replyInd) replyInd.classList.remove('active');
    // Показываем панель
    document.getElementById('con-panel').classList.add('visible');
    if (activeGroupId) {
      showChatView(activeGroupId);
    } else {
      showGroupsList();
    }
  }

  function buildMemberChips() {
    const grid = document.getElementById('c-member-grid');
    const search = document.getElementById('c-member-search');
    if (!grid) return;
    if (search) search.value = '';
    grid.innerHTML = '';
    const users = (typeof MOCK_USERS !== 'undefined' ? MOCK_USERS : []).filter(u => u.username !== MOCK_USER.username);
    users.forEach(u => {
      const chip = document.createElement('div');
      chip.className = 'c-chip';
      chip.dataset.un = u.username;
      chip.dataset.name = u.display_name.toLowerCase();
      chip.innerHTML = `<div style="width:12px;height:12px;border-radius:50%;background:${u.star_color};box-shadow:0 0 5px ${u.star_color}88;flex-shrink:0;"></div>${u.display_name}`;
      chip.addEventListener('click', () => chip.classList.toggle('sel'));
      grid.appendChild(chip);
    });
  }

  function filterChips() {
    const q = (document.getElementById('c-member-search')?.value || '').toLowerCase();
    document.querySelectorAll('#c-member-grid .c-chip').forEach(chip => {
      chip.classList.toggle('hidden', q.length > 0 && !chip.dataset.name.includes(q));
    });
  }

  function createGroup() {
    const nameInp = document.getElementById('c-name-inp');
    const name = nameInp ? nameInp.value.trim() : '';
    if (!name) { if (nameInp) { nameInp.style.borderColor='rgba(239,68,68,0.6)'; setTimeout(()=>nameInp.style.borderColor='',1200); nameInp.focus(); } return; }
    const members = Array.from(document.querySelectorAll('#c-member-grid .c-chip.sel')).map(c => c.dataset.un);
    const g = { id: 'g_' + Date.now(), name, members, messages: [], createdAt: Date.now() };
    groups.push(g);
    save();
    if (nameInp) nameInp.value = '';
    document.querySelectorAll('#c-member-grid .c-chip.sel').forEach(c => c.classList.remove('sel'));
    showChatView(g.id);
  }

  function renderList() {
    const list = document.getElementById('con-list');
    if (!list) return;
    list.innerHTML = '';
    if (!groups.length) {
      list.innerHTML = '<div style="text-align:center;padding:32px 16px;color:#3d5473;font-size:11px;line-height:1.9;"><div style="font-size:28px;opacity:0.35;margin-bottom:10px;">✦</div>Созвездий пока нет.<br>Создайте первое!</div>';
      return;
    }
    groups.forEach(g => {
      const memberNames = g.members.map(un => {
        const u = (typeof MOCK_USERS!=='undefined'?MOCK_USERS:[]).find(x=>x.username===un);
        return u ? u.display_name : un;
      }).join(', ') || 'Только вы';
      const row = document.createElement('div');
      row.className = 'c-item';
      row.innerHTML = `
        <div class="c-item-icon">✦</div>
        <div class="c-item-info">
          <div class="c-item-name">${g.name}</div>
          <div class="c-item-members">${g.members.length+1} участн. · ${memberNames}</div>
        </div>
        <button class="c-del-btn" title="Удалить созвездие">✕</button>`;
      row.addEventListener('click', e => {
        if (!e.target.classList.contains('c-del-btn')) showChatView(g.id);
      });
      row.querySelector('.c-del-btn').addEventListener('click', e => {
        e.stopPropagation();
        showConfirm(g.id);
      });
      list.appendChild(row);
    });
  }

  function appendGroupMsg(container, m) {
    const div = document.createElement('div');
    div.className = 'chat-line ' + (m.isMe ? 'chat-me' : 'chat-other');
    // Используем стабильный id сообщения, чтобы реакции переживали перезагрузку страницы
    const mid = m.id || (typeof _nextMsgId==='function' ? _nextMsgId() : Date.now());
    div.dataset.msgId = mid;
    div.dataset.reactionKey = 'con:' + (activeGroupId || '') + ':' + mid;
    div.innerHTML = `<div class="chat-username">${m.author}</div><div class="chat-text">${m.text}</div><div class="chat-time">${m.time}</div>`;
    // Контекстное меню
    div.addEventListener('contextmenu', e => { if (typeof showContextMenu === 'function') showContextMenu(e, div); });
    div.addEventListener('long-press', e => { if (typeof showContextMenu === 'function') showContextMenu(e, div); });
    container.appendChild(div);
    // Восстанавливаем сохранённую реакцию
    if (typeof applyStoredReactions === 'function') applyStoredReactions(div);
  }

  // Привязываем долгое нажатие для сообщений созвездий (мобильные)
  (function() {
    let _conLongPressTimer = null;
    let _conLongPressTarget = null;
    document.addEventListener('touchstart', e => {
      const line = e.target.closest('#con-chat-msgs .chat-line');
      if (!line) return;
      _conLongPressTarget = line;
      _conLongPressTimer = setTimeout(() => {
        if (_conLongPressTarget) {
          const touch = e.touches[0];
          const fakeEvent = { preventDefault(){}, stopPropagation(){}, clientX: touch.clientX, clientY: touch.clientY, target: _conLongPressTarget };
          if (typeof showContextMenu === 'function') showContextMenu(fakeEvent, _conLongPressTarget);
        }
      }, 500);
    }, { passive: true });
    document.addEventListener('touchend', () => { clearTimeout(_conLongPressTimer); _conLongPressTarget = null; }, { passive: true });
    document.addEventListener('touchmove', () => { clearTimeout(_conLongPressTimer); _conLongPressTarget = null; }, { passive: true });
  })();

  // Патч switchChatTab - скрываем панель созвездий при переключении
  const _origSwitch = window.switchChatTab;
  window.switchChatTab = function(tab) {
    const panel = document.getElementById('con-panel');
    if (panel) panel.classList.remove('visible');
    document.getElementById('tab-constellation')?.classList.remove('active');
    // Восстанавливаем элементы, которые созвездие скрыло напрямую (inline style),
    // чтобы _origSwitch мог нормально ими управлять
    const restoreIds = ['chat-messages', 'chat-private-pane', 'chat-favorites-pane',
                        'active-users-title', 'active-users'];
    restoreIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = '';
    });
    if (_origSwitch) _origSwitch(tab);
  };

  // Инициализация
  function init() {
    ensureConstellationTab();
    ensureConfirm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }
})();


// ===== НАСТРОЙКИ - СВОРАЧИВАЕМЫЕ СЕКЦИИ =====
(function() {
    function initSettingsNav() {
        // Сворачиваемые секции
        document.querySelectorAll('.settings-nav-section-label[data-section]').forEach(label => {
            const groupId = label.dataset.section;
            const group = document.getElementById(groupId);
            if (!group) return;

            label.addEventListener('click', () => {
                const isCollapsed = label.classList.contains('collapsed');
                label.classList.toggle('collapsed', !isCollapsed);
                group.classList.toggle('collapsed', !isCollapsed);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettingsNav);
    } else {
        initSettingsNav();
    }

    // Переинициализируем при открытии настроек
    const settingsOverlay = document.getElementById('settings-modal-overlay');
    if (settingsOverlay) {
        new MutationObserver(() => {
            if (settingsOverlay.classList.contains('visible')) {
                setTimeout(() => {
                    const nameEl = document.getElementById('settings-nav-user-name');
                    const avatarEl = document.getElementById('settings-nav-user-avatar');
                    if (nameEl) {
                        const dn = document.getElementById('profile-display-name-label')?.textContent
                            || document.getElementById('user-label')?.textContent || MOCK_USER.display_name || 'Пользователь';
                        nameEl.textContent = dn;
                        if (avatarEl) avatarEl.textContent = dn.charAt(0).toUpperCase();
                    }
                }, 60);
            }
        }).observe(settingsOverlay, { attributes: true, attributeFilter: ['class'] });
    }
})();


// ===== ПОДТВЕРЖДЕНИЕ ВЫХОДА (исправленная версия) =====
(function() {
    // Создаём модальное окно, если его нет
    let logoutOverlay = document.getElementById('logout-confirm-overlay');
    
    if (!logoutOverlay) {
        // Создаём HTML модального окна
        const modalHTML = `
            <div id="logout-confirm-overlay" class="logout-confirm-overlay">
                <div class="logout-confirm-modal">
                    <div class="logout-confirm-header">
                        <div class="logout-confirm-icon">🚪</div>
                        <div>
                            <div class="logout-confirm-title">Выход из аккаунта</div>
                            <div class="logout-confirm-subtitle">Вы уверены, что хотите выйти?</div>
                        </div>
                    </div>
                    <div class="logout-confirm-body">
                        <div class="logout-confirm-text">
                            Все несохранённые данные будут потеряны.
                        </div>
                        <div class="logout-confirm-warning">
                            ⚠️ После выхода потребуется повторная авторизация через Telegram.
                        </div>
                    </div>
                    <div class="logout-confirm-buttons">
                        <button class="logout-confirm-cancel" id="logout-confirm-cancel">Отмена</button>
                        <button class="logout-confirm-logout" id="logout-confirm-logout">Выйти</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        logoutOverlay = document.getElementById('logout-confirm-overlay');
    }
    
    const logoutCancel = document.getElementById('logout-confirm-cancel');
    const logoutConfirm = document.getElementById('logout-confirm-logout');
    
    // Функция открытия модального окна
    function showLogoutConfirm(e) {
        if (e) e.preventDefault();
        if (e) e.stopPropagation();
        if (logoutOverlay) {
            logoutOverlay.classList.add('visible');
            document.body.style.overflow = 'hidden';
        }
    }
    
    // Функция закрытия модального окна
    function hideLogoutConfirm() {
        if (logoutOverlay) {
            logoutOverlay.classList.remove('visible');
            document.body.style.overflow = '';
        }
    }
    
    // Функция выхода
    function performLogout() {
        hideLogoutConfirm();
        // Небольшая задержка для анимации закрытия
        setTimeout(() => {
            localStorage.removeItem('star_sky_current_user');
            window.location.href = '/auth';
        }, 50);
    }
    
    // ПЕРЕОПРЕДЕЛЯЕМ обработчик для logout-btn (удаляем старые)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        // Удаляем все существующие обработчики (через клонирование)
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        // Добавляем новый обработчик
        newLogoutBtn.addEventListener('click', showLogoutConfirm);
    }
    
    // ПЕРЕОПРЕДЕЛЯЕМ обработчик для logout-profile-btn
    const logoutProfileBtn = document.getElementById('logout-profile-btn');
    if (logoutProfileBtn) {
        const newProfileBtn = logoutProfileBtn.cloneNode(true);
        logoutProfileBtn.parentNode.replaceChild(newProfileBtn, logoutProfileBtn);
        newProfileBtn.addEventListener('click', showLogoutConfirm);
    }
    
    // Закрытие по кнопке "Отмена"
    if (logoutCancel) {
        logoutCancel.addEventListener('click', hideLogoutConfirm);
    }
    
    // Подтверждение выхода
    if (logoutConfirm) {
        logoutConfirm.addEventListener('click', performLogout);
    }
    
    // Закрытие по клику на фон
    if (logoutOverlay) {
        logoutOverlay.addEventListener('click', (e) => {
            if (e.target === logoutOverlay) {
                hideLogoutConfirm();
            }
        });
    }
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && logoutOverlay && logoutOverlay.classList.contains('visible')) {
            hideLogoutConfirm();
        }
    });
})();


// ===== МОДАЛКА ИЗОБРАЖЕНИЯ: открытие картинки по клику в чате =====
(function() {
  const overlay = document.getElementById('image-modal-overlay');
  const modalImg = document.getElementById('image-modal-img');
  const closeBtn = document.getElementById('close-image-modal');
  if (!overlay || !modalImg) return;

  function openImageModal(src) {
    modalImg.src = src;
    overlay.classList.add('visible');
  }

  function closeImageModal() {
    overlay.classList.remove('visible');
    modalImg.src = '';
  }

  // Делегированный обработчик клика на всех контейнерах сообщений
  const chatContainers = [
    'chat-messages', 'chat-private-messages', 'chat-favorites-messages',
    'mob-chat-messages', 'mob-private-messages'
  ];
  chatContainers.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
      const img = e.target.closest('.chat-text img');
      if (img && img.src) {
        e.stopPropagation();
        openImageModal(img.src);
      }
    });
  });

  // Закрытие по кнопке
  if (closeBtn) closeBtn.addEventListener('click', closeImageModal);

  // Закрытие по клику на оверлей (вне картинки)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeImageModal();
  });

  // Закрытие по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('visible')) closeImageModal();
  });
})();
// ===== ПКМ по виджетам -> настройки Верхней панели (секция «Виджеты») =====
// + Модалка настроек виджета времени (часовой пояс другого города + размер шрифта)
(function widgetContextAndDateTimeSettings() {
    // ------- Утилиты -------
    const LS_KEY = 'star_sky_datetime_settings';
    const CITY_PRESETS = [
        // ---- Россия ----
        { id: 'Europe/Kaliningrad',  name: 'Калининград',              tz: 'Europe/Kaliningrad',  region: 'Россия' },
        { id: 'Europe/Moscow',       name: 'Москва',                   tz: 'Europe/Moscow',       region: 'Россия' },
        { id: 'Europe/Saratov',      name: 'Санкт-Петербург',          tz: 'Europe/Moscow',       region: 'Россия' },
        { id: 'Europe/Samara',       name: 'Самара',                   tz: 'Europe/Samara',       region: 'Россия' },
        { id: 'Asia/Yekaterinburg',  name: 'Екатеринбург',             tz: 'Asia/Yekaterinburg',  region: 'Россия' },
        { id: 'Asia/Omsk',           name: 'Омск',                     tz: 'Asia/Omsk',           region: 'Россия' },
        { id: 'Asia/Novosibirsk',    name: 'Новосибирск',              tz: 'Asia/Novosibirsk',    region: 'Россия' },
        { id: 'Asia/Krasnoyarsk',    name: 'Красноярск',               tz: 'Asia/Krasnoyarsk',    region: 'Россия' },
        { id: 'Asia/Irkutsk',        name: 'Иркутск',                  tz: 'Asia/Irkutsk',        region: 'Россия' },
        { id: 'Asia/Yakutsk',        name: 'Якутск',                   tz: 'Asia/Yakutsk',        region: 'Россия' },
        { id: 'Asia/Vladivostok',    name: 'Владивосток',              tz: 'Asia/Vladivostok',    region: 'Россия' },
        { id: 'Asia/Magadan',        name: 'Магадан',                  tz: 'Asia/Magadan',        region: 'Россия' },
        { id: 'Asia/Kamchatka',      name: 'Петропавловск-Камчатский', tz: 'Asia/Kamchatka',      region: 'Россия' },

        // ---- СНГ ----
        { id: 'Europe/Minsk',        name: 'Минск',           tz: 'Europe/Minsk',     region: 'СНГ' },
        { id: 'Europe/Kiev',         name: 'Киев',            tz: 'Europe/Kyiv',      region: 'СНГ' },
        { id: 'Europe/Chisinau',     name: 'Кишинёв',         tz: 'Europe/Chisinau',  region: 'СНГ' },
        { id: 'Asia/Tbilisi',        name: 'Тбилиси',         tz: 'Asia/Tbilisi',     region: 'СНГ' },
        { id: 'Asia/Yerevan',        name: 'Ереван',          tz: 'Asia/Yerevan',     region: 'СНГ' },
        { id: 'Asia/Baku',           name: 'Баку',            tz: 'Asia/Baku',        region: 'СНГ' },
        { id: 'Asia/Almaty',         name: 'Алматы',          tz: 'Asia/Almaty',      region: 'СНГ' },
        { id: 'Asia/Tashkent',       name: 'Ташкент',         tz: 'Asia/Tashkent',    region: 'СНГ' },
        { id: 'Asia/Bishkek',        name: 'Бишкек',          tz: 'Asia/Bishkek',     region: 'СНГ' },
        { id: 'Asia/Dushanbe',       name: 'Душанбе',         tz: 'Asia/Dushanbe',    region: 'СНГ' },
        { id: 'Asia/Ashgabat',       name: 'Ашхабад',         tz: 'Asia/Ashgabat',    region: 'СНГ' },

        // ---- Европа ----
        { id: 'Europe/Lisbon',       name: 'Лиссабон',        tz: 'Europe/Lisbon',     region: 'Европа' },
        { id: 'Europe/Dublin',       name: 'Дублин',          tz: 'Europe/Dublin',     region: 'Европа' },
        { id: 'Europe/London',       name: 'Лондон',          tz: 'Europe/London',     region: 'Европа' },
        { id: 'Europe/Madrid',       name: 'Мадрид',          tz: 'Europe/Madrid',     region: 'Европа' },
        { id: 'Europe/Paris',        name: 'Париж',           tz: 'Europe/Paris',      region: 'Европа' },
        { id: 'Europe/Amsterdam',    name: 'Амстердам',       tz: 'Europe/Amsterdam',  region: 'Европа' },
        { id: 'Europe/Berlin',       name: 'Берлин',          tz: 'Europe/Berlin',     region: 'Европа' },
        { id: 'Europe/Rome',         name: 'Рим',             tz: 'Europe/Rome',       region: 'Европа' },
        { id: 'Europe/Vienna',       name: 'Вена',            tz: 'Europe/Vienna',     region: 'Европа' },
        { id: 'Europe/Prague',       name: 'Прага',           tz: 'Europe/Prague',     region: 'Европа' },
        { id: 'Europe/Warsaw',       name: 'Варшава',         tz: 'Europe/Warsaw',     region: 'Европа' },
        { id: 'Europe/Stockholm',    name: 'Стокгольм',       tz: 'Europe/Stockholm',  region: 'Европа' },
        { id: 'Europe/Helsinki',     name: 'Хельсинки',       tz: 'Europe/Helsinki',   region: 'Европа' },
        { id: 'Europe/Athens',       name: 'Афины',           tz: 'Europe/Athens',     region: 'Европа' },
        { id: 'Europe/Istanbul',     name: 'Стамбул',         tz: 'Europe/Istanbul',   region: 'Европа' },

        // ---- Азия ----
        { id: 'Asia/Dubai',          name: 'Дубай',           tz: 'Asia/Dubai',          region: 'Азия' },
        { id: 'Asia/Tehran',         name: 'Тегеран',         tz: 'Asia/Tehran',         region: 'Азия' },
        { id: 'Asia/Karachi',        name: 'Карачи',          tz: 'Asia/Karachi',        region: 'Азия' },
        { id: 'Asia/Kolkata',        name: 'Дели',            tz: 'Asia/Kolkata',        region: 'Азия' },
        { id: 'Asia/Dhaka',          name: 'Дакка',           tz: 'Asia/Dhaka',          region: 'Азия' },
        { id: 'Asia/Bangkok',        name: 'Бангкок',         tz: 'Asia/Bangkok',        region: 'Азия' },
        { id: 'Asia/Jakarta',        name: 'Джакарта',        tz: 'Asia/Jakarta',        region: 'Азия' },
        { id: 'Asia/Kuala_Lumpur',   name: 'Куала-Лумпур',    tz: 'Asia/Kuala_Lumpur',   region: 'Азия' },
        { id: 'Asia/Singapore',      name: 'Сингапур',        tz: 'Asia/Singapore',      region: 'Азия' },
        { id: 'Asia/Hong_Kong',      name: 'Гонконг',         tz: 'Asia/Hong_Kong',      region: 'Азия' },
        { id: 'Asia/Shanghai',       name: 'Пекин',           tz: 'Asia/Shanghai',       region: 'Азия' },
        { id: 'Asia/Seoul',          name: 'Сеул',            tz: 'Asia/Seoul',          region: 'Азия' },
        { id: 'Asia/Tokyo',          name: 'Токио',           tz: 'Asia/Tokyo',          region: 'Азия' },

        // ---- Африка и Ближний Восток ----
        { id: 'Africa/Cairo',        name: 'Каир',            tz: 'Africa/Cairo',        region: 'Африка' },
        { id: 'Africa/Lagos',        name: 'Лагос',           tz: 'Africa/Lagos',        region: 'Африка' },
        { id: 'Africa/Johannesburg', name: 'Йоханнесбург',    tz: 'Africa/Johannesburg', region: 'Африка' },

        // ---- Северная Америка ----
        { id: 'America/New_York',    name: 'Нью-Йорк',        tz: 'America/New_York',    region: 'Сев. Америка' },
        { id: 'America/Toronto',     name: 'Торонто',         tz: 'America/Toronto',     region: 'Сев. Америка' },
        { id: 'America/Chicago',     name: 'Чикаго',          tz: 'America/Chicago',     region: 'Сев. Америка' },
        { id: 'America/Mexico_City', name: 'Мехико',          tz: 'America/Mexico_City', region: 'Сев. Америка' },
        { id: 'America/Denver',      name: 'Денвер',          tz: 'America/Denver',      region: 'Сев. Америка' },
        { id: 'America/Los_Angeles', name: 'Лос-Анджелес',    tz: 'America/Los_Angeles', region: 'Сев. Америка' },
        { id: 'America/Vancouver',   name: 'Ванкувер',        tz: 'America/Vancouver',   region: 'Сев. Америка' },
        { id: 'America/Anchorage',   name: 'Анкоридж',        tz: 'America/Anchorage',   region: 'Сев. Америка' },
        { id: 'Pacific/Honolulu',    name: 'Гонолулу',        tz: 'Pacific/Honolulu',    region: 'Сев. Америка' },

        // ---- Южная Америка ----
        { id: 'America/Sao_Paulo',   name: 'Сан-Паулу',       tz: 'America/Sao_Paulo',                  region: 'Юж. Америка' },
        { id: 'America/Buenos_Aires',name: 'Буэнос-Айрес',    tz: 'America/Argentina/Buenos_Aires',     region: 'Юж. Америка' },
        { id: 'America/Lima',        name: 'Лима',            tz: 'America/Lima',                        region: 'Юж. Америка' },
        { id: 'America/Santiago',    name: 'Сантьяго',        tz: 'America/Santiago',                    region: 'Юж. Америка' },

        // ---- Океания ----
        { id: 'Australia/Perth',     name: 'Перт',            tz: 'Australia/Perth',     region: 'Океания' },
        { id: 'Australia/Sydney',    name: 'Сидней',          tz: 'Australia/Sydney',    region: 'Океания' },
        { id: 'Pacific/Auckland',    name: 'Окленд',          tz: 'Pacific/Auckland',    region: 'Океания' }
    ];

    // Порядок регионов в списке
    const REGION_ORDER = ['Россия', 'СНГ', 'Европа', 'Азия', 'Африка', 'Сев. Америка', 'Юж. Америка', 'Океания'];

    // UTC-смещение строки "UTC+3", "UTC-5", "UTC+5:30"
    function getUtcOffsetLabel(tz, now) {
        try {
            const dtf = new Intl.DateTimeFormat('en-US', {
                timeZone: tz, timeZoneName: 'shortOffset', hour: '2-digit'
            });
            const parts = dtf.formatToParts(now || new Date());
            const tzn = (parts.find(p => p.type === 'timeZoneName') || {}).value || '';
            // Например: "GMT+3" или "GMT+05:30" или "GMT-4"
            const m = tzn.match(/GMT([+\-]\d{1,2})(?::?(\d{2}))?/);
            if (!m) return tzn || '';
            const hh = parseInt(m[1], 10);
            const mm = m[2] ? parseInt(m[2], 10) : 0;
            const sign = hh >= 0 ? '+' : '-';
            const absH = Math.abs(hh);
            return mm ? `UTC${sign}${absH}:${String(mm).padStart(2,'0')}` : `UTC${sign}${absH}`;
        } catch (e) { return ''; }
    }

    function getCityTimeLabel(tz, now) {
        try {
            return new Intl.DateTimeFormat('ru-RU', {
                timeZone: tz, hour: '2-digit', minute: '2-digit'
            }).format(now || new Date());
        } catch (e) { return '--:--'; }
    }

    const DEFAULTS = {
        cityId: 'Europe/Moscow',
        cityName: 'Москва',
        timezone: 'Europe/Moscow',
        timeFontSize: 15,
        dateFontSize: 15,
        showCityLabel: false
    };

    function readConfig() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (!raw) return Object.assign({}, DEFAULTS);
            const parsed = JSON.parse(raw);
            return Object.assign({}, DEFAULTS, parsed);
        } catch (e) { return Object.assign({}, DEFAULTS); }
    }
    function writeConfig(cfg) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); } catch (e) {}
    }

    let cfg = readConfig();

    // ------- Рендер времени/даты на виджете с учётом настроек -------
    function renderDateTime() {
        const timeEls = document.querySelectorAll('.live-time');
        const dateEls = document.querySelectorAll('.live-date');
        if (!timeEls.length && !dateEls.length) return;

        const now = new Date();
        let timeStr = '--:--', dateStr = '--.--';
        try {
            timeStr = new Intl.DateTimeFormat('ru-RU', {
                hour: '2-digit', minute: '2-digit', timeZone: cfg.timezone
            }).format(now);
            dateStr = new Intl.DateTimeFormat('ru-RU', {
                day: '2-digit', month: '2-digit', timeZone: cfg.timezone
            }).format(now);
        } catch (e) {
            timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            dateStr = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        }

        timeEls.forEach(el => {
            el.textContent = timeStr;
            el.style.fontSize = cfg.timeFontSize + 'px';
        });
        dateEls.forEach(el => {
            el.textContent = dateStr;
            el.style.fontSize = cfg.dateFontSize + 'px';
        });

        // Подсказка с городом на ховер
        document.querySelectorAll('.carousel-item[data-type="datetime"]').forEach(el => {
            el.title = 'Время в: ' + cfg.cityName + ' · ПКМ — настройки виджетов';
            el.style.cursor = 'pointer';
            // Лейбл города внутри виджета (опционально)
            let cityEl = el.querySelector('.dt-city-label');
            if (cfg.showCityLabel) {
                if (!cityEl) {
                    cityEl = document.createElement('span');
                    cityEl.className = 'dt-city-label';
                    cityEl.style.cssText = 'font-size:11px;color:#6b84a8;margin-right:4px;';
                    el.insertBefore(cityEl, el.firstChild);
                }
                cityEl.textContent = cfg.cityName;
                cityEl.style.display = '';
            } else if (cityEl) {
                cityEl.style.display = 'none';
            }
        });
    }

    // Запуск периодического обновления; работает параллельно с оригинальным updateDateTime
    setInterval(renderDateTime, 1000);
    // Первая отрисовка пораньше
    setTimeout(renderDateTime, 300);
    setTimeout(renderDateTime, 1500);

    // ------- Модалка настроек виджета времени -------
    function closeDateTimeModal() {
        const o = document.getElementById('datetime-settings-overlay');
        if (!o) return;
        o.classList.remove('visible');
        setTimeout(() => o.remove(), 260);
    }

    function showDateTimeSettingsModal() {
        // Закрываем существующую если есть
        document.getElementById('datetime-settings-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'datetime-settings-overlay';
        overlay.className = 'widget-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'widget-modal';
        modal.style.cssText = `
            background:rgba(8,12,24,0.55);
            backdrop-filter:blur(32px) saturate(170%);-webkit-backdrop-filter:blur(32px) saturate(170%);
            border:1px solid rgba(109,74,255,0.28);border-radius:24px;
            box-shadow:0 32px 64px rgba(0,0,0,0.9),0 0 0 1px rgba(255,255,255,0.04),0 0 50px rgba(109,74,255,0.10);
            width:440px;max-width:calc(100vw - 40px);max-height:calc(100vh - 40px);overflow:hidden;display:flex;flex-direction:column;
            transform:scale(0.92) translateY(16px);
            transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);`;

        // Старый плоский селект заменён на поиск + сгруппированный список ниже.

        modal.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;padding:18px 20px 14px;
                        border-bottom:1px solid rgba(109,74,255,0.12);background:rgba(109,74,255,0.05);">
                <div style="width:40px;height:40px;border-radius:12px;
                            background:linear-gradient(135deg,rgba(109,74,255,0.3),rgba(56,189,248,0.2));
                            border:1px solid rgba(109,74,255,0.35);display:flex;align-items:center;
                            justify-content:center;font-size:20px;box-shadow:0 0 14px rgba(109,74,255,0.25);">🕒</div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:16px;font-weight:700;background:linear-gradient(135deg,#f8fafc,#c4b5fd);
                                -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">
                        Виджет времени</div>
                    <div style="font-size:10px;color:#6b80a0;margin-top:1px;">Часовой пояс и размер шрифта</div>
                </div>
                <button class="widget-modal-close" id="datetime-close-btn">
                    <svg width="30" height="30"><use href="#icon-close"/></svg>
                </button>
            </div>

            <div style="padding:16px 18px 20px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;flex:1 1 auto;min-height:0;">

                <!-- Город -->
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
                        <span style="font-size:10px;font-weight:700;color:#6b84a8;text-transform:uppercase;
                                     letter-spacing:0.06em;">Город</span>
                        <span id="dt-city-current" style="font-size:11px;color:#c4b5fd;font-weight:600;
                                     background:rgba(109,74,255,0.14);border:1px solid rgba(109,74,255,0.28);
                                     padding:2px 9px;border-radius:999px;max-width:180px;
                                     overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                    </div>
                    <div id="dt-city-search-wrap">
                        <span class="dt-search-icon" aria-hidden="true">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                            </svg>
                        </span>
                        <input id="dt-city-search" type="text" autocomplete="off"
                               placeholder="Поиск города…">
                        <button type="button" id="dt-city-search-clear" aria-label="Очистить">×</button>
                    </div>
                    <div id="dt-city-list" role="listbox" aria-label="Список городов"></div>
                </div>

                <!-- Тогл отображения города на виджете -->
                <div style="display:flex;align-items:center;justify-content:space-between;
                            padding:10px 12px;background:rgba(109,74,255,0.05);border-radius:12px;">
                    <div style="display:flex;flex-direction:column;gap:2px;">
                        <span style="font-size:12px;font-weight:500;color:#c4cfe8;">Показывать название города</span>
                        <span style="font-size:10px;color:#4a6080;">Отображается рядом со временем</span>
                    </div>
                    <div class="custom-toggle" id="dt-city-label-toggle"
                         style="position:relative;display:inline-block;width:44px;height:22px;">
                        <div class="toggle-track" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
                                     background:${cfg.showCityLabel ? '#6d4aff' : 'rgba(109,74,255,0.25)'};
                                     border-radius:22px;transition:0.3s;"></div>
                        <div class="toggle-knob" style="position:absolute;height:18px;width:18px;left:2px;bottom:2px;
                                     background:white;border-radius:50%;transition:0.3s;
                                     transform:translateX(${cfg.showCityLabel ? '22px' : '0'});"></div>
                    </div>
                </div>

                <!-- Размер шрифта времени -->
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:10px;font-weight:700;color:#6b84a8;text-transform:uppercase;
                                     letter-spacing:0.06em;">Размер шрифта времени</span>
                        <span id="dt-time-size-val" style="font-size:12px;color:#c4b5fd;font-weight:600;">${cfg.timeFontSize}px</span>
                    </div>
                    <input type="range" id="dt-time-size" min="10" max="28" step="1" value="${cfg.timeFontSize}"
                           style="width:100%;accent-color:#6d4aff;">
                </div>

                <!-- Размер шрифта даты -->
                <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <span style="font-size:10px;font-weight:700;color:#6b84a8;text-transform:uppercase;
                                     letter-spacing:0.06em;">Размер шрифта даты</span>
                        <span id="dt-date-size-val" style="font-size:12px;color:#c4b5fd;font-weight:600;">${cfg.dateFontSize}px</span>
                    </div>
                    <input type="range" id="dt-date-size" min="10" max="28" step="1" value="${cfg.dateFontSize}"
                           style="width:100%;accent-color:#6d4aff;">
                </div>

                <!-- Превью -->
                <div style="padding:14px 16px;border-radius:14px;
                            background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);
                            display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;">
                    <span id="dt-preview-time" style="font-weight:500;color:#c4cfe8;font-size:${cfg.timeFontSize}px;">--:--</span>
                    <div style="width:1px;height:14px;background:rgba(255,255,255,0.14);"></div>
                    <span id="dt-preview-date" style="color:#6b84a8;font-size:${cfg.dateFontSize}px;">--.--</span>
                </div>

                <!-- Кнопка сброса -->
                <div style="display:flex;gap:8px;">
                    <button id="dt-reset-btn"
                            style="flex:1;padding:10px 14px;border-radius:11px;
                                   border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);
                                   color:#94a3b8;font-size:12px;font-weight:600;cursor:pointer;
                                   font-family:'Unbounded',sans-serif;transition:all 0.15s;">По умолчанию</button>
                    <button id="dt-save-btn"
                            style="flex:2;padding:10px 14px;border-radius:11px;
                                   border:1px solid rgba(109,74,255,0.4);
                                   background:linear-gradient(135deg,rgba(109,74,255,0.3),rgba(56,189,248,0.2));
                                   color:#e2e8f5;font-size:12px;font-weight:600;cursor:pointer;
                                   font-family:'Unbounded',sans-serif;transition:all 0.15s;">Сохранить</button>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        // Принудительный reflow и показ
        requestAnimationFrame(() => overlay.classList.add('visible'));

        // Рабочая копия конфига (в памяти)
        const working = Object.assign({}, cfg);

        function updatePreview() {
            const now = new Date();
            try {
                document.getElementById('dt-preview-time').textContent =
                    new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: working.timezone }).format(now);
                document.getElementById('dt-preview-date').textContent =
                    new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', timeZone: working.timezone }).format(now);
            } catch (e) {
                document.getElementById('dt-preview-time').textContent =
                    now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                document.getElementById('dt-preview-date').textContent =
                    now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            }
            document.getElementById('dt-preview-time').style.fontSize = working.timeFontSize + 'px';
            document.getElementById('dt-preview-date').style.fontSize = working.dateFontSize + 'px';
        }
        updatePreview();
        const previewTimer = setInterval(updatePreview, 1000);

        function applyAndSave() {
            cfg = Object.assign({}, working);
            writeConfig(cfg);
            renderDateTime();
        }

        // ----- Поиск и группированный список городов -----
        const cityList    = modal.querySelector('#dt-city-list');
        const citySearch  = modal.querySelector('#dt-city-search');
        const cityClear   = modal.querySelector('#dt-city-search-clear');
        const citySearchW = modal.querySelector('#dt-city-search-wrap');
        const cityCurrent = modal.querySelector('#dt-city-current');

        function escapeHtml(s) {
            return String(s).replace(/[&<>"']/g, ch => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
            }[ch]));
        }
        function highlight(name, q) {
            const safe = escapeHtml(name);
            if (!q) return safe;
            const idx = name.toLowerCase().indexOf(q.toLowerCase());
            if (idx < 0) return safe;
            const before = escapeHtml(name.slice(0, idx));
            const match  = escapeHtml(name.slice(idx, idx + q.length));
            const after  = escapeHtml(name.slice(idx + q.length));
            return `${before}<mark style="background:rgba(124,87,255,0.45);color:#fff;border-radius:3px;padding:0 2px;">${match}</mark>${after}`;
        }
        function setCurrentLabel() {
            if (!cityCurrent) return;
            const c = CITY_PRESETS.find(p => p.id === working.cityId);
            const off = c ? getUtcOffsetLabel(c.tz) : '';
            cityCurrent.textContent = c ? `${c.name} · ${off}` : '—';
        }

        function renderCityList() {
            if (!cityList) return;
            const q = (citySearch.value || '').trim().toLowerCase();
            citySearchW.classList.toggle('has-text', q.length > 0);

            const filtered = CITY_PRESETS.filter(c =>
                !q || c.name.toLowerCase().includes(q) ||
                c.tz.toLowerCase().includes(q) ||
                c.region.toLowerCase().includes(q)
            );

            if (filtered.length === 0) {
                cityList.innerHTML =
                    `<div class="dt-city-empty">Ничего не найдено<span>Попробуйте другое название</span></div>`;
                return;
            }

            // Группировка по регионам
            const byRegion = {};
            filtered.forEach(c => {
                (byRegion[c.region] = byRegion[c.region] || []).push(c);
            });
            const regions = REGION_ORDER.filter(r => byRegion[r]);
            // На случай если появятся неожиданные регионы — добавим в конец
            Object.keys(byRegion).forEach(r => { if (!regions.includes(r)) regions.push(r); });

            const now = new Date();
            const html = regions.map(r => {
                const items = byRegion[r].map(c => {
                    const time = getCityTimeLabel(c.tz, now);
                    const off = getUtcOffsetLabel(c.tz, now);
                    const sel = c.id === working.cityId ? ' selected' : '';
                    const ariaSel = c.id === working.cityId ? ' aria-selected="true"' : '';
                    return `<button type="button" class="dt-city-item${sel}" role="option"${ariaSel}
                                    data-id="${escapeHtml(c.id)}">
                        <span class="city-name">${highlight(c.name, q)}</span>
                        <span class="city-time">${escapeHtml(time)}</span>
                        <span class="city-offset">${escapeHtml(off || '—')}</span>
                    </button>`;
                }).join('');
                return `<div class="dt-region">${escapeHtml(r)}</div>${items}`;
            }).join('');

            cityList.innerHTML = html;
        }

        function pickCity(id) {
            const preset = CITY_PRESETS.find(c => c.id === id);
            if (!preset) return;
            working.cityId   = preset.id;
            working.cityName = preset.name;
            working.timezone = preset.tz;
            // Подсветка выбранного без полного перерендера
            cityList.querySelectorAll('.dt-city-item.selected').forEach(el => el.classList.remove('selected'));
            const el = cityList.querySelector(`.dt-city-item[data-id="${CSS.escape ? CSS.escape(id) : id}"]`);
            if (el) {
                el.classList.add('selected');
                // Прокрутить к выбранному, если он не виден
                try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
            }
            setCurrentLabel();
            updatePreview();
        }

        cityList.addEventListener('click', (e) => {
            const btn = e.target.closest('.dt-city-item');
            if (!btn) return;
            pickCity(btn.dataset.id);
        });

        let searchDebounce = null;
        citySearch.addEventListener('input', () => {
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(renderCityList, 70);
        });
        // Enter в поиске — выбрать первый отфильтрованный
        citySearch.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const first = cityList.querySelector('.dt-city-item');
                if (first) {
                    e.preventDefault();
                    pickCity(first.dataset.id);
                }
            }
        });
        cityClear.addEventListener('click', () => {
            citySearch.value = '';
            citySearchW.classList.remove('has-text');
            renderCityList();
            citySearch.focus();
        });

        // Периодическое обновление времени в списке (раз в 30с — экономно)
        const cityListTimer = setInterval(() => {
            // Если есть фильтр или список не виден — не дёргаем DOM
            if (!cityList.isConnected) { clearInterval(cityListTimer); return; }
            renderCityList();
        }, 30000);

        // Первичный рендер
        setCurrentLabel();
        renderCityList();
        // Прокрутить к выбранному при открытии
        setTimeout(() => {
            const sel = cityList.querySelector('.dt-city-item.selected');
            if (sel) try { sel.scrollIntoView({ block: 'center' }); } catch (e) {}
        }, 0);

        const timeSize = modal.querySelector('#dt-time-size');
        const timeSizeVal = modal.querySelector('#dt-time-size-val');
        timeSize.addEventListener('input', () => {
            working.timeFontSize = parseInt(timeSize.value, 10);
            timeSizeVal.textContent = working.timeFontSize + 'px';
            updatePreview();
        });

        const dateSize = modal.querySelector('#dt-date-size');
        const dateSizeVal = modal.querySelector('#dt-date-size-val');
        dateSize.addEventListener('input', () => {
            working.dateFontSize = parseInt(dateSize.value, 10);
            dateSizeVal.textContent = working.dateFontSize + 'px';
            updatePreview();
        });

        const cityToggle = modal.querySelector('#dt-city-label-toggle');
        function repaintToggle() {
            const t = cityToggle.querySelector('.toggle-track');
            const k = cityToggle.querySelector('.toggle-knob');
            t.style.background = working.showCityLabel ? '#6d4aff' : 'rgba(109,74,255,0.25)';
            k.style.transform = 'translateX(' + (working.showCityLabel ? '22px' : '0') + ')';
        }
        cityToggle.addEventListener('click', () => {
            working.showCityLabel = !working.showCityLabel;
            repaintToggle();
        });

        modal.querySelector('#dt-reset-btn').addEventListener('click', () => {
            // Сбрасываем только размеры шрифта; город и тогл лейбла оставляем как есть.
            working.timeFontSize = DEFAULTS.timeFontSize;
            working.dateFontSize = DEFAULTS.dateFontSize;
            timeSize.value = working.timeFontSize;
            timeSizeVal.textContent = working.timeFontSize + 'px';
            dateSize.value = working.dateFontSize;
            dateSizeVal.textContent = working.dateFontSize + 'px';
            updatePreview();
        });

        function teardown() {
            clearInterval(previewTimer);
            clearInterval(cityListTimer);
        }

        modal.querySelector('#dt-save-btn').addEventListener('click', () => {
            applyAndSave();
            teardown();
            closeDateTimeModal();
        });

        modal.querySelector('#datetime-close-btn').addEventListener('click', () => {
            teardown();
            closeDateTimeModal();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                teardown();
                closeDateTimeModal();
            }
        });

        const escHandler = (e) => {
            if (e.key === 'Escape') {
                teardown();
                closeDateTimeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    // Экспорт для возможного внешнего вызова
    window.showDateTimeSettingsModal = showDateTimeSettingsModal;

    // ------- Клик по виджету времени открывает модалку -------
    function attachDateTimeClick() {
        document.querySelectorAll('.carousel-item[data-type="datetime"]').forEach(el => {
            if (el._dtModalClickHandled) return;
            el._dtModalClickHandled = true;
            el.style.cursor = 'pointer';
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation && e.stopImmediatePropagation();
                showDateTimeSettingsModal();
            }, true); // capture=true чтобы сработать раньше существующего toast-хендлера
        });
    }
    const dtAttachInterval = setInterval(attachDateTimeClick, 500);
    setTimeout(() => clearInterval(dtAttachInterval), 15000);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachDateTimeClick);
    } else {
        attachDateTimeClick();
    }

    // ------- Открытие настроек Верхней панели и скролл к секции «Виджеты» -------
    function openWidgetSettings() {
        const overlay = document.getElementById('settings-modal-overlay');
        if (overlay) overlay.classList.add('visible');

        // Активируем вкладку "topbar"
        const navItem = document.querySelector('.settings-nav-item[data-panel="topbar"]');
        if (navItem) {
            document.querySelectorAll('.settings-nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
            navItem.classList.add('active');
            const panel = document.getElementById('panel-topbar');
            if (panel) panel.classList.add('active');
        }

        setTimeout(() => {
            const target = document.getElementById('widgets-settings-group');
            if (!target) return;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.add('widgets-section-highlight');
            setTimeout(() => target.classList.remove('widgets-section-highlight'), 1800);
        }, 220);
    }
    window.openWidgetSettings = openWidgetSettings;

    // ------- ПКМ по любому виджету -> открыть настройки -------
    function attachContextMenu() {
        const carousel = document.getElementById('top-carousel');
        if (!carousel || carousel._ctxHandled) return;
        carousel._ctxHandled = true;
        carousel.addEventListener('contextmenu', (e) => {
            // Срабатывает только если ПКМ именно по элементу виджета
            const itemEl = e.target.closest ? e.target.closest('.carousel-item') : null;
            if (!itemEl && e.target.id !== 'top-carousel' && !e.target.closest('#carousel-track')) return;
            e.preventDefault();
            openWidgetSettings();
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachContextMenu);
    } else {
        attachContextMenu();
    }
    // fallback повторные попытки на случай поздней инициализации карусели
    const ctxAttachInterval = setInterval(() => {
        const carousel = document.getElementById('top-carousel');
        if (carousel && !carousel._ctxHandled) attachContextMenu();
        if (carousel && carousel._ctxHandled) clearInterval(ctxAttachInterval);
    }, 500);
    setTimeout(() => clearInterval(ctxAttachInterval), 15000);
})();

// ============================================================
// Плавное появление текста в чате + тогл в настройках Поведения
// Стабильная версия: инкрементальный диф, перехват value-сеттера,
// ResizeObserver, никакой полной перерисовки на каждый кадр.
// ============================================================
(function smoothTypingFeature() {
    const LS_KEY = 'star_sky_smooth_typing';
    let enabled = localStorage.getItem(LS_KEY) === 'true';

    let overlay = null;
    // Массив актуальных span'ов в overlay в том же порядке, что и символы input.value
    let charSpans = [];
    let resizeObserver = null;
    let valuePatched = false;
    // Анимировать только новые добавления небольшого размера (живой ввод).
    // Большие вставки (paste / программное присвоение) — без анимации.
    const ANIMATE_MAX_ADDED = 4;

    function getInput() { return document.getElementById('chat-input'); }

    function ensureOverlay(input) {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'chat-input-smooth-overlay';
        const wrapper = input.parentElement;
        if (wrapper) {
            const cs = window.getComputedStyle(input);
            overlay.style.font = cs.font;
            overlay.style.lineHeight = cs.lineHeight;
            overlay.style.letterSpacing = cs.letterSpacing;
            overlay.style.padding = cs.padding;
            overlay.style.color = cs.color;
            wrapper.appendChild(overlay);
        }
        positionOverlay(input);
        charSpans = [];
        return overlay;
    }

    function positionOverlay(input) {
        if (!overlay) return;
        const wrapper = input.parentElement;
        if (!wrapper) return;
        const rect = input.getBoundingClientRect();
        const wrapRect = wrapper.getBoundingClientRect();
        overlay.style.left = (rect.left - wrapRect.left) + 'px';
        overlay.style.top = (rect.top - wrapRect.top) + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        // Синхронизируем скролл (длинный текст в input)
        overlay.scrollLeft = input.scrollLeft;
    }

    function bindAnimEnd(span) {
        // Снимаем класс анимации после её завершения, чтобы исключить
        // повторные перезапуски при последующих обновлениях.
        span.addEventListener('animationend', () => {
            span.classList.remove('smooth-char-in');
        }, { once: true });
    }

    function makeSpan(ch, animate) {
        const span = document.createElement('span');
        span.className = 'smooth-char';
        span.textContent = ch === ' ' ? '\u00a0' : ch;
        if (animate) {
            span.classList.add('smooth-char-in');
            bindAnimEnd(span);
        }
        return span;
    }

    function clearSpans() {
        if (!overlay) return;
        overlay.textContent = '';
        charSpans = [];
    }

    function rebuildAll(text, animate) {
        if (!overlay) return;
        clearSpans();
        const frag = document.createDocumentFragment();
        for (let i = 0; i < text.length; i++) {
            const sp = makeSpan(text[i], animate);
            frag.appendChild(sp);
            charSpans.push({ el: sp, ch: text[i] });
        }
        overlay.appendChild(frag);
        const input = getInput();
        if (input) overlay.scrollLeft = input.scrollLeft;
    }

    /**
     * Инкрементально приводит overlay к указанному тексту.
     * Не трогает уже отрендеренные символы (стабильная анимация — ничего не "прыгает"),
     * добавляет/удаляет только разницу с конца общего префикса.
     */
    function syncOverlay(text) {
        if (!overlay) return;
        const cur = charSpans.length === text.length
            ? text /* быстрый путь — длины совпадают, проверим ниже */
            : null;
        // Быстрый ранний выход, если текст совпадает
        if (cur === text) {
            // Дополнительно сверим первый отличающийся индекс на случай редактирования
            let same = true;
            for (let i = 0; i < charSpans.length; i++) {
                if (charSpans[i].ch !== text[i]) { same = false; break; }
            }
            if (same) return;
        }

        // Ищем общий префикс
        let common = 0;
        const minLen = Math.min(charSpans.length, text.length);
        while (common < minLen && charSpans[common].ch === text[common]) common++;

        // Удаляем хвост
        while (charSpans.length > common) {
            const s = charSpans.pop();
            s.el.remove();
        }

        // Добавляем недостающие символы
        const added = text.length - common;
        // Анимируем только живой ввод (1-3 символа) и только append в конец
        const animate = added > 0 && added <= ANIMATE_MAX_ADDED && common === charSpans.length;
        if (added > 0) {
            const frag = document.createDocumentFragment();
            for (let i = common; i < text.length; i++) {
                const sp = makeSpan(text[i], animate);
                frag.appendChild(sp);
                charSpans.push({ el: sp, ch: text[i] });
            }
            overlay.appendChild(frag);
        }

        const input = getInput();
        if (input) overlay.scrollLeft = input.scrollLeft;
    }

    /**
     * Перехватываем установку input.value, чтобы overlay сразу обновлялся
     * при программном изменении (например, после очистки поля при отправке).
     * Иначе событие 'input' не вызывается и overlay остаётся "залипшим".
     */
    function patchValueSetter(input) {
        if (valuePatched) return;
        try {
            const proto = HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            if (!desc || !desc.set || !desc.get) return;
            Object.defineProperty(input, 'value', {
                configurable: true,
                enumerable: true,
                get() { return desc.get.call(this); },
                set(v) {
                    desc.set.call(this, v);
                    if (enabled && overlay) {
                        // Программное изменение — без анимации
                        rebuildAll(v == null ? '' : String(v), false);
                    }
                }
            });
            valuePatched = true;
        } catch (e) { /* ignore */ }
    }

    function attach() {
        const input = getInput();
        if (!input || input._smoothTypingAttached) return;
        input._smoothTypingAttached = true;

        patchValueSetter(input);

        input.addEventListener('input', () => {
            if (!enabled || !overlay) return;
            syncOverlay(input.value || '');
        });

        // Большие вставки/срез/удаление — пересинхронизируем без анимации
        input.addEventListener('paste', () => {
            // Дадим браузеру вставить, потом пересоберём
            setTimeout(() => {
                if (enabled && overlay) rebuildAll(input.value || '', false);
            }, 0);
        });
        input.addEventListener('cut', () => {
            setTimeout(() => {
                if (enabled && overlay) syncOverlay(input.value || '');
            }, 0);
        });

        input.addEventListener('scroll', () => {
            if (overlay) overlay.scrollLeft = input.scrollLeft;
        });

        // Перепозиционируем overlay при изменении размеров поля/обёртки
        try {
            resizeObserver = new ResizeObserver(() => {
                if (enabled && overlay) positionOverlay(input);
            });
            resizeObserver.observe(input);
            if (input.parentElement) resizeObserver.observe(input.parentElement);
        } catch (e) { /* нет ResizeObserver — игнорируем */ }

        window.addEventListener('resize', () => {
            if (enabled && overlay) positionOverlay(input);
        });

        // На всякий случай раз в секунду проверяем рассинхронизацию
        // (например, если что-то поменяло value мимо нашего перехватчика).
        setInterval(() => {
            if (!enabled || !overlay) return;
            const cur = charSpans.map(s => s.ch).join('');
            const real = input.value || '';
            if (cur !== real) rebuildAll(real, false);
        }, 1500);
    }

    function applyMode() {
        const input = getInput();
        if (!input) return;
        attach();
        if (enabled) {
            ensureOverlay(input);
            positionOverlay(input);
            document.body.classList.add('smooth-typing-active');
            rebuildAll(input.value || '', false);
        } else {
            document.body.classList.remove('smooth-typing-active');
            if (overlay) overlay.remove();
            overlay = null;
            charSpans = [];
        }
    }

    function wireToggle() {
        const toggleEl = document.getElementById('smooth-typing-toggle');
        if (!toggleEl || toggleEl._wired) return;
        toggleEl._wired = true;
        const track = document.getElementById('smooth-typing-track');
        const knob = document.getElementById('smooth-typing-knob');

        function paint() {
            if (!track || !knob) return;
            track.style.background = enabled ? '#6d4aff' : 'rgba(109,74,255,0.25)';
            knob.style.transform = enabled ? 'translateX(22px)' : 'translateX(0)';
        }
        paint();

        toggleEl.addEventListener('click', () => {
            enabled = !enabled;
            localStorage.setItem(LS_KEY, String(enabled));
            paint();
            applyMode();
        });
    }

    // Ретраи на случай, если элементы появляются позже
    const iv = setInterval(() => {
        wireToggle();
        attach();
    }, 400);
    setTimeout(() => clearInterval(iv), 20000);

    // Применяем начальное состояние
    setTimeout(applyMode, 500);
    setTimeout(applyMode, 1500);

    // Экспорт для отладки / тестов
    window._smoothTyping = {
        isEnabled: () => enabled,
        set: (on) => { enabled = !!on; localStorage.setItem(LS_KEY, String(enabled)); applyMode(); wireToggle(); }
    };
})();


// ============================================================
// Бейдж "новых сообщений" в общем чате + перехват авто-скролла
// ------------------------------------------------------------
// Поведение:
//   - При появлении новых сообщений, если пользователь не у нижнего края
//     чата, авто-скролл к низу подавляется.
//   - Вместо этого показывается плавающая кнопка с количеством
//     новых сообщений.
//   - Первый клик по кнопке — скролл к началу новых сообщений
//     (с подсветкой первого нового), второй клик — в самый низ чата.
//   - Когда пользователь сам прокручивает в самый низ — счётчик
//     сбрасывается, бейдж скрывается.
//   - Свои собственные исходящие сообщения (.chat-me) всегда
//     прокручивают к низу — как и раньше.
// ============================================================
(function chatNewMsgsBadgeFeature() {
    const NEAR_BOTTOM_PX = 30;

    let msgs = null;
    let badge = null;
    let countEl = null;
    let scrollBtn = null;
    let observer = null;
    let scrollTopPatched = false;
    let allowAutoScroll = false;

    let unreadCount = 0;
    let firstNewEl = null;
    // 'first' — следующий клик прыгает к первому новому сообщению,
    // 'bottom' — следующий клик прыгает в самый низ чата.
    let mode = 'first';
    // По умолчанию считаем, что пользователь у низа (пустой/новый чат).
    let isAtBottom = true;

    function $(id) { return document.getElementById(id); }

    function isPublicTabActive() {
        const tp = $('tab-public');
        // Если элемента ещё нет — считаем, что общий чат "активен" по умолчанию.
        return tp ? tp.classList.contains('active') : true;
    }
    function isChatVisible() {
        const co = $('chat-overlay');
        return co ? !co.classList.contains('collapsed') : true;
    }

    function updateIsAtBottom() {
        if (!msgs) return;
        const dist = msgs.scrollHeight - msgs.clientHeight - msgs.scrollTop;
        isAtBottom = dist <= NEAR_BOTTOM_PX;
    }

    function setCount(n) {
        unreadCount = Math.max(0, n | 0);
        if (countEl) countEl.textContent = unreadCount;
    }

    function applyMode() {
        if (!badge) return;
        badge.classList.toggle('mode-first', mode === 'first');
        badge.classList.toggle('mode-bottom', mode === 'bottom');
        const text = badge.querySelector('.cnmb-text');
        if (text) {
            // Сохраняем счётчик и подменяем подпись при смене режима
            const word = unreadCount === 1 ? 'новое' : (unreadCount % 10 >= 2 && unreadCount % 10 <= 4 && (unreadCount % 100 < 10 || unreadCount % 100 >= 20) ? 'новых' : 'новых');
            // Простая русская форма: "N новых". Оставляем как есть для лаконичности.
            text.innerHTML = `<span id="chat-new-msgs-count">${unreadCount}</span> ` + (mode === 'bottom' ? 'к концу' : 'новых');
            countEl = $('chat-new-msgs-count');
        }
    }

    function showBadge() {
        if (!badge) return;
        if (!isPublicTabActive() || !isChatVisible()) return;
        badge.hidden = false;
        // форсим reflow, потом включаем visible — для плавного появления
        // eslint-disable-next-line no-unused-expressions
        badge.offsetWidth;
        badge.classList.add('visible');
        // Пульсация при инкременте
        badge.classList.remove('pulse');
        // eslint-disable-next-line no-unused-expressions
        badge.offsetWidth;
        badge.classList.add('pulse');
        applyMode();
        updateScrollBtnVisibility();
    }
    function hideBadge() {
        if (!badge) return;
        badge.classList.remove('visible');
        badge.classList.remove('with-scroll-btn');
        setTimeout(() => {
            if (!badge.classList.contains('visible')) badge.hidden = true;
        }, 240);
        updateScrollBtnVisibility();
    }

    // ---- Кнопка "вниз чата" (отдельная от бейджа) ----
    function shouldShowScrollBtn() {
        if (!scrollBtn || !msgs) return false;
        if (!isPublicTabActive() || !isChatVisible()) return false;
        // Показываем, только если есть куда скроллить
        if (msgs.scrollHeight - msgs.clientHeight < 60) return false;
        return !isAtBottom;
    }
    function updateScrollBtnVisibility() {
        if (!scrollBtn) return;
        const want = shouldShowScrollBtn();
        if (want) {
            scrollBtn.hidden = false;
            // eslint-disable-next-line no-unused-expressions
            scrollBtn.offsetWidth;
            scrollBtn.classList.add('visible');
            // Если бейдж тоже виден — поднимаем его над кнопкой
            if (badge && !badge.hidden && badge.classList.contains('visible')) {
                badge.classList.add('with-scroll-btn');
            } else if (badge) {
                badge.classList.remove('with-scroll-btn');
            }
        } else {
            scrollBtn.classList.remove('visible');
            if (badge) badge.classList.remove('with-scroll-btn');
            setTimeout(() => {
                if (scrollBtn && !scrollBtn.classList.contains('visible')) scrollBtn.hidden = true;
            }, 240);
        }
    }

    function resetUnread() {
        unreadCount = 0;
        firstNewEl = null;
        mode = 'first';
        if (countEl) countEl.textContent = '0';
        hideBadge();
    }

    function bumpUnread(node) {
        if (!firstNewEl || !msgs.contains(firstNewEl)) firstNewEl = node;
        mode = 'first';
        setCount(unreadCount + 1);
        showBadge();
    }

    function patchScrollTopSetter() {
        if (scrollTopPatched || !msgs) return;
        try {
            const proto = Element.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
            if (!desc || !desc.set || !desc.get) return;
            Object.defineProperty(msgs, 'scrollTop', {
                configurable: true,
                enumerable: true,
                get() { return desc.get.call(this); },
                set(v) {
                    const target = Number(v) || 0;
                    const maxScroll = this.scrollHeight - this.clientHeight;
                    const isToBottom = target > 0 && target >= maxScroll - 2;
                    if (!isToBottom) {
                        desc.set.call(this, target);
                        return;
                    }
                    // Это попытка прокрутить в самый низ.
                    // Разрешаем, если:
                    //   - явно разрешено (наш код),
                    //   - последний элемент — собственное сообщение (.chat-me),
                    //   - пользователь и так был у низа.
                    const last = this.lastElementChild;
                    const lastIsMe = !!(last && last.classList && last.classList.contains('chat-me'));
                    if (allowAutoScroll || lastIsMe || isAtBottom) {
                        desc.set.call(this, target);
                    }
                    // Иначе — подавляем авто-скролл; бейдж покажет MutationObserver.
                }
            });
            scrollTopPatched = true;
        } catch (e) { /* ignore */ }
    }

    function rawSetScrollTop(el, v) {
        try {
            const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
            if (desc && desc.set) { desc.set.call(el, v); return; }
        } catch (e) {}
        // fallback
        allowAutoScroll = true;
        try { el.scrollTop = v; } finally { allowAutoScroll = false; }
    }

    function jumpToBottom() {
        if (!msgs) return;
        allowAutoScroll = true;
        try {
            if (typeof msgs.scrollTo === 'function') {
                msgs.scrollTo({ top: msgs.scrollHeight, behavior: 'smooth' });
            } else {
                msgs.scrollTop = msgs.scrollHeight;
            }
        } finally {
            setTimeout(() => { allowAutoScroll = false; }, 700);
        }
        isAtBottom = true;
        resetUnread();
    }

    function jumpToFirstNew() {
        if (!firstNewEl || !msgs.contains(firstNewEl)) {
            jumpToBottom();
            return;
        }
        const el = firstNewEl;
        // Подсветка цели
        el.classList.remove('chat-new-anchor');
        // eslint-disable-next-line no-unused-expressions
        el.offsetWidth;
        el.classList.add('chat-new-anchor');
        setTimeout(() => el.classList.remove('chat-new-anchor'), 1700);

        // Скроллим так, чтобы первое новое было в верхней четверти контейнера
        try {
            const target = Math.max(0, el.offsetTop - 8);
            if (typeof msgs.scrollTo === 'function') {
                msgs.scrollTo({ top: target, behavior: 'smooth' });
            } else {
                rawSetScrollTop(msgs, target);
            }
        } catch (e) {}

        // Следующий клик — в самый низ
        mode = 'bottom';
        applyMode();
    }

    function onBadgeClick() {
        if (mode === 'first') jumpToFirstNew();
        else jumpToBottom();
    }

    function onScroll() {
        updateIsAtBottom();
        if (isAtBottom) resetUnread();
        updateScrollBtnVisibility();
    }

    function startObserver() {
        if (observer || !msgs) return;
        observer = new MutationObserver(muts => {
            for (const m of muts) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    if (!node.classList || !node.classList.contains('chat-line')) return;
                    if (node.classList.contains('chat-system')) return;

                    if (node.classList.contains('chat-me')) {
                        // Своё исходящее — авто-скролл уже сработает (или его сделает наш сеттер)
                        isAtBottom = true;
                        resetUnread();
                        return;
                    }

                    // Входящее сообщение
                    if (isAtBottom) {
                        // Пользователь у низа — пусть прокрутится; бейдж не нужен
                        return;
                    }
                    bumpUnread(node);
                });
            }
        });
        observer.observe(msgs, { childList: true });
    }

    function init() {
        msgs = $('chat-messages');
        badge = $('chat-new-msgs-badge');
        countEl = $('chat-new-msgs-count');
        scrollBtn = $('chat-scroll-to-bottom');
        if (!msgs || !badge || !countEl) return false;

        requestAnimationFrame(() => { updateIsAtBottom(); updateScrollBtnVisibility(); });

        msgs.addEventListener('scroll', onScroll, { passive: true });
        badge.addEventListener('click', onBadgeClick);
        if (scrollBtn) {
            scrollBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                jumpToBottom();
            });
        }

        patchScrollTopSetter();
        startObserver();

        // Реакция на смену таба чата (общий/приватный/избранное)
        ['tab-public', 'tab-private', 'tab-favorites'].forEach(id => {
            const b = $(id);
            if (b) b.addEventListener('click', () => setTimeout(() => {
                if (!isPublicTabActive() || !isChatVisible()) hideBadge();
                else if (unreadCount > 0) showBadge();
                updateScrollBtnVisibility();
            }, 0));
        });

        // Реакция на сворачивание/разворачивание чата
        const co = $('chat-overlay');
        if (co) {
            const mo = new MutationObserver(() => {
                if (!isChatVisible() || !isPublicTabActive()) hideBadge();
                else if (unreadCount > 0) showBadge();
                updateScrollBtnVisibility();
            });
            mo.observe(co, { attributes: true, attributeFilter: ['class'] });
        }

        // Если контент чата меняется (новые сообщения / удаление) — пересчитать видимость
        try {
            const ro = new ResizeObserver(() => updateScrollBtnVisibility());
            ro.observe(msgs);
        } catch (e) { /* нет ResizeObserver */ }

        return true;
    }

    function tryInit() {
        if (init()) return;
        const iv = setInterval(() => {
            if (init()) clearInterval(iv);
        }, 300);
        setTimeout(() => clearInterval(iv), 15000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }

    // Экспорт для отладки / внешних вызовов
    window._chatNewMsgsBadge = {
        getUnread: () => unreadCount,
        getMode: () => mode,
        reset: resetUnread,
        jumpToBottom,
        jumpToFirstNew,
    };
})();


// ===== ПРИВЕТСТВЕННЫЙ ТУР (интерактивный обзор сайта после первого входа) =====
(function welcomeTour() {
    const STORAGE_KEY = 'star_sky_welcome_shown';

    if (window.location.pathname.includes('/auth')) return;

    function isAuthenticated() {
        try { return !!localStorage.getItem('star_sky_current_user'); }
        catch (e) { return false; }
    }
    function _tourKey() {
        try {
            const u = JSON.parse(localStorage.getItem('star_sky_current_user') || '{}');
            const uid = u.id || u.username || null;
            return uid ? STORAGE_KEY + '_' + uid : STORAGE_KEY;
        } catch(e) { return STORAGE_KEY; }
    }
    function alreadyShown() {
        try { return localStorage.getItem(_tourKey()) === '1'; }
        catch (e) { return false; }
    }
    function markShown() {
        try { localStorage.setItem(_tourKey(), '1'); } catch (e) {}
    }

    // Шаги тура: каждый ссылается на реальный элемент интерфейса
    const steps = [
        {
            selector: null,
            placement: 'center',
            icon: '✨',
            title: 'Добро пожаловать в Star Sky',
            text: 'Это интерактивная карта пользователей в виде звёздного неба.\u00A0 Сейчас покажу,\u00A0 что где находится — займёт меньше минуты.'
        },
        {
            selector: '#user-profile',
            placement: 'bottom',
            icon: '👤',
            title: 'Ваш профиль',
            text: 'Кликните по имени или аватару,\u00A0 чтобы открыть профиль:\u00A0 цвет звезды,\u00A0 эффекты,\u00A0 описание и многое другое.'
        },
        {
            selector: '#search-btn',
            placement: 'bottom',
            icon: '🔍',
            title: 'Поиск',
            text: 'Найдите любого пользователя по имени и быстро перенеситесь к его звезде.'
        },
        {
            selector: '#tasks-btn',
            placement: 'bottom',
            icon: '📋',
            title: 'Задания',
            text: 'Ежедневные задания.\u00A0 Выполняйте их,\u00A0 чтобы получать очки активности и расти в рейтинге.'
        },
        {
            selector: '#leaderboard-btn',
            placement: 'bottom',
            icon: '🏆',
            title: 'Таблица лидеров',
            text: 'Топ самых активных пользователей.\u00A0 Чем больше очков — тем ярче ваша звезда.'
        },
        {
            selector: '#friends-btn',
            placement: 'bottom',
            icon: '👥',
            title: 'Друзья',
            text: 'Список друзей,\u00A0 входящие заявки и поиск новых знакомых.'
        },
        {
            selector: '#settings-btn',
            placement: 'bottom',
            icon: '⚙️',
            title: 'Настройки',
            text: 'Темы фона и чата,\u00A0 звуки,\u00A0 расположение панелей и эффекты звезды — всё здесь.'
        },
        {
            selector: '#top-carousel',
            placement: 'bottom',
            icon: '📰',
            title: 'Уведомления и статус',
            text: 'В центре сверху — сейчас в онлайне,\u00A0 уведомления,\u00A0 дата/время и погода.'
        },
        {
            selector: '#skin-panel',
            placement: 'right',
            icon: '🛒',
            title: 'Магазин звёзд',
            text: 'Тратьте очки активности на новые цвета и эффекты для своей звезды.'
        },
        {
            selector: '#chat-overlay',
            placement: 'top',
            icon: '💬',
            title: 'Чат',
            text: 'Общий чат,\u00A0 личные сообщения и созвездия (групповые чаты).\u00A0 Можно менять положение и менять размер окна.'
        },
        {
            selector: null,
            placement: 'center',
            icon: '🌠',
            title: 'И главное — звёздная карта',
            text: 'Сам фон — это карта пользователей.\u00A0 ЛКМ + перетаскивание — перемещение,\u00A0 колесо мыши — зум,\u00A0 клик по звезде — открыть профиль. Удачи в звёздном небе!'
        }
    ];

    let tour, spotlight, card, titleEl, textEl, iconEl, prevBtn, nextBtn, finishBtn, skipBtn, counterEl, progressEl;
    let blockerTop, blockerBottom, blockerLeft, blockerRight;
    let resumeWrap, resumeBtn;
    let current = 0;
    let repositionRaf = 0;
    let scrollPending = false;
    let highlightedEl = null;
    let isPaused = false;

    function $(id) { return document.getElementById(id); }

    function findElement(sel) {
        if (!sel) return null;
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        const styles = getComputedStyle(el);
        if (styles.display === 'none' || styles.visibility === 'hidden' || +styles.opacity === 0) return null;
        return el;
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function placeCard(step, el) {
        const PAD = 8;
        const GAP = 14;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardW = card.offsetWidth || 340;
        const cardH = card.offsetHeight || 200;

        // Центрированный шаг (без подсветки конкретного элемента)
        if (!el || step.placement === 'center') {
            spotlight.classList.add('center');
            // Сбрасываем inline-стили, чтобы класс .center с blur'ом полностью применился
            spotlight.style.top = '';
            spotlight.style.left = '';
            spotlight.style.width = '';
            spotlight.style.height = '';
            // Прячем блокеры — на центрированном шаге кликабельной зоны нет
            hideBlockers();
            highlightedEl = null;
            card.className = 'placement-center';
            card.style.top = Math.round(vh / 2 - cardH / 2) + 'px';
            card.style.left = Math.round(vw / 2 - cardW / 2) + 'px';
            return;
        }

        spotlight.classList.remove('center');
        const r = el.getBoundingClientRect();
        const sx = r.left - PAD;
        const sy = r.top - PAD;
        const sw = r.width + PAD * 2;
        const sh = r.height + PAD * 2;

        spotlight.style.top = sy + 'px';
        spotlight.style.left = sx + 'px';
        spotlight.style.width = sw + 'px';
        spotlight.style.height = sh + 'px';

        // Запоминаем подсвеченный элемент (по клику тур паузится)
        highlightedEl = el;
        // Блокеры закрывают всё, кроме окна спотлайта — клики проходят только в спотлайт
        positionBlockers(sx, sy, sw, sh, vw, vh);

        // Выбираем расположение карточки
        let placement = step.placement || 'auto';
        const spaceBelow = vh - (sy + sh);
        const spaceAbove = sy;
        const spaceRight = vw - (sx + sw);
        const spaceLeft = sx;

        function fits(p) {
            if (p === 'bottom') return spaceBelow >= cardH + GAP + 8;
            if (p === 'top')    return spaceAbove >= cardH + GAP + 8;
            if (p === 'right')  return spaceRight >= cardW + GAP + 8;
            if (p === 'left')   return spaceLeft  >= cardW + GAP + 8;
            return false;
        }

        if (placement === 'auto' || !fits(placement)) {
            // Подбираем первое подходящее
            const order = ['bottom', 'top', 'right', 'left'];
            const found = order.find(fits);
            placement = found || placement || 'bottom';
        }

        let cardTop, cardLeft;
        if (placement === 'bottom') {
            cardTop = sy + sh + GAP;
            cardLeft = clamp(sx + sw / 2 - cardW / 2, 12, vw - cardW - 12);
        } else if (placement === 'top') {
            cardTop = sy - cardH - GAP;
            cardLeft = clamp(sx + sw / 2 - cardW / 2, 12, vw - cardW - 12);
        } else if (placement === 'right') {
            cardTop = clamp(sy + sh / 2 - cardH / 2, 12, vh - cardH - 12);
            cardLeft = sx + sw + GAP;
        } else { // left
            cardTop = clamp(sy + sh / 2 - cardH / 2, 12, vh - cardH - 12);
            cardLeft = sx - cardW - GAP;
        }

        // Финальный clamp в пределах окна
        cardTop = clamp(cardTop, 8, vh - cardH - 8);
        cardLeft = clamp(cardLeft, 8, vw - cardW - 8);

        card.className = 'placement-' + placement;
        card.style.top = Math.round(cardTop) + 'px';
        card.style.left = Math.round(cardLeft) + 'px';
    }

    function ensureInView(el, cb) {
        if (!el) { cb(); return; }
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        if (r.top >= 0 && r.bottom <= vh) { cb(); return; }
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } catch (e) {}
        // Ждём окончания плавного скролла
        scrollPending = true;
        setTimeout(() => { scrollPending = false; cb(); }, 380);
    }

    // Размещение четырёх прозрачных блокеров вокруг спотлайта.
    // Они блокируют клики по затемнённой области, но окно спотлайта остаётся
    // полностью кликабельным — пользователь может тыкнуть на подсвеченный элемент.
    function positionBlockers(sx, sy, sw, sh, vw, vh) {
        if (!blockerTop) return;
        const sxC = Math.max(0, sx);
        const syC = Math.max(0, sy);
        const sxR = Math.min(vw, sx + sw);
        const syB = Math.min(vh, sy + sh);

        blockerTop.style.cssText = `display:block;top:0;left:0;width:${vw}px;height:${syC}px;`;
        blockerBottom.style.cssText = `display:block;top:${syB}px;left:0;width:${vw}px;height:${Math.max(0, vh - syB)}px;`;
        blockerLeft.style.cssText = `display:block;top:${syC}px;left:0;width:${sxC}px;height:${Math.max(0, syB - syC)}px;`;
        blockerRight.style.cssText = `display:block;top:${syC}px;left:${sxR}px;width:${Math.max(0, vw - sxR)}px;height:${Math.max(0, syB - syC)}px;`;
    }
    function hideBlockers() {
        if (!blockerTop) return;
        blockerTop.style.display = 'none';
        blockerBottom.style.display = 'none';
        blockerLeft.style.display = 'none';
        blockerRight.style.display = 'none';
    }

    // Закрывает все открытые модалки/панели/виджеты, чтобы вернуться к чистому
    // экрану перед продолжением тура или при его старте.
    function closeAllOpenedModals() {
        // Стандартные модалки сайта (через .visible)
        const visibleModals = [
            'profile-modal-overlay',
            'search-panel',
            'tasks-modal-overlay',
            'leaderboard-modal-overlay',
            'friends-modal-overlay',
            'settings-modal-overlay',
            'star-card-overlay'
        ];
        visibleModals.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('visible');
        });
        // Если в коде есть глобальная функция-помощник — вызываем её,
        // чтобы корректно сбросить isProfileOpen / isSearchOpen / и т.п.
        try {
            if (typeof window.closeAllModals === 'function') window.closeAllModals(null);
            if (typeof window.closeAllPanels === 'function') window.closeAllPanels(null);
        } catch (e) {}
        // Кастомайзер анимации (display)
        const animModal = document.getElementById('anim-customizer-modal');
        if (animModal) animModal.style.display = 'none';
        // Виджет-модалки (online, weather и т.п.) — у них класс .widget-modal-overlay
        document.querySelectorAll('.widget-modal-overlay').forEach(o => {
            o.classList.remove('visible');
            o.style.display = 'none';
        });
        // Магазин звёзд — сворачиваем (если развёрнут)
        const skin = document.getElementById('skin-panel');
        if (skin && !skin.classList.contains('collapsed')) skin.classList.add('collapsed');
        // Эмодзи-пикер, контекстные меню — на всякий случай
        const emoji = document.getElementById('emoji-picker');
        if (emoji) emoji.classList.remove('open');
        const ctx = document.getElementById('context-menu');
        if (ctx) ctx.style.display = 'none';
    }

    // Останавливает «живые» виджеты (карусель верхней панели и т.п.) на время тура.
    // Возвращает функцию-восстановитель.
    let restoreWidgets = null;
    function pauseWidgets() {
        if (restoreWidgets) return; // уже на паузе
        // 1. Останавливаем автопрокрутку карусели верхней панели
        let prevAutoScroll = null;
        try {
            const raw = localStorage.getItem('star_sky_settings');
            const s = raw ? JSON.parse(raw) : {};
            prevAutoScroll = (typeof s.carouselAutoScroll === 'undefined') ? true : !!s.carouselAutoScroll;
        } catch (e) {}
        if (typeof window._carouselSetAutoScroll === 'function') {
            try { window._carouselSetAutoScroll(false); } catch (e) {}
        }
        // 2. Глобальный класс — позволяет CSS-ам затушить анимации виджетов
        document.body.classList.add('welcome-tour-active');
        restoreWidgets = function () {
            document.body.classList.remove('welcome-tour-active');
            if (prevAutoScroll !== null && typeof window._carouselSetAutoScroll === 'function') {
                try { window._carouselSetAutoScroll(prevAutoScroll); } catch (e) {}
            }
        };
    }
    function resumeWidgets() {
        if (!restoreWidgets) return;
        try { restoreWidgets(); } catch (e) {}
        restoreWidgets = null;
    }

    function pauseTour() {
        if (isPaused) return;
        isPaused = true;
        // Прячем тур, но НЕ сбрасываем current — потом возобновим тот же шаг.
        // Полностью убираем все элементы тура с экрана: блокеры, тёмную заливку
        // спотлайта, карточку — иначе они продолжат перехватывать клики.
        tour.classList.remove('visible');
        tour.setAttribute('aria-hidden', 'true');
        tour.style.display = 'none';
        hideBlockers();
        if (spotlight) spotlight.style.display = 'none';
        // Снимаем паузу с виджетов — пока пользователь смотрит модалку,
        // пусть всё работает как обычно
        resumeWidgets();
        if (resumeWrap) {
            resumeWrap.style.display = 'block';
            // Небольшая задержка для css-анимации
            requestAnimationFrame(() => resumeWrap.classList.add('visible'));
        }
    }
    function resumeTour() {
        if (!isPaused) return;
        isPaused = false;
        if (resumeWrap) {
            resumeWrap.classList.remove('visible');
            setTimeout(() => { resumeWrap.style.display = 'none'; }, 250);
        }
        // Закрываем все открытые модалки/окна, чтобы тур вернулся к чистому экрану
        closeAllOpenedModals();
        // Возвращаем элементы тура на экран
        if (spotlight) spotlight.style.display = '';
        tour.style.display = 'block';
        void tour.offsetWidth;
        tour.classList.add('visible');
        tour.setAttribute('aria-hidden', 'false');
        // Даём DOM-у обновиться (анимации закрытия модалок идут пару кадров),
        // потом пересчитываем подсветку — иначе getBoundingClientRect может вернуть
        // координаты ещё открытой/исчезающей модалки. Внутри render() сработает
        // syncWidgetsForStep(), который снова поставит виджеты на паузу
        // (или оставит их активными, если шаг — это карусель).
        requestAnimationFrame(() => requestAnimationFrame(render));
    }

    // На «живых» шагах (карусель верхней панели) виджеты должны работать —
    // иначе пользователь не увидит, что они умеют. На остальных — на паузе.
    function syncWidgetsForStep(step) {
        if (!step) return;
        const liveSelectors = ['#top-carousel'];
        const isLive = liveSelectors.indexOf(step.selector) !== -1;
        if (isLive) resumeWidgets(); else pauseWidgets();
    }

    // Клик по подсвеченному элементу → пауза тура
    function onDocClick(e) {
        if (!tour || !tour.classList.contains('visible')) return;
        if (isPaused) return;
        // Кнопки карточки — никогда не перехватываем
        if (card && card.contains(e.target)) return;
        if (!highlightedEl) return;
        if (highlightedEl === e.target || highlightedEl.contains(e.target)) {
            pauseTour();
        }
    }

    function render() {
        const step = steps[current];
        const el = findElement(step.selector);

        // Виджеты: карусель оживает только на своём шаге, иначе всё на паузе
        syncWidgetsForStep(step);

        // Контент
        iconEl.textContent = step.icon || '';
        titleEl.textContent = step.title;
        textEl.textContent = step.text;
        counterEl.textContent = (current + 1) + ' / ' + steps.length;

        // Кнопки
        prevBtn.disabled = current === 0;
        const isLast = current === steps.length - 1;
        nextBtn.style.display = isLast ? 'none' : '';
        finishBtn.style.display = isLast ? '' : 'none';

        // Точки прогресса
        progressEl.innerHTML = '';
        for (let i = 0; i < steps.length; i++) {
            const dot = document.createElement('span');
            dot.className = 'dot' + (i === current ? ' active' : i < current ? ' done' : '');
            progressEl.appendChild(dot);
        }

        // Расположение
        ensureInView(el, () => placeCard(step, el));
    }

    function reposition() {
        if (scrollPending) return;
        cancelAnimationFrame(repositionRaf);
        repositionRaf = requestAnimationFrame(() => {
            if (!tour.classList.contains('visible')) return;
            const step = steps[current];
            const el = findElement(step.selector);
            placeCard(step, el);
        });
    }

    function open() {
        isPaused = false;
        if (resumeWrap) { resumeWrap.classList.remove('visible'); resumeWrap.style.display = 'none'; }
        // Закрываем всё, что мог открыть пользователь до старта тура,
        // и ставим виджеты на паузу.
        closeAllOpenedModals();
        pauseWidgets();
        tour.style.display = 'block';
        void tour.offsetWidth;
        tour.classList.add('visible');
        tour.setAttribute('aria-hidden', 'false');
        current = 0;
        render();
        document.addEventListener('keydown', onKey);
        document.addEventListener('click', onDocClick);
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
    }

    function close() {
        tour.classList.remove('visible');
        tour.setAttribute('aria-hidden', 'true');
        markShown();
        hideBlockers();
        highlightedEl = null;
        isPaused = false;
        if (resumeWrap) { resumeWrap.classList.remove('visible'); resumeWrap.style.display = 'none'; }
        // Возвращаем виджеты к нормальной работе (карусель и т.п.)
        resumeWidgets();
        setTimeout(() => { tour.style.display = 'none'; }, 300);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('click', onDocClick);
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
    }

    function nextStep() {
        if (current < steps.length - 1) { current++; render(); }
    }
    function prevStep() {
        if (current > 0) { current--; render(); }
    }

    function onKey(e) {
        // Когда тур на паузе — клавиши не перехватываем,
        // чтобы пользователь мог свободно работать с подсвеченным элементом
        if (isPaused) return;
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); nextStep(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevStep(); return; }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (current === steps.length - 1) close(); else nextStep();
        }
    }

    function init() {
        tour = $('welcome-tour');
        if (!tour) return;
        spotlight = $('welcome-tour-spotlight');
        card = $('welcome-tour-card');
        titleEl = $('welcome-tour-title');
        textEl = $('welcome-tour-text');
        iconEl = $('welcome-tour-icon');
        prevBtn = $('welcome-tour-prev-btn');
        nextBtn = $('welcome-tour-next-btn');
        finishBtn = $('welcome-tour-finish-btn');
        skipBtn = $('welcome-tour-skip-btn');
        counterEl = $('welcome-tour-counter');
        progressEl = $('welcome-tour-progress');
        blockerTop = $('welcome-tour-blocker-top');
        blockerBottom = $('welcome-tour-blocker-bottom');
        blockerLeft = $('welcome-tour-blocker-left');
        blockerRight = $('welcome-tour-blocker-right');
        resumeWrap = $('welcome-tour-resume');
        resumeBtn = $('welcome-tour-resume-btn');

        if (!spotlight || !card || !titleEl || !textEl || !nextBtn || !prevBtn || !finishBtn || !skipBtn) return;

        nextBtn.addEventListener('click', nextStep);
        prevBtn.addEventListener('click', prevStep);
        finishBtn.addEventListener('click', close);
        skipBtn.addEventListener('click', close);
        if (resumeBtn) resumeBtn.addEventListener('click', resumeTour);

        // Публичное API: показать тур повторно или сбросить флаг
        window.StarSkyWelcome = {
            show: () => open(),
            reset: () => {
                try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
            }
        };

        // Автозапуск при первом заходе
        if (isAuthenticated() && !alreadyShown()) {
            open();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
