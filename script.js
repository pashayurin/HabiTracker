const tg = window.Telegram.WebApp;
tg.expand();

// Переключение вкладок
function showPage(page) {
    // Убираем active со всех
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    // Добавляем active на нажатую
    event.currentTarget.classList.add('active');

    console.log("Открыта вкладка: " + page);
}
