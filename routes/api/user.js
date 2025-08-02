const express = require('express');

module.exports = (usersCol) => {
  const router = express.Router();

  // GET /api/user
  // Returns { username, elo } for the currently logged-in user
  router.get('/', async (req, res) => {
    try {
      if (!req.session.user) {
        return res.status(401).json({ message: 'Not logged in' });
      }
      const { email } = req.session.user;
      const user = await usersCol.findOne(
        { email },
        { projection: { _id: 0, username: 1, elo: 1 } }
      );
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};