// routes/api/game/questions.js
const express = require('express');
module.exports = (db) => {
  const router = express.Router();
  const col = db.collection('sets');

  // GET /api/game/questions
  router.get('/api/game/questions', async (req, res) => {
    try {
      const set = await col.findOne({}, { projection: { questions: 1 } });
      res.json(set.questions || []);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
}; 