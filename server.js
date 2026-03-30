require('dotenv').config({ quiet: true });

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const OpenAI = require('openai');
const storage = require('./lib/storage');
const { queueAuditJob } = require('./lib/audit-runner');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const followupModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const auditModel = process.env.OPENAI_AUDIT_MODEL || 'gpt-4.1';
const auditMaxPages = Number(process.env.AUDIT_MAX_PAGES || 5);
const auditFetchTimeoutMs = Number(process.env.AUDIT_FETCH_TIMEOUT_MS || 10000);
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});
const brand = {
  name: 'NA Kit',
  category: 'future app operator',
  audience: 'founders, operators, and people building necessary products',
  slogan: 'Necessary apps. Future doors.',
  headline: 'Ten necessary apps. One extraordinary launch surface.',
  subhead: 'NA Kit is a premium concept lab for viral, monetizable apps built around fear, savings, care, work, home, trust, and social proof.',
  supportingLine: 'Urgent pain. Shareable proof. Platform doors.',
  metaDescription: 'NA Kit is a premium future-app studio exploring necessary, viral, monetizable products across safety, money, care, work, home, commerce, and trust.',
  proofNote: 'These are Phase 1 venture concepts designed to create shareable proof, recurring budgets, and real platform expansion doors.',
  algorithmName: 'NA Signal Engine'
};
const nakitConcepts = [
  {
    slug: 'scamsentry',
    letter: 'A',
    title: 'ScamSentry',
    category: 'Safety + family protection',
    pitch: 'A family firewall that catches scams across calls, texts, DMs, emails, and payments.',
    viralHook: 'Shareable Scam Receipts that warn other people without exposing private data.',
    monetization: '$9–$19/mo family plan plus B2B bank and fintech partnerships.',
    door: 'Identity, verified communications, payment-risk infrastructure.',
    whyNow: 'Impersonation scams already cost billions and keep rising.'
  },
  {
    slug: 'billbuster',
    letter: 'B',
    title: 'BillBuster',
    category: 'Money + recurring spend',
    pitch: 'A one-button bill optimizer that cancels junk, negotiates spend, and turns savings into proof.',
    viralHook: 'Savings cards and monthly savings streaks people flex to friends.',
    monetization: 'Share-of-savings plus a $5–$15/mo automation tier.',
    door: 'Consumer finance autopilot, switching agent, spending permissions.',
    whyNow: 'Recurring spend creep is universal and under-managed.'
  },
  {
    slug: 'carecircle',
    letter: 'C',
    title: 'CareCircle',
    category: 'Family + health logistics',
    pitch: 'The shared operating layer for meds, appointments, transport, and aging-parent coordination.',
    viralHook: 'Privacy-safe care wins, streaks, and family accountability receipts.',
    monetization: '$12–$25/mo family plans plus employer and care-agency distribution.',
    door: 'Healthcare logistics, telehealth workflows, pharmacy coordination.',
    whyNow: 'Caregiving is rising, but coordination is still chaos.'
  },
  {
    slug: 'skillstack',
    letter: 'D',
    title: 'SkillStack',
    category: 'Work + learning reputation',
    pitch: 'A proof-of-skill network where weekly shipped output becomes the resume.',
    viralHook: 'Ship clips and proof cards that travel in short-form feeds.',
    monetization: '$10–$30/mo pro, recruiting SaaS, mentor marketplace take-rates.',
    door: 'Credential graph, apprenticeship market, reputation infrastructure.',
    whyNow: 'Resumes are weak signals; shipped work wins.'
  },
  {
    slug: 'homeledger',
    letter: 'E',
    title: 'HomeLedger',
    category: 'Home + property ops',
    pitch: 'Turn the home into a managed asset with maintenance, documentation, claims, and resale readiness.',
    viralHook: 'Before-and-after maintenance stories and home-value lift proof.',
    monetization: '$8–$20/mo household plans plus contractor and insurer partnerships.',
    door: 'Property ops, underwriting-grade home data, multi-home expansion.',
    whyNow: 'Homes are expensive; documentation and upkeep are fragmented.'
  },
  {
    slug: 'civiccopilot',
    letter: 'F',
    title: 'CivicCopilot',
    category: 'Life admin + bureaucracy',
    pitch: 'An assistant for forms, deadlines, disputes, appointments, and appeal trails.',
    viralHook: 'Shareable wins against bureaucracy: reduced fees, recovered money, faster appointments.',
    monetization: '$15–$99 per case plus $9–$25/mo admin subscription.',
    door: 'Life admin API for any repetitive paperwork process.',
    whyNow: 'The coordination tax of bureaucracy is still enormous.'
  },
  {
    slug: 'dateguard',
    letter: 'G',
    title: 'DateGuard',
    category: 'Dating + safety',
    pitch: 'A safety-first dating layer with identity checks, meetup plans, and panic-proof infrastructure.',
    viralHook: 'Green-flag badges and safety streaks among friends.',
    monetization: '$6–$15/mo, pay-per-verify, safety partnerships.',
    door: 'Portable trust primitives for dating, roommates, and P2P commerce.',
    whyNow: 'AI-fueled impersonation risk is colliding with online dating at scale.'
  },
  {
    slug: 'clipcommerce',
    letter: 'H',
    title: 'ClipCommerce',
    category: 'Commerce + creator video',
    pitch: 'A shop-the-clip layer that makes short-form video instantly shoppable and easier to trust.',
    viralHook: 'Shareable carts, dupe finds, and creator overlays that travel like content.',
    monetization: 'Affiliate + take-rate + creator and brand SaaS.',
    door: 'Social-video commerce infrastructure, creator payouts, product graphs.',
    whyNow: 'Short-form commerce keeps growing, but trust and logistics lag.'
  },
  {
    slug: 'movepilot',
    letter: 'I',
    title: 'MovePilot',
    category: 'Relocation + life transitions',
    pitch: 'A relocation OS that coordinates moves, switching, paperwork, and service setup end to end.',
    viralHook: 'Move scorecards, survival templates, and city swap guides people share.',
    monetization: 'Referral economics plus $10–$25 concierge tier.',
    door: 'Transition OS for newborns, job changes, marriage, divorce, and more.',
    whyNow: 'Life transitions are still chaotic and expensive.'
  },
  {
    slug: 'realitycheck',
    letter: 'J',
    title: 'RealityCheck',
    category: 'Information + trust',
    pitch: 'A social-first “is this real?” product that turns confusing content into clarity cards.',
    viralHook: 'Reality Cards built for reposts in stories, comments, and group chats.',
    monetization: '$5–$10/mo power user tier plus newsroom/community licenses.',
    door: 'Trust and verification API for media, marketplaces, and brands.',
    whyNow: 'Feeds are saturated and confusion has become the default.'
  }
];
const nakitMoats = [
  {
    title: 'Share artifact moat',
    body: 'The output becomes distribution: Scam Receipts, Savings Cards, Care Dashboards, Proof-of-Skill clips, and Reality Cards.'
  },
  {
    title: 'Workflow lock-in',
    body: 'Once a family, homeowner, or operator runs the workflow inside the app, switching becomes painful.'
  },
  {
    title: 'Platform door',
    body: 'Each idea can graduate from app to infrastructure once it owns a real layer of trust, payments, care, or logistics.'
  }
];
const nakitRankings = [
  {
    title: 'Fastest to cash',
    winner: 'ScamSentry',
    body: 'Urgent fear + obvious family subscription + natural social warning loop.'
  },
  {
    title: 'Most defensible',
    winner: 'CareCircle',
    body: 'Families do not rip out coordination layers once habits and history are there.'
  },
  {
    title: 'Highest ceiling',
    winner: 'ClipCommerce',
    body: 'It can sit directly in the transaction path of creator attention and product buying.'
  }
];
const nakitPaths = [
  'Urgent fear or urgent savings first.',
  'Turn the outcome into a shareable object.',
  'Charge where the budget already exists.',
  'Expand into the platform door once trust is earned.'
];
const nakitRevenueBuckets = [
  {
    title: 'Recurring protection',
    body: 'Subscription businesses win when the app protects people from constant loss, risk, or chaos.',
    examples: 'ScamSentry, CareCircle, HomeLedger'
  },
  {
    title: 'Performance fee',
    body: 'Pay-on-win models work when the result is measurable: savings recovered, fees reduced, or bureaucracy beaten.',
    examples: 'BillBuster, CivicCopilot'
  },
  {
    title: 'Throughput take-rate',
    body: 'The biggest upside appears when the app sits directly inside shopping, services, hiring, or transitions.',
    examples: 'ClipCommerce, MovePilot, SkillStack'
  }
];
const nakitAcquisitionChannels = [
  'Short-form creators with a native warning, flex, or transformation angle.',
  'Search intent around urgent pain like scams, bills, moving, or care.',
  'Community loops where people naturally forward help to friends or family.',
  'Institutional distribution once the first consumer wedge proves itself.'
];
const nakitScoreLabels = {
  clarity: 'Urgency',
  trust: 'Shareability',
  cta: 'Monetization',
  booking: 'Defensibility',
  seo: 'Platform Door',
  mobile: 'Build Speed'
};
const planPaymentLinks = {
  Starter: process.env.STRIPE_STARTER_PAYMENT_LINK || '',
  Operator: process.env.STRIPE_OPERATOR_PAYMENT_LINK || '',
  Concierge: process.env.STRIPE_CONCIERGE_PAYMENT_LINK || ''
};
const offerServices = [
  'Free website audit and action plan',
  'Homepage rewrite and CTA cleanup',
  'Service, treatment, or product page cleanup',
  'Trust, proof, review, and FAQ placement',
  'Booking or checkout flow cleanup',
  'Monthly optimization for pages that matter most'
];
const valueReasons = [
  {
    title: 'Easier to test',
    body: 'Start with the audit instead of paying for a full redesign before you know what matters.'
  },
  {
    title: 'More than software',
    body: 'Zumi can recommend, package, and guide the fixes so the site improves faster.'
  },
  {
    title: 'Built to protect the brand',
    body: 'Everything stays permission-based, preview-first, and approval-first.'
  }
];
const caseStudies = [
  {
    slug: 'summit-air-hvac',
    businessName: 'Summit Air HVAC',
    category: 'HVAC tune-up and install',
    image: '/proof-hvac-owner.svg',
    imageAlt: 'Confident HVAC business owner standing beside a sleek revenue dashboard and booked estimate cards.',
    headline: 'Turned stale install quotes into maintenance-plan conversations',
    challenge: 'The team was great at quoting work, but too many proposals sat untouched after the initial visit.',
    system: [
      'Estimate reactivation sequence across email and SMS',
      'Seasonal urgency messaging tied to weather and energy savings',
      'Upsell script for tune-up memberships on every follow-up'
    ],
    metrics: [
      { label: 'Reactivated quotes', value: '31%' },
      { label: 'Membership adds', value: '+19' },
      { label: 'Admin time saved', value: '6 hrs/wk' }
    ],
    summary: 'The result was not just more replies. It was a cleaner follow-up cadence that surfaced which jobs were still active and where to push the next offer.'
  },
  {
    slug: 'brightnest-cleaning',
    businessName: 'BrightNest Cleaning',
    category: 'Recurring and move-out cleaning',
    image: '/proof-cleaning-owner.svg',
    imageAlt: 'Happy cleaning business owner with five-star reviews and repeat booking signals.',
    headline: 'Converted one-time jobs into repeat revenue with post-service follow-up',
    challenge: 'Move-out clients were happy, but the business had no reliable system for reactivation, referrals, or review requests after the job closed.',
    system: [
      'Post-service thank-you sequence with review request',
      'Thirty-day reactivation message for recurring cleaning offers',
      'Referral prompt framed around busy families and property managers'
    ],
    metrics: [
      { label: 'Repeat bookings', value: '+31%' },
      { label: 'Referral replies', value: '17/mo' },
      { label: 'Review volume', value: '2x' }
    ],
    summary: 'Zumi made follow-up feel consistent and premium, which helped the business turn satisfied customers into an actual retention channel.'
  },
  {
    slug: 'atelier-rye',
    businessName: 'Atelier Rye',
    category: 'Creator-led clothing brand',
    image: '/hero-success-owners.svg',
    imageAlt: 'Stylized creator founders reviewing a premium storefront and social conversion dashboard.',
    headline: 'Cleaned up the storefront story and turned Instagram attention into higher-intent sales',
    challenge: 'The brand had strong visuals and audience attention, but the homepage, product pages, and social-to-site path were too unclear to convert consistently.',
    system: [
      'Homepage and product-page copy cleanup in plain English',
      'Sharper trust, shipping, and fit messaging near purchase decisions',
      'Post-click follow-up and review prompts connected to launch drops'
    ],
    metrics: [
      { label: 'Store conversion', value: '+18%' },
      { label: 'Product page depth', value: '+23%' },
      { label: 'Drop replay sales', value: '+9%' }
    ],
    summary: 'Zumi helped the brand feel more premium and easier to buy from, which made its Instagram traffic work harder instead of bouncing around the site.'
  },
  {
    slug: 'northshore-aesthetics',
    businessName: 'Northshore Aesthetics',
    category: 'Aesthetic clinic growth',
    image: '/hero-success-owners.svg',
    imageAlt: 'Stylized founders and staff reviewing a polished booking and trust dashboard.',
    headline: 'Turned consult drop-off and soft trust signals into stronger booking momentum',
    challenge: 'The clinic was getting attention, but too many inquiries stalled between the first DM, the pricing conversation, and the actual booking decision.',
    system: [
      'Permission-based site scan across the homepage, services, and about page',
      'Cleaner treatment copy, stronger trust sections, and simpler booking CTAs',
      'Follow-up and review prompts layered into the post-inquiry flow'
    ],
    metrics: [
      { label: 'Recovered consults', value: '+14/mo' },
      { label: 'Reply speed', value: '< 10 min' },
      { label: 'Booked treatments', value: '+26%' }
    ],
    summary: 'Zumi acted like a website and booking operator, cleaning up the front-end story, tightening the inquiry path, and recovering buyers who were already showing intent.'
  }
];
const faqItems = [
  {
    question: 'Who is Zumi best for?',
    answer: 'Businesses, brands, clinics, and booking-led teams that need a cleaner path from attention to sales.'
  },
  {
    question: 'What problem does it solve first?',
    answer: 'It shows why people are not booking or buying, then prepares a cleaner fix.'
  },
  {
    question: 'Does it publish changes automatically?',
    answer: 'No. The owner reviews the changes first.'
  },
  {
    question: 'What access does it need?',
    answer: 'Only the access needed for the job, and only with explicit permission.'
  }
];
const solutionPages = [
  {
    slug: 'follow-up-ai',
    label: 'Follow-Up AI',
    eyebrow: 'AI Messaging',
    headline: 'Personalized follow-up without the delay.',
    summary: 'Generate email, SMS, and WhatsApp follow-up drafts that fit the business, the lead, and the sales motion without sounding robotic.',
    promise: 'Faster replies with less manual writing.',
    bestFor: 'Estimate-driven teams and owners still writing every message by hand.',
    visual: '/hero-success-owners.svg',
    visualAlt: 'Silver-toned montage of business owners using Zumi follow-up tools.',
    metrics: [
      { label: 'Channels', value: '3' },
      { label: 'Draft time', value: '< 1 min' },
      { label: 'Tone fit', value: 'Custom' }
    ],
    deliverables: [
      'Channel-ready follow-up drafts for email, SMS, and WhatsApp.',
      'Messaging logic adapted to category, goal, and sales motion.',
      'Copy-ready output generated from the admin client screen.'
    ],
    outcomes: [
      'Respond faster without sacrificing tone.',
      'Keep follow-up consistent across every lead.',
      'Shorten the gap between inquiry and booked job.'
    ]
  },
  {
    slug: 'missed-call-recovery',
    label: 'Missed Call Recovery',
    eyebrow: 'Revenue Rescue',
    headline: 'Catch missed-call revenue before it disappears.',
    summary: 'Route lost call intent into a fast recovery sequence so voicemail does not turn into dead revenue.',
    promise: 'Recover demand that already exists.',
    bestFor: 'Plumbing, electrical, roofing, and urgent-response operators.',
    visual: '/proof-plumbing-owner.svg',
    visualAlt: 'Successful plumbing business owner reviewing recovered call revenue.',
    metrics: [
      { label: 'Response goal', value: '< 5 min' },
      { label: 'Use case', value: 'Urgent' },
      { label: 'Focus', value: 'Recover' }
    ],
    deliverables: [
      'Fast callback and text recovery flow.',
      'Priority routing logic for urgent leads.',
      'Clear next-step messaging for missed-call recovery.'
    ],
    outcomes: [
      'Stop losing high-intent after-hours leads.',
      'Give urgent prospects a path back into the pipeline.',
      'Turn missed demand into booked jobs.'
    ]
  },
  {
    slug: 'review-requests',
    label: 'Review Requests',
    eyebrow: 'Trust Engine',
    headline: 'Turn good jobs into better proof.',
    summary: 'Trigger polished post-service review asks so satisfied customers actually leave visible proof that helps close the next lead.',
    promise: 'More proof without awkward asking.',
    bestFor: 'Cleaning, detailing, landscaping, and repeat-service businesses.',
    visual: '/proof-cleaning-owner.svg',
    visualAlt: 'Happy cleaning business owner with five-star review signals.',
    metrics: [
      { label: 'Timing', value: 'Post-job' },
      { label: 'Goal', value: '5-star proof' },
      { label: 'Flow', value: 'Automatic' }
    ],
    deliverables: [
      'Review request prompts built into the client workflow.',
      'Follow-up timing designed for completed jobs.',
      'Retention and referral nudges tied to service satisfaction.'
    ],
    outcomes: [
      'Increase visible social proof.',
      'Create a more premium post-service experience.',
      'Turn satisfied clients into a growth asset.'
    ]
  },
  {
    slug: 'reactivation',
    label: 'Lead Reactivation',
    eyebrow: 'Pipeline Revival',
    headline: 'Bring old quotes and stale leads back to life.',
    summary: 'Install a reactivation sequence for leads that cooled off after the estimate, proposal, or first conversation.',
    promise: 'Recover work from the pipeline you already paid for.',
    bestFor: 'HVAC, remodeling, solar, and service teams with open estimates.',
    visual: '/proof-hvac-owner.svg',
    visualAlt: 'Confident HVAC owner with reopened estimate and revenue signals.',
    metrics: [
      { label: 'Sequence', value: 'Multi-step' },
      { label: 'Target', value: 'Stale quotes' },
      { label: 'Motion', value: 'Reopen' }
    ],
    deliverables: [
      'Quote reactivation sequence with urgency and value framing.',
      'Offer-angle suggestions for tune-ups, memberships, or financing.',
      'Clear re-engagement cadence for dormant opportunities.'
    ],
    outcomes: [
      'Reopen leads that still have intent.',
      'Create clarity around active versus dead quotes.',
      'Grow revenue without buying more leads first.'
    ]
  },
  {
    slug: 'done-for-you',
    label: 'Done-For-You Setup',
    eyebrow: 'Operator Layer',
    headline: 'Launch the system without building it all yourself.',
    summary: 'Package Zumi as a guided setup and ongoing optimization service so businesses can buy results, not just software.',
    promise: 'More authority, less friction.',
    bestFor: 'Founders selling hands-on setup, onboarding, and optimization.',
    visual: '/hero-success-owners.svg',
    visualAlt: 'Premium silver montage of successful service business owners and operator dashboards.',
    metrics: [
      { label: 'Offer type', value: 'Hybrid' },
      { label: 'Setup', value: 'Guided' },
      { label: 'Positioning', value: 'Premium' }
    ],
    deliverables: [
      'Guided onboarding and system configuration.',
      'Ongoing follow-up and proof optimization.',
      'A done-with-you packaging layer for higher-ticket sales.'
    ],
    outcomes: [
      'Sell a premium service, not just access.',
      'Increase trust for smaller businesses that want help.',
      'Create a clearer path from prototype to paid offer.'
    ]
  }
];
const pricingPlans = [
  {
    name: 'Starter',
    price: '$149',
    cadence: '/mo',
    description: 'For businesses that want a clear first fix without committing to a giant redesign.',
    href: '/intake?plan=Starter',
    cta: 'Start $149 Fix',
    paymentLink: planPaymentLinks.Starter,
    features: [
      'Free audit, roadmap, and highest-priority fixes.',
      'Homepage, CTA, and page-copy cleanup recommendations.',
      'Trust and booking-flow recommendations you can approve fast.'
    ]
  },
  {
    name: 'Operator',
    price: '$299',
    cadence: '/mo',
    description: 'For businesses that want ongoing website, conversion, and follow-up improvement instead of one-off fixes.',
    href: '/intake?plan=Pro',
    cta: 'Start $299 Plan',
    badge: 'Most Popular',
    paymentLink: planPaymentLinks.Operator,
    features: [
      'Everything in Starter plus monthly page and flow improvements.',
      'Booking, review, inquiry, and reactivation cleanup.',
      'Priority support for businesses that need a tighter growth system.'
    ]
  },
  {
    name: 'Concierge',
    price: '$750',
    cadence: ' setup + custom',
    description: 'For founders who want Zumi packaged like a guided redesign and growth operator service.',
    href: '/intake?plan=Done-With-You',
    cta: 'Book Concierge Call',
    paymentLink: planPaymentLinks.Concierge,
    features: [
      'Guided site cleanup, structure work, and premium positioning help.',
      'Hands-on support around trust, conversion, and launch decisions.',
      'Best fit when you want service plus software, not software alone.'
    ]
  }
];
const platformPillars = [
  {
    name: 'Connect',
    href: '/about',
    headline: 'Connect the website, social stack, profile data, and booking systems with permission.',
    body: 'Zumi starts with clear authorization, narrow scopes, and revocable access so the business understands exactly what the operator can touch.'
  },
  {
    name: 'Diagnose',
    href: '/how-it-works',
    headline: 'Scan the site for weak copy, dated layout, booking friction, SEO gaps, and trust problems.',
    body: 'The first job is understanding what is hurting revenue today so the business gets a clean report instead of vague AI noise.'
  },
  {
    name: 'Approve',
    href: '/authorization',
    headline: 'Prepare safer upgrades in preview mode, then publish only after approval.',
    body: 'Zumi is designed to draft, preview, and log changes before they go live so the operator feels premium, not reckless.'
  }
];
const industrySegments = [
  {
    label: 'Service Businesses',
    body: 'High-intent sites that need clearer trust, stronger pages, and a faster path from visit to call or quote.'
  },
  {
    label: 'Clinics + Studios',
    body: 'Booking-led pages that need stronger trust, cleaner service structure, and better consult conversion.'
  },
  {
    label: 'Creator-Led Brands',
    body: 'Instagram-first businesses, creator storefronts, and personal brands that need cleaner product stories and stronger conversion flow.'
  },
  {
    label: 'Clothing Brands',
    body: 'Merch and apparel sites that need sharper product pages, cleaner drops, and better social-to-store conversion.'
  },
  {
    label: 'Agencies',
    body: 'A white-glove operator layer for managing client sites, copy refreshes, and booking growth with cleaner approvals.'
  },
  {
    label: 'Consultants',
    body: 'Premium personal brands and service sites that need clearer positioning, stronger pages, and cleaner conversion paths.'
  },
  {
    label: 'Sales Teams',
    body: 'Operator-led landing pages, trust cleanup, and handoff flows that help booked calls convert better.'
  },
  {
    label: 'Appointment-Based Businesses',
    body: 'Studios, salons, and clinics that live on bookings and need less friction between inquiry and calendar.'
  },
  {
    label: 'Med Spas',
    body: 'Luxury service sites that need cleaner treatment pages, safer publishing, and stronger inquiry-to-appointment flow.'
  },
  {
    label: 'Growing Brands',
    body: 'Businesses that want their site, trust signals, and approval flow to feel world-class before scaling paid traffic.'
  }
];
// Placeholder descriptors for future connected public and integrated sources.
const sourceConnectorScaffolds = [
  {
    label: 'Website Connectors',
    body: 'Platform connections for WordPress, Webflow, Shopify, and custom site environments.'
  },
  {
    label: 'Social + Profile Connectors',
    body: 'Instagram, Facebook, Google Business, and creator-profile signals that shape brand context and trust.'
  },
  {
    label: 'Storefront + Booking Connectors',
    body: 'Booking systems, storefront tools, and review platforms that affect how the business converts attention into sales.'
  },
  {
    label: 'CRM Integrations',
    body: 'Future connected records for reactivation, duplicate suppression, and workflow routing.'
  },
  {
    label: 'Communication Channels',
    body: 'Email, SMS, and messaging channels used after the site and conversion workflow are cleaned up.'
  }
];
const medSpaConnectorMatrix = [
  {
    connector: 'WordPress',
    auth: 'Application Passwords, OAuth, or JWT plugin',
    scopes: 'Posts, pages, media, and content updates',
    complexity: '2/5',
    notes: 'Use revisions and draft-first publishing instead of editing live pages directly.'
  },
  {
    connector: 'Webflow',
    auth: 'OAuth or site API token',
    scopes: 'CMS items, pages, assets, and publish-ready updates',
    complexity: '3/5',
    notes: 'Treat Designer and publish access carefully, and stage changes before the owner pushes live.'
  },
  {
    connector: 'Shopify',
    auth: 'Shopify app OAuth',
    scopes: 'Theme, content, scripts, and store content APIs',
    complexity: '4/5',
    notes: 'Best handled through unpublished themes or branch-like preview flows.'
  },
  {
    connector: 'Instagram + Facebook',
    auth: 'Meta OAuth',
    scopes: 'Business profile, content publishing, and page permissions',
    complexity: '3/5',
    notes: 'Requires business accounts, clear consent UX, and likely App Review.'
  },
  {
    connector: 'Google Business Profile',
    auth: 'Google OAuth',
    scopes: 'Business profile management and review access',
    complexity: '3/5',
    notes: 'Use narrow scopes and explain exactly what is being read or updated.'
  },
  {
    connector: 'Calendly / Booking',
    auth: 'OAuth or personal token',
    scopes: 'Scheduling read-write and webhook access',
    complexity: '2/5',
    notes: 'Useful for no-show reminders, follow-up timing, and booking flow visibility.'
  }
];
const medSpaPublishingSafeguards = [
  {
    name: 'Permissioned Access',
    headline: 'Every connector should be explicit, revocable, and least-privilege by default.',
    body: 'Only ask for the exact scopes needed for scanning, drafting, or publishing. Owners should always know what Zumi can touch.'
  },
  {
    name: 'Preview Before Publish',
    headline: 'Never push changes live blindly.',
    body: 'Use drafts, staging modes, preview themes, or unpublished changesets before anything reaches a public med spa site.'
  },
  {
    name: 'Audit + Rollback',
    headline: 'Every action should be logged and reversible.',
    body: 'Store change history, record what connector made the update, and keep a rollback path through revisions, themes, or snapshots.'
  }
];
const medSpaAiModules = [
  {
    name: 'Site Scanner',
    headline: 'Crawl the site, map the structure, and extract content, media, and SEO signals.',
    body: 'This is the intake layer for everything else. It should use platform APIs when available and public crawling when allowed.'
  },
  {
    name: 'Brand Brain',
    headline: 'Learn the spa’s voice, offers, visual tone, and customer positioning.',
    body: 'Use site content, social context, and structured notes so copy and design recommendations still feel on-brand.'
  },
  {
    name: 'Copy Agent',
    headline: 'Rewrite service pages, CTAs, and conversion copy with a stronger booking focus.',
    body: 'Treat all AI output as draft material until a human approves it, especially in a health-adjacent vertical.'
  },
  {
    name: 'Design Agent',
    headline: 'Suggest cleaner layouts, higher-trust sections, and premium med-spa visual upgrades.',
    body: 'The best practical output is often structured component changes, not uncontrolled full-site redesigns.'
  },
  {
    name: 'Conversion Agent',
    headline: 'Find friction in booking flows, weak CTAs, missing trust signals, and offer gaps.',
    body: 'This is where booking intent gets protected instead of leaking through weak forms or poor page structure.'
  },
  {
    name: 'Patch Agent',
    headline: 'Turn approved decisions into safe platform-specific updates.',
    body: 'The final step should publish through guarded workflows, not unreviewed direct edits.'
  }
];
const medSpaComplianceBlocks = [
  {
    name: 'Privacy',
    headline: 'Handle business, visitor, and appointment-related data under clear privacy policies.',
    body: 'Support deletion rights, data retention limits, and consent language aligned with GDPR and CCPA expectations.'
  },
  {
    name: 'HIPAA Risk',
    headline: 'Assume health-adjacent data can trigger a higher compliance bar.',
    body: 'If inquiries or appointments contain treatment information, storage, analytics, vendors, and staff access all need tighter controls.'
  },
  {
    name: 'Legal Consent',
    headline: 'The owner must explicitly authorize account access and change authority.',
    body: 'Use clickwrap or equivalent consent flows for connectors, terms, privacy, and any future automated publishing actions.'
  }
];
const medSpaOnboardingSteps = [
  'Create the operator account, accept terms, and define the brand owner.',
  'Connect the website platform with a scoped connector or application password.',
  'Connect social, profile, analytics, and booking systems with permission.',
  'Run the first scan and show a no-risk report before asking for deeper activation.',
  'Approve changes in preview mode, then publish through a tracked workflow.'
];
const operatorFixes = [
  {
    label: 'Homepage clarity',
    body: 'Rewrite the hero, simplify the hierarchy, and make the value obvious in plain English.'
  },
  {
    label: 'About page trust',
    body: 'Turn a weak story into a cleaner explanation of who the business helps and why people trust it.'
  },
  {
    label: 'Booking flow friction',
    body: 'Reduce the clicks, confusion, and hesitation between interest and booked appointment.'
  },
  {
    label: 'Service page cleanup',
    body: 'Group treatments or offers more clearly so the site feels premium instead of cluttered.'
  },
  {
    label: 'Proof and social trust',
    body: 'Add cleaner review, before-and-after, and credibility blocks without making the page noisy.'
  },
  {
    label: 'SEO and accessibility',
    body: 'Improve headings, metadata, image alt text, contrast, and structure so the site performs better.'
  }
];
const operatorJourney = [
  {
    name: 'Connect',
    headline: 'The owner gives Zumi approved access to the site, socials, profile data, and booking stack.',
    body: 'Everything starts with permission, scope awareness, and a clear record of what can be scanned or changed.'
  },
  {
    name: 'Scan',
    headline: 'Zumi maps the full site, brand story, design quality, and conversion weak points.',
    body: 'It looks across copy, layout, trust signals, mobile clarity, SEO basics, and booking friction.'
  },
  {
    name: 'Improve',
    headline: 'AI drafts cleaner copy, calmer layouts, stronger CTAs, and better booking flows.',
    body: 'The system works like a design and growth operator, not a random content generator.'
  },
  {
    name: 'Approve',
    headline: 'Every meaningful update goes through preview, approval, logging, and rollback safety.',
    body: 'That keeps the product premium, believable, and safer for med spas or any booking-led business.'
  }
];
const trustHighlights = [
  {
    name: 'Privacy Policy',
    href: '/privacy',
    headline: 'Explain what Zumi collects, why it collects it, and how the business can revoke or delete it.',
    body: 'The baseline trust layer covers business records, connector data, site snapshots, and deletion expectations.'
  },
  {
    name: 'Terms of Service',
    href: '/terms',
    headline: 'Define approval responsibility, content ownership, billing posture, and publishing boundaries clearly.',
    body: 'The product needs plain-English terms so the owner understands what Zumi is and is not responsible for.'
  },
  {
    name: 'Authorization Pack',
    href: '/authorization',
    headline: 'Make connector access and publishing authority explicit before any change is made.',
    body: 'This is the owner-facing consent layer for website access, social connectors, previews, and approval-first publishing.'
  }
];

