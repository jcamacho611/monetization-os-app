function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function looksLikeUrlCandidate(value = '') {
  const raw = String(value || '').trim();
  return /^https?:\/\//i.test(raw)
    || /^www\./i.test(raw)
    || /^[a-z0-9-]+(\.[a-z0-9-]+)+([/:?#].*)?$/i.test(raw);
}

function normalizeUrlLikeValue(value = '') {
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

function buildInlineList(items = [], emptyCopy = 'Nothing here yet.') {
  const cleanItems = Array.isArray(items) ? items.filter(Boolean).slice(0, 4) : [];

  if (!cleanItems.length) {
    return `<p class="muted">${escapeHtml(emptyCopy)}</p>`;
  }

  return `
    <ul class="live-inline-list">
      ${cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
    </ul>
  `;
}

function buildInlineFindings(issues = []) {
  const cleanIssues = Array.isArray(issues) ? issues.slice(0, 4) : [];

  if (!cleanIssues.length) {
    return `
      <article class="live-finding">
        <p class="kicker">No sharp red flag yet</p>
        <h3>Jeni did not find a single obvious break on the first pass.</h3>
        <p class="muted">That usually means the signal is subtle, mixed, or needs a little more context.</p>
      </article>
    `;
  }

  return cleanIssues.map((issue) => `
    <article class="live-finding">
      <p class="kicker">${escapeHtml(issue.category || 'Signal')}</p>
      <h3>${escapeHtml(issue.issue || 'Needs attention')}</h3>
      <p class="muted">${escapeHtml(issue.whyItHurts || '')}</p>
      <span class="pill">${escapeHtml(issue.severity || 'medium')}</span>
    </article>
  `).join('');
}

const liveCheckForm = document.querySelector('[data-live-check-form]');

if (liveCheckForm) {
  const promptInput = liveCheckForm.querySelector('input[name="q"]');
  const submitButton = liveCheckForm.querySelector('button[type="submit"]');
  const liveSection = document.querySelector('[data-live-check-section]');
  const userCard = document.querySelector('[data-live-user]');
  const userText = document.querySelector('[data-live-user-text]');
  const thinkingWrap = document.querySelector('[data-live-thinking]');
  const resultsWrap = document.querySelector('[data-live-results]');
  const statusPill = document.querySelector('[data-live-status-pill]');
  const sourcePill = document.querySelector('[data-live-source-pill]');
  const errorNote = document.querySelector('[data-live-error]');

  let activePollTimer = null;
  let thinkingTimer = null;
  let currentAuditId = '';
  let frameIndex = 0;

  const defaultThinkingMarkup = thinkingWrap ? thinkingWrap.innerHTML : '';
  const thinkingFrames = [
    'Reading what you pasted.',
    'Checking trust, risk, and context.',
    'Finding the cleanest next move.',
    'Preparing the proof trail.'
  ];
  const statusLabels = {
    queued: 'Queued',
    scanning: 'Reading',
    analyzing: 'Thinking',
    completed: 'Ready',
    failed: 'Failed'
  };

  function getProgressNode() {
    return liveSection?.querySelector('[data-live-progress]') || null;
  }

  function getStepNodes() {
    return Array.from(liveSection?.querySelectorAll('[data-live-step]') || []);
  }

  function stopThinkingLoop() {
    if (thinkingTimer) {
      window.clearInterval(thinkingTimer);
      thinkingTimer = null;
    }
  }

  function stopPollingLoop() {
    if (activePollTimer) {
      window.clearInterval(activePollTimer);
      activePollTimer = null;
    }
  }

  function resetThinkingState() {
    if (!thinkingWrap) {
      return;
    }

    thinkingWrap.innerHTML = defaultThinkingMarkup;
    frameIndex = 0;
  }

  function startThinkingLoop() {
    stopThinkingLoop();
    const progressNode = getProgressNode();

    if (progressNode) {
      progressNode.textContent = thinkingFrames[0];
    }

    thinkingTimer = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % thinkingFrames.length;
      const nextProgressNode = getProgressNode();

      if (nextProgressNode) {
        nextProgressNode.textContent = thinkingFrames[frameIndex];
      }
    }, 1600);
  }

  function setStepState(status = 'queued') {
    const order = ['queued', 'scanning', 'analyzing', 'completed'];
    const statusIndex = order.indexOf(status);

    for (const node of getStepNodes()) {
      const nodeIndex = order.indexOf(node.getAttribute('data-step') || '');
      node.classList.remove('is-active', 'is-done');

      if (status === 'failed') {
        continue;
      }

      if (nodeIndex < statusIndex) {
        node.classList.add('is-done');
      } else if (nodeIndex === statusIndex) {
        node.classList.add('is-active');
      }
    }
  }

  function showFailure(message) {
    stopThinkingLoop();
    stopPollingLoop();

    if (statusPill) {
      statusPill.textContent = 'Failed';
    }

    if (thinkingWrap) {
      thinkingWrap.innerHTML = `
        <p class="live-response-intro">Jeni hit a wall on this pass.</p>
        <p class="muted">${escapeHtml(message || 'The live check could not finish right now.')}</p>
      `;
    }

    if (resultsWrap) {
      resultsWrap.hidden = true;
      resultsWrap.innerHTML = '';
    }

    if (errorNote) {
      errorNote.hidden = false;
      errorNote.dataset.state = 'warning';
      errorNote.textContent = message || 'The live check could not finish right now.';
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Check It';
    }
  }

  function renderLiveResult(payload) {
    const result = payload.result || {};
    const strongestAnchor = result.strongestPageFound || payload.website || 'Direct input';
    const firstRead = result.fiveSecondImpression || result.summary || 'Jeni finished the first read.';
    const mainSummary = result.summary || 'The signal has been mapped into a cleaner trust read.';

    stopThinkingLoop();
    stopPollingLoop();

    if (statusPill) {
      statusPill.textContent = 'Ready';
    }

    if (thinkingWrap) {
      thinkingWrap.innerHTML = `
        <p class="live-response-intro">${escapeHtml(firstRead)}</p>
        <p class="muted">${escapeHtml(mainSummary)}</p>
        <div class="mini-proof">
          <span class="pill">Score ${escapeHtml(String(result.overallScore ?? '--'))}</span>
          <span class="pill">${escapeHtml(strongestAnchor)}</span>
          <span class="pill">${escapeHtml(result.sourceMode || payload.source || 'analysis')}</span>
        </div>
      `;
    }

    if (resultsWrap) {
      resultsWrap.hidden = false;
      resultsWrap.innerHTML = `
        <div class="live-results-grid">
          <article class="live-panel live-panel-primary">
            <p class="kicker">What Jeni sees first</p>
            <h3>${escapeHtml(mainSummary)}</h3>
            <p class="muted">${escapeHtml(firstRead)}</p>
            <div class="mini-proof">
              <span class="pill">Best anchor: ${escapeHtml(strongestAnchor)}</span>
              <span class="pill">${escapeHtml(result.heroRewrite?.cta || 'Keep the proof')}</span>
            </div>
          </article>
          <article class="live-panel">
            <p class="kicker">Best first move</p>
            <h3>${escapeHtml(result.heroRewrite?.headline || 'Make the next move cleaner and calmer.')}</h3>
            <p class="muted">${escapeHtml(result.heroRewrite?.subheadline || 'Jeni turned the messy signal into a cleaner read with a clearer next step.')}</p>
          </article>
        </div>

        <div class="live-findings-grid">
          ${buildInlineFindings(result.topIssues)}
        </div>

        <div class="live-results-grid">
          <article class="live-panel">
            <p class="kicker">What to do next</p>
            ${buildInlineList(result.quickWins, 'Jeni is still tightening the next steps.')}
          </article>
          <article class="live-panel">
            <p class="kicker">Proof to keep</p>
            ${buildInlineList(result.trustRecommendations, 'The proof trail will appear here when it is ready.')}
          </article>
          <article class="live-panel">
            <p class="kicker">How the free version works</p>
            ${buildInlineList(result.bookingFlowRecommendations, 'Helpful ads only appear after the useful part, never inside the answer.')}
          </article>
          <article class="live-panel">
            <p class="kicker">Where this can go next</p>
            ${buildInlineList(result.seoRecommendations?.length ? result.seoRecommendations : result.recommendedFixes, 'Jeni will map the bigger module path here.')}
          </article>
        </div>

        <div class="actions">
          <a class="btn" href="/intake">Open the full scan</a>
          <a class="btn secondary" href="/case-studies">See all modules</a>
        </div>
      `;
    }

    if (errorNote) {
      errorNote.hidden = true;
      errorNote.textContent = '';
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Check It';
    }
  }

  async function pollLiveAudit() {
    if (!currentAuditId) {
      return;
    }

    try {
      const response = await fetch(`/api/audit/${encodeURIComponent(currentAuditId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `Trust scan request failed with status ${response.status}`);
      }

      if (statusPill) {
        statusPill.textContent = statusLabels[payload.status] || 'Thinking';
      }

      const progressNode = getProgressNode();
      if (progressNode && payload.status !== 'completed') {
        progressNode.textContent = payload.progress || thinkingFrames[frameIndex];
      }

      setStepState(payload.status);

      if (payload.status === 'failed') {
        showFailure(payload.errorMessage || 'The live check could not finish right now.');
        return;
      }

      if (payload.status === 'completed' && payload.result) {
        renderLiveResult(payload);
      }
    } catch (error) {
      showFailure(error.message);
    }
  }

  liveCheckForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!promptInput || !submitButton || !liveSection) {
      liveCheckForm.submit();
      return;
    }

    const prompt = String(promptInput.value || '').trim();

    if (!prompt) {
      promptInput.focus();
      return;
    }

    resetThinkingState();
    stopPollingLoop();
    stopThinkingLoop();
    currentAuditId = '';

    liveSection.hidden = false;
    liveSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (userCard) {
      userCard.hidden = false;
    }

    if (userText) {
      userText.textContent = prompt;
    }

    if (resultsWrap) {
      resultsWrap.hidden = true;
      resultsWrap.innerHTML = '';
    }

    if (statusPill) {
      statusPill.textContent = 'Queued';
    }

    if (sourcePill) {
      sourcePill.textContent = looksLikeUrlCandidate(prompt)
        ? normalizeUrlLikeValue(prompt)
        : 'Direct input';
    }

    if (errorNote) {
      errorNote.hidden = true;
      errorNote.textContent = '';
      errorNote.dataset.state = '';
    }

    setStepState('queued');
    startThinkingLoop();

    submitButton.disabled = true;
    submitButton.textContent = 'Thinking...';

    try {
      const formData = new FormData(liveCheckForm);
      const payload = Object.fromEntries(formData.entries());

      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      currentAuditId = result.auditId;
      await pollLiveAudit();

      if (!resultsWrap || resultsWrap.hidden) {
        activePollTimer = window.setInterval(pollLiveAudit, 2200);
      }
    } catch (error) {
      showFailure(error.message || 'Could not start the live check right now.');
    }
  });
}

const panels = document.querySelectorAll('[data-followup-panel]');

for (const panel of panels) {
  const clientId = panel.getAttribute('data-client-id');
  const generateButton = panel.querySelector('[data-generate-followup]');
  const regenerateButton = panel.querySelector('[data-regenerate-followup]');
  const copyButton = panel.querySelector('[data-copy-followup]');
  const channelField = panel.querySelector('[data-channel]');
  const messageTypeField = panel.querySelector('[data-message-type]');
  const messageContext = panel.querySelector('[data-message-context]');
  const resultCard = panel.querySelector('[data-followup-result]');
  const resultOutput = panel.querySelector('[data-followup-output]');
  const resultMeta = panel.querySelector('[data-followup-meta]');
  const notice = panel.querySelector('[data-followup-error]');

  let currentMessage = '';

  if (!generateButton || !channelField || !messageTypeField || !messageContext || !resultCard || !resultOutput || !resultMeta || !notice) {
    continue;
  }

  const messageSummaries = {
    inquiry_followup: 'For fresh inquiries that need a fast, confident next step.',
    missed_call: 'For callers that slipped through and need quick recovery.',
    reactivation: 'For old leads or clients that went quiet and need a clean re-entry.',
    review_request: 'For happy customers who should leave public proof.',
    consult_nudge: 'For consult prospects who need clarity and a gentle push.',
    booking_reminder: 'For booked prospects who should still show up and convert.'
  };

  function syncContext() {
    const selectedType = messageTypeField.value || 'inquiry_followup';
    messageContext.textContent = messageSummaries[selectedType] || messageSummaries.inquiry_followup;
  }

  async function requestFollowup() {
    const channel = channelField.value;
    const messageType = messageTypeField.value || 'inquiry_followup';

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';
    if (regenerateButton) {
      regenerateButton.disabled = true;
    }
    notice.textContent = 'Drafting the next message now.';
    notice.dataset.state = 'loading';

    try {
      const response = await fetch(`/api/followup/${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channel, messageType })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();
      const messageTypeLabel = messageTypeField.options[messageTypeField.selectedIndex]?.text || 'Message';

      currentMessage = payload.followup || '';
      resultOutput.textContent = currentMessage;
      resultMeta.textContent = payload.source === 'openai'
        ? `${messageTypeLabel} generated with ${payload.model}.`
        : `${messageTypeLabel} generated from the built-in local fallback template.`;
      resultCard.hidden = false;
      notice.dataset.state = payload.warning ? 'warning' : 'success';
      notice.textContent = payload.warning || 'Draft ready to review, edit, and send.';

      if (copyButton) {
        copyButton.disabled = !currentMessage;
      }
      if (regenerateButton) {
        regenerateButton.disabled = false;
      }
    } catch (error) {
      currentMessage = '';
      resultCard.hidden = true;
      notice.dataset.state = 'warning';
      notice.textContent = `Could not generate a follow-up right now. ${error.message}`;

      if (copyButton) {
        copyButton.disabled = true;
      }
      if (regenerateButton) {
        regenerateButton.disabled = true;
      }
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate Message';
    }
  }

  generateButton.addEventListener('click', requestFollowup);
  regenerateButton?.addEventListener('click', requestFollowup);
  messageTypeField.addEventListener('change', syncContext);
  syncContext();

  if (!copyButton) {
    continue;
  }

  copyButton.addEventListener('click', async () => {
    if (!currentMessage) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentMessage);
      copyButton.textContent = 'Copied';
      window.setTimeout(() => {
        copyButton.textContent = 'Copy Message';
      }, 1400);
    } catch (error) {
      notice.dataset.state = 'warning';
      notice.textContent = `Copy failed. ${error.message}`;
    }
  });
}

