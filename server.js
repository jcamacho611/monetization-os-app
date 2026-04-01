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
  name: 'Zumi',
  category: 'AI revenue operator',
  audience: 'businesses, brands, and booking-led teams',
  slogan: 'Nothing slips. Everything closes.',
  headline: 'Fix your website. Get more bookings.',
  subhead: 'Zumi finds what is costing you bookings, trust, and conversions, then prepares cleaner fixes you can approve fast.',
  supportingLine: 'Free audit first. Clear fixes next. Approval first.',
  metaDescription: 'Zumi is an AI revenue operator for booking-based businesses. It scans websites, finds conversion leaks, improves trust and booking flow, and prepares approval-first fixes.',
  proofNote: 'Illustrative launch scenarios built to show how Zumi can improve bookings, trust, and conversion before a full live customer dataset exists.',
  algorithmName: 'Zumi Adapt Engine'
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
    businessName: input.businessName || 'Zumi Preview',
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
    previewSummary: `Zumi would search ${location}, verify ${targetLabel.toLowerCase()} quality automatically, then move the strongest results into a ${base.engineName.toLowerCase()} workflow.`
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
    return `Hi ${owner}, quick follow-up for ${businessName}. Zumi mapped your business to the ${blueprint.engineName}, which means the biggest win is to ${blueprint.offerAngle}. If you want, I can send the recommended next steps today.`;
  }

  return `Hi ${owner},

I wanted to follow up on ${businessName} and the goal around ${goal}. Zumi mapped the business to a ${blueprint.motionLabel.toLowerCase()} workflow, and the biggest opportunity right now is to ${blueprint.offerAngle}.

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
    `Detected Zumi engine: ${blueprint.engineName}.`,
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
    serviceType: 'AI revenue operator',
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
      <meta property="og:image" content="https://zumi.onrender.com/hero-operator.svg" />
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
                ${navLink('/na-kit', 'NA Kit', currentPath)}
                ${navLink('/how-it-works', 'How It Works', currentPath)}
                ${navLink('/industries', 'Industries', currentPath)}
                ${navLink('/pricing', 'Pricing', currentPath)}
              </nav>
              <a class="btn nav-cta" href="/intake">Free Audit</a>
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
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/authorization">Authorization</a>
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
      <p class="muted">Use Zumi for inquiry follow-up, missed-call recovery, reactivation, review requests, consult nudges, and booking reminders without losing the premium tone.</p>
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
        <p class="section-label">AI Revenue Operator</p>
        <h1>Search for the revenue hiding inside your website.</h1>
        <p class="lede">Zumi reads the site like an operator: trust, clarity, booking flow, follow-up pressure, and the weak spots quietly costing you clients.</p>
        <form class="entry-search" method="GET" action="/intake">
          <input name="website" type="url" placeholder="Enter your website to begin" aria-label="Website URL" required />
          <button class="btn" type="submit">Begin Audit</button>
        </form>
        <p class="supporting-line">Nothing slips. Everything closes.</p>
        <div class="entry-proof">
          <span class="pill">Free audit first</span>
          <span class="pill">Approval-first fixes</span>
          <span class="pill">$149 first fix</span>
          <span class="pill">${escapeHtml(String(Math.max(clients.length, 3)))} active operator records</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card spotlight">
          <div class="spotlight-visual">
            <img class="spotlight-image" src="/hero-operator.svg" alt="Cinematic AI website scan scene showing revenue leaks, trust signals, and conversion improvements." />
          </div>
          <p class="section-label">Your website should close.</p>
          <h3>From traffic to trust to bookings.</h3>
          <p class="muted">Zumi starts with the site, but it thinks like a revenue operator. It finds where attention drops, trust breaks, and next steps get missed.</p>
          <div class="mini-proof">
            <span class="pill">Instant audit</span>
            <span class="pill">Messaging center</span>
            <span class="pill">Fix center</span>
          </div>
        </article>
        <article class="card">
          <p class="section-label">Why owners buy</p>
          <h3>Clearer revenue recovery. Less agency drag.</h3>
          <ul class="list-clean">
            <li>See what is hurting bookings before paying for a rebuild.</li>
            <li>Fix the homepage, trust layer, booking flow, and follow-up pressure first.</li>
            <li>Keep every change approval-first so the brand stays protected.</li>
            <li>Use Zumi like an operator, not another passive dashboard.</li>
          </ul>
          <div class="live-metrics">
            <div class="signal-chip">
              <span class="signal-value">Instant</span>
              <span class="signal-label">audit start</span>
            </div>
            <div class="signal-chip">
              <span class="signal-value">24-48h</span>
              <span class="signal-label">first fixes after approval</span>
            </div>
            <div class="signal-chip">
              <span class="signal-value">$299/mo</span>
              <span class="signal-label">operator plan</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Revenue Leaks</p>
          <h2>Most websites lose money in the same four places.</h2>
        </div>
        <p class="muted">The site looks fine on the surface, but conversion drops when the message, trust, and next step are weak.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Leak 01</p>
          <h3>Weak first impression</h3>
          <p class="muted">Vague headlines and soft offers make visitors bounce before they trust the page.</p>
        </article>
        <article class="card">
          <p class="kicker">Leak 02</p>
          <h3>Cluttered pages</h3>
          <p class="muted">Too much noise makes it harder to understand the offer or take the next step.</p>
        </article>
        <article class="card">
          <p class="kicker">Leak 03</p>
          <h3>Missing trust</h3>
          <p class="muted">Weak proof, buried reviews, and thin service pages make high-intent visitors hesitate.</p>
        </article>
        <article class="card">
          <p class="kicker">Leak 04</p>
          <h3>Broken conversion flow</h3>
          <p class="muted">Traffic from Instagram, search, ads, or referrals gets wasted when the next step feels unclear.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">How Zumi Works</p>
          <h2>Four clean steps. No agency drag.</h2>
        </div>
        <p class="muted">The process stays obvious so the owner can move fast without giving up control.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Step 01</p>
          <h3>Send the site</h3>
          <p class="muted">Start with the URL, the business type, and the biggest problem.</p>
        </article>
        <article class="card">
          <p class="kicker">Step 02</p>
          <h3>See the audit</h3>
          <p class="muted">Zumi shows what is hurting bookings, trust, or sales first.</p>
        </article>
        <article class="card">
          <p class="kicker">Step 03</p>
          <h3>Approve the fixes</h3>
          <p class="muted">Cleaner pages, stronger CTAs, better trust, better flow.</p>
        </article>
        <article class="card">
          <p class="kicker">Step 04</p>
          <h3>Keep improving</h3>
          <p class="muted">Stay on the operator plan if you want the site to keep getting sharper.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Operator Surface</p>
          <h2>Phase 1 is already more than an audit.</h2>
        </div>
        <p class="muted">The product starts with the website, then expands into messaging, fixes, and operator visibility around the clearest next move.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Instant Audit</p>
          <h3>See the leaks first.</h3>
          <p class="muted">Overall score, clarity, trust, booking friction, quick wins, and rewrite-ready direction in one premium deliverable.</p>
        </article>
        <article class="card">
          <p class="kicker">Messaging Center</p>
          <h3>Recover the conversation.</h3>
          <p class="muted">Generate inquiry follow-up, missed-call recovery, consult nudges, reactivation, review asks, and reminders without losing tone.</p>
        </article>
        <article class="card">
          <p class="kicker">Fix Center</p>
          <h3>Draft the better version.</h3>
          <p class="muted">Hero rewrites, CTA rewrites, trust recommendations, booking-flow changes, and approval-first fixes all live together.</p>
        </article>
        <article class="card">
          <p class="kicker">Operator Queue</p>
          <h3>Work the best next move.</h3>
          <p class="muted">See lead status, contact priority, call notes, audit links, and what should happen next without digging through clutter.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Before / After</p>
          <h2>Cleaner story. Stronger trust. Easier booking.</h2>
        </div>
        <p class="muted">The transformation should feel obvious in seconds, not only after a long explanation.</p>
      </div>
      <div class="solution-hero">
        <article class="card art-panel">
          <div class="story-visual-wrap story-visual-large">
            <img class="story-visual" src="/transformation-scene.svg" alt="Before and after website transformation showing cleaner copy, stronger CTA, and clearer booking flow." />
          </div>
        </article>
        <article class="card art-panel">
          <p class="kicker">Transformation</p>
          <h3>From cluttered and hesitant to clear and conversion-ready.</h3>
          <ul class="list-clean">
            <li>Before: weak headline, hidden trust, vague CTA.</li>
            <li>After: sharper message, stronger proof, obvious next step.</li>
            <li>Before: traffic leaks from social, search, and referrals.</li>
            <li>After: cleaner flow that turns more visits into conversations.</li>
          </ul>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Who It Helps</p>
          <h2>Built for businesses that rely on trust and conversion.</h2>
        </div>
        <p class="muted">The model works anywhere a weak site is making bookings, leads, or sales harder than they should be.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Service Businesses</p>
          <h3>Cleaner path to the call</h3>
          <p class="muted">Urgent buyers convert better when the page feels trustworthy and the next step is obvious.</p>
        </article>
        <article class="card">
          <p class="kicker">Clinics + Studios</p>
          <h3>Stronger trust before the consult</h3>
          <p class="muted">Premium presentation and cleaner service pages make higher-ticket decisions easier.</p>
        </article>
        <article class="card">
          <p class="kicker">Brands + Stores</p>
          <h3>Better social-to-site conversion</h3>
          <p class="muted">Traffic from Instagram and paid traffic works harder when the site is easier to buy from.</p>
        </article>
        <article class="card">
          <p class="kicker">High-Ticket Teams</p>
          <h3>Stronger trust before the sale</h3>
          <p class="muted">If the website looks weak, the close gets harder. Zumi fixes that layer first.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Proof</p>
          <h2>Transformation stories, shown clearly.</h2>
        </div>
        <p class="muted">Framed as illustrative scenarios until a larger live dataset is public.</p>
      </div>
      <div class="grid-3">
        ${caseStudies.slice(0, 3).map(renderCaseStudyPreview).join('')}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Why It Feels Safe</p>
          <h2>Fast does not have to feel reckless.</h2>
        </div>
        <p class="muted">Permission-based access and preview-first changes make the process easier to trust.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Access</p>
          <h3>Permission based</h3>
          <p class="muted">Zumi only works with approved access.</p>
        </article>
        <article class="card">
          <p class="kicker">Preview</p>
          <h3>Preview before publish</h3>
          <p class="muted">The owner sees the direction before anything changes publicly.</p>
        </article>
        <article class="card">
          <p class="kicker">Control</p>
          <h3>Owner approval required</h3>
          <p class="muted">Nothing important goes live without review.</p>
        </article>
        <article class="card">
          <p class="kicker">History</p>
          <h3>Rollback ready</h3>
          <p class="muted">Changes should always stay traceable and reversible.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Pricing</p>
          <h2>Priced like a smarter first step, not a giant agency commitment.</h2>
        </div>
        <p class="muted">Agencies can charge thousands before anything is proven. Zumi starts with a free audit and a clear first fix.</p>
      </div>
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Contrast</p>
          <h3>Built to feel like a premium bargain.</h3>
          <ul class="list-clean">
            <li>Free audit to show what is broken first.</li>
            <li>$149 first fix instead of a full rebuild quote.</li>
            <li>$299/mo if you want the site improving every month.</li>
          </ul>
        </article>
        <article class="card">
          <p class="kicker">What you get</p>
          <h3>Real work, not just another dashboard.</h3>
          <ul class="list-clean">
            ${offerServices.map((service) => `<li>${escapeHtml(service)}</li>`).join('')}
          </ul>
        </article>
      </div>
      <div class="grid-3" style="margin-top: 18px;">
        ${pricingPlans.map(renderPricingCard).join('')}
      </div>
      <div class="detail-grid" style="margin-top: 18px;">
        ${valueReasons.map((reason) => `
          <article class="card">
            <p class="kicker">Why businesses buy</p>
            <h3>${escapeHtml(reason.title)}</h3>
            <p class="muted">${escapeHtml(reason.body)}</p>
          </article>
        `).join('')}
      </div>
      <article class="card" style="margin-top: 18px;">
        <p class="section-label">Final CTA</p>
        <h2>Get the audit. See the leak. Decide after that.</h2>
        <p class="muted">Start with the free website audit. If the opportunity is real, move into the first fix plan. No long-term contracts. Cancel anytime.</p>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/pricing">See Pricing</a>
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
        <p class="section-label">Proof</p>
        <h2>Illustrative transformation stories.</h2>
      </div>
      <p class="muted">Built to show what was broken, what changed, and why the cleaner version converts better.</p>
    </section>
    <section class="grid-3">
      ${caseStudies.map((study) => `
        <article class="card" id="${escapeHtml(study.slug)}">
          <div class="story-visual-wrap">
            <img class="story-visual" src="${escapeHtml(study.image)}" alt="${escapeHtml(study.imageAlt)}" loading="lazy" />
          </div>
          <p class="kicker">Illustrative Scenario</p>
          <h3>${escapeHtml(study.businessName)}</h3>
          <p class="muted">${escapeHtml(study.challenge)}</p>
          <ul class="list-clean">${study.system.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          <div class="mini-proof">
            ${study.metrics.map((metric) => `<span class="pill">${escapeHtml(metric.value)} ${escapeHtml(metric.label)}</span>`).join('')}
          </div>
        </article>
      `).join('')}
    </section>
    <section class="card" style="margin-top: 24px;">
      <p class="kicker">Next Move</p>
      <h3>Get the audit before you commit to the rebuild.</h3>
      <p class="muted">The point is to see the opportunity clearly, not jump into a giant project blindly.</p>
      <div class="actions">
        <a class="btn" href="/intake">Get My Free Website Audit</a>
        <a class="btn secondary" href="/pricing">See Pricing</a>
      </div>
    </section>
  `;

  return layout('Proof', content, '/case-studies');
}

function solutionsPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Solutions</p>
        <h2>What Zumi can improve.</h2>
      </div>
      <p class="muted">Each module solves a clear problem without turning the site into a feature dump.</p>
    </section>
    <section class="grid-3">
      ${solutionPages.map(renderSolutionPreview).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Simple</p>
          <h3>Lead with the problem that hurts first.</h3>
          <p class="muted">Some buyers care about booking flow. Others care about proof or follow-up. Zumi can meet them where they are.</p>
        </article>
        <article class="card">
          <p class="kicker">Next Move</p>
          <h3>Start with one clean use case.</h3>
          <div class="actions">
            <a class="btn" href="/intake">Get My Free Website Audit</a>
            <a class="btn secondary" href="/pricing">See Pricing</a>
          </div>
        </article>
      </div>
    </section>
  `;

  return layout('Solutions', content, '/solutions');
}

function solutionPage(item) {
  const related = solutionPages
    .filter((page) => page.slug !== item.slug)
    .slice(0, 3)
    .map(renderSolutionPreview)
    .join('');

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">${escapeHtml(item.eyebrow)}</p>
        <h2>${escapeHtml(item.headline)}</h2>
        <p class="muted">${escapeHtml(item.summary)}</p>
        <div class="mini-proof">
          <span class="pill">${escapeHtml(item.promise)}</span>
          <span class="pill">${escapeHtml(item.bestFor)}</span>
        </div>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/pricing">See Pricing</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="${escapeHtml(item.visual)}" alt="${escapeHtml(item.visualAlt)}" />
        </div>
        <div class="metric-grid">
          ${item.metrics.map((metric) => `
            <div class="metric">
              <span class="metric-value">${escapeHtml(metric.value)}</span>
              <span class="metric-label">${escapeHtml(metric.label)}</span>
            </div>
          `).join('')}
        </div>
      </article>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">What it does</p>
          <h3>The core pieces.</h3>
          <ul class="list-clean">${item.deliverables.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
        </article>
        <article class="card">
          <p class="kicker">Outcome</p>
          <h3>Why it matters.</h3>
          <ul class="list-clean">${item.outcomes.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Related Modules</p>
          <h2>Related modules.</h2>
        </div>
        <p class="muted">Keep the story simple and open the next module only when it helps the sale.</p>
      </div>
      <div class="grid-3">${related}</div>
    </section>
  `;

  return layout(item.label, content, solutionHref(item.slug));
}

function pricingPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Pricing</p>
        <h2>Start small. Keep the upside.</h2>
        <p class="muted">Zumi is designed to feel safer than a full agency commitment and more valuable than a DIY builder.</p>
        <div class="mini-proof">
          <span class="pill">Free audit</span>
          <span class="pill">$149 first fix</span>
          <span class="pill">$299/mo operator</span>
        </div>
      </article>
      <article class="card art-panel">
        <p class="kicker">Pricing Contrast</p>
        <h3>Agencies can charge thousands before anything is proven.</h3>
        <p class="muted">Zumi gives you the audit first, a lower-friction first fix, and monthly support only if you want the site to keep improving.</p>
        <div class="metric-grid">
          <div class="metric">
            <span class="metric-copy">$0</span>
            <span class="metric-label">Audit to find the leak</span>
          </div>
          <div class="metric">
            <span class="metric-copy">$149</span>
            <span class="metric-label">First fix starting point</span>
          </div>
        </div>
      </article>
    </section>
    <section class="grid-3">
      ${pricingPlans.map(renderPricingCard).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Included</p>
          <h3>What the service actually covers.</h3>
          <ul class="list-clean">
            ${offerServices.map((service) => `<li>${escapeHtml(service)}</li>`).join('')}
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Risk Removal</p>
          <h3>Easy to try. Easy to leave if it is not worth it.</h3>
          <ul class="list-clean">
            <li>Free audit before you buy anything.</li>
            <li>Approval-first changes before anything goes live.</li>
            <li>No long-term contracts. Cancel anytime.</li>
          </ul>
          <div class="actions">
            <a class="btn" href="/intake">Get My Free Website Audit</a>
            <a class="btn secondary" href="/how-it-works">How It Works</a>
          </div>
        </article>
      </div>
    </section>
    <section class="section">
      <div class="detail-grid">
        ${valueReasons.map((reason) => `
          <article class="card">
            <p class="kicker">Why businesses buy</p>
            <h3>${escapeHtml(reason.title)}</h3>
            <p class="muted">${escapeHtml(reason.body)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `;

  return layout('Pricing', content, '/pricing');
}

function howItWorksPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">How It Works</p>
        <h2>Send the site. See the leak. Approve the fix.</h2>
        <p class="muted">The customer journey stays simple even if the work underneath is more powerful.</p>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/authorization">See Trust</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-operator.svg" alt="Zumi website operator workflow showing scans, fixes, and approval-first publishing." />
        </div>
      </article>
    </section>
    <section class="feature-grid">
      <article class="card">
        <p class="kicker">1</p>
        <h3>Send your site</h3>
        <p class="muted">Start with the URL and the main problem.</p>
      </article>
      <article class="card">
        <p class="kicker">2</p>
        <h3>Get the audit</h3>
        <p class="muted">Zumi shows what is hurting trust or sales.</p>
      </article>
      <article class="card">
        <p class="kicker">3</p>
        <h3>Approve the first fixes</h3>
        <p class="muted">Apply the work that matters first.</p>
      </article>
      <article class="card">
        <p class="kicker">4</p>
        <h3>Keep improving</h3>
        <p class="muted">Stay on monthly operator support if it is working.</p>
      </article>
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
      <article class="card">
        <p class="kicker">Traffic</p>
        <h3>Works with the channels already making money.</h3>
        <p class="muted">Instagram traffic, DMs, referrals, cold outreach, and direct visits can all feed the same free-audit funnel.</p>
      </article>
      <article class="card">
        <p class="kicker">Control</p>
        <h3>Approve the fixes</h3>
        <p class="muted">Nothing important goes live without review.</p>
      </article>
    </section>
  `;

  return layout('How It Works', content, '/how-it-works');
}

function discoverPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Scan</p>
        <h2>Read the whole site before trying to fix it.</h2>
        <p class="muted">Zumi starts by seeing the site clearly: pages, flow, trust, booking steps, and what feels weak.</p>
        <div class="mini-proof">
          <span class="pill">Site map</span>
          <span class="pill">Brand context</span>
          <span class="pill">Booking friction</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Zumi scan dashboard with page map and issue highlights." />
        </div>
      </article>
    </section>
    <section class="grid-3">${operatorFixes.map((item) => `
      <article class="card">
        <p class="kicker">Scan Output</p>
        <h3>${escapeHtml(item.label)}</h3>
        <p class="muted">${escapeHtml(item.body)}</p>
      </article>
    `).join('')}</section>
  `;

  return layout('Discover', content, '/discover');
}

function verifyPage() {
  const cards = [
    {
      name: 'Permission Scope',
      headline: 'Only request the connector access Zumi actually needs.',
      body: 'The verification layer starts before the scan. Narrow scopes, revocable access, and explicit owner approval are the baseline.'
    },
    {
      name: 'Preview Safety',
      headline: 'Stage material in preview mode before it becomes public.',
      body: 'The owner should be able to see the before-and-after state, approve what changed, and reject what does not fit the brand.'
    },
    {
      name: 'Rollback',
      headline: 'Keep a path back through revisions, snapshots, themes, or draft history.',
      body: 'If a change is wrong, the product should be able to explain what happened and help restore a safer previous state.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Review + Approve</p>
        <h2>Trust is a feature, not a footnote.</h2>
        <p class="muted">The safest version of Zumi is the one that makes access, previews, approvals, and rollback feel obvious.</p>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Zumi approval dashboard showing staged website updates and verification checkpoints." />
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
      name: 'Bookings',
      headline: 'Turn a cleaner site into more booked consults, appointments, and follow-up wins.',
      body: 'Once the pages are stronger, Zumi can help move buyers through faster response, better CTAs, and cleaner next-step messaging.'
    },
    {
      name: 'Retention',
      headline: 'Use review prompts, reactivation, and post-visit follow-up to keep revenue compounding.',
      body: 'The operator layer is stronger when it does not stop at the page. It should also help the business recover and retain more of the demand it already has.'
    },
    {
      name: 'Control',
      headline: 'Keep the owner in control while Zumi handles the repetitive operator work.',
      body: 'That is what makes the product feel premium instead of gimmicky: cleaner site, cleaner workflows, cleaner handoff into growth.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Grow</p>
        <h2>After the cleanup, push harder on bookings.</h2>
        <p class="muted">Once the site is cleaner, Zumi can support follow-up, proof, and next-step messaging.</p>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/case-studies">See Proof</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-success-owners.svg" alt="Successful business owners and booking workflows powered by Zumi." />
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
        <p class="section-label">Industries</p>
        <h2>Where Zumi fits best.</h2>
        <p class="muted">The model works anywhere the website needs to earn more trust and convert more intent.</p>
      </article>
      <article class="card art-panel">
        <p class="kicker">Common thread</p>
        <h3>Weak websites make good businesses look smaller than they are.</h3>
        <p class="muted">Zumi is designed to fix that perception fast, then turn more of the traffic into bookings or sales.</p>
      </article>
    </section>
    <section class="grid-3">${industrySegments.map(renderIndustryCard).join('')}</section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Featured Vertical</p>
          <h3>Med spas are one strong fit, not the only fit.</h3>
          <p class="muted">The same system also works for service businesses, clinics, creator brands, and stores that need a cleaner conversion path.</p>
          <div class="actions">
            <a class="btn" href="/med-spas">Open Med Spa Page</a>
            <a class="btn secondary" href="/pricing">See Pricing</a>
          </div>
        </article>
        <article class="card">
          <p class="kicker">Signal</p>
          <h3>If trust and conversion matter, Zumi fits.</h3>
          <p class="muted">That is the real filter, more than the business category itself.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Industries', content, '/industries');
}

function medSpaPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Med Spas</p>
        <h2>Built for med spas that need the site to feel as premium as the treatment.</h2>
        <p class="muted">Cleaner service pages, sharper trust, and easier consult flow make the biggest difference first.</p>
        <div class="mini-proof">
          <span class="pill">Luxury but simple</span>
          <span class="pill">Booking focused</span>
          <span class="pill">Approval first</span>
        </div>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/how-it-works">See How It Works</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-success-owners.svg" alt="Successful med spa owners using Zumi to improve their site and bookings." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">What Improves First</p>
          <h2>The biggest med spa wins come from clarity and trust.</h2>
        </div>
        <p class="muted">Cleaner pages, stronger trust, and a smoother booking path usually move the needle first.</p>
      </div>
      <div class="feature-grid">${operatorFixes.slice(0, 4).map((item) => `
        <article class="card">
          <p class="kicker">Fix</p>
          <h3>${escapeHtml(item.label)}</h3>
          <p class="muted">${escapeHtml(item.body)}</p>
        </article>
      `).join('')}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Why It Fits</p>
          <h2>Built for the way med spas sell.</h2>
        </div>
        <p class="muted">The site has to feel premium, the offers have to feel clear, and the booking path cannot feel messy.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Treatment Pages</p>
          <h3>Cleaner service organization</h3>
          <p class="muted">Help people understand what you offer fast.</p>
        </article>
        <article class="card">
          <p class="kicker">Trust</p>
          <h3>Better proof placement</h3>
          <p class="muted">Reviews, before-and-after positioning, and story where they matter.</p>
        </article>
        <article class="card">
          <p class="kicker">Bookings</p>
          <h3>Smoother inquiry flow</h3>
          <p class="muted">Make the next step feel obvious from the first visit.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Trust</p>
          <h2>Safe by design.</h2>
        </div>
        <p class="muted">Zumi uses permission-based access, preview-before-publish, and owner approval.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">Access</p>
          <h3>Permission based</h3>
          <p class="muted">Zumi only works with approved access.</p>
        </article>
        <article class="card">
          <p class="kicker">Review</p>
          <h3>Preview before publish</h3>
          <p class="muted">Changes are reviewed first.</p>
        </article>
        <article class="card">
          <p class="kicker">Control</p>
          <h3>Owner approval required</h3>
          <p class="muted">The med spa stays in control.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <article class="card">
        <p class="section-label">Next Step</p>
        <h2>Start with the current site, not a giant rebuild quote.</h2>
        <p class="muted">Send the site, get the audit, and review the first fixes before anything changes.</p>
        <div class="actions">
          <a class="btn" href="/intake">Get My Free Website Audit</a>
          <a class="btn secondary" href="/authorization">See Authorization</a>
        </div>
      </article>
    </section>
  `;

  return layout('Med Spas', content, '/med-spas');
}

function operatorArchitecturePage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Operator Architecture</p>
        <h2>The simple version of what happens underneath.</h2>
        <p class="muted">Connect safely, scan the site, prepare cleaner drafts, then publish only approved changes.</p>
        <div class="mini-proof">
          <span class="pill">Scanner</span>
          <span class="pill">Brand Brain</span>
          <span class="pill">Draft-first publishing</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="AI website operator architecture with scanning, approval, and publishing layers." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Modules</p>
          <h2>Three clean layers.</h2>
        </div>
        <p class="muted">Zumi works best when each part of the job stays focused.</p>
      </div>
      <div class="feature-grid">
        <article class="card">
          <p class="kicker">1</p>
          <h3>Scan</h3>
          <p class="muted">Read the site, map the pages, and find what feels weak.</p>
        </article>
        <article class="card">
          <p class="kicker">2</p>
          <h3>Prepare</h3>
          <p class="muted">Draft cleaner copy, structure, and booking improvements.</p>
        </article>
        <article class="card">
          <p class="kicker">3</p>
          <h3>Approve</h3>
          <p class="muted">Keep the owner in control before anything goes live.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Human Review</p>
          <h3>Draft-first publishing keeps it safe.</h3>
          <p class="muted">The point is not instant publishing. The point is cleaner work with safer review.</p>
        </article>
        <article class="card">
          <p class="kicker">Reality</p>
          <h3>Some parts stay under the hood.</h3>
          <p class="muted">Permissions, source limits, and platform rules still matter, even if the front-end feels simple.</p>
        </article>
      </div>
    </section>
  `;

  return layout('Operator Architecture', content, '/operator-architecture');
}

function aboutPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">About Zumi</p>
        <h2>Zumi is built for owners who know their site should be doing more.</h2>
        <p class="muted">It helps businesses clean up the site, improve bookings, and approve better updates without getting trapped in a messy agency process.</p>
        <div class="mini-proof">
          <span class="pill">Businesses + brands</span>
          <span class="pill">Approval-first</span>
          <span class="pill">Built for growth</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-success-owners.svg" alt="Successful business owners using a polished Zumi operator dashboard." />
        </div>
      </article>
    </section>

    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">What it is</p>
          <h3>A cleaner way to fix a site that is underperforming.</h3>
          <p class="muted">Zumi scans the site, finds what is hurting conversions, and prepares better updates.</p>
        </article>
        <article class="card">
          <p class="kicker">Who it helps</p>
          <h3>Businesses, brands, and booking-led teams.</h3>
          <p class="muted">Med spas, clinics, service businesses, creator brands, and stores that need a cleaner sales experience.</p>
        </article>
        <article class="card">
          <p class="kicker">Why it exists</p>
          <h3>To turn a weak site into a stronger sales asset.</h3>
          <p class="muted">The goal is a site that feels easier to trust and easier to book from.</p>
        </article>
        <article class="card">
          <p class="kicker">How it works</p>
          <h3>Audit, fix, review, keep improving.</h3>
          <p class="muted">Zumi prepares the work. The owner still decides what goes live.</p>
        </article>
        <article class="card">
          <p class="kicker">Why approval-first matters</p>
          <h3>Because premium should still feel safe.</h3>
          <p class="muted">The owner should never feel locked out of the brand or surprised by a live change.</p>
        </article>
        <article class="card">
          <p class="kicker">Why it feels different</p>
          <h3>It is easier than an agency and smarter than a template.</h3>
          <p class="muted">That balance is the whole product: speed, clarity, and control in the same system.</p>
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
      <p class="muted">Zumi only needs the information required to run scans, prepare updates, and keep the approval flow clear.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What Zumi may collect</p>
        <ul class="list-clean">
          <li>Business contact details from intake.</li>
          <li>Website content and structure needed for scans.</li>
          <li>Connector details from approved integrations.</li>
          <li>Approval history and workflow activity.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">How it is used</p>
        <ul class="list-clean">
          <li>To run scans and prepare cleaner updates.</li>
          <li>To maintain approval records and safer publishing workflows.</li>
          <li>To support product security and customer support.</li>
        </ul>
      </article>
      <article class="card">
        <p class="kicker">Your control</p>
        <p class="muted">Connector access should be revocable, and data requests or deletion requests should be supported when required.</p>
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
      <p class="muted">Zumi prepares scans and draft updates. The business owner still controls access and publishing decisions.</p>
    </section>
    <section class="feature-grid">
      <article class="card">
        <p class="kicker">Approval</p>
        <h3>The owner approves access and publishing authority.</h3>
        <p class="muted">Zumi may prepare drafts and previews, but the owner remains responsible for what is ultimately approved and published.</p>
      </article>
      <article class="card">
        <p class="kicker">Content responsibility</p>
        <h3>AI output is draft material, not unquestionable truth.</h3>
        <p class="muted">Businesses should review claims, offers, and regulated content carefully before publishing.</p>
      </article>
      <article class="card">
        <p class="kicker">Service limits</p>
        <h3>Zumi should be sold honestly and used within platform rules.</h3>
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
        <p class="section-label">Authorization Pack</p>
        <h2>Access should be clear from the start.</h2>
        <p class="muted">This is the owner-facing consent layer. It explains what Zumi may connect to, what it may draft, and what still needs approval before anything goes live.</p>
        <div class="mini-proof">
          <span class="pill">Least privilege</span>
          <span class="pill">Revocable access</span>
          <span class="pill">Preview before publish</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Zumi authorization and approval workflow." />
        </div>
      </article>
    </section>

    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What you approve</p>
        <p class="muted">You approve the connectors, the scan, and the right for Zumi to prepare draft updates inside the systems you choose.</p>
      </article>
      <article class="card">
        <p class="kicker">What still needs approval</p>
        <p class="muted">Live changes should stay approval-first. Drafts and previews do not become public until you approve them.</p>
      </article>
    </section>

    <section class="section">
      <div class="feature-grid">${trustHighlights.map(renderPillarCard).join('')}</div>
    </section>
  `;

  return layout('Authorization', content, '/authorization');
}

function intakePage(selectedPlan = 'Starter', values = {}, errorMessage = '') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Intake</p>
        <h2>Get your free website audit.</h2>
      </div>
      <p class="muted">Keep it simple. Send the site, tell Zumi the biggest problem, and get the first clear next step.</p>
    </section>
    <section class="detail-grid" style="margin-bottom: 18px;">
      <article class="card">
        <p class="kicker">What happens next</p>
        <h3>Audit. Fix. Review.</h3>
        <p class="muted">After intake, Zumi prepares the first audit and the highest-priority fixes for the site.</p>
      </article>
      <article class="card">
        <p class="kicker">Low friction</p>
        <h3>Start with the website only.</h3>
        <p class="muted">Contact details help later, but the free audit can start from the site alone.</p>
      </article>
    </section>
    <section class="card intake-shell">
      <form method="POST" action="/intake" data-intake-form>
        <input type="hidden" name="plan" value="${escapeHtml(normalizePlan(selectedPlan))}" />
        <input type="hidden" name="businessSize" value="small-team" />
        <input type="hidden" name="leadVolume" value="steady" />
        <input type="hidden" name="salesMotion" value="mixed" />
        <input type="hidden" name="preferredChannel" value="email" />

        <div class="form-section">
          <div class="form-section-head">
            <p class="kicker">Start Here</p>
            <h3>Website first</h3>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="website">Website URL</label>
              <input id="website" required name="website" placeholder="https://example.com" value="${escapeHtml(values.website || '')}" />
            </div>
            <div class="field">
              <label for="goal">Biggest problem</label>
              <select id="goal" name="goal">
                <option value="Not getting enough bookings"${values.goal === 'Not getting enough bookings' ? ' selected' : ''}>Not getting bookings</option>
                <option value="Low traffic"${values.goal === 'Low traffic' ? ' selected' : ''}>Low traffic</option>
                <option value="Bad design or clutter"${values.goal === 'Bad design or clutter' ? ' selected' : ''}>Bad design</option>
                <option value="Weak trust or proof"${values.goal === 'Weak trust or proof' ? ' selected' : ''}>Weak trust</option>
                <option value="Not sure"${!values.goal || values.goal === 'Not sure' ? ' selected' : ''}>Not sure</option>
              </select>
            </div>
          </div>
        </div>

        <details class="advanced-panel">
          <summary>Add optional details</summary>
          <div class="form-grid">
            <div class="field">
              <label for="businessName">Business name</label>
              <input id="businessName" name="businessName" placeholder="Your business name" value="${escapeHtml(values.businessName || '')}" />
            </div>
            <div class="field">
              <label for="category">Business type</label>
              <select id="category" name="category">
                <option value="General Business"${!values.category || values.category === 'General Business' ? ' selected' : ''}>General Business</option>
                <option value="Service Business"${values.category === 'Service Business' ? ' selected' : ''}>Service Business</option>
                <option value="Clinic / Studio"${values.category === 'Clinic / Studio' ? ' selected' : ''}>Clinic / Studio</option>
                <option value="Brand / Store"${values.category === 'Brand / Store' ? ' selected' : ''}>Brand / Store</option>
                <option value="Med Spa"${values.category === 'Med Spa' ? ' selected' : ''}>Med Spa</option>
                <option value="Beauty Brand"${values.category === 'Beauty Brand' ? ' selected' : ''}>Beauty Brand</option>
                <option value="Creator Brand"${values.category === 'Creator Brand' ? ' selected' : ''}>Creator Brand</option>
                <option value="Clothing Brand"${values.category === 'Clothing Brand' ? ' selected' : ''}>Clothing Brand</option>
                <option value="Other"${values.category === 'Other' ? ' selected' : ''}>Other</option>
              </select>
            </div>
            <div class="field">
              <label for="owner">Your name</label>
              <input id="owner" name="owner" placeholder="Your name" value="${escapeHtml(values.owner || '')}" />
            </div>
            <div class="field">
              <label for="email">Best email</label>
              <input id="email" type="email" name="email" placeholder="owner@example.com" value="${escapeHtml(values.email || '')}" />
            </div>
            <div class="field">
              <label for="phone">Best phone</label>
              <input id="phone" name="phone" placeholder="(555) 000-0000" value="${escapeHtml(values.phone || '')}" />
            </div>
            <div class="field">
              <label for="mainServices">Main service or offer</label>
              <input id="mainServices" name="mainServices" placeholder="Botox, plumbing, web design, apparel..." value="${escapeHtml(values.mainServices || '')}" />
            </div>
            <div class="field">
              <label for="sitePlatform">Website platform</label>
              <select id="sitePlatform" name="sitePlatform">
                <option value="wordpress"${values.sitePlatform === 'wordpress' ? ' selected' : ''}>WordPress</option>
                <option value="webflow"${values.sitePlatform === 'webflow' ? ' selected' : ''}>Webflow</option>
                <option value="shopify"${values.sitePlatform === 'shopify' ? ' selected' : ''}>Shopify</option>
                <option value="custom"${!values.sitePlatform || values.sitePlatform === 'custom' ? ' selected' : ''}>Custom / other</option>
              </select>
            </div>
            <div class="field">
              <label for="bookingSystem">Booking platform</label>
              <input id="bookingSystem" name="bookingSystem" placeholder="Vagaro, Calendly, GlossGenius..." value="${escapeHtml(values.bookingSystem || '')}" />
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
              <textarea id="notes" name="notes" placeholder="Anything important about the brand, site, or booking flow?">${escapeHtml(values.notes || '')}</textarea>
            </div>
          </div>
        </details>

        <div class="form-section">
          <div class="form-section-head">
            <p class="kicker">Approval</p>
            <h3>Clear consent</h3>
          </div>
          <div class="form-grid">
            <div class="field full">
              <label class="checkbox-field">
                <input required type="checkbox" name="scanConsent" value="yes"${values.scanConsent === 'yes' ? ' checked' : ''} />
                <span>I authorize Zumi to scan the site and approved systems for draft recommendations.</span>
              </label>
            </div>
            <div class="field full">
              <label class="checkbox-field">
                <input required type="checkbox" name="publishConsent" value="yes"${values.publishConsent === 'yes' ? ' checked' : ''} />
                <span>I understand changes stay approval-first and do not publish automatically.</span>
              </label>
            </div>
            <div class="field full">
              <label class="checkbox-field">
                <input required type="checkbox" name="legalConsent" value="yes"${values.legalConsent === 'yes' ? ' checked' : ''} />
                <span>I agree to the <a href="/terms">Terms</a>, <a href="/privacy">Privacy Policy</a>, and <a href="/authorization">Authorization</a>.</span>
              </label>
            </div>
          </div>
        </div>

        <p class="form-hint">Usually takes about 30 seconds. Add contact details only if you want the audit sent directly.</p>
        <p class="inline-note" data-intake-status${errorMessage ? ' data-state="warning"' : ''}>${escapeHtml(errorMessage || 'We’ll start the audit as soon as you submit the site.')}</p>
        <div class="actions">
          <button class="btn" type="submit" data-intake-submit>Get My Free Website Audit</button>
          <a class="btn secondary" href="/authorization">Read Authorization</a>
        </div>
      </form>
    </section>
  `;

  return layout('Client Intake', content, '/intake');
}

function intakeSuccessPage(plan = 'Starter') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Audit Requested</p>
        <h2>We’re scanning your site.</h2>
      </div>
      <p class="muted">Your site is in the queue. If the fit is good, the next step is a first fix plan starting at $149.</p>
    </section>
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">What happens now</p>
        <h3>Your audit gets reviewed first.</h3>
        <p class="muted">Zumi will look for the clearest problems in the site, trust, and booking or buying flow. Your team can also work the lead from the call list.</p>
      </article>
      <article class="card">
        <p class="kicker">If contact is missing</p>
        <h3>Website is enough to start.</h3>
        <p class="muted">No problem. The website is enough to start the audit. Contact details can be added later when the team reaches out.</p>
      </article>
    </section>
    <section class="card">
      <p class="section-label">Next Step</p>
      <h2>Clear fixes first. Approval first.</h2>
      <p class="muted">Nothing important goes live without approval. The point is to make the next move obvious, not overwhelming.</p>
      <div class="actions">
        <a class="btn" href="/pricing">See Pricing</a>
        <a class="btn secondary" href="/">Go Home</a>
      </div>
    </section>
  `;

  return layout('Audit Requested', content, '/intake');
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
    queued: 'Reading your website.',
    scanning: 'Mapping trust and conversion signals.',
    analyzing: 'Building your Zumi audit.',
    completed: 'Your audit is ready.',
    failed: 'We could not finish the audit.'
  }[job.status] || 'Preparing your audit.';
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
  const businessName = form.businessName || getDomainFromWebsite(website) || 'Website Lead';

  return {
    id: `c_${crypto.randomUUID().slice(0, 10)}`,
    businessName,
    owner: form.owner || '',
    email: form.email || '',
    phone: form.phone || '',
    website,
    sitePlatform: form.sitePlatform || 'custom',
    category: form.category || 'General Business',
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
    publishConsent: form.publishConsent === 'yes',
    legalConsent: form.legalConsent === 'yes',
    createdAt: new Date().toISOString()
  };
}

function createAuditJobRecord(clientId) {
  return {
    id: `audit_${crypto.randomUUID().slice(0, 12)}`,
    clientId,
    status: 'queued',
    progressLabel: 'Reading your website.',
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
        <h3>Your audit is still loading.</h3>
        <p class="muted">Zumi will fill this with the biggest leaks as soon as the scan is finished.</p>
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
        <p class="section-label">Instant Audit</p>
        <h2>${escapeHtml(getClientDisplayName(client || {}))}</h2>
      </div>
      <p class="muted">Zumi is checking where this site is leaking trust, bookings, and sales.</p>
    </section>

    <section class="card audit-shell" data-audit-page data-audit-id="${escapeHtml(auditJob.id)}">
      <div class="audit-loading">
        <p class="section-label">Live Audit</p>
        <h3 data-audit-progress>${escapeHtml(getAuditProgressCopy(auditJob))}</h3>
        <p class="muted">Searching your website for hidden conversion gold...</p>
        <div class="mini-proof">
          <span class="pill" data-audit-status-pill>${escapeHtml(getAuditStatusLabel(auditJob.status))}</span>
          <span class="pill">${escapeHtml(client?.website || 'Website pending')}</span>
          <span class="pill" data-audit-source-mode>${escapeHtml(sourceMode)}</span>
        </div>
      </div>

      <div class="audit-grid" data-audit-results${completed ? '' : ' hidden'}>
        <article class="card audit-score-card">
          <p class="kicker">Overall Score</p>
          <div class="audit-score" data-audit-overall-score>${completed ? escapeHtml(String(auditResult.overallScore || '--')) : '--'}</div>
          <p class="muted" data-audit-summary>${completed ? escapeHtml(auditResult.summary || '') : 'Your summary will appear here as soon as the audit finishes.'}</p>
        </article>
          <article class="card">
            <p class="kicker">Five-Second Impression</p>
            <h3 data-audit-five-second>${completed ? escapeHtml(auditResult.fiveSecondImpression || '') : 'Loading first-impression analysis...'}</h3>
            <div class="audit-mini-scores">
            ${['clarity', 'trust', 'cta', 'booking', 'seo', 'mobile'].map((key) => `
              <div class="audit-mini-score">
                <strong data-audit-score-${key}>${completed ? escapeHtml(String(scores[key] ?? '--')) : '--'}</strong>
                <span>${escapeHtml(key)}</span>
              </div>
            `).join('')}
          </div>
          <div class="mini-proof" style="margin-top: 18px;">
            <span class="pill">Strongest page</span>
            <span class="pill" data-audit-strongest-page>${escapeHtml(strongestPage)}</span>
          </div>
        </article>
      </div>

      <div class="audit-sections" data-audit-detail-sections${completed ? '' : ' hidden'}>
        <section>
          <div class="section-heading">
            <div>
              <p class="section-label">Top Leaks</p>
              <h2>What is hurting revenue first.</h2>
            </div>
          </div>
          <div class="feature-grid" data-audit-issues>${renderAuditIssueCards(auditResult)}</div>
        </section>

        <section class="detail-grid" style="margin-top: 18px;">
          <article class="card">
            <p class="kicker">Quick Wins</p>
            <ul class="list-clean" data-audit-quick-wins>
              ${(completed ? auditResult.quickWins : ['Zumi is building your quick wins now.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
          <article class="card">
            <p class="kicker">Best Next Step</p>
            <ul class="list-clean" data-audit-recommended-fixes>
              ${(completed ? auditResult.recommendedFixes : ['Your recommended fixes will appear here when the scan finishes.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        </section>

        <section class="detail-grid" style="margin-top: 18px;">
          <article class="card">
            <p class="kicker">Rewritten Hero</p>
            <div class="rewrite-preview">
              <strong data-audit-hero-headline>${completed ? escapeHtml(auditResult.heroRewrite?.headline || '') : 'Loading headline...'}</strong>
              <p class="muted" data-audit-hero-subheadline>${completed ? escapeHtml(auditResult.heroRewrite?.subheadline || '') : 'Loading subheadline...'}</p>
              <span class="pill" data-audit-hero-cta>${completed ? escapeHtml(auditResult.heroRewrite?.cta || '') : 'Loading CTA...'}</span>
            </div>
          </article>
          <article class="card">
            <p class="kicker">Operator View</p>
            <ul class="list-clean" data-audit-conversion-leaks>
              ${(completed ? auditResult.conversionLeaks : ['Your conversion leaks will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
            </ul>
          </article>
        </section>

        <section style="margin-top: 18px;">
          <div class="section-heading">
            <div>
              <p class="section-label">Fix Center</p>
              <h2>Drafts, recommendations, and approval-first moves.</h2>
            </div>
            <p class="muted">Phase 1 prepares the better version before any live publish layer exists.</p>
          </div>
          <div class="feature-grid">
            <article class="card fix-card">
              <p class="kicker">Draft</p>
              <h3>Hero + CTA rewrite</h3>
              <div class="rewrite-preview">
                <strong data-audit-fix-headline>${completed ? escapeHtml(auditResult.heroRewrite?.headline || '') : 'Loading rewrite...'}</strong>
                <p class="muted">${completed ? escapeHtml(auditResult.heroRewrite?.subheadline || '') : 'Loading supporting copy...'}</p>
                <span class="pill" data-audit-fix-cta>${completed ? escapeHtml(auditResult.heroRewrite?.cta || '') : 'Loading CTA...'}</span>
              </div>
              <div class="mini-proof">
                <span class="pill">draft</span>
                <span class="pill">approval-first</span>
              </div>
            </article>
            <article class="card fix-card">
              <p class="kicker">Trust Layer</p>
              <h3>What should make the site feel safer.</h3>
              <ul class="list-clean" data-audit-trust-recommendations>
                ${(completed ? auditResult.trustRecommendations : ['Trust recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Booking Flow</p>
              <h3>Where the next step should get easier.</h3>
              <ul class="list-clean" data-audit-booking-recommendations>
                ${(completed ? auditResult.bookingFlowRecommendations : ['Booking-flow recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">SEO + Structure</p>
              <h3>Quiet wins for search and clarity.</h3>
              <ul class="list-clean" data-audit-seo-recommendations>
                ${(completed ? auditResult.seoRecommendations : ['SEO recommendations will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Missing Elements</p>
              <h3>What the current experience still lacks.</h3>
              <ul class="list-clean" data-audit-missing-elements>
                ${(completed ? auditResult.missingElements : ['Missing elements will appear here.']).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
              </ul>
            </article>
            <article class="card fix-card">
              <p class="kicker">Approval Workflow</p>
              <h3>How Zumi handles changes.</h3>
              <ul class="list-clean">
                <li>Draft created from the audit.</li>
                <li>Owner reviews before anything changes live.</li>
                <li>Approved items move forward. Rejected items return for revision.</li>
              </ul>
              <div class="mini-proof">
                <span class="pill">draft</span>
                <span class="pill">approved</span>
                <span class="pill">needs revision</span>
              </div>
            </article>
          </div>
        </section>
      </div>

      <article class="card audit-error" data-audit-error${auditJob.status === 'failed' ? '' : ' hidden'}>
        <p class="kicker">Audit Error</p>
        <h3>We could not finish the scan.</h3>
        <p class="muted" data-audit-error-message>${escapeHtml(auditJob.errorMessage || 'Try again with a reachable website URL.')}</p>
      </article>
    </section>
  `;

  return layout('Instant Audit', content, `/audit/${auditJob.id}`);
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
        <h3>What Zumi wants to strengthen next.</h3>
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
      <p class="muted">A client-facing snapshot for ${escapeHtml(client.owner || 'the owner')} with the Zumi plan already customized for this business.</p>
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

function naKitPage() {
  const concepts = [
    { id: 'A', name: 'ScamSentry', domain: 'Money + Safety', hook: 'Shareable Scam Receipts', money: 'Family subscription + B2B risk licensing', door: 'Identity and trusted sender rails' },
    { id: 'B', name: 'BillBuster', domain: 'Money', hook: 'Monthly savings flex cards', money: 'Share-of-savings + premium automation', door: 'Consumer finance autopilot' },
    { id: 'C', name: 'CareCircle', domain: 'Family + Health', hook: 'Care wins and SOS circles', money: 'Family plan + employer channel', door: 'Care logistics infrastructure' },
    { id: 'D', name: 'SkillStack', domain: 'Work + Education', hook: 'Weekly ship-proof clips', money: 'Pro subscription + recruiting SaaS', door: 'Reputation-based hiring graph' },
    { id: 'E', name: 'HomeLedger', domain: 'Home', hook: 'Before/after value gains', money: 'Household plan + contractor take-rate', door: 'Property operations data layer' },
    { id: 'F', name: 'CivicCopilot', domain: 'Bureaucracy', hook: '“I won” bureaucracy cards', money: 'Pay-per-case + subscription', door: 'Life admin API and agents' },
    { id: 'G', name: 'DateGuard', domain: 'Dating + Safety', hook: 'Green-flag safety badges', money: 'Subscription + pay-per-verify', door: 'Portable trust for marketplaces' },
    { id: 'H', name: 'ClipCommerce', domain: 'Commerce', hook: 'Shareable dupe carts', money: 'Affiliate + SaaS + transaction fees', door: 'Creator commerce infrastructure' },
    { id: 'I', name: 'MovePilot', domain: 'Travel + Life Events', hook: 'Move score and survival cards', money: 'Referral rev + concierge tier', door: 'Life-transition operating system' },
    { id: 'J', name: 'RealityCheck', domain: 'Information', hook: 'Reality Cards for reposts', money: 'Freemium + org licensing + API', door: 'Cross-platform trust API' }
  ];

  const content = `
    <section class="nakit-hero card">
      <p class="section-label">NA Kit</p>
      <h1>Ten Viral, Necessary Apps That Print Money and Open Doors to the Future</h1>
      <p class="muted">A bold, interactive concept studio where each app is engineered for distribution, measurable value, and long-term platform expansion.</p>
      <div class="nakit-pill-row">
        <span>Viral Artifacts</span>
        <span>Recurring Revenue</span>
        <span>Moat Design</span>
        <span>Operator-Ready MVPs</span>
      </div>
      <div class="actions">
        <a class="btn" href="#nakit-grid">Explore all 10 apps</a>
        <a class="btn secondary" href="#nakit-lab">Run opportunity lab</a>
      </div>
    </section>

    <section id="nakit-grid" class="nakit-grid">
      ${concepts.map((concept) => `
        <article class="nakit-card" data-app-card data-app-name="${escapeHtml(concept.name)}">
          <p class="kicker">Concept ${concept.id} · ${escapeHtml(concept.domain)}</p>
          <h3>${escapeHtml(concept.name)}</h3>
          <p><strong>Viral hook:</strong> ${escapeHtml(concept.hook)}</p>
          <p><strong>Monetization:</strong> ${escapeHtml(concept.money)}</p>
          <p><strong>Platform door:</strong> ${escapeHtml(concept.door)}</p>
          <button class="btn secondary" type="button" data-spotlight>Spotlight this concept</button>
        </article>
      `).join('')}
    </section>

    <section id="nakit-lab" class="card nakit-lab">
      <p class="section-label">Opportunity Lab</p>
      <h2>Rank what wins first: urgency × shareability × revenue</h2>
      <p class="muted">Tune the scoring model, then instantly see which app should be built first for speed-to-cash and strategic upside.</p>
      <div class="nakit-sliders">
        <label>Urgency <input type="range" min="1" max="5" value="5" data-weight="urgency" /></label>
        <label>Shareability <input type="range" min="1" max="5" value="4" data-weight="shareability" /></label>
        <label>Revenue Fit <input type="range" min="1" max="5" value="5" data-weight="revenue" /></label>
      </div>
      <div class="nakit-scoreboard" data-scoreboard></div>
    </section>

    <section class="card nakit-launch">
      <p class="section-label">Recommended first build</p>
      <h2>Start with <span>ScamSentry</span></h2>
      <p class="muted">Clear fear-driven demand, obvious family subscription motion, and natural social sharing via scam warning receipts.</p>
      <ol>
        <li><strong>Months 1-2:</strong> launch core call, text, and link protection with one-tap Scam Receipt cards.</li>
        <li><strong>Months 3-5:</strong> add family circles, senior mode, and trusted contact routing.</li>
        <li><strong>Months 6-9:</strong> ship partner-ready integrations for financial institutions and caregiver orgs.</li>
        <li><strong>Months 10-12:</strong> pilot verified business calling and a lightweight B2B risk dashboard.</li>
      </ol>
    </section>

    <script>
      (() => {
        const baseScores = {
          ScamSentry: { urgency: 5, shareability: 5, revenue: 5 },
          BillBuster: { urgency: 4, shareability: 4, revenue: 5 },
          CareCircle: { urgency: 5, shareability: 3, revenue: 4 },
          SkillStack: { urgency: 3, shareability: 5, revenue: 4 },
          HomeLedger: { urgency: 4, shareability: 4, revenue: 4 },
          CivicCopilot: { urgency: 4, shareability: 4, revenue: 4 },
          DateGuard: { urgency: 4, shareability: 4, revenue: 4 },
          ClipCommerce: { urgency: 3, shareability: 5, revenue: 5 },
          MovePilot: { urgency: 4, shareability: 3, revenue: 4 },
          RealityCheck: { urgency: 4, shareability: 5, revenue: 4 }
        };
        const sliders = Array.from(document.querySelectorAll('[data-weight]'));
        const scoreboard = document.querySelector('[data-scoreboard]');
        const renderScores = () => {
          const weights = sliders.reduce((acc, slider) => ({ ...acc, [slider.dataset.weight]: Number(slider.value) }), {});
          const sorted = Object.entries(baseScores)
            .map(([name, score]) => ({
              name,
              total: score.urgency * weights.urgency + score.shareability * weights.shareability + score.revenue * weights.revenue
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
          scoreboard.innerHTML = sorted.map((row, index) => '<div class="score-row"><span>#' + (index + 1) + ' ' + row.name + '</span><strong>' + row.total + '</strong></div>').join('');
        };

        sliders.forEach((slider) => slider.addEventListener('input', renderScores));
        document.querySelectorAll('[data-spotlight]').forEach((button) => {
          button.addEventListener('click', () => {
            const card = button.closest('[data-app-card]');
            if (!card) return;
            document.querySelectorAll('[data-app-card]').forEach((item) => item.classList.remove('is-spotlight'));
            card.classList.add('is-spotlight');
          });
        });
        renderScores();
      })();
    </script>
  `;

  return layout('NA Kit', content, '/na-kit');
}

function notFoundPage() {
  return layout(
    'Not Found',
    `
      <section class="card empty-state">
        <p class="section-label">404</p>
        <h2>That page does not exist.</h2>
        <p class="muted">Head back to the home page or start the intake.</p>
        <div class="actions" style="justify-content: center;">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/intake">Get Audit</a>
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

app.get('/na-kit', async (req, res) => {
  sendHtml(res, naKitPage());
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
    res.status(400).json({ error: 'Website URL is required.' });
    return;
  }

  if (!(req.body.scanConsent === 'yes' && req.body.publishConsent === 'yes' && req.body.legalConsent === 'yes')) {
    res.status(400).json({ error: 'All approval checkboxes are required.' });
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
    sendHtml(res, intakePage(normalizePlan(req.body.plan), req.body, 'Website URL is required.'), 400);
    return;
  }

  if (!(req.body.scanConsent === 'yes' && req.body.publishConsent === 'yes' && req.body.legalConsent === 'yes')) {
    sendHtml(res, intakePage(normalizePlan(req.body.plan), req.body, 'All approval checkboxes are required.'), 400);
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
      'View Proof',
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
      'Use this route as the booking and onboarding handoff once you are ready to turn positioning into pipeline.',
      '/intake',
      'Get My Free Website Audit',
      '/case-studies',
      'View Proof',
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