app.disable('x-powered-by');
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

async function readClients() {
  return storage.listClients();
}

async function writeClients() {
  throw new Error('writeClients is no longer used directly. Use storage methods instead.');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown' : dateFormatter.format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown' : dateTimeFormatter.format(date);
}

async function getClientById(clientId) {
  return storage.getClientById(clientId);
}

function getDomainFromWebsite(website = '') {
  const raw = String(website || '').trim();

  if (!raw) {
    return '';
  }

  try {
    const url = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(`https://${raw}`);
    return url.hostname.replace(/^www\./, '');
  } catch (error) {
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function getClientDisplayName(client = {}) {
  return client.businessName || getDomainFromWebsite(client.website) || 'Website Lead';
}

function getClientContactSummary(client = {}) {
  if (client.phone) {
    return client.phone;
  }

  if (client.email) {
    return client.email;
  }

  return 'Research needed';
}

function getCallLogs(client = {}) {
  return Array.isArray(client.callLogs) ? client.callLogs : [];
}

function getLatestCallLog(client = {}) {
  const logs = getCallLogs(client);
  return logs.length ? logs[logs.length - 1] : null;
}

function getCallOutcomeLabel(outcome = 'new') {
  const labels = {
    new: 'New lead',
    researching: 'Researching contact',
    called: 'Called',
    no_answer: 'No answer',
    left_vm: 'Left voicemail',
    texted: 'Text sent',
    emailed: 'Email sent',
    spoke: 'Spoke to owner',
    booked: 'Booked call',
    won: 'Won',
    lost: 'Not a fit'
  };

  return labels[outcome] || 'Updated';
}

function getCallStatus(client = {}) {
  const latest = getLatestCallLog(client);

  if (!latest) {
    return 'Needs first call';
  }

  return getCallOutcomeLabel(latest.outcome);
}

function getNextCallAction(client = {}) {
  const latest = getLatestCallLog(client);

  if (!latest) {
    return 'Review site and call';
  }

  if (latest.nextStep) {
    return latest.nextStep;
  }

  if (latest.nextDate) {
    return `Follow up ${formatDate(latest.nextDate)}`;
  }

  return getCallOutcomeLabel(latest.outcome);
}

function channelLabel(channel = 'email') {
  if (channel === 'sms') {
    return 'SMS';
  }

  if (channel === 'whatsapp') {
    return 'WhatsApp';
  }

  return 'Email';
}

function mostCommonChannel(clients) {
  const counts = clients.reduce((accumulator, client) => {
    const channel = client.preferredChannel || 'email';
    accumulator[channel] = (accumulator[channel] || 0) + 1;
    return accumulator;
  }, {});

  const [topChannel] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] || ['email'];
  return topChannel;
}

function getBusinessSizeLabel(size = 'small-team') {
  const labels = {
    solo: 'Solo Operator',
    'small-team': 'Small Team',
    'growing-team': 'Growing Team',
    'multi-location': 'Multi-Location',
    enterprise: 'Enterprise'
  };

  return labels[size] || 'Small Team';
}

function getLeadVolumeLabel(volume = 'steady') {
  const labels = {
    light: 'Light Lead Flow',
    steady: 'Steady Lead Flow',
    high: 'High Lead Flow',
    surging: 'Surging Lead Flow'
  };

  return labels[volume] || 'Steady Lead Flow';
}

function getSalesMotionLabel(motion = 'mixed') {
  const labels = {
    emergency: 'Emergency Demand',
    estimate: 'Estimate Follow-up',
    recurring: 'Recurring Revenue',
    'high-ticket': 'High-Ticket Sales',
    mixed: 'Mixed Service Motion'
  };

  return labels[motion] || 'Mixed Service Motion';
}

function getSitePlatformLabel(platform = 'wordpress') {
  const labels = {
    wordpress: 'WordPress',
    webflow: 'Webflow',
    shopify: 'Shopify',
    custom: 'Custom / Other'
  };

  return labels[platform] || 'WordPress';
}

function normalizePlan(plan = 'Starter') {
  const labels = {
    Starter: 'Starter',
    Pro: 'Pro',
    Operator: 'Pro',
    'Done-With-You': 'Done-With-You',
    Concierge: 'Done-With-You'
  };

  return labels[plan] || 'Starter';
}

function getPlanLabel(plan = 'Starter') {
  const labels = {
    Starter: 'Starter',
    Pro: 'Operator',
    'Done-With-You': 'Concierge'
  };

  return labels[plan] || plan || 'Starter';
}

function getPlanPaymentLink(plan = 'Starter') {
  const label = getPlanLabel(plan);
  return planPaymentLinks[label] || '';
}

function inferBusinessSize(client) {
  if (client.businessSize) {
    return client.businessSize;
  }

  if (client.plan === 'Pro') {
    return 'growing-team';
  }

  return 'small-team';
}

function inferLeadVolume(client) {
  if (client.leadVolume) {
    return client.leadVolume;
  }

  const size = inferBusinessSize(client);

  if (size === 'solo') {
    return 'light';
  }

  if (size === 'growing-team' || size === 'multi-location' || size === 'enterprise') {
    return 'high';
  }

  return 'steady';
}

function inferSalesMotion(client) {
  if (client.salesMotion) {
    return client.salesMotion;
  }

  const category = (client.category || '').toLowerCase();
  const goalAndNotes = `${client.goal || ''} ${client.notes || ''}`.toLowerCase();

  if (/(plumb|hvac|electric|locksmith|restoration|garage|towing|emergency)/.test(category) || /(urgent|same day|missed call|after-hours|emergency)/.test(goalAndNotes)) {
    return 'emergency';
  }

  if (/(clean|landscap|lawn|pool|pest|maintenance)/.test(category) || /(repeat|recurring|membership|retention|weekly|monthly)/.test(goalAndNotes)) {
    return 'recurring';
  }

  if (/(roof|solar|remodel|paint|window|fence|install)/.test(category) || /(estimate|quote|proposal|high ticket)/.test(goalAndNotes)) {
    return 'estimate';
  }

  return 'mixed';
}

function buildZumiBlueprint(client) {
  const businessSize = inferBusinessSize(client);
  const leadVolume = inferLeadVolume(client);
  const salesMotion = inferSalesMotion(client);
  const preferredChannel = client.preferredChannel || 'email';
  const goal = client.goal || 'book more qualified jobs';
  const category = client.category || 'Local Service';
  const sizeLabel = getBusinessSizeLabel(businessSize);
  const volumeLabel = getLeadVolumeLabel(leadVolume);
  const motionLabel = getSalesMotionLabel(salesMotion);

  let engineName = 'Lead Lift Engine';
  let responseTarget = 'Respond within 15 minutes';
  let offerAngle = `show how ${client.businessName || 'the business'} can win more jobs without adding admin work`;
  let reviewTiming = 'Request a review right after the job is completed';
  let primaryChannel = preferredChannel;
  let secondaryChannel = preferredChannel === 'email' ? 'sms' : 'email';
  let cadence = [
    'Immediate acknowledgment',
    'Same-day value follow-up',
    '24-hour reactivation',
    'Post-job review prompt'
  ];
  let launchSteps = [
    `Map ${sizeLabel.toLowerCase()} operating constraints and the main goal around ${goal}.`,
    `Launch a ${motionLabel.toLowerCase()} sequence through ${channelLabel(primaryChannel)} first, then support it with ${channelLabel(secondaryChannel)}.`,
    'Close the loop with a review or rebooking request so every completed job creates more momentum.'
  ];

  if (salesMotion === 'emergency') {
    engineName = 'Rapid Response Engine';
    responseTarget = businessSize === 'solo' ? 'Respond within 5 minutes' : 'Respond within 3 minutes';
    offerAngle = 'recover urgent jobs before they call the next provider';
    reviewTiming = 'Send a review ask within 2 hours of the completed visit';
    primaryChannel = preferredChannel === 'email' ? 'sms' : preferredChannel;
    secondaryChannel = primaryChannel === 'sms' ? 'email' : 'sms';
    cadence = [
      '90-second missed-call text',
      '10-minute reassurance follow-up',
      '2-hour quote or booking reminder',
      'Same-day review request'
    ];
  } else if (salesMotion === 'recurring') {
    engineName = 'Retention Flywheel';
    responseTarget = 'Respond within 30 minutes';
    offerAngle = 'turn one-time jobs into repeat bookings and referrals';
    reviewTiming = 'Ask for the review after the service win, then follow with a rebooking prompt at 30 days';
    primaryChannel = preferredChannel;
    secondaryChannel = preferredChannel === 'email' ? 'sms' : 'email';
    cadence = [
      'Welcome and expectation-setting message',
      'Post-service thank-you',
      'Review request within 24 hours',
      '30-day reactivation offer'
    ];
  } else if (salesMotion === 'estimate') {
    engineName = 'Quote Revival Engine';
    responseTarget = businessSize === 'enterprise' ? 'Respond within 2 business hours' : 'Respond within 1 business hour';
    offerAngle = 'bring stalled proposals back into active conversations';
    reviewTiming = 'Ask for the review once the project is signed off and the customer sees the finished result';
    primaryChannel = preferredChannel === 'sms' ? 'email' : preferredChannel;
    secondaryChannel = primaryChannel === 'email' ? 'sms' : 'email';
    cadence = [
      'Estimate recap within 1 hour',
      'Value-based follow-up at 24 hours',
      'Objection-handling nudge at 72 hours',
      'Final check-in before the opportunity goes cold'
    ];
  } else if (salesMotion === 'high-ticket') {
    engineName = 'Consult Conversion Engine';
    responseTarget = 'Respond within 30 minutes';
    offerAngle = 'turn high-intent consult interest into booked revenue without losing the premium feel';
    reviewTiming = 'Request a review after the treatment outcome is visible and the client feels confident sharing it';
    primaryChannel = preferredChannel === 'email' ? 'sms' : preferredChannel;
    secondaryChannel = primaryChannel === 'sms' ? 'email' : 'sms';
    cadence = [
      'Fast consult acknowledgment',
      'Same-day clarity follow-up',
      '24-hour booking nudge',
      'Post-visit review and rebooking prompt'
    ];
  }

  if (leadVolume === 'surging' || leadVolume === 'high') {
    launchSteps[0] = `Score incoming ${category.toLowerCase()} leads by speed, deal value, and close likelihood for a ${volumeLabel.toLowerCase()} environment.`;
  }

  if (businessSize === 'multi-location' || businessSize === 'enterprise') {
    launchSteps[1] = `Standardize the ${engineName.toLowerCase()} across teams, while routing hot leads to the right location or operator automatically.`;
  }

  const automationFocus = [
    `${sizeLabel} profile`,
    motionLabel,
    volumeLabel,
    `${channelLabel(primaryChannel)}-first sequence`
  ];

  const summary = `${brand.algorithmName} read this business as a ${sizeLabel.toLowerCase()} running a ${motionLabel.toLowerCase()} model with ${volumeLabel.toLowerCase()}. That means the first priority is to ${offerAngle}.`;

  return {
    engineName,
    businessSize,
    leadVolume,
    salesMotion,
    sizeLabel,
    volumeLabel,
    motionLabel,
    primaryChannel,
    secondaryChannel,
    responseTarget,
    reviewTiming,
    offerAngle,
    cadence,
    launchSteps,
    automationFocus,
    summary
  };
}

function getTargetTypeLabel(targetType = 'opportunities') {
  const labels = {
    businesses: 'Businesses',
    leads: 'Leads',
    listings: 'Listings',
    buyers: 'Buyers',
    opportunities: 'Opportunities'
  };

  return labels[targetType] || 'Opportunities';
}

function getTargetTypeSingular(targetType = 'opportunities') {
  const labels = {
    businesses: 'business',
    leads: 'lead',
    listings: 'listing',
    buyers: 'buyer',
    opportunities: 'opportunity'
  };

  return labels[targetType] || 'opportunity';
}

function getUrgencyLabel(urgency = 'fast') {
  const labels = {
    low: 'Low Urgency',
    standard: 'Standard Urgency',
    fast: 'Fast Response',
    immediate: 'Immediate Response'
  };

  return labels[urgency] || 'Fast Response';
}

function buildOpportunityBlueprint(input = {}) {
  const pseudoClient = {
    businessName: input.businessName || 'NA Kit Preview',
    category: input.businessType || 'General Business',
    goal: input.searchGoal || 'surface real opportunities and convert them faster',
    notes: `Location: ${input.location || 'target market'}. Target: ${input.targetType || 'opportunities'}. Urgency: ${input.responseUrgency || 'fast'}.`,
    businessSize: input.businessSize || 'small-team',
    leadVolume: input.leadVolume || 'steady',
    salesMotion: input.salesMotion || 'mixed',
    preferredChannel: input.preferredChannel || 'email'
  };
  const base = buildZumiBlueprint(pseudoClient);
  const targetType = input.targetType || 'opportunities';
  const location = input.location || 'your target market';
  const urgencyLabel = getUrgencyLabel(input.responseUrgency || 'fast');
  const targetLabel = getTargetTypeLabel(targetType);

  let sourceMix = [
    'Connected public inputs',
    'Directory-ready source placeholders',
    'Integrated record matching'
  ];
  let verificationProfile = [
    'Duplicate suppression',
    'Suspicious-pattern filter',
    'Freshness and quality scoring'
  ];
  let workflowRecommendation = `Launch ${base.engineName.toLowerCase()} after qualifying each ${targetLabel.toLowerCase()} result.`;

  if (targetType === 'listings') {
    sourceMix = ['Connected public listings', 'Directory-ready feeds', 'Integrated record matching'];
    workflowRecommendation = 'Turn qualified listings into verification tasks, follow-up plans, or operator queues.';
  } else if (targetType === 'buyers' || targetType === 'leads') {
    sourceMix = ['Connected public demand inputs', 'Integrated lead records', 'Referral and reactivation history'];
    verificationProfile = ['Duplicate suppression', 'Freshness scoring', 'Likely junk and suspicious filter'];
    workflowRecommendation = 'Route qualified buyer intent into follow-up, reminders, or reactivation automatically.';
  }

  if ((input.responseUrgency || 'fast') === 'immediate') {
    workflowRecommendation = 'Prioritize the freshest qualified results and launch an immediate response workflow.';
  }

  const sourceMixLabel = sourceMix.join(' + ');
  const launchPlan = [
    `Search ${location} for ${(input.businessType || 'relevant').toLowerCase()} ${targetLabel.toLowerCase()}.`,
    `Apply ${verificationProfile[0].toLowerCase()}, ${verificationProfile[1].toLowerCase()}, and ${verificationProfile[2].toLowerCase()} before routing.`,
    `${workflowRecommendation} Account creation only becomes necessary when saving, exporting, or activating the workflow.`
  ];

  return {
    ...base,
    engineName: `${base.engineName} Discovery Layer`,
    location,
    targetType,
    targetLabel,
    responseUrgency: input.responseUrgency || 'fast',
    urgencyLabel,
    sourceMix,
    sourceMixLabel,
    verificationProfile,
    outreachChannelMix: [channelLabel(base.primaryChannel), channelLabel(base.secondaryChannel), 'Operator review'],
    workflowRecommendation,
    launchPlan,
    previewSummary: `NA Kit would search ${location}, verify ${targetLabel.toLowerCase()} quality automatically, then move the strongest results into a ${base.engineName.toLowerCase()} workflow.`
  };
}

function buildPreviewOpportunities(input = {}, blueprint) {
  const businessType = input.businessType || 'general';
  const location = input.location || 'your market';
  const targetLabel = blueprint.targetLabel;
  const targetSingular = getTargetTypeSingular(blueprint.targetType);

  return [
    {
      title: `${location} ${businessType} ${targetSingular} cluster`,
      source: blueprint.sourceMix[0],
      freshness: 'Fresh',
      score: 92,
      note: 'Matched the search goal, passed the suspicious-pattern filter, and looks ready for operator review.'
    },
    {
      title: `${businessType} reactivation opportunity`,
      source: blueprint.sourceMix[1],
      freshness: 'Recent',
      score: 84,
      note: 'Looks relevant but should be verified against duplicate and stale record checks before activation.'
    },
    {
      title: `${targetSingular} with high response urgency`,
      source: blueprint.sourceMix[2],
      freshness: 'New',
      score: 88,
      note: 'Strong fit for an automatic conversion workflow once the preview is saved and activated.'
    }
  ];
}

function buildActionItems(client) {
  const blueprint = buildZumiBlueprint(client);

  return [
    `${blueprint.responseTarget} so interest does not cool off.`,
    `Keep every message tied to the current offer angle: ${blueprint.offerAngle}.`,
    blueprint.cadence[1],
    blueprint.reviewTiming
  ];
}

function buildReviewPrompts(client) {
  const blueprint = buildZumiBlueprint(client);

  return [
    `Thanks again for choosing ${client.businessName}. If the experience felt smooth and helpful, would you leave us a quick Google review? It helps us keep the ${blueprint.offerAngle}.`,
    `We appreciate your business. A short review helps more local customers feel confident reaching out to ${client.businessName}, especially when they need help fast.`
  ];
}

function getMessageTypeLabel(messageType = 'inquiry_followup') {
  const labels = {
    inquiry_followup: 'Inquiry Follow-up',
    missed_call: 'Missed-Call Recovery',
    reactivation: 'Reactivation',
    review_request: 'Review Request',
    consult_nudge: 'Consult Nudge',
    booking_reminder: 'Booking Reminder'
  };

  return labels[messageType] || 'Inquiry Follow-up';
}

function getMessageTypeSummary(messageType = 'inquiry_followup') {
  const summaries = {
    inquiry_followup: 'For fresh inquiries that need a fast, confident next step.',
    missed_call: 'For leads that called and never reached the business.',
    reactivation: 'For older leads or clients that went quiet.',
    review_request: 'For happy customers who should leave public proof.',
    consult_nudge: 'For high-intent consult prospects that need a gentle push.',
    booking_reminder: 'For scheduled prospects who should still show up and convert.'
  };

  return summaries[messageType] || summaries.inquiry_followup;
}

function buildTemplateFollowup(client, channel = 'email', messageType = 'inquiry_followup') {
  const owner = client.owner || 'there';
  const businessName = client.businessName || 'your business';
  const goal = client.goal || 'bringing in more qualified leads';
  const blueprint = buildZumiBlueprint(client);
  const serviceHint = client.mainServices || client.category || 'your offer';

  if (messageType === 'missed_call') {
    if (channel === 'sms' || channel === 'whatsapp') {
      return `Hi ${owner}, we saw the missed call for ${businessName}. If you still want help with ${serviceHint}, reply here and we can get you the fastest next step today.`;
    }

    return `Hi ${owner},

We noticed a missed call for ${businessName} and did not want the opportunity to go cold. If help is still needed around ${serviceHint}, reply here and we can get the next step moving quickly.

Best,
${brand.name}`;
  }

  if (messageType === 'reactivation') {
    if (channel === 'sms' || channel === 'whatsapp') {
      return `Hi ${owner}, quick check-in from ${businessName}. If ${serviceHint} is still on your mind, we can help you pick the next best step this week.`;
    }

    return `Hi ${owner},

Quick check-in from ${businessName}. If ${serviceHint} is still something you want to move on, we can help you take the cleanest next step this week without making the process feel complicated.

Best,
${brand.name}`;
  }

  if (messageType === 'review_request') {
    if (channel === 'sms' || channel === 'whatsapp') {
      return `Hi ${owner}, thanks again for choosing ${businessName}. If the experience felt smooth, would you mind leaving a quick review? It helps more people trust us faster.`;
    }

    return `Hi ${owner},

Thank you again for choosing ${businessName}. If the experience felt smooth and helpful, would you mind leaving a quick review? It makes it easier for the next customer to trust the business faster.

Best,
${brand.name}`;
  }

  if (messageType === 'consult_nudge') {
    if (channel === 'sms' || channel === 'whatsapp') {
      return `Hi ${owner}, just checking in on ${businessName}. If you still want to move forward with ${serviceHint}, we can help you lock in the next step today.`;
    }

    return `Hi ${owner},

Just checking in on ${businessName}. If you still want to move forward with ${serviceHint}, we can help you lock in the next step today while the momentum is still there.

Best,
${brand.name}`;
  }

  if (messageType === 'booking_reminder') {
    if (channel === 'sms' || channel === 'whatsapp') {
      return `Hi ${owner}, friendly reminder from ${businessName}. Your next step around ${serviceHint} is coming up soon. Reply here if you need anything before then.`;
    }

    return `Hi ${owner},

Friendly reminder from ${businessName}. Your next step around ${serviceHint} is coming up soon. If anything needs to be adjusted before then, reply here and we can help quickly.

Best,
${brand.name}`;
  }

  if (channel === 'sms') {
    return `Hi ${owner}, quick check-in on ${businessName}. Based on your ${blueprint.motionLabel.toLowerCase()}, the fastest win is to ${blueprint.offerAngle}. If you want, I can map out the next ${blueprint.primaryChannel === 'sms' ? 'text-first' : 'follow-up'} steps for you this week.`;
  }

  if (channel === 'whatsapp') {
    return `Hi ${owner}, quick follow-up for ${businessName}. NA Kit mapped your business to the ${blueprint.engineName}, which means the biggest win is to ${blueprint.offerAngle}. If you want, I can send the recommended next steps today.`;
  }

  return `Hi ${owner},

I wanted to follow up on ${businessName} and the goal around ${goal}. NA Kit mapped the business to a ${blueprint.motionLabel.toLowerCase()} workflow, and the biggest opportunity right now is to ${blueprint.offerAngle}.

If you want, I can put together a simple next-step plan for this week around ${blueprint.responseTarget.toLowerCase()} and send it over for review.

Best,
${brand.name}`;
}

function buildFollowupPrompt(client, channel = 'email', messageType = 'inquiry_followup') {
  const owner = client.owner || 'the business owner';
  const businessName = client.businessName || 'the business';
  const goal = client.goal || 'book more jobs';
  const notes = client.notes || 'No additional notes provided.';
  const maxLength = channel === 'email' ? '120 words' : '320 characters';
  const blueprint = buildZumiBlueprint(client);
  const messageLabel = getMessageTypeLabel(messageType);

  return [
    `You write premium, human follow-up messages for ${brand.name}, an AI revenue operator for booking-based businesses.`,
    `Channel: ${channelLabel(channel)}.`,
    `Message type: ${messageLabel}.`,
    `Business: ${businessName}.`,
    `Owner: ${owner}.`,
    `Goal: ${goal}.`,
    `Notes: ${notes}.`,
    `Detected NA Kit engine: ${blueprint.engineName}.`,
    `Business size: ${blueprint.sizeLabel}.`,
    `Sales motion: ${blueprint.motionLabel}.`,
    `Lead flow: ${blueprint.volumeLabel}.`,
    `Offer angle: ${blueprint.offerAngle}.`,
    `Response target: ${blueprint.responseTarget}.`,
    '',
    'Requirements:',
    `- Keep it under ${maxLength}.`,
    '- Mention one concrete benefit tied to the goal.',
    '- Sound warm, confident, and natural.',
    '- End with a low-friction call to action.',
    '- Return only the final message body with no markdown and no quotation marks.'
  ].join('\n');
}

async function generateFollowup(client, channel, messageType = 'inquiry_followup') {
  const fallback = buildTemplateFollowup(client, channel, messageType);

  if (!openaiClient) {
    return {
      followup: fallback,
      source: 'template',
      messageType,
      warning: 'OPENAI_API_KEY is not set, so this draft came from the built-in local template.'
    };
  }

  try {
    const response = await openaiClient.responses.create({
      model: followupModel,
      input: buildFollowupPrompt(client, channel, messageType)
    });
    const followup = response.output_text ? response.output_text.trim() : '';

    if (!followup) {
      throw new Error('The OpenAI response did not include output text.');
    }

    return {
      followup,
      source: 'openai',
      messageType,
      model: followupModel
    };
  } catch (error) {
    console.error('OpenAI follow-up generation failed:', error.message);
    return {
      followup: fallback,
      source: 'template',
      messageType,
      warning: `OpenAI request failed, so the app used the local fallback draft instead. ${error.message}`
    };
  }
}

function navLink(href, label, currentPath) {
  const isActive = href === '/'
    ? currentPath === href
    : currentPath === href || currentPath.startsWith(`${href}/`);

  return `<a class="nav-link${isActive ? ' active' : ''}" href="${href}">${label}</a>`;
}

function layout(title, content, currentPath = '/') {
  const pageTitle = title === brand.name ? `${brand.name} · ${brand.headline}` : `${title} · ${brand.name}`;
  const safeTitle = escapeHtml(pageTitle);
  const pageUrl = `https://zumi.onrender.com${currentPath === '/' ? '' : currentPath}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: brand.name,
    serviceType: 'venture concept studio',
    description: brand.metaDescription,
    areaServed: 'US',
    audience: {
      '@type': 'Audience',
      audienceType: brand.audience
    },
    url: pageUrl
  };
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="${escapeHtml(brand.metaDescription)}" />
      <meta property="og:title" content="${safeTitle}" />
      <meta property="og:description" content="${escapeHtml(brand.metaDescription)}" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="${escapeHtml(pageUrl)}" />
      <meta property="og:image" content="https://zumi.onrender.com/nakit-cosmos.svg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${safeTitle}" />
      <meta name="twitter:description" content="${escapeHtml(brand.metaDescription)}" />
      <title>${safeTitle}</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/styles.css" />
      <script type="application/ld+json">${JSON.stringify(schema)}</script>
      <script src="/app.js" defer></script>
    </head>
    <body>
      <header class="site-header">
        <div class="container">
          <div class="nav-shell">
            <a class="brand" href="/">
              <img class="brand-logo" src="/logo-mark.svg" alt="${brand.name} logo" />
              <span class="brand-copy">
                <strong>${brand.name}</strong>
                <small>${escapeHtml(brand.slogan)}</small>
              </span>
            </a>
            <div class="nav-main">
              <nav class="nav-links">
                ${navLink('/', 'Home', currentPath)}
                ${navLink('/how-it-works', 'Flywheel', currentPath)}
                ${navLink('/case-studies', 'Concepts', currentPath)}
                ${navLink('/pricing', 'Business Model', currentPath)}
                ${navLink('/about', 'About', currentPath)}
              </nav>
              <a class="btn nav-cta" href="/intake">Build Queue</a>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div class="container">${content}</div>
      </main>
      <footer>
        <div class="container footer-shell">
          <div>
            <strong>${brand.name}</strong>
            <span>${brand.slogan}</span>
          </div>
          <nav class="footer-links">
            <a href="/case-studies">Concepts</a>
            <a href="/how-it-works">Flywheel</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/intake">Build Queue</a>
          </nav>
        </div>
      </footer>
    </body>
  </html>`;
}

function sendHtml(res, html, statusCode = 200) {
  res.status(statusCode).type('html').send(html);
}

function followupComposerCard(client) {
  const preferredChannel = client.preferredChannel || 'email';

  return `
    <section class="card" data-followup-panel data-client-id="${escapeHtml(client.id)}">
      <p class="section-label">Messaging Center</p>
      <h3>Generate the next message with intent.</h3>
      <p class="muted">Use NA Kit for inquiry follow-up, missed-call recovery, reactivation, review requests, consult nudges, and booking reminders without losing the premium tone.</p>
      <div class="form-grid" style="margin-top: 18px;">
        <div class="field">
          <label for="message-type-${escapeHtml(client.id)}">Message type</label>
          <select id="message-type-${escapeHtml(client.id)}" data-message-type>
            <option value="inquiry_followup">Inquiry Follow-up</option>
            <option value="missed_call">Missed-Call Recovery</option>
            <option value="reactivation">Reactivation</option>
            <option value="review_request">Review Request</option>
            <option value="consult_nudge">Consult Nudge</option>
            <option value="booking_reminder">Booking Reminder</option>
          </select>
        </div>
        <div class="field">
          <label for="channel-${escapeHtml(client.id)}">Channel</label>
          <select id="channel-${escapeHtml(client.id)}" data-channel>
            <option value="email"${preferredChannel === 'email' ? ' selected' : ''}>Email</option>
            <option value="sms"${preferredChannel === 'sms' ? ' selected' : ''}>SMS</option>
            <option value="whatsapp"${preferredChannel === 'whatsapp' ? ' selected' : ''}>WhatsApp</option>
          </select>
        </div>
      </div>
      <article class="message-context">
        <p class="kicker">Context</p>
        <p class="muted" data-message-context>${escapeHtml(getMessageTypeSummary('inquiry_followup'))}</p>
      </article>
      <div class="actions">
        <button class="btn" type="button" data-generate-followup>Generate Message</button>
        <button class="btn secondary" type="button" data-regenerate-followup disabled>Regenerate</button>
        <button class="btn secondary" type="button" data-copy-followup disabled>Copy Message</button>
      </div>
      <p class="inline-note" data-followup-error>Draft a message that feels personal before it reaches SMS, email, or your booking workflow.</p>
      <article class="ai-result" data-followup-result hidden>
        <p class="result-kicker">Draft</p>
        <pre data-followup-output></pre>
        <p class="result-meta muted" data-followup-meta></p>
      </article>
    </section>
  `;
}

function renderCaseStudyPreview(study) {
  return `
    <article class="card">
      <div class="story-visual-wrap">
        <img class="story-visual" src="${escapeHtml(study.image)}" alt="${escapeHtml(study.imageAlt)}" loading="lazy" />
      </div>
      <p class="kicker">Illustrative Scenario</p>
      <h3>${escapeHtml(study.headline)}</h3>
      <p class="muted">${escapeHtml(study.summary)}</p>
      <div class="mini-proof">
        <span class="pill">${escapeHtml(study.businessName)}</span>
        <span class="pill">${escapeHtml(study.category)}</span>
      </div>
      <ul class="list-clean">
        ${study.metrics.slice(0, 2).map((metric) => `<li>${escapeHtml(metric.label)}: ${escapeHtml(metric.value)}</li>`).join('')}
      </ul>
      <div class="actions">
        <a class="btn secondary" href="/case-studies#${escapeHtml(study.slug)}">See Transformation</a>
      </div>
    </article>
  `;
}

function renderFaqCard(item) {
  return `
    <article class="card">
      <p class="kicker">FAQ</p>
      <h3>${escapeHtml(item.question)}</h3>
      <p class="muted">${escapeHtml(item.answer)}</p>
    </article>
  `;
}

function solutionHref(slug) {
  return `/solutions/${slug}`;
}

function renderSolutionPreview(item) {
  return `
    <article class="card solution-card">
      <div class="story-visual-wrap">
        <img class="story-visual" src="${escapeHtml(item.visual)}" alt="${escapeHtml(item.visualAlt)}" loading="lazy" />
      </div>
      <p class="kicker">${escapeHtml(item.eyebrow)}</p>
      <h3>${escapeHtml(item.label)}</h3>
      <p class="muted">${escapeHtml(item.summary)}</p>
      <div class="mini-proof">
        ${item.metrics.map((metric) => `<span class="pill">${escapeHtml(metric.value)} ${escapeHtml(metric.label)}</span>`).join('')}
      </div>
      <div class="actions">
        <a class="btn secondary" href="${solutionHref(item.slug)}">Open Module</a>
      </div>
    </article>
  `;
}

function renderPricingCard(plan) {
  const payButton = plan.paymentLink
    ? `<a class="btn secondary" href="${escapeHtml(plan.paymentLink)}" target="_blank" rel="noreferrer">Pay & Start</a>`
    : '';

  return `
    <article class="card plan-card${plan.badge ? ' featured-plan' : ''}">
      ${plan.badge ? `<span class="plan-badge">${escapeHtml(plan.badge)}</span>` : ''}
      <p class="kicker">Plan</p>
      <h3>${escapeHtml(plan.name)}</h3>
      <p class="price">${escapeHtml(plan.price)}<span>${escapeHtml(plan.cadence)}</span></p>
      <p class="muted">${escapeHtml(plan.description)}</p>
      <ul class="list-clean">${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
      <div class="actions">
        <a class="btn" href="${escapeHtml(plan.href)}">${escapeHtml(plan.cta)}</a>
        ${payButton}
      </div>
    </article>
  `;
}

function renderPillarCard(item) {
  return `
    <article class="card">
      <p class="kicker">${escapeHtml(item.name)}</p>
      <h3>${escapeHtml(item.headline)}</h3>
      <p class="muted">${escapeHtml(item.body)}</p>
      ${item.href ? `<div class="actions"><a class="btn secondary" href="${escapeHtml(item.href)}">Open ${escapeHtml(item.name)}</a></div>` : ''}
    </article>
  `;
}

function renderIndustryCard(item) {
  return `
    <article class="card">
      <p class="kicker">Industry Example</p>
      <h3>${escapeHtml(item.label)}</h3>
      <p class="muted">${escapeHtml(item.body)}</p>
    </article>
  `;
}

function renderSourceCard(item) {
  return `
    <article class="card">
      <p class="kicker">Future Source Layer</p>
      <h3>${escapeHtml(item.label)}</h3>
      <p class="muted">${escapeHtml(item.body)}</p>
    </article>
  `;
}

function renderCallLogItems(client) {
  const logs = [...getCallLogs(client)].reverse();

  if (!logs.length) {
    return '<p class="muted">No calls logged yet.</p>';
  }

  return `
    <div class="call-log-list">
      ${logs.map((log) => `
        <article class="card call-log-item">
          <p class="kicker">${escapeHtml(getCallOutcomeLabel(log.outcome))}</p>
          <h3>${escapeHtml(log.worker || 'Worker update')}</h3>
          <p class="muted">${escapeHtml(log.note || 'No note added.')}</p>
          <div class="mini-proof">
            <span class="pill">${escapeHtml(formatDateTime(log.createdAt))}</span>
            ${log.nextStep ? `<span class="pill">${escapeHtml(log.nextStep)}</span>` : ''}
            ${log.nextDate ? `<span class="pill">Next ${escapeHtml(formatDate(log.nextDate))}</span>` : ''}
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderAutomationFocus(items) {
  return items.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join('');
}

function renderZumiBlueprintCard(client) {
  const blueprint = buildZumiBlueprint(client);

  return `
    <article class="card">
      <p class="kicker">${escapeHtml(brand.algorithmName)}</p>
      <h3>${escapeHtml(blueprint.engineName)}</h3>
      <p class="muted">${escapeHtml(blueprint.summary)}</p>
      <div class="mini-proof">
        ${renderAutomationFocus(blueprint.automationFocus)}
      </div>
      <div class="metric-grid" style="margin-top: 18px;">
        <div class="metric">
          <span class="metric-copy">${escapeHtml(blueprint.sizeLabel)}</span>
          <span class="metric-label">Detected business size</span>
        </div>
        <div class="metric">
          <span class="metric-copy">${escapeHtml(blueprint.motionLabel)}</span>
          <span class="metric-label">Detected revenue motion</span>
        </div>
      </div>
    </article>
  `;
}

function renderZumiCadenceCard(client) {
  const blueprint = buildZumiBlueprint(client);

  return `
    <article class="card">
      <p class="kicker">Automatic Sequence</p>
      <h3>Custom cadence in a few easy steps</h3>
      <ul class="list-clean">${blueprint.launchSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="key-value" style="margin-top: 18px;">
        <div class="key-value-item">
          <strong>Primary channel</strong>
          <span>${escapeHtml(channelLabel(blueprint.primaryChannel))}</span>
        </div>
        <div class="key-value-item">
          <strong>Response target</strong>
          <span>${escapeHtml(blueprint.responseTarget)}</span>
        </div>
      </div>
    </article>
  `;
}

function homePage(clients) {
  const content = `
    <section class="entry-hero">
      <div class="entry-shell">
        <p class="section-label">Necessary apps. Future doors.</p>
        <h1>What should the next inevitable app be?</h1>
        <p class="lede">NA Kit is a launch surface for products that spread because they solve something urgent, create shareable proof, and sit on top of budgets or risk people already live with.</p>
        <form class="entry-search" method="GET" action="/intake">
          <input name="website" type="url" placeholder="Drop a market signal, category site, or competitor URL" aria-label="Market signal URL" required />
          <button class="btn" type="submit">Start Venture Scan</button>
        </form>
        <p class="supporting-line">Urgent pain. Shareable proof. Platform doors.</p>
        <div class="entry-proof">
          <span class="pill">10 concept lanes</span>
          <span class="pill">Safety to commerce</span>
          <span class="pill">Built for recurring budgets</span>
          <span class="pill">${escapeHtml(String(Math.max(clients.length, 10)))} tracked signals</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card spotlight">
          <div class="spotlight-visual">
            <img class="spotlight-image" src="/nakit-cosmos.svg" alt="Cinematic future-app map showing safety, money, care, home, trust, work, and commerce as connected opportunity systems." />
          </div>
          <p class="section-label">The lens</p>
          <h3>Great apps spread when the output wants to be shared.</h3>
          <p class="muted">The best categories come with their own native artifact: a warning, a savings flex, a care dashboard, a proof-of-skill card, or a clarity card that naturally travels through feeds and group chats.</p>
          <div class="mini-proof">
            <span class="pill">Scam receipts</span>
            <span class="pill">Savings cards</span>
            <span class="pill">Reality cards</span>
          </div>
        </article>
        <article class="card">
          <p class="section-label">Why now</p>
          <h3>Necessary beats trendy when the budget is already there.</h3>
          <ul class="list-clean">
            <li>Protection products win because failure is expensive.</li>
            <li>Operations products win because the chaos is constant.</li>
            <li>Throughput products win because they sit in the money flow.</li>
            <li>The first version only needs one painfully obvious promise.</li>
          </ul>
          <div class="live-metrics">
            <div class="signal-chip">
              <span class="signal-value">Fear</span>
              <span class="signal-label">fastest urgency driver</span>
            </div>
            <div class="signal-chip">
              <span class="signal-value">Proof</span>
              <span class="signal-label">distribution in the product</span>
            </div>
            <div class="signal-chip">
              <span class="signal-value">Door</span>
              <span class="signal-label">platform hidden underneath</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">The Ten</p>
          <h2>Ten app concepts with obvious need and real money logic.</h2>
        </div>
        <p class="muted">Each one is designed around a daily pain point, a shareable outcome, a monetization path that already makes sense, and a bigger future layer it can open.</p>
      </div>
      <div class="feature-grid">
        ${nakitConcepts.map((concept) => `
          <article class="card concept-card">
            <p class="kicker">Concept ${escapeHtml(concept.letter)}</p>
            <h3>${escapeHtml(concept.title)}</h3>
            <p class="muted">${escapeHtml(concept.pitch)}</p>
            <div class="mini-proof">
              <span class="pill">${escapeHtml(concept.category)}</span>
            </div>
          </article>
        `).join('')}
      </div>
      <div class="actions" style="margin-top: 18px;">
        <a class="btn" href="/case-studies">See Full Breakdown</a>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">The Flywheel</p>
          <h2>The best categories usually follow the same four steps.</h2>
        </div>
        <p class="muted">NA Kit is built around first-principles category logic instead of random idea theater.</p>
      </div>
      <div class="feature-grid">
        ${nakitPaths.map((item, index) => `
          <article class="card">
            <p class="kicker">Step 0${index + 1}</p>
            <h3>${escapeHtml(item)}</h3>
            <p class="muted">If the app cannot do this cleanly, it probably is not the right first build.</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Best First Pick</p>
          <h2>If you build one now, build the one with fear, family, and proof.</h2>
        </div>
        <p class="muted">ScamSentry is the sharpest first move because the pain is obvious, the family subscription is natural, and the warning artifact wants to be shared.</p>
      </div>
      <div class="detail-grid">
        <article class="card spotlight">
          <p class="section-label">ScamSentry</p>
          <h3>The category with the cleanest first-year path.</h3>
          <ul class="list-clean">
            <li>Protects across calls, texts, DMs, email, and payments.</li>
            <li>Creates Scam Receipts that teach and spread at the same time.</li>
            <li>Expands naturally into verified calling and payment-risk infrastructure.</li>
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Why it wins first</p>
          <ul class="list-clean">
            <li>Fear creates immediate urgency.</li>
            <li>Family plans create recurring revenue.</li>
            <li>Institutions can later buy the same protection layer.</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Moats</p>
          <h2>The strongest products already contain their own defense.</h2>
        </div>
        <p class="muted">These ideas are attractive because they can generate distribution, workflow lock-in, and infrastructure adjacency at the same time.</p>
      </div>
      <div class="solution-hero">
        <article class="card art-panel">
          <div class="story-visual-wrap story-visual-large">
            <img class="story-visual" src="/nakit-signals.svg" alt="Futuristic signal board showing categories like fear, savings, trust, care, and throughput as monetization and moat layers." />
          </div>
        </article>
        ${nakitMoats.map((item) => `
          <article class="card art-panel">
            <p class="kicker">Moat</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="muted">${escapeHtml(item.body)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Ranking</p>
          <h2>Three ways to judge what deserves to get built first.</h2>
        </div>
        <p class="muted">The right first product depends on whether you want speed to cash, category defensibility, or a larger eventual ceiling.</p>
      </div>
      <div class="grid-3">
        ${nakitRankings.map((item) => `
          <article class="card">
            <p class="kicker">Ranking</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p class="muted"><strong>${escapeHtml(item.winner)}</strong> — ${escapeHtml(item.body)}</p>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="section">
      <article class="card">
        <p class="section-label">Build Queue</p>
        <h2>Bring a market signal. NA Kit will tell you where the money is hiding.</h2>
        <p class="muted">Start with a category site, a competitor, or any signal-rich URL. The first pass is about sharpening the opportunity until the product and business logic become obvious.</p>
        <div class="actions">
          <a class="btn" href="/intake">Enter the Build Queue</a>
          <a class="btn secondary" href="/how-it-works">See the Flywheel</a>
        </div>
      </article>
    </section>
  `;

  return layout(brand.name, content, '/');
}

function caseStudiesPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">The Ten</p>
        <h2>Ten necessary apps with obvious pain and real platform doors.</h2>
      </div>
      <p class="muted">Each concept starts with a painful daily problem, a native share artifact, a believable money model, and a future layer that can become infrastructure.</p>
    </section>
    <section class="grid-3">
      ${nakitConcepts.map((concept) => `
        <article class="card concept-card" id="${escapeHtml(concept.slug)}">
          <p class="kicker">Concept ${escapeHtml(concept.letter)}</p>
          <h3>${escapeHtml(concept.title)}</h3>
          <p class="muted">${escapeHtml(concept.pitch)}</p>
          <div class="mini-proof">
            <span class="pill">${escapeHtml(concept.category)}</span>
            <span class="pill">${escapeHtml(concept.whyNow)}</span>
          </div>
          <ul class="list-clean">
            <li><strong>Viral hook:</strong> ${escapeHtml(concept.viralHook)}</li>
            <li><strong>Money path:</strong> ${escapeHtml(concept.monetization)}</li>
            <li><strong>Future door:</strong> ${escapeHtml(concept.door)}</li>
          </ul>
        </article>
      `).join('')}
    </section>
    <section class="card" style="margin-top: 24px;">
      <p class="kicker">First move</p>
      <h3>Build the category with the cleanest urgency loop first.</h3>
      <p class="muted">ScamSentry is the sharpest first build because the fear is obvious, the family plan is natural, and the Scam Receipt becomes free distribution inside messages and feeds.</p>
      <div class="actions">
        <a class="btn" href="/intake">Start Venture Scan</a>
        <a class="btn secondary" href="/pricing">See Business Models</a>
      </div>
    </section>
  `;

  return layout('Concepts', content, '/case-studies');
}

function solutionsPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Build Surfaces</p>
        <h2>Four layers that turn an interesting signal into a real company.</h2>
      </div>
      <p class="muted">NA Kit stays sharp by focusing on the pressure, the artifact, the money model, and the platform door instead of spraying features everywhere.</p>
    </section>
    <section class="grid-3">
      ${[
        {
          kicker: '01',
          title: 'Signal scan',
          body: 'Read a market, category site, competitor, or social clue and pull out the strongest pressure points.'
        },
        {
          kicker: '02',
          title: 'Share artifact',
          body: 'Define the native card, receipt, dashboard, badge, or clip the product wants people to pass around.'
        },
        {
          kicker: '03',
          title: 'Money model',
          body: 'Match the idea to recurring protection, performance pricing, or a take-rate living in the flow.'
        },
        {
          kicker: '04',
          title: 'Platform door',
          body: 'Map the infrastructure layer waiting underneath: identity, trust, logistics, payments, or reputation.'
        }
      ].map((item) => `
        <article class="card">
          <p class="kicker">${escapeHtml(item.kicker)}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="muted">${escapeHtml(item.body)}</p>
        </article>
      `).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Rule</p>
          <h3>The first promise has to sound painfully obvious.</h3>
          <p class="muted">If it needs too much explanation, the market signal is not strong enough yet.</p>
        </article>
        <article class="card">
          <p class="kicker">Next Move</p>
          <h3>Feed the engine one URL with signal density.</h3>
          <div class="actions">
            <a class="btn" href="/intake">Start Venture Scan</a>
            <a class="btn secondary" href="/how-it-works">See the Flywheel</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Build Surfaces', content, '/solutions');
}

function solutionPage(item) {
  const content = `
    <section class="card empty-state">
      <p class="section-label">Module</p>
      <h2>${escapeHtml(item.label)}</h2>
      <p class="muted">This legacy route is now secondary to the NA Kit venture-scan flow. Use the build queue to generate a fresh opportunity thesis from a signal-rich URL.</p>
      <div class="actions" style="justify-content: center;">
        <a class="btn" href="/intake">Start Venture Scan</a>
        <a class="btn secondary" href="/solutions">Back to Build Surfaces</a>
      </div>
    </section>
  `;

  return layout(item.label, content, solutionHref(item.slug));
}

function pricingPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Business Model</p>
        <h2>How necessary apps make money without feeling flimsy.</h2>
        <p class="muted">The strongest products charge into an existing budget or transaction path. The revenue model should feel as native as the problem itself.</p>
        <div class="mini-proof">
          <span class="pill">Protection</span>
          <span class="pill">Savings</span>
          <span class="pill">Throughput</span>
        </div>
      </article>
      <article class="card art-panel">
        <p class="kicker">Money logic</p>
        <h3>Pick the model the user already expects to pay for.</h3>
        <p class="muted">Subscriptions fit protection. Performance fees fit measurable wins. Take-rates fit shopping, hiring, services, and logistics.</p>
        <div class="metric-grid">
          <div class="metric"><span class="metric-copy">Recurring</span><span class="metric-label">best for fear and protection</span></div>
          <div class="metric"><span class="metric-copy">Take-rate</span><span class="metric-label">best for high ceiling</span></div>
        </div>
      </article>
    </section>
    <section class="grid-3">
      ${nakitRevenueBuckets.map((bucket) => `
        <article class="card plan-card${bucket.title === 'Recurring protection' ? ' featured-plan' : ''}">
          <p class="kicker">Model</p>
          <h3>${escapeHtml(bucket.title)}</h3>
          <p class="muted">${escapeHtml(bucket.body)}</p>
          <div class="mini-proof">
            <span class="pill">${escapeHtml(bucket.examples)}</span>
          </div>
        </article>
      `).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Acquisition</p>
          <h3>The product should already know how it wants to spread.</h3>
          <ul class="list-clean">
            ${nakitAcquisitionChannels.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Build discipline</p>
          <h3>One obvious promise beats a thousand optional features.</h3>
          <ul class="list-clean">
            <li>Find the urgent behavior first.</li>
            <li>Attach a native share artifact.</li>
            <li>Choose the money model that fits the behavior.</li>
            <li>Use the platform door as the long game.</li>
          </ul>
          <div class="actions">
            <a class="btn" href="/intake">Run a Venture Scan</a>
            <a class="btn secondary" href="/how-it-works">See the Flywheel</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Business Model', content, '/pricing');
}

function howItWorksPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Flywheel</p>
        <h2>Read the signal. Find the artifact. Map the money. Open the door.</h2>
        <p class="muted">NA Kit is not a random idea generator. It is a premium venture-scan surface for products that can spread, monetize, and grow into infrastructure.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start Venture Scan</a>
          <a class="btn secondary" href="/operator-architecture">See the Signal Engine</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-signals.svg" alt="NA Kit signal engine showing urgency, shareability, monetization, and platform door layers." />
        </div>
      </article>
    </section>
    <section class="feature-grid">
      ${nakitPaths.map((item, index) => `
        <article class="card">
          <p class="kicker">0${index + 1}</p>
          <h3>${escapeHtml(item)}</h3>
          <p class="muted">${index === 0
            ? 'If the user is already afraid, annoyed, losing money, or coordinating chaos, the category starts strong.'
            : index === 1
              ? 'The share artifact is the built-in distribution layer.'
              : index === 2
                ? 'The money model should already exist in the user’s life.'
                : 'The best apps grow into a platform once they own trust or workflow.'}</p>
        </article>
      `).join('')}
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Input</p>
        <h3>Bring a category site, competitor, article, or market clue.</h3>
        <p class="muted">The best input is rich with signal density: urgency, recurring cost, social conversation, manual work, or obvious trust failure.</p>
      </article>
      <article class="card">
        <p class="kicker">Output</p>
        <h3>Leave with a sharper thesis, not vague inspiration.</h3>
        <p class="muted">The final scan should tell you what to build, why it spreads, how it makes money, and where the bigger infrastructure door sits.</p>
      </article>
    </section>
  `;

  return layout('Flywheel', content, '/how-it-works');
}

function discoverPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Discover</p>
        <h2>Start where life already hurts, leaks, or wastes time.</h2>
        <p class="muted">The first pass is about finding the pressure zones where users already lose money, safety, trust, or coordination energy every week.</p>
        <div class="mini-proof">
          <span class="pill">Fear</span>
          <span class="pill">Savings</span>
          <span class="pill">Chaos</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-cosmos.svg" alt="NA Kit concept field showing safety, money, care, home, work, commerce, and trust opportunity zones." />
        </div>
      </article>
    </section>
    <section class="grid-3">${[
      'Scams, impersonation, and communication trust.',
      'Bills, recurring spend, and savings recovery.',
      'Caregiving, appointments, medications, and coordination.',
      'Proof of skill, hiring, and reputation portability.',
      'Home maintenance, documentation, claims, and property operations.',
      'Bureaucracy, appeals, forms, and deadline chaos.'
    ].map((item) => `
      <article class="card">
        <p class="kicker">Pressure zone</p>
        <h3>${escapeHtml(item)}</h3>
        <p class="muted">If the problem is frequent, emotional, and expensive, it deserves a serious product pass.</p>
      </article>
    `).join('')}</section>
  `;

  return layout('Discover', content, '/discover');
}

function verifyPage() {
  const cards = [
    {
      name: 'Market truth',
      headline: 'Make sure the pain is truly painful before you romanticize the idea.',
      body: 'A great venture thesis should feel obvious in real life, not only inside a brainstorm document.'
    },
    {
      name: 'Artifact fit',
      headline: 'The product should naturally generate something people want to repost or forward.',
      body: 'Warnings, savings proofs, clarity cards, and dashboards create stronger loops than generic referral asks.'
    },
    {
      name: 'Budget realism',
      headline: 'Charge where the user already expects money to move.',
      body: 'Recurring protection, measurable savings, and transaction throughput are cleaner than inventing a fake budget.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Stress Test</p>
        <h2>Great ideas survive contact with behavior, money, and distribution.</h2>
        <p class="muted">NA Kit is built to pressure-test whether the category deserves build time, not just to make the concept sound pretty.</p>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-signals.svg" alt="NA Kit venture scan board showing weighted opportunity signals." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Verify', content, '/verify');
}

function convertPage() {
  const cards = [
    {
      name: 'Subscriptions',
      headline: 'Use continuous fear, protection, or coordination as the base for recurring revenue.',
      body: 'This is the cleanest path when failure is expensive and the user wants ongoing calm.'
    },
    {
      name: 'Performance fees',
      headline: 'Charge on measurable wins when the outcome is visible and immediate.',
      body: 'Recovered savings, reduced fees, or solved admin pain often justify pay-on-win better than software alone.'
    },
    {
      name: 'Take-rates',
      headline: 'Step into the transaction when the product sits in shopping, hiring, services, or logistics.',
      body: 'This is where the highest ceilings usually appear.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Monetize</p>
        <h2>The idea only matters if the revenue logic feels native.</h2>
        <p class="muted">NA Kit looks for products that can step into budgets or transactions already moving through a user’s life.</p>
        <div class="actions">
          <a class="btn" href="/intake">Run a Venture Scan</a>
          <a class="btn secondary" href="/pricing">See Model Patterns</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-cosmos.svg" alt="NA Kit monetization field showing protection, savings, and throughput as revenue paths." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Convert', content, '/convert');
}

function industriesPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Opportunity Map</p>
        <h2>Where necessary apps already have pain, budgets, and daily behavior.</h2>
        <p class="muted">The best categories are hiding in the parts of life where people already lose money, time, trust, safety, or coordination energy.</p>
      </article>
      <article class="card art-panel">
        <p class="kicker">Common thread</p>
        <h3>Necessary beats trendy when the money is already there.</h3>
        <p class="muted">If the user is already paying, worrying, coordinating, or recovering around the problem, the app has a much better shot at becoming infrastructure.</p>
      </article>
    </section>
    <section class="grid-3">${[
      { label: 'Money + bills', body: 'Subscriptions, recurring spend, negotiation, cancellations, and savings recovery.' },
      { label: 'Safety + scams', body: 'Impersonation, family protection, trusted calling, and payment-risk prevention.' },
      { label: 'Care + family logistics', body: 'Appointments, meds, transport, handoffs, and emergency coordination.' },
      { label: 'Work + skill proof', body: 'Shipped work, mentor graphs, hiring trust, and portable reputation.' },
      { label: 'Home + property ops', body: 'Maintenance, warranties, claim packs, contractor flows, and resale readiness.' },
      { label: 'Civic + bureaucracy', body: 'Forms, disputes, deadlines, appointments, and clean audit trails.' },
      { label: 'Dating + trust', body: 'Verification, safety plans, identity confidence, and emergency proof.' },
      { label: 'Commerce + creators', body: 'Shop-the-clip behavior, price history, returns, and verified claims.' },
      { label: 'Relocation + transitions', body: 'Moves, utility switching, mail updates, checklists, and city setup.' },
      { label: 'Information + reality', body: 'Context cards, provenance clues, repostable clarity, and trust signals.' }
    ].map(renderIndustryCard).join('')}</section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Launch wedge</p>
          <h3>Booking businesses still make a strong first customer wedge.</h3>
          <p class="muted">Med spas, clinics, studios, and high-trust operators are still useful because the pain, trust, and revenue loop show up immediately.</p>
          <div class="actions">
            <a class="btn" href="/med-spas">See the Wedge</a>
            <a class="btn secondary" href="/pricing">See Business Models</a>
          </div>
        </article>
        <article class="card">
          <p class="kicker">Signal</p>
          <h3>The right category usually comes with its own share object.</h3>
          <p class="muted">Warnings, scorecards, proofs, receipts, and clarity cards are stronger than generic referral mechanics.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Opportunity Map', content, '/industries');
}

function medSpaPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Launch Wedge</p>
        <h2>Why booking-based businesses still make a smart first wedge.</h2>
        <p class="muted">Med spas, clinics, and premium service businesses compress trust, follow-up, and revenue into one obvious problem, which makes them a sharp place to prove a broader operator concept.</p>
        <div class="mini-proof">
          <span class="pill">High trust</span>
          <span class="pill">High ticket</span>
          <span class="pill">Visible ROI</span>
        </div>
        <div class="actions">
          <a class="btn" href="/intake">Start Venture Scan</a>
          <a class="btn secondary" href="/how-it-works">See How It Works</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-success-owners.svg" alt="Premium booking businesses shown as a strong first launch wedge for NA Kit." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Why this wedge works</p>
          <h2>It gives you pain, trust, conversion, and proof in one shot.</h2>
        </div>
        <p class="muted">That makes it easier to sell, easier to prove, and easier to expand later into other premium operators.</p>
      </div>
      <div class="feature-grid">${[
        'Every lost consult is expensive enough to matter.',
        'Premium presentation changes trust faster than people think.',
        'Follow-up and booking friction are visible almost immediately.',
        'Before-and-after proof makes the improvement story easy to sell.'
      ].map((item) => `
        <article class="card">
          <p class="kicker">Wedge logic</p>
          <h3>${escapeHtml(item)}</h3>
          <p class="muted">That clarity is exactly what makes a first customer market useful.</p>
        </article>
      `).join('')}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">The translation</p>
          <h2>Use the wedge to learn. Do not let it shrink the platform vision.</h2>
        </div>
        <p class="muted">NA Kit is broader than med spas. This route exists to show how a focused launch wedge can prove a much bigger category ambition.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Wedge</p>
          <h3>Clear pain</h3>
          <p class="muted">Revenue leakage and trust decay are obvious.</p>
        </article>
        <article class="card">
          <p class="kicker">Wedge</p>
          <h3>Proof-rich outcome</h3>
          <p class="muted">The before-and-after improvement story is easy to communicate.</p>
        </article>
        <article class="card">
          <p class="kicker">Wedge</p>
          <h3>Expandable later</h3>
          <p class="muted">Once the model works here, it can widen into other high-trust operators.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <article class="card">
        <p class="section-label">Next Step</p>
        <h2>Start with one sharp market and keep the real ambition intact.</h2>
        <p class="muted">The wedge is there to prove the product, not to trap the company inside a niche forever.</p>
        <div class="actions">
          <a class="btn" href="/intake">Run a Venture Scan</a>
          <a class="btn secondary" href="/industries">See More Domains</a>
        </div>
      </article>
    </section>
  `;

  return layout('Launch Wedge', content, '/med-spas');
}

function operatorArchitecturePage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Signal Engine</p>
        <h2>The simple version of how NA Kit thinks.</h2>
        <p class="muted">Read a signal-rich URL, compress the strongest clues, score the category, and return a launch thesis sharp enough to build from.</p>
        <div class="mini-proof">
          <span class="pill">Reader</span>
          <span class="pill">Score model</span>
          <span class="pill">Launch thesis</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-signals.svg" alt="NA Kit venture architecture showing signal scan, scoring, and opportunity output." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Modules</p>
          <h2>Three clean layers.</h2>
        </div>
        <p class="muted">The product stays premium because each layer does one clean job.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">1</p>
          <h3>Read</h3>
          <p class="muted">Fetch the URL, keep only the useful pages, and extract the strongest clues.</p>
        </article>
        <article class="card">
          <p class="kicker">2</p>
          <h3>Score</h3>
          <p class="muted">Judge urgency, shareability, monetization, defensibility, platform door, and speed to build.</p>
        </article>
        <article class="card">
          <p class="kicker">3</p>
          <h3>Position</h3>
          <p class="muted">Return a sharper product promise, a share artifact, and the next obvious prototype move.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Output standard</p>
          <h3>It should feel like a serious venture memo, not a brainstorm dump.</h3>
          <p class="muted">The finished output needs to be useful to a founder immediately, with enough clarity to drive a real build decision.</p>
        </article>
        <article class="card">
          <p class="kicker">Reality</p>
          <h3>A good interface cannot save a weak category.</h3>
          <p class="muted">The pain, artifact, money model, and platform door still have to survive real-world pressure.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Signal Engine', content, '/operator-architecture');
}

function aboutPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">About NA Kit</p>
        <h2>NA Kit is a premium concept engine for necessary apps that can actually spread and make money.</h2>
        <p class="muted">It exists for founders and operators who want sharper product theses than the average “idea list” can deliver. The goal is to surface categories that feel inevitable because they plug into real fear, savings, care, trust, or throughput.</p>
        <div class="mini-proof">
          <span class="pill">Necessary products</span>
          <span class="pill">Native distribution</span>
          <span class="pill">Platform ambition</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-cosmos.svg" alt="NA Kit opportunity universe connecting safety, money, care, work, home, commerce, and trust." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">What it is</p>
          <h3>A launch surface for finding the next inevitable app.</h3>
          <p class="muted">NA Kit reads a signal-rich URL and returns a clearer venture thesis around urgency, virality, monetization, and platform expansion.</p>
        </article>
        <article class="card">
          <p class="kicker">Who it helps</p>
          <h3>Founders, operators, and builders looking for conviction.</h3>
          <p class="muted">Especially people who care about category quality more than trend-chasing and want outputs strong enough to actually build from.</p>
        </article>
        <article class="card">
          <p class="kicker">Why it exists</p>
          <h3>Because most idea lists stop before the hard part.</h3>
          <p class="muted">The hard part is finding the pain, the share artifact, the money path, and the platform door all at once.</p>
        </article>
        <article class="card">
          <p class="kicker">How it works</p>
          <h3>Scan, score, position, move.</h3>
          <p class="muted">The engine reads the signal, scores the market, and returns a launch-ready direction with a stronger opening move.</p>
        </article>
        <article class="card">
          <p class="kicker">What makes it different</p>
          <h3>It treats distribution and monetization as product design, not afterthoughts.</h3>
          <p class="muted">A concept only counts if it can travel, get paid, and become harder to replace over time.</p>
        </article>
        <article class="card">
          <p class="kicker">The standard</p>
          <h3>It should feel calm, expensive, and inevitable.</h3>
          <p class="muted">That is the bar for the design, the copy, and the actual quality of the opportunities it surfaces.</p>
        </article>
      </div>
    </section>
  `;

  return layout('About', content, '/about');
}

function privacyPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Privacy</p>
        <h2>Simple privacy, in plain English.</h2>
      </div>
      <p class="muted">NA Kit only needs the information required to read submitted URLs, generate venture scans, and support product operations clearly.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What NA Kit may collect</p>
        <ul class="list-clean">
          <li>Business contact details from intake.</li>
          <li>Public page content and structure needed for venture scans.</li>
          <li>Scan output, operator notes, and queue history.</li>
          <li>Operational data required to support the app safely.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">How it is used</p>
        <ul class="list-clean">
          <li>To run venture scans and generate structured outputs.</li>
          <li>To improve product quality, queue handling, and support.</li>
          <li>To maintain product security and reasonable operational logs.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">Your control</p>
        <p class="muted">You can request deletion or correction of stored records, and the product should keep data collection narrower than the feature set actually requires.</p>
      </article>
    </section>
  `;

  return layout('Privacy Policy', content, '/privacy');
}

function termsPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Terms</p>
        <h2>Clear rules. No surprises.</h2>
      </div>
      <p class="muted">NA Kit prepares venture scans and product outputs. The user still controls how those outputs get used in the real world.</p>
    </section>
    <section class="feature-grid">
      <article class="card">
        <p class="kicker">User responsibility</p>
        <h3>You are responsible for how you use the output.</h3>
        <p class="muted">NA Kit can generate scans, concepts, and recommendations, but it does not assume legal or commercial responsibility for a user’s final decisions.</p>
      </article>
      <article class="card">
        <p class="kicker">Content responsibility</p>
        <h3>AI output is draft material, not unquestionable truth.</h3>
        <p class="muted">Product, legal, and market claims still need real-world review before they become public or commercialized.</p>
      </article>
      <article class="card">
        <p class="kicker">Service limits</p>
        <h3>NA Kit should be used honestly and within platform rules.</h3>
        <p class="muted">No unsupported scraping promises, no deceptive claims, and no pretending the product has permissions it does not actually have.</p>
      </article>
    </section>
  `;

  return layout('Terms of Service', content, '/terms');
}

function authorizationPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Authorization</p>
        <h2>Submitted URLs should be intentional and permission-safe.</h2>
        <p class="muted">NA Kit is designed to work from public, signal-rich URLs and lightweight user-submitted context. If deeper access ever arrives later, it should stay explicit and narrow.</p>
        <div class="mini-proof">
          <span class="pill">Signal-first</span>
          <span class="pill">Public-data lean</span>
          <span class="pill">No false permissions</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/nakit-signals.svg" alt="NA Kit authorization layer showing signal-first, public-data-first scanning." />
        </div>
      </article>
    </section>

    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What you approve</p>
        <p class="muted">You confirm that you can share the URL or market signal and that NA Kit may analyze public information from it to produce a venture scan.</p>
      </article>
      <article class="card">
        <p class="kicker">What does not happen</p>
        <p class="muted">NA Kit does not claim hidden access, silent integrations, or unsupported permissions. If future deeper connectors appear, they should be explicit and revocable.</p>
      </article>
    </section>

    <section class="section">
      <div class="feature-grid">${[
        {
          name: 'Public data',
          headline: 'Phase 1 should work from public signals first.',
          body: 'That keeps the product clean, low-friction, and believable.'
        },
        {
          name: 'User intent',
          headline: 'Only analyze what the user intentionally submits.',
          body: 'The URL itself is the primary signal, and the optional context only sharpens the output.'
        },
        {
          name: 'Future connectors',
          headline: 'If deeper access comes later, it should be narrow and explicit.',
          body: 'No pretending the product can do things the actual permission model does not support.'
        }
      ].map(renderPillarCard).join('')}</div>
    </section>
  `;

  return layout('Authorization', content, '/authorization');
}

function intakePage(selectedPlan = 'Starter', values = {}, errorMessage = '') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Build Queue</p>
        <h2>Drop in one signal-rich URL.</h2>
      </div>
      <p class="muted">A category site, competitor, article, or market signal is enough. NA Kit will scan it, score the opportunity, and return the clearest next build move.</p>
    </section>
    <section class="detail-grid" style="margin-bottom: 18px;">
      <article class="card">
        <p class="kicker">What happens next</p>
        <h3>Scan. Score. Position.</h3>
        <p class="muted">NA Kit reads the signal, looks for urgency and shareability, and returns a venture scan that feels like a serious opening memo.</p>
      </article>
      <article class="card">
        <p class="kicker">Low friction</p>
        <h3>The URL is the only required field.</h3>
        <p class="muted">Everything else is optional. Add more context only if you want the scan to aim harder at a specific lane.</p>
      </article>
    </section>
    <section class="card intake-shell">
      <form method="POST" action="/intake" data-intake-form>
        <input type="hidden" name="plan" value="${escapeHtml(normalizePlan(selectedPlan))}" />
        <input type="hidden" name="businessSize" value="small-team" />
        <input type="hidden" name="leadVolume" value="steady" />
        <input type="hidden" name="salesMotion" value="mixed" />
        <input type="hidden" name="preferredChannel" value="email" />
        <input type="hidden" name="publishConsent" value="yes" />
        <input type="hidden" name="legalConsent" value="yes" />

        <div class="form-section">
          <div class="form-section-head">
            <p class="kicker">Start Here</p>
            <h3>Signal first</h3>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="website">Signal URL</label>
              <input id="website" required name="website" placeholder="https://example.com/article, brand, competitor, or category page" value="${escapeHtml(values.website || '')}" />
            </div>
            <div class="field">
              <label for="goal">What are you hunting?</label>
              <select id="goal" name="goal">
                <option value="Find the hidden pain"${values.goal === 'Find the hidden pain' ? ' selected' : ''}>Find the hidden pain</option>
                <option value="Stress-test a category"${values.goal === 'Stress-test a category' ? ' selected' : ''}>Stress-test a category</option>
                <option value="Map the share artifact"${values.goal === 'Map the share artifact' ? ' selected' : ''}>Map the share artifact</option>
                <option value="Find the money model"${values.goal === 'Find the money model' ? ' selected' : ''}>Find the money model</option>
                <option value="Find the platform door"${values.goal === 'Find the platform door' ? ' selected' : ''}>Find the platform door</option>
                <option value="Not sure"${!values.goal || values.goal === 'Not sure' ? ' selected' : ''}>Not sure</option>
              </select>
            </div>
          </div>
        </div>

        <details class="advanced-panel">
          <summary>Add optional details</summary>
          <div class="form-grid">
            <div class="field">
              <label for="businessName">Project name</label>
              <input id="businessName" name="businessName" placeholder="What do you want to call this thesis?" value="${escapeHtml(values.businessName || '')}" />
            </div>
            <div class="field">
              <label for="category">Lane</label>
              <select id="category" name="category">
                <option value="General opportunity"${!values.category || values.category === 'General opportunity' ? ' selected' : ''}>General opportunity</option>
                <option value="Safety + scams"${values.category === 'Safety + scams' ? ' selected' : ''}>Safety + scams</option>
                <option value="Bills + savings"${values.category === 'Bills + savings' ? ' selected' : ''}>Bills + savings</option>
                <option value="Care + family"${values.category === 'Care + family' ? ' selected' : ''}>Care + family</option>
                <option value="Work + skill"${values.category === 'Work + skill' ? ' selected' : ''}>Work + skill</option>
                <option value="Home + property"${values.category === 'Home + property' ? ' selected' : ''}>Home + property</option>
                <option value="Civic + bureaucracy"${values.category === 'Civic + bureaucracy' ? ' selected' : ''}>Civic + bureaucracy</option>
                <option value="Dating + trust"${values.category === 'Dating + trust' ? ' selected' : ''}>Dating + trust</option>
                <option value="Commerce + creators"${values.category === 'Commerce + creators' ? ' selected' : ''}>Commerce + creators</option>
                <option value="Transitions + moving"${values.category === 'Transitions + moving' ? ' selected' : ''}>Transitions + moving</option>
                <option value="Information + trust"${values.category === 'Information + trust' ? ' selected' : ''}>Information + trust</option>
                <option value="Other"${values.category === 'Other' ? ' selected' : ''}>Other</option>
              </select>
            </div>
            <div class="field">
              <label for="owner">Your name</label>
              <input id="owner" name="owner" placeholder="Your name" value="${escapeHtml(values.owner || '')}" />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input id="email" type="email" name="email" placeholder="owner@example.com" value="${escapeHtml(values.email || '')}" />
            </div>
            <div class="field">
              <label for="phone">Phone</label>
              <input id="phone" name="phone" placeholder="(555) 000-0000" value="${escapeHtml(values.phone || '')}" />
            </div>
            <div class="field">
              <label for="mainServices">Target behavior</label>
              <input id="mainServices" name="mainServices" placeholder="Warnings, savings, care coordination, storefront conversion..." value="${escapeHtml(values.mainServices || '')}" />
            </div>
            <div class="field">
              <label for="sitePlatform">Source type</label>
              <select id="sitePlatform" name="sitePlatform">
                <option value="category-site"${values.sitePlatform === 'category-site' ? ' selected' : ''}>Category site</option>
                <option value="competitor"${values.sitePlatform === 'competitor' ? ' selected' : ''}>Competitor</option>
                <option value="creator-brand"${values.sitePlatform === 'creator-brand' ? ' selected' : ''}>Creator brand</option>
                <option value="market-article"${values.sitePlatform === 'market-article' ? ' selected' : ''}>Market article</option>
                <option value="custom"${!values.sitePlatform || values.sitePlatform === 'custom' ? ' selected' : ''}>Other</option>
              </select>
            </div>
            <div class="field">
              <label for="bookingSystem">Comparable product or workflow</label>
              <input id="bookingSystem" name="bookingSystem" placeholder="Any existing product, platform, or workflow this resembles" value="${escapeHtml(values.bookingSystem || '')}" />
            </div>
            <div class="field">
              <label for="instagram">Instagram</label>
              <input id="instagram" name="instagram" placeholder="@yourbrand" value="${escapeHtml(values.instagram || '')}" />
            </div>
            <div class="field">
              <label for="facebook">Facebook</label>
              <input id="facebook" name="facebook" placeholder="facebook.com/yourbrand" value="${escapeHtml(values.facebook || '')}" />
            </div>
            <div class="field full">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Any theory, market intuition, or constraint you want the scan to consider?">${escapeHtml(values.notes || '')}</textarea>
            </div>
          </div>
        </details>

        <div class="form-section">
          <div class="form-section-head">
            <p class="kicker">Consent</p>
            <h3>One confirmation</h3>
          </div>
          <div class="form-grid">
            <div class="field full">
              <label class="checkbox-field">
                <input required type="checkbox" name="scanConsent" value="yes"${values.scanConsent === 'yes' ? ' checked' : ''} />
                <span>I can share this URL, and I understand NA Kit will generate a venture scan from public signal data. By submitting, I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</span>
              </label>
            </div>
          </div>
        </div>

        <p class="form-hint">Usually takes about 20 seconds. Optional details simply help the scan lean harder into the right lane.</p>
        <p class="inline-note" data-intake-status${errorMessage ? ' data-state="warning"' : ''}>${escapeHtml(errorMessage || 'NA Kit starts reading the signal the moment you submit it.')}</p>
        <div class="actions">
          <button class="btn" type="submit" data-intake-submit>Start Venture Scan</button>
          <a class="btn secondary" href="/case-studies">See the Ten Concepts</a>
        </div>
      </form>
    </section>
  `;

  return layout('Build Queue', content, '/intake');
}

function intakeSuccessPage(plan = 'Starter') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Signal Received</p>
        <h2>We’re scanning the opportunity.</h2>
      </div>
      <p class="muted">The engine is reading the signal now. The next step is a sharper product thesis, not a generic queue page.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What happens now</p>
        <h3>The venture scan starts immediately.</h3>
        <p class="muted">NA Kit will look for urgency, shareability, money logic, and the platform door hiding underneath the signal.</p>
      </article>
      <article class="card">
        <p class="kicker">If contact is missing</p>
        <h3>The URL was enough.</h3>
        <p class="muted">You can always add more context later. The first pass only needs a signal-rich starting point.</p>
      </article>
    </section>
    <section class="card">
      <p class="section-label">Next Step</p>
      <h2>Clear opportunity first. Cleaner build move next.</h2>
      <p class="muted">The point is to surface the inevitable angle quickly, not bury the product in extra ceremony.</p>
      <div class="actions">
        <a class="btn" href="/pricing">See Business Models</a>
        <a class="btn secondary" href="/">Go Home</a>
      </div>
    </section>
  `;

  return layout('Signal Received', content, '/intake');
}

function getAuditStatusLabel(status = 'queued') {
  const labels = {
    queued: 'Queued',
    scanning: 'Scanning',
    analyzing: 'Analyzing',
    completed: 'Completed',
    failed: 'Failed'
  };

  return labels[status] || 'Queued';
}

function getAuditProgressCopy(job) {
  if (!job) {
    return 'Preparing your audit.';
  }

  return job.progressLabel || {
    queued: 'Reading your signal.',
    scanning: 'Pulling the strongest market clues.',
    analyzing: 'Scoring urgency, spread, and money logic.',
    completed: 'Your venture scan is ready.',
    failed: 'We could not finish the venture scan.'
  }[job.status] || 'Preparing your venture scan.';
}

function createClientFromIntake(form = {}) {
  const socialParts = [
    form.instagram ? `Instagram: ${form.instagram}` : '',
    form.facebook ? `Facebook: ${form.facebook}` : '',
    form.socialStack || ''
  ].filter(Boolean);
  const notesParts = [
    form.mainServices ? `Main services: ${form.mainServices}` : '',
    form.notes || ''
  ].filter(Boolean);
  const website = form.website || '';
  const businessName = form.businessName || getDomainFromWebsite(website) || 'Signal Lead';

  return {
    id: `c_${crypto.randomUUID().slice(0, 10)}`,
    businessName,
    owner: form.owner || '',
    email: form.email || '',
    phone: form.phone || '',
    website,
    sitePlatform: form.sitePlatform || 'custom',
    category: form.category || 'General opportunity',
    goal: form.goal || '',
    notes: notesParts.join('\n\n'),
    plan: normalizePlan(form.plan),
    businessSize: form.businessSize || 'small-team',
    leadVolume: form.leadVolume || 'steady',
    salesMotion: form.salesMotion || 'mixed',
    preferredChannel: form.preferredChannel || 'email',
    socialStack: socialParts.join(' · '),
    instagram: form.instagram || '',
    facebook: form.facebook || '',
    mainServices: form.mainServices || '',
    bookingSystem: form.bookingSystem || '',
    callLogs: [],
    scanConsent: form.scanConsent === 'yes',
    publishConsent: form.publishConsent === 'yes' || form.scanConsent === 'yes',
    legalConsent: form.legalConsent === 'yes' || form.scanConsent === 'yes',
    createdAt: new Date().toISOString()
  };
}

function createAuditJobRecord(clientId) {
  return {
    id: `audit_${crypto.randomUUID().slice(0, 12)}`,
    clientId,
    status: 'queued',
    progressLabel: 'Reading your signal.',
    startedAt: '',
    completedAt: '',
    errorMessage: '',
    source: '',
    createdAt: new Date().toISOString()
  };
}

async function createLeadAndAudit(form = {}) {
  const client = await storage.createClient(createClientFromIntake(form));
  const auditJob = await storage.createAuditJob(createAuditJobRecord(client.id));

  queueAuditJob(auditJob.id, {
    storage,
    openaiClient,
    model: auditModel,
    maxPages: auditMaxPages,
    fetchTimeoutMs: auditFetchTimeoutMs
  });

  return {
    client,
    auditJob,
    redirectUrl: `/audit/${auditJob.id}`
  };
}

function renderAuditIssueCards(result) {
  if (!result || !Array.isArray(result.topIssues) || !result.topIssues.length) {
    return `
      <article class="card audit-issue-card">
        <p class="kicker">No issues yet</p>
        <h3>Your venture scan is still loading.</h3>
        <p class="muted">NA Kit will fill this with the hottest openings as soon as the scan is finished.</p>
      </article>
    `;
  }

  return result.topIssues.map((issue) => `
    <article class="card audit-issue-card">
      <p class="kicker">${escapeHtml(issue.category || 'Issue')}</p>
      <h3>${escapeHtml(issue.issue || 'Needs attention')}</h3>
      <p class="muted">${escapeHtml(issue.whyItHurts || 'This issue is making the site harder to trust or act on.')}</p>
      <span class="pill">${escapeHtml(issue.severity || 'medium')}</span>
    </article>
  `).join('');
}

function auditPage(auditJob, client, auditResult) {
  const completed = auditJob?.status === 'completed' && auditResult;
  const scores = auditResult?.scores || {};
  const strongestPage = auditResult?.strongestPageFound || client?.website || 'Homepage';
  const sourceMode = auditResult?.sourceMode || auditResult?.source || auditJob?.source || 'pending';

  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Venture Scan</p>
        <h2>${escapeHtml(getClientDisplayName(client || {}))}</h2>
      </div>
      <p class="muted">NA Kit is checking this signal for urgency, shareability, business model fit, defensibility, and the bigger platform door.</p>
    </section>

    <section class="card audit-shell" data-audit-page data-audit-id="${escapeHtml(auditJob.id)}">
      <div class="audit-loading">
        <p class="section-label">Live Scan</p>
        <h3 data-audit-progress>${escapeHtml(getAuditProgressCopy(auditJob))}</h3>
        <p class="muted">Searching the signal for hidden inevitability...</p>
        <div class="mini-proof">
          <span class="pill" data-audit-status-pill>${escapeHtml(getAuditStatusLabel(auditJob.status))}</span>
          <span class="pill">${escapeHtml(client?.website || 'Signal pending')}</span>
          <span class="pill" data-audit-source-mode>${escapeHtml(sourceMode)}</span>
        </div>
      </div>

      <div class="audit-grid" data-audit-results${completed ? '' : ' hidden'}>
        <article class="card audit-score-card">
          <p class="kicker">Inevitability Score</p>
          <div class="audit-score" data-audit-overall-score>${completed ? escapeHtml(String(auditResult.overallScore || '--')) : '--'}</div>
          <p class="muted" data-audit-summary>${completed ? escapeHtml(auditResult.summary || '') : 'Your summary will appear here as soon as the audit finishes.'}</p>
        </article>
          <article class="card">
            <p class="kicker">Five-Second Read</p>
            <h3 data-audit-five-second>${completed ? escapeHtml(auditResult.fiveSecondImpression || '') : 'Loading first-impression analysis...'}</h3>
            <div class="audit-mini-scores">
            ${Object.entries(nakitScoreLabels).map(([key, label]) => `
              <div class="audit-mini-score">
                <strong data-audit-score-${key}>${completed ? escapeHtml(String(scores[key] ?? '--')) : '--'}</strong>
                <span>${escapeHtml(label)}</span>
              </div>
            `).join('')}
          </div>
          <div class="mini-proof" style="margin-top: 18px;">
            <span class="pill">Strongest signal</span>
            <span class="pill" data-audit-strongest-page>${escapeHtml(strongestPage)}</span>
          </div>
        </article>
      </div>

      <div class="audit-sections" data-audit-detail-sections${completed ? '' : ' hidden'}>
        <section>
          <div class="section-heading">
            <div>
              <p class="section-label">Top Openings</p>
              <h2>Where the opportunity feels hottest first.</h2>
            </div>
          </div>
          <div class="feature-grid" data-audit-issues>${renderAuditIssueCards(auditResult)}</div>
        </section>

        <section class="detail-grid" style="margin-top: 18px;">
          <article class="card">
            <p class="kicker">Quick Wins</p>
            <ul class="list-clean" data-audit-quick-wins>
              ${(completed ? auditResult.quickWins : ['NA Kit is building your quick wins now.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
          <article class="card">
            <p class="kicker">Best Next Move</p>
            <ul class="list-clean" data-audit-recommended-fixes>
              ${(completed ? auditResult.recommendedFixes : ['Your recommended moves will appear here when the scan finishes.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        </section>

        <section class="detail-grid" style="margin-top: 18px;">
          <article class="card">
            <p class="kicker">Launch Positioning</p>
            <div class="rewrite-preview">
              <strong data-audit-hero-headline>${completed ? escapeHtml(auditResult.heroRewrite?.headline || '') : 'Loading headline...'}</strong>
              <p class="muted" data-audit-hero-subheadline>${completed ? escapeHtml(auditResult.heroRewrite?.subheadline || '') : 'Loading subheadline...'}</p>
              <span class="pill" data-audit-hero-cta>${completed ? escapeHtml(auditResult.heroRewrite?.cta || '') : 'Loading CTA...'}</span>
            </div>
          </article>
          <article class="card">
            <p class="kicker">Spread Logic</p>
            <ul class="list-clean" data-audit-conversion-leaks>
              ${(completed ? auditResult.conversionLeaks : ['Your spread angles will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        </section>

        <section style="margin-top: 18px;">
          <div class="section-heading">
            <div>
              <p class="section-label">Build Kit</p>
              <h2>The pieces that make the concept launchable.</h2>
            </div>
            <p class="muted">This is where the output shifts from “interesting” to “worth prototyping.”</p>
          </div>
          <div class="feature-grid">
            <article class="card fix-card">
              <p class="kicker">Blueprint</p>
              <h3>Core promise + launch CTA</h3>
              <div class="rewrite-preview">
                <strong data-audit-fix-headline>${completed ? escapeHtml(auditResult.heroRewrite?.headline || '') : 'Loading rewrite...'}</strong>
                <p class="muted">${completed ? escapeHtml(auditResult.heroRewrite?.subheadline || '') : 'Loading supporting copy...'}</p>
                <span class="pill" data-audit-fix-cta>${completed ? escapeHtml(auditResult.heroRewrite?.cta || '') : 'Loading CTA...'}</span>
              </div>
              <div class="mini-proof">
                <span class="pill">prototype</span>
                <span class="pill">positioning</span>
              </div>
            </article>
            <article class="card fix-card">
              <p class="kicker">Share Artifact</p>
              <h3>What people would naturally repost or forward.</h3>
              <ul class="list-clean" data-audit-trust-recommendations>
                ${(completed ? auditResult.trustRecommendations : ['Share-artifact directions will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Money Path</p>
              <h3>How this concept most naturally gets paid.</h3>
              <ul class="list-clean" data-audit-booking-recommendations>
                ${(completed ? auditResult.bookingFlowRecommendations : ['Revenue-path recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Platform Door</p>
              <h3>What larger layer this could become.</h3>
              <ul class="list-clean" data-audit-seo-recommendations>
                ${(completed ? auditResult.seoRecommendations : ['Platform-door recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Missing Ingredients</p>
              <h3>What the current thesis still needs.</h3>
              <ul class="list-clean" data-audit-missing-elements>
                ${(completed ? auditResult.missingElements : ['Missing ingredients will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Phase Plan</p>
              <h3>How NA Kit would move next.</h3>
              <ul class="list-clean">
                <li>Validate the pain in a tighter wedge.</li>
                <li>Prototype the artifact users will naturally share.</li>
                <li>Charge through the most native money path first.</li>
              </ul>
              <div class="mini-proof">
                <span class="pill">validate</span>
                <span class="pill">prototype</span>
                <span class="pill">expand</span>
              </div>
            </article>
          </div>
        </section>
      </div>

      <article class="card audit-error" data-audit-error${auditJob.status === 'failed' ? '' : ' hidden'}>
        <p class="kicker">Scan Error</p>
        <h3>We could not finish the venture scan.</h3>
        <p class="muted" data-audit-error-message>${escapeHtml(auditJob.errorMessage || 'Try again with a reachable signal URL.')}</p>
      </article>
    </section>
  `;

  return layout('Venture Scan', content, `/audit/${auditJob.id}`);
}

function adminPage(clients, latestAudits = {}) {
  const topChannel = channelLabel(mostCommonChannel(clients));
  const newestClient = clients[0] ? formatDate([...clients].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0].createdAt) : 'None yet';
  const callQueue = [...clients]
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
    .map((client) => {
      const latestCall = getLatestCallLog(client);
      const latestAudit = latestAudits[client.id]?.job;
      return `
        <tr>
          <td>
            <div class="table-title">${escapeHtml(getClientDisplayName(client))}</div>
            <div class="table-subtitle">${escapeHtml(client.website || 'No website provided')} · Audit ${escapeHtml(getAuditStatusLabel(latestAudit?.status || 'queued'))}</div>
          </td>
          <td>${escapeHtml(getClientContactSummary(client))}</td>
          <td>${escapeHtml(getCallStatus(client))}</td>
          <td>${escapeHtml(getNextCallAction(client))}</td>
          <td>${latestCall ? escapeHtml(formatDateTime(latestCall.createdAt)) : 'No calls yet'}</td>
          <td><a href="/admin/client/${escapeHtml(client.id)}">Open Lead</a></td>
        </tr>
      `;
    })
    .join('');

  const rows = clients
    .map((client) => {
      const portalLink = `/portal/${client.id}`;
      const blueprint = buildZumiBlueprint(client);
      const latestAudit = latestAudits[client.id]?.job;
      const latestResult = latestAudits[client.id]?.result;
      return `<tr>
        <td>
          <div class="table-title">${escapeHtml(getClientDisplayName(client))}</div>
          <div class="table-subtitle">${escapeHtml(blueprint.engineName)} · ${escapeHtml(client.goal || 'No goal set yet')}</div>
        </td>
        <td>${escapeHtml(getPlanLabel(client.plan || 'Starter'))}</td>
        <td>${escapeHtml(blueprint.sizeLabel)}</td>
        <td>${escapeHtml(channelLabel(client.preferredChannel || 'email'))}</td>
        <td>${formatDate(client.createdAt)}</td>
        <td><span class="status">${escapeHtml(latestAudit ? `${getAuditStatusLabel(latestAudit.status)}${latestResult?.overallScore ? ` · ${latestResult.overallScore}` : ''}` : getCallStatus(client))}</span></td>
        <td>
          <div><a href="/admin/client/${escapeHtml(client.id)}">Open</a></div>
          ${latestAudit ? `<div class="table-subtitle"><a href="/audit/${escapeHtml(latestAudit.id)}">Audit</a></div>` : ''}
          <div class="table-subtitle"><a href="${portalLink}">Portal</a></div>
        </td>
      </tr>`;
    })
    .join('');

  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Admin Dashboard</p>
        <h2>Manage pipeline, portals, and follow-up drafts.</h2>
      </div>
      <p class="muted">This is still the local MVP, but the dashboard now supports a cleaner sales flow and a stronger client handoff.</p>
    </section>
    <section class="stat-grid">
      <article class="card">
        <p class="kicker">Leads</p>
        <h3>${clients.length}</h3>
        <p class="muted">Website audit requests currently in the dashboard.</p>
      </article>
      <article class="card">
        <p class="kicker">Preferred Channel</p>
        <h3>${escapeHtml(topChannel)}</h3>
        <p class="muted">Helpful context once the lead moves into follow-up and closing.</p>
      </article>
      <article class="card">
        <p class="kicker">Newest Intake</p>
        <h3>${escapeHtml(newestClient)}</h3>
        <p class="muted">The most recently added business record.</p>
      </article>
    </section>
    <section class="card" style="margin-top: 18px;">
      <div class="page-head" style="margin: 0 0 18px;">
        <div>
          <p class="section-label">Call List</p>
          <h3>Queue for your workers</h3>
        </div>
        <span class="pill">${clients.length} leads</span>
      </div>
      ${clients.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Best Contact</th>
                  <th>Status</th>
                  <th>Next Action</th>
                  <th>Last Call</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>${callQueue}</tbody>
            </table>
          </div>`
        : `<div class="empty-state">
            <h3>No audit requests yet</h3>
            <p class="muted">Once websites start coming in, your workers can use this queue for calls and follow-up.</p>
          </div>`}
    </section>
    <section class="card" style="margin-top: 18px;">
      <div class="page-head" style="margin: 0 0 18px;">
        <div>
          <p class="section-label">Client List</p>
          <h3>All businesses</h3>
        </div>
        <a class="btn secondary" href="/intake">Add New Client</a>
      </div>
      ${clients.length
        ? `<div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Plan</th>
                  <th>Size</th>
                  <th>Channel</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
        : `<div class="empty-state">
            <h3>No clients yet</h3>
            <p class="muted">Use the intake form to create your first business record.</p>
            <div class="actions" style="justify-content: center;">
              <a class="btn" href="/intake">Add First Client</a>
            </div>
          </div>`}
    </section>
  `;

  return layout('Admin Dashboard', content, '/admin');
}

function adminClientPage(client, wasJustCreated = false, latestAuditJob = null, latestAuditResult = null) {
  const actionItems = buildActionItems(client);
  const reviews = buildReviewPrompts(client);
  const blueprint = buildZumiBlueprint(client);
  const displayName = getClientDisplayName(client);
  const contactSummary = getClientContactSummary(client);
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Client Detail</p>
        <h2>${escapeHtml(displayName)}</h2>
      </div>
      <p class="muted">Owner: ${escapeHtml(client.owner || 'Not captured yet')} · Category: ${escapeHtml(client.category || 'General business')}</p>
    </section>
    ${wasJustCreated ? `<div class="notice">Client saved successfully. ${escapeHtml(brand.algorithmName)} already mapped the business to the <strong>${escapeHtml(blueprint.engineName)}</strong>.</div>` : ''}
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">Business Snapshot</p>
        <div class="key-value">
          <div class="key-value-item">
            <strong>Email</strong>
            <span>${escapeHtml(client.email || 'Not captured yet')}</span>
          </div>
          <div class="key-value-item">
            <strong>Phone</strong>
            <span>${escapeHtml(client.phone || 'Not provided')}</span>
          </div>
          <div class="key-value-item">
            <strong>Website</strong>
            <span>${escapeHtml(client.website || 'Not provided')}</span>
          </div>
          <div class="key-value-item">
            <strong>Best Contact</strong>
            <span>${escapeHtml(contactSummary)}</span>
          </div>
          <div class="key-value-item">
            <strong>Main Services</strong>
            <span>${escapeHtml(client.mainServices || 'Not provided')}</span>
          </div>
          <div class="key-value-item">
            <strong>Platform</strong>
            <span>${escapeHtml(getSitePlatformLabel(client.sitePlatform || 'wordpress'))}</span>
          </div>
          <div class="key-value-item">
            <strong>Plan</strong>
            <span>${escapeHtml(getPlanLabel(client.plan || 'Starter'))}</span>
          </div>
          <div class="key-value-item">
            <strong>Business Size</strong>
            <span>${escapeHtml(blueprint.sizeLabel)}</span>
          </div>
          <div class="key-value-item">
            <strong>Goal</strong>
            <span>${escapeHtml(client.goal || 'No goal set yet')}</span>
          </div>
          <div class="key-value-item">
            <strong>Preferred Channel</strong>
            <span>${escapeHtml(channelLabel(client.preferredChannel || 'email'))}</span>
          </div>
          <div class="key-value-item">
            <strong>Lead Flow</strong>
            <span>${escapeHtml(blueprint.volumeLabel)}</span>
          </div>
          <div class="key-value-item">
            <strong>Sales Motion</strong>
            <span>${escapeHtml(blueprint.motionLabel)}</span>
          </div>
          <div class="key-value-item">
            <strong>Social Stack</strong>
            <span>${escapeHtml(client.socialStack || 'Not provided')}</span>
          </div>
          <div class="key-value-item">
            <strong>Booking System</strong>
            <span>${escapeHtml(client.bookingSystem || 'Not provided')}</span>
          </div>
        </div>
        <div style="margin-top: 18px;">
          <strong>Notes</strong>
          <p class="muted">${escapeHtml(client.notes || 'No notes yet.')}</p>
        </div>
        <div class="actions">
          <a class="btn" href="/portal/${escapeHtml(client.id)}">Open Client Portal</a>
          <a class="btn secondary" href="/admin">Back to Admin</a>
        </div>
      </article>
      ${followupComposerCard(client)}
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Audit Status</p>
        <h3>${escapeHtml(getAuditStatusLabel(latestAuditJob?.status || 'queued'))}</h3>
        <p class="muted">${escapeHtml(getAuditProgressCopy(latestAuditJob))}</p>
        <div class="mini-proof">
          ${latestAuditResult?.overallScore ? `<span class="pill">Score ${escapeHtml(String(latestAuditResult.overallScore))}</span>` : ''}
          ${latestAuditJob ? `<span class="pill">${escapeHtml(latestAuditJob.id)}</span>` : '<span class="pill">No audit yet</span>'}
        </div>
        <div class="actions">
          ${latestAuditJob ? `<a class="btn" href="/audit/${escapeHtml(latestAuditJob.id)}">Open Audit</a>` : '<a class="btn" href="/intake">Create Audit</a>'}
        </div>
      </article>
      <article class="card">
        <p class="kicker">Audit Summary</p>
        <h3>${escapeHtml(latestAuditResult?.summary || 'Audit results will appear here once the scan is complete.')}</h3>
        <ul class="list-clean">
          ${(latestAuditResult?.quickWins || ['No quick wins yet.', 'Audit still in progress.']).slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </article>
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Fix Center</p>
        <h3>Draft improvements waiting for approval.</h3>
        <ul class="list-clean">
          ${(latestAuditResult?.recommendedFixes || ['Draft fixes will appear here after the audit completes.', 'Approval-first workflow stays ready for the next phase.']).slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
        <div class="mini-proof">
          <span class="pill">draft</span>
          <span class="pill">approval-first</span>
        </div>
      </article>
      <article class="card">
        <p class="kicker">Trust + Booking Layer</p>
        <h3>What NA Kit wants to strengthen next.</h3>
        <ul class="list-clean">
          ${(latestAuditResult?.trustRecommendations || latestAuditResult?.bookingFlowRecommendations || ['Trust and booking recommendations will appear here once the audit is ready.']).slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </article>
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Call Log</p>
        <h3>Updates for your workers</h3>
        <p class="muted">Use this to keep the lead queue clear even when the audit started from the website only.</p>
        ${renderCallLogItems(client)}
      </article>
      <article class="card">
        <p class="kicker">Log New Call</p>
        <h3>Add the latest touchpoint</h3>
        <form method="POST" action="/admin/client/${escapeHtml(client.id)}/calls">
          <div class="form-grid">
            <div class="field">
              <label for="worker-${escapeHtml(client.id)}">Worker</label>
              <input id="worker-${escapeHtml(client.id)}" name="worker" placeholder="Justin or team member" />
            </div>
            <div class="field">
              <label for="outcome-${escapeHtml(client.id)}">Outcome</label>
              <select id="outcome-${escapeHtml(client.id)}" name="outcome">
                <option value="researching">Researching contact</option>
                <option value="called" selected>Called</option>
                <option value="no_answer">No answer</option>
                <option value="left_vm">Left voicemail</option>
                <option value="texted">Text sent</option>
                <option value="emailed">Email sent</option>
                <option value="spoke">Spoke to owner</option>
                <option value="booked">Booked call</option>
                <option value="won">Won</option>
                <option value="lost">Not a fit</option>
              </select>
            </div>
            <div class="field">
              <label for="nextStep-${escapeHtml(client.id)}">Next action</label>
              <input id="nextStep-${escapeHtml(client.id)}" name="nextStep" placeholder="Call again tomorrow" />
            </div>
            <div class="field">
              <label for="nextDate-${escapeHtml(client.id)}">Next follow-up</label>
              <input id="nextDate-${escapeHtml(client.id)}" type="datetime-local" name="nextDate" />
            </div>
            <div class="field full">
              <label for="note-${escapeHtml(client.id)}">Note</label>
              <textarea id="note-${escapeHtml(client.id)}" name="note" placeholder="What happened, what you found, and what to do next."></textarea>
            </div>
          </div>
          <div class="actions">
            <button class="btn" type="submit">Save Call Update</button>
          </div>
        </form>
      </article>
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      ${renderZumiBlueprintCard(client)}
      ${renderZumiCadenceCard(client)}
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Consent Status</p>
        <ul class="list-clean">
          <li>Scan authorization: ${client.scanConsent ? 'Approved' : 'Not recorded'}</li>
          <li>Approval-first publishing: ${client.publishConsent ? 'Acknowledged' : 'Not recorded'}</li>
          <li>Terms, privacy, and authorization pack: ${client.legalConsent ? 'Accepted' : 'Not recorded'}</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">Recommended Next Actions</p>
        <ul class="list-clean">${actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <p class="kicker">Review Prompts</p>
        <ul class="list-clean">${reviews.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
    </section>
  `;

  return layout(`${displayName} | Admin`, content, '/admin');
}

function clientPortalPage(client) {
  const actionItems = buildActionItems(client);
  const reviews = buildReviewPrompts(client);
  const followupPreview = buildTemplateFollowup(client, client.preferredChannel || 'email');
  const blueprint = buildZumiBlueprint(client);
  const displayName = getClientDisplayName(client);

  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Private Portal</p>
        <h2>${escapeHtml(displayName)} growth view</h2>
      </div>
      <p class="muted">A client-facing snapshot for ${escapeHtml(client.owner || 'the owner')} with the NA Kit plan already customized for this business.</p>
    </section>
    <section class="portal-grid">
      <article class="card">
        <p class="kicker">${escapeHtml(brand.algorithmName)}</p>
        <h3>${escapeHtml(blueprint.engineName)}</h3>
        <p class="muted">${escapeHtml(blueprint.summary)}</p>
        <div class="mini-proof">
          ${renderAutomationFocus(blueprint.automationFocus)}
        </div>
      </article>
      <article class="card">
        <p class="kicker">This Week’s Focus</p>
        <ul class="list-clean">${actionItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <p class="kicker">Follow-up Preview</p>
        <pre class="message-preview">${escapeHtml(followupPreview)}</pre>
      </article>
      <article class="card">
        <p class="kicker">Sequence Cadence</p>
        <ul class="list-clean">${blueprint.cadence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <p class="kicker">Review Prompts</p>
        <ul class="list-clean">${reviews.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <p class="kicker">Client Notes</p>
        <p class="muted">${escapeHtml(client.notes || 'No notes have been added yet.')}</p>
        <p class="muted">Primary goal: ${escapeHtml(client.goal || 'No goal set yet')}</p>
        <p class="muted">Response target: ${escapeHtml(blueprint.responseTarget)}</p>
      </article>
    </section>
  `;

  return layout(`${displayName} Portal`, content, '/portal');
}

function placeholderPage(title, eyebrow, bodyCopy, primaryHref, primaryLabel, secondaryHref, secondaryLabel, currentPath) {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">${escapeHtml(eyebrow)}</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <p class="muted">${escapeHtml(bodyCopy)}</p>
    </section>
    <section class="card">
      <p class="muted">This page is being staged next. For now, use the main intake flow or keep exploring the product.</p>
      <div class="actions">
        <a class="btn" href="${primaryHref}">${escapeHtml(primaryLabel)}</a>
        <a class="btn secondary" href="${secondaryHref}">${escapeHtml(secondaryLabel)}</a>
      </div>
    </section>
  `;

  return layout(title, content, currentPath);
}

function notFoundPage() {
  return layout(
    'Not Found',
    `
      <section class="card empty-state">
        <p class="section-label">404</p>
        <h2>That page does not exist.</h2>
        <p class="muted">Head back to the home page or drop a new signal into the build queue.</p>
        <div class="actions" style="justify-content: center;">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/intake">Start Venture Scan</a>
        </div>
      </section>
    `,
    '/'
  );
}

app.get('/', async (req, res) => {
  sendHtml(res, homePage(await readClients()));
});

app.get('/intake', async (req, res) => {
  const selectedPlan = normalizePlan(req.query.plan);
  sendHtml(res, intakePage(selectedPlan, req.query));
});

app.get('/intake/success', async (req, res) => {
  sendHtml(res, intakeSuccessPage(normalizePlan(req.query.plan)));
});

app.get('/solutions', async (req, res) => {
  sendHtml(res, solutionsPage());
});

app.get('/about', async (req, res) => {
  sendHtml(res, aboutPage());
});

app.get('/privacy', async (req, res) => {
  sendHtml(res, privacyPage());
});

app.get('/terms', async (req, res) => {
  sendHtml(res, termsPage());
});

app.get('/authorization', async (req, res) => {
  sendHtml(res, authorizationPage());
});

app.get('/how-it-works', async (req, res) => {
  sendHtml(res, howItWorksPage());
});

app.get('/discover', async (req, res) => {
  sendHtml(res, discoverPage());
});

app.get('/verify', async (req, res) => {
  sendHtml(res, verifyPage());
});

app.get('/convert', async (req, res) => {
  sendHtml(res, convertPage());
});

app.get('/industries', async (req, res) => {
  sendHtml(res, industriesPage());
});

app.get('/med-spas', async (req, res) => {
  sendHtml(res, medSpaPage());
});

app.get('/operator-architecture', async (req, res) => {
  sendHtml(res, operatorArchitecturePage());
});

app.get('/solutions/:slug', async (req, res) => {
  const page = solutionPages.find((item) => item.slug === req.params.slug);

  if (!page) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  sendHtml(res, solutionPage(page));
});

app.get('/pricing', async (req, res) => {
  sendHtml(res, pricingPage());
});

app.post('/api/intake', async (req, res) => {
  if (!req.body.website) {
    res.status(400).json({ error: 'A signal URL is required.' });
    return;
  }

  if (req.body.scanConsent !== 'yes') {
    res.status(400).json({ error: 'Please confirm you can share this URL for the scan.' });
    return;
  }

  try {
    const session = await createLeadAndAudit(req.body);
    res.json({
      clientId: session.client.id,
      auditId: session.auditJob.id,
      redirectUrl: session.redirectUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not start the audit right now.' });
  }
});

app.post('/intake', async (req, res) => {
  if (!req.body.website) {
    sendHtml(res, intakePage(normalizePlan(req.body.plan), req.body, 'A signal URL is required.'), 400);
    return;
  }

  if (req.body.scanConsent !== 'yes') {
    sendHtml(res, intakePage(normalizePlan(req.body.plan), req.body, 'Please confirm you can share this URL for the scan.'), 400);
    return;
  }

  try {
    const session = await createLeadAndAudit(req.body);
    res.redirect(session.redirectUrl);
  } catch (error) {
    sendHtml(res, intakePage(normalizePlan(req.body.plan), req.body, 'Could not start the audit right now.'), 500);
  }
});

app.get('/audit/:id', async (req, res) => {
  const auditJob = await storage.getAuditJobById(req.params.id);

  if (!auditJob) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  const client = await storage.getClientById(auditJob.clientId);
  const auditResult = await storage.getAuditResult(auditJob.id);
  sendHtml(res, auditPage(auditJob, client, auditResult));
});

app.get('/api/audit/:id', async (req, res) => {
  const auditJob = await storage.getAuditJobById(req.params.id);

  if (!auditJob) {
    res.status(404).json({ error: 'Audit not found.' });
    return;
  }

  const client = await storage.getClientById(auditJob.clientId);
  const auditResult = await storage.getAuditResult(auditJob.id);

  res.json({
    auditId: auditJob.id,
    clientId: auditJob.clientId,
    businessName: getClientDisplayName(client || {}),
    website: client?.website || '',
    status: auditJob.status,
    progress: getAuditProgressCopy(auditJob),
    source: auditResult?.sourceMode || auditJob.source || auditResult?.source || '',
    errorMessage: auditJob.errorMessage || '',
    result: auditResult || null
  });
});

app.post('/admin/client/:id/calls', async (req, res) => {
  const client = await storage.getClientById(req.params.id);

  if (!client) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  const nextLog = {
    worker: req.body.worker || '',
    outcome: req.body.outcome || 'called',
    nextStep: req.body.nextStep || '',
    nextDate: req.body.nextDate || '',
    note: req.body.note || '',
    createdAt: new Date().toISOString()
  };

  await storage.appendCallLog(client.id, nextLog);
  res.redirect(`/admin/client/${encodeURIComponent(client.id)}`);
});

app.get('/admin', async (req, res) => {
  const clients = await storage.listClients();
  const latestAudits = {};

  await Promise.all(clients.map(async (client) => {
    latestAudits[client.id] = await storage.getLatestAuditForClient(client.id);
  }));

  sendHtml(res, adminPage(clients, latestAudits));
});

app.get('/admin/client/:id', async (req, res) => {
  const client = await getClientById(req.params.id);

  if (!client) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  const latestAudit = await storage.getLatestAuditForClient(client.id);
  const latestAuditJob = latestAudit.job;
  const latestAuditResult = latestAudit.result;
  sendHtml(res, adminClientPage(client, req.query.created === '1', latestAuditJob, latestAuditResult));
});

app.get('/portal/:id', async (req, res) => {
  const client = await getClientById(req.params.id);

  if (!client) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  sendHtml(res, clientPortalPage(client));
});

app.get('/login', async (req, res) => {
  sendHtml(
    res,
    placeholderPage(
      'Sign in flow coming next',
      'Authentication',
      'This is the future handoff point for a protected operator login once auth is added.',
      '/admin',
      'Open Admin',
      '/case-studies',
      'See Concepts',
      '/login'
    )
  );
});

app.get('/case-studies', async (req, res) => {
  sendHtml(res, caseStudiesPage());
});

app.get('/demo', async (req, res) => {
  sendHtml(
    res,
    placeholderPage(
      'Book the demo',
      'Sales Motion',
      'Use this route as the future handoff for founder calls, venture reviews, or partnership conversations once the product is fully live.',
      '/intake',
      'Start Venture Scan',
      '/case-studies',
      'See Concepts',
      '/demo'
    )
  );
});

app.get('/health', async (req, res) => {
  const clients = await storage.listClients();
  res.json({
    status: 'ok',
    openaiConfigured: Boolean(openaiClient),
    storageMode: storage.mode,
    clientCount: clients.length
  });
});

app.post('/api/opportunity-preview', (req, res) => {
  const input = {
    searchGoal: req.body.searchGoal || 'surface real opportunities and route them automatically',
    businessType: req.body.businessType || 'general business',
    location: req.body.location || 'your market',
    businessSize: req.body.businessSize || 'small-team',
    leadVolume: req.body.leadVolume || 'steady',
    salesMotion: req.body.salesMotion || 'mixed',
    targetType: req.body.targetType || 'opportunities',
    responseUrgency: req.body.responseUrgency || 'fast'
  };
  const blueprint = buildOpportunityBlueprint(input);
  const opportunities = buildPreviewOpportunities(input, blueprint);

  res.json({
    previewMode: true,
    gate: 'Account creation is only required when saving, exporting, or activating workflows.',
    input,
    blueprint,
    opportunities
  });
});

app.post('/api/followup/:id', async (req, res) => {
  const client = await getClientById(req.params.id);

  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const channel = ['email', 'sms', 'whatsapp'].includes(req.body.channel)
    ? req.body.channel
    : client.preferredChannel || 'email';
  const messageType = [
    'inquiry_followup',
    'missed_call',
    'reactivation',
    'review_request',
    'consult_nudge',
    'booking_reminder'
  ].includes(req.body.messageType)
    ? req.body.messageType
    : 'inquiry_followup';

  const payload = await generateFollowup(client, channel, messageType);
  res.json(payload);
});

app.get('/api/blueprint/:id', async (req, res) => {
  const client = await getClientById(req.params.id);

  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  res.json({
    clientId: client.id,
    businessName: client.businessName,
    blueprint: buildZumiBlueprint(client)
  });
});

app.use((req, res) => {
  sendHtml(res, notFoundPage(), 404);
});

app.listen(PORT, () => {
  console.log(`${brand.name} running at http://localhost:${PORT}`);
});