const opportunityPreviewForm = document.querySelector('[data-opportunity-preview-form]');

if (opportunityPreviewForm) {
  const submitButton = opportunityPreviewForm.querySelector('[data-preview-submit]');
  const previewTitle = document.querySelector('[data-preview-title]');
  const previewSummary = document.querySelector('[data-preview-summary]');
  const previewResults = document.querySelector('[data-preview-results]');
  const previewNotice = document.querySelector('[data-preview-notice]');

  opportunityPreviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitButton || !previewTitle || !previewSummary || !previewResults || !previewNotice) {
      return;
    }

    const formData = new FormData(opportunityPreviewForm);
    const payload = Object.fromEntries(formData.entries());

    submitButton.disabled = true;
    submitButton.textContent = 'Running Preview...';
    previewNotice.dataset.state = 'loading';
    previewNotice.textContent = 'Building a preview workspace now.';

    try {
      const response = await fetch('/api/opportunity-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const result = await response.json();
      const blueprint = result.blueprint || {};
      const opportunities = Array.isArray(result.opportunities) ? result.opportunities : [];

      previewTitle.textContent = blueprint.engineName || 'Preview ready';
      previewSummary.textContent = blueprint.previewSummary || 'Jeni generated a preview workspace from the current search inputs.';
      previewResults.innerHTML = `
        <article class="preview-result">
          <p class="result-kicker">Engine</p>
          <strong>${escapeHtml(blueprint.engineName || 'Adaptive Trust Engine')}</strong>
          <p class="muted">${escapeHtml(blueprint.workflowRecommendation || '')}</p>
          <div class="preview-tags">
            ${(blueprint.sourceMix || []).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join('')}
          </div>
        </article>
        <article class="preview-result">
          <p class="result-kicker">Verification Profile</p>
          <ul class="list-clean">
            ${(blueprint.verificationProfile || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        </article>
        ${opportunities.map((item) => `
          <article class="preview-result">
            <p class="result-kicker">${escapeHtml(item.freshness || 'Fresh')}</p>
            <strong>${escapeHtml(item.title || 'Signal preview')}</strong>
            <p class="muted">${escapeHtml(item.note || '')}</p>
            <div class="preview-meta">
              <span>${escapeHtml(item.source || 'Connected source')}</span>
              <span>Score ${escapeHtml(item.score || '--')}</span>
            </div>
          </article>
        `).join('')}
      `;
      previewNotice.dataset.state = 'success';
      previewNotice.textContent = result.gate || 'Preview complete. Saving and activation can stay gated until later.';
    } catch (error) {
      previewTitle.textContent = 'Preview unavailable';
      previewSummary.textContent = 'The preview workspace could not be generated right now.';
      previewResults.innerHTML = `
        <article class="preview-empty">
          <strong>Preview failed.</strong>
          <p class="muted">${error.message}</p>
        </article>
      `;
      previewNotice.dataset.state = 'warning';
      previewNotice.textContent = `Could not build the preview. ${error.message}`;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Run Instant Preview';
    }
  });
}

