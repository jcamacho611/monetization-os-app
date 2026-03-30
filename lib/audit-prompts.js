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
    'You are Jeni, a free, ad-funded trust super-app for the AI era.',
    'Analyze this source summary and return a sharp trust-and-monetization audit for the best Jeni module hidden inside the signal.',
    'This is not a generic website review. It is a trust scan for founders, operators, families, creators, and teams reading a high-signal source.',
    'Assume Jeni stays free to use. Monetization should default to contextual ads, trusted partner placements, or protected direct-sold inventory outside the proof zone.',
    'Use scores.clarity as need clarity, scores.trust as trust-layer strength, scores.cta as ad-fit, scores.booking as receipt depth, scores.seo as platform potential, and scores.mobile as launch speed.',
    'Use topIssues for the clearest trust breaks, proof gaps, or weak signals.',
    'Use quickWins for fast wins, recommendedFixes for next strategic moves, trustRecommendations for receipt/share directions, bookingFlowRecommendations for ad-safe monetization paths, seoRecommendations for verifier/platform doors, and conversionLeaks for how the doubt or value travels socially.',
    'Use heroRewrite as the launch positioning block for the first free module: headline, subheadline, CTA.',
    'Use strongestPageFound for the best front-door module, strongest source anchor, or clearest wedge to build first.',
    'Keep the copy concise, calm, commercially useful, and Jeni-facing.',
    'Do not recommend paid plans, subscriptions, or sponsored verification. Keep ads out of receipts, verifier pages, identity decisions, and emergency flows.',
    'Do not mention missing data you cannot verify. Infer carefully from the page summaries provided.',
    'Set source to "openai" and sourceMode to "openai".',
    '',
    `Project name: ${client.businessName || 'Unknown signal'}`,
    `Lane: ${client.category || 'General trust signal'}`,
    `Goal: ${client.goal || 'Find the strongest trust, receipt, and ad-safe monetization direction hidden in this source'}`,
    `Signal URL: ${client.website || ''}`,
    '',
    'Structured signal summary:',
    JSON.stringify(siteSummary, null, 2)
  ].join('\n');
}

function clampScore(value) {
  return Math.max(20, Math.min(95, Number(value || 0)));
}

function inferBestModule(client, siteSummary) {
  const homepage = siteSummary.homepage || {};
  const pages = Array.isArray(siteSummary.pages) ? siteSummary.pages : [];
  const corpus = [
    client.businessName,
    client.category,
    client.goal,
    client.mainServices,
    client.notes,
    homepage.h1,
    homepage.metaDescription,
    homepage.heroText,
    ...pages.map((page) => page.h1),
    ...pages.map((page) => page.textExcerpt)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const modules = [
    { name: 'Jeni Shield', pattern: /(scam|fraud|imperson|phish|spoof|spam|gift card|wire|security|risk|urgent payment|identity theft)/g },
    { name: 'Jeni Truth', pattern: /(truth|real|verify|clip|video|screenshot|article|news|provenance|deepfake|viral|media)/g },
    { name: 'Jeni Wallet', pattern: /(bill|saving|savings|subscription|wallet|spend|merchant|price|budget|payment|charge)/g },
    { name: 'Jeni CareOps', pattern: /(care|caregiver|med|medication|appointment|doctor|elder|health|family handoff)/g },
    { name: 'Jeni HomeLedger', pattern: /(home|property|repair|claim|contractor|warranty|appliance|inventory|roof|plumb)/g },
    { name: 'Jeni CivicCopilot', pattern: /(civic|permit|filing|form|deadline|dmv|bureaucracy|paperwork|appeal|court|document)/g },
    { name: 'Jeni ClipShop', pattern: /(clipshop|shop|product|seller|catalog|checkout|storefront|creator commerce|affiliate|price drop)/g },
    { name: 'Jeni SkillDrop', pattern: /(skill|portfolio|resume|mentor|project|ship|career|hire|recruit|credential)/g },
    { name: 'Jeni MovePilot', pattern: /(move|moving|relocation|utility|address|quote|provider switch|transition)/g },
    { name: 'Jeni Passport', pattern: /(passport|identity|consent|passkey|auth|authentication|authorization|device trust|verified badge)/g }
  ];

  const ranked = modules
    .map((item) => ({
      name: item.name,
      score: (corpus.match(item.pattern) || []).length
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.score ? ranked[0].name : 'Jeni Shield';
}

function buildHeuristicAudit(client, siteSummary) {
  const homepage = siteSummary.homepage || {};
  const pages = Array.isArray(siteSummary.pages) ? siteSummary.pages : [];
  const issues = [];
  const corpus = [homepage.h1, homepage.metaDescription, homepage.heroText, ...pages.map((page) => page.textExcerpt)].join(' ').toLowerCase();
  const bestModule = inferBestModule(client, siteSummary);
  const hasSocialLanguage = /(share|story|friends|family|community|viral|creator|repost|comment|warn)/.test(corpus);
  const hasMoneyLanguage = /(price|pricing|bill|save|savings|pay|payment|insurance|fee|commission|marketplace|checkout|buy|sponsor|ad|contextual)/.test(corpus);
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
  const cta = clampScore((hasMoneyLanguage ? 84 : 64) - issues.filter((item) => item.category === 'Monetization').length * 14);
  const booking = clampScore((hasWorkflowLanguage ? 86 : 64) - issues.filter((item) => item.category === 'Defensibility').length * 14);
  const seo = clampScore((hasPlatformLanguage ? 82 : 60) - issues.filter((item) => item.category === 'Platform Door').length * 12);
  const mobile = clampScore(78);
  const overallScore = Math.round((clarity + trust + cta + booking + seo + mobile) / 6);
  const strongestPage = bestModule;

  return {
    id: `ar-${Date.now()}`,
    overallScore,
    summary: `${bestModule} looks like the strongest front-door move here, but the source still needs a sharper receipt, cleaner ad boundary, and clearer verifier layer before it feels category-defining.`,
    source: 'heuristic_fallback',
    sourceMode: 'heuristic_fallback',
    fiveSecondImpression: homepage.h1
      ? 'There is a usable signal here, but the trust break, module choice, and monetization boundary are not yet compressed into a strong enough launch promise.'
      : 'The first impression is still too vague. The source needs a clearer, more necessary opening move.',
    strongestPageFound: strongestPage || client.website || 'Primary signal',
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
      `Commit to ${bestModule} as the front-door module instead of trying to launch the whole super-app at once.`,
      'Name the trust break in one sentence that feels expensive or embarrassing to ignore.',
      'Define the receipt or proof object the product naturally creates.',
      'Decide exactly where contextual ads can appear without entering the proof zone.'
    ],
    recommendedFixes: [
      'Turn the source into a sharper one-line promise for the first free module.',
      'Prototype the first proof object people naturally share.',
      'Keep verifier pages, identity decisions, and emergency flows ad-free.',
      'Stress-test the receipt and verifier layer before investing in breadth.'
    ],
    heroRewrite: {
      headline: `Build ${bestModule} as the free trust front door for ${client.businessName || 'this signal'}.`,
      subheadline: 'Start with the risk or proof gap that already hurts, turn it into a signed receipt, and keep monetization outside the proof itself.',
      cta: 'Design the first module'
    },
    trustRecommendations: [
      'Turn the outcome into a receipt, card, warning, or verifier page people want to forward.',
      'Design the artifact for stories, DMs, comments, and group chats from day one.',
      'Make the share loop feel like utility, not marketing.'
    ],
    bookingFlowRecommendations: [
      'Default to contextual ads or trusted partner cards that appear only after the useful result is delivered.',
      'Use sponsored search or comparison units only in explicit browse and marketplace surfaces.',
      'Keep receipts, verifier pages, identity decisions, and emergency flows ad-free.'
    ],
    seoRecommendations: [
      'Look for the infrastructure layer hiding underneath the first use case.',
      'Ask whether this can become identity, verification, workflow, or trusted marketplace infrastructure.',
      'Do not chase the platform too early, but make sure the door is real.'
    ],
    missingElements: issues.map((item) => item.issue),
    conversionLeaks: [
      'The source can spread when the output itself becomes a warning, flex, or clarity object.',
      'The product gets stronger when it owns recurring behavior instead of one-off novelty.',
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
