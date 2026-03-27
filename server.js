require('dotenv').config({ quiet: true });

const express = require('express');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const dataFile = path.join(__dirname, 'data', 'clients.json');
const followupModel = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});
const brand = {
  name: 'Zumi',
  category: 'adaptive opportunity engine',
  audience: 'businesses of all sizes',
  slogan: 'Nothing slips. Everything closes.',
  headline: 'Nothing slips. Everything closes.',
  subhead: 'Zumi finds real opportunities, filters the noise, and launches the right conversion workflow automatically.',
  supportingLine: 'Search instantly. Verify intelligently. Act automatically.',
  metaDescription: 'Zumi is an adaptive opportunity engine that helps businesses discover real opportunities, filter low-quality results, and convert faster.',
  proofNote: 'Illustrative launch scenarios based on service, appointment-led, and conversion-heavy funnels. Use them as transparent sales assets until real customer data is live.',
  algorithmName: 'Zumi Adapt Engine'
};
const caseStudies = [
  {
    slug: 'rapidroot-plumbing',
    businessName: 'RapidRoot Plumbing',
    category: 'Emergency plumbing',
    image: '/proof-plumbing-owner.svg',
    imageAlt: 'Smiling plumbing business owner reviewing recovered jobs on a phone dashboard.',
    headline: 'Recovered missed-call revenue without adding office staff',
    challenge: 'Too many after-hours calls were hitting voicemail, and leads were cooling off before the owner could respond the next morning.',
    system: [
      'Missed-call text sent within 90 seconds',
      'AI-assisted follow-up email for unbooked estimates',
      'Review request trigger after each completed job'
    ],
    metrics: [
      { label: 'Reply speed', value: '< 5 min' },
      { label: 'Recovered jobs', value: '+11/mo' },
      { label: 'Review rate', value: '+22%' }
    ],
    summary: 'Zumi turned slow callback habits into a tighter revenue system by recovering intent quickly and following up until the estimate either booked or clearly went cold.'
  },
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
  }
];
const faqItems = [
  {
    question: 'Who is Zumi best for?',
    answer: 'It is built for local service businesses where leads go cold fast: plumbing, HVAC, electrical, cleaning, roofing, landscaping, and similar home-service operators.'
  },
  {
    question: 'What problem does it solve first?',
    answer: 'The first win is usually response speed and follow-up consistency. Most operators do not need more leads first. They need a tighter system for the leads they already have.'
  },
  {
    question: 'Does this replace a CRM?',
    answer: 'Not yet. This MVP acts more like a revenue layer on top of a simple lead pipeline, with intake, follow-up generation, and client-facing growth guidance.'
  },
  {
    question: 'Can this be sold before every integration is finished?',
    answer: 'Yes. The right launch motion is to sell the outcome first, then add deeper automation like billing, Twilio, and database infrastructure as the offer proves itself.'
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
    price: '$79',
    cadence: '/mo',
    description: 'For lean operators who need faster follow-up and a cleaner recovery system.',
    href: '/intake?plan=Starter',
    cta: 'Launch Starter',
    features: [
      'Core intake and custom Zumi blueprint.',
      'AI follow-up drafts across key channels.',
      'Client portal and next-step guidance.'
    ]
  },
  {
    name: 'Pro',
    price: '$149',
    cadence: '/mo',
    description: 'For growing teams that need more structure, more proof, and tighter conversion handling.',
    href: '/intake?plan=Pro',
    cta: 'Launch Pro',
    features: [
      'Everything in Starter plus stronger sequencing.',
      'Better quote reactivation and review flow packaging.',
      'A cleaner operator layer for busier teams.'
    ]
  },
  {
    name: 'Done-With-You',
    price: '$199',
    cadence: ' setup + $79/mo',
    description: 'For businesses that want a premium guided setup and a more hands-on launch experience.',
    href: '/intake?plan=Done-With-You',
    cta: 'Book Setup',
    features: [
      'Guided onboarding and launch support.',
      'Done-for-you positioning and workflow setup.',
      'Best fit when the offer is sold as a service plus software.'
    ]
  }
];
const platformPillars = [
  {
    name: 'Discover',
    href: '/discover',
    headline: 'Find businesses, leads, listings, buyers, and demand signals from connected sources.',
    body: 'Zumi is positioned to search across connected public and integrated sources so the workspace starts with something real, not empty.'
  },
  {
    name: 'Verify',
    href: '/verify',
    headline: 'Filter duplicates, suspicious entries, stale records, and likely bots automatically.',
    body: 'The system scores freshness and quality, suppresses obvious junk, and helps the operator focus on opportunities that still look actionable.'
  },
  {
    name: 'Convert',
    href: '/convert',
    headline: 'Turn qualified opportunities into workflows, follow-up sequences, and next actions automatically.',
    body: 'Once something looks real, Zumi pushes it toward the right cadence, channel mix, and operator workflow instead of leaving it in a static list.'
  }
];
const industrySegments = [
  {
    label: 'Service Businesses',
    body: 'Missed calls, estimate follow-up, review requests, and recurring service reactivation.'
  },
  {
    label: 'Agencies',
    body: 'Discovery and qualification for inbound demand, outbound lists, and reactivation opportunities.'
  },
  {
    label: 'Consultants',
    body: 'High-intent inquiry handling, qualification, and follow-up around booked calls and proposals.'
  },
  {
    label: 'Sales Teams',
    body: 'Opportunity scoring, duplicate filtering, and cleaner handoff into the next conversion workflow.'
  },
  {
    label: 'Appointment-Based Businesses',
    body: 'Lead verification, reminder flows, and appointment recovery when buyers stop responding.'
  },
  {
    label: 'Growing Brands',
    body: 'A premium first layer for finding, filtering, and acting on opportunities before scaling deeper integrations.'
  }
];
// Placeholder descriptors for future connected public and integrated sources.
const sourceConnectorScaffolds = [
  {
    label: 'Public Search Inputs',
    body: 'Search-led discovery across allowed public inputs and preview queries.'
  },
  {
    label: 'Directory Connectors',
    body: 'Future support for listings, directories, and public business databases.'
  },
  {
    label: 'Listings Connectors',
    body: 'Placeholders for opportunity and listing sources that can feed real-time previews later.'
  },
  {
    label: 'CRM Integrations',
    body: 'Future connected records for reactivation, duplicate suppression, and workflow routing.'
  },
  {
    label: 'Communication Channels',
    body: 'Email, SMS, and messaging channels used after an opportunity is verified and activated.'
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

function readClients() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function writeClients(clients) {
  fs.writeFileSync(dataFile, JSON.stringify(clients, null, 2));
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

function getClientById(clientId) {
  return readClients().find((client) => client.id === clientId);
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

function buildTemplateFollowup(client, channel = 'email') {
  const owner = client.owner || 'there';
  const businessName = client.businessName || 'your business';
  const goal = client.goal || 'bringing in more qualified leads';
  const blueprint = buildZumiBlueprint(client);

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

function buildFollowupPrompt(client, channel = 'email') {
  const owner = client.owner || 'the business owner';
  const businessName = client.businessName || 'the business';
  const goal = client.goal || 'book more jobs';
  const notes = client.notes || 'No additional notes provided.';
  const maxLength = channel === 'email' ? '120 words' : '320 characters';
  const blueprint = buildZumiBlueprint(client);

  return [
    `You write premium, human follow-up messages for ${brand.name}, an AI follow-up system for local service businesses.`,
    `Channel: ${channelLabel(channel)}.`,
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

async function generateFollowup(client, channel) {
  const fallback = buildTemplateFollowup(client, channel);

  if (!openaiClient) {
    return {
      followup: fallback,
      source: 'template',
      warning: 'OPENAI_API_KEY is not set, so this draft came from the built-in local template.'
    };
  }

  try {
    const response = await openaiClient.responses.create({
      model: followupModel,
      input: buildFollowupPrompt(client, channel)
    });
    const followup = response.output_text ? response.output_text.trim() : '';

    if (!followup) {
      throw new Error('The OpenAI response did not include output text.');
    }

    return {
      followup,
      source: 'openai',
      model: followupModel
    };
  } catch (error) {
    console.error('OpenAI follow-up generation failed:', error.message);
    return {
      followup: fallback,
      source: 'template',
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
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="${escapeHtml(brand.metaDescription)}" />
      <title>${safeTitle}</title>
      <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/styles.css" />
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
            <nav class="nav-links">
              ${navLink('/', 'Home', currentPath)}
              ${navLink('/discover', 'Discover', currentPath)}
              ${navLink('/solutions', 'Solutions', currentPath)}
              ${navLink('/pricing', 'Pricing', currentPath)}
              ${navLink('/case-studies', 'Proof', currentPath)}
              ${navLink('/intake', 'Intake', currentPath)}
              ${navLink('/admin', 'Admin', currentPath)}
            </nav>
          </div>
        </div>
      </header>
      <main>
        <div class="container">${content}</div>
      </main>
      <footer>
        <div class="container footer-shell">
          <span>${brand.name}</span>
          <span>${brand.slogan}</span>
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
      <p class="section-label">AI Follow-Up Studio</p>
      <h3>Generate a personalized message</h3>
      <p class="muted">Choose a channel, create a draft, and copy it into your workflow. When no API key is configured, the app still returns a smart local fallback message.</p>
      <div class="form-grid" style="margin-top: 18px;">
        <div class="field">
          <label for="channel-${escapeHtml(client.id)}">Channel</label>
          <select id="channel-${escapeHtml(client.id)}" data-channel>
            <option value="email"${preferredChannel === 'email' ? ' selected' : ''}>Email</option>
            <option value="sms"${preferredChannel === 'sms' ? ' selected' : ''}>SMS</option>
            <option value="whatsapp"${preferredChannel === 'whatsapp' ? ' selected' : ''}>WhatsApp</option>
          </select>
        </div>
      </div>
      <div class="actions">
        <button class="btn" type="button" data-generate-followup>Generate Follow-up</button>
        <button class="btn secondary" type="button" data-copy-followup disabled>Copy Message</button>
      </div>
      <p class="inline-note" data-followup-error>Draft a message that feels personal before it ever reaches Twilio or SendGrid.</p>
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
      <p class="kicker">${escapeHtml(study.category)}</p>
      <h3>${escapeHtml(study.headline)}</h3>
      <p class="muted">${escapeHtml(study.summary)}</p>
      <ul class="list-clean">
        ${study.metrics.slice(0, 2).map((metric) => `<li>${escapeHtml(metric.label)}: ${escapeHtml(metric.value)}</li>`).join('')}
      </ul>
      <div class="actions">
        <a class="btn secondary" href="/case-studies#${escapeHtml(study.slug)}">Open Scenario</a>
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
  return `
    <article class="card plan-card">
      <p class="kicker">Plan</p>
      <h3>${escapeHtml(plan.name)}</h3>
      <p class="price">${escapeHtml(plan.price)}<span>${escapeHtml(plan.cadence)}</span></p>
      <p class="muted">${escapeHtml(plan.description)}</p>
      <ul class="list-clean">${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
      <div class="actions">
        <a class="btn" href="${escapeHtml(plan.href)}">${escapeHtml(plan.cta)}</a>
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
  const seededClient = clients[0] || {
    owner: 'Jordan',
    businessName: 'Northside Electric',
    goal: 'booking more high-intent leads'
  };
  const categoryCount = new Set(clients.map((client) => client.category).filter(Boolean)).size || 4;
  const sampleMessage = buildTemplateFollowup(seededClient, 'sms');
  const faqPreview = faqItems.map(renderFaqCard).join('');
  const caseStudyPreview = caseStudies.map(renderCaseStudyPreview).join('');
  const solutionPreview = solutionPages.map(renderSolutionPreview).join('');
  const pricingPreview = pricingPlans.map(renderPricingCard).join('');
  const pillarPreview = platformPillars.map(renderPillarCard).join('');
  const sampleBlueprint = buildZumiBlueprint({
    ...seededClient,
    businessSize: 'small-team',
    leadVolume: 'steady',
    salesMotion: 'estimate',
    preferredChannel: 'sms'
  });

  const content = `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(brand.category)} for ${escapeHtml(brand.audience)}</p>
        <h1>${escapeHtml(brand.headline)}</h1>
        <p class="lede">${escapeHtml(brand.subhead)}</p>
        <p class="supporting-line">${escapeHtml(brand.supportingLine)}</p>
        <div class="actions">
          <a class="btn" href="#opportunity-preview">Try It Now</a>
          <a class="btn secondary" href="/how-it-works">See How It Works</a>
          <a class="btn ghost" href="/demo">Book Demo</a>
        </div>
        <div class="live-metrics">
          <div class="signal-chip">
            <span class="signal-value">12</span>
            <span class="signal-label">leads waiting</span>
          </div>
          <div class="signal-chip">
            <span class="signal-value">3</span>
            <span class="signal-label">recovered today</span>
          </div>
          <div class="signal-chip">
            <span class="signal-value">+11</span>
            <span class="signal-label">jobs this month</span>
          </div>
        </div>
      </div>
      <div class="card spotlight">
        <div class="spotlight-visual">
          <img class="spotlight-image" src="/hero-success-owners.svg" alt="Stylized montage of successful local business owners using Zumi with recovered lead and booking visuals." />
        </div>
        <div>
          <p class="section-label">${escapeHtml(brand.algorithmName)}</p>
          <h3>Search, verify, and route the right opportunity automatically.</h3>
          <p class="muted">Zumi can start with connected public and integrated source inputs, filter for quality, then map the strongest opportunities into a launch-ready workflow in a few easy steps.</p>
        </div>
        <div class="metric-grid">
          <div class="metric">
            <span class="metric-value">3</span>
            <span class="metric-label">Core powers: discover, verify, and convert.</span>
          </div>
          <div class="metric">
            <span class="metric-value">Auto</span>
            <span class="metric-label">Zumi chooses the engine, source mix, and sequence logic.</span>
          </div>
          <div class="metric">
            <span class="metric-value">${categoryCount}</span>
            <span class="metric-label">Seeded business scenarios already modeled in the MVP.</span>
          </div>
          <div class="metric">
            <span class="metric-copy">${escapeHtml(sampleBlueprint.engineName)}</span>
            <span class="metric-label">Example conversion engine from a few onboarding signals.</span>
          </div>
        </div>
        <div class="timeline-list">
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>Step 1: Discover signals</strong>
              <div class="table-subtitle">Start from a search, target, business type, or connected source input without forcing signup first.</div>
            </div>
          </div>
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>Step 2: Let Zumi verify</strong>
              <div class="table-subtitle">The engine filters duplicates, suspicious entries, and stale records before routing the strongest results.</div>
            </div>
          </div>
          <div class="timeline-item">
            <span class="timeline-dot"></span>
            <div>
              <strong>Step 3: Launch the workflow</strong>
              <div class="table-subtitle">Qualified opportunities move into follow-up, reminders, recovery, or action plans automatically.</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Architecture</p>
          <h2>Three powers inside one adaptive system.</h2>
        </div>
        <p class="muted">The product works best when it feels like a clean operating layer: discover what looks real, verify what deserves attention, then move it into the right conversion motion.</p>
      </div>
      <div class="feature-grid">${pillarPreview}</div>
    </section>

    <section class="section">
      <div class="detail-grid">
        ${renderZumiBlueprintCard({
          ...seededClient,
          businessSize: 'small-team',
          leadVolume: 'steady',
          salesMotion: 'estimate',
          preferredChannel: 'sms'
        })}
        ${renderZumiCadenceCard({
          ...seededClient,
          businessSize: 'small-team',
          leadVolume: 'steady',
          salesMotion: 'estimate',
          preferredChannel: 'sms'
        })}
      </div>
    </section>

    <section class="section" id="opportunity-preview">
      <div class="section-heading">
        <div>
          <p class="section-label">Instant Preview</p>
          <h2>Try the opportunity engine before signup.</h2>
        </div>
        <p class="muted">Search instantly, preview the verification logic, and see what workflow Zumi would launch. Saving, exporting, and activating can stay gated until later.</p>
      </div>
      <div class="detail-grid">
        <article class="card">
          <form data-opportunity-preview-form>
            <div class="form-grid">
              <div class="field full">
                <label for="searchGoal">Search or opportunity goal</label>
                <input id="searchGoal" name="searchGoal" placeholder="Find high-intent HVAC opportunities in Miami that still look active" />
              </div>
              <div class="field">
                <label for="previewBusinessType">Business type</label>
                <input id="previewBusinessType" name="businessType" placeholder="HVAC, agency, consultant..." />
              </div>
              <div class="field">
                <label for="previewLocation">Location</label>
                <input id="previewLocation" name="location" placeholder="Miami, FL" />
              </div>
              <div class="field">
                <label for="previewBusinessSize">Business size</label>
                <select id="previewBusinessSize" name="businessSize">
                  <option value="solo">Solo Operator</option>
                  <option value="small-team" selected>Small Team</option>
                  <option value="growing-team">Growing Team</option>
                  <option value="multi-location">Multi-Location</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div class="field">
                <label for="previewLeadVolume">Lead volume</label>
                <select id="previewLeadVolume" name="leadVolume">
                  <option value="light">Light</option>
                  <option value="steady" selected>Steady</option>
                  <option value="high">High</option>
                  <option value="surging">Surging</option>
                </select>
              </div>
              <div class="field">
                <label for="previewSalesMotion">Sales motion</label>
                <select id="previewSalesMotion" name="salesMotion">
                  <option value="estimate" selected>Estimate / quote</option>
                  <option value="emergency">Emergency</option>
                  <option value="recurring">Recurring</option>
                  <option value="high-ticket">High-ticket</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div class="field">
                <label for="previewTargetType">Target type</label>
                <select id="previewTargetType" name="targetType">
                  <option value="opportunities" selected>Opportunities</option>
                  <option value="businesses">Businesses</option>
                  <option value="leads">Leads</option>
                  <option value="listings">Listings</option>
                  <option value="buyers">Buyers</option>
                </select>
              </div>
              <div class="field">
                <label for="previewUrgency">Response urgency</label>
                <select id="previewUrgency" name="responseUrgency">
                  <option value="standard">Standard</option>
                  <option value="fast" selected>Fast</option>
                  <option value="immediate">Immediate</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div class="actions">
              <button class="btn" type="submit" data-preview-submit>Run Instant Preview</button>
              <a class="btn secondary" href="/pricing">See Pricing</a>
            </div>
            <p class="form-hint">No signup is required to preview. Account creation happens when saving, exporting, or activating workflows.</p>
          </form>
        </article>
        <article class="card preview-panel">
          <p class="section-label">Preview Workspace</p>
          <h3 data-preview-title>Find value before the account gate.</h3>
          <p class="muted" data-preview-summary>Zumi can show a polished preview state first, then ask for signup only when the user wants to save or activate the workflow.</p>
          <div class="preview-stack" data-preview-results>
            <article class="preview-empty">
              <strong>Search instantly.</strong>
              <p class="muted">Run a preview to see an engine name, source mix, verification profile, and example opportunities.</p>
            </article>
          </div>
          <p class="inline-note" data-preview-notice>Saving, exporting, and activating workflows stay gated until later. Previewing value comes first.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Proof</p>
          <h2>Use believable positioning before full client data exists.</h2>
        </div>
        <p class="muted">${escapeHtml(brand.proofNote)}</p>
      </div>
      <div class="grid-3">${caseStudyPreview}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Offer</p>
          <h2>Position Zumi like a revenue control system, not another dashboard.</h2>
        </div>
        <p class="muted">What you are really selling is tighter follow-up, fewer missed leads, and more booked jobs without turning the workflow into a mess.</p>
      </div>
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Launch Stack</p>
          <h3>What the offer includes</h3>
          <ul class="list-clean">
            <li>Three-step onboarding with business-size and revenue-motion signals.</li>
            <li>${escapeHtml(brand.algorithmName)} that maps each business into a custom engine automatically.</li>
            <li>AI-assisted follow-up drafts across the main response channels.</li>
            <li>Client-facing portal with next actions, review prompts, and custom cadence guidance.</li>
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Example Follow-up</p>
          <pre class="message-preview">${escapeHtml(sampleMessage)}</pre>
          <p class="disclaimer">This is the kind of draft the admin can already generate from the client detail screen.</p>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Modules</p>
          <h2>Multiple pages for multiple revenue problems.</h2>
        </div>
        <p class="muted">Each module has its own page so Zumi can sell missed-call recovery, AI follow-up, review generation, reactivation, and premium setup as separate offers inside one system.</p>
      </div>
      <div class="grid-3">${solutionPreview}</div>
      <div class="actions">
        <a class="btn" href="/solutions">View All Modules</a>
        <a class="btn secondary" href="/pricing">See Pricing</a>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Pricing</p>
          <h2>Simple entry points for small shops and premium buyers.</h2>
        </div>
        <p class="muted">The stack can be sold as software, a guided launch, or a hybrid service offer depending on how hands-on you want the sale to feel.</p>
      </div>
      <div class="grid-3">${pricingPreview}</div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">FAQ</p>
          <h2>Answer the objections before the prospect asks.</h2>
        </div>
      </div>
      <div class="detail-grid">${faqPreview}</div>
    </section>
  `;

  return layout(brand.name, content, '/');
}

function caseStudiesPage() {
  const sections = caseStudies.map((study) => `
    <section class="card" id="${escapeHtml(study.slug)}" style="margin-top: 18px;">
      <div class="page-head" style="margin-top: 0;">
        <div>
          <p class="section-label">${escapeHtml(study.category)}</p>
          <h3>${escapeHtml(study.businessName)}</h3>
        </div>
        <span class="proof-tag">Illustrative scenario</span>
      </div>
      <div class="story-visual-wrap story-visual-large">
        <img class="story-visual" src="${escapeHtml(study.image)}" alt="${escapeHtml(study.imageAlt)}" loading="lazy" />
      </div>
      <h2 style="font-size: clamp(1.7rem, 4vw, 2.4rem);">${escapeHtml(study.headline)}</h2>
      <p class="muted">${escapeHtml(study.summary)}</p>
      <div class="detail-grid" style="margin-top: 18px;">
        <div>
          <p class="kicker">Challenge</p>
          <p class="muted">${escapeHtml(study.challenge)}</p>
          <p class="kicker" style="margin-top: 18px;">System installed</p>
          <ul class="list-clean">${study.system.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
        <div>
          <p class="kicker">Modeled outcomes</p>
          <div class="metric-grid">
            ${study.metrics.map((metric) => `
              <div class="metric">
                <span class="metric-value">${escapeHtml(metric.value)}</span>
                <span class="metric-label">${escapeHtml(metric.label)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </section>
  `).join('');

  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Proof</p>
        <h2>Illustrative case studies for launch positioning.</h2>
      </div>
      <p class="muted">${escapeHtml(brand.proofNote)}</p>
    </section>
    ${sections}
    <section class="card" style="margin-top: 18px;">
      <p class="kicker">Next Move</p>
      <h3>Use these scenarios to sell the outcome while the real pipeline gets installed.</h3>
      <div class="actions">
        <a class="btn" href="/intake">Launch My System</a>
        <a class="btn secondary" href="/demo">Book Demo</a>
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
        <h2>Offer-specific pages for every part of the Zumi system.</h2>
      </div>
      <p class="muted">This makes the product feel more like a real operating system. Each route can sell one outcome clearly while still rolling up into the larger Zumi story.</p>
    </section>
    <section class="grid-3">
      ${solutionPages.map(renderSolutionPreview).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Why it matters</p>
          <h3>Different businesses buy different promises.</h3>
          <p class="muted">Some buyers care about missed calls. Some care about quote follow-up. Some only care about reviews. Dedicated pages let each offer stand on its own without confusing the sale.</p>
        </article>
        <article class="card">
          <p class="kicker">Next Move</p>
          <h3>Use modules to package the same product in multiple ways.</h3>
          <div class="actions">
            <a class="btn" href="/pricing">See Pricing</a>
            <a class="btn secondary" href="/intake">Launch My System</a>
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
          <a class="btn" href="/intake">Launch My System</a>
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
          <p class="kicker">Included</p>
          <h3>What this module actually delivers</h3>
          <ul class="list-clean">${item.deliverables.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
        </article>
        <article class="card">
          <p class="kicker">Outcome</p>
          <h3>Why businesses buy this part first</h3>
          <ul class="list-clean">${item.outcomes.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Related Modules</p>
          <h2>Other pages in the same system.</h2>
        </div>
        <p class="muted">Each route sells a different angle, but they all feed back into the same Zumi operating layer.</p>
      </div>
      <div class="grid-3">${related}</div>
    </section>
  `;

  return layout(item.label, content, solutionHref(item.slug));
}

function pricingPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Pricing</p>
        <h2>Choose the layer that fits how you want to sell Zumi.</h2>
      </div>
      <p class="muted">You can position it as software, premium guided setup, or a hybrid done-with-you offer. The page below makes each option feel intentional instead of improvised.</p>
    </section>
    <section class="grid-3">
      ${pricingPlans.map(renderPricingCard).join('')}
    </section>
    <section class="section">
      <div class="detail-grid">
        <article class="card">
          <p class="kicker">Packaging</p>
          <h3>How to keep the offer feeling premium</h3>
          <ul class="list-clean">
            <li>Sell outcomes first: fewer missed leads, more booked jobs, cleaner follow-up.</li>
            <li>Use Done-With-You when the buyer wants more confidence and hand-holding.</li>
            <li>Use Pro when the team already has lead flow and needs structure.</li>
          </ul>
        </article>
        <article class="card">
          <p class="kicker">Launch</p>
          <h3>Start with the route that creates the least friction</h3>
          <div class="actions">
            <a class="btn" href="/intake">Launch My System</a>
            <a class="btn secondary" href="/demo">Book Demo</a>
          </div>
        </article>
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
        <h2>One clean flow: discover, verify, then convert.</h2>
        <p class="muted">Zumi is moving toward an adaptive opportunity engine. The experience starts with connected source inputs, filters for quality, then launches the best next workflow automatically.</p>
        <div class="actions">
          <a class="btn" href="/#opportunity-preview">Try It Now</a>
          <a class="btn secondary" href="/solutions">Open Solutions</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Silver-black opportunity engine visual showing layered discover, verify, and convert panels." />
        </div>
      </article>
    </section>
    <section class="feature-grid">
      ${platformPillars.map(renderPillarCard).join('')}
    </section>
    <section class="section">
      <div class="section-heading">
        <div>
          <p class="section-label">Future Source Layers</p>
          <h2>Prepared for connected public and integrated inputs.</h2>
        </div>
        <p class="muted">These source layers are intentionally staged so the architecture stays believable now and expandable later.</p>
      </div>
      <div class="grid-3">${sourceConnectorScaffolds.map(renderSourceCard).join('')}</div>
    </section>
  `;

  return layout('How It Works', content, '/how-it-works');
}

function discoverPage() {
  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Discover</p>
        <h2>Search instantly across connected opportunity inputs.</h2>
        <p class="muted">Zumi should feel immediate. A user can search for businesses, leads, listings, buyers, or demand signals before committing to signup or activation.</p>
        <div class="mini-proof">
          <span class="pill">Connected public inputs</span>
          <span class="pill">Directory-ready structure</span>
          <span class="pill">Preview-first UX</span>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Silver discovery dashboard with layered search and scoring surfaces." />
        </div>
      </article>
    </section>
    <section class="grid-3">${sourceConnectorScaffolds.slice(0, 3).map(renderSourceCard).join('')}</section>
  `;

  return layout('Discover', content, '/discover');
}

function verifyPage() {
  const cards = [
    {
      name: 'Deduplicate',
      headline: 'Suppress repeat records before they clutter the operator view.',
      body: 'The system should reduce obvious duplicates so teams are not working the same opportunity more than once.'
    },
    {
      name: 'Score Quality',
      headline: 'Rank opportunities by quality, freshness, and likely relevance.',
      body: 'Freshness, match quality, and suspicious-pattern checks help keep the preview believable and useful.'
    },
    {
      name: 'Filter Suspicion',
      headline: 'Flag likely junk, stale records, and suspicious entries automatically.',
      body: 'Zumi should help filter obvious noise without pretending to be perfect bot detection.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Verify</p>
        <h2>Filter the noise before it wastes operator time.</h2>
        <p class="muted">Verification is what keeps the product believable. Zumi should not promise perfect filtering, but it should reduce obvious junk, stale data, and suspicious patterns automatically.</p>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/opportunity-engine.svg" alt="Silver verification dashboard showing scored records and filtered entries." />
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
      name: 'Route',
      headline: 'Move qualified opportunities into the right channel mix automatically.',
      body: 'Use response urgency, sales motion, and business size to determine whether the workflow should start with email, SMS, operator review, or reminders.'
    },
    {
      name: 'Launch',
      headline: 'Trigger follow-up, reminders, recovery, or action plans without starting from scratch.',
      body: 'The current Zumi workflow already supports the conversion side through follow-up generation, portals, and blueprint logic.'
    },
    {
      name: 'Control',
      headline: 'Keep the operator in control while the workflow handles the repetition.',
      body: 'The product should feel like a revenue control system, not a noisy automation toy.'
    }
  ];

  const content = `
    <section class="solution-hero">
      <article class="card art-panel">
        <p class="section-label">Convert</p>
        <h2>Turn verified opportunities into revenue motion quickly.</h2>
        <p class="muted">This is where Zumi connects back to the system that already works today: follow-up generation, action plans, review prompts, and custom cadence guidance.</p>
        <div class="actions">
          <a class="btn" href="/admin">Open Admin</a>
          <a class="btn secondary" href="/case-studies">See Proof</a>
        </div>
      </article>
      <article class="card art-panel">
        <div class="story-visual-wrap story-visual-large">
          <img class="story-visual" src="/hero-success-owners.svg" alt="Silver montage of business owners and conversion workflows." />
        </div>
      </article>
    </section>
    <section class="feature-grid">${cards.map(renderPillarCard).join('')}</section>
  `;

  return layout('Convert', content, '/convert');
}

function industriesPage() {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Industries</p>
        <h2>Generalized examples for teams of different sizes and models.</h2>
      </div>
      <p class="muted">Zumi should not be trapped inside one vertical. The same discovery, verification, and conversion layer can be packaged differently across multiple business types.</p>
    </section>
    <section class="grid-3">${industrySegments.map(renderIndustryCard).join('')}</section>
  `;

  return layout('Industries', content, '/industries');
}

function intakePage(selectedPlan = 'Starter') {
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Client Intake</p>
        <h2>Set up Zumi in a few easy steps.</h2>
      </div>
      <p class="muted">Answer a few quick questions, then let ${escapeHtml(brand.algorithmName)} build a custom follow-up system for the business automatically.</p>
    </section>
    <section class="grid-3" style="margin-bottom: 18px;">
      <article class="card">
        <p class="kicker">Step 1</p>
        <h3>Profile the business</h3>
        <p class="muted">Capture business type, size, and the current goal.</p>
      </article>
      <article class="card">
        <p class="kicker">Step 2</p>
        <h3>Map the revenue motion</h3>
        <p class="muted">Tell Zumi whether the business sells on urgency, estimates, or recurring service.</p>
      </article>
      <article class="card">
        <p class="kicker">Step 3</p>
        <h3>Launch the custom sequence</h3>
        <p class="muted">The app automatically creates the recommended engine, cadence, and response target.</p>
      </article>
    </section>
    <section class="card">
      <form method="POST" action="/intake">
        <div class="form-grid">
          <div class="field">
            <label for="businessName">Business name</label>
            <input id="businessName" required name="businessName" placeholder="RapidRoot Plumbing" />
          </div>
          <div class="field">
            <label for="owner">Owner</label>
            <input id="owner" required name="owner" placeholder="Alicia Gomez" />
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" required type="email" name="email" placeholder="owner@example.com" />
          </div>
          <div class="field">
            <label for="phone">Phone</label>
            <input id="phone" name="phone" placeholder="(555) 000-0000" />
          </div>
          <div class="field">
            <label for="website">Website</label>
            <input id="website" name="website" placeholder="https://example.com" />
          </div>
          <div class="field">
            <label for="category">Category</label>
            <input id="category" name="category" placeholder="Plumbing, HVAC, Cleaning..." />
          </div>
          <div class="field">
            <label for="plan">Plan</label>
            <select id="plan" name="plan">
              <option value="Starter"${selectedPlan === 'Starter' ? ' selected' : ''}>Starter</option>
              <option value="Pro"${selectedPlan === 'Pro' ? ' selected' : ''}>Pro</option>
              <option value="Done-With-You"${selectedPlan === 'Done-With-You' ? ' selected' : ''}>Done-With-You</option>
            </select>
          </div>
          <div class="field">
            <label for="businessSize">Business size</label>
            <select id="businessSize" name="businessSize">
              <option value="solo">Solo Operator</option>
              <option value="small-team" selected>Small Team</option>
              <option value="growing-team">Growing Team</option>
              <option value="multi-location">Multi-Location</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div class="field">
            <label for="preferredChannel">Preferred channel</label>
            <select id="preferredChannel" name="preferredChannel">
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div class="field">
            <label for="leadVolume">Lead flow</label>
            <select id="leadVolume" name="leadVolume">
              <option value="light">Light Lead Flow</option>
              <option value="steady" selected>Steady Lead Flow</option>
              <option value="high">High Lead Flow</option>
              <option value="surging">Surging Lead Flow</option>
            </select>
          </div>
          <div class="field">
            <label for="salesMotion">Sales motion</label>
            <select id="salesMotion" name="salesMotion">
              <option value="emergency">Emergency / urgent jobs</option>
              <option value="estimate" selected>Estimate / quote follow-up</option>
              <option value="recurring">Recurring / membership work</option>
              <option value="high-ticket">High-ticket projects</option>
              <option value="mixed">Mixed service motion</option>
            </select>
          </div>
          <div class="field full">
            <label for="goal">Primary growth goal</label>
            <input id="goal" name="goal" placeholder="Book 12 more emergency calls per month" />
          </div>
          <div class="field full">
            <label for="notes">Notes</label>
            <textarea id="notes" name="notes" placeholder="Anything important about this business, the lead flow, or the offer?"></textarea>
          </div>
        </div>
        <p class="form-hint">Next step: save the record and Zumi will automatically generate the recommended engine, cadence, and follow-up strategy for that business.</p>
        <div class="actions">
          <button class="btn" type="submit">Build Zumi Plan</button>
          <a class="btn secondary" href="/admin">Open Admin Instead</a>
        </div>
      </form>
    </section>
  `;

  return layout('Client Intake', content, '/intake');
}

function adminPage(clients) {
  const topChannel = channelLabel(mostCommonChannel(clients));
  const newestClient = clients[0] ? formatDate([...clients].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))[0].createdAt) : 'None yet';

  const rows = clients
    .map((client) => {
      const portalLink = `/portal/${client.id}`;
      const blueprint = buildZumiBlueprint(client);
      return `<tr>
        <td>
          <div class="table-title">${escapeHtml(client.businessName)}</div>
          <div class="table-subtitle">${escapeHtml(blueprint.engineName)} · ${escapeHtml(client.goal || 'No goal set yet')}</div>
        </td>
        <td>${escapeHtml(client.plan || 'Starter')}</td>
        <td>${escapeHtml(blueprint.sizeLabel)}</td>
        <td>${escapeHtml(channelLabel(client.preferredChannel || 'email'))}</td>
        <td>${formatDate(client.createdAt)}</td>
        <td><span class="status">Active</span></td>
        <td>
          <div><a href="/admin/client/${escapeHtml(client.id)}">Open</a></div>
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
        <p class="kicker">Active Clients</p>
        <h3>${clients.length}</h3>
        <p class="muted">Businesses currently in the dashboard.</p>
      </article>
      <article class="card">
        <p class="kicker">Most Used Channel</p>
        <h3>${escapeHtml(topChannel)}</h3>
        <p class="muted">Helpful context when you automate the Zumi playbooks across channels.</p>
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

function adminClientPage(client, wasJustCreated = false) {
  const actionItems = buildActionItems(client);
  const reviews = buildReviewPrompts(client);
  const blueprint = buildZumiBlueprint(client);
  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Client Detail</p>
        <h2>${escapeHtml(client.businessName)}</h2>
      </div>
      <p class="muted">Owner: ${escapeHtml(client.owner)} · Category: ${escapeHtml(client.category || 'Uncategorized')}</p>
    </section>
    ${wasJustCreated ? `<div class="notice">Client saved successfully. ${escapeHtml(brand.algorithmName)} already mapped the business to the <strong>${escapeHtml(blueprint.engineName)}</strong>.</div>` : ''}
    <section class="detail-grid">
      <article class="card">
        <p class="kicker">Business Snapshot</p>
        <div class="key-value">
          <div class="key-value-item">
            <strong>Email</strong>
            <span>${escapeHtml(client.email)}</span>
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
            <strong>Plan</strong>
            <span>${escapeHtml(client.plan || 'Starter')}</span>
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
      ${renderZumiBlueprintCard(client)}
      ${renderZumiCadenceCard(client)}
    </section>
    <section class="detail-grid" style="margin-top: 18px;">
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

  return layout(`${client.businessName} | Admin`, content, '/admin');
}

function clientPortalPage(client) {
  const actionItems = buildActionItems(client);
  const reviews = buildReviewPrompts(client);
  const followupPreview = buildTemplateFollowup(client, client.preferredChannel || 'email');
  const blueprint = buildZumiBlueprint(client);

  const content = `
    <section class="page-head">
      <div>
        <p class="section-label">Private Portal</p>
        <h2>${escapeHtml(client.businessName)} growth view</h2>
      </div>
      <p class="muted">A client-facing snapshot for ${escapeHtml(client.owner)} with the Zumi plan already customized for this business.</p>
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

  return layout(`${client.businessName} Portal`, content, '/portal');
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
      <p class="muted">This route is intentionally staged as part of the broader roadmap. The premium shell is in place so auth, demo booking, or billing can plug in cleanly next.</p>
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
        <p class="muted">Head back to the dashboard or return to the home page.</p>
        <div class="actions" style="justify-content: center;">
          <a class="btn" href="/">Go Home</a>
          <a class="btn secondary" href="/admin">Open Admin</a>
        </div>
      </section>
    `,
    '/'
  );
}

app.get('/', (req, res) => {
  sendHtml(res, homePage(readClients()));
});

app.get('/intake', (req, res) => {
  const selectedPlan = ['Starter', 'Pro', 'Done-With-You'].includes(req.query.plan)
    ? req.query.plan
    : 'Starter';
  sendHtml(res, intakePage(selectedPlan));
});

app.get('/solutions', (req, res) => {
  sendHtml(res, solutionsPage());
});

app.get('/how-it-works', (req, res) => {
  sendHtml(res, howItWorksPage());
});

app.get('/discover', (req, res) => {
  sendHtml(res, discoverPage());
});

app.get('/verify', (req, res) => {
  sendHtml(res, verifyPage());
});

app.get('/convert', (req, res) => {
  sendHtml(res, convertPage());
});

app.get('/industries', (req, res) => {
  sendHtml(res, industriesPage());
});

app.get('/solutions/:slug', (req, res) => {
  const page = solutionPages.find((item) => item.slug === req.params.slug);

  if (!page) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  sendHtml(res, solutionPage(page));
});

app.get('/pricing', (req, res) => {
  sendHtml(res, pricingPage());
});

app.post('/intake', (req, res) => {
  const clients = readClients();
  const newClient = {
    id: `c${Date.now()}`,
    businessName: req.body.businessName || '',
    owner: req.body.owner || '',
    email: req.body.email || '',
    phone: req.body.phone || '',
    website: req.body.website || '',
    category: req.body.category || '',
    goal: req.body.goal || '',
    notes: req.body.notes || '',
    plan: req.body.plan || 'Starter',
    businessSize: req.body.businessSize || 'small-team',
    leadVolume: req.body.leadVolume || 'steady',
    salesMotion: req.body.salesMotion || 'mixed',
    preferredChannel: req.body.preferredChannel || 'email',
    createdAt: new Date().toISOString()
  };

  clients.push(newClient);
  writeClients(clients);
  res.redirect(`/admin/client/${newClient.id}?created=1`);
});

app.get('/admin', (req, res) => {
  sendHtml(res, adminPage(readClients()));
});

app.get('/admin/client/:id', (req, res) => {
  const client = getClientById(req.params.id);

  if (!client) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  sendHtml(res, adminClientPage(client, req.query.created === '1'));
});

app.get('/portal/:id', (req, res) => {
  const client = getClientById(req.params.id);

  if (!client) {
    sendHtml(res, notFoundPage(), 404);
    return;
  }

  sendHtml(res, clientPortalPage(client));
});

app.get('/login', (req, res) => {
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

app.get('/case-studies', (req, res) => {
  sendHtml(res, caseStudiesPage());
});

app.get('/demo', (req, res) => {
  sendHtml(
    res,
    placeholderPage(
      'Book the demo',
      'Sales Motion',
      'Use this route as the booking and onboarding handoff once you are ready to turn positioning into pipeline.',
      '/intake',
      'Launch My System',
      '/case-studies',
      'View Proof',
      '/demo'
    )
  );
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    openaiConfigured: Boolean(openaiClient),
    clientCount: readClients().length
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
  const client = getClientById(req.params.id);

  if (!client) {
    res.status(404).json({ error: 'Client not found.' });
    return;
  }

  const channel = ['email', 'sms', 'whatsapp'].includes(req.body.channel)
    ? req.body.channel
    : client.preferredChannel || 'email';

  const payload = await generateFollowup(client, channel);
  res.json(payload);
});

app.get('/api/blueprint/:id', (req, res) => {
  const client = getClientById(req.params.id);

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
