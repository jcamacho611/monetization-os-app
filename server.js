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
  name: 'Jeni',
  category: 'Free AI social signal app',
  audience: 'creators, sellers, friend groups, shoppers, and people who live online',
  slogan: 'Drop it. Jeni turns it into a move.',
  headline: 'One social app for everything happening online.',
  subhead: 'Paste a DM, clip, screenshot, offer, rumor, product, or idea. Jeni reads it live and turns it into the right post, action, shop card, circle update, or next move.',
  supportingLine: 'Feed. Drops. Circles. Shops. Studio. Background engines.',
  metaDescription: 'Jeni is a free, ad-funded AI social app that turns messy internet signals into posts, actions, circles, shop cards, and a live personal feed.',
  proofNote: 'Safety, identity, memory, and money still run underneath everything, but the product should feel like social media on the front, not paperwork.',
  algorithmName: 'Jeni Signal Engine'
};
const jeniFeatures = [
  {
    slug: 'shield',
    letter: '01',
    title: 'Warning Feed',
    category: 'DMs + warnings',
    role: 'Feed starter',
    pitch: 'Weird message in, clean warning post out. Jeni formats the red flags so you can keep it, share it, or drop it into a circle fast.',
    viralHook: 'Warning cards built for reposts, stories, and friend-group chats.',
    monetization: 'Safety checklists, recovery offers, and support links after the card lands.',
    adFit: 'High once the result is useful. Nothing paid inside the live read itself.',
    trustPrimitive: 'Shield scoring, redaction, identity checks, and background receipts.',
    door: 'Private circles, creator safety tools, and business risk feeds.',
    whyNow: 'Fraud losses are huge, the pain is emotional, and the warning wants to travel.'
  },
  {
    slug: 'wallet',
    letter: '02',
    title: 'Money Moves',
    category: 'Deals + savings',
    role: 'Retention surface',
    pitch: 'Turn subscriptions, weird charges, price drops, and money chatter into save-worthy moves instead of buried cleanup.',
    viralHook: 'Savings cards, deal drops, and “cut this now” posts.',
    monetization: 'Budgeting, switching, and finance offers between cards and search results.',
    adFit: 'Strong with hard category rules and zero paid influence on the actual read.',
    trustPrimitive: 'Recurring spend detection, merchant matching, and background memory.',
    door: 'Autopilot savings, switching, and permissioned money agents.',
    whyNow: 'Recurring spend keeps leaking because almost nobody manages it cleanly.'
  },
  {
    slug: 'truth',
    letter: '03',
    title: 'Reality Remix',
    category: 'Clips + rumors',
    role: 'Feed starter',
    pitch: 'Drop a clip, screenshot, or rumor and get a clean reality remix people can understand fast.',
    viralHook: 'Comment-ready cards for stories, threads, and group chats.',
    monetization: 'Contextual media, literacy, and creator-safe sponsorships around the remix.',
    adFit: 'Medium. Brand-safe only and never inside the final remix card.',
    trustPrimitive: 'Media analysis, provenance checks, and public verifier states.',
    door: 'Media APIs, brand defense, and community moderation tooling.',
    whyNow: 'Synthetic media is cheap, social feeds are crowded, and people need usable certainty.'
  },
  {
    slug: 'clipshop',
    letter: '04',
    title: 'Clip Market',
    category: 'Clips + shopping',
    role: 'Commerce surface',
    pitch: 'See a product in a post, get the match, the price history, and the cleanest way to buy or share it.',
    viralHook: 'Dupe drops, price alerts, and creator shop cards.',
    monetization: 'Sponsored listings and partner placements inside explicit browse moments.',
    adFit: 'Very high because the ad unit can be native commerce without touching the live answer.',
    trustPrimitive: 'Product matching, seller identity, and claim checks.',
    door: 'Commerce infrastructure for creator video and verified product graphs.',
    whyNow: 'Clip-led buying is growing fast while trust still lags behind the conversion.'
  },
  {
    slug: 'skilldrop',
    letter: '05',
    title: 'Ship Drops',
    category: 'Work + creator identity',
    role: 'Career surface',
    pitch: 'Turn projects, shipped work, and skill clips into social proof people actually want to follow.',
    viralHook: 'Ship drops, streak posts, and reputation cards.',
    monetization: 'Sponsored challenges, recruiting placements, and learning tools around the feed.',
    adFit: 'Strong if sponsors fund discovery, not scoring.',
    trustPrimitive: 'Shipped-work records, mentor signatures, and public credentials.',
    door: 'Portable reputation graphs and hiring infrastructure.',
    whyNow: 'Resumes are weak signals and AI makes fake portfolios easier than ever.'
  },
  {
    slug: 'careops',
    letter: '06',
    title: 'Care Circle',
    category: 'Family + care',
    role: 'Private circle',
    pitch: 'Turn care tasks, meds, visits, and family updates into one calm private layer instead of group-chat chaos.',
    viralHook: 'Private care updates, handoff cards, and check-in timelines.',
    monetization: 'Ad-light caregiver services and supplies on home surfaces only.',
    adFit: 'Low to medium because this surface should stay calm and private first.',
    trustPrimitive: 'Role permissions, handoff logs, and secure records in the background.',
    door: 'Remote family coordination and care logistics.',
    whyNow: 'Caregiving is exploding and the coordination burden is brutal.'
  },
  {
    slug: 'homeledger',
    letter: '07',
    title: 'Home Stream',
    category: 'Home + claims',
    role: 'Asset feed',
    pitch: 'Every repair, warranty, delivery, and claim becomes one living home stream you can search or share when needed.',
    viralHook: 'Repair timelines, claim cards, and value-saved posts.',
    monetization: 'Contractor, warranty, and home-services inventory beside timelines and search results.',
    adFit: 'High in marketplaces and explore feeds, off inside claim bundles.',
    trustPrimitive: 'Repair memory, contractor identity, and claim-ready export bundles.',
    door: 'Property ops, underwriting-grade condition data, and multi-home expansion.',
    whyNow: 'Homes are expensive and documentation is still scattered everywhere.'
  },
  {
    slug: 'civiccopilot',
    letter: '08',
    title: 'Paper Trail',
    category: 'Forms + life admin',
    role: 'Utility surface',
    pitch: 'Deadlines, filings, appointments, and disputes stop living in tabs and start living in one usable stream.',
    viralHook: 'Deadline cards, filed-it posts, and clean status updates.',
    monetization: 'Document, shipping, notary, and admin-service placements outside filing status cards.',
    adFit: 'Medium with hard rules around sensitivity and accuracy.',
    trustPrimitive: 'Submission memory, audit exports, and filing timelines.',
    door: 'Life-admin APIs for repetitive paperwork workflows.',
    whyNow: 'Bureaucracy still burns time, money, and attention at scale.'
  },
  {
    slug: 'passport',
    letter: '09',
    title: 'ID Layer',
    category: 'Identity + access',
    role: 'Background spine',
    pitch: 'Passkeys, consent, and device identity stay under the hood so the front of the app feels instant and social, not bureaucratic.',
    viralHook: 'Verified badges and lightweight ID marks that travel quietly across the app.',
    monetization: 'Minimal by design. The value comes from every other surface working better.',
    adFit: 'Low on purpose. This should stay almost invisible.',
    trustPrimitive: 'Passkeys, consent logs, device states, and quiet identity marks.',
    door: 'Cross-surface identity infrastructure for media, commerce, circles, and transactions.',
    whyNow: 'Synthetic identity, impersonation, and consent disputes make strong trust primitives more necessary than ever.'
  },
  {
    slug: 'movepilot',
    letter: '10',
    title: 'Move Mode',
    category: 'Relocation + life shifts',
    role: 'Transition surface',
    pitch: 'Moving, switching services, and changing life setups becomes one live transition stream instead of forty tabs and text threads.',
    viralHook: 'Move scorecards, checklist posts, and clean transition bundles.',
    monetization: 'Movers, utilities, and transition offers inside comparison surfaces and checklists.',
    adFit: 'Strong when ads are service comparisons instead of interruption units.',
    trustPrimitive: 'Provider verification, move memory, and condition bundles.',
    door: 'A larger transition OS for moves, newborns, job changes, and marriage shifts.',
    whyNow: 'Life transitions are still chaotic, expensive, and scam-prone.'
  }
];
const jeniPrimitives = [
  {
    title: 'Signal engine',
    body: 'Everything starts with one messy internet signal: a DM, clip, rumor, product, screenshot, link, or idea.'
  },
  {
    title: 'Memory layer',
    body: 'Jeni quietly keeps the timeline, receipts, and context in the background so every surface gets smarter over time.'
  },
  {
    title: 'Identity layer',
    body: 'Passkeys, consent, and device confidence stay under the hood so the front of the app can stay fast and social.'
  },
  {
    title: 'Action layer',
    body: 'Every read should end in a move: post it, send it, save it, shop it, share it, or keep it inside a circle.'
  }
];
const jeniRankings = [
  {
    title: 'Best feed starter',
    winner: 'Warning Feed',
    body: 'The signal is emotional, immediate, and social, which makes the first post naturally worth sharing.'
  },
  {
    title: 'Best share object',
    winner: 'Reality Remix',
    body: 'Remix cards belong in comments, stories, and group chats, which makes the output itself a distribution unit.'
  },
  {
    title: 'Strongest background layer',
    winner: 'ID Layer',
    body: 'Identity, consent, and device state quietly strengthen every surface without taking over the front-end story.'
  }
];
const jeniLaunchPath = [
  'Launch with Warning Feed, Reality Remix, and ID Layer.',
  'Turn the first useful read into a card people want to repost or keep.',
  'Keep the app free and place contextual ads only between actions, never inside the answer.',
  'Expand into the rest of life once the background engines compound.'
];
const jeniRevenueModels = [
  {
    title: 'Clean answer zones',
    body: 'Live reads, identity decisions, and sensitive surfaces never contain ads or sponsored ranking.',
    examples: 'Warning Feed results, Reality Remix cards, ID Layer decisions'
  },
  {
    title: 'Contextual social monetization',
    body: 'Use screen context and immediate intent before any coarse topic or partner logic enters the stack.',
    examples: 'After-result cards, Money Moves feed, Clip Market search'
  },
  {
    title: 'Direct sold and PMP later',
    body: 'Once the surfaces prove themselves, sell clean life-intent inventory to trusted partners instead of letting ad-tech define the vibe.',
    examples: 'Clip Market search, Ship Drops challenges, Move Mode comparisons'
  }
];
const jeniChannels = [
  'Short-form social built around warning cards, remix posts, drops, and circles.',
  'Comments, DMs, and group chats where people already ask what this thing is and what to do with it.',
  'App-store intent around social tools, creators, shopping, safety, clips, and identity.',
  'Creators, sellers, and partner brands once the output formats prove they spread.'
];
const jeniScoreLabels = {
  clarity: 'Clarity',
  trust: 'Signal Depth',
  cta: 'Money Lane',
  booking: 'Output Strength',
  seo: 'Spread Potential',
  mobile: 'Launch Speed'
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

function looksLikeUrlCandidate(value = '') {
  const raw = String(value || '').trim();

  if (!raw) {
    return false;
  }

  return /^https?:\/\//i.test(raw)
    || /^www\./i.test(raw)
    || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(raw);
}

function extractFirstUrlCandidate(value = '') {
  const raw = String(value || '').trim();

  if (!raw) {
    return '';
  }

  const direct = raw.match(/https?:\/\/[^\s]+/i);
  if (direct) {
    return direct[0];
  }

  const www = raw.match(/www\.[^\s]+/i);
  if (www) {
    return www[0];
  }

  const domain = raw.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?/i);
  return domain ? domain[0] : '';
}

