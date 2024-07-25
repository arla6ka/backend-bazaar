const puppeteer = require('puppeteer');
const Product = require('../models/Product');

const puppeteerConfig = require('../puppeteer.config.js');
const scrapeProductPageKaspi = async (url, query) => {
  console.log(`Scraping Kaspi product page: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

    const productData = await page.evaluate(() => {
      const titleElement = document.querySelector('.item__heading');
      const priceElement = document.querySelector('.item__price-once');
      const imageSrcElement = document.querySelector('.item__slider-pic');
      const descriptionElement = document.querySelector('.item__description-text');
      const specificationsElements = document.querySelectorAll('.short-specifications__text');
      const reviewElements = document.querySelectorAll('.reviews__review-text p');

      const title = titleElement ? titleElement.innerText.trim() : null;
      let price = priceElement ? priceElement.innerText.trim() : null;
      if (price) {
        price = price.replace('₸', '').replace(/\s/g, '');
        price = parseFloat(price).toFixed(2) + ' ₸';
      }
      const imageSrc = imageSrcElement ? imageSrcElement.src : null;
      const description = descriptionElement ? descriptionElement.innerText.trim() : null;
      const specifications = Array.from(specificationsElements)
        .map(spec => spec.innerText.trim()).join(', ');
      const reviews = Array.from(reviewElements)
        .map(review => review.innerText.trim()).join(' | ');

      return { title, price, description, specifications, reviews, imageSrc };
    });

    console.log(`Scraped product data from Kaspi:`, productData);
    await browser.close();
    return { ...productData, query };
  } catch (error) {
    console.error(`Error scraping Kaspi product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeKaspi = async (query) => {
  console.log(`Scraping Kaspi for query: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(`https://kaspi.kz/shop/search/?text=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 120000 });

    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.item-card__name-link')).map(link => link.href);
      return [...new Set(links)].slice(0, 12); // Используем Set для хранения уникальных ссылок и берем только первые 12
    });

    console.log(`Found ${productLinks.length} product links on Kaspi:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageKaspi(link, query);
        const existingProduct = await Product.findOne({ link, query });
        if (!existingProduct) {
          if (productData.title && productData.price && productData.imageSrc) {
            const product = new Product({ ...productData, link, source: 'Kaspi', query });
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
    console.error(`Error scraping Kaspi for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeKaspi };
