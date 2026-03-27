function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const panels = document.querySelectorAll('[data-followup-panel]');

for (const panel of panels) {
  const clientId = panel.getAttribute('data-client-id');
  const generateButton = panel.querySelector('[data-generate-followup]');
  const copyButton = panel.querySelector('[data-copy-followup]');
  const channelField = panel.querySelector('[data-channel]');
  const resultCard = panel.querySelector('[data-followup-result]');
  const resultOutput = panel.querySelector('[data-followup-output]');
  const resultMeta = panel.querySelector('[data-followup-meta]');
  const notice = panel.querySelector('[data-followup-error]');

  let currentMessage = '';

  if (!generateButton || !channelField || !resultCard || !resultOutput || !resultMeta || !notice) {
    continue;
  }

  generateButton.addEventListener('click', async () => {
    const channel = channelField.value;

    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';
    notice.textContent = 'Drafting a personalized follow-up now.';
    notice.dataset.state = 'loading';

    try {
      const response = await fetch(`/api/followup/${encodeURIComponent(clientId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ channel })
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = await response.json();

      currentMessage = payload.followup || '';
      resultOutput.textContent = currentMessage;
      resultMeta.textContent = payload.source === 'openai'
        ? `Generated with ${payload.model}.`
        : 'Generated from the built-in local fallback template.';
      resultCard.hidden = false;
      notice.dataset.state = payload.warning ? 'warning' : 'success';
      notice.textContent = payload.warning || 'Draft ready to review, edit, and send.';

      if (copyButton) {
        copyButton.disabled = !currentMessage;
      }
    } catch (error) {
      currentMessage = '';
      resultCard.hidden = true;
      notice.dataset.state = 'warning';
      notice.textContent = `Could not generate a follow-up right now. ${error.message}`;

      if (copyButton) {
        copyButton.disabled = true;
      }
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate Follow-up';
    }
  });

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
      previewSummary.textContent = blueprint.previewSummary || 'Zumi generated a preview workspace from the current search inputs.';
      previewResults.innerHTML = `
        <article class="preview-result">
          <p class="result-kicker">Engine</p>
          <strong>${escapeHtml(blueprint.engineName || 'Adaptive Opportunity Engine')}</strong>
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
            <strong>${escapeHtml(item.title || 'Opportunity preview')}</strong>
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
