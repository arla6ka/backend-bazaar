const { GoogleGenerativeAI } = require("@google/generative-ai");
const Product = require('../models/Product');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const formatQuery = async (query) => {
  console.log(`Formatting query: ${query}`);
  const prompt = `Provide a simple, standardized search term for the e-commerce query: "${query}". Return only the search term. If the query has an abstract query, for example, "I want an office mouse", then you must format it yourself, choose a brand (if necessary).`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = await response.text();
  console.log(`AI response: ${text}`);

  let formattedQuery = text.trim();

  formattedQuery = formattedQuery.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '');

  if (!formattedQuery || formattedQuery.includes('\n') || formattedQuery.includes('\r')) {
    throw new Error('Failed to extract formatted query from response');
  }

  console.log(`Extracted simple formatted query: ${formattedQuery}`);
  return formattedQuery;
};

const analyzeProductsBatch = async (products, query) => {
  const batchSize = 12;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize).filter(product => product.score === 0);

    if (batch.length === 0) continue;

    const batchPrompt = batch.map((product, index) => {
      const { title, price, description, specifications, reviews } = product;
      return `
        Product ${index + 1}:
        Title: ${title}
        Price: ${price} KZT
        Description: ${description}
        Specifications: ${specifications}
        Reviews: ${reviews}
      `;
    }).join('\n\n');

    const prompt = `
      User query: "${query}"
      Imagine that you are the best product evaluator in the world. Evaluate the following products and give each of them a score out of 1000 based on their price, description, specifications, and reviews. Provide just the scores, one for each product, without any additional comments or suggestions. Be concise and to the point. Your goal to suggest most advantageous in price, appropriate in specifications and descriptions. Format the response as "Product 1: score, Product 2: score, ..., Product ${batch.length}: score. If a users prompt is not related to product that you were given, give it a zero score".
      
      ${batchPrompt}
    `;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = await response.text();
      console.log(`AI response for product evaluation: ${text}`);

      const scores = text.match(/Product \d+: (\d+)/g).map(match => parseInt(match.split(': ')[1], 10));

      if (scores && scores.length === batch.length) {
        for (let j = 0; j < batch.length; j++) {
          let score = parseInt(scores[j], 10);
          if (!isNaN(score)) {
            if (score > 1000) score = 1000;
            await Product.updateOne({ _id: batch[j]._id }, { score });
          }
        }
      } else {
        console.error('Failed to extract correct number of scores from response');
      }
    } catch (error) {
      console.error('Failed to analyze products batch', error);
    }
  }
};

const getTopProducts = async (products) => {
  const scoredProducts = await Product.find({ _id: { $in: products.map(p => p._id) } }).sort({ score: -1 }).limit(5);
  return scoredProducts;
};

module.exports = { formatQuery, analyzeProductsBatch, getTopProducts };
