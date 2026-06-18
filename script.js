const tg = window.Telegram.WebApp;
tg.expand();

// ===== ИКОНКИ =====
const icons = [
    'A','B','C','D','E','F','G','H','I','J','K','L','M',
    'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
    '🏃','💪','📚','✏️','🎯','💧','🧘','🎵','🍎','😴',
    '🚴','🏊','🧠','❤️','⭐','🔥','🌟','💡','🎨','🏋️'
];

let selectedIconValue = 'A';
let reminderOn = false;
let iconPickerOpen = false;

// Заполняем дни и годы
window.onload = function() {
    // Дни
    const daySelect = document.getElementById('startDay');
    for (let i = 1; i <= 31; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = i;
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

    // Устанавливаем текущую дату
    const now = new Date();
    document.getElementById('startDay').value = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value = now.getFullYear();

    // Заполняем пикер иконок
    const grid = document.getElementById('iconGrid');
    icons.forEach(icon => {
        const btn = document.createElement('button');
        btn.className = 'icon-option';
        btn.textContent = icon;
        btn.onclick = function() {
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
    document.getElementById('startDay').value = now.getDate();
    document.getElementById('startMonth').value = now.getMonth() + 1;
    document.getElementById('startYear').value = now.getFullYear();
}

// ===== ПИКЕР ИКОНОК =====
function openIconPicker() {
    iconPickerOpen = !iconPickerOpen;
    const picker = document.getElementById('iconPicker');
    if (iconPickerOpen) {
        picker.classList.add('open');
    } else {
        picker.classList.remove('open');
    }
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
        if (allActive) {
            b.classList.remove('active');
        } else {
            b.classList.add('active');
        }
    });
    btn.classList.toggle('active', !allActive);
}

// ===== НАПОМИНАНИЯ =====
function toggleReminder() {
    reminderOn = !reminderOn;
    const toggle = document.getElementById('reminderToggle');
    const label = document.getElementById('toggleLabel');
    if (reminderOn) {
        toggle.classList.add('on');
        label.textContent = 'да';
    } else {
        toggle.classList.remove('on');
        label.textContent = 'нет';
    }
}

// ===== СОХРАНИТЬ =====
function saveHabit() {
    const name = document.getElementById('habitName').value.trim();
    if (!name) {
        alert('Введите название привычки!');
        return;
    }

    const count = document.getElementById('habitCount').value || '—';
    const unit = document.getElementById('habitUnit').value;
    const day = document.getElementById('startDay').value;
    const month = document.getElementById('startMonth').value;
    const year = document.getElementById('startYear').value;

    const selectedDays = [...document.querySelectorAll('.day-btn:not(.day-btn-all).active')]
        .map(b => b.dataset.day).join(', ') || 'не выбраны';

    const reminder = reminderOn ? 'да' : 'нет';
    const icon = selectedIconValue;

    // Создаём карточку привычки
    const habitsList = document.getElementById('habitsList');
    const card = document.createElement('div');
    card.className = 'habit-card';
    card.innerHTML = `
        <div class="habit-card-left">
            <div class="habit-icon-small">${icon}</div>
            <div class="habit-info">
                <div class="habit-card-name">${name}</div>
                <div class="habit-card-detail">${count} ${unit} · ${selectedDays}</div>
                <div class="habit-card-detail">с ${day}.${String(month).padStart(2,'0')}.${year} · напом: ${reminder}</div>
            </div>
        </div>
    `;
    habitsList.appendChild(card);

    closeModal();
}

// ===== НАВИГАЦИЯ =====
function showPage(page) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    console.log("Открыта вкладка: " + page);
}
