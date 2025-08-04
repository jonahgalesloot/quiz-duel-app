// routes/avatar.js
const express = require('express');
const multer  = require('multer');
const Sharp   = require('sharp');
const B2      = require('backblaze-b2');

module.exports = function(usersCol) {
  const router = express.Router();
  const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } }); // max 2 MB

  // Initialize B2 client
  const b2 = new B2({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey:   process.env.B2_APP_KEY
  });

  // POST /api/avatar/upload
  // form-data: { avatar: <file> }
  router.post('/upload', upload.single('avatar'), async (req, res) => {
    try {
      // 1) Auth check
      const user = req.session.user;
      if (!user) return res.status(401).json({ message: 'Not logged in' });

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // 2) Resize to 144×144
      const resized = await Sharp(req.file.buffer)
        .resize(144, 144)
        .jpeg({ quality: 80 })
        .toBuffer();

      // 3) Authorize & get upload URL
      await b2.authorize();  
      const { data: { uploadUrl, authorizationToken } } =
        await b2.getUploadUrl({ bucketId: process.env.B2_BUCKET_ID });

      // 4) Upload to B2
      const filename = `avatars/${user.username}.jpg`;
      await b2.uploadFile({
        uploadUrl,
        uploadAuthToken: authorizationToken,
        fileName: filename,
        data: resized
      });

      // 5) Construct public URL
      const avatarUrl = `${process.env.B2_DOWNLOAD_URL}/${filename}`;

      // 6) Persist to MongoDB
      await usersCol.updateOne(
        { username: user.username },
        { $set: { avatarUrl } }
      );

      // 7) Respond with new URL
      res.json({ avatarUrl });

    } catch (err) {
      console.error('[AVATAR] upload error:', err);
      res.status(500).json({ message: 'Upload failed' });
    }
  });

  return router;
};
