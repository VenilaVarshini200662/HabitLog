// middleware/auth.js
const fs = require('fs');
const path = require('path');

const usersFilePath = path.join(__dirname, '../data/users.json');

// Ensure users file exists
if (!fs.existsSync(usersFilePath)) {
  fs.writeFileSync(usersFilePath, JSON.stringify([]));
}

const authMiddleware = {
  requireAuth: (req, res, next) => {
    if (req.session && req.session.userId) {
      next();
    } else {
      res.redirect('/');
    }
  },

  checkAuth: (req, res, next) => {
    if (req.session && req.session.userId) {
      res.locals.isAuthenticated = true;
      res.locals.user = req.session.user;
    } else {
      res.locals.isAuthenticated = false;
    }
    next();
  }
};

module.exports = authMiddleware;