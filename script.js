const SERVER_URL = 'https://habitracker-server.onrender.com';

function lsGet(key, fallback) {
    try {
        const val = localStorage.getItem(key);
        if (val === null || val === undefined) return JSON.parse(fallback);
        return JSON.parse(val);
    } catch(e) { return JSON.parse(fallback); }
}

function lsSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) {}
}

(function cleanOldUser() {
    try {
        const saved = localStorage.getItem('tgUser');
        if (saved) {
            const u = JSON.parse(saved);
            if (!u || u.id === 0 || u.first_name === 'Гость' || u.first_name === 'Пользователь') {
                localStorage.removeItem('tgUser');
            }
        }
    } catch(e) { localStorage.removeItem('tgUser'); }
})();

const MONTHS      = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
const MONTHS_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAYS_FULL   = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DAY_KEYS    = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
const DAYS_IN_MONTH = [31,28,29,31,30,31,30,31,31,30,31,30,31];

const ICONS = [
    '🏃','💪','📚','💧','🧘','🥗','😴','✍️',
    '🎯','🎨','🎸','🏊','🚴','🧹','💊','🐶',
    '🌅','🧠','🫁','🦷','🚶','🍎','☕','🧴',
    '📝','🎤','🏋️','🤸','🌿','💤','🥤','🧘',
    '📖','🖊️','🎹','🏄','🧗','🌙','⭐','🔥'
];

let habits      = lsGet('habits', '[]');
let progress    = lsGet('progress', '{}');
let currentUser = null;
let friends     = lsGet('friends', '[]');
let challenges  = lsGet('challenges', '[]');
let selectedIconValue = '⭐';
let reminderOn        = false;
let reminderTime      = '09:00';
let reminderType      = 'time';
let reminderInterval  = 2;
let reminderStart     = '08:00';
let reminderEnd       = '22:00';
let allDayReminder    = false;
let iconPickerOpen    = false;
let dayMode           = 'weekday';
let dayIntervalVal    = 2;

let challengeIconValue      = '⭐';
let challengeIconPickerOpen = false;
let friendRequests          = [];

let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

const dateState = {
    day:   new Date().getDate(),
    month: new Date().getMonth(),
    year:  new Date().getFullYear()
};

// =============================================
// УТИЛИТЫ
// =============================================

function getUserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    } catch(e) { return 'Europe/Moscow'; }
}

function dateKey(d) {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatMainDate(d) {
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow  = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dateStr = d.getDate() + ' ' + MONTHS_FULL[d.getMonth()];
    if (d.getTime() === today.getTime())     return 'Сегодня, '   + dateStr;
    if (d.getTime() === yesterday.getTime()) return 'Вчера, '     + dateStr;
    if (d.getTime() === tomorrow.getTime())  return 'Завтра, '    + dateStr;
    return DAYS_FULL[d.getDay()] + ', ' + dateStr;
}

// =============================================
// TELEGRAM
// =============================================

function initTelegram() {
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
    } catch(e) {}
}

function tryGetTelegramUser() {
    try {
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            const u = window.Telegram.WebApp.initDataUnsafe.user;
            if (u && u.id && u.id !== 0) return u;
        }
    } catch(e) {}
    return null;
}

function tryAutoLogin() {
    const tgUser = tryGetTelegramUser();
    if (tgUser) {
        currentUser = tgUser;
        lsSet('tgUser', currentUser);
        return;
    }
    const saved = lsGet('tgUser', 'null');
    if (saved && saved.id && saved.id !== 0) {
        currentUser = saved;
    } else {
        currentUser = null;
    }
}

function fakeTelegramLogin() {
    const tgUser = tryGetTelegramUser();
    if (tgUser) {
        currentUser = tgUser;
        lsSet('tgUser', currentUser);
    } else {
        alert('Откройте приложение через бота @habitrackkbot в Telegram');
        return;
    }
    renderProfile();
    loadFromServer();
    syncWithServer();
}

function logout() {
    currentUser = null;
    try { localStorage.removeItem('tgUser'); } catch(e) {}
    renderProfile();
}

// =============================================
// СЕРВЕР
// =============================================

async function syncWithServer() {
    if (!currentUser || !currentUser.id) return;
    try {
        const response = await fetch(`${SERVER_URL}/api/sync`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.id,
                firstName:  currentUser.first_name || '',
                username:   currentUser.username   || '',
                habits:     habits   || [],
                progress:   progress || {},
                timezone:   getUserTimezone()
            })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.habits && data.habits.length >= habits.length) {
                habits = data.habits;
                lsSet('habits', habits);
            }
            if (data.progress && Object.keys(data.progress).length >= Object.keys(progress).length) {
                progress = data.progress;
                lsSet('progress', progress);
            }
            renderHabits();
            renderProfile();
        }
    } catch(e) { console.log('Офлайн режим'); }
}

async function loadFromServer() {
    if (!currentUser || !currentUser.id) return;
    try {
        const response = await fetch(`${SERVER_URL}/api/user/${currentUser.id}`);
        if (response.ok) {
            const data = await response.json();
            if (data.habits && data.habits.length > 0) {
                habits = data.habits;
                lsSet('habits', habits);
            }
            if (data.progress && Object.keys(data.progress).length > 0) {
                progress = data.progress;
                lsSet('progress', progress);
            }
            renderHabits();
            renderProfile();
        }
    } catch(e) { console.log('Не удалось загрузить с сервера'); }
}

// =============================================
// НАВИГАЦИЯ
// =============================================

function showPage(name, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    el.classList.add('active');
    if (name === 'profile') renderProfile();
    if (name === 'friends') renderFriendsPage();
}

function renderDateLabel() {
    const el = document.getElementById('mainDateLabel');
    if (el) el.textContent = formatMainDate(currentDate);
}

function changeMainDate(dir) {
    currentDate.setDate(currentDate.getDate() + dir);
    renderDateLabel();
    renderHabits();
}

