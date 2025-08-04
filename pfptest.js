const email = 'reesewong@bsnstudent.nl';

const crypto = require('crypto');
const hash = crypto.createHash('md5')
                   .update(email.trim().toLowerCase())
                   .digest('hex');
const avatarUrl = `https://gravatar.com/avatar/${hash}?s=200&d=identicon`;

console.log(`Avatar URL for ${email}: ${avatarUrl}`);