// ===== TELEGRAM =====
const tg = window.Telegram?.WebApp;
if (tg) tg.expand();

// ===== ИКОНКИ =====
const icons = [
    '😊','😎','🥳','😴','🤩','💪','🏃','🚴','🏊','🧘',
    '📚','✏️','🎯','💧','🎵','🍎','🥗','🔥','⭐','🌟',
    '💡','🎨','🏋️','❤️','🧠','🎸','🌿','☀️','🌙','⚡',
    'A','B','C','D','E','F','G','H','I','J',
    'K','L','M','N','O','P','Q','R','S','T'
];

// ===== МАППИНГ: JS getDay() -> сокращение =====
// 0=Вс,1=Пн,2=Вт,3=Ср,4=Чт,5=Пт,6=Сб
const JS_DAY_TO_RU = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];

// ===== ДАТА =====
let dayOffset = 0;

const DAYS_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONTHS_RU = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
];

function getSelectedDate() {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(0,0,0,0);
    return d;
}

function dateKey(date) {
    return date.toISOString().slice(0,10);
}

function updateDateDisplay() {
    const d = getSelectedDate();
    document.getElementById('dateNavDay').textContent = DAYS_RU[d.getDay()];
    document.getElementById('dateNavFull').textContent =
        d.getDate() + ' ' + MONTHS_RU[d.getMonth()] + ' ' + d.getFullYear();
}

function changeDay(delta) {
    dayOffset += delta;
    updateDateDisplay();
    renderHabits();
}

// ===== ХРАНИЛИЩЕ =====
function loadHabits() {
    return JSON.parse(localStorage.getItem('habits') || '[]');
}

function saveHabits(habits) {
    localStorage.setItem('habits', JSON.stringify(habits));
}

function loadProgress() {
    return JSON.parse(localStorage.getItem('progress') || '{}');
}

function saveProgress(progress) {
    localStorage.setItem('progress', JSON.stringify(progress));
}

// ===== ФИЛЬТР ПО ДНЮ НЕДЕЛИ =====
// Возвращает только те привычки, у которых текущий день недели входит в список days
function getHabitsForDate(date) {
    const habits = loadHabits();
    const ruDay = JS_DAY_TO_RU[date.getDay()]; // например "СР"
    return habits.filter(h => {
        // Если days не задан или пустой — показываем всегда (обратная совместимость)
        if (!h.days || h.days.length === 0) return true;
        return h.days.includes(ruDay);
    });
}

// ===== ОБНОВИТЬ ОБЩУЮ ШКАЛУ ПРОГРЕССА =====
function updateDailyProgress(habitsForDay, dayProgress) {
    const block = document.getElementById('dailyProgressBlock');
    const percentEl = document.getElementById('dailyProgressPercent');
    const fillEl = document.getElementById('dailyProgressFill');
    const subEl = document.getElementById('dailyProgressSub');

    if (habitsForDay.length === 0) {
        block.style.display = 'none';
        return;
    }

    block.style.display = 'block';

    let completed = 0;
    habitsForDay.forEach(h => {
        const cur = dayProgress[h.id] || 0;
        if (cur >= h.goal) completed++;
    });

    const total = habitsForDay.length;
    const pct = Math.round((completed / total) * 100);

    percentEl.textContent = pct + '%';
    fillEl.style.width = pct + '%';

    // Цвет шкалы в зависимости от процента
    if (pct >= 100) {
        fillEl.style.background = 'linear-gradient(90deg, #4CAF50, #81C784)';
    } else if (pct >= 50) {
        fillEl.style.background = 'linear-gradient(90deg, #FF9800, #FFB74D)';
    } else {
        fillEl.style.background = 'linear-gradient(90deg, #F44336, #EF9A9A)';
    }

    subEl.textContent = completed + ' из ' + total + ' привычек выполнено';
}

