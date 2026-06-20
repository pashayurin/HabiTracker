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
    '🌅','🧠','🫁','🦷','🚶','🍎','☕','🧘',
    '📝','🎤','🏋️','🤸','🌿','💤','🥤','🧴',
    '📖','🖊️','🎹','🏄','🧗','🌙','⭐','🔥'
];

// ===== ДАННЫЕ =====
let habits = JSON.parse(localStorage.getItem('habits') || '[]');
let progress = JSON.parse(localStorage.getItem('progress') || '{}');
let currentUser = JSON.parse(localStorage.getItem('tgUser') || 'null');

// ===== ДАТА ГЛАВНОГО ЭКРАНА =====
let mainDate = new Date();
mainDate.setHours(0,0,0,0);

function dateKey(d) {
    return d.toISOString().slice(0,10);
}

function formatMainDate(d) {
    const days = ['

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.onload = function () {
    updateDateDisplay();
    updateMainDateBar();
    buildIconGrid();
    renderAllHabits();
};

// ===== ГЛАВНЫЙ ЭКРАН: СТРОКА С ДАТОЙ =====
function updateMainDateBar() {
    const d = currentDate;
    const dayOfWeek = DAYS_FULL[d.getDay()];
    const dateStr = d.getDate() + ' ' + MONTHS_FULL[d.getMonth()] + ' ' + d.getFullYear();
    document.getElementById('mainDateLabel').textContent = dayOfWeek + ', ' + dateStr;
    renderAllHabits();
}

function changeMainDate(delta) {
    currentDate.setDate(currentDate.getDate() + delta);
    updateMainDateBar();
}

// ===== ОТРИСОВКА ПРИВЫЧЕК ПО ВЫБРАННОМУ ДНЮ =====
function renderAllHabits() {
    const list = document.getElementById('habitsList');
    list.innerHTML = '';

    const dayIndex = currentDate.getDay(); // 0=ВС,1=ПН,...
    const currentDayKey = DAY_KEYS[dayIndex];

    // Дата начала привычки не позже текущей даты
    const filtered = habits.filter(h => {
        // Проверяем день недели
        if (h.days && h.days.length > 0) {
            if (!h.days.includes(currentDayKey)) return false;
        }
        // Проверяем дату начала
        const start = new Date(h.startYear, h.startMonth, h.startDay);
        start.setHours(0,0,0,0);
        if (currentDate < start) return false;
        return true;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div style="text-align:center;color:#aaa;font-style:italic;padding:30px 0;">Нет привычек на этот день</div>';
        return;
    }

    filtered.forEach(habit => renderHabit(habit));
}

// ===== ПОСТРОИТЬ СЕТКУ ИКОНОК =====
function buildIconGrid() {
    const grid = document.getElementById('iconGrid');
    grid.innerHTML = '';
    ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'icon-option';
        btn.textContent = icon;
        btn.onclick = function(e) {
            e.stopPropagation();
            selectedIconValue = icon;
            document.getElementById('selectedIcon').textContent = icon;
            closeIconPicker();
        };
        grid.appendChild(btn);
    });
}

// ===== ДАТА В МОДАЛКЕ =====
function changeDate(type, delta) {
    if (type === 'day') {
        const max = new Date(dateState.year, dateState.month + 1, 0).getDate();
        dateState.day += delta;
        if (dateState.day < 1) dateState.day = max;
        if (dateState.day > max) dateState.day = 1;
    }
    if (type === 'month') {
        dateState.month += delta;
        if (dateState.month < 0) dateState.month = 11;
        if (dateState.month > 11) dateState.month = 0;
        const max = new Date(dateState.year, dateState.month + 1, 0).getDate();
        if (dateState.day > max) dateState.day = max;
    }
    if (type === 'year') {
        const curYear = new Date().getFullYear();
        dateState.year += delta;
        if (dateState.year < curYear) dateState.year = curYear;
        if (dateState.year > curYear + 10) dateState.year = curYear + 10;
    }
    updateDateDisplay();
}

function updateDateDisplay() {
    document.getElementById('startDay').textContent = dateState.day;
    document.getElementById('startMonth').textContent = MONTHS[dateState.month];
    document.getElementById('startYear').textContent = dateState.year;
}

// ===== ПИКЕР ИКОНОК =====
function toggleIconPicker(e) {
    e.stopPropagation();
    iconPickerOpen = !iconPickerOpen;
    document.getElementById('iconPicker').classList.toggle('open', iconPickerOpen);
}

function closeIconPicker() {
    iconPickerOpen = false;
    document.getElementById('iconPicker').classList.remove('open');
}

// ===== МОДАЛКА =====
function openModal() {
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    closeIconPicker();
    resetModal();
}

function closeModalOutside(event) {
    if (event.target === document.getElementById('modalOverlay')) {
        closeModal();
    }
    if (!event.target.closest('#iconPicker') && !event.target.closest('#iconCircle')) {
        closeIconPicker();
    }
}

function resetModal() {
    document.getElementById('habitName').value = '';
    document.getElementById('habitCount').value = '';
    document.getElementById('habitUnit').value = 'мин';
    selectedIconValue = 'A';
    document.getElementById('selectedIcon').textContent = 'A';
    reminderOn = false;
    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent = 'нет';
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    dateState.day = new Date().getDate();
    dateState.month = new Date().getMonth();
    dateState.year = new Date().getFullYear();
    updateDateDisplay();
}

// ===== ДНИ НЕДЕЛИ =====
function toggleDay(btn) {
    btn.classList.toggle('active');
}

function toggleAllDays(btn) {
    const dayBtns = document.querySelectorAll('.day-btn:not(.day-btn-all)');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => b.classList.toggle('active', !allActive));
    btn.classList.toggle('active', !allActive);
}

