// routes/ai-routes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const aiService = require('./ai-service');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const usersFile = path.join(DATA_DIR, 'users.json');

console.log('📁 AI routes reading from:', usersFile);
const conversations = new Map();

function readUsers() {
    try {
        if (!fs.existsSync(usersFile)) return [];
        return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    } catch { return []; }
}

function getUser(req) {
    if (!req.session || !req.session.userId) return null;
    return readUsers().find(u => u.id === req.session.userId) || null;
}

router.post('/chat', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not authenticated' });

        const { message, resetHistory } = req.body;
        if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Invalid message' });
        if (message.length > 1000) return res.status(400).json({ error: 'Too long' });

        const user = getUser(req);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (resetHistory) conversations.delete(user.id);
        if (!conversations.has(user.id)) conversations.set(user.id, []);
        const hist = conversations.get(user.id);

        if (!aiService.isAvailable()) {
            return res.status(503).json({
                error: 'AI not configured',
                response: 'AI not configured. Add GROQ_API_KEY.'
            });
        }

        const aiResp = await aiService.getResponse(message, user, hist);

        hist.push({ role: 'user', content: message });
        hist.push({ role: 'assistant', content: aiResp });
        if (hist.length > 20) hist.splice(0, hist.length - 20);

        res.json({ response: aiResp, timestamp: new Date().toISOString() });
    } catch (e) {
        console.error('Chat error:', e);
        res.status(500).json({ error: 'Failed', response: 'Something went wrong.' });
    }
});

router.post('/chat/reset', (req, res) => {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
    conversations.delete(req.session.userId);
    res.json({ success: true });
});

router.get('/status', (req, res) => {
    res.json({
        available: aiService.isAvailable(),
        provider: process.env.GROQ_API_KEY ? 'groq' : 'none',
        model: 'llama-3.3-70b-versatile'
    });
});

module.exports = router;