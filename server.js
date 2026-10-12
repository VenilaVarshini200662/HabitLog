// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');

const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

const corsOptions = {
    origin: isProd ? [process.env.FRONTEND_URL || true] : 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session store backed by PostgreSQL
const sslConfig = process.env.DATABASE_URL && (
    process.env.DATABASE_URL.includes('neon.tech') ||
    process.env.DATABASE_URL.includes('render.com')
) ? { rejectUnauthorized: false } : false;

app.use(session({
    store: new pgSession({
        conString: process.env.DATABASE_URL,
        tableName: 'session',
        createTableIfMissing: true,
        ssl: sslConfig
    }),
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

// =========== STREAK HELPERS ===========
function calculateHabitStreak(habit) {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;
    const sortedDates = [...habit.completedDates].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    if (!sortedDates.includes(today)) return 0;
    let streak = 1;
    let currentDate = today;
    while (true) {
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = prevDate.toISOString().split('T')[0];
        if (sortedDates.includes(currentDate)) streak++;
        else break;
    }
    return streak;
}

function calculateLongestStreak(habit) {
    if (!habit.completedDates || habit.completedDates.length === 0) return 0;
    const sortedDates = [...habit.completedDates].sort();
    let longest = 0, current = 1, lastDate = sortedDates[0];
    for (let i = 1; i < sortedDates.length; i++) {
        const diffDays = Math.round(
            (new Date(sortedDates[i]) - new Date(lastDate)) / (1000 * 60 * 60 * 24)
        );
        if (diffDays === 1) current++;
        else if (diffDays > 1) { longest = Math.max(longest, current); current = 1; }
        lastDate = sortedDates[i];
    }
    return Math.max(longest, current);
}

function recalculateAllStreaks(user) {
    if (!user.habits) return user;
    let overallLongest = 0;
    user.habits.forEach(habit => {
        habit.streak = calculateHabitStreak(habit);
        const longest = calculateLongestStreak(habit);
        habit.longestStreak = Math.max(habit.longestStreak || 0, longest);
        overallLongest = Math.max(overallLongest, habit.longestStreak);
    });
    if (user.rewards) {
        if (overallLongest >= 365) user.rewards.status = 'legend';
        else if (overallLongest >= 100) user.rewards.status = 'master';
        else if (overallLongest >= 50) user.rewards.status = 'expert';
        else if (overallLongest >= 30) user.rewards.status = 'advanced';
        else if (overallLongest >= 7) user.rewards.status = 'star';
        else user.rewards.status = 'beginner';
    }
    return user;
}

// =========== HEALTH ===========
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), server: 'HabitLog' });
});