function normalizeLooseUrl(value = '') {
  const raw = String(value || '').trim();

  if (!raw || !looksLikeUrlCandidate(raw)) {
    return raw;
  }

  try {
    const next = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    next.hash = '';
    return next.toString();
  } catch (error) {
    return raw;
  }
}

function buildIntakePrefill(input = {}) {
  const values = { ...input };
  const prompt = String(values.q || values.query || '').trim();

  if (prompt) {
    values.query = prompt;
  }

  if (!values.website && prompt) {
    const extracted = extractFirstUrlCandidate(prompt);
    if (extracted) {
      values.website = extracted;
    } else if (!values.notes) {
      values.notes = prompt;
    }
  }

  values.website = normalizeLooseUrl(values.website || '');
  values.facebook = normalizeLooseUrl(values.facebook || '');

  if (values.bookingSystem && looksLikeUrlCandidate(values.bookingSystem)) {
    values.bookingSystem = normalizeLooseUrl(values.bookingSystem);
  }

  return values;
}

function prepareIntakeSubmission(input = {}) {
  return buildIntakePrefill(input);
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
    'category-site': 'Category site',
    competitor: 'Competitor',
    'creator-brand': 'Creator brand',
    'market-article': 'Market article',
    custom: 'Other signal'
  };

  return labels[platform] || 'Other signal';
}

function normalizePlan(plan = 'Free') {
  const labels = {
    Free: 'Free',
    Plus: 'Plus',
    Family: 'Family',
    Business: 'Business',
    Starter: 'Free',
    Pro: 'Family',
    Operator: 'Family',
    'Done-With-You': 'Business',
    Concierge: 'Business'
  };

  return labels[plan] || 'Free';
}

function getPlanLabel(plan = 'Free') {
  const labels = {
    Free: 'Free',
    Plus: 'Plus',
    Family: 'Family',
    Business: 'Business',
    Starter: 'Free',
    Pro: 'Family',
    'Done-With-You': 'Business'
  };

  return labels[plan] || plan || 'Free';
}

function getPlanPaymentLink(plan = 'Free') {
  const label = getPlanLabel(plan);
  const map = {
    Plus: planPaymentLinks.Starter || '',
    Family: planPaymentLinks.Operator || '',
    Business: planPaymentLinks.Concierge || ''
  };
  return map[label] || '';
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
  const goal = client.goal || 'turn a trust problem into a verifiable product surface';
  const category = client.category || 'General trust surface';
  const sizeLabel = getBusinessSizeLabel(businessSize);
  const volumeLabel = getLeadVolumeLabel(leadVolume);
  const motionLabel = getSalesMotionLabel(salesMotion);
  const context = `${category} ${goal} ${client.notes || ''} ${client.mainServices || ''}`.toLowerCase();

  let engineName = 'Jeni Shield Surface';
  let responseTarget = 'Ship the first shareable receipt in 14 days';
  let offerAngle = 'turn trust failure into a signed artifact people naturally forward';
  let reviewTiming = 'Capture the first proof object right after the first clear user win';
  let primaryChannel = preferredChannel;
  let secondaryChannel = preferredChannel === 'email' ? 'sms' : 'email';
  let cadence = [
    'Capture the riskiest trust moment',
    'Explain it in plain English',
    'Generate the receipt',
    'Route it into a share loop'
  ];
  let launchSteps = [
    `Map the highest-stakes trust failure inside this ${sizeLabel.toLowerCase()} launch context.`,
    `Design the first artifact and move it through ${channelLabel(primaryChannel)} first, then support it with ${channelLabel(secondaryChannel)}.`,
    'Keep every action anchored to a signed receipt, verifier page, or proof object.'
  ];

  if (/(scam|fraud|impersonation|spoof|phish|shield|risk)/.test(context)) {
    engineName = 'Jeni Shield Surface';
    responseTarget = 'Flag the risk and issue a Scam Receipt in under 60 seconds';
    offerAngle = 'catch impersonation fast and turn the warning into something families can share';
    reviewTiming = 'Convert every saved incident into a clean learning loop and share artifact';
    primaryChannel = 'sms';
    secondaryChannel = 'email';
    cadence = [
      'Capture the suspicious message or caller',
      'Score the risk with explainable signals',
      'Generate a redacted Scam Receipt',
      'Share it with the family or team circle'
    ];
  } else if (/(bill|saving|subscription|wallet|spend|merchant|price)/.test(context)) {
    engineName = 'Jeni Wallet Surface';
    responseTarget = 'Turn the first savings win into a signed receipt this week';
    offerAngle = 'make recurring spend cleanup measurable, social, and hard to ignore';
    reviewTiming = 'Publish the monthly savings delta as proof, not just a chart';
    cadence = [
      'Detect the recurring spend pattern',
      'Propose the strongest cancellation or negotiation move',
      'Generate a Savings Receipt',
      'Stack the next monthly savings streak'
    ];
  } else if (/(truth|real|media|deepfake|provenance|clip|reality|verify)/.test(context)) {
    engineName = 'Jeni Truth Surface';
    responseTarget = 'Produce the first Reality Card in one pass';
    offerAngle = 'turn confusing media into clear, repostable trust evidence';
    reviewTiming = 'Reuse each verified Reality Card as a credibility flywheel';
    cadence = [
      'Ingest the clip, screenshot, or link',
      'Read provenance and manipulation signals',
      'Explain the confidence and limitations',
      'Publish a comment-ready Reality Card'
    ];
  } else if (/(care|med|appointment|family|health|medication|careops)/.test(context)) {
    engineName = 'Jeni CareOps Surface';
    responseTarget = 'Make the first handoff visible and auditable this week';
    offerAngle = 'replace chaotic coordination with signed care receipts and calmer family trust';
    reviewTiming = 'Use every completed task as proof that the system reduces conflict';
    cadence = [
      'Capture the schedule or medication event',
      'Log the handoff and completion',
      'Generate the care receipt',
      'Keep the family timeline clean and current'
    ];
  } else if (/(home|property|repair|claim|contractor|warranty)/.test(context)) {
    engineName = 'Jeni HomeLedger Surface';
    responseTarget = 'Make the first repair or claim pack verifier-ready';
    offerAngle = 'turn messy home history into a verified asset record';
    reviewTiming = 'Use every maintenance win as future claim and resale leverage';
    cadence = [
      'Capture the invoice, media, or warranty',
      'Bind it to the home timeline',
      'Generate the repair receipt',
      'Keep the claim pack ready'
    ];
  } else if (/(passport|identity|consent|passkey|credential|auth|verification)/.test(context)) {
    engineName = 'Jeni Passport Surface';
    responseTarget = 'Ship the first consent or identity receipt this week';
    offerAngle = 'turn identity, authorization, and device trust into portable proof across the rest of the app';
    reviewTiming = 'Use every verified action as the start of a stronger trust graph';
    cadence = [
      'Capture the identity or consent event',
      'Bind it to the right device or passkey',
      'Generate the signed consent receipt',
      'Keep the verifier state ready for other modules'
    ];
  } else if (/(move|moving|relocation|utility|address)/.test(context)) {
    engineName = 'Jeni MovePilot Surface';
    responseTarget = 'Finish the first switch or verification task this week';
    offerAngle = 'make every move step verifiable, cleaner, and less scam-prone';
    reviewTiming = 'Let each move receipt shrink the next moving decision';
    cadence = [
      'Capture the move timeline',
      'Verify providers and quotes',
      'Generate move receipts',
      'Close the transition with a ready archive'
    ];
  } else if (/(skill|work|portfolio|hire|mentor|apprentice)/.test(context)) {
    engineName = 'Jeni SkillDrop Surface';
    responseTarget = 'Ship one proof-of-skill card every week';
    offerAngle = 'turn shipped work into verifiable reputation instead of another resume bullet';
    reviewTiming = 'Use every shipped proof as a new compounding credential';
    cadence = [
      'Capture the shipped work',
      'Bind reviews or mentor proof',
      'Issue the Skill Credential',
      'Push the clip into the portfolio graph'
    ];
  }

  if (leadVolume === 'surging' || leadVolume === 'high') {
    launchSteps[0] = `Design the first Jeni surface for a ${volumeLabel.toLowerCase()} environment where proof has to move fast.`;
  }

  if (businessSize === 'multi-location' || businessSize === 'enterprise') {
    launchSteps[1] = `Standardize the ${engineName.toLowerCase()} across teams, devices, and approvers without losing chain-of-custody.`;
  }

  const automationFocus = [
    `${sizeLabel} profile`,
    engineName,
    volumeLabel,
    `${channelLabel(primaryChannel)}-first artifact`
  ];

  const summary = `${brand.algorithmName} read this signal as a ${sizeLabel.toLowerCase()} launch context with ${volumeLabel.toLowerCase()}. That means the first priority is to ${offerAngle}.`;

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
    businessName: input.businessName || 'Jeni Preview',
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
    previewSummary: `Jeni would search ${location}, verify ${targetLabel.toLowerCase()} quality automatically, then move the strongest results into a ${base.engineName.toLowerCase()} workflow.`
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
    return `Hi ${owner}, quick follow-up for ${businessName}. Jeni mapped your business to the ${blueprint.engineName}, which means the biggest win is to ${blueprint.offerAngle}. If you want, I can send the recommended next steps today.`;
  }

  return `Hi ${owner},

I wanted to follow up on ${businessName} and the goal around ${goal}. Jeni mapped the business to a ${blueprint.motionLabel.toLowerCase()} workflow, and the biggest opportunity right now is to ${blueprint.offerAngle}.

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
    `Detected Jeni engine: ${blueprint.engineName}.`,
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
  const pageClass = currentPath === '/'
    ? 'page-home'
    : `page-${currentPath.replaceAll('/', ' ').trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'default'}`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: brand.name,
    serviceType: 'AI social operating system',
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
      <meta property="og:image" content="https://zumi.onrender.com/jeni-aurora.svg" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${safeTitle}" />
      <meta name="twitter:description" content="${escapeHtml(brand.metaDescription)}" />
      <title>${safeTitle}</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/styles.css" />
      <script type="application/ld+json">${JSON.stringify(schema)}</script>
      <script src="/app.js" defer></script>
    </head>
    <body class="app-body ${pageClass}">
      <header class="site-header">
        <div class="container">
          <div class="nav-shell app-topbar">
            <a class="brand" href="/">
              <img class="brand-logo" src="/logo-mark.svg" alt="${brand.name} logo" />
              <span class="brand-copy">
                <strong>${brand.name}</strong>
                <small>${escapeHtml(brand.slogan)}</small>
              </span>
            </a>
            <div class="nav-main">
              <nav class="nav-links">
                ${navLink('/', 'Feed', currentPath)}
                ${navLink('/intake', 'Drop', currentPath)}
                ${navLink('/case-studies', 'Surfaces', currentPath)}
                ${navLink('/how-it-works', 'Engine', currentPath)}
                ${navLink('/pricing', 'Free', currentPath)}
              </nav>
              <a class="btn nav-cta" href="/intake">Start a Drop</a>
            </div>
          </div>
        </div>
      </header>
      <main>
        <div class="container">${content}</div>
      </main>
      <nav class="bottom-dock" aria-label="Primary">
        <a class="dock-link${currentPath === '/' ? ' active' : ''}" href="/">
          <span>Feed</span>
        </a>
        <a class="dock-link${currentPath === '/intake' ? ' active' : ''}" href="/intake">
          <span>Drop</span>
        </a>
        <a class="dock-link${currentPath === '/case-studies' ? ' active' : ''}" href="/case-studies">
          <span>Surfaces</span>
        </a>
        <a class="dock-link${currentPath === '/pricing' ? ' active' : ''}" href="/pricing">
          <span>Free</span>
        </a>
      </nav>
      <footer>
        <div class="container footer-shell">
          <div>
            <strong>${brand.name}</strong>
            <span>Free social signal reads, clean answers, ads after the useful move.</span>
          </div>
          <nav class="footer-links">
            <a href="/intake">Start a Drop</a>
            <a href="/case-studies">Surfaces</a>
            <a href="/how-it-works">Engine</a>
            <a href="/pricing">Free</a>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
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
      <p class="muted">Use Jeni for inquiry follow-up, missed-call recovery, reactivation, review requests, consult nudges, and booking reminders without losing the premium tone.</p>
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
    <section class="entry-hero entry-hero-minimal">
      <div class="entry-shell entry-shell-minimal entry-shell-plain">
        <p class="section-label">Jeni // Social Signal App</p>
        <h1>Drop anything. Jeni turns it into the right post, move, or money lane.</h1>
        <p class="lede">A DM. A clip. A screenshot. A product. A rumor. An idea. Jeni reads the signal live, decides what surface it belongs in, and builds the card, action, circle update, or next move for you.</p>
        <form class="entry-search live-composer" method="GET" action="/intake" data-live-check-form>
          <input name="q" type="text" placeholder="Paste a message, link, profile, offer, rumor, clip, or idea" aria-label="Signal prompt" autocomplete="off" />
          <input type="hidden" name="scanConsent" value="yes" />
          <input type="hidden" name="goal" value="Figure out the best move" />
          <input type="hidden" name="category" value="General internet signal" />
          <input type="hidden" name="plan" value="Free" />
          <button class="btn" type="submit">Drop It</button>
        </form>
        <div class="entry-suggestions entry-usage">
          <span class="pill">turn this into a post</span>
          <span class="pill">what do I do with this?</span>
          <span class="pill">is this worth sharing?</span>
          <span class="pill">shop this clip</span>
          <span class="pill">break this down</span>
        </div>
        <p class="entry-microcopy">Free to use. Ads show between useful moves, never inside the answer. The heavy engines stay in the background.</p>
      </div>
    </section>

    <section class="section live-check-section" data-live-check-section hidden>
      <article class="card live-check-shell">
        <div class="live-check-top">
          <div>
            <p class="section-label">Live Check</p>
            <h2>Jeni stays on this page and works it out live.</h2>
          </div>
          <div class="mini-proof">
            <span class="pill" data-live-status-pill>Queued</span>
            <span class="pill" data-live-source-pill>Waiting for signal</span>
          </div>
        </div>

        <div class="live-chat">
          <article class="live-bubble live-bubble-user" data-live-user hidden>
            <p class="kicker">You</p>
            <p class="live-bubble-text" data-live-user-text></p>
          </article>

          <article class="live-bubble live-bubble-ai">
            <p class="kicker">Jeni</p>
            <div class="live-thinking" data-live-thinking>
              <div class="thinking-dots" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <p class="live-progress-copy" data-live-progress>Paste something and Jeni will start thinking here.</p>
              <ul class="live-step-list" data-live-step-list>
                <li class="live-step" data-step="queued">Read what you pasted</li>
                <li class="live-step" data-step="scanning">Sort the signal and patterns</li>
                <li class="live-step" data-step="analyzing">Build the best surface and next move</li>
                <li class="live-step" data-step="completed">Return the card, action, and memory trail</li>
              </ul>
            </div>
          </article>
        </div>

        <div class="live-results-render" data-live-results hidden></div>
        <p class="inline-note" data-live-error hidden></p>
      </article>
    </section>

    <section class="section compact-section">
      <div class="feature-grid feature-grid-tight home-plain-grid">
        <article class="card concept-card">
          <p class="kicker">1. Drop the signal</p>
          <h3>Bring in the thing the internet threw at you.</h3>
          <p class="muted">A message, clip, link, profile, product page, screenshot, or random thought. Raw domains work. You do not need to clean it up first.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">2. Watch Jeni sort it</p>
          <h3>It figures out the right surface live.</h3>
          <p class="muted">Not just an answer. Jeni decides whether this should become a warning, a remix, a shop card, a circle update, a save, or a next move.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">3. Get the output</p>
          <h3>A post, card, action, or memory trail shows up fast.</h3>
          <p class="muted">That is what makes it feel like social media on the front. The receipts, identity, and memory layer are still there, just not screaming in your face.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="page-head">
        <div>
          <p class="section-label">Who This Is For</p>
          <h2>People who want one app for the whole messy internet.</h2>
        </div>
        <p class="muted">Jeni is for the exact moment you need to decide what something is, what to do with it, who to send it to, and whether it can turn into a post, purchase, save, or move.</p>
      </div>
      <div class="grid-3">
        <article class="card concept-card">
          <p class="kicker">Creators + culture hunters</p>
          <h3>People living in clips, screenshots, and fast-moving posts.</h3>
          <p class="muted">The app should help them break things down, remix them, shop them, and turn them into cleaner social objects fast.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Sellers + operators</p>
          <h3>People turning internet attention into money.</h3>
          <p class="muted">Use Jeni to sort leads, spot weird behavior, find the angle, turn posts into shop moments, and keep the business side moving.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Friend groups + circles</p>
          <h3>People who already use chat as their operating system.</h3>
          <p class="muted">Warnings, care updates, rumors, shopping finds, move plans, and “what is this?” moments should all be able to land in one shared flow.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card home-plain-callout">
          <p class="kicker">What The Bigger App Becomes</p>
          <h3>Social on the front. Engines in the back.</h3>
          <p class="muted">The visible product is a feed, a drop flow, a shop layer, private circles, and creator-style surfaces. In the background Jeni is still running safety, identity, memory, and action logic.</p>
        </article>
        <article class="card home-plain-callout">
          <p class="kicker">Money Model</p>
          <h3>You wanted ads so you do not have to charge.</h3>
          <p class="muted">That is still the model, but now it belongs to a social app. Ads sit between moves, inside browse moments, and around explicit shopping or search surfaces. Never inside the live answer.</p>
          <div class="actions">
            <a class="btn" href="/intake">Start a Drop</a>
            <a class="btn secondary" href="/pricing">See the Free Model</a>
          </div>
        </article>
      </div>
    </section>

    <section class="section compact-section">
      <div class="feature-grid feature-grid-tight">
        <article class="card concept-card">
          <p class="kicker">Front door</p>
          <h3>Warning Feed, Reality Remix, and ID Layer open the system.</h3>
          <p class="muted">Start with the surfaces that naturally spread, then let the rest of the app stack on top once the feed formats click.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Live system</p>
          <h3>${escapeHtml(String(Math.max(clients.length, 10)))} live drops run</h3>
          <p class="muted">Every drop looks for the best surface, the cleanest output, the right money lane, and the background engine it should wake up.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Build the bigger picture</p>
          <h3>Once the outputs spread, the whole app starts to make sense.</h3>
          <p class="muted">That is how this becomes more than an AI tool. It becomes a real social product with money, circles, shopping, memory, and identity running under the hood.</p>
        </article>
      </div>
      <div class="actions" style="justify-content: center; margin-top: 18px;">
        <a class="btn secondary" href="/case-studies">See the Surfaces</a>
      </div>
    </section>
  `;

  return layout(brand.name, content, '/');
}

function caseStudiesPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Surfaces</p>
        <h2>Ten social surfaces, one background engine.</h2>
      </div>
      <p class="muted">Jeni should feel like one social app on the front. In the back it is still running safety, identity, memory, money, and action logic to decide what each signal should become.</p>
    </section>
    <section class="grid-3">
      ${jeniFeatures.map((concept) => `
        <article class="card concept-card" id="${escapeHtml(concept.slug)}">
          <p class="kicker">Surface ${escapeHtml(concept.letter)}</p>
          <h3>${escapeHtml(concept.title)}</h3>
          <p class="muted">${escapeHtml(concept.pitch)}</p>
          <div class="mini-proof">
            <span class="pill">${escapeHtml(concept.category)}</span>
            <span class="pill">${escapeHtml(concept.role)}</span>
          </div>
          <ul class="list-clean">
            <li><strong>Share format:</strong> ${escapeHtml(concept.viralHook)}</li>
            <li><strong>Background engine:</strong> ${escapeHtml(concept.trustPrimitive)}</li>
            <li><strong>Ad lane:</strong> ${escapeHtml(concept.adFit)}</li>
            <li><strong>Money model:</strong> ${escapeHtml(concept.monetization)}</li>
            <li><strong>Expansion path:</strong> ${escapeHtml(concept.door)}</li>
          </ul>
        </article>
      `).join('')}
    </section>
    <section class="card" style="margin-top: 24px;">
      <p class="kicker">Opening stack</p>
      <h3>Warning Feed, Reality Remix, and ID Layer make the whole app feel social first.</h3>
      <p class="muted">The front of the product should spread through cards, remixes, drops, and circles. The heavy safety, identity, and memory logic can stay mostly invisible underneath.</p>
      <div class="actions">
        <a class="btn" href="/shield">See the First Surface</a>
        <a class="btn secondary" href="/how-it-works">See the Engine</a>
      </div>
    </section>
  `;

  return layout('Surfaces', content, '/case-studies');
}

function solutionsPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Background Layers</p>
        <h2>Four layers making the social app feel magical without turning the front-end into enterprise sludge.</h2>
      </div>
      <p class="muted">The surfaces can change fast, but the background system still needs memory, identity, safety, and monetization rules so the product feels fast on the front and solid underneath.</p>
    </section>
    <section class="grid-3">
      ${[
        {
          kicker: '01',
          title: 'ID layer',
          body: 'Passkeys, consent, and device state stay mostly invisible so every surface can feel instant and safe.'
        },
        {
          kicker: '02',
          title: 'Memory layer',
          body: 'Every drop leaves behind usable memory so the app can remember context, save outputs, and build better next moves.'
        },
        {
          kicker: '03',
          title: 'Signal engine',
          body: 'Clips, rumors, products, DMs, and links all pass through one engine that decides what the signal should become.'
        },
        {
          kicker: '04',
          title: 'Money boundary',
          body: 'Ads, partner cards, and shopping units live around actions and browse moments, never inside the live answer itself.'
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
          <h3>The output has to feel better than the raw mess people started with.</h3>
          <p class="muted">If Jeni does not turn chaos into something cleaner, faster, and more social, then it is still acting like a tool demo instead of a product.</p>
        </article>
        <article class="card">
          <p class="kicker">Money boundary</p>
          <h3>Ads can live around the workflow, never inside the answer.</h3>
          <p class="muted">That one rule keeps the app free without making the live read feel bought, manipulated, or gross.</p>
          <div class="actions">
            <a class="btn" href="/intake">Start a Drop</a>
            <a class="btn secondary" href="/convert">See the Money Model</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Background Layers', content, '/solutions');
}

function solutionPage(item) {
  const content = `
    <section class="card empty-state">
      <p class="section-label">Surface</p>
      <h2>${escapeHtml(item.label)}</h2>
      <p class="muted">This older route is now secondary to the social-first Jeni product. Start with a live drop, then use Surfaces to see how the front-end system expands.</p>
      <div class="actions" style="justify-content: center;">
        <a class="btn" href="/intake">Start a Drop</a>
        <a class="btn secondary" href="/solutions">See Background Layers</a>
      </div>
    </section>
  `;

  return layout(item.label, content, solutionHref(item.slug));
}

function pricingPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Free Feed</p>
        <h2>The app stays free because the ads live around the action, not inside the answer.</h2>
        <p class="muted">Jeni should feel like a beautiful social product first. The business model only works if the live read stays clean and the monetization sits in browse moments, next steps, and feed-style surfaces.</p>
        <div class="mini-proof">
          <span class="pill">Contextual first</span>
          <span class="pill">Answer-zone clean</span>
          <span class="pill">Feed-native</span>
        </div>
      </article>
      <article class="card art-panel">
        <p class="kicker">Hard rules</p>
        <h3>No sponsored answers. No paid boosts inside live reads. No pay-to-look-safe gimmicks.</h3>
        <p class="muted">Jeni only wins if the useful part feels untouched by the ad market sitting around it.</p>
      </article>
    </section>
    <section class="grid-3">
      ${[
        { title: 'After-result cards', body: 'The cleanest inventory appears after a good read, when the user wants the next move and the answer already landed.' },
        { title: 'Feed placements', body: 'Money Moves, Home Stream, and Ship Drops can support native feed ads between cards, never inside the live answer.' },
        { title: 'Search placements', body: 'Clip Market and Home Stream can run clearly labeled sponsored results when the user is already browsing or comparing.' },
        { title: 'Direct-sold later', body: 'As the surfaces prove themselves, Jeni can sell clean social intent inventory directly instead of letting the ad stack define the whole vibe.' }
      ].map((plan, index) => `
        <article class="card plan-card${index === 0 ? ' featured-plan' : ''}">
          <p class="kicker">Layer</p>
          <h3>${escapeHtml(plan.title)}</h3>
          <p class="muted">${escapeHtml(plan.body)}</p>
        </article>
      `).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">How the app makes money</p>
          <h3>The money model follows the surface, not the other way around.</h3>
          <ul class="list-clean">
            ${jeniRevenueModels.map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.body)}</li>`).join('')}
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Distribution</p>
          <h3>The output itself has to spread.</h3>
          <ul class="list-clean">
            ${jeniChannels.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          <div class="actions">
            <a class="btn" href="/convert">See the Ad Model</a>
            <a class="btn secondary" href="/intake">Start a Drop</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Free Forever', content, '/pricing');
}

function howItWorksPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Engine</p>
        <h2>Drop the signal. Sort the surface. Wake the right engine.</h2>
        <p class="muted">Jeni should feel like a social app on the front, but underneath it still needs a serious engine deciding what the signal is, where it belongs, and what action should come next.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start a Drop</a>
          <a class="btn secondary" href="/operator-architecture">See the Engine Map</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni signal engine showing drops, surfaces, cards, and background layers." />
        </div>
      </article>
    </section>
    <section class="feature-grid">
      ${[
        {
          title: 'Read the signal',
          body: 'A link, screenshot, clip, document, message, or plain text prompt enters the system and gets compressed into the useful parts.'
        },
        {
          title: 'Pick the surface',
          body: 'Jeni decides whether this belongs in a warning feed, remix card, shop lane, private circle, money move, or life-admin stream.'
        },
        {
          title: 'Build the output',
          body: 'The result becomes a card, post, action, save, share object, or memory trail the user can actually use.'
        },
        {
          title: 'Keep the money lane separate',
          body: 'Only after the useful part lands can Jeni place contextual inventory around the workflow, never inside the live answer itself.'
        }
      ].map((item, index) => `
        <article class="card">
          <p class="kicker">0${index + 1}</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="muted">${escapeHtml(item.body)}</p>
        </article>
      `).join('')}
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">What enters</p>
        <h3>DMs, clips, products, rumors, documents, and social context.</h3>
        <p class="muted">Jeni is not limited to one category because the input is always the same basic thing: a messy signal from the internet or real life.</p>
      </article>
      <article class="card">
        <p class="kicker">Output</p>
        <h3>Posts, cards, actions, and background memory.</h3>
        <p class="muted">The goal is not just a read. It is a cleaner social object, a next move, and a background trail that makes the app smarter over time.</p>
      </article>
    </section>
  `;

  return layout('Engine', content, '/how-it-works');
}

function discoverPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Spread</p>
        <h2>Jeni grows when the output looks like something people already want to send.</h2>
        <p class="muted">Warning cards, remix posts, shop finds, private-circle updates, and saved moves should all feel native to the way people already communicate online.</p>
        <div class="mini-proof">
          <span class="pill">Comments</span>
          <span class="pill">Group chats</span>
          <span class="pill">Stories</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-aurora.svg" alt="Jeni surface map connecting warnings, remixes, shopping, circles, money, care, and identity." />
        </div>
      </article>
    </section>
    <section class="grid-3">${[
      'Warning cards people send to friends the second a DM looks weird.',
      'Reality remix posts that belong directly inside comments and stories.',
      'Money Moves that turn cleanup, savings, and price wins into shareable flexes.',
      'Care Circle updates that replace frantic family group-chat catch-up.',
      'Home Stream timelines that make fixes, claims, and purchases easy to resend.',
      'Ship Drops and dupe cards that creators repost because they actually look cool.'
    ].map((item) => `
      <article class="card">
        <p class="kicker">Spread loop</p>
        <h3>${escapeHtml(item)}</h3>
        <p class="muted">If the output already fits how people communicate, growth can ride the product instead of depending on awkward referral mechanics.</p>
      </article>
    `).join('')}</section>
  `;

  return layout('Spread', content, '/discover');
}

