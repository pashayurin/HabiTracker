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

let habits      = lsGet('habits', '[]');
let progress    = lsGet('progress', '{}');
let currentUser = null;
let friends    = lsGet('friends', '[]');
let challenges = lsGet('challenges', '[]');
let selectedIconValue = '⭐';
let reminderOn        = false;
let reminderTime      = '09:00';
let reminderType      = 'time';
let reminderInterval  = 2;
let reminderStart     = '08:00';
let reminderEnd       = '22:00';
let allDayReminder    = false;
let iconPickerOpen    = false;

let dayMode        = 'weekday';
let dayIntervalVal = 2;

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
        console.log('Офлайн режим');
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
        console.log('Не удалось загрузить с сервера');
    }
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
    if (name === 'friends') renderFriendsPage();
}

function isHabitActiveOnDate(habit, date) {
    if (habit.dayMode === 'interval' && habit.dayInterval) {
        const start = habit.startDate ? new Date(habit.startDate) : new Date();
        start.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return false;
        return diffDays % habit.dayInterval === 0;
    }
    if (!habit.days || habit.days.length === 0) return true;
    const currentDay = DAY_KEYS[date.getDay()];
    return habit.days.includes(currentDay);
}

function renderHabits() {
    const list = document.getElementById('habitsList');
    if (!list) return;
    const key           = dateKey(currentDate);
    const todayProgress = progress[key] || {};
    const filtered      = habits.filter(h => isHabitActiveOnDate(h, currentDate));
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
    if (!isNaN(val)) {
        dayIntervalVal = Math.max(2, Math.min(365, val));
    }
}

function fixDayIntervalInput(input) {
    let val = parseInt(input.value);
    if (isNaN(val) || val < 2) val = 2;
    if (val > 365) val = 365;
    dayIntervalVal = val;
    input.value = val;
}

function toggleDay(btn) {
    btn.classList.toggle('active');
}

function toggleAllDays(btn) {
    const dayBtns   = document.querySelectorAll('.day-circle');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => {
        if (allActive) b.classList.remove('active');
        else b.classList.add('active');
    });
    btn.textContent = allActive ? 'Выбрать все' : 'Снять все';
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
    allDayReminder   = false;

    dayMode        = 'weekday';
    dayIntervalVal = 2;

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

function toggleReminder() {
    reminderOn = !reminderOn;
    document.getElementById('reminderToggle').classList.toggle('on', reminderOn);
    document.getElementById('toggleLabel').textContent        = reminderOn ? 'да' : 'нет';
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

    const startMonth = String(dateState.month + 1).padStart(2, '0');
    const startDay   = String(dateState.day).padStart(2, '0');
    const startDate  = `${dateState.year}-${startMonth}-${startDay}`;

    let activeDays       = [];
    let habitDayMode     = dayMode;
    let habitDayInterval = null;

    if (dayMode === 'weekday') {
        activeDays = [...document.querySelectorAll('.day-circle.active')]
            .map(b => b.getAttribute('data-day'));
    } else {
        const inputVal   = parseInt(document.getElementById('dayIntervalValue').value) || 2;
        habitDayInterval = Math.max(2, Math.min(365, inputVal));
        dayIntervalVal   = habitDayInterval;
    }

    let habitReminder         = false;
    let habitReminderTime     = null;
    let habitReminderType     = null;
    let habitReminderInterval = null;
    let habitReminderStart    = null;
    let habitReminderEnd      = null;
    let habitReminderAllDay   = false;

    if (reminderOn) {
        habitReminder     = true;
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
                habitReminderStart = '00:00';
                habitReminderEnd   = '23:59';
            }
        }
    }

    const habit = {
        id:               Date.now().toString(),
        name,
        icon,
        count,
        unit,
        dayMode:          habitDayMode,
        dayInterval:      habitDayInterval,
        reminder:         habitReminder,
        reminderType:     habitReminderType,
        reminderTime:     habitReminderTime,
        reminderInterval: habitReminderInterval,
        reminderAllDay:   habitReminderAllDay,
        reminderStart:    habitReminderStart,
        reminderEnd:      habitReminderEnd,
        days:             activeDays,
        startDate
    };

    habits.push(habit);
    lsSet('habits', habits);
    closeModal();
    renderHabits();
    syncWithServer();
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
            if (h.reminderAllDay) {
                reminderInfo = `🔁 каждые ${h.reminderInterval} ч (весь день)`;
            } else {
                reminderInfo = `🔁 каждые ${h.reminderInterval} ч (${h.reminderStart}–${h.reminderEnd})`;
            }
        } else {
            reminderInfo = `⏰ ${h.reminderTime}`;
        }

        let daysInfo = '';
        if (h.dayMode === 'interval') {
            daysInfo = `каждые ${h.dayInterval} дн.`;
        } else if (h.days && h.days.length > 0) {
            daysInfo = h.days.join(', ');
        } else {
            daysInfo = 'каждый день';
        }

        return `
        <div style="
            display:flex;
            align-items:center;
            justify-content:space-between;
            padding:8px 0;
            border-bottom:1px solid var(--border);
            gap:8px;
        ">
            <span style="font-size:13px;">${h.icon} ${h.name}</span>
            <div style="text-align:right;">
                <div style="color:var(--primary);font-weight:600;font-size:12px;">${reminderInfo}</div>
                <div style="color:var(--text-muted);font-size:11px;">${daysInfo}</div>
            </div>
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
// =============================================
// ===== ДРУЗЬЯ =====
// =============================================

function switchFriendsTab(tab, el) {
    document.querySelectorAll('.friends-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('friendsTabChallenges').style.display  = tab === 'challenges'  ? 'block' : 'none';
    document.getElementById('friendsTabFriendsList').style.display = tab === 'friendsList' ? 'block' : 'none';
}

function renderFriendsPage() {
    renderChallenges();
    renderFriendsList();
}

async function addFriend() {
    const input    = document.getElementById('friendUsernameInput');
    const username = input.value.trim().replace('@', '');
    if (!username) return;
    if (!currentUser || !currentUser.id) {
        alert('Войдите через Telegram чтобы добавлять друзей');
        return;
    }
    if (friends.find(f => f.username === username)) {
        alert('Этот друг уже добавлен');
        return;
    }
    try {
        const res = await fetch(`${SERVER_URL}/api/friends/find?username=${encodeURIComponent(username)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.found) {
                friends.push({
                    id:        data.telegramId,
                    username:  data.username,
                    firstName: data.firstName,
                    addedAt:   new Date().toISOString()
                });
                lsSet('friends', friends);
                input.value = '';
                renderFriendsList();
                await fetch(`${SERVER_URL}/api/friends/add`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ userId: currentUser.id, friendId: data.telegramId })
                });
            } else {
                alert('Пользователь не найден. Попросите друга открыть HabiTracker через бота');
            }
        } else {
            alert('Ошибка поиска. Попробуйте позже');
        }
    } catch(e) {
        alert('Нет соединения с сервером');
    }
}

