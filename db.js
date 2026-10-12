// db.js
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
}

const useSSL = process.env.DATABASE_URL && (
    process.env.DATABASE_URL.includes('neon.tech') ||
    process.env.DATABASE_URL.includes('render.com')
);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
    console.error('❌ Postgres pool error:', err.message);
});

async function initSchema() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                age INTEGER,
                dob TEXT,
                category TEXT,
                habits JSONB DEFAULT '[]'::jsonb,
                rewards JSONB DEFAULT '{}'::jsonb,
                streak_freezes JSONB DEFAULT '{}'::jsonb,
                settings JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                last_login TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('✅ users table ready');
    } finally {
        client.release();
    }
}

module.exports = {
    query: (text, params) => pool.query(text, params),
    initSchema,
    pool
};