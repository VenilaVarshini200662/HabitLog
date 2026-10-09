// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const cron = require('node-cron');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Detect environment — production ONLY when explicitly set (Render will set this)
const isProd = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Ensure users file exists
const usersFilePath = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]));
}

// Trust proxy — needed for Render's load balancer (harmless locally)
app.set('trust proxy', 1);

// Middleware
const corsOptions = {
    origin: isProd
        ? [process.env.FRONTEND_URL || true]  // Allow your deployed domain
        : 'http://localhost:3000',            // Local dev
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
// - Locally: HTTP + lax cookies (works on 127.0.0.1)
// - On Render: HTTPS + none cookies (works cross-site behind proxy)
// NOTE: no `domain` field — Express uses the current host automatically
app.use(session({
    secret: process.env.SESSION_SECRET || 'habitlog-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: isProd,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProd ? 'none' : 'lax'
    }
}));

// =========== STREAK CALCULATION FUNCTIONS ===========

/**
 * Calculate current streak for a habit
 */
function calculateHabitStreak(habit) {
    if (!habit.completedDates || habit.completedDates.length === 0) {
        return 0;
    }

    const sortedDates = [...habit.completedDates].sort().reverse();
    const today = new Date().toISOString().split('T')[0];

    if (!sortedDates.includes(today)) {
        return 0;
    }

    let streak = 1;
    let currentDate = today;

    while (true) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = prevDate.toISOString().split('T')[0];

        if (sortedDates.includes(currentDate)) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Calculate longest streak for a habit
 */
function calculateLongestStreak(habit) {
    if (!habit.completedDates || habit.completedDates.length === 0) {
        return 0;
    }

    const sortedDates = [...habit.completedDates].sort();

    let longestStreak = 0;
    let currentStreak = 1;
    let lastDate = sortedDates[0];

    for (let i = 1; i < sortedDates.length; i++) {
        const currentDate = sortedDates[i];

        const prev = new Date(lastDate);
        const curr = new Date(currentDate);
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
        } else if (diffDays > 1) {
            longestStreak = Math.max(longestStreak, currentStreak);
            currentStreak = 1;
        }

        lastDate = currentDate;
    }

    longestStreak = Math.max(longestStreak, currentStreak);

    return longestStreak;
}

/**
 * Calculate overall user streak (days with at least one habit completed)
 */
function calculateOverallStreak(user) {
    if (!user.habits || user.habits.length === 0) {
        return 0;
    }

    const completionDates = new Set();
    user.habits.forEach(habit => {
        if (habit.completedDates && Array.isArray(habit.completedDates)) {
            habit.completedDates.forEach(date => {
                completionDates.add(date);
            });
        }
    });

    const sortedDates = Array.from(completionDates).sort().reverse();
    const today = new Date().toISOString().split('T')[0];

    if (!sortedDates.includes(today)) {
        return 0;
    }

    let streak = 1;
    let currentDate = today;

    while (true) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = prevDate.toISOString().split('T')[0];

        if (sortedDates.includes(currentDate)) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Recalculate all streaks for a user
 */
function recalculateAllStreaks(user) {
    if (!user.habits) return user;

    let overallLongestStreak = 0;

    user.habits.forEach(habit => {
        habit.streak = calculateHabitStreak(habit);

        const longest = calculateLongestStreak(habit);
        habit.longestStreak = Math.max(habit.longestStreak || 0, longest);

        overallLongestStreak = Math.max(overallLongestStreak, habit.longestStreak);
    });

    if (user.rewards) {
        if (overallLongestStreak >= 365) user.rewards.status = 'legend';
        else if (overallLongestStreak >= 100) user.rewards.status = 'master';
        else if (overallLongestStreak >= 50) user.rewards.status = 'expert';
        else if (overallLongestStreak >= 30) user.rewards.status = 'advanced';
        else if (overallLongestStreak >= 7) user.rewards.status = 'star';
        else user.rewards.status = 'beginner';
    }

    return user;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), server: 'HabitLog' });
});

// =========== AUTH ROUTES ===========
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, email, password, age, dob, language } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        let category = '';
        if (age < 13) category = 'child';
        else if (age >= 13 && age < 20) category = 'teen';
        else if (age >= 20 && age < 60) category = 'adult';
        else category = 'senior';

        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password,
            age: parseInt(age),
            dob: dob,
            category,
            habits: [],
            rewards: {
                stars: 0,
                badges: [],
                status: 'beginner',
                streakMilestones: []
            },
            streakFreezes: {
                available: 0,
                used: 0,
                history: [],
                appliedDays: [],
                awardedStreaks: []
            },
            settings: {
                theme: 'light',
                language: language || 'english',
                notifications: true,
                reminderTime: '09:00'
            },
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            lastReminderSent: null
        };

        users.push(newUser);
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        req.session.userId = newUser.id;
        req.session.user = {
            id: newUser.id,
            username,
            email,
            age,
            dob,
            category,
            language: newUser.settings.language
        };

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                age: newUser.age,
                dob: newUser.dob,
                category: newUser.category,
                language: newUser.settings.language,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));

        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const updatedUser = recalculateAllStreaks(user);
        updatedUser.lastLogin = new Date().toISOString();

        const userIndex = users.findIndex(u => u.id === user.id);
        users[userIndex] = updatedUser;

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        req.session.userId = updatedUser.id;
        req.session.user = {
            id: updatedUser.id,
            username: updatedUser.username,
            email: updatedUser.email,
            age: updatedUser.age,
            category: updatedUser.category,
            language: updatedUser.settings.language
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }

            console.log('Session saved successfully for user:', updatedUser.email);

            const { password, ...userWithoutPassword } = updatedUser;

            res.json({
                message: 'Login successful',
                user: userWithoutPassword
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout successful' });
});

// =========== USER DATA ROUTES ===========
app.get('/api/user', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) {
            return res.status(404).json({ error: 'User not found' });
        }

        const updatedUser = recalculateAllStreaks(users[userIndex]);
        users[userIndex] = updatedUser;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        const { password, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);

    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== HABIT ROUTES ===========
app.get('/api/habits', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        const updatedUser = recalculateAllStreaks(users[userIndex]);
        users[userIndex] = updatedUser;
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.json(updatedUser.habits || []);
    } catch (error) {
        console.error('Error fetching habits:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/habits', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { name, description, color, icon } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        const newHabit = {
            id: Date.now().toString(),
            name,
            description: description || '',
            color: color || '#6366f1',
            icon: icon || '📝',
            createdAt: new Date().toISOString(),
            completedDates: [],
            streak: 0,
            longestStreak: 0,
            reminders: [],
            lastReminded: null
        };

        users[userIndex].habits.push(newHabit);
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.status(201).json(newHabit);
    } catch (error) {
        console.error('Error creating habit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/habits/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { name, description, color, icon } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        const habitIndex = users[userIndex].habits.findIndex(h => h.id === req.params.id);
        if (habitIndex === -1) return res.status(404).json({ error: 'Habit not found' });

        users[userIndex].habits[habitIndex] = {
            ...users[userIndex].habits[habitIndex],
            name: name || users[userIndex].habits[habitIndex].name,
            description: description !== undefined ? description : users[userIndex].habits[habitIndex].description,
            color: color || users[userIndex].habits[habitIndex].color,
            icon: icon || users[userIndex].habits[habitIndex].icon
        };

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        res.json(users[userIndex].habits[habitIndex]);
    } catch (error) {
        console.error('Error updating habit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/habits/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        users[userIndex].habits = users[userIndex].habits.filter(h => h.id !== req.params.id);
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.json({ message: 'Habit deleted successfully' });
    } catch (error) {
        console.error('Error deleting habit:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/habits/:id/toggle', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { date } = req.body;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        const habitIndex = users[userIndex].habits.findIndex(h => h.id === req.params.id);
        if (habitIndex === -1) return res.status(404).json({ error: 'Habit not found' });

        const habit = users[userIndex].habits[habitIndex];

        if (!habit.completedDates) {
            habit.completedDates = [];
        }

        const dateIndex = habit.completedDates.indexOf(targetDate);

        if (dateIndex === -1) {
            habit.completedDates.push(targetDate);
        } else {
            habit.completedDates.splice(dateIndex, 1);
        }

        habit.completedDates.sort();

        habit.streak = calculateHabitStreak(habit);
        habit.longestStreak = calculateLongestStreak(habit);

        const rewards = checkAndUpdateRewards(users[userIndex], habit);
        if (rewards) {
            users[userIndex].rewards = rewards;
        }

        checkAndAwardFreezes(users[userIndex]);

        recalculateAllStreaks(users[userIndex]);

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        const overallStreak = calculateOverallStreak(users[userIndex]);

        res.json({
            habit,
            rewards: users[userIndex].rewards,
            streakFreezes: users[userIndex].streakFreezes,
            overallStreak
        });
    } catch (error) {
        console.error('Toggle error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to check and update rewards
function checkAndUpdateRewards(user, habit) {
    const rewards = { ...user.rewards };
    const newMilestones = [];

    const streakMilestones = [7, 30, 50, 100, 365];
    streakMilestones.forEach(milestone => {
        if (habit.streak >= milestone && !rewards.streakMilestones.includes(milestone)) {
            newMilestones.push(milestone);
            rewards.streakMilestones.push(milestone);

            if (milestone === 7) {
                rewards.stars += 10;
                rewards.badges.push({ name: '7-Day Warrior', icon: '⭐', date: new Date().toISOString() });
            } else if (milestone === 30) {
                rewards.stars += 50;
                rewards.badges.push({ name: '30-Day Master', icon: '🌙', date: new Date().toISOString() });
            } else if (milestone === 50) {
                rewards.stars += 100;
                rewards.badges.push({ name: '50-Day Champion', icon: '🏆', date: new Date().toISOString() });
            } else if (milestone === 100) {
                rewards.stars += 500;
                rewards.badges.push({ name: '100-Day Legend', icon: '💯', date: new Date().toISOString() });
            } else if (milestone === 365) {
                rewards.stars += 1000;
                rewards.badges.push({ name: 'Year Warrior', icon: '👑', date: new Date().toISOString() });
            }
        }
    });

    const longestStreak = Math.max(...user.habits.map(h => h.longestStreak || 0));
    if (longestStreak >= 365) rewards.status = 'legend';
    else if (longestStreak >= 100) rewards.status = 'master';
    else if (longestStreak >= 50) rewards.status = 'expert';
    else if (longestStreak >= 30) rewards.status = 'advanced';
    else if (longestStreak >= 7) rewards.status = 'star';
    else rewards.status = 'beginner';

    return newMilestones.length > 0 ? rewards : null;
}

// Helper function to check and award streak freezes
function checkAndAwardFreezes(user) {
    if (!user.streakFreezes) {
        user.streakFreezes = {
            available: 0,
            used: 0,
            history: [],
            appliedDays: [],
            awardedStreaks: []
        };
    }

    const completionDates = new Set();
    user.habits.forEach(habit => {
        if (habit.completedDates) {
            habit.completedDates.forEach(date => completionDates.add(date));
        }
    });

    const sortedDates = Array.from(completionDates).sort();

    let consecutiveCount = 0;
    let lastDate = null;

    sortedDates.forEach(date => {
        if (lastDate) {
            const prev = new Date(lastDate);
            const curr = new Date(date);
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                consecutiveCount++;

                if (consecutiveCount >= 3 && user.streakFreezes.available < 2) {
                    const streakKey = `streak_${lastDate}_${date}`;

                    if (!user.streakFreezes.awardedStreaks) {
                        user.streakFreezes.awardedStreaks = [];
                    }

                    if (!user.streakFreezes.awardedStreaks.includes(streakKey)) {
                        user.streakFreezes.available++;
                        user.streakFreezes.awardedStreaks.push(streakKey);

                        if (!user.streakFreezes.history) {
                            user.streakFreezes.history = [];
                        }
                        user.streakFreezes.history.push({
                            date: new Date().toISOString().split('T')[0],
                            type: 'earned',
                            streakLength: consecutiveCount + 1
                        });
                    }
                }
            } else {
                consecutiveCount = 1;
            }
        } else {
            consecutiveCount = 1;
        }

        lastDate = date;
    });

    if (user.streakFreezes.available > 2) {
        user.streakFreezes.available = 2;
    }
}

// =========== SETTINGS ROUTES ===========
app.get('/api/settings', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.find(u => u.id === req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user.settings || { theme: 'light', language: 'english', notifications: true, reminderTime: '09:00' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/settings', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { theme, language, notifications, reminderTime } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        users[userIndex].settings = {
            theme: theme || users[userIndex].settings?.theme || 'light',
            language: language || users[userIndex].settings?.language || 'english',
            notifications: notifications !== undefined ? notifications : users[userIndex].settings?.notifications || true,
            reminderTime: reminderTime || users[userIndex].settings?.reminderTime || '09:00'
        };

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        res.json(users[userIndex].settings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== REMINDER SYSTEM ===========
cron.schedule('0 * * * *', () => {
    console.log('Checking for missed habits...');
    sendMissedHabitReminders();
});

function sendMissedHabitReminders() {
    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        users.forEach(user => {
            if (!user.settings.notifications) return;

            const incompleteHabits = user.habits.filter(habit =>
                !habit.completedDates.includes(today) &&
                (!habit.lastReminded || new Date(habit.lastReminded).getDate() !== now.getDate())
            );

            if (incompleteHabits.length > 0) {
                console.log(`Reminder for ${user.username}: You have ${incompleteHabits.length} incomplete habits`);

                incompleteHabits.forEach(habit => {
                    habit.lastReminded = new Date().toISOString();
                });
            }
        });

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    } catch (error) {
        console.error('Error sending reminders:', error);
    }
}

// =========== STREAK FREEZE ROUTES ===========
app.get('/api/streak-freeze', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.find(u => u.id === req.session.userId);

        if (!user) return res.status(404).json({ error: 'User not found' });

        if (!user.streakFreezes) {
            user.streakFreezes = {
                available: 0,
                used: 0,
                history: [],
                appliedDays: []
            };
            fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        }

        res.json(user.streakFreezes);
    } catch (error) {
        console.error('Error fetching streak freeze data:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/streak-freeze/apply', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const { date } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const userIndex = users.findIndex(u => u.id === req.session.userId);

        if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

        if (!users[userIndex].streakFreezes) {
            users[userIndex].streakFreezes = {
                available: 0,
                used: 0,
                history: [],
                appliedDays: []
            };
        }

        const streakFreezes = users[userIndex].streakFreezes;

        if (streakFreezes.available <= 0) {
            return res.status(400).json({ error: 'No streak freezes available' });
        }

        if (streakFreezes.appliedDays.includes(date)) {
            return res.status(400).json({ error: 'Freeze already applied for this date' });
        }

        streakFreezes.available--;
        streakFreezes.used++;
        streakFreezes.appliedDays.push(date);

        if (!streakFreezes.history) {
            streakFreezes.history = [];
        }

        streakFreezes.history.push({
            date: new Date().toISOString().split('T')[0],
            type: 'applied',
            appliedTo: date
        });

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));

        res.json({
            success: true,
            streakFreezes
        });
    } catch (error) {
        console.error('Error applying streak freeze:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== AI CHATBOT (hardcoded fallback route) ===========
// NOTE: This is the OLD route kept for backward compatibility.
//       The REAL AI-powered route is at /api/ai/chat (injected by ai-server-wrapper.js).
app.post('/api/chatbot/ask', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Invalid message format' });
        }

        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.find(u => u.id === req.session.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const response = generateChatbotResponse(message, user);
        res.json({ response });

    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'Server error processing your request' });
    }
});

// Hardcoded fallback generator (used only if AI route fails)
function generateChatbotResponse(message, user) {
    const lowerMsg = message.toLowerCase().trim();

    let age = user.age || 0;

    if (user.dob) {
        const birthDate = new Date(user.dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
    }

    const completionDates = new Set();
    user.habits.forEach(habit => {
        if (habit.completedDates && Array.isArray(habit.completedDates)) {
            habit.completedDates.forEach(date => {
                completionDates.add(date);
            });
        }
    });

    const sortedDates = Array.from(completionDates).sort();
    let mainStreak = 0;
    const today = new Date().toISOString().split('T')[0];

    if (sortedDates.includes(today)) {
        mainStreak = 1;
        let checkDate = new Date(today);
        for (let i = 1; i <= 365; i++) {
            const prevDate = new Date(checkDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];

            if (sortedDates.includes(prevDateStr)) {
                mainStreak++;
                checkDate = prevDate;
            } else {
                break;
            }
        }
    }

    const bestStreak = Math.max(...user.habits.map(h => h.longestStreak || 0), 0);
    const completedToday = user.habits.filter(h => h.completedDates?.includes(today)).length;

    let category = '';
    if (age < 13) category = 'child';
    else if (age >= 13 && age < 20) category = 'teen';
    else if (age >= 20 && age < 60) category = 'adult';
    else category = 'senior';

    const responses = {
        greeting: `Hello ${user.username}! 👋 I'm your HabitLog assistant. How can I help you today?`,
        name: `Your name is ${user.username}`,
        age: `You are ${age} years old. You are in the ${category} category.`,
        streak: `Your current streak is ${mainStreak} days. Your best streak ever is ${bestStreak} days.`,
        progress: `You've completed ${completedToday} out of ${user.habits.length} habits today.`,
        habits: `You are currently tracking ${user.habits.length} habits.`,
        status: `Your current status is: ${user.rewards?.status || 'beginner'}`,
        rewards: `You have ${user.rewards?.stars || 0} stars and ${user.rewards?.badges?.length || 0} badges.`,
        health: "Health is a state of complete physical, mental, and social well-being.",
        consistency: "Consistency is the key to success.",
        habit: "Habits are the small decisions you make and actions you perform every day.",
        motivation: "Keep going! Every day is a new opportunity to become better. 💪",
        help: "I can help you with: your streaks, habits, progress, rewards, health tips, and motivation.",
        unknown: "I didn't understand that. Try asking about: 'my streak', 'health tips', 'motivation', or 'my status'!",
        childTip: "Make habit tracking fun! Turn your habits into a game! 🎮",
        teenTip: "This is the perfect time to build lifelong habits! 🌱",
        adultTip: "Balance is key. Focus on habits that improve your health, career, and relationships. 💼",
        seniorTip: "It's never too late to build healthy habits! 🌟",
        freezes: `You have ${user.streakFreezes?.available || 0} streak freeze(s) available.`,
        tips: "Here are some tips: 1. Start small 2. Be consistent 3. Track your progress 4. Celebrate small wins 5. Don't break the chain! 🌟"
    };

    let responseKey = 'unknown';

    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) responseKey = 'greeting';
    else if (lowerMsg.includes('name') || lowerMsg.includes('who are you')) responseKey = 'name';
    else if (lowerMsg.includes('age') || lowerMsg.includes('how old')) responseKey = 'age';
    else if (lowerMsg.includes('streak') || lowerMsg.includes('days in a row')) responseKey = 'streak';
    else if (lowerMsg.includes('progress') || lowerMsg.includes('how am i doing')) responseKey = 'progress';
    else if (lowerMsg.includes('habit') || lowerMsg.includes('habits')) responseKey = 'habit';
    else if (lowerMsg.includes('status') || lowerMsg.includes('level')) responseKey = 'status';
    else if (lowerMsg.includes('reward') || lowerMsg.includes('badge') || lowerMsg.includes('star')) responseKey = 'rewards';
    else if (lowerMsg.includes('health') || lowerMsg.includes('healthy')) responseKey = 'health';
    else if (lowerMsg.includes('consistency') || lowerMsg.includes('consistent')) responseKey = 'consistency';
    else if (lowerMsg.includes('motivate') || lowerMsg.includes('motivation')) responseKey = 'motivation';
    else if (lowerMsg.includes('tip') || lowerMsg.includes('advice')) {
        responseKey = lowerMsg.includes('habit') ? 'tips' : category + 'Tip';
    }
    else if (lowerMsg.includes('freeze')) responseKey = 'freezes';
    else if (lowerMsg.includes('help')) responseKey = 'help';

    return responses[responseKey] || responses.unknown;
}

// =========== PAGE ROUTES ===========
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) next();
    else res.redirect('/');
};

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/calendar', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'calendar.html')));
app.get('/stats', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'stats.html')));
app.get('/progress', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'progress.html')));
app.get('/mood-tracker', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'mood-tracker.html')));
app.get('/chatbot', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'chatbot.html')));
app.get('/settings', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));

// Start server
app.listen(PORT, () => {
    console.log(`✅ HabitLog server running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`📅 Calendar: http://localhost:${PORT}/calendar`);
    console.log(`📈 Statistics: http://localhost:${PORT}/stats`);
    console.log(`📊 Progress: http://localhost:${PORT}/progress`);
    console.log(`😊 Mood Tracker: http://localhost:${PORT}/mood-tracker`);
    console.log(`🤖 AI Chatbot: http://localhost:${PORT}/chatbot`);
    console.log(`⚙️ Settings: http://localhost:${PORT}/settings`);
});