// routes/api.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const router = express.Router();

const usersFilePath = path.join(__dirname, '../data/users.json');

// Helper functions
const readUsers = () => {
  const data = fs.readFileSync(usersFilePath);
  return JSON.parse(data);
};

const writeUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
};

// Authentication routes
router.post('/auth/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const users = readUsers();
    
    // Check if user exists
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      habits: [],
      settings: {
        theme: 'light',
        language: 'english',
        notifications: true
      },
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    writeUsers(users);
    
    req.session.userId = newUser.id;
    req.session.user = { id: newUser.id, username, email };
    
    res.status(201).json({ message: 'User created successfully', user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readUsers();
    
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.userId = user.id;
    req.session.user = { id: user.id, username: user.username, email };
    
    res.json({ message: 'Login successful', user: req.session.user });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout successful' });
});

// Habit routes
router.get('/habits', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  
  res.json(user.habits || []);
});

router.post('/habits', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { name, description, color, icon } = req.body;
  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === req.session.userId);
  
  const newHabit = {
    id: Date.now().toString(),
    name,
    description,
    color: color || '#6366f1',
    icon: icon || '📝',
    createdAt: new Date().toISOString(),
    completedDates: [],
    streak: 0,
    longestStreak: 0
  };
  
  users[userIndex].habits.push(newHabit);
  writeUsers(users);
  
  res.status(201).json(newHabit);
});

router.put('/habits/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { name, description, color, icon } = req.body;
  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === req.session.userId);
  
  const habitIndex = users[userIndex].habits.findIndex(h => h.id === req.params.id);
  if (habitIndex === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  
  users[userIndex].habits[habitIndex] = {
    ...users[userIndex].habits[habitIndex],
    name: name || users[userIndex].habits[habitIndex].name,
    description: description || users[userIndex].habits[habitIndex].description,
    color: color || users[userIndex].habits[habitIndex].color,
    icon: icon || users[userIndex].habits[habitIndex].icon
  };
  
  writeUsers(users);
  res.json(users[userIndex].habits[habitIndex]);
});

router.delete('/habits/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === req.session.userId);
  
  users[userIndex].habits = users[userIndex].habits.filter(h => h.id !== req.params.id);
  writeUsers(users);
  
  res.json({ message: 'Habit deleted successfully' });
});

router.post('/habits/:id/toggle', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { date } = req.body;
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === req.session.userId);
  const habitIndex = users[userIndex].habits.findIndex(h => h.id === req.params.id);
  
  if (habitIndex === -1) {
    return res.status(404).json({ error: 'Habit not found' });
  }
  
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
  
  writeUsers(users);
  res.json(habit);
});

// Settings routes
router.get('/settings', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  
  res.json(user.settings || { theme: 'light', language: 'english', notifications: true });
});

router.put('/settings', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const { theme, language, notifications } = req.body;
  const users = readUsers();
  const userIndex = users.findIndex(u => u.id === req.session.userId);
  
  users[userIndex].settings = {
    theme: theme || users[userIndex].settings?.theme || 'light',
    language: language || users[userIndex].settings?.language || 'english',
    notifications: notifications !== undefined ? notifications : users[userIndex].settings?.notifications || true
  };
  
  writeUsers(users);
  res.json(users[userIndex].settings);
});

module.exports = router;