function switchHomeTab(tab, el) {
    document.querySelectorAll('.home-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('homeTabPersonalContent').style.display   = tab === 'personal'   ? 'block' : 'none';
    document.getElementById('homeTabChallengesContent').style.display = tab === 'challenges' ? 'block' : 'none';
    if (tab === 'challenges') renderChallengeHabits();
}

// =============================================
// ПРИВЫЧКИ
// =============================================

function isHabitActiveOnDate(habit, date) {
    if (habit.dayMode === 'interval' && habit.dayInterval) {
        const start = habit.startDate ? new Date(habit.startDate) : new Date();
        start.setHours(0,0,0,0);
        const target = new Date(date);
        target.setHours(0,0,0,0);
        const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return false;
        return diffDays % habit.dayInterval === 0;
    }
    if (!habit.days || habit.days.length === 0) return true;
    return habit.days.includes(DAY_KEYS[date.getDay()]);
}

function renderHabits() {
    const list = document.getElementById('habitsList');
    if (!list) return;
    const key           = dateKey(currentDate);
    const todayProgress = progress[key] || {};
    const filtered = habits.filter(h => {
    if (h.fromChallenge === true) return false;
    if (h.challengeId) return false;
    if (String(h.id).startsWith('challenge_')) return false;
    return isHabitActiveOnDate(h, currentDate);
});
    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-msg">
                <span class="empty-icon">🌱</span>
                <span>Нет привычек на этот день</span>
                <span style="font-size:12px;margin-top:4px;">Нажмите «+ Добавить», чтобы начать</span>
            </div>`;
        return;
    }
    list.innerHTML = filtered.map(h => {
        const done      = todayProgress[h.id] || 0;
        const total     = h.count || 1;
        const pct       = Math.min(100, Math.round((done / total) * 100));
        const completed = done >= total;
        return `
        <div class="habit-card ${completed ? 'completed' : ''}" id="card-${h.id}">
            <div class="habit-card-inner">
                <div class="habit-icon-circle">${h.icon || '⭐'}</div>
                <div class="habit-middle">
                    <div class="habit-name">${h.name}</div>
                    <div class="habit-sub">${done} / ${total} ${h.unit || 'раз'}</div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width:${pct}%;${completed ? 'background:var(--success)' : ''}"></div>
                    </div>
                </div>
                <div class="card-btns">
                    <button class="plus-btn"    onclick="addProgress('${h.id}')">+</button>
                    <button class="delete-btn"  onclick="deleteHabit('${h.id}')">×</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function addProgress(id) {
    const key = dateKey(currentDate);
    if (!progress[key]) progress[key] = {};
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const current = progress[key][id] || 0;
    if (current < habit.count) {
        progress[key][id] = current + 1;
        lsSet('progress', progress);
        renderHabits();
        syncWithServer();
    }
}

function deleteHabit(id) {
    const confirmed = confirm('Удалить привычку? Это действие нельзя отменить.');
    if (!confirmed) return;

    habits = habits.filter(h => h.id !== id);
    lsSet('habits', habits);
    renderHabits();
    syncWithServer();
}

// =============================================
// МОДАЛКА ДОБАВЛЕНИЯ ПРИВЫЧКИ
// =============================================

function setDayMode(mode) {
    dayMode = mode;
    document.getElementById('dayModeWeekday').classList.toggle('active', mode === 'weekday');
    document.getElementById('dayModeInterval').classList.toggle('active', mode === 'interval');
    document.getElementById('weekdayPicker').style.display     = mode === 'weekday'  ? 'block' : 'none';
    document.getElementById('intervalDayPicker').style.display = mode === 'interval' ? 'block' : 'none';
}

function changeDayInterval(dir) {
    const input = document.getElementById('dayIntervalValue');
    let val = parseInt(input.value) || 2;
    val = Math.max(2, Math.min(365, val + dir));
    dayIntervalVal = val;
    input.value = val;
}

function syncDayIntervalInput(input) {
    let val = parseInt(input.value);
    if (!isNaN(val)) dayIntervalVal = Math.max(2, Math.min(365, val));
}

function fixDayIntervalInput(input) {
    let val = parseInt(input.value);
    if (isNaN(val) || val < 2) val = 2;
    if (val > 365) val = 365;
    dayIntervalVal = val;
    input.value = val;
}

function toggleDay(btn) { btn.classList.toggle('active'); }

function toggleAllDays(btn) {
    const dayBtns   = document.querySelectorAll('.day-circle');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => allActive ? b.classList.remove('active') : b.classList.add('active'));
    btn.textContent = allActive ? 'Выбрать все' : 'Снять все';
}

function openModal() {
    const now = new Date();
    dateState.day   = now.getDate();
    dateState.month = now.getMonth();
    dateState.year  = now.getFullYear();
    updateDateDisplay();

    document.getElementById('habitName').value  = '';
    document.getElementById('habitCount').value = '';
    document.getElementById('habitUnit').value  = 'раз';

    selectedIconValue = '⭐';
    document.getElementById('selectedIcon').textContent = '⭐';

    reminderOn = false; reminderTime = '09:00'; reminderType = 'time';
    reminderInterval = 2; reminderStart = '08:00'; reminderEnd = '22:00'; allDayReminder = false;
    dayMode = 'weekday'; dayIntervalVal = 2;

    document.getElementById('dayModeWeekday').classList.add('active');
    document.getElementById('dayModeInterval').classList.remove('active');
    document.getElementById('weekdayPicker').style.display     = 'block';
    document.getElementById('intervalDayPicker').style.display = 'none';
    document.getElementById('dayIntervalValue').value          = '2';

    const allBtn = document.querySelector('.select-all-btn');
    if (allBtn) allBtn.textContent = 'Выбрать все';

    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent        = 'нет';
    document.getElementById('reminderTimeWrap').style.display = 'none';
    document.getElementById('typeBtnTime').classList.add('active');
    document.getElementById('typeBtnInterval').classList.remove('active');
    document.getElementById('reminderExactTime').style.display    = 'block';
    document.getElementById('reminderIntervalWrap').style.display = 'none';
    document.getElementById('reminderTimeInput').value     = '09:00';
    document.getElementById('reminderIntervalInput').value = '2';
    document.getElementById('intervalStartInput').value    = '08:00';
    document.getElementById('intervalEndInput').value      = '22:00';
    document.getElementById('allDayToggle').classList.remove('on');
    document.getElementById('allDayLabel').textContent         = 'нет';
    document.getElementById('intervalTimeRange').style.display = 'block';

    document.querySelectorAll('.day-circle').forEach(b => b.classList.remove('active'));
    iconPickerOpen = false;
    document.getElementById('iconPicker').classList.remove('open');
    document.getElementById('modalOverlay').classList.add('active');
    buildIconGrid();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.getElementById('iconPicker').classList.remove('open');
    iconPickerOpen = false;
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function buildIconGrid() {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = ICONS.map(ic =>
        `<button class="icon-option" onclick="selectIcon('${ic}')">${ic}</button>`
    ).join('');
}

function toggleIconPicker(e) {
    e.stopPropagation();
    iconPickerOpen = !iconPickerOpen;
    document.getElementById('iconPicker').classList.toggle('open', iconPickerOpen);
}

function selectIcon(ic) {
    selectedIconValue = ic;
    document.getElementById('selectedIcon').textContent = ic;
    document.getElementById('iconPicker').classList.remove('open');
    iconPickerOpen = false;
}

function changeDate(type, dir) {
    if (type === 'day') {
        const max = DAYS_IN_MONTH[dateState.month];
        dateState.day = ((dateState.day - 1 + dir + max) % max) + 1;
    } else if (type === 'month') {
        dateState.month = (dateState.month + 12 + dir) % 12;
        const max = DAYS_IN_MONTH[dateState.month];
        if (dateState.day > max) dateState.day = max;
    } else if (type === 'year') {
        dateState.year = Math.max(2020, Math.min(2099, dateState.year + dir));
    }
    updateDateDisplay();
}

function updateDateDisplay() {
    document.getElementById('startDay').textContent   = dateState.day;
    document.getElementById('startMonth').textContent = MONTHS[dateState.month];
    document.getElementById('startYear').textContent  = dateState.year;
}

function toggleReminder() {
    reminderOn = !reminderOn;
    document.getElementById('reminderToggle').classList.toggle('on', reminderOn);
    document.getElementById('toggleLabel').textContent        = reminderOn ? 'да' : 'нет';
    document.getElementById('reminderTimeWrap').style.display = reminderOn ? 'block' : 'none';
}

function setReminderTime(val) { reminderTime = val; }

function setReminderType(type) {
    reminderType = type;
    document.getElementById('typeBtnTime').classList.toggle('active', type === 'time');
    document.getElementById('typeBtnInterval').classList.toggle('active', type === 'interval');
    document.getElementById('reminderExactTime').style.display    = type === 'time'     ? 'block' : 'none';
    document.getElementById('reminderIntervalWrap').style.display = type === 'interval' ? 'block' : 'none';
}

function toggleAllDay() {
    allDayReminder = !allDayReminder;
    document.getElementById('allDayToggle').classList.toggle('on', allDayReminder);
    document.getElementById('allDayLabel').textContent         = allDayReminder ? 'да' : 'нет';
    document.getElementById('intervalTimeRange').style.display = allDayReminder ? 'none' : 'block';
}

function saveHabit() {
    const nameInput = document.getElementById('habitName');
    const name      = nameInput.value.trim();
    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#FF6584';
        setTimeout(() => nameInput.style.borderColor = 'var(--border)', 1500);
        return;
    }

    const count = parseInt(document.getElementById('habitCount').value) || 1;
    const unit  = document.getElementById('habitUnit').value;
    const icon  = selectedIconValue || '⭐';
    const startDate = `${dateState.year}-${String(dateState.month+1).padStart(2,'0')}-${String(dateState.day).padStart(2,'0')}`;

    let activeDays = [], habitDayMode = dayMode, habitDayInterval = null;
    if (dayMode === 'weekday') {
        activeDays = [...document.querySelectorAll('.day-circle.active')].map(b => b.getAttribute('data-day'));
    } else {
        const inputVal = parseInt(document.getElementById('dayIntervalValue').value) || 2;
        habitDayInterval = Math.max(2, Math.min(365, inputVal));
        dayIntervalVal = habitDayInterval;
    }

    let habitReminder = false, habitReminderTime = null, habitReminderType = null;
    let habitReminderInterval = null, habitReminderStart = null, habitReminderEnd = null, habitReminderAllDay = false;

    if (reminderOn) {
        habitReminder = true;
        habitReminderType = reminderType;
        if (reminderType === 'time') {
            habitReminderTime = document.getElementById('reminderTimeInput').value;
        } else {
            habitReminderInterval = parseInt(document.getElementById('reminderIntervalInput').value) || 2;
            habitReminderAllDay   = allDayReminder;
            if (!allDayReminder) {
                habitReminderStart = document.getElementById('intervalStartInput').value;
                habitReminderEnd   = document.getElementById('intervalEndInput').value;
            } else {
                habitReminderStart = '00:00'; habitReminderEnd = '23:59';
            }
        }
    }

    habits.push({
        id: Date.now().toString(), name, icon, count, unit,
        dayMode: habitDayMode, dayInterval: habitDayInterval,
        reminder: habitReminder, reminderType: habitReminderType, reminderTime: habitReminderTime,
        reminderInterval: habitReminderInterval, reminderAllDay: habitReminderAllDay,
        reminderStart: habitReminderStart, reminderEnd: habitReminderEnd,
        days: activeDays, startDate
    });
    lsSet('habits', habits);
    closeModal();
    renderHabits();
    syncWithServer();
}

// =============================================
// ПРОФИЛЬ
// =============================================

function renderProfile() {
    const guestEl  = document.getElementById('profileGuest');
    const userEl   = document.getElementById('profileUser');
    const avatarEl = document.getElementById('profileAvatar');

    if (currentUser && currentUser.id && currentUser.id !== 0) {
        guestEl.style.display = 'none';
        userEl.style.display  = 'flex';
        const firstName = currentUser.first_name || '';
        const lastName  = currentUser.last_name  || '';
        document.getElementById('profileName').textContent = (firstName + ' ' + lastName).trim() || 'Пользователь';
        const usernameEl = document.getElementById('profileUsername');
        usernameEl.textContent = currentUser.username ? '@' + currentUser.username : '';
        const tzLabel = document.getElementById('timezoneLabel');
        if (tzLabel) tzLabel.textContent = getUserTimezone();

        if (currentUser.photo_url) {
            avatarEl.innerHTML = `<img src="${currentUser.photo_url}" alt="avatar">`;
        } else {
            const letter = (firstName || 'П')[0].toUpperCase();
            avatarEl.innerHTML = `<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-size:40px;font-weight:700;border-radius:50%;">${letter}</div>`;
        }

        const todayKey  = dateKey(new Date());
        const todayProg = progress[todayKey] || {};
        let doneToday   = 0;
        habits.forEach(h => { if ((todayProg[h.id] || 0) >= h.count) doneToday++; });
        document.getElementById('statTotal').textContent = habits.length;
        document.getElementById('statDone').textContent  = doneToday;
        renderNotificationSettings();
    } else {
        guestEl.style.display = 'flex';
        userEl.style.display  = 'none';
        avatarEl.innerHTML    = '';
        avatarEl.textContent  = '👤';
    }
}

function renderNotificationSettings() {
    const container = document.getElementById('notificationSettings');
    if (!container) return;
    const habitsWithReminder = habits.filter(h => h.reminder);
    if (habitsWithReminder.length === 0) {
        container.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px 0;">Нет активных напоминаний.<br>Добавьте привычку с напоминанием.</div>`;
        return;
    }
    container.innerHTML = habitsWithReminder.map(h => {
        let reminderInfo = h.reminderType === 'interval'
            ? (h.reminderAllDay ? `🔁 каждые ${h.reminderInterval} ч (весь день)` : `🔁 каждые ${h.reminderInterval} ч (${h.reminderStart}–${h.reminderEnd})`)
            : `⏰ ${h.reminderTime}`;
        let daysInfo = h.dayMode === 'interval' ? `каждые ${h.dayInterval} дн.`
            : (h.days && h.days.length > 0 ? h.days.join(', ') : 'каждый день');
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);gap:8px;">
            <span style="font-size:13px;">${h.icon} ${h.name}</span>
            <div style="text-align:right;">
                <div style="color:var(--primary);font-weight:600;font-size:12px;">${reminderInfo}</div>
                <div style="color:var(--text-muted);font-size:11px;">${daysInfo}</div>
            </div>
        </div>`;
    }).join('');
}

// =============================================
// ИНИЦИАЛИЗАЦИЯ
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    initTelegram();
    setTimeout(async function() {
        tryAutoLogin();
        renderDateLabel();
        renderHabits();
        renderProfile();
        if (currentUser && currentUser.id) {
            await loadFromServer();
            await syncWithServer();
        }
        setInterval(() => {
            if (currentUser && currentUser.id) syncWithServer();
        }, 5 * 60 * 1000);
    }, 300);
});

// =============================================
// ДРУЗЬЯ
// =============================================

function switchFriendsTab(tab, el) {
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('friendsTabChallenges').style.display  = tab === 'challenges'  ? 'block' : 'none';
    document.getElementById('friendsTabRequests').style.display    = tab === 'requests'    ? 'block' : 'none';
    document.getElementById('friendsTabFriendsList').style.display = tab === 'friendsList' ? 'block' : 'none';
}

async function renderFriendsPage() {
    // Сначала показываем то что есть в localStorage — мгновенно
    renderFriendsList();
    renderChallenges();
    renderFriendRequests();

    if (!currentUser || !currentUser.id) return;

    // Затем грузим всё параллельно
    try {
        await Promise.all([
            loadFriendRequestsQuick(),
            loadAcceptedRequestsQuick(),
            loadChallengesFromServer()
        ]);
    } catch(e) {
        console.log('Ошибка загрузки страницы друзей');
    }
}

async function loadFriendRequestsQuick() {
    if (!currentUser || !currentUser.id) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/requests/${currentUser.id}`);
        if (res.ok) {
            const data = await res.json();
            friendRequests = data.requests || [];
            renderFriendRequests();
        }
    } catch(e) {}
}

async function loadAcceptedRequestsQuick() {
    if (!currentUser || !currentUser.id) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/accepted/${currentUser.id}`);
        if (res.ok) {
            const data = await res.json();
            if (data.requests && data.requests.length > 0) {
                const fetchPromises = data.requests.map(r => {
                    const toUserId = r.toUserId;
                    if (friends.find(f => String(f.id) === String(toUserId))) return Promise.resolve();
                    return fetch(`${SERVER_URL}/api/user/${toUserId}`)
                        .then(res => res.json())
                        .then(userData => {
                            if (userData && userData.telegramId) {
                                if (!friends.find(f => String(f.id) === String(userData.telegramId))) {
                                    friends.push({
                                        id:        userData.telegramId,
                                        username:  userData.username,
                                        firstName: userData.firstName,
                                        addedAt:   new Date().toISOString()
                                    });
                                }
                            }
                        })
                        .catch(() => {});
                });
                await Promise.all(fetchPromises);
                lsSet('friends', friends);
                renderFriendsList();
            }
        }
    } catch(e) {}
}

function renderFriendRequests() {
    const list2 = document.getElementById('friendRequestsList2');
    const badge = document.getElementById('requestsBadge');

    // Считаем все входящие: заявки в друзья + входящие вызовы
    const pendingChallenges = challenges.filter(c => c.pending === true && c.status === 'active');
    const totalBadge = friendRequests.length + pendingChallenges.length;

    if (badge) {
        if (totalBadge > 0) {
            badge.style.display = 'inline';
            badge.textContent   = totalBadge;
        } else {
            badge.style.display = 'none';
        }
    }

    let html = '';

    // --- Заявки в друзья ---
    if (friendRequests.length > 0) {
        html += `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin:8px 0 6px;padding-left:4px;">👥 ЗАЯВКИ В ДРУЗЬЯ</div>`;
        html += friendRequests.map(r => `
            <div class="friend-request-card">
                <div class="friend-avatar">${(r.fromUserName || r.fromUsername || '?')[0].toUpperCase()}</div>
                <div class="friend-info">
                    <div class="friend-name">${r.fromUserName || r.fromUsername}</div>
                    <div class="friend-username">@${r.fromUsername}</div>
                </div>
                <div class="request-btns">
                    <button class="req-accept-btn" onclick="respondToRequest('${r._id}', 'accept', ${r.fromUserId}, '${r.fromUserName}', '${r.fromUsername}')">✓</button>
                    <button class="req-decline-btn" onclick="respondToRequest('${r._id}', 'decline')">✗</button>
                </div>
            </div>
        `).join('');
    }

    // --- Входящие вызовы ---
    if (pendingChallenges.length > 0) {
        html += `<div style="font-size:12px;font-weight:700;color:var(--text-muted);margin:14px 0 6px;padding-left:4px;">⚡ ВХОДЯЩИЕ ВЫЗОВЫ</div>`;
        html += pendingChallenges.map(c => `
            <div class="friend-request-card" style="border-color:#a78bfa;background:#f5f3ff;">
                <div class="friend-avatar" style="background:linear-gradient(135deg,var(--accent),#ff4757);">${(c.habitIcon || '⭐')}</div>
                <div class="friend-info">
                    <div class="friend-name">${c.habitIcon || '⭐'} ${c.habitName}</div>
                    <div class="friend-username">от @${c.friendUsername} · ${c.duration} дн.</div>
                </div>
                <div class="request-btns">
                    <button class="req-accept-btn" onclick="acceptChallenge('${c.id}')">✓</button>
                    <button class="req-decline-btn" onclick="declineChallenge('${c.id}')">✗</button>
                </div>
            </div>
        `).join('');
    }

    // --- Пусто ---
    if (friendRequests.length === 0 && pendingChallenges.length === 0) {
        html = `
            <div class="friends-empty">
                <span class="empty-icon">📩</span>
                <span>Нет входящих заявок</span>
            </div>`;
    }

    if (list2) list2.innerHTML = html;
}

