// routes/playSettings.js
const express = require('express');

module.exports = function(usersCol) {
  const router = express.Router();

  // Your default settings—easy to extend later
  const DEFAULTS = {
    numShort: 5,
    numLong: 2,
    questionSets: []
  };

  // GET /play/settings
  router.get('/play/settings', async (req, res) => {
    try {
      const username = req.session.user.username;
      let user = await usersCol.findOne({ username });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Merge defaults into existing or empty settings
      const existing = user.playSettings || {};
      const merged = { ...DEFAULTS, ...existing };

      // If any defaults were missing, write them back
      const missingKeys = Object.keys(DEFAULTS).filter(k => !(k in existing));
      if (missingKeys.length) {
        await usersCol.updateOne(
          { username },
          { $set: { playSettings: merged } }
        );
      }

      return res.json(merged);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // POST /play/settings
  router.post('/play/settings', async (req, res) => {
    try {
      const username = req.session.user.username;
      const incoming = req.body;

      // (Optional) You might validate that incoming only has allowed keys
      const toStore = { ...DEFAULTS, ...incoming };

      await usersCol.updateOne(
        { username },
        { $set: { playSettings: toStore } }
      );

      return res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};
