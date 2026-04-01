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
  category: 'Free AI trust super-app',
  audience: 'families, creators, operators, and teams navigating the AI trust era',
  slogan: 'Check it before you trust it.',
  headline: 'Paste anything. Find out if it feels real, risky, or scammy.',
  subhead: 'Jeni checks suspicious links, messages, profiles, clips, and offers, explains what feels off in regular-people language, and keeps the proof neat if things go left.',
  supportingLine: 'Shield. Truth. Passport. Then money, care, home, civic, commerce, work, and moves.',
  metaDescription: 'Jeni is a free, ad-funded AI trust super-app that turns media, identity, actions, and outcomes into verifiable receipts across scams, truth, care, money, home, work, commerce, and civic life.',
  proofNote: 'Shield, Truth, and Passport form the front door, then the rest of the life modules compound on top of shared receipts, provenance, and identity.',
  algorithmName: 'Jeni Super-App Engine'
};
const jeniFeatures = [
  {
    slug: 'shield',
    letter: '01',
    title: 'Jeni Shield',
    category: 'Safety + scams',
    role: 'Front door',
    pitch: 'A family firewall for impersonation scams across calls, texts, DMs, email, and payments.',
    viralHook: 'Scam Receipts that explain the tell, redact the risk, and are built to share.',
    monetization: 'Free core, then contextual fraud-recovery cards and trusted partner placements after the proof is delivered.',
    adFit: 'High, but only after the receipt. No ads inside the proof or panic flow.',
    trustPrimitive: 'Scam Receipts, trusted circles, and verifier-ready warning pages.',
    door: 'Verified calling, identity trust, and payments-risk infrastructure.',
    whyNow: 'Fraud losses are huge, the pain is emotional, and the warning wants to travel.'
  },
  {
    slug: 'wallet',
    letter: '02',
    title: 'Jeni Wallet',
    category: 'Money + recurring spend',
    role: 'Retention engine',
    pitch: 'Find recurring bills, cancel junk, negotiate spend, and turn the win into signed savings proof.',
    viralHook: 'Savings Receipts and streak cards that make financial cleanup social.',
    monetization: 'Contextual budgeting, banking, and switching offers shown around the savings feed, not inside the proof.',
    adFit: 'Strong contextual finance inventory with heavy category restrictions.',
    trustPrimitive: 'Savings Receipts, merchant trust labels, and audit-friendly before-and-after proof.',
    door: 'Consumer finance autopilot, switching, and permissioned spending agents.',
    whyNow: 'Recurring spend keeps leaking because almost nobody manages it cleanly.'
  },
  {
    slug: 'truth',
    letter: '03',
    title: 'Jeni Truth',
    category: 'Media + reality',
    role: 'Front door',
    pitch: 'Upload a clip or screenshot and get a Reality Card with provenance, manipulation signals, and plain-English verification steps.',
    viralHook: 'Comment-ready clarity cards built for stories, threads, and group chats.',
    monetization: 'Contextual literacy, security, and neutral media sponsorships outside verifier surfaces.',
    adFit: 'Medium. Brand-safe only, no political microtargeting, and nothing inside authenticity verdicts.',
    trustPrimitive: 'Reality Cards, provenance states, and public verifier links.',
    door: 'Trust APIs for media, marketplaces, brands, and enterprise comms.',
    whyNow: 'Synthetic media is cheap, social feeds are crowded, and people need usable certainty.'
  },
  {
    slug: 'clipshop',
    letter: '04',
    title: 'Jeni ClipShop',
    category: 'Commerce + creators',
    role: 'Commerce rail',
    pitch: 'Turn short-form video into trusted commerce with verified claims, price history, and cleaner returns.',
    viralHook: 'Verified dupe cards, claim badges, and creator storefront overlays.',
    monetization: 'Sponsored listings, verified partner placements, and commerce media inside search and browse surfaces.',
    adFit: 'Very high because the ad unit can be native commerce without touching the proof layer.',
    trustPrimitive: 'Claim Credentials, seller identity tiers, and verifier-backed product cards.',
    door: 'Commerce infrastructure for creator video and verified product graphs.',
    whyNow: 'Clip-led buying is growing fast while trust still lags behind the conversion.'
  },
  {
    slug: 'skilldrop',
    letter: '05',
    title: 'Jeni SkillDrop',
    category: 'Work + proof',
    role: 'Career graph',
    pitch: 'Weekly shipped work becomes a signed proof-of-skill graph instead of another forgettable resume.',
    viralHook: 'Ship clips and Skill Credentials designed for short-form feeds.',
    monetization: 'Sponsored challenges, recruiting placements, and contextual learning tools around the feed.',
    adFit: 'Strong if sponsors fund exploration, not scoring.',
    trustPrimitive: 'Skill Credentials, mentor signatures, and public verifier pages for shipped work.',
    door: 'Portable reputation graphs and hiring trust infrastructure.',
    whyNow: 'Resumes are weak signals and AI makes fake portfolios easier than ever.'
  },
  {
    slug: 'careops',
    letter: '06',
    title: 'Jeni CareOps',
    category: 'Care + family',
    role: 'Retention engine',
    pitch: 'Coordinate medications, appointments, transport, and caregiving handoffs with verified logs and secure records.',
    viralHook: 'Care receipts, protected family dashboards, and calm handoff proof.',
    monetization: 'Ad-light and contextual only, mostly on home surfaces for caregiver services and supplies.',
    adFit: 'Low to medium. Sensitive by default, never inside medical logs or emergency states.',
    trustPrimitive: 'Care Receipts, role-aware access, and family-safe audit trails.',
    door: 'Health-adjacent logistics, remote coordination, and secure care workflows.',
    whyNow: 'Caregiving is exploding and the coordination burden is brutal.'
  },
  {
    slug: 'homeledger',
    letter: '07',
    title: 'Jeni HomeLedger',
    category: 'Home + property ops',
    role: 'Asset history',
    pitch: 'Turn home maintenance, receipts, warranties, and claims into a verified asset history.',
    viralHook: 'Repair receipts, claim packs, and “value saved” home stories.',
    monetization: 'Contextual contractor, warranty, and home-services inventory beside timelines and search results.',
    adFit: 'High in marketplaces and explore feeds, off inside claim packs.',
    trustPrimitive: 'Repair Receipts, contractor identity checks, and claim-ready export bundles.',
    door: 'Property ops, underwriting-grade condition data, and multi-home expansion.',
    whyNow: 'Homes are expensive and documentation is still scattered everywhere.'
  },
  {
    slug: 'civiccopilot',
    letter: '08',
    title: 'Jeni CivicCopilot',
    category: 'Civic + bureaucracy',
    role: 'Life admin',
    pitch: 'Automate filings, deadlines, appointments, and disputes with clean receipts and audit trails.',
    viralHook: 'Shareable “I beat the system” wins with proof of what changed.',
    monetization: 'Contextual document, shipping, notary, and admin-service placements outside filing receipts.',
    adFit: 'Medium with hard rules around legal sensitivity and accuracy.',
    trustPrimitive: 'Submission Receipts, audit exports, and filing timelines.',
    door: 'Life-admin APIs for every repetitive paperwork workflow.',
    whyNow: 'Bureaucracy still burns time, money, and attention at scale.'
  },
  {
    slug: 'passport',
    letter: '09',
    title: 'Jeni Passport',
    category: 'Identity + consent',
    role: 'Trust spine',
    pitch: 'A privacy-first identity and consent wallet that proves who acted, what was authorized, and which device signed it.',
    viralHook: 'Verified badges, consent receipts, and trust marks that travel across the rest of Jeni.',
    monetization: 'Mostly ad-light, with minimal security education surfaces and value driven by the modules it powers.',
    adFit: 'Low by design. Passport is the spine, so monetization stays minimal and carefully separated.',
    trustPrimitive: 'Passkeys, consent receipts, device binding, and verifier-ready identity states.',
    door: 'Cross-module identity infrastructure for media, commerce, family safety, and every proof workflow.',
    whyNow: 'Synthetic identity, impersonation, and consent disputes make strong trust primitives more necessary than ever.'
  },
  {
    slug: 'movepilot',
    letter: '10',
    title: 'Jeni MovePilot',
    category: 'Relocation + transitions',
    role: 'Transition OS',
    pitch: 'An operating system for moving, switching services, verifying providers, and keeping every life-transition receipt.',
    viralHook: 'Move scorecards, city guides, and proof-rich relocation templates.',
    monetization: 'Contextual movers, utilities, and transition offers inside comparison surfaces and checklists.',
    adFit: 'Strong when ads are service comparisons instead of interruption units.',
    trustPrimitive: 'Move Receipts, verified provider cards, and condition-proof bundles.',
    door: 'A larger transition OS for moves, newborns, job changes, and marriage shifts.',
    whyNow: 'Life transitions are still chaotic, expensive, and scam-prone.'
  }
];
const jeniPrimitives = [
  {
    title: 'Jeni Receipts',
    body: 'Every important action should become a signed receipt: scam flags, savings wins, claim packs, care handoffs, and public proof.'
  },
  {
    title: 'Media credentials',
    body: 'When media is involved, Jeni treats provenance as a product surface with manifests, hashes, and verification states.'
  },
  {
    title: 'Identity and device trust',
    body: 'Passkeys, step-up verification, and device confidence sit underneath the highest-risk flows.'
  },
  {
    title: 'Forensics + uncertainty',
    body: 'Jeni explains signals, confidence, and limits clearly instead of pretending detectors are magic truth machines.'
  }
];
const jeniRankings = [
  {
    title: 'Best front door',
    winner: 'Jeni Shield',
    body: 'The pain is urgent, the warning travels naturally, and the product works even before the rest of the super-app fills in.'
  },
  {
    title: 'Best share object',
    winner: 'Jeni Truth',
    body: 'Reality Cards belong in comments, stories, and group chats, which makes the output itself a distribution unit.'
  },
  {
    title: 'Strongest long-term spine',
    winner: 'Jeni Passport',
    body: 'Identity, consent, keys, and verifier infrastructure eventually strengthen every surface on the stack.'
  }
];
const jeniLaunchPath = [
  'Launch with Shield, Truth, and Passport as the front door.',
  'Turn the first useful outcome into a signed, shareable receipt.',
  'Keep the app free and place contextual ads only outside the proof zone.',
  'Expand into the rest of life once the trust primitives compound.'
];
const jeniRevenueModels = [
  {
    title: 'Protected proof zones',
    body: 'Verification outputs, emergency states, and signed receipts never contain ads or sponsored ranking.',
    examples: 'Shield panic flows, Truth verifier pages, Passport identity decisions'
  },
  {
    title: 'Contextual-first monetization',
    body: 'Use screen context and immediate intent before any coarse topic or partner logic enters the stack.',
    examples: 'Shield next steps, Wallet savings feed, HomeLedger contractor search'
  },
  {
    title: 'Direct sold and PMP later',
    body: 'Once the surfaces prove themselves, sell clean life-intent inventory to trusted partners instead of overfitting to ad-tech noise.',
    examples: 'ClipShop search, SkillDrop sponsored challenges, MovePilot service comparisons'
  }
];
const jeniChannels = [
  'Short-form social built around warning cards, reality cards, and story-sized proof.',
  'Comments, DMs, and group chats where people already ask, "is this real?"',
  'App-store intent around scams, verification, identity, safety, and truth.',
  'Institutions, creators, and trusted partners once the receipt format proves itself.'
];
const jeniScoreLabels = {
  clarity: 'Need',
  trust: 'Trust Layer',
  cta: 'Ad Fit',
  booking: 'Receipt Depth',
  seo: 'Platform Potential',
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
    serviceType: 'AI trust platform',
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
                ${navLink('/intake', 'Check', currentPath)}
                ${navLink('/case-studies', 'Modules', currentPath)}
                ${navLink('/how-it-works', 'Stack', currentPath)}
                ${navLink('/pricing', 'Free', currentPath)}
              </nav>
              <a class="btn nav-cta" href="/intake">Check Something</a>
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
          <span>Check</span>
        </a>
        <a class="dock-link${currentPath === '/case-studies' ? ' active' : ''}" href="/case-studies">
          <span>Modules</span>
        </a>
        <a class="dock-link${currentPath === '/pricing' ? ' active' : ''}" href="/pricing">
          <span>Free</span>
        </a>
      </nav>
      <footer>
        <div class="container footer-shell">
          <div>
            <strong>${brand.name}</strong>
            <span>Free trust checks, clean proof, ads after the answer.</span>
          </div>
          <nav class="footer-links">
            <a href="/intake">Check Something</a>
            <a href="/case-studies">Modules</a>
            <a href="/how-it-works">Stack</a>
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
        <p class="section-label">Jeni // Free Trust Checker</p>
        <h1>Paste anything. Jeni tells you what feels real, risky, or scammy.</h1>
        <p class="lede">A weird text. A payment link. A brand site. A profile. A clip. Jeni explains what feels off in regular-people talk and keeps the proof neat if things go left.</p>
        <form class="entry-search live-composer" method="GET" action="/intake" data-live-check-form>
          <input name="q" type="text" placeholder="Paste a message, link, profile, offer, or just ask a question" aria-label="Trust prompt" autocomplete="off" />
          <input type="hidden" name="scanConsent" value="yes" />
          <input type="hidden" name="goal" value="Understand the trust risk" />
          <input type="hidden" name="category" value="General trust signal" />
          <input type="hidden" name="plan" value="Starter" />
          <button class="btn" type="submit">Check It</button>
        </form>
        <div class="entry-suggestions entry-usage">
          <span class="pill">is this a scam?</span>
          <span class="pill">is this website legit?</span>
          <span class="pill">is this person real?</span>
          <span class="pill">check this offer</span>
          <span class="pill">verify this clip</span>
        </div>
        <p class="entry-microcopy">Free to use. Ads show after the answer, never inside the answer.</p>
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
                <li class="live-step" data-step="scanning">Check trust and risk signals</li>
                <li class="live-step" data-step="analyzing">Build the cleanest next move</li>
                <li class="live-step" data-step="completed">Return the result and proof trail</li>
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
          <p class="kicker">1. Paste it</p>
          <h3>Drop in the thing that feels off.</h3>
          <p class="muted">A message, link, profile, product page, brand site, or random question. Raw domains work. You do not need to clean it up first.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">2. Get the answer</p>
          <h3>Jeni tells you what looks safe, risky, or scammy.</h3>
          <p class="muted">Not just yes or no. It explains the red flags in normal language so you know what is actually wrong and what to do next.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">3. Keep the proof</p>
          <h3>When things go left, the timeline is already organized.</h3>
          <p class="muted">Jeni turns the messy situation into a clean receipt, explanation, and proof trail you can keep, share, or use in a dispute later.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="page-head">
        <div>
          <p class="section-label">Who This Is For</p>
          <h2>People who are about to trust something online.</h2>
        </div>
        <p class="muted">Jeni is for the exact moment you are about to click, pay, reply, trust, or share something and you do not want to get played.</p>
      </div>
      <div class="grid-3">
        <article class="card concept-card">
          <p class="kicker">Scam checks</p>
          <h3>People who think they might be getting scammed.</h3>
          <p class="muted">Marketplace buyers, shoppers, random DMs, fake payment requests, spoofed messages, and offers that feel too good to be true.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Small business</p>
          <h3>Owners who need cleaner trust around leads and payments.</h3>
          <p class="muted">Use Jeni to check weird leads, suspicious links, fake clients, proof of conversations, and situations that could turn into chargebacks or drama.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Social + dating</p>
          <h3>People trying to figure out if someone or something is real.</h3>
          <p class="muted">Profiles, clips, rumors, fake brands, catfish-style behavior, and online situations where “something feels off” is the whole problem.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card home-plain-callout">
          <p class="kicker">What The Bigger App Becomes</p>
          <h3>Shield first. Truth next. Passport underneath it all.</h3>
          <p class="muted">The first simple version is a scam and trust checker. Underneath that, Jeni grows into media verification, identity proof, savings, care, home history, and the rest of the life modules.</p>
        </article>
        <article class="card home-plain-callout">
          <p class="kicker">Money Model</p>
          <h3>You wanted ads so you do not have to charge.</h3>
          <p class="muted">That is the model now: helpful ads and trusted offers after the result, never mixed into the result. The answer stays clean. The app stays free.</p>
          <div class="actions">
            <a class="btn" href="/intake">Start Checking Something</a>
            <a class="btn secondary" href="/pricing">See How Ads Work</a>
          </div>
        </article>
      </div>
    </section>

    <section class="section compact-section">
      <div class="feature-grid feature-grid-tight">
        <article class="card concept-card">
          <p class="kicker">Front door</p>
          <h3>Shield, Truth, and Passport open the system.</h3>
          <p class="muted">Start with scams, reality checks, and identity trust, then let the rest of the life modules stack on top.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Live system</p>
          <h3>${escapeHtml(String(Math.max(clients.length, 10)))} trust scans run</h3>
          <p class="muted">Every scan looks for the best module, the right receipt, the ad-safe monetization path, and the larger verifier layer underneath it.</p>
        </article>
        <article class="card concept-card">
          <p class="kicker">Build the bigger picture</p>
          <h3>Once the answer is useful, the rest of Jeni makes sense.</h3>
          <p class="muted">That is how this becomes more than a checker. It becomes a trust layer people actually use across the rest of life.</p>
        </article>
      </div>
      <div class="actions" style="justify-content: center; margin-top: 18px;">
        <a class="btn secondary" href="/case-studies">See the Ten Modules</a>
      </div>
    </section>
  `;

  return layout(brand.name, content, '/');
}

function caseStudiesPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Modules</p>
        <h2>Ten life modules, one trust fabric.</h2>
      </div>
      <p class="muted">Jeni is one free super-app, not ten disconnected products. Every module creates a signed receipt, a share object, and a clean place where monetization can happen without contaminating proof.</p>
    </section>
    <section class="grid-3">
      ${jeniFeatures.map((concept) => `
        <article class="card concept-card" id="${escapeHtml(concept.slug)}">
          <p class="kicker">Module ${escapeHtml(concept.letter)}</p>
          <h3>${escapeHtml(concept.title)}</h3>
          <p class="muted">${escapeHtml(concept.pitch)}</p>
          <div class="mini-proof">
            <span class="pill">${escapeHtml(concept.category)}</span>
            <span class="pill">${escapeHtml(concept.role)}</span>
          </div>
          <ul class="list-clean">
            <li><strong>Share artifact:</strong> ${escapeHtml(concept.viralHook)}</li>
            <li><strong>Trust primitive:</strong> ${escapeHtml(concept.trustPrimitive)}</li>
            <li><strong>Ad fit:</strong> ${escapeHtml(concept.adFit)}</li>
            <li><strong>Money layer:</strong> ${escapeHtml(concept.monetization)}</li>
            <li><strong>Future door:</strong> ${escapeHtml(concept.door)}</li>
          </ul>
        </article>
      `).join('')}
    </section>
    <section class="card" style="margin-top: 24px;">
      <p class="kicker">Front-door stack</p>
      <h3>Shield, Truth, and Passport make the whole super-app believable.</h3>
      <p class="muted">Shield gives Jeni urgency. Truth gives it public share objects. Passport gives it identity, consent, and verifier strength underneath every other module.</p>
      <div class="actions">
        <a class="btn" href="/shield">Open Jeni Shield</a>
        <a class="btn secondary" href="/how-it-works">See the Trust Stack</a>
      </div>
    </section>
  `;

  return layout('Modules', content, '/case-studies');
}

function solutionsPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Trust Primitives</p>
        <h2>Four primitives every Jeni module needs before the platform feels real.</h2>
      </div>
      <p class="muted">The modules can change shape, but the underlying trust system has to stay consistent: identity, receipts, provenance, and policy boundaries around monetization.</p>
    </section>
    <section class="grid-3">
      ${[
        {
          kicker: '01',
          title: 'Passport',
          body: 'Passkeys, consent receipts, and device trust give the rest of the stack a stable identity spine.'
        },
        {
          kicker: '02',
          title: 'JRX receipts',
          body: 'Actions, claims, and outcomes become signed objects the app can store, share, and verify later.'
        },
        {
          kicker: '03',
          title: 'C2PA + provenance',
          body: 'When media is involved, provenance, hashes, and credential checks help Jeni explain what is known and what is still uncertain.'
        },
        {
          kicker: '04',
          title: 'Verifier + policy engine',
          body: 'Every meaningful output needs a verifier trail, and every monetized surface needs rules that keep ads out of the proof zone.'
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
          <h3>The proof object has to feel more useful than the raw evidence.</h3>
          <p class="muted">If the signed output is not calmer, clearer, and easier to share, Jeni is still behaving like a demo instead of a real product.</p>
        </article>
        <article class="card">
          <p class="kicker">Monetization boundary</p>
          <h3>Ads can live around the workflow, never inside the proof.</h3>
          <p class="muted">That one rule keeps the super-app free without making the trust layer feel bought, manipulated, or corrupted.</p>
          <div class="actions">
            <a class="btn" href="/intake">Start Trust Scan</a>
            <a class="btn secondary" href="/convert">See the Ad Model</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Trust Primitives', content, '/solutions');
}

function solutionPage(item) {
  const content = `
    <section class="card empty-state">
      <p class="section-label">Module</p>
      <h2>${escapeHtml(item.label)}</h2>
      <p class="muted">This legacy route is now secondary to the Jeni trust-scan flow. Use the intake to generate a fresh trust blueprint from a signal-rich source.</p>
      <div class="actions" style="justify-content: center;">
        <a class="btn" href="/intake">Start Trust Scan</a>
        <a class="btn secondary" href="/solutions">Back to Trust Primitives</a>
      </div>
    </section>
  `;

  return layout(item.label, content, solutionHref(item.slug));
}

function pricingPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Free Forever</p>
        <h2>Jeni stays free. The proof stays clean.</h2>
        <p class="muted">The business model is simple: contextual ads and trusted partner placements can appear after useful work is done, but never inside a receipt, verifier page, identity decision, or emergency flow.</p>
        <div class="mini-proof">
          <span class="pill">Contextual first</span>
          <span class="pill">Proof-zone safe</span>
          <span class="pill">Privacy-first</span>
        </div>
      </article>
      <article class="card art-panel">
        <p class="kicker">Hard rules</p>
        <h3>No sponsored verification. No ads in panic mode. No pay-to-look-safe.</h3>
        <p class="muted">Jeni only wins if users feel the trust layer is cleaner than the ad market sitting around it.</p>
      </article>
    </section>
    <section class="grid-3">
      ${[
        { title: 'Sponsored next steps', body: 'The cleanest inventory lives after a receipt is generated, when the user needs a safe next move and the proof is already locked.' },
        { title: 'Feed units', body: 'Wallet, HomeLedger, and SkillDrop can support native feed ads between cards, never inside the card doing the trust work.' },
        { title: 'Search placements', body: 'ClipShop and HomeLedger can run clearly labeled sponsored results where the user is already shopping or comparing.' },
        { title: 'Direct-sold later', body: 'As the modules prove themselves, Jeni can sell trusted life-intent inventory directly instead of letting the ad stack define the UX.' }
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
          <p class="kicker">How the platform makes money</p>
          <h3>The ad system follows the product, not the other way around.</h3>
          <ul class="list-clean">
            ${jeniRevenueModels.map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.body)}</li>`).join('')}
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Distribution</p>
          <h3>Receipts are the growth loop, not an afterthought.</h3>
          <ul class="list-clean">
            ${jeniChannels.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
          <div class="actions">
            <a class="btn" href="/convert">See the Ad Model</a>
            <a class="btn secondary" href="/intake">Start Trust Scan</a>
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
        <p class="section-label">Trust Stack</p>
        <h2>Ingest. Analyze. Sign. Verify. Protect the proof zone.</h2>
        <p class="muted">Jeni is built around one quiet promise: every important interaction should leave a useful, verifiable trail, and monetization should never muddy the result.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start Trust Scan</a>
          <a class="btn secondary" href="/operator-architecture">See the Trust Engine</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni trust pipeline showing ingestion, scoring, receipts, and verifier surfaces." />
        </div>
      </article>
    </section>
    <section class="feature-grid">
      ${[
        {
          title: 'Ingest the signal',
          body: 'A link, screenshot, clip, document, or forwarded message enters the system with hashes and traceability.'
        },
        {
          title: 'Reason about trust',
          body: 'Jeni reads risk, provenance, metadata, identity, and uncertainty without pretending detectors are magic truth machines.'
        },
        {
          title: 'Generate the receipt',
          body: 'The output becomes a signed object: a warning, proof card, claim pack, care log, or verifier-ready export.'
        },
        {
          title: 'Separate the money layer',
          body: 'Only after the proof is delivered can Jeni place contextual inventory around the workflow, never inside the proof itself.'
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
        <h3>Media, identity, actions, claims, workflow events, and social context.</h3>
        <p class="muted">Jeni is not limited to one category because the trust primitive stays the same even when the module changes shape.</p>
      </article>
      <article class="card">
        <p class="kicker">Output</p>
        <h3>Receipts, verifier links, and the next safe move.</h3>
        <p class="muted">The goal is not just detection. It is calmer action, cleaner evidence, and a trust object worth keeping or forwarding.</p>
      </article>
    </section>
  `;

  return layout('Trust Stack', content, '/how-it-works');
}

function discoverPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Distribution</p>
        <h2>Jeni spreads through receipts people already want to forward.</h2>
        <p class="muted">The best modules attach to social behavior that already exists: warning family, replying in comments, sharing a win, proving a handoff, or settling a dispute with cleaner evidence.</p>
        <div class="mini-proof">
          <span class="pill">Comments</span>
          <span class="pill">Group chats</span>
          <span class="pill">Stories</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-aurora.svg" alt="Jeni opportunity field showing scams, media, money, family care, home, work, civic, and identity trust zones." />
        </div>
      </article>
    </section>
    <section class="grid-3">${[
      'Scam Receipts people forward to family circles the moment danger spikes.',
      'Reality Cards built to sit inside comments under confusing or manipulated posts.',
      'Savings Receipts that turn cleanup into a flex instead of a chore.',
      'Care handoff proof that prevents family conflict and reduces missed details.',
      'Claim packs and repair receipts that travel between homeowners, contractors, and insurers.',
      'Skill Credentials and dupe cards that creators can repost as proof-rich social objects.'
    ].map((item) => `
      <article class="card">
        <p class="kicker">Share loop</p>
        <h3>${escapeHtml(item)}</h3>
        <p class="muted">If the receipt already fits how people communicate, growth can ride the product instead of needing awkward referral mechanics.</p>
      </article>
    `).join('')}</section>
  `;

  return layout('Distribution', content, '/discover');
}

function verifyPage() {
  const cards = [
    {
      name: 'C2PA',
      headline: 'Read what media credentials can actually prove, not what you wish they proved.',
      body: 'A manifest, signature, or metadata trail can raise confidence without magically confirming every claim inside the content.'
    },
    {
      name: 'JRX receipts',
      headline: 'When credentials are missing, Jeni still binds analysis to hashes, signed receipts, and verifier states.',
      body: 'That keeps the output portable, inspectable, and useful even when the source arrives with no provenance help.'
    },
    {
      name: 'Uncertainty',
      headline: 'Risk indicators should explain signal, confidence, and limits with unusual care.',
      body: 'Jeni should explain why something feels risky without collapsing into fake-versus-real theater.'
    },
    {
      name: 'Verifier pages',
      headline: 'The public proof surface should stay clean, calm, and unsponsored.',
      body: 'Verifier pages are where trust compounds, so they need to feel separate from the ad system and durable enough to cite.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Verification</p>
        <h2>Trust products fail when they overclaim.</h2>
        <p class="muted">Jeni is strongest when it shows evidence, confidence, limits, and the next best move without sounding evasive, absolute, or bought.</p>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni verification board showing provenance, risk scoring, and signed receipt states." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Verification', content, '/verify');
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
        <h2>Free product. Premium trust. Privacy-first monetization.</h2>
        <p class="muted">Jeni makes money with contextual placements, protected proof zones, and direct relationships that respect the trust layer instead of corrupting it.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start Trust Scan</a>
          <a class="btn secondary" href="/pricing">See How Jeni Stays Free</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-aurora.svg" alt="Jeni revenue field showing protection, savings, and transaction layers." />
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
        <p class="section-label">Front Door</p>
        <h2>Shield, Truth, and Passport are the opening move.</h2>
        <p class="muted">Those three modules give Jeni urgency, public shareability, and a believable identity spine. The rest of the modules expand once the first proof loops are working.</p>
      </article>
      <article class="card art-panel">
        <p class="kicker">Common thread</p>
        <h3>Every module is a different face of the same trust system.</h3>
        <p class="muted">Identity, receipts, provenance, and verifier flows stay constant even when the product shifts from scams to home history or care coordination.</p>
      </article>
    </section>
    <section class="grid-3">${[
      { label: 'Safety + scams', body: 'Impersonation, spoofing, family protection, and payment-risk prevention.' },
      { label: 'Money + bills', body: 'Subscriptions, recurring spend, savings recovery, and signed financial wins.' },
      { label: 'Truth + media', body: 'Clips, screenshots, provenance, manipulation signals, and comment-ready clarity.' },
      { label: 'Care + family logistics', body: 'Appointments, meds, check-ins, emergency plans, and handoff receipts.' },
      { label: 'Home + property', body: 'Repairs, claims, contractor proof, and verified home history.' },
      { label: 'Civic + paperwork', body: 'Forms, deadlines, appointment proof, disputes, and audit trails.' },
      { label: 'Identity + consent', body: 'Passkeys, verified identity states, device trust, consent receipts, and safe authorization flows.' },
      { label: 'Commerce + creators', body: 'Verified claims, product receipts, price history, and creator storefront trust.' },
      { label: 'Work + skill proof', body: 'Shipped work, mentor endorsements, and signed reputation artifacts.' },
      { label: 'Moving + transitions', body: 'Provider verification, quote receipts, and cleaner life-event workflows.' }
    ].map(renderIndustryCard).join('')}</section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Flagship wedge</p>
          <h3>Shield gives Jeni the cleanest first motion.</h3>
          <p class="muted">Scams are social, emotional, measurable, and expensive. That makes the value obvious without shrinking the super-app ambition.</p>
          <div class="actions">
            <a class="btn" href="/shield">See Jeni Shield</a>
            <a class="btn secondary" href="/pricing">See How It Stays Free</a>
          </div>
        </article>
        <article class="card">
          <p class="kicker">Share loop</p>
          <h3>The strongest use cases come with their own receipt format.</h3>
          <p class="muted">Warnings, savings cards, care logs, reality cards, claim packs, and credentials travel better than generic referral asks.</p>
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
        <p class="section-label">Jeni Shield</p>
        <h2>The first Jeni module: a family firewall for the AI scam era.</h2>
        <p class="muted">Shield reads texts, links, screenshots, emails, and scam-like voice moments, then turns them into signed Scam Receipts that calm the user and warn the circle without putting ads inside the proof.</p>
        <div class="mini-proof">
          <span class="pill">Urgent pain</span>
          <span class="pill">Free front door</span>
          <span class="pill">Native viral loop</span>
        </div>
        <div class="actions">
          <a class="btn" href="/intake">Run a Shield Scan</a>
          <a class="btn secondary" href="/how-it-works">See the Trust Stack</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni Shield interface with high-risk scam detection, family circles, and a verifier-ready receipt." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Why Shield first</p>
          <h2>The first product should solve a trust failure people are already scared of.</h2>
        </div>
        <p class="muted">Shield is strong because it is useful in the exact moment fear spikes, and the output is naturally worth sharing with family and friends.</p>
      </div>
      <div class="feature-grid">${[
        'Impersonation fear is immediate and measurable.',
        'Scam Receipts create the product loop and the growth loop at the same time.',
        'Contextual safety next steps can monetize the surface without touching the receipt.',
        'Banks and support teams can later plug into the same trust layer.'
      ].map((item) => `
        <article class="card">
          <p class="kicker">Shield logic</p>
          <h3>${escapeHtml(item)}</h3>
          <p class="muted">That makes the first product emotionally legible and commercially clean.</p>
        </article>
      `).join('')}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">What Shield includes</p>
          <h2>A Phase 1 feature set that already feels useful and defensible.</h2>
        </div>
        <p class="muted">Even as a first module, Shield should already feel like a category-defining consumer trust product.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Capture</p>
          <h3>Forward anything suspicious</h3>
          <p class="muted">Links, screenshots, emails, messages, and clips should all flow into the same trust system.</p>
        </article>
        <article class="card">
          <p class="kicker">Explain</p>
          <h3>Show the signals in plain English</h3>
          <p class="muted">Users should understand why the risk feels high without reading technical nonsense.</p>
        </article>
        <article class="card">
          <p class="kicker">Share</p>
          <h3>Generate a Scam Receipt</h3>
          <p class="muted">The receipt is redacted, signed, and ready for a family circle, story, or support workflow.</p>
        </article>
        <article class="card">
          <p class="kicker">Protect</p>
          <h3>Run family circles and allowlists</h3>
          <p class="muted">Protection gets stronger when the people around the user are part of the loop too.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <article class="card">
        <p class="section-label">Expansion door</p>
        <h2>Shield is not the whole company. It is the first proof that the trust layer works.</h2>
        <p class="muted">Once people trust Jeni with scams and warnings, the same primitives can expand into Truth, Wallet, CareOps, HomeLedger, and Passport-level identity flows.</p>
        <div class="actions">
          <a class="btn" href="/intake">Start Trust Scan</a>
          <a class="btn secondary" href="/case-studies">See All Modules</a>
        </div>
      </article>
    </section>
  `;

  return layout('Jeni Shield', content, '/shield');
}

function operatorArchitecturePage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Trust Engine</p>
        <h2>The simple version of how Jeni thinks.</h2>
        <p class="muted">Read a signal-rich source, compress the strongest clues, score the risk and proof layer, choose the best module, then return a trust blueprint sharp enough to act on.</p>
        <div class="mini-proof">
          <span class="pill">Reader</span>
          <span class="pill">Score model</span>
          <span class="pill">Receipt logic</span>
          <span class="pill">Policy layer</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/jeni-shield-grid.svg" alt="Jeni trust architecture showing signal intake, scoring, receipts, and verifier output." />
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
          <p class="muted">Fetch the source, keep only the useful pages, and extract the strongest trust clues.</p>
        </article>
        <article class="card">
          <p class="kicker">2</p>
          <h3>Score</h3>
          <p class="muted">Judge need, trust depth, ad fit, receipt depth, platform potential, and speed to launch.</p>
        </article>
        <article class="card">
          <p class="kicker">3</p>
          <h3>Return</h3>
          <p class="muted">Return a sharper promise, a receipt design, a safe monetization layer, and the next obvious product move.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Output standard</p>
          <h3>It should feel like a serious trust brief, not a brainstorm dump.</h3>
          <p class="muted">The finished output needs to be useful immediately, with enough clarity to guide a real module or risk decision.</p>
        </article>
        <article class="card">
          <p class="kicker">Reality</p>
          <h3>A beautiful interface cannot save a weak trust story.</h3>
          <p class="muted">The pain, receipt, ad boundary, and verifier layer still have to survive real-world pressure.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Trust Engine', content, '/operator-architecture');
}

function aboutPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">About Jeni</p>
        <h2>Jeni is a free trust super-app for the AI era.</h2>
        <p class="muted">It exists for people who need calmer proof in a world full of synthetic media, cheap manipulation, and rising doubt. The product turns trust into receipts people can actually use and keeps the app free without selling the proof layer itself.</p>
        <div class="mini-proof">
          <span class="pill">Receipts</span>
          <span class="pill">Verification</span>
          <span class="pill">Identity</span>
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
          <h3>A life OS built on a trust layer.</h3>
          <p class="muted">Jeni reads a signal-rich source and returns a sharper view of the risk, proof object, ad-safe money path, and verifier layer underneath it.</p>
        </article>
        <article class="card">
          <p class="kicker">Who it helps</p>
          <h3>Families, creators, founders, and operators looking for confidence.</h3>
          <p class="muted">Especially people who need to know whether to trust, ignore, share, buy, or act.</p>
        </article>
        <article class="card">
          <p class="kicker">Why it exists</p>
          <h3>Because proof is becoming more valuable than polish.</h3>
          <p class="muted">The hard part is not generating content. The hard part is trusting what is real, what is safe, and what deserves to move forward.</p>
        </article>
        <article class="card">
          <p class="kicker">How it works</p>
          <h3>Read, score, sign, verify, then separate the money layer.</h3>
          <p class="muted">The engine reads the source, scores the trust layer, and returns a receipt-ready direction with a stronger opening move and a cleaner monetization boundary.</p>
        </article>
        <article class="card">
          <p class="kicker">What makes it different</p>
          <h3>It treats proof as a product primitive, not a legal afterthought.</h3>
          <p class="muted">A Jeni surface only counts if it can calm doubt, create a shareable proof object, and grow into a deeper trust layer over time.</p>
        </article>
        <article class="card">
          <p class="kicker">The standard</p>
          <h3>It should feel calm, important, and unusually trustworthy.</h3>
          <p class="muted">That is the bar for the design, the copy, the proof it produces, and the way monetization stays out of the wrong places.</p>
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
      <p class="muted">Jeni only needs the information required to read submitted sources, generate trust scans, and support the product safely. Ads stay contextual by default and outside the proof zone.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What Jeni may collect</p>
        <ul class="list-clean">
          <li>Business contact details from intake.</li>
          <li>Public page content and structure needed for trust scans.</li>
          <li>Scan output, operator notes, and queue history.</li>
          <li>Operational data required to support the app safely.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">How it is used</p>
        <ul class="list-clean">
          <li>To run trust scans and generate structured outputs.</li>
          <li>To improve product quality, queue handling, and support.</li>
          <li>To maintain product security and reasonable operational logs.</li>
          <li>To support contextual monetization that does not use the proof output itself as ad targeting input.</li>
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
      <p class="muted">Jeni prepares trust scans and product outputs. The user still controls how those outputs get used in the real world, and ads never buy a safer result.</p>
    </section>
    <section class="feature-grid">
      <article class="card">
        <p class="kicker">User responsibility</p>
        <h3>You are responsible for how you use the output.</h3>
        <p class="muted">Jeni can generate scans, trust receipts, and recommendations, but it does not assume legal or commercial responsibility for a user’s final decisions.</p>
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
        <p class="muted">You confirm that you can share the source or market signal and that Jeni may analyze public information from it to produce a trust scan.</p>
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
        <p class="section-label">Trust Scan</p>
        <h2>Give Jeni one clean source.</h2>
      </div>
      <p class="muted">You can arrive with a thought, a link, or a loose domain. Jeni will normalize the source, read the signal, and return the clearest trust, proof, module fit, and ad-safe money direction.</p>
    </section>
    <section class="detail-grid" style="margin-bottom: 18px;">
      <article class="card">
        <p class="kicker">What happens next</p>
        <h3>Read. Score. Return the trust blueprint.</h3>
        <p class="muted">Jeni reads the source, maps the risk and proof signals, then shows the clearest next move, best front-door module, and safest monetization boundary without making the flow feel heavy.</p>
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
              <input id="query" name="query" placeholder="Write anything. Example: is this a scam, what trust is missing, or where does the money live?" value="${escapeHtml(values.query || '')}" />
            </div>
            <div class="field">
              <label for="website">Link or domain</label>
              <input id="website" name="website" data-url-normalize placeholder="example.com, article, product page, scam link, or brand site" value="${escapeHtml(values.website || '')}" />
            </div>
            <div class="field">
              <label for="goal">What are you looking for?</label>
              <select id="goal" name="goal">
                <option value="Understand the trust risk"${values.goal === 'Understand the trust risk' ? ' selected' : ''}>Understand the trust risk</option>
                <option value="Read the product opportunity"${values.goal === 'Read the product opportunity' ? ' selected' : ''}>Read the product opportunity</option>
                <option value="Find the receipt or share artifact"${values.goal === 'Find the receipt or share artifact' ? ' selected' : ''}>Find the receipt or share artifact</option>
                <option value="Find the money path"${values.goal === 'Find the money path' ? ' selected' : ''}>Find the money path</option>
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
                <option value="General trust signal"${!values.category || values.category === 'General trust signal' ? ' selected' : ''}>General trust signal</option>
                <option value="Safety + scams"${values.category === 'Safety + scams' ? ' selected' : ''}>Safety + scams</option>
                <option value="Media + truth"${values.category === 'Media + truth' ? ' selected' : ''}>Media + truth</option>
                <option value="Bills + savings"${values.category === 'Bills + savings' ? ' selected' : ''}>Bills + savings</option>
                <option value="Care + family"${values.category === 'Care + family' ? ' selected' : ''}>Care + family</option>
                <option value="Work + skill"${values.category === 'Work + skill' ? ' selected' : ''}>Work + skill</option>
                <option value="Home + property"${values.category === 'Home + property' ? ' selected' : ''}>Home + property</option>
                <option value="Civic + bureaucracy"${values.category === 'Civic + bureaucracy' ? ' selected' : ''}>Civic + bureaucracy</option>
                <option value="Identity + consent"${values.category === 'Identity + consent' ? ' selected' : ''}>Identity + consent</option>
                <option value="Commerce + creators"${values.category === 'Commerce + creators' ? ' selected' : ''}>Commerce + creators</option>
                <option value="Transitions + moving"${values.category === 'Transitions + moving' ? ' selected' : ''}>Transitions + moving</option>
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
                <span>I can share this source, and I understand Jeni will read public signal data to generate a trust scan. By submitting, I agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>, including contextual monetization rules that keep ads outside verifier and proof surfaces.</span>
              </label>
            </div>
          </div>
        </div>

        <p class="form-hint">Usually takes about 20 seconds. Optional details just help the scan lean harder into the right lane.</p>
        <p class="inline-note" data-intake-status${errorMessage ? ' data-state="warning"' : ''}>${escapeHtml(errorMessage || 'Jeni starts reading the signal the moment you submit it.')}</p>
        <div class="actions">
          <button class="btn" type="submit" data-intake-submit>Start Trust Scan</button>
          <a class="btn secondary" href="/case-studies">See the Ten Modules</a>
        </div>
      </form>
    </section>
  `;

  return layout('Trust Scan', content, '/intake');
}

function intakeSuccessPage(plan = 'Free') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Signal Received</p>
        <h2>We’re scanning the trust signal.</h2>
      </div>
      <p class="muted">The engine is reading the source now. The next step is a cleaner trust blueprint, not a dead queue page.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What happens now</p>
        <h3>The trust scan starts immediately.</h3>
        <p class="muted">Jeni is looking for risk, proof, module fit, ad-safe monetization logic, and the strongest receipt hiding inside the source.</p>
      </article>
      <article class="card">
        <p class="kicker">If contact is missing</p>
        <h3>The source was enough.</h3>
        <p class="muted">You can always add more context later. The first pass only needs a strong starting point.</p>
      </article>
    </section>
    <section class="card">
      <p class="section-label">Next Step</p>
      <h2>Find the trust break first. Move from proof after.</h2>
      <p class="muted">The point is to surface the clearest trust read quickly, not bury the product in extra ceremony.</p>
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
    return 'Preparing your trust scan.';
  }

  return job.progressLabel || {
    queued: 'Reading your source.',
    scanning: 'Mapping trust and provenance signals.',
    analyzing: 'Scoring risk, proof, module fit, and ad safety.',
    completed: 'Your trust blueprint is ready.',
    failed: 'We could not finish the trust blueprint.'
  }[job.status] || 'Preparing your trust scan.';
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
    category: prepared.category || 'General trust signal',
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
        <h3>Your trust scan is still loading.</h3>
        <p class="muted">Jeni will fill this with the strongest breaks and fastest wins as soon as the scan is finished.</p>
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
        <p class="section-label">Trust Scan</p>
        <h2>${escapeHtml(getClientDisplayName(client || {}))}</h2>
      </div>
      <p class="muted">Jeni is reading this source for trust breaks, best-module fit, receipt potential, ad-safe money logic, and the larger verification layer underneath it.</p>
    </section>

    <section class="card audit-shell" data-audit-page data-audit-id="${escapeHtml(auditJob.id)}">
      <div class="audit-loading">
        <p class="section-label">Live Scan</p>
        <h3 data-audit-progress>${escapeHtml(getAuditProgressCopy(auditJob))}</h3>
        <p class="muted">Searching the source for risk, proof, and the clearest next move...</p>
        <div class="mini-proof">
          <span class="pill" data-audit-status-pill>${escapeHtml(getAuditStatusLabel(auditJob.status))}</span>
          <span class="pill">${escapeHtml(client?.website || 'Signal pending')}</span>
          <span class="pill" data-audit-source-mode>${escapeHtml(sourceMode)}</span>
        </div>
      </div>

      <div class="audit-grid" data-audit-results${completed ? '' : ' hidden'}>
        <article class="card audit-score-card">
          <p class="kicker">Trust Blueprint Score</p>
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
              <h2>Where trust breaks or compounds first.</h2>
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
              <p class="section-label">Module Stack</p>
              <h2>The pieces that make the free trust surface real.</h2>
            </div>
            <p class="muted">This is where the output shifts from “interesting” to “worth using and safe to monetize.”</p>
          </div>
          <div class="feature-grid">
            <article class="card fix-card">
              <p class="kicker">Core promise</p>
              <h3>Headline, subheadline, and first CTA</h3>
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
              <p class="kicker">Receipt design</p>
              <h3>What people would naturally repost or forward.</h3>
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
              <h3>What larger trust layer this could become.</h3>
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
                <li>Tighten the first module until the trust break feels obvious.</li>
                <li>Prototype the receipt people naturally keep, repost, or forward.</li>
                <li>Keep monetization outside the proof zone while the verifier layer grows.</li>
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
        <p class="kicker">Scan Error</p>
        <h3>We could not finish the trust scan.</h3>
        <p class="muted" data-audit-error-message>${escapeHtml(auditJob.errorMessage || 'Try again with a reachable signal URL.')}</p>
      </article>
    </section>
  `;

  return layout('Trust Scan', content, `/audit/${auditJob.id}`);
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
        <p class="muted">Head back to the home page or start a new trust scan.</p>
        <div class="actions" style="justify-content: center;">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/intake">Start Trust Scan</a>
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
    res.status(500).json({ error: 'Could not start the audit right now.' });
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
    sendHtml(res, intakePage(normalizePlan(preparedBody.plan), preparedBody, 'Could not start the trust scan right now.'), 500);
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
      'See Modules',
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
      'Start Trust Scan',
      '/case-studies',
      'See Modules',
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
