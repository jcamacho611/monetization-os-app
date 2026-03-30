const crypto = require('crypto');
const { fetchSitePages } = require('./site-fetcher');
const { parsePageHtml, buildSiteSummary } = require('./site-parser');
const { buildAuditInput, buildHeuristicAudit, auditJsonSchema } = require('./audit-prompts');

const activeJobs = new Set();

function auditPageRecord(auditJobId, page) {
  const parsed = parsePageHtml(page);
  return {
    id: crypto.randomUUID(),
    auditJobId,
    url: parsed.url,
    pageType: parsed.pageType,
    title: parsed.title,
    metaDescription: parsed.metaDescription,
    h1: parsed.h1,
    textExcerpt: parsed.textExcerpt,
    ctaText: (parsed.ctaTexts || []).slice(0, 5).join(' | '),
    rawHtmlExcerpt: parsed.rawHtmlExcerpt,
    createdAt: new Date().toISOString(),
    parsed
  };
}

async function generateAuditWithOpenAI({ openaiClient, model, client, siteSummary }) {
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const response = await openaiClient.responses.create({
    model,
    input: buildAuditInput(client, siteSummary),
    text: {
      format: {
        type: 'json_schema',
        name: 'jeni_trust_audit',
        strict: true,
        schema: auditJsonSchema
      }
    }
  });

  const output = response.output_text ? response.output_text.trim() : '';

  if (!output) {
    throw new Error('OpenAI audit returned no output text.');
  }

  const parsed = JSON.parse(output);
  parsed.id = parsed.id || `ar-${Date.now()}`;
  parsed.source = 'openai';
  parsed.sourceMode = parsed.sourceMode || 'openai';
  parsed.createdAt = parsed.createdAt || new Date().toISOString();
  parsed.updatedAt = new Date().toISOString();
  return parsed;
}

async function runAuditJob(auditJobId, deps) {
  if (activeJobs.has(auditJobId)) {
    return;
  }

  activeJobs.add(auditJobId);

  try {
    const auditJob = await deps.storage.getAuditJobById(auditJobId);

    if (!auditJob) {
      throw new Error('Audit job not found.');
    }

    const client = await deps.storage.getClientById(auditJob.clientId);

    if (!client || !client.website) {
      throw new Error('Client or website missing.');
    }

    await deps.storage.updateAuditJobStatus(auditJobId, 'scanning', {
      startedAt: auditJob.startedAt || new Date().toISOString(),
      progressLabel: 'Reading your signal.'
    });

    const fetched = await fetchSitePages(client.website, {
      maxPages: deps.maxPages,
      timeoutMs: deps.fetchTimeoutMs
    });

    const pageRecords = fetched.pages.map((page) => auditPageRecord(auditJobId, page));
    await deps.storage.saveAuditPages(auditJobId, pageRecords);

    await deps.storage.updateAuditJobStatus(auditJobId, 'analyzing', {
      startedAt: auditJob.startedAt || new Date().toISOString(),
      progressLabel: 'Pulling the strongest market clues.'
    });

    const siteSummary = buildSiteSummary(pageRecords.map((page) => page.parsed));
    let result;

    try {
      await deps.storage.updateAuditJobStatus(auditJobId, 'analyzing', {
        startedAt: auditJob.startedAt || new Date().toISOString(),
        progressLabel: 'Scoring urgency, spread, ad fit, and trust primitives.'
      });
      result = await generateAuditWithOpenAI({
        openaiClient: deps.openaiClient,
        model: deps.model,
        client,
        siteSummary
      });
    } catch (error) {
      console.error('OpenAI audit failed, using heuristic fallback:', error.message);
      result = buildHeuristicAudit(client, siteSummary);
    }

    await deps.storage.saveAuditResult(auditJobId, {
      ...result,
      auditJobId,
      updatedAt: new Date().toISOString()
    });

    await deps.storage.updateAuditJobStatus(auditJobId, 'completed', {
      progressLabel: 'Your trust blueprint is ready.',
      completedAt: new Date().toISOString(),
      source: result.source
    });
  } catch (error) {
    console.error('Audit job failed:', error.message);
    await deps.storage.updateAuditJobStatus(auditJobId, 'failed', {
      progressLabel: 'We could not finish the trust blueprint.',
      completedAt: new Date().toISOString(),
      errorMessage: error.message
    });
  } finally {
    activeJobs.delete(auditJobId);
  }
}

function queueAuditJob(auditJobId, deps) {
  setImmediate(() => {
    runAuditJob(auditJobId, deps).catch((error) => {
      console.error('Queued audit job failed:', error.message);
    });
  });
}

module.exports = {
  queueAuditJob,
  runAuditJob
};