// ===== НАПОМИНАНИЯ =====
function toggleReminder() {
    reminderOn = !reminderOn;
    document.getElementById('reminderToggle').classList.toggle('on', reminderOn);
    document.getElementById('toggleLabel').textContent = reminderOn ? 'да' : 'нет';
}

// ===== СОХРАНИТЬ ПРИВЫЧКУ =====
function saveHabit() {
    const name = document.getElementById('habitName').value.trim();
    if (!name) {
        alert('Введите название привычки!');
        return;
    }

    const goalCount = parseInt(document.getElementById('habitCount').value) || 1;
    const unit = document.getElementById('habitUnit').value;

    // Собираем выбранные дни
    const selectedDays = [];
    document.querySelectorAll('.day-btn:not(.day-btn-all)').forEach(b => {
        if (b.classList.contains('active')) selectedDays.push(b.textContent.trim());
    });

    const habit = {
        id: Date.now(),
        name: name,
        icon: selectedIconValue,
        goal: goalCount,
        unit: unit,
        current: 0,
        days: selectedDays,
        startDay: dateState.day,
        startMonth: dateState.month,
        startYear: dateState.year,
        // прогресс по датам: { 'YYYY-MM-DD': число }
        progress: {}
    };

    habits.push(habit);
    saveToStorage();
    closeModal();
    renderAllHabits();
}

// ===== СОХРАНЕНИЕ В LOCALSTORAGE =====
function saveToStorage() {
    localStorage.setItem('habits', JSON.stringify(habits));
}

// ===== УДАЛИТЬ ПРИВЫЧКУ =====
function deleteHabit(id) {
    if (!confirm('Удалить привычку?')) return;
    habits = habits.filter(h => h.id !== id);
    saveToStorage();
    renderAllHabits();
}

// ===== ОТРИСОВКА ОДНОЙ КАРТОЧКИ =====
function renderHabit(habit) {
    const list = document.getElementById('habitsList');
    const dateKey = getDateKey(currentDate);

    // Прогресс для текущего дня
    const current = (habit.progress && habit.progress[dateKey]) ? habit.progress[dateKey] : 0;
    const percent = Math.min((current / habit.goal) * 100, 100);
    const isDone = current >= habit.goal;

    const card = document.createElement('div');
    card.className = 'habit-card' + (isDone ? ' completed' : '');
    card.id = 'habit-' + habit.id;

    card.innerHTML = `
        <div class="habit-card-inner">
            <div class="habit-icon-circle">${habit.icon}</div>
            <div class="habit-middle">
                <div class="habit-name">${habit.name}</div>
                <div class="habit-sub" id="text-${habit.id}">${current} / ${habit.goal} ${habit.unit}</div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" id="bar-${habit.id}" style="width:${percent}%;background:${isDone?'#4CAF50':'#000'}"></div>
                </div>
            </div>
            <div class="card-btns">
                <button class="plus-btn" onclick="incrementHabit(${habit.id})">+</button>
                <button class="delete-btn" onclick="deleteHabit(${habit.id})">🗑</button>
            </div>
        </div>
    `;

    list.appendChild(card);
}

// ===== СЧЁТЧИК =====
function incrementHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const dateKey = getDateKey(currentDate);
    if (!habit.progress) habit.progress = {};
    if (!habit.progress[dateKey]) habit.progress[dateKey] = 0;

    // Просто увеличиваем — без сброса
    habit.progress[dateKey]++;

    saveToStorage();

    const current = habit.progress[dateKey];
    const percent = Math.min((current / habit.goal) * 100, 100);
    const isDone = current >= habit.goal;

    const bar = document.getElementById('bar-' + id);
    const txt = document.getElementById('text-' + id);
    const card = document.getElementById('habit-' + id);

    if (bar) {
        bar.style.width = percent + '%';
        bar.style.background = isDone ? '#4CAF50' : '#000';
    }
    if (txt) txt.textContent = `${current} / ${habit.goal} ${habit.unit}`;
    if (card) card.classList.toggle('completed', isDone);
}

// ===== ВСПОМОГАТЕЛЬНЫЕ =====
function getDateKey(date) {
    return date.getFullYear() + '-' +
        String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
}

// ===== НАВИГАЦИЯ =====
function showPage(page, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
}