// =========== AUTH ===========
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, email, password, age, dob, language } = req.body;

        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        let category = 'adult';
        if (age < 13) category = 'child';
        else if (age < 20) category = 'teen';
        else if (age >= 60) category = 'senior';

        const newUser = {
            id: Date.now().toString(),
            username,
            email,
            password,
            age: parseInt(age) || 0,
            dob: dob || null,
            category,
            habits: [],
            rewards: { stars: 0, badges: [], status: 'beginner', streakMilestones: [] },
            streakFreezes: { available: 0, used: 0, history: [], appliedDays: [], awardedStreaks: [] },
            settings: {
                theme: 'light',
                language: language || 'english',
                notifications: true,
                reminderTime: '09:00'
            }
        };

        await db.query(
            `INSERT INTO users (id, username, email, password, age, dob, category, habits, rewards, streak_freezes, settings)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                newUser.id, newUser.username, newUser.email, newUser.password,
                newUser.age, newUser.dob, newUser.category,
                JSON.stringify(newUser.habits),
                JSON.stringify(newUser.rewards),
                JSON.stringify(newUser.streakFreezes),
                JSON.stringify(newUser.settings)
            ]
        );

        req.session.userId = newUser.id;
        req.session.user = {
            id: newUser.id, username, email, age, dob, category,
            language: newUser.settings.language
        };

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id, username, email,
                age: newUser.age, dob: newUser.dob,
                category: newUser.category,
                language: newUser.settings.language
            }
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error during signup' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1 AND password = $2',
            [email, password]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const row = result.rows[0];
        const user = {
            id: row.id,
            username: row.username,
            email: row.email,
            age: row.age,
            dob: row.dob,
            category: row.category,
            habits: row.habits || [],
            rewards: row.rewards || {},
            streakFreezes: row.streak_freezes || {},
            settings: row.settings || {}
        };

        const updated = recalculateAllStreaks(user);

        await db.query(
            'UPDATE users SET habits = $1, rewards = $2, last_login = NOW() WHERE id = $3',
            [JSON.stringify(updated.habits), JSON.stringify(updated.rewards), user.id]
        );

        req.session.userId = user.id;
        req.session.user = {
            id: user.id, username: user.username, email: user.email,
            age: user.age, category: user.category,
            language: user.settings.language || 'english'
        };

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Session error' });
            }
            console.log('Session saved for user:', user.email);
            const { password, ...safe } = user;
            res.json({ message: 'Login successful', user: safe });
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logout successful' });
});

// =========== USER ===========
app.get('/api/user', async (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const result = await db.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const row = result.rows[0];
        const user = {
            id: row.id, username: row.username, email: row.email,
            age: row.age, dob: row.dob, category: row.category,
            habits: row.habits || [], rewards: row.rewards || {},
            streakFreezes: row.streak_freezes || {}, settings: row.settings || {}
        };

        const updated = recalculateAllStreaks(user);

        await db.query(
            'UPDATE users SET habits = $1, rewards = $2 WHERE id = $3',
            [JSON.stringify(updated.habits), JSON.stringify(updated.rewards), user.id]
        );

        const { password, ...safe } = updated;
        res.json(safe);
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== HABITS ===========
app.get('/api/habits', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const result = await db.query('SELECT habits FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0].habits || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/habits', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const { name, description, color, icon } = req.body;
        const result = await db.query('SELECT habits FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const habits = result.rows[0].habits || [];
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
        habits.push(newHabit);

        await db.query('UPDATE users SET habits = $1 WHERE id = $2', [JSON.stringify(habits), req.session.userId]);
        res.status(201).json(newHabit);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/habits/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const { name, description, color, icon } = req.body;
        const result = await db.query('SELECT habits FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const habits = result.rows[0].habits || [];
        const idx = habits.findIndex(h => h.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Habit not found' });

        habits[idx] = {
            ...habits[idx],
            name: name || habits[idx].name,
            description: description !== undefined ? description : habits[idx].description,
            color: color || habits[idx].color,
            icon: icon || habits[idx].icon
        };

        await db.query('UPDATE users SET habits = $1 WHERE id = $2', [JSON.stringify(habits), req.session.userId]);
        res.json(habits[idx]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/habits/:id', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const result = await db.query('SELECT habits FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const habits = (result.rows[0].habits || []).filter(h => h.id !== req.params.id);

        await db.query('UPDATE users SET habits = $1 WHERE id = $2', [JSON.stringify(habits), req.session.userId]);
        res.json({ message: 'Habit deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/habits/:id/toggle', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const targetDate = req.body.date || new Date().toISOString().split('T')[0];
        const result = await db.query('SELECT habits, rewards, streak_freezes FROM users WHERE id = $1', [req.session.userId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const habits = result.rows[0].habits || [];
        const idx = habits.findIndex(h => h.id === req.params.id);
        if (idx === -1) return res.status(404).json({ error: 'Habit not found' });

        const habit = habits[idx];
        if (!habit.completedDates) habit.completedDates = [];
        const di = habit.completedDates.indexOf(targetDate);
        if (di === -1) habit.completedDates.push(targetDate);
        else habit.completedDates.splice(di, 1);
        habit.completedDates.sort();

        habit.streak = calculateHabitStreak(habit);
        habit.longestStreak = calculateLongestStreak(habit);

        await db.query(
            'UPDATE users SET habits = $1 WHERE id = $2',
            [JSON.stringify(habits), req.session.userId]
        );

        res.json({ habit, rewards: result.rows[0].rewards, streakFreezes: result.rows[0].streak_freezes });
    } catch (err) {
        console.error('Toggle error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== SETTINGS ===========
app.get('/api/settings', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const r = await db.query('SELECT settings FROM users WHERE id = $1', [req.session.userId]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(r.rows[0].settings || {});
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/settings', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const { theme, language, notifications, reminderTime } = req.body;
        const r = await db.query('SELECT settings FROM users WHERE id = $1', [req.session.userId]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });

        const current = r.rows[0].settings || {};
        const updated = {
            theme: theme || current.theme || 'light',
            language: language || current.language || 'english',
            notifications: notifications !== undefined ? notifications : (current.notifications ?? true),
            reminderTime: reminderTime || current.reminderTime || '09:00'
        };

        await db.query('UPDATE users SET settings = $1 WHERE id = $2', [JSON.stringify(updated), req.session.userId]);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== STREAK FREEZE ===========
app.get('/api/streak-freeze', async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const r = await db.query('SELECT streak_freezes FROM users WHERE id = $1', [req.session.userId]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(r.rows[0].streak_freezes || { available: 0, used: 0, history: [], appliedDays: [] });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// =========== REMINDER CRON ===========
cron.schedule('0 * * * *', () => {
    console.log('Checking for missed habits...');
});

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

// =========== START ===========
(async () => {
    try {
        await db.initSchema();
        app.listen(PORT, () => {
            console.log(`✅ HabitLog running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('❌ Failed to start:', err);
        process.exit(1);
    }
})();