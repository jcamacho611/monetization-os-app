const cheerio = require('cheerio');

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function limit(value = '', max = 320) {
  const cleaned = cleanText(value);
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function pageTypeFromUrl(url = '') {
  const lower = url.toLowerCase();

  if (/(book|schedule|consult|appointment)/.test(lower)) return 'booking';
  if (/(service|treatment|offer|pricing)/.test(lower)) return 'services';
  if (/(about|story|team)/.test(lower)) return 'about';
  if (/(contact|location)/.test(lower)) return 'contact';
  if (/(review|testimonial|results|case-study)/.test(lower)) return 'proof';
  return 'general';
}

function parsePageHtml({ url, html, pageType }) {
  const $ = cheerio.load(html || '');
  const title = cleanText($('title').first().text());
  const metaDescription = cleanText($('meta[name="description"]').attr('content') || '');
  const h1 = cleanText($('h1').first().text());
  const headings = $('h2, h3')
    .slice(0, 8)
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);
  const ctaTexts = $('a, button, input[type="submit"]')
    .slice(0, 20)
    .map((_, element) => {
      const text = cleanText($(element).text() || $(element).attr('value') || '');
      return text.length <= 50 ? text : '';
    })
    .get()
    .filter(Boolean);
  const bodyText = cleanText($('main').text() || $('body').text());
  const heroText = limit(
    $('main section').first().text() ||
      $('header').first().text() ||
      $('body').text(),
    420
  );
  const textExcerpt = limit(bodyText, 700);
  const phoneVisible = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(bodyText);
  const emailVisible = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(bodyText);
  const bookingLinks = $('a[href], button, form[action]')
    .map((_, element) => cleanText($(element).attr('href') || $(element).attr('action') || $(element).text()))
    .get()
    .filter((value) => /(book|schedule|consult|appointment|call|quote|buy|shop)/i.test(value));
  const trustSignals = [];
  const weakMessagingSignals = [];

  if (/testimonial|review|five star|5 star|google review|before and after|case study/i.test(bodyText)) {
    trustSignals.push('Reviews or proof language detected');
  }
  if (/licensed|certified|trusted|years|experience|award/i.test(bodyText)) {
    trustSignals.push('Credibility language detected');
  }
  if (/faq|questions/i.test(bodyText)) {
    trustSignals.push('FAQ language detected');
  }

  if (!h1 || h1.length < 12) {
    weakMessagingSignals.push('Headline is weak or missing.');
  }
  if (!metaDescription || metaDescription.length < 70) {
    weakMessagingSignals.push('Homepage metadata is too thin to sell the click.');
  }
  if (ctaTexts.length < 2) {
    weakMessagingSignals.push('CTA language is too limited or hard to spot.');
  }
  if (!bookingLinks.length && !$('form').length) {
    weakMessagingSignals.push('No clear booking, inquiry, or purchase path was detected.');
  }
  if (!trustSignals.length) {
    weakMessagingSignals.push('Trust language and proof signals feel thin.');
  }

  return {
    url,
    pageType: pageType || pageTypeFromUrl(url),
    title,
    metaDescription,
    h1,
    headings,
    heroText,
    ctaTexts,
    hasForm: $('form').length > 0,
    hasBookingLink: bookingLinks.length > 0,
    hasTestimonials: /testimonial|review|five star|5 star/i.test(bodyText),
    hasFaq: /faq|questions/i.test(bodyText),
    hasContactInfo: phoneVisible || emailVisible,
    phoneVisible,
    emailVisible,
    trustSignals,
    weakMessagingSignals,
    textExcerpt,
    rawHtmlExcerpt: limit($.html().replace(/\s+/g, ' '), 900)
  };
}

function buildSiteSummary(parsedPages) {
  const pages = parsedPages.map((page) => ({
    url: page.url,
    pageType: page.pageType,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    headings: page.headings,
    heroText: page.heroText,
    ctaTexts: page.ctaTexts,
    hasForm: page.hasForm,
    hasBookingLink: page.hasBookingLink,
    hasTestimonials: page.hasTestimonials,
    hasFaq: page.hasFaq,
    hasContactInfo: page.hasContactInfo,
    trustSignals: page.trustSignals,
    weakMessagingSignals: page.weakMessagingSignals,
    textExcerpt: page.textExcerpt
  }));

  const homepage = pages[0] || null;
  return {
    homepage,
    pages,
    pageCount: pages.length,
    pageTypes: [...new Set(pages.map((page) => page.pageType))]
  };
}

module.exports = {
  parsePageHtml,
  buildSiteSummary
};
