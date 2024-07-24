const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  price: { type: String, required: true },
  description: { type: String, required: false },
  imageSrc: { type: String, required: true },
  link: { type: String, required: true, unique: true },
  source: { type: String, required: true },
  query: { type: String, required: true },
  specifications: { type: String, required: false },
  reviews: { type: String, required: false }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
