const puppeteer = require('puppeteer');
const Product = require('../models/Product');

const scrapeProductPageWildberries = async (url, query) => {
  console.log(`Scraping Wildberries product page: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser'
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

    const productData = await page.evaluate(() => {
      const titleElement = document.querySelector('.details-and-description__title');
      const priceElement = document.querySelector('span.product-price-current__value[data-tag="productCurrentPrice"]');
      const imageSrcElement = document.querySelector('.swiper-slide__img');
      const descriptionElement = document.querySelector('div.details-and-description__composition');
      const specificationsElements = document.querySelectorAll('div.full-details-info .full-details-item');
      const reviewElements = document.querySelectorAll('.feedbacks-item-product__comment');

      const title = titleElement ? titleElement.innerText.trim() : null;
      let price = priceElement ? priceElement.innerText.trim() : null;
      if (price) {
        price = price.replace('₽', '').replace(/\s/g, '');
        price = (parseFloat(price) * 6).toFixed(2) + ' ₸';
      }
      const imageSrc = imageSrcElement ? imageSrcElement.src : null;
      const description = descriptionElement ? descriptionElement.innerText.trim() : null;
      const specifications = Array.from(specificationsElements)
        .map(spec => {
          const name = spec.querySelector('th[data-tag="name"]');
          const value = spec.querySelector('td[data-tag="value"]');
          return name && value ? `${name.innerText.trim()}: ${value.innerText.trim()}` : null;
        })
        .filter(Boolean)
        .join(', ');
      const reviews = Array.from(reviewElements)
        .map(review => review.innerText.trim())
        .join(' | ');

      return { title, price, description, specifications, reviews, imageSrc };
    });

    console.log(`Scraped product data from Wildberries:`, productData);
    await browser.close();
    return { ...productData, query };
  } catch (error) {
    console.error(`Error scraping Wildberries product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeWildberries = async (query) => {
  console.log(`Scraping Wildberries for query: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.CHROME_PATH || '/usr/bin/chromium-browser'
  });
  const page = await browser.newPage();

  try {
    await page.goto(`https://global.wildberries.ru/catalog?search=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 120000 });

    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('.product-card__link')).map(link => link.href);
      return [...new Set(links)].slice(0, 12);
    });

    console.log(`Found ${productLinks.length} product links on Wildberries:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageWildberries(link, query);
        const existingProduct = await Product.findOne({ link, query });
        if (!existingProduct) {
          if (productData.title && productData.price && productData.imageSrc) {
            const product = new Product({ ...productData, link, source: 'Wildberries', query });
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
    console.error(`Error scraping Wildberries for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeWildberries };
