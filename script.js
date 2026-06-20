// ===== TELEGRAM =====
if (window.Telegram && window.Telegram.WebApp) {
    window.Telegram.WebApp.expand();
}

// ===== КОНСТАНТЫ =====
const MONTHS = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
const MONTHS_FULL = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAYS_RU = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
const DAYS_FULL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const DAY_KEYS = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];

// ===== СОСТОЯНИЕ =====
let habits = JSON.parse(localStorage.getItem('habits') || '[]');
let selectedIconValue = 'A';
let reminderOn = false;
let iconPickerOpen = false;

// Текущая выбранная дата на главном экране
let currentDate = new Date();
currentDate.setHours(0,0,0,0);

// Дата в модалке
const dateState = {
    day: new Date().getDate(),
    month: new Date().getMonth(),
    year: new Date().getFullYear()
};

// ===== ИКОНКИ =====
const ICONS = [
    '🏃','💪','📚','💧','🧘','🥗','😴','✍️',
    '🎯','🎨','🎸','🏊','🚴','🧹','💊','🐶',
    '🌅','🧠','🫁','🦷','🚶','🍎','☕','🧴',
    '📝','🎤','🏋️','🤸','🌿','💤','🥤','🧘',
    '📖','🖊️','🎹','🏄','🧗','🌙','⭐','🔥'
];

// ===== ПРОГРЕСС =====
let progress = JSON.parse(localStorage.getItem('progress') || '{}');

// ===== ПОЛЬЗОВАТЕЛЬ =====
let currentUser = JSON.parse(localStorage.getItem('tgUser') || 'null');

// ===== НАВИГАЦИЯ =====
function showPage(name, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    el.classList.add('active');
    if (name === 'profile') renderProfile();
}

// ===== ДАТА ГЛАВНОГО ЭКРАНА =====
function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatMainDate(d) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dayName = DAYS_FULL[d.getDay()];
    const dateStr = d.getDate() + ' ' + MONTHS_FULL[d.getMonth()];

    if (d.getTime() === today.getTime()) return 'Сегодня, ' + dateStr;
    if (d.getTime() === yesterday.getTime()) return 'Вчера, ' + dateStr;
    if (d.getTime() === tomorrow.getTime()) return 'Завтра, ' + dateStr;
    return dayName + ', ' + dateStr;
}

function renderDateLabel() {
    document.getElementById('mainDateLabel').textContent = formatMainDate(currentDate);
}

function changeMainDate(dir) {
    currentDate.setDate(currentDate.getDate() + dir);
    renderDateLabel();
    renderHabits();
}

