// public/js/dashboard.js
// Dashboard functionality for HabitLog

// =========== STATE MANAGEMENT ===========
let habits = [];
let currentHabitId = null;
let deleteHabitId = null;

// =========== INITIALIZATION ===========
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEventListeners();
    loadUserData();
    loadUserRewards();
    requestNotificationPermission();
    loadReminderSettings();
    
    // Check for email reminders every hour
    setInterval(checkAndSendReminders, 3600000);
});

// =========== THEME MANAGEMENT ===========
function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;
    
    // Load saved theme with system preference fallback
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            html.classList.add('dark');
            updateToggleIcon('dark');
        } else if (savedTheme === 'light') {
            html.classList.remove('dark');
            updateToggleIcon('light');
        } else {
            // Check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                html.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                updateToggleIcon('dark');
            } else {
                html.classList.remove('dark');
                localStorage.setItem('theme', 'light');
                updateToggleIcon('light');
            }
        }
    }
    
    // Update toggle button icon based on theme
    function updateToggleIcon(theme) {
        if (themeToggle) {
            if (theme === 'dark') {
                themeToggle.innerHTML = '<i class="fas fa-sun text-yellow-400"></i>';
            } else {
                themeToggle.innerHTML = '<i class="fas fa-moon text-gray-700"></i>';
            }
        }
    }
    
    // Load theme on page load
    loadSavedTheme();
    
    // Theme toggle handler
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            if (html.classList.contains('dark')) {
                html.classList.remove('dark');
                localStorage.setItem('theme', 'light');
                updateToggleIcon('light');
            } else {
                html.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                updateToggleIcon('dark');
            }
        });
    }
    
    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            // Only change if user hasn't set a preference
            if (!localStorage.getItem('theme')) {
                if (e.matches) {
                    html.classList.add('dark');
                    updateToggleIcon('dark');
                } else {
                    html.classList.remove('dark');
                    updateToggleIcon('light');
                }
            }
        });
    }
}

// =========== NOTIFICATION MANAGEMENT ===========
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}

// =========== TOAST NOTIFICATIONS ===========
function showError(message) {
    const toast = document.getElementById('errorToast');
    const messageEl = document.getElementById('errorMessage');
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
}

function showSuccess(message) {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('successMessage');
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Show mood feedback toast
function showMoodFeedback(type) {
    const toast = document.getElementById('moodFeedbackToast');
    if (!toast) return;
    
    const message = document.getElementById('moodFeedbackMessage');
    if (type === 'good') {
        message.textContent = '😊 Positive mood tracked! Keep up the good work!';
    } else {
        message.textContent = '😔 Negative mood tracked. Tomorrow is a new day!';
    }
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

// =========== DATA LOADING ===========
async function loadUserData() {
    try {
        // Load user info from localStorage
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            const usernameEl = document.getElementById('username');
            if (usernameEl) usernameEl.textContent = user.username;
        }

        // Load habits from server
        const response = await fetch('/api/habits');
        if (response.ok) {
            habits = await response.json();
            updateDashboard();
            
            // Show/hide quick add section
            const quickAddSection = document.getElementById('quickAddSection');
            if (quickAddSection) {
                if (habits.length === 0) {
                    quickAddSection.classList.remove('hidden');
                } else {
                    quickAddSection.classList.add('hidden');
                }
            }
        }
    } catch (error) {
        console.error('Error loading habits:', error);
        showError('Failed to load habits');
    }
}

// =========== DASHBOARD UPDATE ===========
function updateDashboard() {
    const totalHabits = habits.length;
    const today = new Date().toISOString().split('T')[0];
    const completedToday = habits.filter(h => h.completedDates?.includes(today)).length;
    
    // Calculate main streak based on days with at least one completed habit
    const mainStreak = calculateMainStreak();
    
    const achievementsCount = calculateAchievements();

    // Update summary cards
    document.getElementById('totalHabits').textContent = totalHabits;
    document.getElementById('completedToday').textContent = completedToday;
    document.getElementById('totalStreak').textContent = mainStreak;
    document.getElementById('achievementsCount').textContent = achievementsCount;

    renderHabits();
    updateWeeklySummary();
    checkNotifications();
}

// Calculate streak based on consecutive days with at least one habit completed
function calculateMainStreak() {
    if (habits.length === 0) return 0;
    
    // Get all unique dates where at least one habit was completed
    const completionDates = new Set();
    
    habits.forEach(habit => {
        if (habit.completedDates && Array.isArray(habit.completedDates)) {
            habit.completedDates.forEach(date => {
                completionDates.add(date);
            });
        }
    });
    
    // Convert to array and sort
    const sortedDates = Array.from(completionDates).sort();
    if (sortedDates.length === 0) return 0;
    
    // Check if today is completed
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = sortedDates.indexOf(today);
    
    // If today is not completed, streak is 0
    if (todayIndex === -1) return 0;
    
    // Calculate consecutive days
    let streak = 1;
    let currentDate = new Date(today);
    
    for (let i = 1; i <= 365; i++) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - i);
        const prevDateStr = prevDate.toISOString().split('T')[0];
        
        if (sortedDates.includes(prevDateStr)) {
            streak++;
        } else {
            break;
        }
    }
    
    return streak;
}

function calculateAchievements() {
    let count = 0;
    habits.forEach(habit => {
        if (habit.streak >= 7) count++;
        if (habit.streak >= 30) count++;
        if (habit.longestStreak >= 100) count++;
    });
    return count;
}

// =========== HABIT RENDERING ===========
function renderHabits() {
    const container = document.getElementById('habitsContainer');
    if (!container) return;

    container.innerHTML = '';

    if (habits.length === 0) {
        renderEmptyState(container);
        return;
    }

    // Sort by streak (highest first)
    habits.sort((a, b) => (b.streak || 0) - (a.streak || 0));

    habits.forEach(habit => {
        const habitCard = createHabitCard(habit);
        container.appendChild(habitCard);
    });
}

function renderEmptyState(container) {
    container.innerHTML = `
        <div class="col-span-full text-center py-12">
            <div class="text-6xl mb-4 animate-bounce">👋</div>
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome to HabitLog!
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">
                Start your habit tracking journey today
            </p>
            <button onclick="document.getElementById('addHabitBtn').click()" 
                    class="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-500 text-white rounded-lg hover:shadow-lg transition-all transform hover:scale-105">
                <i class="fas fa-plus mr-2"></i>
                Create Your First Habit
            </button>
        </div>
    `;
}

// Habit card with mood question
function createHabitCard(habit) {
    const today = new Date().toISOString().split('T')[0];
    const isCompleted = habit.completedDates?.includes(today);

    const card = document.createElement('div');
    card.className = 'habit-card bg-white dark:bg-gray-800 rounded-xl p-6 shadow-md';
    card.id = `habit-${habit.id}`;
    
    card.innerHTML = `
        <div class="flex items-start justify-between mb-4">
            <div class="flex items-center">
                <span class="text-3xl mr-3">${habit.icon || '📝'}</span>
                <div>
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white">${escapeHtml(habit.name)}</h3>
                    ${habit.description ? `<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${escapeHtml(habit.description)}</p>` : ''}
                </div>
            </div>
            <div class="flex space-x-2">
                <button onclick="editHabit('${habit.id}')" class="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors" title="Edit habit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteHabit('${habit.id}')" class="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors" title="Delete habit">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        
        <div class="flex items-center justify-between mb-4">
            <div>
                <span class="text-sm text-gray-500 dark:text-gray-400">Current Streak</span>
                <div class="flex items-center">
                    <span class="text-2xl font-bold text-accent-500">${habit.streak || 0}</span>
                    <span class="text-gray-400 ml-1">🔥</span>
                </div>
            </div>
            <div>
                <span class="text-sm text-gray-500 dark:text-gray-400">Longest</span>
                <div class="text-xl font-semibold text-gray-900 dark:text-white">${habit.longestStreak || 0}</div>
            </div>
        </div>
        
        <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">How was your mood?</p>
            <div class="flex items-center justify-between">
                <button onclick="toggleHabit('${habit.id}')" 
                        class="px-4 py-2 rounded-lg transition-all transform hover:scale-105
                               ${isCompleted 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}">
                    <i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-circle'} mr-2"></i>
                    ${isCompleted ? 'Completed' : 'Mark Complete'}
                </button>
                
                <div class="flex space-x-3">
                    <button onclick="giveFeedback('${habit.id}', 'good')" 
                            class="text-2xl hover:scale-125 transition-transform transform hover:rotate-12" 
                            title="Good mood">
                        👍
                    </button>
                    <button onclick="giveFeedback('${habit.id}', 'bad')" 
                            class="text-2xl hover:scale-125 transition-transform transform hover:-rotate-12" 
                            title="Bad mood">
                        👎
                    </button>
                </div>
            </div>
        </div>
    `;

    return card;
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    if (!unsafe) return unsafe;
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// =========== HABIT OPERATIONS ===========
async function toggleHabit(habitId) {
    try {
        showLoading();
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/habits/${habitId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: today })
        });

        if (response.ok) {
            const data = await response.json();
            const index = habits.findIndex(h => h.id === habitId);
            if (index !== -1) {
                habits[index] = data.habit;
                updateDashboard();
                
                // Update rewards if changed
                if (data.rewards) {
                    loadUserRewards();
                }
            }
            showSuccess('Habit updated!');
            
            // Show emoji feedback
            showEmojiFeedback('✨');
        }
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error toggling habit:', error);
        showError('Failed to update habit');
    }
}

// Show mood feedback toast when giving feedback
function giveFeedback(habitId, type) {
    showEmojiFeedback(type === 'good' ? '👍' : '👎');
    
    // Show mood feedback toast
    showMoodFeedback(type);
    
    // Store feedback in localStorage
    const feedback = JSON.parse(localStorage.getItem('habitFeedback') || '{}');
    if (!feedback[habitId]) feedback[habitId] = [];
    feedback[habitId].push({ type, date: new Date().toISOString() });
    localStorage.setItem('habitFeedback', JSON.stringify(feedback));
}

function showEmojiFeedback(emoji) {
    const feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl animate-bounce z-50';
    feedbackDiv.textContent = emoji;
    document.body.appendChild(feedbackDiv);
    setTimeout(() => feedbackDiv.remove(), 1000);
}

// =========== HABIT CRUD OPERATIONS ===========
function openAddHabitModal() {
    const modalTitle = document.getElementById('modalTitle');
    const habitForm = document.getElementById('habitForm');
    const habitId = document.getElementById('habitId');
    
    if (modalTitle) modalTitle.textContent = 'Add New Habit';
    if (habitForm) habitForm.reset();
    if (habitId) habitId.value = '';
    
    const habitColor = document.getElementById('habitColor');
    if (habitColor) habitColor.value = '#6366f1';
    
    showModal('habitModal');
}

function editHabit(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    document.getElementById('modalTitle').textContent = 'Edit Habit';
    document.getElementById('habitId').value = habit.id;
    document.getElementById('habitName').value = habit.name;
    document.getElementById('habitDescription').value = habit.description || '';
    document.getElementById('habitColor').value = habit.color || '#6366f1';
    document.getElementById('habitIcon').value = habit.icon || '📝';
    
    showModal('habitModal');
}

function deleteHabit(habitId) {
    deleteHabitId = habitId;
    showModal('deleteModal');
}

async function confirmDelete() {
    if (!deleteHabitId) return;

    try {
        showLoading();
        const response = await fetch(`/api/habits/${deleteHabitId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            habits = habits.filter(h => h.id !== deleteHabitId);
            updateDashboard();
            hideModal('deleteModal');
            deleteHabitId = null;
            showSuccess('Habit deleted successfully');
        }
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error deleting habit:', error);
        showError('Failed to delete habit');
    }
}

async function saveHabit(event) {
    event.preventDefault();

    const habitData = {
        name: document.getElementById('habitName').value,
        description: document.getElementById('habitDescription').value,
        color: document.getElementById('habitColor').value,
        icon: document.getElementById('habitIcon').value
    };

    const habitId = document.getElementById('habitId').value;
    const url = habitId ? `/api/habits/${habitId}` : '/api/habits';
    const method = habitId ? 'PUT' : 'POST';

    try {
        showLoading();
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(habitData)
        });

        if (response.ok) {
            const habit = await response.json();
            if (habitId) {
                // Update existing habit
                const index = habits.findIndex(h => h.id === habitId);
                if (index !== -1) {
                    habits[index] = habit;
                }
                showSuccess('Habit updated successfully');
            } else {
                // Add new habit
                habits.push(habit);
                showSuccess('Habit created successfully');
            }
            
            updateDashboard();
            hideModal('habitModal');
            
            // Hide quick add section if habits exist
            const quickAddSection = document.getElementById('quickAddSection');
            if (quickAddSection && habits.length > 0) {
                quickAddSection.classList.add('hidden');
            }
        }
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Error saving habit:', error);
        showError('Failed to save habit');
    }
}

// =========== QUICK ADD HABITS ===========
function quickAddHabit(name, icon, color) {
    document.getElementById('habitName').value = name;
    document.getElementById('habitIcon').value = icon;
    document.getElementById('habitColor').value = color;
    document.getElementById('habitDescription').value = '';
    document.getElementById('habitId').value = '';
    document.getElementById('modalTitle').textContent = 'Add New Habit';
    showModal('habitModal');
}

// =========== WEEKLY SUMMARY ===========
function updateWeeklySummary() {
    const summary = document.getElementById('weeklySummary');
    if (!summary) return;

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    let totalCompleted = 0;
    let totalPossible = 0;

    for (let d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        totalCompleted += habits.filter(h => h.completedDates?.includes(dateStr)).length;
        totalPossible += habits.length;
    }

    const percentage = totalPossible > 0 ? (totalCompleted / totalPossible) * 100 : 0;

    if (percentage >= 80) {
        summary.textContent = "Excellent work this week! You're on fire! 🔥";
    } else if (percentage >= 50) {
        summary.textContent = "Good progress this week! Keep it up! 💪";
    } else if (percentage >= 30) {
        summary.textContent = "Nice start! Try to be more consistent next week! 🌱";
    } else {
        summary.textContent = "Every journey begins with a single step. You've got this! ✨";
    }
}

// =========== NOTIFICATIONS ===========
function checkNotifications() {
    if (Notification.permission === 'granted') {
        const today = new Date().toISOString().split('T')[0];
        const incompleteHabits = habits.filter(h => !h.completedDates?.includes(today));
        
        if (incompleteHabits.length > 0) {
            new Notification('HabitLog Reminder', {
                body: `You have ${incompleteHabits.length} habits to complete today!`,
                icon: '/favicon.ico'
            });
        }
    }
}

// =========== REWARDS MANAGEMENT ===========
async function loadUserRewards() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            const userData = await response.json();
            updateRewards(userData);
        }
    } catch (error) {
        console.error('Error loading user rewards:', error);
    }
}

function updateRewards(userData) {
    if (!userData || !userData.rewards) return;

    const starCount = document.getElementById('starCount');
    const badgeCount = document.getElementById('badgeCount');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');

    if (starCount) starCount.textContent = `${userData.rewards.stars} Stars`;
    if (badgeCount) badgeCount.textContent = `${userData.rewards.badges.length} Badges`;
    
    // Update status icon and text
    const statusIcons = {
        'beginner': '🌱',
        'sprout': '🌿',
        'star': '⭐',
        'advanced': '🌟',
        'expert': '🏆',
        'master': '👑',
        'legend': '🔥'
    };
    
    if (statusIcon) {
        statusIcon.textContent = statusIcons[userData.rewards.status] || '🌱';
    }
    
    if (statusText) {
        const status = userData.rewards.status;
        let displayText = status.charAt(0).toUpperCase() + status.slice(1);
        if (status === 'sprout') displayText = 'Sprout';
        statusText.textContent = displayText;
    }
}

// =========== REMINDER FUNCTIONS ===========

// Load saved reminder settings
function loadReminderSettings() {
    const enabled = localStorage.getItem('remindersEnabled') === 'true';
    const time = localStorage.getItem('reminderTime') || '09:00';
    
    // Update UI if elements exist
    const remindersEnabled = document.getElementById('remindersEnabled');
    const reminderTimeInput = document.getElementById('reminderTimeInput');
    
    if (remindersEnabled) remindersEnabled.checked = enabled;
    if (reminderTimeInput) reminderTimeInput.value = time;
}

// Save reminder settings
function saveReminderSettings() {
    const enabled = document.getElementById('remindersEnabled')?.checked || false;
    const time = document.getElementById('reminderTimeInput')?.value || '09:00';
    
    localStorage.setItem('remindersEnabled', enabled);
    localStorage.setItem('reminderTime', time);
    
    showSuccess('Reminder settings saved!');
    
    // Close modal
    hideModal('remindersModal');
}

// =========== MODAL MANAGEMENT ===========
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
}

// =========== LOGOUT ===========
async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('user');
        window.location.href = '/';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// =========== EVENT LISTENERS ===========
function initializeEventListeners() {
    // Add habit button
    const addHabitBtn = document.getElementById('addHabitBtn');
    if (addHabitBtn) {
        addHabitBtn.addEventListener('click', openAddHabitModal);
    }

    // Modal close buttons
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => hideModal('habitModal'));
    }

    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => hideModal('deleteModal'));
    }

    // Confirm delete button
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }

    // Habit form submit
    const habitForm = document.getElementById('habitForm');
    if (habitForm) {
        habitForm.addEventListener('submit', saveHabit);
    }

    // Logout button
    const logoutBtn = createLogoutButton();
    const nav = document.querySelector('.flex.items-center.space-x-2.md\\:space-x-4');
    if (nav) {
        nav.appendChild(logoutBtn);
    }

    // Reminder interval for browser notifications
    setInterval(checkNotifications, 3600000);
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('remindersModal');
        if (e.target === modal) {
            hideModal('remindersModal');
        }
    });
}

function createLogoutButton() {
    const logoutBtn = document.createElement('button');
    logoutBtn.onclick = logout;
    logoutBtn.className = 'px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors';
    logoutBtn.title = 'Logout';
    logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
    return logoutBtn;
}

// Email reminder functions (placeholder)
async function checkAndSendReminders() {
    // Implement email reminder logic here
    console.log('Checking for reminders...');
}

// =========== EXPORT FUNCTIONS FOR GLOBAL ACCESS ===========
window.toggleHabit = toggleHabit;
window.editHabit = editHabit;
window.deleteHabit = deleteHabit;
window.giveFeedback = giveFeedback;
window.quickAddHabit = quickAddHabit;
window.logout = logout;
window.showModal = showModal;
window.hideModal = hideModal;
window.showMoodFeedback = showMoodFeedback;
window.saveReminderSettings = saveReminderSettings;