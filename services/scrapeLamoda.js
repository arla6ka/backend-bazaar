const puppeteer = require('puppeteer');
const Product = require('../models/Product');

const scrapeProductPageLamoda = async (url) => {
  console.log(`Scraping Lamoda product page: ${url}`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });

    const productData = await page.evaluate(() => {
      const titleElement = document.querySelector('h1.x-product-card__product-name');
      const priceElement = document.querySelector('.x-product-card-description__price-new');
      const imageSrcElement = document.querySelector('.x-product-card__pic-img');
      const descriptionElement = document.querySelector('div._content_1q4q9_61');
      const specificationsElements = document.querySelectorAll('p._item_ajirn_2');
      const reviewElements = document.querySelectorAll('div._root_1lyxm_6 ._description_1lyxm_42');

      const title = titleElement ? titleElement.innerText.trim() : null;
      const price = priceElement ? priceElement.innerText.trim() : null;
      const imageSrc = imageSrcElement ? imageSrcElement.src : null;
      const description = descriptionElement ? descriptionElement.innerText.trim() : null;
      const specifications = Array.from(specificationsElements)
        .map(spec => `${spec.querySelector('._attribute_ajirn_7')?.innerText.trim()}: ${spec.querySelector('._value_ajirn_27')?.innerText.trim()}`)
        .filter(Boolean)
        .join(', ');
      const reviews = Array.from(reviewElements)
        .map(review => review.innerText.trim())
        .join(' | ');

      return { title, price, description, specifications, reviews, imageSrc };
    });

    console.log(`Scraped product data from Lamoda:`, productData);
    await browser.close();
    return productData;
  } catch (error) {
    console.error(`Error scraping Lamoda product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeLamoda = async (query) => {
  console.log(`Scraping Lamoda for query: ${query}`);
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(`https://www.lamoda.kz/catalogsearch/result/?q=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 90000 });

    const productLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.x-product-card__link'))
        .map(link => link.href)
        .filter(link => link && link.includes('/p/'));
    });

    console.log(`Found ${productLinks.length} product links on Lamoda:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageLamoda(link);
        if (productData.title && productData.price && productData.imageSrc) {
          const product = new Product({ ...productData, link, source: 'Lamoda' });
          await product.save();
          console.log(`Saved product to database: ${productData.title}`);
        } else {
          console.warn(`Incomplete product data for link: ${link}`);
        }
      } catch (error) {
        console.error(`Failed to scrape or save product data for link: ${link}`, error);
      }
    }

    await browser.close();
  } catch (error) {
    console.error(`Error scraping Lamoda for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeLamoda };
