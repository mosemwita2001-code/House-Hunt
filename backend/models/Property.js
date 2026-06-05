const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  county: { type: String, required: true },
  town: { type: String, required: true },
  price: { type: Number, required: true },
  house_type: { type: String },
  description: { type: String }
}, { timestamps: true });

// 💡 MAKE SURE THIS EXACT LINE IS AT THE VERY BOTTOM:
module.exports = mongoose.model('Property', PropertySchema);