// ===== РЕНДЕР ПРИВЫЧЕК =====
function renderHabits() {
    const list = document.getElementById('habitsList');
    const key = dateKey(currentDate);
    const todayProgress = progress[key] || {};
    const dayIndex = currentDate.getDay();
    const currentDay = DAY_KEYS[dayIndex];

    const filtered = habits.filter(h => {
        if (!h.days || h.days.length === 0) return true;
        return h.days.includes(currentDay);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="color:#aaa;font-style:italic;font-size:14px;padding:20px 0;">Нет привычек на этот день</p>';
        return;
    }

    list.innerHTML = filtered.map(h => {
        const done = todayProgress[h.id] || 0;
        const total = h.count || 1;
        const pct = Math.min(100, Math.round((done / total) * 100));
        const completed = done >= total;
        return `
        <div class="habit-card ${completed ? 'completed' : ''}" id="card-${h.id}">
            <div class="habit-card-inner">
                <div class="habit-icon-circle">${h.icon || '⭐'}</div>
                <div class="habit-middle">
                    <div class="habit-name">${h.name}</div>
                    <div class="habit-sub">${done} / ${total} ${h.unit || 'раз'}</div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar-fill" style="width:${pct}%;background:${completed ? '#4CAF50' : '#000'}"></div>
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
        localStorage.setItem('progress', JSON.stringify(progress));
        renderHabits();
    }
}

function deleteHabit(id) {
    habits = habits.filter(h => h.id !== id);
    localStorage.setItem('habits', JSON.stringify(habits));
    renderHabits();
}

// ===== МОДАЛКА =====
function openModal() {
    const now = new Date();
    dateState.day = now.getDate();
    dateState.month = now.getMonth();
    dateState.year = now.getFullYear();
    updateDateDisplay();

    document.getElementById('habitName').value = '';
    document.getElementById('habitCount').value = '';
    document.getElementById('habitUnit').value = 'раз';

    selectedIconValue = '⭐';
    document.getElementById('selectedIcon').textContent = '⭐';

    reminderOn = false;
    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent = 'нет';

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

// ===== ИКОНКИ В МОДАЛКЕ =====
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

// ===== ДАТА В МОДАЛКЕ =====
const DAYS_IN_MONTH = [31,28,29,31,30,31,30,31,31,30,31,30,31];

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
    document.getElementById('startDay').textContent = dateState.day;
    document.getElementById('startMonth').textContent = MONTHS[dateState.month];
    document.getElementById('startYear').textContent = dateState.year;
}

// ===== ДНИ НЕДЕЛИ =====
function toggleDay(btn) {
    btn.classList.toggle('active');
}

function toggleAllDays(btn) {
    const dayBtns = document.querySelectorAll('.day-btn:not(.day-btn-all)');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => {
        if (allActive) b.classList.remove('active');
        else b.classList.add('active');
    });
}

// ===== НАПОМИНАНИЕ =====
function toggleReminder() {
    reminderOn = !reminderOn;
    const toggle = document.getElementById('reminderToggle');
    const label = document.getElementById('toggleLabel');
    toggle.classList.toggle('on', reminderOn);
    label.textContent = reminderOn ? 'да' : 'нет';
}

// ===== СОХРАНИТЬ ПРИВЫЧКУ =====
function saveHabit() {
    const nameInput = document.getElementById('habitName');
    const name = nameInput.value.trim();

    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#f00';
        setTimeout(() => nameInput.style.borderColor = '#ccc', 1500);
        return;
    }

    const count = parseInt(document.getElementById('habitCount').value) || 1;
    const unit = document.getElementById('habitUnit').value;
    const icon = selectedIconValue || '⭐';

    const activeDays = [...document.querySelectorAll('.day-btn:not(.day-btn-all).active')]
        .map(b => b.textContent);

    const startMonth = String(dateState.month + 1).padStart(2, '0');
    const startDay = String(dateState.day).padStart(2, '0');

    const habit = {
        id: Date.now().toString(),
        name,
        icon,
        count,
        unit,
        reminder: reminderOn,
        days: activeDays,
        startDate: `${dateState.year}-${startMonth}-${startDay}`
    };

    habits.push(habit);
    localStorage.setItem('habits', JSON.stringify(habits));
    closeModal();
    renderHabits();
}

// ===== ПРОФИЛЬ =====
function renderProfile() {
    const guest = document.getElementById('profileGuest');
    const user = document.getElementById('profileUser');
    const avatar = document.getElementById('profileAvatar');

    if (currentUser) {
        guest.style.display = 'none';
        user.style.display = 'flex';
        user.style.flexDirection = 'column';
        user.style.alignItems = 'center';
        user.style.gap = '12px';

        const fullName = ((currentUser.first_name || '') + ' ' + (currentUser.last_name || '')).trim();
        document.getElementById('profileName').textContent = fullName || 'Пользователь';
        document.getElementById('profileUsername').textContent =
            currentUser.username ? '@' + currentUser.username : '';

        if (currentUser.photo_url) {
            avatar.innerHTML = '<img src="' + currentUser.photo_url + '" alt="avatar">';
        } else {
            avatar.textContent = '👤';
        }

        const today = dateKey(new Date());
        const todayProg = progress[today] || {};
        let doneToday = 0;
        habits.forEach(h => {
            if ((todayProg[h.id] || 0) >= h.count) doneToday++;
        });

        document.getElementById('statTotal').textContent = habits.length;
        document.getElementById('statDone').textContent = doneToday;

    } else {
        guest.style.display = 'flex';
        guest.style.flexDirection = 'column';
        guest.style.alignItems = 'center';
        guest.style.gap = '12px';
        user.style.display = 'none';
        avatar.textContent = '👤';
    }
}

function fakeTelegramLogin() {
    currentUser = {
        id: 123456789,
        first_name: 'Пользователь',
        last_name: '',
        username: 'username',
        photo_url: null
    };
    localStorage.setItem('tgUser', JSON.stringify(currentUser));
    renderProfile();
}

function onTelegramAuth(user) {
    currentUser = user;
    localStorage.setItem('tgUser', JSON.stringify(currentUser));
    renderProfile();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('tgUser');
    renderProfile();
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    renderDateLabel();
    renderHabits();
    if (currentUser) renderProfile();
});
