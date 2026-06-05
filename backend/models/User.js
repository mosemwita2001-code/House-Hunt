const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'buyer' }
}, { timestamps: true });

// 💡 FIX: Make sure this exact line is at the very bottom of this file!
module.exports = mongoose.model('User', UserSchema);