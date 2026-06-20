const tg = window.Telegram.WebApp;
tg.expand();

// ===== ДАТА =====
const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЙ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
const dateState = {
    day: new Date().getDate(),
    month: new Date().getMonth(),
    year: new Date().getFullYear()
};

function changeDate(type, delta) {
    if (type === 'day') {
        dateState.day += delta;
        const max = new Date(dateState.year, dateState.month + 1, 0).getDate();
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
    document.getElementById('startMonth').textContent = months[dateState.month];
    document.getElementById('startYear').textContent = dateState.year;
}

// ===== ИКОНКИ =====
const icons = [
    '🏃','💪','📚','✏️','🎯','💧','🧘','🎵','🍎','😴',
    '🚴','🏊','🧠','❤️','⭐','🔥','🌟','💡','🎨','🏋️',
    '🎮','🌿','🥗','🧹','💊','🛏️','🚿','📝','🎤','🌅',
    '🏆','🦷','🧴','☕','🍵','🥤','🏠','💰','🧮','⏰',
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
];

let selectedIconValue = 'A';
let reminderOn = false;
let iconPickerOpen = false;
let habits = [];

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.onload = function () {
    updateDateDisplay();

    const grid = document.getElementById('iconGrid');
    icons.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'icon-option';
        btn.textContent = icon;
        btn.onclick = function (e) {
            e.stopPropagation();
            selectedIconValue = icon;
            document.getElementById('selectedIcon').textContent = icon;
            closeIconPicker();
        };
        grid.appendChild(btn);
    });
};

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
    // Закрыть пикер при клике вне него
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

// ===== ОТРИСОВКА КАРТОЧКИ =====
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
                <div class="habit-sub" id="text-${habit.id}">0 / ${habit.goal} ${habit.unit}</div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-fill" id="bar-${habit.id}"></div>
                </div>
            </div>
            <button class="plus-btn" onclick="incrementHabit(${habit.id})">+</button>
        </div>
    `;

    habitsList.appendChild(card);
}

// ===== СЧЁТЧИК =====
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

function updateHabitUI(habit) {
    const percent = Math.min((habit.current / habit.goal) * 100, 100);
    const bar = document.getElementById('bar-' + habit.id);
    const text = document.getElementById('text-' + habit.id);
    const card = document.getElementById('habit-' + habit.id);

    if (bar) {
        bar.style.width = percent + '%';
        bar.style.background = habit.current >= habit.goal ? '#4CAF50' : '#000';
    }
    if (text) text.textContent = `${habit.current} / ${habit.goal} ${habit.unit}`;
    if (card) card.classList.toggle('completed', habit.current >= habit.goal);
}

// ===== НАВИГАЦИЯ =====
function showPage(page, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
}