async function acceptChallenge(challengeId) {
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;

    // Снимаем pending — вызов принят
    challenge.pending = false;
    lsSet('challenges', challenges);

    // Создаём привычку если её нет
    const habitId = `challenge_${challengeId}`;
    if (!habits.find(h => h.id === habitId)) {
        habits.push({
            id:            habitId,
            name:          challenge.habitName,
            icon:          challenge.habitIcon,
            count:         challenge.habitCount || 1,
            unit:          challenge.habitUnit  || 'раз',
            days:          [],
            dayMode:       'weekday',
            reminder:      false,
            startDate:     challenge.startDate,
            challengeId:   challengeId,
            fromChallenge: true
        });
        // Привязываем habitId к вызову
        challenge.habitId = habitId;
        lsSet('habits', habits);
        lsSet('challenges', challenges);
    }

    renderFriendRequests();
    renderChallenges();
    renderChallengeHabits();

    // Уведомляем сервер о принятии
    try {
        await fetch(`${SERVER_URL}/api/challenges/accept`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                challengeId,
                userId: currentUser.id
            })
        });
    } catch(e) {}

    alert(`Вызов принят! 💪 Привычка добавлена в раздел ⚡ Вызовы`);
}

async function declineChallenge(challengeId) {
    const confirmed = confirm('Отклонить вызов?');
    if (!confirmed) return;

    challenges = challenges.filter(c => c.id !== challengeId);
    lsSet('challenges', challenges);

    renderFriendRequests();
    renderChallenges();
    renderChallengeHabits();

    try {
        await fetch(`${SERVER_URL}/api/challenges/delete`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ challengeId })
        });
    } catch(e) {}
}

