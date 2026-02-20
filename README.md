📋 Overview
HabitLog is a comprehensive personal habit tracking platform designed to help users build and maintain positive habits through gamification, visual progress tracking, and AI-powered assistance. Whether you want to exercise daily, read more books, or meditate regularly, HabitLog provides the tools and motivation to turn your goals into lasting habits.

✨ Why HabitLog?
Gamified Experience - Earn stars, badges, and level up as you build streaks

AI Assistant - Get personalized advice and motivation 24/7

Bilingual Support - Available in English and Tamil

Visual Progress - Beautiful charts and GitHub-style heatmaps

Streak Protection - Never lose your streak to a bad day with freeze system

🚀 Key Features
📊 Dashboard
Real-time habit tracking with visual cards

Current streak display with fire animations

Daily completion progress

Achievement badges and rewards

Weekly summary with motivational messages

📅 Calendar & Heatmap
Interactive monthly calendar with color-coded days

GitHub-style contribution heatmap (last 365 days)

Click any day to see detailed completion history

Best days tracking with trophy icons

📈 Statistics & Analytics
Pie charts for habit distribution

Weekly/Monthly/Yearly progress charts

Completion rate analysis

Most consistent habits tracking

Streak distribution visualization

😊 Mood Tracker
Track your mood with 👍/👎 feedback

Correlation between mood and habit completion

Positive/Negative day analysis

Streak freeze management system

🤖 AI Assistant
24/7 available floating chat widget

Personalized habit advice

Streak and progress inquiries

Health and wellness tips

Motivation and encouragement

⚙️ Settings & Customization
Light/Dark theme toggle (with system preference detection)

Notification preferences

Data export (CSV/PDF)

Reminder settings with custom time

Multi-language support (English & Tamil)

🎮 Gamification System
Status Level	Requirements	Icon
Beginner	0-2 days	🌱
Sprout	3-6 days	🌿
Star	7-29 days	⭐
Advanced	30-49 days	🌟
Expert	50-99 days	🏆
Master	100-364 days	👑
Legend	365+ days	🔥
❄️ Streak Freeze System
Earn 1 freeze for every 3-day streak

Store up to 2 freezes

Automatically protect your streak when you miss a day

Visual indicator: "❄️ Freeze Applied" on calendar

🛠️ Tech Stack
Frontend
HTML5 - Structure and content

Tailwind CSS - Styling and responsive design

JavaScript (ES6+) - Interactive functionality

Chart.js - Data visualization

Font Awesome - Icons and graphics

Backend
Node.js - JavaScript runtime

Express.js - Web application framework

Express Session - User session management

JSON File Storage - Lightweight data persistence

Additional Libraries
jsPDF - PDF report generation

Node-cron - Automated reminders

Custom AI Engine - Intelligent chatbot responses

!

📦 Installation
Prerequisites
Node.js (v18.x or higher)

npm (v9.x or higher)

Git

Step-by-Step Setup
Clone the repository

bash
git clone https://github.com/yourusername/habitlog.git
cd habitlog
Install dependencies

bash
npm install
Create environment file

bash
touch .env
Add the following:

text
PORT=3000
SESSION_SECRET=your-secret-key-here
NODE_ENV=development
Run the application

bash
npm start
or for development with auto-reload:

bash
npm run dev
Open your browser

text
http://localhost:3000
Project Structure
text
habitlog/
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── tailwind.config.js        # Tailwind CSS configuration
├── public/                   # Static files
│   ├── index.html            # Landing page
│   ├── dashboard.html        # Main dashboard
│   ├── calendar.html         # Calendar view
│   ├── stats.html            # Statistics page
│   ├── progress.html         # Progress tracking
│   ├── mood-tracker.html     # Mood analysis
│   ├── chatbot.html          # AI assistant
│   ├── settings.html         # User settings
│   ├── css/                  # Stylesheets
│   │   └── style.css         # Main CSS file
│   └── js/                   # JavaScript files
│       ├── translations.js   # Multi-language support
│       ├── dashboard.js       # Dashboard logic
│       ├── chat-widget.js     # AI assistant widget
│       └── page-transitions.js # Smooth transitions
├── data/                     # Data storage
│   └── users.json            # User data (auto-generated)
└── README.md                 # This file

🎯 Core Functionality
Habit Management
✅ Create unlimited habits with custom icons and colors

✅ Edit habit details anytime

✅ Delete habits with confirmation

✅ Mark habits as complete daily

✅ Automatic streak calculation

Streak Logic
Streak increases by 1 for each consecutive day with at least one habit completed

Streak resets to 0 if no habits are completed on a day

Freeze system prevents streak loss for missed days

Longest streak tracked separately for each habit

Data Persistence
User data stored in JSON format

Session-based authentication

Local storage for user preferences

Export data as CSV or PDF reports



🧪 Testing
Run the application locally and test the following core features:

User Authentication

Sign up with email and date of birth

Login with credentials

Session persistence across pages

Habit Operations

Create new habit with icon and color

Toggle completion status

Edit habit details

Delete habit

Streak Calculation

Complete habits on consecutive days

Verify streak increases

Miss a day and verify streak reset

Use streak freeze to protect streak

Data Visualization

Check calendar color coding

Explore heatmap patterns

View statistics charts

Analyze mood correlations

AI Assistant

Ask about your streak

Request motivation

Get health tips

Inquire about habits

🚢 Deployment
Deploy on Render (Recommended)
Push code to GitHub repository

Create new Web Service on Render

Connect your repository

Use the following settings:

Build Command: npm install

Start Command: node server.js

Add environment variable:

SESSION_SECRET: your-secret-key

Deploy!

Deploy on Railway
bash
railway login
railway up
Deploy on Heroku
bash
heroku create habitlog
git push heroku main
heroku open
🤝 Contributing
Contributions are welcome! Here's how you can help:

Fork the repository

Create a feature branch

bash
git checkout -b feature/amazing-feature
Commit your changes

bash
git commit -m 'Add some amazing feature'
Push to the branch

bash
git push origin feature/amazing-feature
Open a Pull Request

Development Guidelines
Follow existing code style

Add comments for complex logic

Update documentation for new features

Test thoroughly before submitting

📝 License
This project is licensed under the MIT License - see the LICENSE file for details.

🙏 Acknowledgments
Icons by Font Awesome

Charts by Chart.js

Styling with Tailwind CSS

PDF generation by jsPDF

