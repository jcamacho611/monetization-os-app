const cheerio = require('cheerio');

function normalizeWebsiteUrl(input) {
  const raw = String(input || '').trim();

  if (!raw) {
    throw new Error('A website URL is required.');
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.hash = '';
  return url.toString();
}

function sameOriginUrl(baseUrl, href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return null;
  }

  try {
    const next = new URL(href, baseUrl);
    return next.origin === new URL(baseUrl).origin ? next : null;
  } catch (error) {
    return null;
  }
}

function classifyPage(url) {
  const lower = url.toLowerCase();
  if (/(book|schedule|consult|appointment)/.test(lower)) return 'booking';
  if (/(service|treatment|pricing|offer|shop)/.test(lower)) return 'services';
  if (/(about|story|team)/.test(lower)) return 'about';
  if (/(contact|location)/.test(lower)) return 'contact';
  if (/(review|testimonial|results|faq|case-study)/.test(lower)) return 'proof';
  return 'general';
}

async function fetchHtml(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'JeniTrustBot/1.0 (+https://zumi.onrender.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }

    const type = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) {
      throw new Error('Target page did not return HTML.');
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function discoverRelevantUrls(baseUrl, html, maxPages) {
  const $ = cheerio.load(html || '');
  const seen = new Set();
  const candidates = [];
  const priorityPatterns = ['about', 'service', 'treatment', 'pricing', 'book', 'schedule', 'consult', 'contact', 'faq', 'review'];

  $('a[href]').each((_, element) => {
    const candidate = sameOriginUrl(baseUrl, $(element).attr('href'));

    if (!candidate) {
      return;
    }

    candidate.hash = '';
    const href = candidate.toString();
    if (seen.has(href)) {
      return;
    }

    seen.add(href);
    const score = priorityPatterns.reduce((total, token, index) => {
      return href.toLowerCase().includes(token) ? total + (priorityPatterns.length - index) : total;
    }, 0);
    candidates.push({ href, score });
  });

  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, maxPages)
    .map((item) => item.href);
}

async function fetchSitePages(website, options = {}) {
  const maxPages = Math.max(1, Number(options.maxPages || 5));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || 8000));
  let rootUrl = normalizeWebsiteUrl(website);
  let homepageHtml;

  try {
    homepageHtml = await fetchHtml(rootUrl, timeoutMs);
  } catch (error) {
    if (rootUrl.startsWith('https://')) {
      const httpUrl = `http://${rootUrl.slice('https://'.length)}`;
      homepageHtml = await fetchHtml(httpUrl, timeoutMs);
      rootUrl = httpUrl;
    } else {
      throw error;
    }
  }

  const discovered = discoverRelevantUrls(rootUrl, homepageHtml, Math.max(0, maxPages - 1));
  const pages = [
    {
      url: rootUrl,
      html: homepageHtml,
      pageType: 'home'
    }
  ];

  for (const url of discovered) {
    try {
      const html = await fetchHtml(url, timeoutMs);
      pages.push({
        url,
        html,
        pageType: classifyPage(url)
      });
    } catch (error) {
      // Skip secondary pages that fail. The homepage is enough to continue.
    }
  }

  return {
    rootUrl,
    pages
  };
}

module.exports = {
  normalizeWebsiteUrl,
  fetchSitePages
};