function verifyPage() {
  const cards = [
    {
      name: 'Signal checks',
      headline: 'Jeni should explain what feels off without pretending every read is absolute.',
      body: 'Good products show what they noticed, how strong the signal is, and what the user should do next.'
    },
    {
      name: 'Memory trail',
      headline: 'When details matter later, Jeni still keeps the useful trail in the background.',
      body: 'That lets the front-end stay fun while the system keeps enough context to support sharing, saving, or following up.'
    },
    {
      name: 'Clarity',
      headline: 'The result should feel like a smart friend translated the internet for you.',
      body: 'Short, plain-English reads beat jargon and fake certainty every time.'
    },
    {
      name: 'Clean answer zones',
      headline: 'The live answer stays unsponsored even when the app is free.',
      body: 'That line is what lets a social product stay useful instead of feeling like one long ad unit.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Answer Quality</p>
        <h2>Social AI products fail when the answer feels fake, vague, or bought.</h2>
        <p class="muted">Jeni works when the read feels sharp, calm, and useful enough to act on fast without pretending it knows everything.</p>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni answer system showing signal checks, surface selection, and clean output states." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Answer Quality', content, '/verify');
}

function convertPage() {
  const cards = [
    {
      name: 'Contextual first',
      headline: 'The current module and screen do most of the monetization work.',
      body: 'Jeni can stay useful and privacy-conscious when ad decisions begin with screen context, not invasive tracking.'
    },
    {
      name: 'Protected zones',
      headline: 'Receipts, verifier pages, identity decisions, and emergency flows stay ad-free.',
      body: 'That single product rule protects trust better than any slogan on a landing page.'
    },
    {
      name: 'Direct sold later',
      headline: 'Once the modules prove demand, sell clean life-intent inventory directly.',
      body: 'The long-term upside is not noisy ad-tech dependence. It is high-trust inventory across safety, money, home, work, and care.'
    },
    {
      name: 'Measurement',
      headline: 'Use privacy-preserving attribution and aggregate reporting wherever possible.',
      body: 'Jeni should prefer consent signals, contextual performance, and aggregate measurement over user-level surveillance.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Ad Model</p>
        <h2>Free product. Strong taste. Clean monetization.</h2>
        <p class="muted">Jeni makes money with contextual placements, browse surfaces, and direct relationships that do not corrupt the live answer.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start a Drop</a>
          <a class="btn secondary" href="/pricing">See How Jeni Stays Free</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-aurora.svg" alt="Jeni revenue map showing surfaces, browse moments, and contextual monetization lanes." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Ad Model', content, '/convert');
}

function industriesPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Opening Surfaces</p>
        <h2>Warning Feed, Reality Remix, and ID Layer are the opening move.</h2>
        <p class="muted">Those three surfaces give Jeni urgency, shareability, and a believable background spine. The rest open up once the first formats start spreading.</p>
      </article>
      <article class="card art-panel">
        <p class="kicker">Common thread</p>
        <h3>Every surface is a different face of the same background engine.</h3>
        <p class="muted">Identity, memory, safety checks, and monetization rules stay steady even when the front-end shifts from warnings to shopping, care, or life admin.</p>
      </article>
    </section>
    <section class="grid-3">${[
      { label: 'Warnings + safety', body: 'Weird DMs, spoofing, suspicious links, and friend-group alerts.' },
      { label: 'Money + cleanup', body: 'Subscriptions, price drops, recurring charges, and savings moves.' },
      { label: 'Media + remixes', body: 'Clips, screenshots, rumors, reactions, and comment-ready breakdowns.' },
      { label: 'Care + circles', body: 'Appointments, meds, check-ins, private updates, and handoff trails.' },
      { label: 'Home + ownership', body: 'Repairs, claims, warranties, contractors, and living home streams.' },
      { label: 'Paper + life admin', body: 'Forms, deadlines, filings, appointments, and personal paper trails.' },
      { label: 'Identity + access', body: 'Passkeys, verified states, consent, and quiet background identity.' },
      { label: 'Commerce + creators', body: 'Product matches, dupe cards, creator shop lanes, and buying context.' },
      { label: 'Work + ship mode', body: 'Projects, shipped work, reputation cards, and follow-worthy progress.' },
      { label: 'Moves + transitions', body: 'Service switching, checklists, relocation, and life-change flows.' }
    ].map(renderIndustryCard).join('')}</section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Flagship wedge</p>
          <h3>Warning Feed gives Jeni the cleanest first motion.</h3>
          <p class="muted">Weird DMs and suspicious links are immediate, emotional, and social, which makes the first useful format easy to understand and easy to share.</p>
          <div class="actions">
            <a class="btn" href="/shield">See Warning Feed</a>
            <a class="btn secondary" href="/pricing">See How It Stays Free</a>
          </div>
        </article>
        <article class="card">
          <p class="kicker">Share loop</p>
          <h3>The strongest use cases come with their own native format.</h3>
          <p class="muted">Warnings, remixes, shop cards, care updates, and shipped-work drops travel better than generic referral asks.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Front Door', content, '/industries');
}

function medSpaPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Warning Feed</p>
        <h2>The first Jeni surface: turn weird internet moments into warning posts people actually send.</h2>
        <p class="muted">Warning Feed reads texts, links, screenshots, emails, and suspicious voice moments, then turns them into clean cards you can save, send, or drop into a circle without making the experience feel heavy.</p>
        <div class="mini-proof">
          <span class="pill">Urgent pain</span>
          <span class="pill">Free front door</span>
          <span class="pill">Native viral loop</span>
        </div>
        <div class="actions">
          <a class="btn" href="/intake">Run a Warning Read</a>
          <a class="btn secondary" href="/how-it-works">See the Engine</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni Warning Feed showing suspicious message analysis, clean warning cards, and circle-ready output." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Why this first</p>
          <h2>The first surface should solve a social problem people already feel in their stomach.</h2>
        </div>
        <p class="muted">Warning Feed is strong because it helps in the exact moment something feels off, and the output is naturally worth sharing with friends, family, or a group chat.</p>
      </div>
      <div class="feature-grid">${[
        'Suspicious messages create instant emotional urgency.',
        'Warning cards create the product loop and the growth loop at the same time.',
        'Safety next steps can monetize the surface without touching the live answer.',
        'The same engine can later support circles, business safety, and creator tools.'
      ].map((item) => `
        <article class="card">
          <p class="kicker">Why it works</p>
          <h3>${escapeHtml(item)}</h3>
          <p class="muted">That makes the first product emotionally legible and commercially clean.</p>
        </article>
      `).join('')}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">What it includes</p>
          <h2>A Phase 1 surface set that already feels useful and social.</h2>
        </div>
        <p class="muted">Even as the first surface, Warning Feed should already feel like a category-defining social utility product.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Capture</p>
          <h3>Drop anything suspicious</h3>
          <p class="muted">Links, screenshots, emails, messages, and clips should all flow into the same engine.</p>
        </article>
        <article class="card">
          <p class="kicker">Explain</p>
          <h3>Show the signals in regular people language</h3>
          <p class="muted">Users should understand why the risk feels high without reading technical nonsense.</p>
        </article>
        <article class="card">
          <p class="kicker">Share</p>
          <h3>Generate a warning card</h3>
          <p class="muted">The card is clean, safe to send, and ready for a story, circle, or support workflow.</p>
        </article>
        <article class="card">
          <p class="kicker">Protect</p>
          <h3>Run circles and allowlists</h3>
          <p class="muted">Protection gets stronger when the people around the user are part of the loop too.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <article class="card">
        <p class="section-label">Expansion door</p>
        <h2>Warning Feed is not the whole company. It is the first surface proving the social engine works.</h2>
        <p class="muted">Once people use Jeni for weird messages and warnings, the same system can expand into Reality Remix, Money Moves, Care Circle, Home Stream, and ID Layer flows.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start a Drop</a>
          <a class="btn secondary" href="/case-studies">See All Surfaces</a>
        </div>
      </article>
    </section>
  `;

  return layout('Warning Feed', content, '/shield');
}

function operatorArchitecturePage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Signal Engine</p>
        <h2>The simple version of how Jeni thinks.</h2>
        <p class="muted">Read a messy source, compress the useful clues, decide the best surface, then return an output sharp enough to act on or share.</p>
        <div class="mini-proof">
          <span class="pill">Reader</span>
          <span class="pill">Surface picker</span>
          <span class="pill">Output logic</span>
          <span class="pill">Policy layer</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni architecture showing signal intake, surface selection, cards, and background layers." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Modules</p>
          <h2>Three clean layers.</h2>
        </div>
        <p class="muted">The product stays believable because each layer does one clean job.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">1</p>
          <h3>Read</h3>
          <p class="muted">Fetch the source, keep only the useful parts, and extract the strongest clues.</p>
        </article>
        <article class="card">
          <p class="kicker">2</p>
          <h3>Sort</h3>
          <p class="muted">Judge urgency, spread potential, money lane, output strength, and which surface should wake up first.</p>
        </article>
        <article class="card">
          <p class="kicker">3</p>
          <h3>Return</h3>
          <p class="muted">Return a sharper read, a usable output, a safe monetization lane, and the next obvious move.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Output standard</p>
          <h3>It should feel like a polished social product, not a brainstorm dump.</h3>
          <p class="muted">The finished output needs to be useful immediately, with enough clarity to guide a real move or share decision.</p>
        </article>
        <article class="card">
          <p class="kicker">Reality</p>
          <h3>A beautiful interface cannot save a weak product idea.</h3>
          <p class="muted">The pain, output format, money boundary, and background engine still have to survive real-world pressure.</p>
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
        <p class="section-label">About Jeni</p>
        <h2>Jeni is a free social signal app for the AI era.</h2>
        <p class="muted">It exists for people whose whole life is already happening through clips, DMs, screenshots, search, shopping, and group chats. The point is to turn that chaos into cleaner social objects and better moves without charging upfront.</p>
        <div class="mini-proof">
          <span class="pill">Feed</span>
          <span class="pill">Circles</span>
          <span class="pill">Shops</span>
          <span class="pill">Free</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-aurora.svg" alt="Jeni trust universe connecting scams, media, money, care, home, work, and identity." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">What it is</p>
          <h3>A social operating system for internet signals.</h3>
          <p class="muted">Jeni reads one messy thing and turns it into the right post, card, action, memory trail, or money lane.</p>
        </article>
        <article class="card">
          <p class="kicker">Who it helps</p>
          <h3>Creators, shoppers, sellers, friend groups, founders, and families.</h3>
          <p class="muted">Especially people who need one place to figure out what something is and what to do with it next.</p>
        </article>
        <article class="card">
          <p class="kicker">Why it exists</p>
          <h3>Because people already use chat and social as their operating system.</h3>
          <p class="muted">The hard part is not posting more. The hard part is sorting signals, deciding what matters, and moving fast without chaos.</p>
        </article>
        <article class="card">
          <p class="kicker">How it works</p>
          <h3>Read, sort, render, remember, then place the money layer around it.</h3>
          <p class="muted">The engine reads the source, picks the best surface, returns a stronger move, and keeps the monetization lane separate from the useful part.</p>
        </article>
        <article class="card">
          <p class="kicker">What makes it different</p>
          <h3>It combines social behavior, AI sorting, and background engines in one product.</h3>
          <p class="muted">A Jeni surface only counts if it feels fun and native on the front while still getting smarter, safer, and more useful in the background.</p>
        </article>
        <article class="card">
          <p class="kicker">The standard</p>
          <h3>It should feel fast, addictive, useful, and surprisingly smart.</h3>
          <p class="muted">That is the bar for the design, the feed formats, the live results, and the way monetization stays out of the wrong places.</p>
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
      <p class="muted">Jeni only needs the information required to read submitted sources, generate live reads, and support the product safely. Ads stay contextual by default and outside the answer zone.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What Jeni may collect</p>
        <ul class="list-clean">
          <li>Business contact details from intake.</li>
          <li>Public page content and structure needed for live reads.</li>
          <li>Output history, saved notes, and queue history.</li>
          <li>Operational data required to support the app safely.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">How it is used</p>
        <ul class="list-clean">
          <li>To run live reads and generate structured outputs.</li>
          <li>To improve product quality, queue handling, and support.</li>
          <li>To maintain product security and reasonable operational logs.</li>
          <li>To support contextual monetization that does not use the answer itself as ad targeting input.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">Your control</p>
        <p class="muted">You can request deletion or correction of stored records, and the product should keep data collection narrower than the feature set actually requires. Jeni should honor opt-outs and keep sensitive flows ad-light or ad-free.</p>
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
      <p class="muted">Jeni prepares live reads and product outputs. The user still controls how those outputs get used in the real world, and ads never buy a better result.</p>
    </section>
    <section class="feature-grid">
      <article class="card">
        <p class="kicker">User responsibility</p>
        <h3>You are responsible for how you use the output.</h3>
        <p class="muted">Jeni can generate reads, cards, and recommendations, but it does not assume legal or commercial responsibility for a user’s final decisions.</p>
      </article>
      <article class="card">
        <p class="kicker">Content responsibility</p>
        <h3>AI output is draft material, not unquestionable truth.</h3>
        <p class="muted">Product, legal, and market claims still need real-world review before they become public or commercialized.</p>
      </article>
      <article class="card">
        <p class="kicker">Service limits</p>
        <h3>Jeni should be used honestly and within platform rules.</h3>
        <p class="muted">No unsupported scraping promises, no deceptive claims, no sponsored verification, and no pretending the product has permissions it does not actually have.</p>
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
        <h2>Submitted sources should be intentional and permission-safe.</h2>
        <p class="muted">Jeni is designed to work from public, signal-rich sources and lightweight user-submitted context. If deeper access ever arrives later, it should stay explicit and narrow.</p>
        <div class="mini-proof">
          <span class="pill">Signal-first</span>
          <span class="pill">Public-data lean</span>
          <span class="pill">No false permissions</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni authorization layer showing signal-first, public-data-first scanning." />
        </div>
      </article>
    </section>

    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What you approve</p>
        <p class="muted">You confirm that you can share the source or market signal and that Jeni may analyze public information from it to produce a live read.</p>
      </article>
      <article class="card">
        <p class="kicker">What does not happen</p>
        <p class="muted">Jeni does not claim hidden access, silent integrations, or unsupported permissions. If future deeper connectors appear, they should be explicit and revocable.</p>
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

function intakePage(selectedPlan = 'Free', values = {}, errorMessage = '') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Signal Drop</p>
        <h2>Give Jeni one clean signal.</h2>
      </div>
      <p class="muted">You can arrive with a thought, a link, or a loose domain. Jeni will normalize the source, read the signal, and return the clearest surface, output, and money lane.</p>
    </section>
    <section class="detail-grid" style="margin-bottom: 18px;">
      <article class="card">
        <p class="kicker">What happens next</p>
        <h3>Read. Sort. Return the best surface.</h3>
        <p class="muted">Jeni reads the source, maps the signal, then shows the clearest next move, best front-door surface, and safest monetization boundary without making the flow feel heavy.</p>
      </article>
      <article class="card">
        <p class="kicker">Low friction</p>
        <h3>A link helps, but a plain-language prompt can work too.</h3>
        <p class="muted">Domain-only works. <code>brand.com</code> is enough. If you do not have a link yet, tell Jeni what feels off and it can still start from the signal.</p>
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
            <h3>Prompt first</h3>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="query">What do you want Jeni to figure out?</label>
              <input id="query" name="query" placeholder="Write anything. Example: what do I do with this, break this down, or where does the money live?" value="${escapeHtml(values.query || '')}" />
            </div>
            <div class="field">
              <label for="website">Link or domain</label>
              <input id="website" name="website" data-url-normalize placeholder="example.com, article, product page, scam link, or brand site" value="${escapeHtml(values.website || '')}" />
            </div>
            <div class="field">
              <label for="goal">What are you looking for?</label>
              <select id="goal" name="goal">
                <option value="Figure out the best move"${values.goal === 'Figure out the best move' ? ' selected' : ''}>Figure out the best move</option>
                <option value="Turn this into a post"${values.goal === 'Turn this into a post' ? ' selected' : ''}>Turn this into a post</option>
                <option value="Turn this into a shopping move"${values.goal === 'Turn this into a shopping move' ? ' selected' : ''}>Turn this into a shopping move</option>
                <option value="Break this down clearly"${values.goal === 'Break this down clearly' ? ' selected' : ''}>Break this down clearly</option>
                <option value="Find the money lane"${values.goal === 'Find the money lane' ? ' selected' : ''}>Find the money lane</option>
                <option value="See what feels weak"${values.goal === 'See what feels weak' ? ' selected' : ''}>See what feels weak</option>
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
              <input id="businessName" name="businessName" placeholder="Optional project or brand name" value="${escapeHtml(values.businessName || '')}" />
            </div>
            <div class="field">
              <label for="category">Lane</label>
              <select id="category" name="category">
                <option value="General internet signal"${!values.category || values.category === 'General internet signal' ? ' selected' : ''}>General internet signal</option>
                <option value="Warnings + weird messages"${values.category === 'Warnings + weird messages' ? ' selected' : ''}>Warnings + weird messages</option>
                <option value="Media + remixes"${values.category === 'Media + remixes' ? ' selected' : ''}>Media + remixes</option>
                <option value="Money + shopping"${values.category === 'Money + shopping' ? ' selected' : ''}>Money + shopping</option>
                <option value="Care + circles"${values.category === 'Care + circles' ? ' selected' : ''}>Care + circles</option>
                <option value="Work + creator identity"${values.category === 'Work + creator identity' ? ' selected' : ''}>Work + creator identity</option>
                <option value="Home + ownership"${values.category === 'Home + ownership' ? ' selected' : ''}>Home + ownership</option>
                <option value="Paper + life admin"${values.category === 'Paper + life admin' ? ' selected' : ''}>Paper + life admin</option>
                <option value="Identity + access"${values.category === 'Identity + access' ? ' selected' : ''}>Identity + access</option>
                <option value="Commerce + creators"${values.category === 'Commerce + creators' ? ' selected' : ''}>Commerce + creators</option>
                <option value="Moves + transitions"${values.category === 'Moves + transitions' ? ' selected' : ''}>Moves + transitions</option>
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
              <input id="facebook" name="facebook" data-url-normalize placeholder="facebook.com/yourbrand" value="${escapeHtml(values.facebook || '')}" />
            </div>
            <div class="field full">
              <label for="notes">Notes</label>
              <textarea id="notes" name="notes" placeholder="Anything else you want Jeni to keep in mind?">${escapeHtml(values.notes || '')}</textarea>
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
                <span>I can share this source, and I understand Jeni will read public signal data to generate a live read. By submitting, I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>, including contextual monetization rules that keep ads outside the answer itself.</span>
              </label>
            </div>
          </div>
        </div>

        <p class="form-hint">Usually takes about 20 seconds. Optional details just help the scan lean harder into the right lane.</p>
        <p class="inline-note" data-intake-status${errorMessage ? ' data-state="warning"' : ''}>${escapeHtml(errorMessage || 'Jeni starts reading the signal the moment you submit it.')}</p>
        <div class="actions">
          <button class="btn" type="submit" data-intake-submit>Start Live Read</button>
          <a class="btn secondary" href="/case-studies">See the Surfaces</a>
        </div>
      </form>
    </section>
  `;

  return layout('Signal Drop', content, '/intake');
}

function intakeSuccessPage(plan = 'Free') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Signal Received</p>
        <h2>We’re reading the signal.</h2>
      </div>
      <p class="muted">The engine is reading the source now. The next step is a sharper live read, not a dead queue page.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What happens now</p>
        <h3>The live read starts immediately.</h3>
        <p class="muted">Jeni is looking for the signal, the best surface, the right output, and the safest money lane hiding inside the source.</p>
      </article>
      <article class="card">
        <p class="kicker">If contact is missing</p>
        <h3>The source was enough.</h3>
        <p class="muted">You can always add more context later. The first pass only needs a strong starting point.</p>
      </article>
    </section>
    <section class="card">
      <p class="section-label">Next Step</p>
      <h2>Find the signal first. Move from the best output after.</h2>
      <p class="muted">The point is to surface the clearest read quickly, not bury the product in extra ceremony.</p>
      <div class="actions">
        <a class="btn" href="/pricing">See How Jeni Stays Free</a>
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
    return 'Preparing your live read.';
  }

  return job.progressLabel || {
    queued: 'Reading your source.',
    scanning: 'Sorting signal, context, and patterns.',
    analyzing: 'Picking the best surface, output, and money lane.',
    completed: 'Your live read is ready.',
    failed: 'We could not finish the live read.'
  }[job.status] || 'Preparing your live read.';
}

function createClientFromIntake(form = {}) {
  const prepared = prepareIntakeSubmission(form);
  const socialParts = [
    prepared.instagram ? `Instagram: ${prepared.instagram}` : '',
    prepared.facebook ? `Facebook: ${prepared.facebook}` : '',
    prepared.socialStack || ''
  ].filter(Boolean);
  const notesParts = [
    prepared.query ? `Prompt: ${prepared.query}` : '',
    prepared.mainServices ? `Main services: ${prepared.mainServices}` : '',
    prepared.notes || ''
  ].filter(Boolean);
  const website = prepared.website || '';
  const businessName = prepared.businessName || getDomainFromWebsite(website) || 'Signal Lead';

  return {
    id: `c_${crypto.randomUUID().slice(0, 10)}`,
    businessName,
    owner: prepared.owner || '',
    email: prepared.email || '',
    phone: prepared.phone || '',
    website,
    sitePlatform: prepared.sitePlatform || 'custom',
    category: prepared.category || 'General internet signal',
    goal: prepared.goal || '',
    notes: notesParts.join('\n\n'),
    plan: normalizePlan(prepared.plan),
    businessSize: prepared.businessSize || 'small-team',
    leadVolume: prepared.leadVolume || 'steady',
    salesMotion: prepared.salesMotion || 'mixed',
    preferredChannel: prepared.preferredChannel || 'email',
    socialStack: socialParts.join(' · '),
    instagram: prepared.instagram || '',
    facebook: prepared.facebook || '',
    mainServices: prepared.mainServices || '',
    bookingSystem: prepared.bookingSystem || '',
    callLogs: [],
    scanConsent: prepared.scanConsent === 'yes',
    publishConsent: prepared.publishConsent === 'yes' || prepared.scanConsent === 'yes',
    legalConsent: prepared.legalConsent === 'yes' || prepared.scanConsent === 'yes',
    createdAt: new Date().toISOString()
  };
}

function createAuditJobRecord(clientId) {
  return {
    id: `audit_${crypto.randomUUID().slice(0, 12)}`,
    clientId,
    status: 'queued',
    progressLabel: 'Reading your source.',
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
        <p class="kicker">No findings yet</p>
        <h3>Your live read is still loading.</h3>
        <p class="muted">Jeni will fill this with the strongest patterns and fastest wins as soon as the read is finished.</p>
      </article>
    `;
  }

  return result.topIssues.map((issue) => `
    <article class="card audit-issue-card">
      <p class="kicker">${escapeHtml(issue.category || 'Issue')}</p>
      <h3>${escapeHtml(issue.issue || 'Needs attention')}</h3>
      <p class="muted">${escapeHtml(issue.whyItHurts || 'This issue is making the signal harder to act on or spread.')}</p>
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
        <p class="section-label">Live Read</p>
        <h2>${escapeHtml(getClientDisplayName(client || {}))}</h2>
      </div>
      <p class="muted">Jeni is reading this source for the clearest signal, best surface fit, strongest output, safest money lane, and the background engine underneath it.</p>
    </section>

    <section class="card audit-shell" data-audit-page data-audit-id="${escapeHtml(auditJob.id)}">
      <div class="audit-loading">
        <p class="section-label">Live Read</p>
        <h3 data-audit-progress>${escapeHtml(getAuditProgressCopy(auditJob))}</h3>
        <p class="muted">Searching the source for signal, surface fit, and the clearest next move...</p>
        <div class="mini-proof">
          <span class="pill" data-audit-status-pill>${escapeHtml(getAuditStatusLabel(auditJob.status))}</span>
          <span class="pill">${escapeHtml(client?.website || 'Signal pending')}</span>
          <span class="pill" data-audit-source-mode>${escapeHtml(sourceMode)}</span>
        </div>
      </div>

      <div class="audit-grid" data-audit-results${completed ? '' : ' hidden'}>
        <article class="card audit-score-card">
          <p class="kicker">Signal Read Score</p>
          <div class="audit-score" data-audit-overall-score>${completed ? escapeHtml(String(auditResult.overallScore || '--')) : '--'}</div>
          <p class="muted" data-audit-summary>${completed ? escapeHtml(auditResult.summary || '') : 'Your summary will appear here as soon as the audit finishes.'}</p>
        </article>
          <article class="card">
            <p class="kicker">Five-Second Read</p>
            <h3 data-audit-five-second>${completed ? escapeHtml(auditResult.fiveSecondImpression || '') : 'Loading first-impression analysis...'}</h3>
            <div class="audit-mini-scores">
            ${Object.entries(jeniScoreLabels).map(([key, label]) => `
              <div class="audit-mini-score">
                <strong data-audit-score-${key}>${completed ? escapeHtml(String(scores[key] ?? '--')) : '--'}</strong>
                <span>${escapeHtml(label)}</span>
              </div>
            `).join('')}
          </div>
          <div class="mini-proof" style="margin-top: 18px;">
            <span class="pill">Best anchor</span>
            <span class="pill" data-audit-strongest-page>${escapeHtml(strongestPage)}</span>
          </div>
        </article>
      </div>

      <div class="audit-sections" data-audit-detail-sections${completed ? '' : ' hidden'}>
        <section>
          <div class="section-heading">
            <div>
              <p class="section-label">Top Findings</p>
              <h2>Where the signal breaks, spreads, or gets expensive.</h2>
            </div>
          </div>
          <div class="feature-grid" data-audit-issues>${renderAuditIssueCards(auditResult)}</div>
        </section>

        <section class="detail-grid" style="margin-top: 18px;">
          <article class="card">
            <p class="kicker">Fast Wins</p>
            <ul class="list-clean" data-audit-quick-wins>
              ${(completed ? auditResult.quickWins : ['Jeni is building your quick wins now.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
          <article class="card">
            <p class="kicker">Build Sequence</p>
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
              ${(completed ? auditResult.conversionLeaks : ['Your share and spread angles will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        </section>

        <section style="margin-top: 18px;">
          <div class="section-heading">
            <div>
              <p class="section-label">Surface Stack</p>
              <h2>The pieces that make the free social app feel real.</h2>
            </div>
            <p class="muted">This is where the output shifts from “interesting” to “worth using, sharing, and monetizing cleanly.”</p>
          </div>
          <div class="feature-grid">
            <article class="card fix-card">
              <p class="kicker">Core promise</p>
              <h3>Headline, subheadline, and first move</h3>
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
              <p class="kicker">Output design</p>
              <h3>What people would naturally repost, forward, or save.</h3>
              <ul class="list-clean" data-audit-trust-recommendations>
                ${(completed ? auditResult.trustRecommendations : ['Share-artifact directions will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Ad-safe money path</p>
              <h3>How this concept stays free and still gets paid.</h3>
              <ul class="list-clean" data-audit-booking-recommendations>
              ${(completed ? auditResult.bookingFlowRecommendations : ['Ad-safe monetization recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Platform door</p>
              <h3>What larger product layer this could become.</h3>
              <ul class="list-clean" data-audit-seo-recommendations>
              ${(completed ? auditResult.seoRecommendations : ['Platform-door recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Missing protections</p>
              <h3>What the current thesis still needs.</h3>
              <ul class="list-clean" data-audit-missing-elements>
                ${(completed ? auditResult.missingElements : ['Missing ingredients will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Phase Plan</p>
              <h3>How Jeni would move next.</h3>
              <ul class="list-clean">
                <li>Tighten the first surface until the signal and move feel obvious.</li>
                <li>Prototype the output people naturally keep, repost, or forward.</li>
                <li>Keep monetization outside the answer while the background engine grows.</li>
              </ul>
              <div class="mini-proof">
                <span class="pill">validate</span>
                <span class="pill">prototype</span>
                <span class="pill">protect</span>
              </div>
            </article>
          </div>
        </section>
      </div>

      <article class="card audit-error" data-audit-error${auditJob.status === 'failed' ? '' : ' hidden'}>
        <p class="kicker">Read Error</p>
        <h3>We could not finish the live read.</h3>
        <p class="muted" data-audit-error-message>${escapeHtml(auditJob.errorMessage || 'Try again with a reachable signal URL.')}</p>
      </article>
    </section>
  `;

  return layout('Live Read', content, `/audit/${auditJob.id}`);
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
        <h3>What Jeni wants to strengthen next.</h3>
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
      <p class="muted">A client-facing snapshot for ${escapeHtml(client.owner || 'the owner')} with the Jeni plan already customized for this business.</p>
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
        <p class="muted">Head back to the home page or start a new drop.</p>
        <div class="actions" style="justify-content: center;">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/intake">Start a Drop</a>
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
  sendHtml(res, intakePage(selectedPlan, buildIntakePrefill(req.query)));
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

app.get('/shield', async (req, res) => {
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
  const preparedBody = prepareIntakeSubmission(req.body);

  if (!preparedBody.website && !preparedBody.query) {
    res.status(400).json({ error: 'Paste a link, a domain, or tell Jeni what feels off.' });
    return;
  }

  if (preparedBody.scanConsent !== 'yes') {
    res.status(400).json({ error: 'Please confirm you can share this source for the scan.' });
    return;
  }

  try {
    const session = await createLeadAndAudit(preparedBody);
    res.json({
      clientId: session.client.id,
      auditId: session.auditJob.id,
      redirectUrl: session.redirectUrl
    });
  } catch (error) {
    res.status(500).json({ error: 'Could not start the live read right now.' });
  }
});

app.post('/intake', async (req, res) => {
  const preparedBody = prepareIntakeSubmission(req.body);

  if (!preparedBody.website && !preparedBody.query) {
    sendHtml(res, intakePage(normalizePlan(preparedBody.plan), preparedBody, 'Paste a link, a domain, or tell Jeni what feels off.'), 400);
    return;
  }

  if (preparedBody.scanConsent !== 'yes') {
    sendHtml(res, intakePage(normalizePlan(preparedBody.plan), preparedBody, 'Please confirm you can share this source for the scan.'), 400);
    return;
  }

  try {
    const session = await createLeadAndAudit(preparedBody);
    res.redirect(session.redirectUrl);
  } catch (error) {
    sendHtml(res, intakePage(normalizePlan(preparedBody.plan), preparedBody, 'Could not start the live read right now.'), 500);
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
      'See Surfaces',
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
      'Start a Drop',
      '/case-studies',
      'See Surfaces',
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