async function respondToRequest(requestId, action, fromUserId, fromUserName, fromUsername) {
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/respond`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ requestId, action, userId: currentUser.id })
        });
        if (res.ok) {
            const data = await res.json();
            friendRequests = friendRequests.filter(r => r._id !== requestId);
            if (action === 'accept' && data.newFriendForAcceptor) {
                if (!friends.find(f => String(f.id) === String(data.newFriendForAcceptor.id))) {
                    friends.push({
                        id:        data.newFriendForAcceptor.id,
                        username:  data.newFriendForAcceptor.username,
                        firstName: data.newFriendForAcceptor.firstName,
                        addedAt:   new Date().toISOString()
                    });
                    lsSet('friends', friends);
                }
            }
            renderFriendRequests();
            renderFriendsList();
        }
    } catch(e) { alert('Ошибка. Попробуйте позже'); }
}

async function addFriend() {
    const input    = document.getElementById('friendUsernameInput');
    const username = input.value.trim().replace('@', '');
    if (!username) return;
    if (!currentUser || !currentUser.id) {
        alert('Войдите через Telegram чтобы добавлять друзей');
        return;
    }
    if (friends.find(f => f.username?.toLowerCase() === username.toLowerCase())) {
        alert('Этот друг уже добавлен');
        return;
    }
    if (username.toLowerCase() === (currentUser.username || '').toLowerCase()) {
        alert('Нельзя добавить самого себя');
        return;
    }
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/find?username=${encodeURIComponent(username)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.found) {
                const reqRes = await fetch(`${SERVER_URL}/api/friends/request`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        fromUserId: currentUser.id,
                        toUserId:   data.telegramId
                    })
                });
                if (reqRes.ok) {
                    input.value = '';
                    alert(`Заявка отправлена @${data.username}! Ждите подтверждения 👥`);
                }
            } else {
                alert('Пользователь не найден. Попросите друга открыть HabiTracker через бота');
            }
        } else {
            alert('Ошибка поиска. Попробуйте позже');
        }
    } catch(e) { alert('Нет соединения с сервером'); }
}

function removeFriend(friendId) {
    friends = friends.filter(f => String(f.id) !== String(friendId));
    lsSet('friends', friends);
    renderFriendsList();
}

function renderFriendsList() {
    const container = document.getElementById('friendsListContainer');
    if (!container) return;
    if (friends.length === 0) {
        container.innerHTML = `
            <div class="friends-empty">
                <span class="empty-icon">👥</span>
                <span>Нет друзей</span>
                <span style="font-size:12px;margin-top:4px;">Введите @username друга выше</span>
            </div>`;
        return;
    }
    container.innerHTML = friends.map(f => `
        <div class="friend-card">
            <div class="friend-avatar">${(f.firstName || f.username || '?')[0].toUpperCase()}</div>
            <div class="friend-info">
                <div class="friend-name">${f.firstName || f.username}</div>
                <div class="friend-username">@${f.username}</div>
            </div>
            <button class="friend-remove-btn" onclick="removeFriend('${f.id}')">×</button>
        </div>
    `).join('');
}

// =============================================
// ВЫЗОВЫ
// =============================================

async function loadChallengesFromServer() {
    if (!currentUser || !currentUser.id) return;
    try {
        const res = await fetch(`${SERVER_URL}/api/challenges/${currentUser.id}`);
        if (res.ok) {
            const data = await res.json();
            if (data.challenges) {
                data.challenges.forEach(sc => {
                    const existing = challenges.find(c => c.id === sc.challengeId);
                    const iAmFrom  = String(sc.fromUserId) === String(currentUser.id);
                    if (!existing) {
                        const newChallenge = {
                            id:             sc.challengeId,
                            habitName:      sc.habitName,
                            habitIcon:      sc.habitIcon,
                            habitCount:     sc.habitCount || 1,
                            habitUnit:      sc.habitUnit  || 'раз',
                            friendId:       iAmFrom ? sc.toUserId    : sc.fromUserId,
                            friendUsername: iAmFrom ? sc.toUsername  : (sc.fromUsername || sc.fromUserName || ''),
                            friendName:     iAmFrom ? sc.toUsername  : sc.fromUserName,
                            duration:       sc.duration,
                            startDate:      sc.startDate,
                            status:         sc.status,
                            myProgress:     iAmFrom ? sc.fromProgress : sc.toProgress,
                            friendProgress: iAmFrom ? sc.toProgress   : sc.fromProgress,
                            iAmFrom,
                            fromServer:     true,
                            // Если я получатель — помечаем как pending для показа в Запросах
                            pending:        !iAmFrom
                        };
                        challenges.push(newChallenge);

                        // Привычку создаём только если вызов принят (не pending)
                        if (!iAmFrom && !newChallenge.pending) {
                            const habitExists = habits.find(h =>
                                h.name === sc.habitName && h.challengeId === sc.challengeId
                            );
                            if (!habitExists) {
                                habits.push({
                                    id:            `challenge_${sc.challengeId}`,
                                    name:          sc.habitName,
                                    icon:          sc.habitIcon,
                                    count:         sc.habitCount || 1,
                                    unit:          sc.habitUnit  || 'раз',
                                    days:          [],
                                    dayMode:       'weekday',
                                    reminder:      false,
                                    startDate:     sc.startDate,
                                    challengeId:   sc.challengeId,
                                    fromChallenge: true
                                });
                                lsSet('habits', habits);
                            }
                        }
                    } else {
                        existing.friendProgress = iAmFrom ? sc.toProgress   : sc.fromProgress;
                        existing.myProgress     = iAmFrom ? sc.fromProgress : sc.toProgress;
                        existing.status         = sc.status;
                    }
                });
                lsSet('challenges', challenges);
                renderChallenges();
                renderChallengeHabits();
                renderFriendRequests(); // обновляем вкладку запросов
            }
        }
    } catch(e) { console.log('Не удалось загрузить вызовы'); }
}

function openChallengeModal() {
    if (!currentUser || !currentUser.id) {
        alert('Войдите через Telegram чтобы создавать вызовы');
        return;
    }
    if (friends.length === 0) {
        alert('Сначала добавьте друга во вкладке "Друзья"');
        return;
    }

    challengeIconValue = '⭐';
    document.getElementById('challengeSelectedIcon').textContent = '⭐';
    document.getElementById('challengeHabitName').value  = '';
    document.getElementById('challengeHabitCount').value = '';
    document.getElementById('challengeHabitUnit').value  = 'раз';
    document.getElementById('challengeIconPicker').classList.remove('open');
    challengeIconPickerOpen = false;

    const friendSel = document.getElementById('challengeFriendSelect');
    friendSel.innerHTML = '<option value="">выберите...</option>' +
        friends.map(f => `<option value="${f.id}">@${f.username}</option>`).join('');

    const grid = document.getElementById('challengeIconGrid');
    grid.innerHTML = ICONS.map(ic =>
        `<button class="icon-option" onclick="selectChallengeIcon('${ic}')">${ic}</button>`
    ).join('');

    document.getElementById('challengeModalOverlay').classList.add('active');
}

function toggleChallengeIconPicker(e) {
    e.stopPropagation();
    challengeIconPickerOpen = !challengeIconPickerOpen;
    document.getElementById('challengeIconPicker').classList.toggle('open', challengeIconPickerOpen);
}

function selectChallengeIcon(ic) {
    challengeIconValue = ic;
    document.getElementById('challengeSelectedIcon').textContent = ic;
    document.getElementById('challengeIconPicker').classList.remove('open');
    challengeIconPickerOpen = false;
}

function closeChallengeModal() {
    document.getElementById('challengeModalOverlay').classList.remove('active');
}

function closeChallengeModalOutside(e) {
    if (e.target === document.getElementById('challengeModalOverlay')) closeChallengeModal();
}

async function saveChallenge() {
    const nameInput = document.getElementById('challengeHabitName');
    const name      = nameInput.value.trim();
    const friendId  = document.getElementById('challengeFriendSelect').value;
    const duration  = parseInt(document.getElementById('challengeDuration').value);
    const count     = parseInt(document.getElementById('challengeHabitCount').value) || 1;
    const unit      = document.getElementById('challengeHabitUnit').value;
    const icon      = challengeIconValue || '⭐';

    if (!name) {
        nameInput.style.borderColor = '#FF6584';
        setTimeout(() => nameInput.style.borderColor = 'var(--border)', 1500);
        return;
    }
    if (!friendId) { alert('Выберите друга'); return; }

    const friend    = friends.find(f => String(f.id) === String(friendId));
    const startDate = new Date().toISOString().split('T')[0];

    try {
        const res = await fetch(`${SERVER_URL}/api/challenges/create`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                fromUserId:   currentUser.id,
                fromUserName: currentUser.first_name,
                toUserId:     friend.id,
                toUsername:   friend.username,
                habitName:    name,
                habitIcon:    icon,
                habitCount:   count,
                habitUnit:    unit,
                duration,
                startDate
            })
        });
                if (res.ok) {
            const data = await res.json();
            const myHabitId = `challenge_${data.challengeId}`;
            
            // Добавляем привычку
            habits.push({
                id:            myHabitId,
                name, icon, count, unit,
                days:          [],
                dayMode:       'weekday',
                reminder:      false,
                startDate,
                challengeId:   data.challengeId,
                fromChallenge: true
            });
            lsSet('habits', habits);

            // Добавляем вызов
            challenges.push({
                id:             data.challengeId,
                habitId:        myHabitId,
                habitName:      name,
                habitIcon:      icon,
                habitCount:     count,
                habitUnit:      unit,
                friendId:       friend.id,
                friendName:     friend.firstName || friend.username,
                friendUsername: friend.username,
                duration,
                startDate,
                status:         'active',
                myProgress:     0,
                friendProgress: 0,
                iAmFrom:        true
            });
            lsSet('challenges', challenges);

            closeChallengeModal();
            
            // ✅ ИСПРАВЛЕНИЕ: рендерим обе вкладки
            renderChallenges();        // вкладка Друзья → Вызовы
            renderChallengeHabits();   // вкладка Главная → ⚡ Вызовы
            renderHabits();            // обновляем личные (на всякий случай)
            
            syncWithServer();
            alert(`Вызов отправлен @${friend.username}! 🏆`);
        }
    } catch(e) { alert('Ошибка создания вызова'); }
}

function getChallengeProgress(challenge) {
    if (!challenge.habitId) return challenge.myProgress || 0;
    const start = new Date(challenge.startDate);
    const today = new Date(); today.setHours(0,0,0,0);
    let myDone = 0;
    for (let i = 0; i < challenge.duration; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d > today) break;
        const key  = dateKey(d);
        const prog = (progress[key] || {})[challenge.habitId] || 0;
        const hab  = habits.find(h => h.id === challenge.habitId);
        if (hab && prog >= hab.count) myDone++;
    }
    return myDone;
}

function getDaysLeft(challenge) {
    const start = new Date(challenge.startDate);
    const end   = new Date(start);
    end.setDate(start.getDate() + challenge.duration);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
}

async function syncChallengeProgress() {
    if (!currentUser || !currentUser.id) return;
    for (const c of challenges) {
        if (c.status !== 'active' || !c.habitId) continue;
        const myDone = getChallengeProgress(c);
        if (myDone !== c.myProgress) {
            c.myProgress = myDone;
            try {
                await fetch(`${SERVER_URL}/api/challenges/progress`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({
                        challengeId: c.id,
                        userId:      currentUser.id,
                        progress:    myDone
                    })
                });
            } catch(e) {}
        }
    }
    lsSet('challenges', challenges);
}

function renderChallenges() {
    const container = document.getElementById('challengesList');
    if (!container) return;
    const active = challenges.filter(c => c.status === 'active' && c.pending !== true);
    if (active.length === 0) {
        const allChallenges = challenges.length;
        container.innerHTML = `
            <div class="friends-empty">
                <span class="empty-icon">🏆</span>
                <span>Нет активных вызовов</span>
                <span style="font-size:12px;margin-top:4px;">Создайте вызов с другом!</span>
                ${allChallenges > 0 ? `<button onclick="clearAllChallenges()" style="margin-top:12px;padding:8px 16px;background:#ff4757;color:#fff;border:none;border-radius:10px;font-size:13px;cursor:pointer;">🗑️ Очистить старые вызовы (${allChallenges})</button>` : ''}
            </div>`;
        return;
    }
    container.innerHTML = active.map(c => {
        const myDone     = c.habitId ? getChallengeProgress(c) : (c.myProgress || 0);
        const frDone     = c.friendProgress || 0;
        const daysLeft   = getDaysLeft(c);
        const daysPassed = c.duration - daysLeft;
        const todayKey   = dateKey(new Date());
        const todayDone  = c.habitId ? ((progress[todayKey] || {})[c.habitId] || 0) : 0;
        const todayTotal = c.habitCount || 1;
        const todayPct   = Math.min(100, Math.round((todayDone / todayTotal) * 100));
        const myPct      = Math.min(100, Math.round((myDone / c.duration) * 100));
        const frPct      = Math.min(100, Math.round((frDone / c.duration) * 100));
        const isWin      = myPct >= frPct;

        let streak = 0;
        if (c.habitId) {
            const today = new Date(); today.setHours(0,0,0,0);
            for (let i = 0; i < daysPassed; i++) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                const k    = dateKey(d);
                const done = ((progress[k] || {})[c.habitId] || 0);
                if (done >= (c.habitCount || 1)) streak++;
                else break;
            }
        }

        return `
        <div class="challenge-card">
            <div class="challenge-header">
                <span class="challenge-icon">${c.habitIcon || '⭐'}</span>
                <div class="challenge-info">
                    <div class="challenge-name">${c.habitName}</div>
                    <div class="challenge-meta">⚡ vs @${c.friendUsername} · ${daysLeft} дн. осталось</div>
                </div>
                <button class="challenge-delete-btn" onclick="deleteChallenge('${c.id}')">×</button>
            </div>
            <div class="challenge-today-block">
                <div class="challenge-today-label">📅 Сегодня: ${todayDone} / ${todayTotal} ${c.habitUnit || 'раз'}</div>
                <div class="progress-bar-wrap" style="margin-top:4px;">
                    <div class="progress-bar-fill" style="width:${todayPct}%;${todayPct>=100?'background:var(--success)':''}"></div>
                </div>
            </div>
            <div class="challenge-scores" style="margin-top:10px;">
                <div class="score-row">
                    <span class="score-label">Ты ${isWin ? '👑' : ''}</span>
                    <div class="score-bar-wrap"><div class="score-bar-fill mine" style="width:${myPct}%"></div></div>
                    <span class="score-num">${myDone}/${c.duration} дн.</span>
                </div>
                <div class="score-row">
                    <span class="score-label">@${c.friendUsername}</span>
                    <div class="score-bar-wrap"><div class="score-bar-fill friend" style="width:${frPct}%"></div></div>
                    <span class="score-num">${frDone}/${c.duration} дн.</span>
                </div>
            </div>
            <div class="challenge-stats-row">
                <div class="challenge-stat-item">
                    <span class="challenge-stat-num">${daysPassed}</span>
                    <span class="challenge-stat-label">дней прошло</span>
                </div>
                <div class="challenge-stat-item">
                    <span class="challenge-stat-num">${daysLeft}</span>
                    <span class="challenge-stat-label">осталось</span>
                </div>
                <div class="challenge-stat-item">
                    <span class="challenge-stat-num">${streak}🔥</span>
                    <span class="challenge-stat-label">серия</span>
                </div>
                <div class="challenge-stat-item">
                    <span class="challenge-stat-num">${myDone > 0 ? Math.round((myDone/Math.max(daysPassed,1))*100) : 0}%</span>
                    <span class="challenge-stat-label">выполнение</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function clearAllChallenges() {
    const confirmed = confirm(`Удалить все старые вызовы? (${challenges.length} шт.)`);
    if (!confirmed) return;

    const challengeIds = challenges.map(c => c.id);
    habits = habits.filter(h =>
        !h.fromChallenge &&
        !h.challengeId &&
        !String(h.id).startsWith('challenge_')
    );
    lsSet('habits', habits);

    for (const id of challengeIds) {
        try {
            await fetch(`${SERVER_URL}/api/challenges/delete`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ challengeId: id })
            });
        } catch(e) {}
    }

    challenges = [];
    lsSet('challenges', challenges);

    renderChallenges();
    renderChallengeHabits();
    renderHabits();

    alert('Готово! Все старые вызовы удалены ✅');
}

async function clearAllChallenges() {
    const confirmed = confirm(`Удалить все старые вызовы? (${challenges.length} шт.)`);
    if (!confirmed) return;

    // Удаляем все привычки связанные с вызовами
    const challengeIds = challenges.map(c => c.id);
    habits = habits.filter(h =>
        !h.fromChallenge &&
        !h.challengeId &&
        !String(h.id).startsWith('challenge_')
    );
    lsSet('habits', habits);

    // Удаляем с сервера
    for (const id of challengeIds) {
        try {
            await fetch(`${SERVER_URL}/api/challenges/delete`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ challengeId: id })
            });
        } catch(e) {}
    }

    challenges = [];
    lsSet('challenges', challenges);

    renderChallenges();
    renderChallengeHabits();
    renderHabits();

    alert('Готово! Все старые вызовы удалены ✅');
}

async function deleteChallenge(id) {
    const confirmed = confirm('Удалить вызов? Это действие нельзя отменить.');
    if (!confirmed) return;

    // Удаляем вызов из списка
    challenges = challenges.filter(c => c.id !== id);
    lsSet('challenges', challenges);

    // Удаляем связанную привычку из habits
    habits = habits.filter(h =>
        h.challengeId !== id &&
        h.id !== `challenge_${id}` &&
        h.id !== id
    );
    lsSet('habits', habits);

    // Обновляем обе вкладки
    renderChallenges();
    renderChallengeHabits();
    renderHabits();

    try {
        await fetch(`${SERVER_URL}/api/challenges/delete`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ challengeId: id })
        });
    } catch(e) {}
}

async function addProgressChallenge(habitId) {
    const key = dateKey(currentDate);
    if (!progress[key]) progress[key] = {};
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const current = progress[key][habitId] || 0;
    if (current < habit.count) {
        progress[key][habitId] = current + 1;
        lsSet('progress', progress);
        renderChallengeHabits();
        await syncChallengeProgress();
        await syncWithServer();
    }
}
// =============================================
// ВЫЗОВЫ НА ГЛАВНОЙ
// =============================================

function renderChallengeHabits() {
    const list = document.getElementById('challengeHabitsList');
    if (!list) return;

    const key           = dateKey(currentDate);
    const todayProgress = progress[key] || {};

    // Только принятые вызовы (не pending)
    const activeChallenges = challenges.filter(c => 
        c.status === 'active' && 
        c.pending !== true &&
        getDaysLeft(c) > 0
    );

    const challengeHabits = habits.filter(h => {
        if (!h.fromChallenge && !h.challengeId && !String(h.id).startsWith('challenge_')) return false;
        const challenge = challenges.find(c =>
            c.id === h.challengeId ||
            c.habitId === h.id ||
            c.id === String(h.id).replace('challenge_', '')
        );
        // Скрываем если вызов pending или истёк
        if (!challenge) return false;
        if (challenge.pending === true) return false;
        if (getDaysLeft(challenge) <= 0) return false;
        return true;
    });

    if (challengeHabits.length === 0 && activeChallenges.length === 0) {
        list.innerHTML = `
            <div class="empty-msg">
                <span class="empty-icon">⚡</span>
                <span>Нет активных вызовов</span>
                <span style="font-size:12px;margin-top:4px;">Создайте вызов в разделе "Друзья"</span>
            </div>`;
        return;
    }

    // Если есть вызовы без привычек
    if (challengeHabits.length === 0 && activeChallenges.length > 0) {
        list.innerHTML = activeChallenges.map(c => {
            const habitId   = c.habitId || `challenge_${c.id}`;
            const done      = todayProgress[habitId] || 0;
            const total     = c.habitCount || 1;
            const pct       = Math.min(100, Math.round((done / total) * 100));
            const completed = done >= total;
            const daysLeft  = getDaysLeft(c);
            const myDone    = getChallengeProgressById(c);
            const frDone    = c.friendProgress || 0;
            const isWin     = myDone >= frDone;
            const totalDays = c.duration || 0;

            return `
            <div class="habit-card ${completed ? 'completed' : ''} challenge-habit-card" id="card-ch-${c.id}">
                <div class="habit-card-inner">
                    <div class="habit-icon-circle">${c.habitIcon || '⭐'}</div>
                    <div class="habit-middle">
                        <div class="habit-name">${c.habitName}</div>
                        <div class="challenge-vs-label">⚡ vs @${c.friendUsername} · ${daysLeft} дн. осталось</div>
                        <div class="habit-sub">сегодня: ${done} / ${total} ${c.habitUnit || 'раз'}</div>
                        <div class="progress-bar-wrap">
                            <div class="progress-bar-fill" style="width:${pct}%;${completed ? 'background:var(--success)' : ''}"></div>
                        </div>
                        <div style="display:flex;gap:8px;margin-top:4px;">
                            <span style="font-size:10px;color:var(--primary);font-weight:600;">Ты ${isWin ? '👑' : ''}: ${myDone}/${totalDays} дн.</span>
                            <span style="font-size:10px;color:var(--accent);font-weight:600;">@${c.friendUsername}: ${frDone}/${totalDays} дн.</span>
                        </div>
                    </div>
                    <div class="card-btns">
                        <button class="plus-btn" onclick="addProgressChallengeById('${c.id}', '${habitId}', ${total})">+</button>
                    </div>
                </div>
            </div>`;
        }).join('');
        return;
    }

    list.innerHTML = challengeHabits.map(h => {
        const done      = todayProgress[h.id] || 0;
        const total     = h.count || 1;
        const pct       = Math.min(100, Math.round((done / total) * 100));
        const completed = done >= total;
        const challenge = challenges.find(c =>
            c.id === h.challengeId ||
            c.habitId === h.id ||
            c.id === String(h.id).replace('challenge_', '')
        );
        const friendLabel = challenge ? `vs @${challenge.friendUsername}` : '';
        const daysLeft    = challenge ? getDaysLeft(challenge) : 0;
        const myDone      = challenge ? getChallengeProgressById(challenge) : 0;
        const frDone      = challenge?.friendProgress || 0;
        const totalDays   = challenge?.duration || 0;
        const isWin       = myDone >= frDone;

        return `
        <div class="habit-card ${completed ? 'completed' : ''} challenge-habit-card" id="card-ch-${h.id}">
            <div class="habit-card-inner">
                <div class="habit-icon-circle">${h.icon || '⭐'}</div>
                <div class="habit-middle">
                    <div class="habit-name">${h.name}</div>
                    <div class="challenge-vs-label">⚡ ${friendLabel} · ${daysLeft} дн. осталось</div>
                    <div class="habit-sub">сегодня: ${done} / ${total} ${h.unit || 'раз'}</div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width:${pct}%;${completed ? 'background:var(--success)' : ''}"></div>
                    </div>
                    ${challenge ? `
                    <div style="display:flex;gap:8px;margin-top:4px;">
                        <span style="font-size:10px;color:var(--primary);font-weight:600;">Ты ${isWin ? '👑' : ''}: ${myDone}/${totalDays} дн.</span>
                        <span style="font-size:10px;color:var(--accent);font-weight:600;">@${challenge.friendUsername}: ${frDone}/${totalDays} дн.</span>
                    </div>` : ''}
                </div>
                <div class="card-btns">
                    <button class="plus-btn" onclick="addProgressChallenge('${h.id}')">+</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

function getChallengeProgressById(challenge) {
    const habitId = challenge.habitId || `challenge_${challenge.id}`;
    const hab = habits.find(h => h.id === habitId);
    if (!hab) return challenge.myProgress || 0;

    const start = new Date(challenge.startDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let myDone = 0;
    for (let i = 0; i < challenge.duration; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        if (d > today) break;
        const key  = dateKey(d);
        const prog = (progress[key] || {})[habitId] || 0;
        if (prog >= (hab.count || 1)) myDone++;
    }
    return myDone;
}

async function addProgressChallengeById(challengeId, habitId, total) {
    const key = dateKey(currentDate);
    if (!progress[key]) progress[key] = {};

    const current = progress[key][habitId] || 0;
    if (current < total) {
        progress[key][habitId] = current + 1;
        lsSet('progress', progress);

        const challenge = challenges.find(c => c.id === challengeId);
        if (challenge && !habits.find(h => h.id === habitId)) {
            habits.push({
                id:            habitId,
                name:          challenge.habitName,
                icon:          challenge.habitIcon,
                count:         challenge.habitCount || total,
                unit:          challenge.habitUnit  || 'раз',
                days:          [],
                dayMode:       'weekday',
                reminder:      false,
                startDate:     challenge.startDate,
                challengeId:   challengeId,
                fromChallenge: true
            });
            lsSet('habits', habits);
        }

        renderChallengeHabits();
        await syncChallengeProgress();
        await syncWithServer();
    }
}
