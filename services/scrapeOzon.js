const puppeteer = require('puppeteer');
const Product = require('../models/Product');

const scrapeProductPageOzon = async (url, query) => {
  console.log(`Scraping Ozon product page: ${url}`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

    const productData = await page.evaluate(() => {
      const titleElement = document.querySelector('h1[itemprop="name"]');
      const priceElement = document.querySelector('span[itemprop="price"]');
      const imageSrcElement = document.querySelector('img[itemprop="image"]');
      const descriptionElement = document.querySelector('div[itemprop="description"]');
      const specificationsElements = document.querySelectorAll('dl[itemprop="additionalProperty"]');
      const reviewElements = document.querySelectorAll('div[itemprop="reviewBody"]');

      const title = titleElement ? titleElement.innerText.trim() : null;
      const price = priceElement ? priceElement.innerText.trim() + ' ₸' : null;
      const imageSrc = imageSrcElement ? imageSrcElement.src : null;
      const description = descriptionElement ? descriptionElement.innerText.trim() : null;
      const specifications = Array.from(specificationsElements)
        .map(spec => `${spec.querySelector('dt').innerText.trim()}: ${spec.querySelector('dd').innerText.trim()}`)
        .join(', ');
      const reviews = Array.from(reviewElements)
        .map(review => review.innerText.trim())
        .join(' | ');

      return { title, price, description, specifications, reviews, imageSrc };
    });

    console.log(`Scraped product data from Ozon:`, productData);
    await browser.close();
    return { ...productData, query };
  } catch (error) {
    console.error(`Error scraping Ozon product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeOzon = async (query) => {
  console.log(`Scraping Ozon for query: ${query}`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    await page.goto(`https://www.ozon.ru/search/?from_global=true&text=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 120000 });

    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.tile-hover-target')).map(link => link.href);
      return [...new Set(links)].slice(0, 12); // Используем Set для хранения уникальных ссылок и берем только первые 12
    });

    console.log(`Found ${productLinks.length} product links on Ozon:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageOzon(link, query);
        const existingProduct = await Product.findOne({ link, query });
        if (!existingProduct) {
          if (productData.title && productData.price && productData.imageSrc) {
            const product = new Product({ ...productData, link, source: 'Ozon', query });
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
    console.error(`Error scraping Ozon for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeOzon };
