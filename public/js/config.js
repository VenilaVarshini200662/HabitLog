// public/js/config.js
const CONFIG = {
    // API Base URL - empty for same domain, or set your deployed URL
    API_BASE_URL: '',
    
    // For debugging
    isProduction: window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1',
    
    // Get the current domain
    getDomain: function() {
        return window.location.origin;
    }
};

// Make it available globally
window.CONFIG = CONFIG;