const auditJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overallScore: { type: 'number' },
    summary: { type: 'string' },
    source: { type: 'string' },
    sourceMode: { type: 'string' },
    fiveSecondImpression: { type: 'string' },
    strongestPageFound: { type: 'string' },
    scores: {
      type: 'object',
      additionalProperties: false,
      properties: {
        clarity: { type: 'number' },
        trust: { type: 'number' },
        cta: { type: 'number' },
        booking: { type: 'number' },
        seo: { type: 'number' },
        mobile: { type: 'number' }
      },
      required: ['clarity', 'trust', 'cta', 'booking', 'seo', 'mobile']
    },
    topIssues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string' },
          issue: { type: 'string' },
          whyItHurts: { type: 'string' },
          severity: { type: 'string' }
        },
        required: ['category', 'issue', 'whyItHurts', 'severity']
      }
    },
    quickWins: {
      type: 'array',
      items: { type: 'string' }
    },
    recommendedFixes: {
      type: 'array',
      items: { type: 'string' }
    },
    heroRewrite: {
      type: 'object',
      additionalProperties: false,
      properties: {
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        cta: { type: 'string' }
      },
      required: ['headline', 'subheadline', 'cta']
    },
    trustRecommendations: {
      type: 'array',
      items: { type: 'string' }
    },
    bookingFlowRecommendations: {
      type: 'array',
      items: { type: 'string' }
    },
    seoRecommendations: {
      type: 'array',
      items: { type: 'string' }
    },
    missingElements: {
      type: 'array',
      items: { type: 'string' }
    },
    conversionLeaks: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: [
    'overallScore',
    'summary',
    'source',
    'sourceMode',
    'fiveSecondImpression',
    'strongestPageFound',
    'scores',
    'topIssues',
    'quickWins',
    'recommendedFixes',
    'heroRewrite',
    'trustRecommendations',
    'bookingFlowRecommendations',
    'seoRecommendations',
    'missingElements',
    'conversionLeaks'
  ]
};

function buildAuditInput(client, siteSummary) {
  return [
    'You are Zumi, a premium AI revenue operator for booking-based businesses, service businesses, clinics, and brands.',
    'Analyze this website summary and return a sharp conversion audit.',
    'Focus on clarity, trust, CTA strength, booking or buying friction, SEO basics, and mobile readability.',
    'Keep the copy premium, concise, and commercially useful.',
    'Do not mention missing data you cannot verify. Infer carefully from the page summaries provided.',
    'Set source to "openai" and sourceMode to "openai".',
    'Use strongestPageFound for the single page that feels most complete or strongest.',
    '',
    `Business name: ${client.businessName || 'Unknown business'}`,
    `Category: ${client.category || 'General business'}`,
    `Main goal: ${client.goal || 'Increase bookings or sales'}`,
    `Website: ${client.website || ''}`,
    '',
    'Structured site summary:',
    JSON.stringify(siteSummary, null, 2)
  ].join('\n');
}

function clampScore(value) {
  return Math.max(20, Math.min(95, Number(value || 0)));
}

