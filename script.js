const tg = window.Telegram.WebApp;
tg.expand();

// ===== СОСТОЯНИЕ ДАТЫ =====
const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
const dateState = {
    day: 1,
    month: 0,
    year: new Date().getFullYear()
};

function changeDate(type, delta) {
    if (type === 'day') {
        dateState.day += delta;
        const maxDay = new Date(dateState.year, dateState.month + 1, 0).getDate();
        if (dateState.day < 1) dateState.day = maxDay;
        if (dateState.day > maxDay) dateState.day = 1;
    }
    if (type === 'month') {
        dateState.month += delta;
        if (dateState.month < 0) dateState.month = 11;
        if (dateState.month > 11) dateState.month = 0;
        const maxDay = new Date(dateState.year, dateState.month + 1, 0).getDate();
        if (dateState.day > maxDay) dateState.day = maxDay;
    }
    if (type === 'year') {
        dateState.year += delta;
        const currentYear = new Date().getFullYear();
        if (dateState.year < currentYear) dateState.year = currentYear;
        if (dateState.year > currentYear + 10) dateState.year = currentYear + 10;
    }
    updateDateDisplay();
}

function updateDateDisplay() {
    document.getElementById('startDay').value = dateState.day;
    document.getElementById('startMonth').textContent = months[dateState.month];
    document.getElementById('startYear').value = dateState.year;
}

function onDateInput(type) {
    if (type === 'day') {
        let val = parseInt(document.getElementById('startDay').value);
        const maxDay = new Date(dateState.year, dateState.month + 1, 0).getDate();
        if (isNaN(val) || val < 1) val = 1;
        if (val > maxDay) val = maxDay;
        dateState.day = val;
        document.getElementById('startDay').value = val;
    }
    if (type === 'year') {
        let val = parseInt(document.getElementById('startYear').value);
        const currentYear = new Date().getFullYear();
        if (isNaN(val) || val < currentYear) val = currentYear;
        if (val > currentYear + 10) val = currentYear + 10;
        dateState.year = val;
        document.getElementById('startYear').value = val;
    }
}

// ===== ИКОНКИ =====
const icons = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    '🏃','💪','📚','✏️','🎯','💧','🧘','🎵','🍎','😴',
    '🚴','🏊','🧠','❤️','⭐','🔥','🌟','💡','🎨','🏋️',
    '🎮','🌿','🥗','🧹','💊','🛏️','🚿','📝','🎤','🌅'
];

let selectedIconValue = 'A';
let reminderOn = false;
let iconPickerOpen = false;
let habits = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.onload = function () {
    // Инициализация даты
    const now = new Date();
    dateState.day = now.getDate();
    dateState.month = now.getMonth();
    dateState.year = now.getFullYear();
    updateDateDisplay();

    // Заполняем пикер иконок
    const grid = document.getElementById('iconGrid');
    icons.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'icon-option';
        btn.textContent = icon;
        btn.onclick = function () {
            selectedIconValue = icon;
            document.getElementById('selectedIcon').textContent = icon;
            closeIconPicker();
        };
        grid.appendChild(btn);
    });
};

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

    const now = new Date();
    dateState.day = now.getDate();
    dateState.month = now.getMonth();
    dateState.year = now.getFullYear();
    updateDateDisplay();
}

// ===== ПИКЕР ИКОНОК =====
function openIconPicker() {
    iconPickerOpen = !iconPickerOpen;
    const picker = document.getElementById('iconPicker');
    picker.classList.toggle('open', iconPickerOpen);
}

function closeIconPicker() {
    iconPickerOpen = false;
    document.getElementById('iconPicker').classList.remove('open');
}

// ===== ДНИ НЕДЕЛИ =====
function toggleDay(btn) {
    btn.classList.toggle('active');
}

function toggleAllDays(btn) {
    const dayBtns = document.querySelectorAll('.day-btn:not(.day-btn-all)');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => {
        b.classList.toggle('active', !allActive);
    });
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

    const habit = {
        id: Date.now(),
        name: name,
        icon: selectedIconValue,
        goal: goalCount,
        unit: unit,
        current: 0
    };

    habits.push(habit);
    renderHabit(habit);
    closeModal();
}

// ===== ОТРИСОВКА ПРИВЫЧКИ =====
function renderHabit(habit) {
    const habitsList = document.getElementById('habitsList');

    const card = document.createElement('div');
    card.className = 'habit-card';
    card.id = 'habit-' + habit.id;

    card.innerHTML = `
        <div class="habit-card-inner">
            <div class="habit-icon-circle">${habit.icon}</div>
            <div class="habit-middle">
                <div class="habit-name">${habit.name}</div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" id="bar-${habit.id}" style="width: 0%"></div>
                </div>
                <div class="habit-progress-text" id="text-${habit.id}">
                    0 / ${habit.goal} ${habit.unit}
                </div>
            </div>
            <button class="plus-btn" onclick="incrementHabit(${habit.id})">＋</button>
        </div>
    `;

    habitsList.appendChild(card);
}

// ===== УВЕЛИЧИТЬ СЧЁТЧИК =====
function incrementHabit(id) {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    if (habit.current < habit.goal) {
        habit.current++;
    } else {
        habit.current = 0;
    }

    updateHabitUI(habit);
}

// ===== ОБНОВИТЬ ИНТЕРФЕЙС ПРИВЫЧКИ =====
function updateHabitUI(habit) {
    const percent = Math.min((habit.current / habit.goal) * 100, 100);

    const bar = document.getElementById('bar-' + habit.id);
    const text = document.getElementById('text-' + habit.id);
    const card = document.getElementById('habit-' + habit.id);

    if (bar) bar.style.width = percent + '%';
    if (text) text.textContent = `${habit.current} / ${habit.goal} ${habit.unit}`;

    if (habit.current >= habit.goal) {
        card.classList.add('completed');
        bar.style.background = '#4CAF50';
    } else {
        card.classList.remove('completed');
        bar.style.background = '#000';
    }
}

// ===== НАВИГАЦИЯ =====
function showPage(page, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
}
