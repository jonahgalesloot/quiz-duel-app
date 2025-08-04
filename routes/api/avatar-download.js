// routes/api/avatar-download.js
const express = require('express');
const crypto  = require('crypto');

module.exports = (usersCol) => {
  const router = express.Router();

  // GET /api/avatar-download/:username
  router.get('/:username', async (req, res) => {
    const { username } = req.params;

    // 1) Find the user
    const user = await usersCol.findOne(
      { username },
      { projection: { _id: 0, email: 1, avatarUrl: 1 } }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2) If they have a custom avatar, redirect to it
    if (user.avatarUrl) {
      return res.redirect(user.avatarUrl);
    }

    // 3) Fallback → Gravatar
    const hash = crypto.createHash('md5')
                       .update(user.email.trim().toLowerCase())
                       .digest('hex');
    const gravatarUrl = `https://gravatar.com/avatar/${hash}?s=200&d=identicon`;

    return res.redirect(gravatarUrl);
  });

  return router;
};
