const puppeteer = require('puppeteer');
const Product = require('../models/Product');
const puppeteerConfig = require('../puppeteer.config.js');

const scrapeProductPageAlfa = async (url, query) => {
  console.log(`Scraping Alfa product page: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROMIUM_PATH,
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

    const productData = await page.evaluate(() => {
      const title = document.querySelector('.single-product-title')?.innerText.trim();
      const price = document.querySelector('.price .num')?.innerText.trim();
      const imageSrc = document.querySelector('.gallery-holder img')?.src;
      const description = document.querySelector('.tab-pane#description')?.innerText.trim();
      const specifications = ''; // Alfa не предоставляет детальных спецификаций на странице товара
      const reviews = ''; // Alfa не предоставляет отзывы на странице товара

      return { title, price, description, specifications, reviews, imageSrc };
    });

    console.log(`Scraped product data from Alfa:`, productData);
    await browser.close();
    return { ...productData, query };
  } catch (error) {
    console.error(`Error scraping Alfa product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeAlfa = async (query) => {
  console.log(`Scraping Alfa for query: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROMIUM_PATH,
  });
  const page = await browser.newPage();

  try {
    await page.goto(`https://alfa.kz/q/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 120000 });

    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.product-item .title a'))
        .map(link => link.href)
        .filter(link => !link.includes('/wishlist/add')); // Фильтруем ссылки на wishlist

      return [...new Set(links)].slice(0, 12); // Используем Set для хранения уникальных ссылок и берем только первые 12
    });

    console.log(`Found ${productLinks.length} product links on Alfa:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageAlfa(link, query);
        const existingProduct = await Product.findOne({ link, query });
        if (!existingProduct) {
          if (productData.title && productData.price && productData.imageSrc) {
            const product = new Product({ ...productData, link, source: 'Alfa', query });
            await product.save();
            console.log(`Saved product to database: ${productData.title}`);
          } else {
            console.warn(`Incomplete product data for link: ${link}`);
          }
        } else {
          console.log(`Product already exists in database: ${productData.title}`);
        }
      } catch (error) {
        console.error(`Failed to scrape or save product data for link: ${link}`, error);
      }
    }

    await browser.close();
  } catch (error) {
    console.error(`Error scraping Alfa for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeAlfa };
