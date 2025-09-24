document.addEventListener('DOMContentLoaded', () => {
    AOS.init({
        duration: 800,
        once: true,
        disable: 'mobile'
    });

    const tabsContainer = document.getElementById('aboutTabs');
    const tabButtons = tabsContainer.querySelectorAll('.about-tab');
    const tabContents = document.querySelectorAll('.about-tab-content');

    function switchTab(targetId) {
        tabButtons.forEach(button => button.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        const newActiveButton = document.querySelector(`[data-tab="${targetId}"]`);
        const newActiveContent = document.getElementById(targetId + '-tab-content');

        if (newActiveButton && newActiveContent) {
            newActiveButton.classList.add('active');
            newActiveContent.classList.add('active');
        }
    }

    tabsContainer.addEventListener('click', (event) => {
        const target = event.target;
        if (target.classList.contains('about-tab')) {
            const targetTab = target.dataset.tab;
            switchTab(targetTab);
        }
    });

    // Initial activation
    switchTab('mission');
});