const intakeForm = document.querySelector('[data-intake-form]');

if (intakeForm) {
  const submitButton = intakeForm.querySelector('[data-intake-submit]');
  const statusNote = intakeForm.querySelector('[data-intake-status]');
  const urlInputs = intakeForm.querySelectorAll('[data-url-normalize]');

  for (const input of urlInputs) {
    input.addEventListener('blur', () => {
      input.value = normalizeUrlLikeValue(input.value);
    });
  }

  intakeForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!submitButton || !statusNote) {
      intakeForm.submit();
      return;
    }

    for (const input of urlInputs) {
      input.value = normalizeUrlLikeValue(input.value);
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Starting Scan...';
    statusNote.dataset.state = 'loading';
    statusNote.textContent = 'Creating your trust scan and starting the signal read now.';

    try {
      const formData = new FormData(intakeForm);
      const payload = Object.fromEntries(formData.entries());
      const response = await fetch('/api/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Request failed with status ${response.status}`);
      }

      window.location.assign(result.redirectUrl);
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = 'Start Trust Scan';
      statusNote.dataset.state = 'warning';
      statusNote.textContent = error.message || 'Could not start the trust scan right now.';
    }
  });
}

const auditPage = document.querySelector('[data-audit-page]');

function renderIssues(issues = []) {
  if (!issues.length) {
    return `
      <article class="card audit-issue-card">
        <p class="kicker">No findings yet</p>
        <h3>Still scanning</h3>
        <p class="muted">Jeni is still reading the signal.</p>
      </article>
    `;
  }

  return issues.map((issue) => `
    <article class="card audit-issue-card">
      <p class="kicker">${escapeHtml(issue.category || 'Issue')}</p>
      <h3>${escapeHtml(issue.issue || 'Needs attention')}</h3>
      <p class="muted">${escapeHtml(issue.whyItHurts || '')}</p>
      <span class="pill">${escapeHtml(issue.severity || 'medium')}</span>
    </article>
  `).join('');
}

