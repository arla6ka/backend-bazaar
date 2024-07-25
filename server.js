require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const { scrapeKaspi } = require('./services/scrapeKaspi');
const { scrapeWildberries } = require('./services/scrapeWildberries');
const { scrapeAlfa } = require('./services/scrapeAlfa');
const { scrapeOlx } = require('./services/scrapeOlx');
const { formatQuery, getTopProducts, analyzeProductsBatch } = require('./services/analyzeService');
const Product = require('./models/Product');

const app = express();

app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Failed to connect to MongoDB', err);
});

// Content Security Policy
app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'");
  next();
});

// Root route
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.post('/api/search', async (req, res) => {
  const { query, marketplace } = req.body;

  try {
    const formattedQuery = await formatQuery(query);
    console.log(`Searching for products with query: ${formattedQuery}`);

    const keywords = formattedQuery.split(' ');

    let searchCriteria = {
      $or: keywords.map(keyword => ({
        $or: [
          { title: { $regex: keyword, $options: 'i' } },
          { description: { $regex: keyword, $options: 'i' } },
          { specifications: { $regex: keyword, $options: 'i' } },
          { reviews: { $regex: keyword, $options: 'i' } }
        ]
      })),
      query: formattedQuery
    };

    if (marketplace) {
      searchCriteria.source = marketplace;
    }

    let products = await Product.find(searchCriteria);
    console.log(`Found ${products.length} products in the database`);

    if (products.length === 0) {
      console.log('No products found in database. Scraping new products...');

      await Promise.all([
        scrapeOlx(formattedQuery),
        scrapeKaspi(formattedQuery),
        scrapeAlfa(formattedQuery),
        scrapeWildberries(formattedQuery)
      ]);

      products = await Product.find(searchCriteria);
      console.log(`Found ${products.length} products after scraping`);
    }

    if (products.length > 0) {
      await analyzeProductsBatch(products, query);
    }

    const topProducts = await getTopProducts(products);
    res.json(topProducts);
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).json({ error: 'An error occurred while scraping data.' });
  }
});

app.get('/api/popular', async (req, res) => {
  try {
    const popularProducts = await Product.find().limit(30);
    res.json(popularProducts);
  } catch (error) {
    console.error('Error fetching popular products:', error);
    res.status(500).json({ error: 'An error occurred while fetching popular products.' });
  }
});

app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
