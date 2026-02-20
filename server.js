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

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// Ensure users file exists
const usersFilePath = path.join(dataDir, 'users.json');
if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]));
}

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'habitlog-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), server: 'HabitLog' });
});

// =========== AUTH ROUTES ===========
// =========== AUTH ROUTES ===========
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, email, password, age, dob, language } = req.body;
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        
        if (users.find(u => u.email === email)) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Categorize user based on age
        let category = '';
        if (age < 13) category = 'child';
        else if (age >= 13 && age < 20) category = 'teen';
        else if (age >= 20 && age < 60) category = 'adult';
        else category = 'senior';
        
        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password, // In production, hash this!
            age: parseInt(age),
            dob: dob, // Store date of birth
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
                appliedDays: []
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
            dob,  // Include dob in session
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
                dob: newUser.dob,  // Return dob to client
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
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        
        req.session.userId = user.id;
        req.session.user = { 
            id: user.id, 
            username: user.username, 
            email: user.email,
            age: user.age,
            category: user.category,
            language: user.settings.language
        };
        
        res.json({ 
            message: 'Login successful', 
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                age: user.age,
                category: user.category,
                language: user.settings.language,
                rewards: user.rewards,
                streakFreezes: user.streakFreezes
            }
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
        const user = users.find(u => u.id === req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Remove sensitive information
        const { password, ...userWithoutPassword } = user;
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
        const user = users.find(u => u.id === req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user.habits || []);
    } catch (error) {
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
        const dateIndex = habit.completedDates.indexOf(targetDate);
        
        if (dateIndex === -1) {
            habit.completedDates.push(targetDate);
        } else {
            habit.completedDates.splice(dateIndex, 1);
        }
        
        // Calculate streak
        const sortedDates = habit.completedDates.sort();
        let currentStreak = 0;
        let longestStreak = habit.longestStreak || 0;
        
        if (sortedDates.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            if (sortedDates.includes(today)) {
                currentStreak = 1;
                let checkDate = yesterday;
                
                while (sortedDates.includes(checkDate)) {
                    currentStreak++;
                    checkDate = new Date(new Date(checkDate) - 86400000).toISOString().split('T')[0];
                }
            }
            
            longestStreak = Math.max(longestStreak, currentStreak);
        }
        
        habit.streak = currentStreak;
        habit.longestStreak = longestStreak;
        
        // Check for streak milestones and update rewards
        const rewards = checkAndUpdateRewards(users[userIndex], habit);
        if (rewards) {
            users[userIndex].rewards = rewards;
        }
        
        // Check for streak freezes
        checkAndAwardFreezes(users[userIndex]);
        
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        res.json({ habit, rewards: users[userIndex].rewards, streakFreezes: users[userIndex].streakFreezes });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to check and update rewards
function checkAndUpdateRewards(user, habit) {
    const rewards = { ...user.rewards };
    const newMilestones = [];
    
    // Check streak milestones
    const streakMilestones = [7, 30, 50, 100, 365];
    streakMilestones.forEach(milestone => {
        if (habit.streak >= milestone && !rewards.streakMilestones.includes(milestone)) {
            newMilestones.push(milestone);
            rewards.streakMilestones.push(milestone);
            
            // Award stars based on milestone
            if (milestone === 7) {
                rewards.stars += 10;
                rewards.badges.push({ name: '7-Day Star', icon: '⭐', date: new Date().toISOString() });
            } else if (milestone === 30) {
                rewards.stars += 50;
                rewards.badges.push({ name: 'Monthly Master', icon: '🌙', date: new Date().toISOString() });
            } else if (milestone === 50) {
                rewards.stars += 100;
                rewards.badges.push({ name: '50-Day Champion', icon: '🏆', date: new Date().toISOString() });
            } else if (milestone === 100) {
                rewards.stars += 500;
                rewards.badges.push({ name: 'Century Club', icon: '💯', date: new Date().toISOString() });
            } else if (milestone === 365) {
                rewards.stars += 1000;
                rewards.badges.push({ name: 'Year Warrior', icon: '👑', date: new Date().toISOString() });
            }
        }
    });
    
    // Update status based on longest streak
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
            appliedDays: []
        };
    }
    
    // Get all unique completion dates
    const completionDates = new Set();
    user.habits.forEach(habit => {
        if (habit.completedDates) {
            habit.completedDates.forEach(date => completionDates.add(date));
        }
    });
    
    const sortedDates = Array.from(completionDates).sort();
    
    // Find consecutive streaks of 3 days or more
    let consecutiveCount = 0;
    let lastDate = null;
    
    sortedDates.forEach(date => {
        if (lastDate) {
            const prev = new Date(lastDate);
            const curr = new Date(date);
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                consecutiveCount++;
                
                // Award freeze for every 3-day streak (but don't exceed max 2)
                if (consecutiveCount >= 3 && user.streakFreezes.available < 2) {
                    // Check if we already awarded for this streak
                    const streakKey = `streak_${lastDate}_${date}`;
                    const awardedStreaks = user.streakFreezes.awardedStreaks || [];
                    
                    if (!awardedStreaks.includes(streakKey)) {
                        user.streakFreezes.available++;
                        if (!user.streakFreezes.awardedStreaks) {
                            user.streakFreezes.awardedStreaks = [];
                        }
                        user.streakFreezes.awardedStreaks.push(streakKey);
                        
                        // Log freeze award
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
    
    // Ensure freezes don't exceed maximum
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
// Schedule task to run every hour to check for missed habits
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
                // In a real app, you'd send email/SMS/push notification here
                console.log(`Reminder for ${user.username}: You have ${incompleteHabits.length} incomplete habits`);
                
                // Mark as reminded
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
        
        // Initialize streakFreezes if not exists
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
        
        // Initialize streakFreezes if not exists
        if (!users[userIndex].streakFreezes) {
            users[userIndex].streakFreezes = {
                available: 0,
                used: 0,
                history: [],
                appliedDays: []
            };
        }
        
        const streakFreezes = users[userIndex].streakFreezes;
        
        // Check if freeze is available
        if (streakFreezes.available <= 0) {
            return res.status(400).json({ error: 'No streak freezes available' });
        }
        
        // Check if already applied for this date
        if (streakFreezes.appliedDays.includes(date)) {
            return res.status(400).json({ error: 'Freeze already applied for this date' });
        }
        
        // Apply freeze
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

// =========== AI CHATBOT ROUTES ===========
app.post('/api/chatbot/ask', (req, res) => {
    // Check authentication
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        const { message } = req.body;
        
        // Validate message
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Invalid message format' });
        }
        
        // Read users data
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
        const user = users.find(u => u.id === req.session.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Generate response
        const response = generateChatbotResponse(message, user);
        res.json({ response });
        
    } catch (error) {
        console.error('Chatbot error:', error);
        res.status(500).json({ error: 'Server error processing your request' });
    }
});

// Enhanced chatbot response generator for English-only
// server.js - Replace the entire generateChatbotResponse function

// Enhanced chatbot response generator with correct age from DOB
function generateChatbotResponse(message, user) {
    const lowerMsg = message.toLowerCase().trim();
    
    // ===== FIXED: Calculate age from date of birth =====
    let age = user.age || 0;
    
    // If we have dob, calculate current age (in case user had birthday since signup)
    if (user.dob) {
        const birthDate = new Date(user.dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        // Adjust age if birthday hasn't occurred yet this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
    }
    
    // ===== FIXED: Calculate main streak correctly =====
    // Get all unique dates where at least one habit was completed
    const completionDates = new Set();
    user.habits.forEach(habit => {
        if (habit.completedDates && Array.isArray(habit.completedDates)) {
            habit.completedDates.forEach(date => {
                completionDates.add(date);
            });
        }
    });
    
    // Calculate main streak (consecutive days with at least one habit)
    const sortedDates = Array.from(completionDates).sort();
    let mainStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    if (sortedDates.includes(today)) {
        mainStreak = 1;
        let checkDate = new Date(today);
        for (let i = 1; i <= 365; i++) {
            const prevDate = new Date(checkDate);
            prevDate.setDate(prevDate.getDate() - i);
            const prevDateStr = prevDate.toISOString().split('T')[0];
            
            if (sortedDates.includes(prevDateStr)) {
                mainStreak++;
            } else {
                break;
            }
        }
    }
    
    // Calculate total streak (sum of all habit streaks) - for reference
    const bestStreak = Math.max(...user.habits.map(h => h.longestStreak || 0), 0);
    const today_date = new Date().toISOString().split('T')[0];
    const completedToday = user.habits.filter(h => h.completedDates?.includes(today_date)).length;
    
    // Get age category based on calculated age
    let category = '';
    if (age < 13) category = 'child';
    else if (age >= 13 && age < 20) category = 'teen';
    else if (age >= 20 && age < 60) category = 'adult';
    else category = 'senior';
    
    // Response templates
    const responses = {
        greeting: `Hello ${user.username}! 👋 I'm your HabitLog assistant. How can I help you today?`,
        name: `Your name is ${user.username}`,
        age: `You are ${age} years old . You are in the ${category} category.`,
        streak: `Your current streak is ${mainStreak} days. You've been consistent for ${mainStreak} day${mainStreak !== 1 ? 's' : ''} in a row! Your best streak ever is ${bestStreak} days.`,
        progress: `Your progress is looking great! You've completed ${completedToday} out of ${user.habits.length} habits today.`,
        habits: `You are currently tracking ${user.habits.length} habits.`,
        status: `Your current status is: ${user.rewards?.status || 'beginner'}`,
        rewards: `You have ${user.rewards?.stars || 0} stars and ${user.rewards?.badges?.length || 0} badges.`,
        health: "Health is a state of complete physical, mental, and social well-being. By maintaining good habits, you can achieve optimal health.",
        consistency: "Consistency is the key to success. Small daily improvements lead to stunning results over time.",
        habit: "Habits are the small decisions you make and actions you perform every day. Good habits can transform your life.",
        motivation: "Keep going! Every day is a new opportunity to become better. You've got this! 💪",
        help: "I can help you with: your streaks, habits, progress, rewards, health tips, and motivation. What would you like to know?",
        unknown: "I'm sorry, I didn't understand that. Could you please rephrase? Try asking about: 'my streak', 'health tips', 'motivation', 'freezes', or 'my status'!",
        childTip: "Make habit tracking fun! Try turning your habits into a game. Every completed habit is a point scored! 🎮",
        teenTip: "This is the perfect time to build lifelong habits. Start small, stay consistent, and watch yourself grow! 🌱",
        adultTip: "Balance is key. Focus on habits that improve your health, career, and relationships. You've got this! 💼",
        seniorTip: "It's never too late to build healthy habits. Small daily actions can greatly improve your quality of life! 🌟",
        freezes: `You have ${user.streakFreezes?.available || 0} streak freeze(s) available. You earn 1 freeze for every 3-day streak, and can store up to 2 freezes. Freezes protect your streak when you miss a day!`,
        tips: "Here are some tips for building habits: 1. Start small 2. Be consistent 3. Track your progress 4. Celebrate small wins 5. Don't break the chain! 🌟"
    };
    
    // Select the appropriate response based on intent
    let responseKey = 'unknown';
    
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
        responseKey = 'greeting';
    } 
    else if (lowerMsg.includes('name') || lowerMsg.includes('who are you')) {
        responseKey = 'name';
    } 
    else if (lowerMsg.includes('age') || lowerMsg.includes('how old')) {
        responseKey = 'age';
    } 
    else if (lowerMsg.includes('streak') || lowerMsg.includes('days in a row')) {
        responseKey = 'streak';
    } 
    else if (lowerMsg.includes('progress') || lowerMsg.includes('how am i doing')) {
        responseKey = 'progress';
    } 
    else if (lowerMsg.includes('habit') || lowerMsg.includes('habits') || lowerMsg.includes('what habits')) {
        responseKey = 'habit';
    } 
    else if (lowerMsg.includes('status') || lowerMsg.includes('level')) {
        responseKey = 'status';
    } 
    else if (lowerMsg.includes('reward') || lowerMsg.includes('badge') || lowerMsg.includes('star') || lowerMsg.includes('badges')) {
        responseKey = 'rewards';
    } 
    else if (lowerMsg.includes('health') || lowerMsg.includes('healthy') || lowerMsg.includes('wellness')) {
        responseKey = 'health';
    } 
    else if (lowerMsg.includes('consistency') || lowerMsg.includes('consistent') || lowerMsg.includes('regular')) {
        responseKey = 'consistency';
    }
    else if (lowerMsg.includes('motivate') || lowerMsg.includes('motivation') || lowerMsg.includes('inspire') || lowerMsg.includes('encourage')) {
        responseKey = 'motivation';
    }
    else if (lowerMsg.includes('tip') || lowerMsg.includes('tips') || lowerMsg.includes('advice') || lowerMsg.includes('suggest')) {
        if (lowerMsg.includes('habit')) {
            responseKey = 'tips';
        } else {
            responseKey = category + 'Tip';
        }
    }
    else if (lowerMsg.includes('freeze') || lowerMsg.includes('freezes')) {
        responseKey = 'freezes';
    }
    else if (lowerMsg.includes('help') || lowerMsg.includes('support')) {
        responseKey = 'help';
    }
    
    // Get the response template
    let response = responses[responseKey] || responses.unknown;
    
    return response;
}

// =========== PAGE ROUTES ===========
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) next();
    else res.redirect('/');
};
app.get('/chatbot', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'public', 'chatbot.html')));

// Serve HTML pages - ADDED chatbot route back
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