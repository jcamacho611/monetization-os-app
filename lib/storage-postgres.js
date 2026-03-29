const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const initSql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'init.sql'), 'utf8');

function normalizeClient(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    businessName: record.business_name,
    owner: record.owner,
    email: record.email,
    phone: record.phone,
    website: record.website,
    sitePlatform: record.site_platform,
    category: record.category,
    goal: record.goal,
    notes: record.notes,
    plan: record.plan,
    businessSize: record.business_size,
    leadVolume: record.lead_volume,
    salesMotion: record.sales_motion,
    preferredChannel: record.preferred_channel,
    socialStack: record.social_stack,
    instagram: record.instagram,
    facebook: record.facebook,
    mainServices: record.main_services,
    bookingSystem: record.booking_system,
    callLogs: Array.isArray(record.call_logs) ? record.call_logs : [],
    scanConsent: record.scan_consent,
    publishConsent: record.publish_consent,
    legalConsent: record.legal_consent,
    createdAt: record.created_at
  };
}

function normalizeAuditJob(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    clientId: record.client_id,
    status: record.status,
    progressLabel: record.progress_label,
    startedAt: record.started_at,
    completedAt: record.completed_at,
    errorMessage: record.error_message,
    source: record.source,
    createdAt: record.created_at
  };
}

