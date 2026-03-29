const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const clientsFile = path.join(dataDir, 'clients.json');
const auditsFile = path.join(dataDir, 'audits.json');

function ensureDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function ensureClientsFile() {
  ensureDir();

  if (!fs.existsSync(clientsFile)) {
    fs.writeFileSync(clientsFile, '[]\n');
  }
}

function ensureAuditsFile() {
  ensureDir();

  if (!fs.existsSync(auditsFile)) {
    fs.writeFileSync(auditsFile, JSON.stringify({ jobs: [], results: [], pages: [] }, null, 2));
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function readClients() {
  ensureClientsFile();
  return readJson(clientsFile, []);
}

function writeClients(clients) {
  ensureClientsFile();
  writeJson(clientsFile, clients);
}

function readAudits() {
  ensureAuditsFile();
  const audits = readJson(auditsFile, { jobs: [], results: [], pages: [] });

  return {
    jobs: Array.isArray(audits.jobs) ? audits.jobs : [],
    results: Array.isArray(audits.results) ? audits.results : [],
    pages: Array.isArray(audits.pages) ? audits.pages : []
  };
}

function writeAudits(audits) {
  ensureAuditsFile();
  writeJson(auditsFile, audits);
}

function buildJsonStorage() {
  return {
    mode: 'json',
    async createClient(clientInput) {
      const clients = readClients();
      clients.push(clientInput);
      writeClients(clients);
      return clientInput;
    },
    async getClientById(id) {
      return readClients().find((client) => client.id === id) || null;
    },
    async listClients() {
      return readClients();
    },
    async appendCallLog(clientId, log) {
      const clients = readClients();
      const index = clients.findIndex((client) => client.id === clientId);

      if (index === -1) {
        return null;
      }

      const client = clients[index];
      client.callLogs = Array.isArray(client.callLogs) ? client.callLogs : [];
      client.callLogs.push(log);
      clients[index] = client;
      writeClients(clients);
      return client;
    },
    async createAuditJob(auditInput) {
      const audits = readAudits();
      audits.jobs.push(auditInput);
      writeAudits(audits);
      return auditInput;
    },
    async getAuditJobById(id) {
      return readAudits().jobs.find((job) => job.id === id) || null;
    },
    async listAuditJobs() {
      return readAudits().jobs;
    },
    async getLatestAuditJobForClient(clientId) {
      const jobs = readAudits().jobs
        .filter((job) => job.clientId === clientId)
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      return jobs[0] || null;
    },
    async getLatestAuditForClient(clientId) {
      const job = await this.getLatestAuditJobForClient(clientId);
      const result = job ? await this.getAuditResult(job.id) : null;
      return { job, result };
    },
    async updateAuditJobStatus(id, status, extraFields = {}) {
      const audits = readAudits();
      const index = audits.jobs.findIndex((job) => job.id === id);

      if (index === -1) {
        return null;
      }

      audits.jobs[index] = {
        ...audits.jobs[index],
        status,
        ...extraFields
      };
      writeAudits(audits);
      return audits.jobs[index];
    },
    async saveAuditPages(auditJobId, pages) {
      const audits = readAudits();
      audits.pages = audits.pages.filter((page) => page.auditJobId !== auditJobId);
      audits.pages.push(...pages);
      writeAudits(audits);
      return pages;
    },
    async getAuditPages(auditJobId) {
      return readAudits().pages.filter((page) => page.auditJobId === auditJobId);
    },
    async saveAuditResult(auditJobId, result) {
      const audits = readAudits();
      const index = audits.results.findIndex((item) => item.auditJobId === auditJobId);

      if (index === -1) {
        audits.results.push(result);
      } else {
        audits.results[index] = result;
      }

      writeAudits(audits);
      return result;
    },
    async getAuditResult(auditJobId) {
      return readAudits().results.find((result) => result.auditJobId === auditJobId) || null;
    }
  };
}

module.exports = {
  buildJsonStorage
};
