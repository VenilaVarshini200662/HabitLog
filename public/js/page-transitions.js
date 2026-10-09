// public/js/page-transitions.js
// Smooth page transitions - FIXED VERSION

document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure DOM is fully loaded
    setTimeout(() => {
        // Add fade-in animation to main content
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.style.opacity = '0';
            mainContent.style.transition = 'opacity 0.5s ease-in-out';
            
            // Trigger reflow
            void mainContent.offsetWidth;
            
            // Fade in
            mainContent.style.opacity = '1';
        }
        
        // Add hover animations to all cards
        document.querySelectorAll('.habit-card, .stat-card, .achievement-badge, .bg-white').forEach(card => {
            if (card.classList.contains('bg-white') || card.classList.contains('dark:bg-gray-800')) {
                card.classList.add('hover-lift');
            }
        });
        
        // Add active class to current nav link
        const currentPath = window.location.pathname;
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }, 100);
});

// Add loading animation when clicking nav links
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        // Don't add loading for external links or if it's the current page
        if (link.getAttribute('href') === window.location.pathname) {
            e.preventDefault();
            return;
        }
        
        // Add a small loading indicator
        const loader = document.createElement('div');
        loader.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-primary-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        loader.style.animation = 'fadeIn 0.3s ease-out';
        loader.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Loading...';
        document.body.appendChild(loader);
        
        // Remove loader after navigation (will be cleared on page load)
        setTimeout(() => {
            loader.remove();
        }, 2000);
    });
});

// Add fade-in animation style if not exists
if (!document.querySelector('#animation-styles')) {
    const style = document.createElement('style');
    style.id = 'animation-styles';
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .hover-lift {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        
        .hover-lift:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
    `;
    document.head.appendChild(style);
}