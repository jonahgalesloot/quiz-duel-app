// routes/api/user.js
const express = require('express');

module.exports = (usersCol) => {
  const router = express.Router();

  // GET /api/user
  // Returns { username, elo } for the currently logged-in user
  router.get('/', async (req, res) => {
    try {
      // 1) Ensure there is a session user
      if (!req.session.user) {
        return res.status(401).json({ message: 'Not logged in' });
      }

      const { username } = req.session.user;

      // 2) Look up that user’s basic info in the users collection
      const user = await usersCol.findOne(
        { username },
        { projection: { _id: 0, username: 1, elo: 1 } }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // 3) Send it back as JSON
      res.json(user);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};
