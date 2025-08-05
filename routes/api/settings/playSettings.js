// routes/api/settings/playSettings.js
const express = require('express');

module.exports = function(usersCol) {
  const router = express.Router();

  // Your default settings—easy to extend later
  const DEFAULTS = {
    numShort: 5,
    numLong: 2,
    questionSets: []
  };

  // GET /api/settings/play
  router.get('/api/settings/play', async (req, res) => {
    try {
      const email = req.session.user.email;
      let user = await usersCol.findOne({ email });
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
          { email },
          { $set: { playSettings: merged } }
        );
      }

      return res.json(merged);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // POST /api/settings/play
  router.post('/api/settings/play', async (req, res) => {
    try {
      const email = req.session.user.email;
      const incoming = req.body;

      // (Optional) You might validate that incoming only has allowed keys
      const toStore = { ...DEFAULTS, ...incoming };

      await usersCol.updateOne(
        { email },
        { $set: { playSettings: toStore } }
      );

      return res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
}; 