// ===== ОТРИСОВКА ПРИВЫЧЕК =====
function renderHabits() {
    const date = getSelectedDate();
    const habitsForDay = getHabitsForDate(date);
    const progress = loadProgress();
    const key = dateKey(date);
    const dayProgress = progress[key] || {};

    const list = document.getElementById('habitsList');
    list.innerHTML = '';

    // Обновить общую шкалу
    updateDailyProgress(habitsForDay, dayProgress);

    if (habitsForDay.length === 0) {
        list.innerHTML = '<p class="empty-msg">Нет привычек на этот день 🙌</p>';
        return;
    }

    habitsForDay.forEach(habit => {
        const current = dayProgress[habit.id] || 0;
        const percent = Math.min((current / habit.goal) * 100, 100);
        const done = current >= habit.goal;

        const card = document.createElement('div');
        card.className = 'habit-card' + (done ? ' completed' : '');
        card.dataset.id = habit.id;

        card.innerHTML = `
            <div class="habit-icon-circle">${habit.icon}</div>
            <div class="habit-body">
                <div class="habit-card-name">${habit.name}</div>
                <div class="habit-progress-wrap">
                    <div class="habit-progress-bar">
                        <div class="habit-progress-fill"
                             id="fill-${habit.id}"
                             style="width:${percent}%${done ? ';background:linear-gradient(90deg,#4CAF50,#81C784)' : ''}">
                        </div>
                        <span class="habit-progress-text" id="text-${habit.id}">
                            ${current} / ${habit.goal} ${habit.unit}
                        </span>
                    </div>
                </div>
            </div>
            <button class="habit-plus-btn${done ? ' done' : ''}" onclick="incrementHabit(${habit.id})">
                ${done ? '✓' : '+'}
            </button>
            <button class="habit-del-btn" onclick="deleteHabit(${habit.id})">✕</button>
        `;

        list.appendChild(card);
    });
}

// ===== УВЕЛИЧИТЬ СЧЁТЧИК =====
function incrementHabit(id) {
    const habits = loadHabits();
    const habit = habits.find(h => h.id === id);
    if (!habit) return;

    const progress = loadProgress();
    const key = dateKey(getSelectedDate());
    if (!progress[key]) progress[key] = {};

    const current = progress[key][id] || 0;
    if (current >= habit.goal) return;

    progress[key][id] = current + 1;
    saveProgress(progress);
    renderHabits();
}

// ===== УДАЛИТЬ ПРИВЫЧКУ =====
function deleteHabit(id) {
    if (!confirm('Удалить привычку?')) return;
    let habits = loadHabits();
    habits = habits.filter(h => h.id !== id);
    saveHabits(habits);
    renderHabits();
}

// ===== МОДАЛКА =====
let selectedIconValue = '😊';
let reminderOn = false;
let iconPickerOpen = false;

function openModal() {
    document.getElementById('modalOverlay').classList.add('active');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    closeIconPicker();
    resetModal();
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
}

function resetModal() {
    document.getElementById('habitName').value = '';
    document.getElementById('habitCount').value = '1';
    document.getElementById('habitUnit').value = 'раз';
    selectedIconValue = '😊';
    document.getElementById('selectedIcon').textContent = '😊';
    reminderOn = false;
    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent = 'Выключено';
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.day-btn-all')?.classList.remove('active');

    const now = new Date();
    document.getElementById('startDay').value = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value = now.getFullYear();
}

// ===== ПИКЕР ИКОНОК =====
function openIconPicker() {
    iconPickerOpen = !iconPickerOpen;
    document.getElementById('iconPicker').classList.toggle('open', iconPickerOpen);
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
    const dayBtns = document.querySelectorAll('.day-btn');
    const allActive = [...dayBtns].every(b => b.classList.contains('active'));
    dayBtns.forEach(b => b.classList.toggle('active', !allActive));
    btn.classList.toggle('active', !allActive);
}

// ===== НАПОМИНАНИЯ =====
function toggleReminder() {
    reminderOn = !reminderOn;
    document.getElementById('reminderToggle').classList.toggle('on', reminderOn);
    document.getElementById('toggleLabel').textContent = reminderOn ? 'Включено' : 'Выключено';
}

// ===== СОХРАНИТЬ ПРИВЫЧКУ =====
function saveHabit() {
    const name = document.getElementById('habitName').value.trim();
    if (!name) {
        alert('Введите название привычки!');
        return;
    }

    const goal = parseInt(document.getElementById('habitCount').value) || 1;
    const unit = document.getElementById('habitUnit').value;
    const icon = selectedIconValue;
    const id   = Date.now();

    // Собираем выбранные дни
    const days = [];
    document.querySelectorAll('.day-btn.active').forEach(b => {
        days.push(b.dataset.day);
    });

    const habits = loadHabits();
    habits.push({ id, name, icon, goal, unit, days });
    saveHabits(habits);

    closeModal();
    renderHabits();
}

// ===== НАВИГАЦИЯ =====
function showPage(page) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById('nav-' + page)?.classList.add('active');
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.onload = function () {
    // Заполнить дни
    const daySelect = document.getElementById('startDay');
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i < 10 ? '0' + i : i;
        daySelect.appendChild(opt);
    }

    // Заполнить годы
    const yearSelect = document.getElementById('startYear');
    const yr = new Date().getFullYear();
    for (let y = yr; y <= yr + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    // Текущая дата
    const now = new Date();
    document.getElementById('startDay').value   = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value  = now.getFullYear();

    // Пикер иконок
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

    updateDateDisplay();
    renderHabits();

    document.addEventListener('touchmove', e => {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
};
