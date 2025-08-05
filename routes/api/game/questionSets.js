// routes/api/game/questionSets.js
const express = require('express');
module.exports = (db) => {
  const router = express.Router();
  const col = db.collection('sets');

  // GET /api/game/questionSets
  router.get('/api/game/questionSets', async (req, res) => {
    try {
      const sets = await col.find({}, { projection: { questions: 0 } }).toArray();
      res.json(sets);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  });

  // (Optional) other endpoints: GET /:id, POST, PUT, DELETE...

  return router;
}; 