function removeFriend(friendId) {
    friends = friends.filter(f => f.id !== friendId);
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
            <button class="friend-remove-btn" onclick="removeFriend(${f.id})">×</button>
        </div>
    `).join('');
}

function openChallengeModal() {
    if (!currentUser || !currentUser.id) {
        alert('Войдите через Telegram чтобы создавать вызовы');
        return;
    }
    if (habits.length === 0) {
        alert('Сначала добавьте хотя бы одну привычку');
        return;
    }
    if (friends.length === 0) {
        alert('Сначала добавьте друга во вкладке "Друзья"');
        return;
    }
    const habitSel = document.getElementById('challengeHabitSelect');
    habitSel.innerHTML = '<option value="">выберите...</option>' +
        habits.map(h => `<option value="${h.id}">${h.icon} ${h.name}</option>`).join('');

    const friendSel = document.getElementById('challengeFriendSelect');
    friendSel.innerHTML = '<option value="">выберите...</option>' +
        friends.map(f => `<option value="${f.id}">@${f.username}</option>`).join('');

    document.getElementById('challengeModalOverlay').classList.add('active');
}

function closeChallengeModal() {
    document.getElementById('challengeModalOverlay').classList.remove('active');
}

function closeChallengeModalOutside(e) {
    if (e.target === document.getElementById('challengeModalOverlay')) closeChallengeModal();
}

async function saveChallenge() {
    const habitId   = document.getElementById('challengeHabitSelect').value;
    const friendId  = document.getElementById('challengeFriendSelect').value;
    const duration  = parseInt(document.getElementById('challengeDuration').value);

    if (!habitId || !friendId) {
        alert('Выберите привычку и друга');
        return;
    }

    const habit  = habits.find(h => h.id === habitId);
    const friend = friends.find(f => String(f.id) === String(friendId));

    const challenge = {
        id:        Date.now().toString(),
        habitId,
        habitName: habit.name,
        habitIcon: habit.icon,
        friendId:  friend.id,
        friendName: friend.firstName || friend.username,
        friendUsername: friend.username,
        duration,
        startDate: new Date().toISOString().split('T')[0],
        status:    'active',
        myProgress:     0,
        friendProgress: 0
    };

    challenges.push(challenge);
    lsSet('challenges', challenges);

    try {
        await fetch(`${SERVER_URL}/api/challenges/create`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                challengeId:    challenge.id,
                fromUserId:     currentUser.id,
                fromUserName:   currentUser.first_name,
                toUserId:       friend.id,
                toUsername:     friend.username,
                habitName:      habit.name,
                habitIcon:      habit.icon,
                duration
            })
        });
    } catch(e) {
        console.log('Не удалось отправить вызов на сервер');
    }

    closeChallengeModal();
    renderChallenges();
    alert(`Вызов отправлен @${friend.username}! 🏆`);
}

function getChallengeProgress(challenge) {
    const start  = new Date(challenge.startDate);
    const today  = new Date();
    today.setHours(0,0,0,0);
    let myDone   = 0;
    const daysTotal = challenge.duration;

    for (let i = 0; i < daysTotal; i++) {
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
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff  = Math.ceil((end - today) / (1000*60*60*24));
    return Math.max(0, diff);
}

function renderChallenges() {
    const container = document.getElementById('challengesList');
    if (!container) return;

    const active = challenges.filter(c => c.status === 'active');

    if (active.length === 0) {
        container.innerHTML = `
            <div class="friends-empty">
                <span class="empty-icon">🏆</span>
                <span>Нет активных вызовов</span>
                <span style="font-size:12px;margin-top:4px;">Создайте вызов с другом!</span>
            </div>`;
        return;
    }

    container.innerHTML = active.map(c => {
        const myDone   = getChallengeProgress(c);
        const daysLeft = getDaysLeft(c);
        const myPct    = Math.min(100, Math.round((myDone / c.duration) * 100));
        const frPct    = Math.min(100, Math.round(((c.friendProgress || 0) / c.duration) * 100));
        const isWin    = myPct >= frPct;

        return `
        <div class="challenge-card">
            <div class="challenge-header">
                <span class="challenge-icon">${c.habitIcon}</span>
                <div class="challenge-info">
                    <div class="challenge-name">${c.habitName}</div>
                    <div class="challenge-meta">vs @${c.friendUsername} · ${daysLeft} дн. осталось</div>
                </div>
                <button class="challenge-delete-btn" onclick="deleteChallenge('${c.id}')">×</button>
            </div>
            <div class="challenge-scores">
                <div class="score-row">
                    <span class="score-label">Ты ${isWin ? '👑' : ''}</span>
                    <div class="score-bar-wrap">
                        <div class="score-bar-fill mine" style="width:${myPct}%"></div>
                    </div>
                    <span class="score-num">${myDone}/${c.duration}</span>
                </div>
                <div class="score-row">
                    <span class="score-label">@${c.friendUsername}</span>
                    <div class="score-bar-wrap">
                        <div class="score-bar-fill friend" style="width:${frPct}%"></div>
                    </div>
                    <span class="score-num">${c.friendProgress || 0}/${c.duration}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function deleteChallenge(id) {
    challenges = challenges.filter(c => c.id !== id);
    lsSet('challenges', challenges);
    renderChallenges();
}
