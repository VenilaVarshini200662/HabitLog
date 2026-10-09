// ai-server-wrapper.js
// Wraps server.js and injects AI routes WITHOUT modifying server.js

const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

console.log('🚀 HabitLog starting with AI integration...');
console.log('📋 GROQ_API_KEY set:', !!process.env.GROQ_API_KEY);

const aiRoutes = require('./routes/ai-routes');

let appRef = null;
const originalExpress = express;

const expressProxy = function () {
    const app = originalExpress();
    appRef = app;
    return app;
};

Object.assign(expressProxy, originalExpress);
expressProxy.static = originalExpress.static;
expressProxy.json = originalExpress.json;
expressProxy.urlencoded = originalExpress.urlencoded;
expressProxy.Router = originalExpress.Router;

require.cache[require.resolve('express')].exports = expressProxy;

console.log('📦 Loading server.js...');
require('./server.js');

setTimeout(() => {
    if (appRef) {
        appRef.use('/api/ai', aiRoutes);
        console.log('');
        console.log('✅ AI routes injected:');
        console.log('   POST /api/ai/chat');
        console.log('   POST /api/ai/chat/reset');
        console.log('   GET  /api/ai/status');
        console.log('');
    } else {
        console.error('❌ Could not capture express app instance');
    }
}, 500);