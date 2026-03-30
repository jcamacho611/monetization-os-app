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
    'You are NA Kit, a premium venture-scan engine for necessary apps.',
    'Analyze this URL summary and return a sharp product-opportunity audit.',
    'This is not a website conversion audit. It is a concept scan for founders and operators.',
    'Use scores.clarity as urgency, scores.trust as shareability, scores.cta as monetization strength, scores.booking as defensibility, scores.seo as platform-door potential, and scores.mobile as speed to build.',
    'Use topIssues for the hottest opportunity openings or weaknesses in the thesis.',
    'Use quickWins for fast prototype wins, recommendedFixes for next strategic moves, trustRecommendations for share-artifact directions, bookingFlowRecommendations for monetization paths, seoRecommendations for platform doors, and conversionLeaks for why the concept could spread.',
    'Use heroRewrite as the launch positioning block: headline, subheadline, CTA.',
    'Keep the copy premium, concise, commercially useful, and founder-facing.',
    'Do not mention missing data you cannot verify. Infer carefully from the page summaries provided.',
    'Set source to "openai" and sourceMode to "openai".',
    'Use strongestPageFound for the single strongest signal or page worth anchoring the concept around.',
    '',
    `Project name: ${client.businessName || 'Unknown concept'}`,
    `Lane: ${client.category || 'General opportunity'}`,
    `Goal: ${client.goal || 'Find the strongest opportunity hidden in this signal'}`,
    `Signal URL: ${client.website || ''}`,
    '',
    'Structured signal summary:',
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
  const corpus = [homepage.h1, homepage.metaDescription, homepage.heroText, ...pages.map((page) => page.textExcerpt)].join(' ').toLowerCase();
  const hasSocialLanguage = /(share|story|friends|family|community|viral|creator|repost|comment|warn)/.test(corpus);
  const hasMoneyLanguage = /(price|pricing|subscription|bill|save|savings|pay|payment|insurance|fee|commission|marketplace|checkout|buy)/.test(corpus);
  const hasRiskLanguage = /(risk|fraud|scam|safety|protect|identity|security|urgent|loss|stolen|danger)/.test(corpus);
  const hasWorkflowLanguage = /(appointment|schedule|task|calendar|coordination|manage|track|reminder|workflow|claim|deadline|document)/.test(corpus);
  const hasPlatformLanguage = /(api|platform|network|marketplace|verification|identity|payments|payout|integrat|crm|graph)/.test(corpus);

  if (!homepage.h1 || homepage.h1.length < 12) {
    issues.push({
      category: 'Urgency',
      issue: 'The core pain is still too vague',
      whyItHurts: 'If the signal does not feel painfully obvious in the first seconds, the concept will be harder to pitch and prototype.',
      severity: 'high'
    });
  }

  if (!hasSocialLanguage) {
    issues.push({
      category: 'Shareability',
      issue: 'No native share artifact shows up yet',
      whyItHurts: 'The product needs a warning, flex, receipt, dashboard, or clarity object that wants to travel on its own.',
      severity: 'medium'
    });
  }

  if (!hasMoneyLanguage) {
    issues.push({
      category: 'Monetization',
      issue: 'The money path is not obvious enough',
      whyItHurts: 'If the concept cannot tie itself to an existing budget or transaction flow, it will feel like a nice-to-have.',
      severity: 'medium'
    });
  }

  if (!hasWorkflowLanguage) {
    issues.push({
      category: 'Defensibility',
      issue: 'Workflow lock-in is not visible yet',
      whyItHurts: 'The strongest apps own recurring behavior, history, or coordination that becomes painful to abandon.',
      severity: 'high'
    });
  }

  if (!hasPlatformLanguage) {
    issues.push({
      category: 'Platform Door',
      issue: 'The bigger infrastructure layer is still blurry',
      whyItHurts: 'Large outcomes usually appear when the app can grow into identity, payments, logistics, reputation, or trusted workflow.',
      severity: 'medium'
    });
  }

  if (!hasRiskLanguage && !hasMoneyLanguage && !hasWorkflowLanguage) {
    issues.push({
      category: 'Urgency',
      issue: 'The category may not be necessary enough yet',
      whyItHurts: 'The fastest-growing concepts usually attach to fear, savings, care, bureaucracy, or some other ongoing tension.',
      severity: 'medium'
    });
  }

  const clarity = clampScore((hasRiskLanguage ? 90 : 72) - issues.filter((item) => item.category === 'Urgency').length * 14);
  const trust = clampScore((hasSocialLanguage ? 88 : 68) - issues.filter((item) => item.category === 'Shareability').length * 14);
  const cta = clampScore((hasMoneyLanguage ? 86 : 66) - issues.filter((item) => item.category === 'Monetization').length * 14);
  const booking = clampScore((hasWorkflowLanguage ? 86 : 64) - issues.filter((item) => item.category === 'Defensibility').length * 14);
  const seo = clampScore((hasPlatformLanguage ? 82 : 60) - issues.filter((item) => item.category === 'Platform Door').length * 12);
  const mobile = clampScore(78);
  const overallScore = Math.round((clarity + trust + cta + booking + seo + mobile) / 6);
  const strongestPage = pages.find((page) => page.pageType !== 'home' && page.h1) || homepage;

  return {
    id: `ar-${Date.now()}`,
    overallScore,
    summary: 'NA Kit found a viable concept direction here, but the opportunity still needs a sharper artifact, money path, and platform framing before it feels category-defining.',
    source: 'heuristic_fallback',
    sourceMode: 'heuristic_fallback',
    fiveSecondImpression: homepage.h1
      ? 'There is a usable signal here, but the pain and business logic are not yet compressed into a strong enough launch promise.'
      : 'The first impression is still too vague. The category needs a clearer, more necessary opening move.',
    strongestPageFound: strongestPage?.url || client.website || 'Primary signal',
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
      'Name the pain in one sentence that feels expensive or embarrassing to ignore.',
      'Define the share artifact the product naturally creates.',
      'Pick the money model that already exists in the user’s life.',
      'Anchor the concept around one wedge instead of trying to serve everything at once.'
    ],
    recommendedFixes: [
      'Turn the category into a sharper one-line promise.',
      'Prototype the most viral output object first.',
      'Map the first customer wedge before expanding outward.',
      'Stress-test the platform door before investing in breadth.'
    ],
    heroRewrite: {
      headline: `Build the necessary version of ${client.businessName || 'this idea'}.`,
      subheadline: 'Start with the pain that already hurts, the output people naturally share, and the business model users already understand.',
      cta: 'Prototype the strongest wedge'
    },
    trustRecommendations: [
      'Turn the outcome into a receipt, card, warning, or dashboard people want to forward.',
      'Design the artifact for stories, DMs, and group chats from day one.',
      'Make the share loop feel like utility, not marketing.'
    ],
    bookingFlowRecommendations: [
      'Use a subscription if the pain is continuous and risky.',
      'Use pay-on-win if the savings or result is measurable.',
      'Use a take-rate if the product can sit inside a transaction flow.'
    ],
    seoRecommendations: [
      'Look for the infrastructure layer hiding underneath the first app.',
      'Ask whether this can become identity, trust, payment, logistics, or workflow infrastructure.',
      'Do not chase the platform too early, but make sure the door is real.'
    ],
    missingElements: issues.map((item) => item.issue),
    conversionLeaks: [
      'The category can spread when the output itself becomes a warning, flex, or clarity object.',
      'The app gets stronger when it owns recurring behavior instead of one-off novelty.',
      'The larger upside appears when the first wedge opens a future infrastructure layer.'
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  auditJsonSchema,
  buildAuditInput,
  buildHeuristicAudit
};
