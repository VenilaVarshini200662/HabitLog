// routes/ai-routes.js
const express = require('express');
const aiService = require('./ai-service');
const db = require('../db');

const router = express.Router();
const conversations = new Map();

async function getUser(userId) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
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
}

router.post('/chat', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const { message, resetHistory } = req.body;
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Invalid message' });
        }
        if (message.length > 1000) {
            return res.status(400).json({ error: 'Message too long' });
        }

        const user = await getUser(req.session.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (resetHistory) conversations.delete(user.id);
        if (!conversations.has(user.id)) conversations.set(user.id, []);
        const history = conversations.get(user.id);

        if (!aiService.isAvailable()) {
            return res.status(503).json({
                error: 'AI not configured',
                response: 'AI is not configured. Please add GROQ_API_KEY.'
            });
        }

        const aiResp = await aiService.getResponse(message, user, history);

        history.push({ role: 'user', content: message });
        history.push({ role: 'assistant', content: aiResp });
        if (history.length > 20) history.splice(0, history.length - 20);

        res.json({ response: aiResp, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed', response: 'Something went wrong.' });
    }
});

router.post('/chat/reset', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    conversations.delete(req.session.userId);
    res.json({ success: true });
});

router.get('/status', (req, res) => {
    res.json({
        available: aiService.isAvailable(),
        provider: process.env.GROQ_API_KEY ? 'groq' : 'none',
        model: 'openai/gpt-oss-120b'
    });
});

module.exports = router;