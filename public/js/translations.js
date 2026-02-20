// public/js/language-init.js
// Simple language initializer for all pages

(function() {
    'use strict';
    
    // Run immediately
    function init() {
        const savedLang = localStorage.getItem('language') || 'english';
        if (window.setLanguage) {
            window.setLanguage(savedLang);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Listen for language changes
    window.addEventListener('storage', function(e) {
        if (e.key === 'language' && window.setLanguage) {
            window.setLanguage(e.newValue || 'english');
        }
    });
    
    window.addEventListener('languageChanged', function(e) {
        if (e.detail && e.detail.language && window.setLanguage) {
            window.setLanguage(e.detail.language);
        }
    });
})();