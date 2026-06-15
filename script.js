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

let selectedIconValue = '😊';
let reminderOn = false;
let iconPickerOpen = false;

// ===== ИНИЦИАЛИЗАЦИЯ =====
window.onload = function () {

    // Дни
    const daySelect = document.getElementById('startDay');
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i < 10 ? '0' + i : i;
        daySelect.appendChild(opt);
    }

    // Годы
    const yearSelect = document.getElementById('startYear');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y <= currentYear + 5; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    }

    // Текущая дата
    const now = new Date();
    document.getElementById('startDay').value = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value = now.getFullYear();

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

    // Запрет масштабирования жестами
    document.addEventListener('touchmove', function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
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
    document.getElementById('habitCount').value = '1';
    document.getElementById('habitUnit').value = 'раз';
    selectedIconValue = '😊';
    document.getElementById('selectedIcon').textContent = '😊';
    reminderOn = false;
    document.getElementById('reminderToggle').classList.remove('on');
    document.getElementById('toggleLabel').textContent = 'нет';
    document.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));

    const now = new Date();
    document.getElementById('startDay').value = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value = now.getFullYear();
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

    const goal = parseInt(document.getElementById('habitCount').value) || 1;
    const unit = document.getElementById('habitUnit').value;
    const icon = selectedIconValue;

    // Уникальный ID
    const id = Date.now();

    // Создаём карточку
    const habitsList = document.getElementById('habitsList');
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.dataset.id = id;
    card.dataset.goal = goal;
    card.dataset.current = 0;
    card.dataset.unit = unit;

    card.innerHTML = `
        <div class="habit-icon-circle">${icon}</div>
        <div class="habit-body">
            <div class="habit-card-name">${name}</div>
            <div class="habit-progress-wrap">
                <div class="habit-progress-bar">
                    <div class="habit-progress-fill" id="fill-${id}" style="width:0%"></div>
                    <span class="habit-progress-text" id="text-${id}">0 / ${goal} ${unit}</span>
                </div>
            </div>
        </div>
        <button class="habit-plus-btn" onclick="incrementHabit(${id})">+</button>
    `;

    habitsList.appendChild(card);
    closeModal();
}

// ===== УВЕЛИЧИТЬ СЧЁТЧИК =====
function incrementHabit(id) {
    const card = document.querySelector(`.habit-card[data-id="${id}"]`);
    let current = parseInt(card.dataset.current);
    const goal = parseInt(card.dataset.goal);
    const unit = card.dataset.unit;

    if (current >= goal) return; // уже выполнено

    current++;
    card.dataset.current = current;

    const percent = Math.min((current / goal) * 100, 100);
    document.getElementById(`fill-${id}`).style.width = percent + '%';
    document.getElementById(`text-${id}`).textContent = `${current} / ${goal} ${unit}`;

    // Если выполнено — подсветить
    if (current >= goal) {
        card.classList.add('completed');
        document.getElementById(`fill-${id}`).style.background = '#4CAF50';
    }
}

// ===== НАВИГАЦИЯ =====
function showPage(page, el) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    el.classList.add('active');
    console.log('Открыта вкладка: ' + page);
}
