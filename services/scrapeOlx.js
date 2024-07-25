const puppeteer = require('puppeteer');
const Product = require('../models/Product');

const scrapeProductPageOlx = async (url, query) => {
  console.log(`Scraping OLX product page: ${url}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });

    const productData = await page.evaluate(() => {
      const titleElement = document.querySelector('div[data-cy="ad_title"] h4');
      const priceElement = document.querySelector('div[data-testid="ad-price-container"] h3');
      const imageSrcElement = document.querySelector('div[data-testid="ad-photo"] img');
      const descriptionElement = document.querySelector('div[data-testid="ad_description"] .css-1t507yq');

      const title = titleElement ? titleElement.innerText.trim() : null;
      const price = priceElement ? priceElement.innerText.trim() : null;
      const imageSrc = imageSrcElement ? imageSrcElement.src : null;
      const description = descriptionElement ? descriptionElement.innerText.trim() : null;
      const specifications = '';
      const reviews = '';

      return { title, price, description, imageSrc, specifications, reviews };
    });

    console.log(`Scraped product data from OLX:`, productData);
    await browser.close();
    return { ...productData, query };
  } catch (error) {
    console.error(`Error scraping OLX product page: ${url}`, error);
    await browser.close();
    throw error;
  }
};

const scrapeOlx = async (query) => {
  console.log(`Scraping OLX for query: ${query}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  try {
    await page.goto(`https://www.olx.kz/list/q-${encodeURIComponent(query)}/`, { waitUntil: 'networkidle2', timeout: 120000 });

    const productLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a.css-z3gu2d')).map(link => link.href);
      return [...new Set(links)].slice(0, 12);
    });

    console.log(`Found ${productLinks.length} product links on OLX:`, productLinks);

    for (const link of productLinks) {
      try {
        const productData = await scrapeProductPageOlx(link, query);
        const existingProduct = await Product.findOne({ link, query });
        if (!existingProduct) {
          if (productData.title && productData.price && productData.imageSrc) {
            const product = new Product({ ...productData, link, source: 'OLX', query });
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
    console.error(`Error scraping OLX for query: ${query}`, error);
    await browser.close();
    throw error;
  }
};

module.exports = { scrapeOlx };
