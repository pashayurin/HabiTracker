// ===== СЕРВЕР =====
const SERVER_URL = 'https://habitracker-server.onrender.com';

function lsGet(key, fallback) {
    try {
        const val = localStorage.getItem(key);
        if (val === null || val === undefined) return JSON.parse(fallback);
        return JSON.parse(val);
    } catch(e) {
        return JSON.parse(fallback);
    }
}
function lsSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch(e) {}
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
    } catch(e) {
        localStorage.removeItem('tgUser');
    }
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

let habits   = lsGet('habits', '[]');
let progress = lsGet('progress', '{}');
let currentUser = null;

let selectedIconValue = '⭐';
let reminderOn        = false;
let reminderTime      = '09:00';
let reminderType      = 'time';
let reminderInterval  = 2;
let reminderStart     = '08:00';
let reminderEnd       = '22:00';
let iconPickerOpen    = false;

let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

const dateState = {
    day:   new Date().getDate(),
    month: new Date().getMonth(),
    year:  new Date().getFullYear()
};

function getUserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow';
    } catch(e) {
        return 'Europe/Moscow';
    }
}

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
        if (
            window.Telegram &&
            window.Telegram.WebApp &&
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user
        ) {
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
    } catch(e) {
        console.log('⚠️ Офлайн режим');
    }
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
    } catch(e) {
        console.log('⚠️ Не удалось загрузить с сервера');
    }
}

async function subscribeToNotifications() {
    if (!currentUser || !currentUser.id) return;
    try {
        await fetch(`${SERVER_URL}/api/subscribe`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramId: currentUser.id,
                habits:     habits || []
            })
        });
    } catch(e) {}
}

function dateKey(d) {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatMainDate(d) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dateStr = d.getDate() + ' ' + MONTHS_FULL[d.getMonth()];
    if (d.getTime() === today.getTime())     return 'Сегодня, ' + dateStr;
    if (d.getTime() === yesterday.getTime()) return 'Вчера, ' + dateStr;
    if (d.getTime() === tomorrow.getTime())  return 'Завтра, ' + dateStr;
    return DAYS_FULL[d.getDay()] + ', ' + dateStr;
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

function showPage(name, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    el.classList.add('active');
    if (name === 'profile') renderProfile();
}

function renderHabits() {
    const list = document.getElementById('habitsList');
    if (!list) return;

    const key           = dateKey(currentDate);
    const todayProgress = progress[key] || {};
    const currentDay    = DAY_KEYS[currentDate.getDay()];

    const filtered = habits.filter(h => {
        if (!h.days || h.days.length === 0) return true;
        return h.days.includes(currentDay);
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
                    <button class="plus-btn" onclick="addProgress('${h.id}')">+</button>
                    <button class="delete-btn" onclick="deleteHabit('${h.id}')">×</button>
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
    habits = habits.filter(h => h.id !== id);
    lsSet('habits', habits);
    renderHabits();
    syncWithServer();
}

function openModal() {
    const now       = new Date();
    dateState.day   = now.getDate();
    dateState.month = now.getMonth();
    dateState.year  = now.getFullYear();
    updateDateDisplay();

    document.getElementById('habitName').value  = '';
    document.getElementById('habitCount').value = '';
    document.getElementById('habitUnit').value  = 'раз';

    selectedIconValue = '⭐';
    document.getElementById('selectedIcon').textContent = '⭐';

    reminderOn       = false;
    reminderTime     = '09:00';
    reminderType     = 'time';
    reminderInterval = 2;
    reminderStart    = '08:00';
    reminderEnd      = '22:00';

    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent = 'нет';
    document.getElementById('reminderTimeWrap').style.display = 'none';

    document.getElementById('typeBtnTime').classList.add('active');
    document.getElementById('typeBtnInterval').classList.remove('active');
    document.getElementById('reminderExactTime').style.display    = 'block';
    document.getElementById('reminderIntervalWrap').style.display = 'none';
    document.getElementById('reminderTimeInput').value     = '09:00';
    document.getElementById('reminderIntervalInput').value = '2';
    document.getElementById('intervalStartInput').value    = '08:00';
    document.getElementById('intervalEndInput').value      = '22:00';

    document.querySelectorAll('.day-btn:not(.day-btn-all)').forEach(b => b.classList.remove('active'));

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
        const max     = DAYS_IN_MONTH[dateState.month];
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

function toggleDay(btn) {
    btn.classList.toggle('active');
}

function toggleAllDays(btn) {
    const dayBtns   = document.querySelectorAll('.day-btn:not(.day-btn-all)');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => {
        if (allActive) b.classList.remove('active');
        else b.classList.add('active');
    });
}

function toggleReminder() {
    reminderOn = !reminderOn;
    document.getElementById('reminderToggle').classList.toggle('on', reminderOn);
    document.getElementById('toggleLabel').textContent = reminderOn ? 'да' : 'нет';
    document.getElementById('reminderTimeWrap').style.display = reminderOn ? 'block' : 'none';
}

function setReminderTime(val) {
    reminderTime = val;
}

function setReminderType(type) {
    reminderType = type;
    document.getElementById('typeBtnTime').classList.toggle('active', type === 'time');
    document.getElementById('typeBtnInterval').classList.toggle('active', type === 'interval');
    document.getElementById('reminderExactTime').style.display    = type === 'time'     ? 'block' : 'none';
    document.getElementById('reminderIntervalWrap').style.display = type === 'interval' ? 'block' : 'none';
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

    const activeDays = [...document.querySelectorAll('.day-btn:not(.day-btn-all).active')]
        .map(b => b.textContent);

    const startMonth = String(dateState.month + 1).padStart(2, '0');
    const startDay   = String(dateState.day).padStart(2, '0');

    let habitReminder     = false;
    let habitReminderTime = null;
    let habitReminderType = null;
    let habitInterval     = null;
    let habitIntStart     = null;
    let habitIntEnd       = null;

    if (reminderOn) {
        habitReminder     = true;
        habitReminderType = reminderType;
        if (reminderType === 'time') {
            habitReminderTime = document.getElementById('reminderTimeInput').value;
        } else {
            habitInterval = parseInt(document.getElementById('reminderIntervalInput').value) || 2;
            habitIntStart = document.getElementById('intervalStartInput').value;
            habitIntEnd   = document.getElementById('intervalEndInput').value;
        }
    }

    const habit = {
        id:               Date.now().toString(),
        name,
        icon,
        count,
        unit,
        reminder:         habitReminder,
        reminderType:     habitReminderType,
        reminderTime:     habitReminderTime,
        reminderInterval: habitInterval,
        intervalStart:    habitIntStart,
        intervalEnd:      habitIntEnd,
        days:             activeDays,
        startDate:        `${dateState.year}-${startMonth}-${startDay}`
    };

    habits.push(habit);
    lsSet('habits', habits);
    closeModal();
    renderHabits();
    syncWithServer();
    if (reminderOn) subscribeToNotifications();
}

function renderProfile() {
    const guestEl  = document.getElementById('profileGuest');
    const userEl   = document.getElementById('profileUser');
    const avatarEl = document.getElementById('profileAvatar');

    if (currentUser && currentUser.id && currentUser.id !== 0) {
        guestEl.style.display = 'none';
        userEl.style.display  = 'flex';

        const firstName = currentUser.first_name || '';
        const lastName  = currentUser.last_name  || '';
        const fullName  = (firstName + ' ' + lastName).trim();

        document.getElementById('profileName').textContent = fullName || 'Пользователь';

        const usernameEl = document.getElementById('profileUsername');
        usernameEl.textContent = currentUser.username ? '@' + currentUser.username : '';

        const tzLabel = document.getElementById('timezoneLabel');
        if (tzLabel) tzLabel.textContent = getUserTimezone();

        if (currentUser.photo_url) {
            avatarEl.innerHTML = `<img src="${currentUser.photo_url}" alt="avatar">`;
        } else {
            const letter = (firstName || 'П')[0].toUpperCase();
            avatarEl.innerHTML = `
                <div style="
                    width:100%;height:100%;
                    background:linear-gradient(135deg,var(--primary),var(--primary-dark));
                    color:#fff;
                    display:flex;align-items:center;justify-content:center;
                    font-size:40px;font-weight:700;border-radius:50%;
                ">${letter}</div>`;
        }

        const todayKey  = dateKey(new Date());
        const todayProg = progress[todayKey] || {};
        let doneToday   = 0;
        habits.forEach(h => {
            if ((todayProg[h.id] || 0) >= h.count) doneToday++;
        });

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
        container.innerHTML = `
            <div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px 0;">
                Нет активных напоминаний.<br>
                Добавьте привычку с напоминанием.
            </div>`;
        return;
    }

    container.innerHTML = habitsWithReminder.map(h => {
        let reminderInfo = '';
        if (h.reminderType === 'interval') {
            reminderInfo = `🔁 каждые ${h.reminderInterval} ч (${h.intervalStart}–${h.intervalEnd})`;
        } else {
            reminderInfo = `⏰ ${h.reminderTime}`;
        }
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:8px 0;border-bottom:1px solid var(--border);">
            <span>${h.icon} ${h.name}</span>
            <span style="color:var(--primary);font-weight:600;font-size:12px;">${reminderInfo}</span>
        </div>`;
    }).join('');
}

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
