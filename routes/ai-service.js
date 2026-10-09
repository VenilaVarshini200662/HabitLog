// routes/ai-service.js
const GroqModule = require('groq-sdk');
const Groq = GroqModule.default || GroqModule.Groq || GroqModule;

class AIService {
    constructor() {
        this.groq = null;
        if (process.env.GROQ_API_KEY) {
            try {
                this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                console.log('✅ Groq AI initialized');
            } catch (err) {
                console.error('❌ Groq init failed:', err.message);
            }
        } else {
            console.warn('⚠️  GROQ_API_KEY not set');
        }
    }

    buildSystemPrompt(user) {
        let age = user.age || 0;
        if (user.dob) {
            const b = new Date(user.dob);
            const t = new Date();
            age = t.getFullYear() - b.getFullYear();
            const m = t.getMonth() - b.getMonth();
            if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
        }

        const dates = new Set();
        (user.habits || []).forEach(h => {
            (h.completedDates || []).forEach(d => dates.add(d));
        });

        const sorted = Array.from(dates).sort();
        const today = new Date().toISOString().split('T')[0];
        let mainStreak = 0;
        if (sorted.includes(today)) {
            mainStreak = 1;
            for (let i = 1; i <= 365; i++) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                if (sorted.includes(d.toISOString().split('T')[0])) mainStreak++;
                else break;
            }
        }

        const best = Math.max(...(user.habits || []).map(h => h.longestStreak || 0), 0);
        const todayCount = (user.habits || []).filter(h => h.completedDates?.includes(today)).length;
        const total = (user.habits || []).reduce((s, h) => s + (h.completedDates?.length || 0), 0);

        let category = 'adult';
        if (age < 13) category = 'child';
        else if (age < 20) category = 'teen';
        else if (age >= 60) category = 'senior';

        const list = (user.habits || []).map(h =>
            `- ${h.icon || '📝'} ${h.name} (streak: ${h.streak || 0})`
        ).join('\n') || 'No habits yet';

        return `You are "HabitBot", the AI assistant for HabitLog.

## User
- Name: ${user.username}
- Age: ${age} (${category})

## Stats
- Habits: ${(user.habits || []).length}
- Current streak: ${mainStreak}
- Best streak: ${best}
- Today: ${todayCount}/${(user.habits || []).length}
- Total completions: ${total}
- Status: ${user.rewards?.status || 'beginner'}

## Habits
${list}

## Rules
1. Be warm, motivating, short (2-4 sentences)
2. Use emojis naturally
3. Reference actual data above when relevant
4. NEVER invent stats
5. Adjust tone: child=playful, teen=casual, adult=professional, senior=warm

Respond in English only.`;
    }

    async getResponse(msg, user, history = []) {
        if (!this.groq) return this.fallback(msg, user);
        try {
            const messages = [{ role: 'system', content: this.buildSystemPrompt(user) }];
            history.slice(-10).forEach(m => messages.push({ role: m.role, content: m.content }));
            messages.push({ role: 'user', content: msg });

            console.log('🤖 Sending to Groq...');
            const c = await this.groq.chat.completions.create({
                messages,
                model: 'openai/gpt-oss-120b',
                temperature: 0.7,
                max_tokens: 300,
                top_p: 0.9
            });

            const r = c.choices[0]?.message?.content?.trim();
            if (!r) throw new Error('Empty');
            console.log('✅ AI responded');
            return r;
        } catch (e) {
            console.error('❌ AI error:', e.message);
            if (e.status === 401) return "Auth issue with AI service.";
            if (e.status === 429) return "Too many requests. Try again! ⏳";
            return this.fallback(msg, user);
        }
    }

    fallback(msg, user) {
        const m = msg.toLowerCase();
        if (m.includes('hello') || m.includes('hi')) return `Hello ${user.username}! 👋`;
        if (m.includes('streak')) return `Keep building those streaks! 🔥`;
        if (m.includes('motivat')) return "Every small step counts! 💪";
        return "Consistency is key to building great habits! 🌟";
    }

    isAvailable() { return this.groq !== null; }
}

module.exports = new AIService();
