class LanguageManager {
    constructor() {
        this.currentLang = localStorage.getItem('rpp_language') || 'en';
        this.init();
    }

    init() {
        this.applyLanguage(this.currentLang);
        this.setupLanguageSelector();
    }

    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('rpp_language', lang);
            this.applyLanguage(lang);
            // Update selector visualization if needed
            this.updateSelectorState();

            // Dispatch custom event to notify other components
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
        }
    }

    applyLanguage(lang) {
        const dict = translations[lang];
        if (!dict) return;

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (dict[key]) {
                // If it's an input/button with value/title/placeholder, might need specific handling, 
                // but for mostly text content:
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = dict[key];
                } else {
                    // Preserve SVG elements before updating text
                    const svgElement = element.querySelector('svg');
                    const svgHTML = svgElement ? svgElement.outerHTML : '';

                    // Update text content
                    element.textContent = dict[key];

                    // Re-insert SVG if it existed
                    if (svgHTML) {
                        element.insertAdjacentHTML('afterbegin', svgHTML + ' ');
                    }
                }
            }
        });

        // Handle data-i18n-placeholder separately
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                element.placeholder = dict[key];
            }
        });

        // Special handling for dynamic/complex elements if any
        // ...
    }

    setupLanguageSelector() {
        // Native select (hidden)
        const nativeSelect = document.getElementById('languageSelect');
        // Custom UI elements
        const customSelector = document.getElementById('customLangSelector');
        const langBtn = document.getElementById('langBtn');
        const dropdownMenu = document.getElementById('langDropdownMenu');
        const options = document.querySelectorAll('.lang-option');
        const currentFlag = document.getElementById('currentLangFlag');
        const currentCode = document.getElementById('currentLangCode');

        // Flag Data Map (for button update)
        const flagData = {
            'en': 'https://flagcdn.com/us.svg',
            'es': 'https://flagcdn.com/es.svg',
            'ru': 'https://flagcdn.com/ru.svg'
        };
        // ES Flag fix: The one in HTML was manually added, ensure this matches or just use the dom element src.
        // Actually, easier to get src from the option img.

        const updateUI = (lang) => {
            const selectedOption = document.querySelector(`.lang-option[data-value="${lang}"] img`);
            if (selectedOption) {
                currentFlag.style.backgroundImage = `url('${selectedOption.src}')`;
                currentCode.textContent = lang.toUpperCase();
            }
            if (nativeSelect) nativeSelect.value = lang;
        };

        // Initialize
        if (customSelector) {
            updateUI(this.currentLang);

            // Toggle Dropdown
            langBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdownMenu.classList.toggle('open');
            });

            // Close on outside click
            document.addEventListener('click', (e) => {
                if (!customSelector.contains(e.target)) {
                    dropdownMenu.classList.remove('open');
                }
            });

            // Handle Selection
            options.forEach(opt => {
                opt.addEventListener('click', () => {
                    const lang = opt.getAttribute('data-value');
                    this.setLanguage(lang);
                    updateUI(lang);
                    dropdownMenu.classList.remove('open');
                });
            });
        }
    }

    updateSelectorState() {
        const selector = document.getElementById('languageSelect');
        if (selector) {
            selector.value = this.currentLang;
        }
    }

    get(key) {
        return translations[this.currentLang]?.[key] || key;
    }
}