function buildHeuristicAudit(client, siteSummary) {
  const homepage = siteSummary.homepage || {};
  const pages = Array.isArray(siteSummary.pages) ? siteSummary.pages : [];
  const issues = [];

  if (!homepage.h1 || homepage.h1.length < 12) {
    issues.push({
      category: 'Clarity',
      issue: 'Weak or missing headline',
      whyItHurts: 'Visitors do not understand the offer fast enough.',
      severity: 'high'
    });
  }

  if (!homepage.ctaTexts || !homepage.ctaTexts.some((item) => /(book|schedule|consult|call|quote|buy|shop|get)/i.test(item))) {
    issues.push({
      category: 'CTA',
      issue: 'No strong next step above the fold',
      whyItHurts: 'Traffic leaks when people cannot tell what to do next.',
      severity: 'high'
    });
  }

  if (!pages.some((page) => page.hasTestimonials || page.trustSignals?.length)) {
    issues.push({
      category: 'Trust',
      issue: 'Thin proof and weak credibility signals',
      whyItHurts: 'High-intent visitors hesitate when the site feels unproven.',
      severity: 'medium'
    });
  }

  if (!pages.some((page) => page.hasBookingLink || page.hasForm)) {
    issues.push({
      category: 'Booking',
      issue: 'No clear booking or inquiry path',
      whyItHurts: 'Even interested visitors can drop before they contact the business.',
      severity: 'high'
    });
  }

  if (!homepage.metaDescription || homepage.metaDescription.length < 70) {
    issues.push({
      category: 'SEO',
      issue: 'Thin meta description on the homepage',
      whyItHurts: 'Search visibility and click quality can suffer when the page promise feels vague.',
      severity: 'medium'
    });
  }

  if (!pages.some((page) => page.hasFaq)) {
    issues.push({
      category: 'Trust',
      issue: 'No FAQ or objection-handling layer',
      whyItHurts: 'Visitors with questions have to leave the page to get answers.',
      severity: 'medium'
    });
  }

  const clarity = clampScore(92 - issues.filter((item) => item.category === 'Clarity').length * 18);
  const trust = clampScore(90 - issues.filter((item) => item.category === 'Trust').length * 16);
  const cta = clampScore(90 - issues.filter((item) => item.category === 'CTA').length * 18);
  const booking = clampScore(90 - issues.filter((item) => item.category === 'Booking').length * 18);
  const seo = clampScore(88 - issues.filter((item) => item.category === 'SEO').length * 14);
  const mobile = clampScore(74);
  const overallScore = Math.round((clarity + trust + cta + booking + seo + mobile) / 6);
  const strongestPage = pages.find((page) => page.pageType !== 'home' && page.h1) || homepage;

  return {
    id: `ar-${Date.now()}`,
    overallScore,
    summary: 'Zumi found a few clear ways to improve first-impression clarity, trust, and the path to booking or buying.',
    source: 'heuristic_fallback',
    sourceMode: 'heuristic_fallback',
    fiveSecondImpression: homepage.h1
      ? `The site gives a partial sense of the offer, but the message can be sharper and more outcome-driven.`
      : 'The first impression is too vague. Visitors likely need more clarity in the first few seconds.',
    strongestPageFound: strongestPage?.url || client.website || 'Homepage',
    scores: {
      clarity,
      trust,
      cta,
      booking,
      seo,
      mobile
    },
    topIssues: issues.slice(0, 5),
    quickWins: [
      'Rewrite the homepage headline around the real business outcome.',
      'Add one strong CTA that is obvious in the first screen.',
      'Move trust signals and proof closer to the first decision point.',
      'Clean up the path to booking, quote request, or purchase.'
    ],
    recommendedFixes: [
      'Tighten the hero copy and CTA.',
      'Strengthen trust sections with proof, reviews, or FAQ.',
      'Simplify navigation and remove low-value clutter.',
      'Make the booking or contact step easier to spot and complete.'
    ],
    heroRewrite: {
      headline: 'Fix what’s costing you customers.',
      subheadline: `Zumi found the weak trust, clutter, and conversion friction making ${client.businessName || 'this business'} harder to buy from.`,
      cta: 'Get My Free Website Audit'
    },
    trustRecommendations: [
      'Add proof higher on the page.',
      'Use FAQs to handle objections before the prospect leaves.',
      'Show a cleaner story around results, experience, or reviews.'
    ],
    bookingFlowRecommendations: [
      'Put the main booking or inquiry CTA in the hero.',
      'Reduce friction in forms and next-step decisions.',
      'Make the contact path feel obvious on mobile.'
    ],
    seoRecommendations: [
      'Improve homepage title and meta description.',
      'Use one clear H1 and cleaner section headings.',
      'Add stronger internal links to services, pricing, and contact.'
    ],
    missingElements: issues.map((item) => item.issue),
    conversionLeaks: issues.map((item) => item.whyItHurts),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  auditJsonSchema,
  buildAuditInput,
  buildHeuristicAudit
};