function renderList(items = []) {
  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

if (auditPage) {
  const auditId = auditPage.getAttribute('data-audit-id');
  const progress = auditPage.querySelector('[data-audit-progress]');
  const statusPill = auditPage.querySelector('[data-audit-status-pill]');
  const sourceMode = auditPage.querySelector('[data-audit-source-mode]');
  const strongestPage = auditPage.querySelector('[data-audit-strongest-page]');
  const resultsWrap = auditPage.querySelector('[data-audit-results]');
  const detailWrap = auditPage.querySelector('[data-audit-detail-sections]');
  const errorWrap = auditPage.querySelector('[data-audit-error]');
  const errorMessage = auditPage.querySelector('[data-audit-error-message]');
  const overallScore = auditPage.querySelector('[data-audit-overall-score]');
  const summary = auditPage.querySelector('[data-audit-summary]');
  const fiveSecond = auditPage.querySelector('[data-audit-five-second]');
  const issuesWrap = auditPage.querySelector('[data-audit-issues]');
  const quickWinsWrap = auditPage.querySelector('[data-audit-quick-wins]');
  const recommendedFixesWrap = auditPage.querySelector('[data-audit-recommended-fixes]');
  const heroHeadline = auditPage.querySelector('[data-audit-hero-headline]');
  const heroSubheadline = auditPage.querySelector('[data-audit-hero-subheadline]');
  const heroCta = auditPage.querySelector('[data-audit-hero-cta]');
  const fixHeadline = auditPage.querySelector('[data-audit-fix-headline]');
  const fixCta = auditPage.querySelector('[data-audit-fix-cta]');
  const conversionLeaks = auditPage.querySelector('[data-audit-conversion-leaks]');
  const trustRecommendations = auditPage.querySelector('[data-audit-trust-recommendations]');
  const bookingRecommendations = auditPage.querySelector('[data-audit-booking-recommendations]');
  const seoRecommendations = auditPage.querySelector('[data-audit-seo-recommendations]');
  const missingElements = auditPage.querySelector('[data-audit-missing-elements]');
  const scoreFields = {
    clarity: auditPage.querySelector('[data-audit-score-clarity]'),
    trust: auditPage.querySelector('[data-audit-score-trust]'),
    cta: auditPage.querySelector('[data-audit-score-cta]'),
    booking: auditPage.querySelector('[data-audit-score-booking]'),
    seo: auditPage.querySelector('[data-audit-score-seo]'),
    mobile: auditPage.querySelector('[data-audit-score-mobile]')
  };

  let pollTimer = null;
  const statusLabels = {
    queued: 'Queued',
    scanning: 'Scanning',
    analyzing: 'Analyzing',
    completed: 'Completed',
    failed: 'Failed'
  };

  async function pollAudit() {
    try {
      const response = await fetch(`/api/audit/${encodeURIComponent(auditId)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || `Trust scan request failed with status ${response.status}`);
      }

      if (progress) {
        progress.textContent = payload.progress || 'Preparing your trust scan...';
      }

      if (statusPill) {
        statusPill.textContent = statusLabels[payload.status] || payload.status || 'Queued';
      }
      if (sourceMode) {
        sourceMode.textContent = payload.source || 'pending';
      }

      if (payload.status === 'failed') {
        if (errorWrap) {
          errorWrap.hidden = false;
        }
        if (errorMessage) {
          errorMessage.textContent = payload.errorMessage || 'The audit could not be completed.';
        }
        if (pollTimer) {
          window.clearInterval(pollTimer);
        }
        return;
      }

      if (payload.status !== 'completed' || !payload.result) {
        return;
      }

      const result = payload.result;
      if (resultsWrap) resultsWrap.hidden = false;
      if (detailWrap) detailWrap.hidden = false;
      if (errorWrap) errorWrap.hidden = true;
      if (overallScore) overallScore.textContent = String(result.overallScore ?? '--');
      if (summary) summary.textContent = result.summary || '';
      if (fiveSecond) fiveSecond.textContent = result.fiveSecondImpression || '';
      if (strongestPage) strongestPage.textContent = result.strongestPageFound || payload.website || '';

      Object.entries(scoreFields).forEach(([key, node]) => {
        if (node) {
          node.textContent = String(result.scores?.[key] ?? '--');
        }
      });

      if (issuesWrap) {
        issuesWrap.innerHTML = renderIssues(Array.isArray(result.topIssues) ? result.topIssues : []);
      }
      if (quickWinsWrap) {
        quickWinsWrap.innerHTML = renderList(Array.isArray(result.quickWins) ? result.quickWins : []);
      }
      if (recommendedFixesWrap) {
        recommendedFixesWrap.innerHTML = renderList(Array.isArray(result.recommendedFixes) ? result.recommendedFixes : []);
      }
      if (heroHeadline) {
        heroHeadline.textContent = result.heroRewrite?.headline || '';
      }
      if (heroSubheadline) {
        heroSubheadline.textContent = result.heroRewrite?.subheadline || '';
      }
      if (heroCta) {
        heroCta.textContent = result.heroRewrite?.cta || '';
      }
      if (fixHeadline) {
        fixHeadline.textContent = result.heroRewrite?.headline || '';
      }
      if (fixCta) {
        fixCta.textContent = result.heroRewrite?.cta || '';
      }
      if (conversionLeaks) {
        conversionLeaks.innerHTML = renderList(Array.isArray(result.conversionLeaks) ? result.conversionLeaks : []);
      }
      if (trustRecommendations) {
        trustRecommendations.innerHTML = renderList(Array.isArray(result.trustRecommendations) ? result.trustRecommendations : []);
      }
      if (bookingRecommendations) {
        bookingRecommendations.innerHTML = renderList(Array.isArray(result.bookingFlowRecommendations) ? result.bookingFlowRecommendations : []);
      }
      if (seoRecommendations) {
        seoRecommendations.innerHTML = renderList(Array.isArray(result.seoRecommendations) ? result.seoRecommendations : []);
      }
      if (missingElements) {
        missingElements.innerHTML = renderList(Array.isArray(result.missingElements) ? result.missingElements : []);
      }

      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
    } catch (error) {
      if (progress) {
        progress.textContent = `Still working. ${error.message}`;
      }
    }
  }

  pollAudit();
  pollTimer = window.setInterval(pollAudit, 2500);
}