function buildPostgresStorage(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });

  let initialized = false;

  async function ensureInitialized() {
    if (initialized) {
      return;
    }

    await pool.query(initSql);
    initialized = true;
  }

  return {
    mode: 'postgres',
    async createClient(client) {
      await ensureInitialized();
      const result = await pool.query(
        `insert into clients (
          id, business_name, owner, email, phone, website, site_platform, category, goal, notes, plan,
          business_size, lead_volume, sales_motion, preferred_channel, social_stack, instagram, facebook,
          main_services, booking_system, call_logs, scan_consent, publish_consent, legal_consent, created_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,$25
        )
        returning *`,
        [
          client.id,
          client.businessName,
          client.owner,
          client.email,
          client.phone,
          client.website,
          client.sitePlatform,
          client.category,
          client.goal,
          client.notes,
          client.plan,
          client.businessSize,
          client.leadVolume,
          client.salesMotion,
          client.preferredChannel,
          client.socialStack,
          client.instagram,
          client.facebook,
          client.mainServices,
          client.bookingSystem,
          JSON.stringify(client.callLogs || []),
          client.scanConsent,
          client.publishConsent,
          client.legalConsent,
          client.createdAt
        ]
      );

      return normalizeClient(result.rows[0]);
    },
    async getClientById(id) {
      await ensureInitialized();
      const result = await pool.query('select * from clients where id = $1 limit 1', [id]);
      return normalizeClient(result.rows[0]);
    },
    async listClients() {
      await ensureInitialized();
      const result = await pool.query('select * from clients order by created_at desc');
      return result.rows.map(normalizeClient);
    },
    async appendCallLog(clientId, log) {
      const client = await this.getClientById(clientId);

      if (!client) {
        return null;
      }

      const callLogs = [...(Array.isArray(client.callLogs) ? client.callLogs : []), log];
      await pool.query('update clients set call_logs = $2 where id = $1', [clientId, JSON.stringify(callLogs)]);
      return { ...client, callLogs };
    },
    async createAuditJob(auditJob) {
      await ensureInitialized();
      const result = await pool.query(
        `insert into audit_jobs (
          id, client_id, status, progress_label, started_at, completed_at, error_message, source, created_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        returning *`,
        [
          auditJob.id,
          auditJob.clientId,
          auditJob.status,
          auditJob.progressLabel || '',
          auditJob.startedAt || null,
          auditJob.completedAt || null,
          auditJob.errorMessage || '',
          auditJob.source || '',
          auditJob.createdAt
        ]
      );
      return normalizeAuditJob(result.rows[0]);
    },
    async getAuditJobById(id) {
      await ensureInitialized();
      const result = await pool.query('select * from audit_jobs where id = $1 limit 1', [id]);
      return normalizeAuditJob(result.rows[0]);
    },
    async listAuditJobs() {
      await ensureInitialized();
      const result = await pool.query('select * from audit_jobs order by created_at desc');
      return result.rows.map(normalizeAuditJob);
    },
    async getLatestAuditJobForClient(clientId) {
      await ensureInitialized();
      const result = await pool.query(
        'select * from audit_jobs where client_id = $1 order by created_at desc limit 1',
        [clientId]
      );
      return normalizeAuditJob(result.rows[0]);
    },
    async getLatestAuditForClient(clientId) {
      const job = await this.getLatestAuditJobForClient(clientId);
      const result = job ? await this.getAuditResult(job.id) : null;
      return { job, result };
    },
    async updateAuditJobStatus(id, status, extraFields = {}) {
      await ensureInitialized();
      const current = await this.getAuditJobById(id);

      if (!current) {
        return null;
      }

      const next = {
        ...current,
        status,
        ...extraFields
      };

      const result = await pool.query(
        `update audit_jobs
         set status = $2,
             progress_label = $3,
             started_at = $4,
             completed_at = $5,
             error_message = $6,
             source = $7
         where id = $1
         returning *`,
        [
          id,
          next.status,
          next.progressLabel || '',
          next.startedAt || null,
          next.completedAt || null,
          next.errorMessage || '',
          next.source || ''
        ]
      );
      return normalizeAuditJob(result.rows[0]);
    },
    async saveAuditPages(auditJobId, pages) {
      await ensureInitialized();
      await pool.query('delete from audit_pages where audit_job_id = $1', [auditJobId]);

      for (const page of pages) {
        await pool.query(
          `insert into audit_pages (
            id, audit_job_id, url, page_type, title, meta_description, h1, text_excerpt, cta_text, raw_html_excerpt, created_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            page.id,
            auditJobId,
            page.url,
            page.pageType,
            page.title || '',
            page.metaDescription || '',
            page.h1 || '',
            page.textExcerpt || '',
            page.ctaText || '',
            page.rawHtmlExcerpt || '',
            page.createdAt
          ]
        );
      }

      return pages;
    },
    async getAuditPages(auditJobId) {
      await ensureInitialized();
      const result = await pool.query('select * from audit_pages where audit_job_id = $1 order by created_at asc', [auditJobId]);
      return result.rows.map((row) => ({
        id: row.id,
        auditJobId: row.audit_job_id,
        url: row.url,
        pageType: row.page_type,
        title: row.title,
        metaDescription: row.meta_description,
        h1: row.h1,
        textExcerpt: row.text_excerpt,
        ctaText: row.cta_text,
        rawHtmlExcerpt: row.raw_html_excerpt,
        createdAt: row.created_at
      }));
    },
    async saveAuditResult(auditJobId, result) {
      await ensureInitialized();
      const query = `
        insert into audit_results (
          id, audit_job_id, overall_score, summary, trust_score, clarity_score, cta_score, booking_score, seo_score,
          mobile_score, quick_wins_json, issues_json, rewritten_hero_json, structured_output_json, created_at, updated_at
        ) values (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16
        )
        on conflict (audit_job_id) do update set
          overall_score = excluded.overall_score,
          summary = excluded.summary,
          trust_score = excluded.trust_score,
          clarity_score = excluded.clarity_score,
          cta_score = excluded.cta_score,
          booking_score = excluded.booking_score,
          seo_score = excluded.seo_score,
          mobile_score = excluded.mobile_score,
          quick_wins_json = excluded.quick_wins_json,
          issues_json = excluded.issues_json,
          rewritten_hero_json = excluded.rewritten_hero_json,
          structured_output_json = excluded.structured_output_json,
          updated_at = excluded.updated_at
        returning *`;

      await pool.query(query, [
        result.id,
        auditJobId,
        result.overallScore,
        result.summary,
        result.scores?.trust ?? null,
        result.scores?.clarity ?? null,
        result.scores?.cta ?? null,
        result.scores?.booking ?? null,
        result.scores?.seo ?? null,
        result.scores?.mobile ?? null,
        JSON.stringify(result.quickWins || []),
        JSON.stringify(result.topIssues || []),
        JSON.stringify(result.heroRewrite || {}),
        JSON.stringify(result),
        result.createdAt,
        result.updatedAt
      ]);
      return result;
    },
    async getAuditResult(auditJobId) {
      await ensureInitialized();
      const result = await pool.query('select * from audit_results where audit_job_id = $1 limit 1', [auditJobId]);
      const row = result.rows[0];

      if (!row) {
        return null;
      }

      return row.structured_output_json;
    }
  };
}

module.exports = {
  buildPostgresStorage
};
