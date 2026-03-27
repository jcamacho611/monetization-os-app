const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const dataFile = path.join(__dirname, 'data', 'clients.json');

const sessions = new Map();

function readClients() {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return [];
  }
}

function writeClients(clients) {
  fs.writeFileSync(dataFile, JSON.stringify(clients, null, 2));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((pair) => {
        const i = pair.indexOf('=');
        return [pair.slice(0, i), decodeURIComponent(pair.slice(i + 1))];
      })
  );
}

function escapeHtml(text = '') {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sendHtml(res, html, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function sendJson(res, body, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseFormBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      resolve(Object.fromEntries(params.entries()));
    });
  });
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function getUserFromRequest(req) {
  const cookies = parseCookies(req);
  const sid = cookies.sid;
  return sid ? sessions.get(sid) : null;
}

function requireAuth(req, res) {
  if (getUserFromRequest(req)) return true;
  res.writeHead(302, { Location: '/login' });
  res.end();
  return false;
}

function layout(title, content, user) {
  const authLink = user
    ? `<a href="/logout">Sign out</a>`
    : `<a href="/login">Sign in</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="stylesheet" href="/styles.css" />
  <script defer src="/app.js"></script>
</head>
<body>
  <header>
    <div class="container nav-wrap">
      <a class="brand" href="/">Local Growth Portal</a>
      <nav>
        <a href="/intake">Intake</a>
        <a href="/admin">Dashboard</a>
        ${authLink}
      </nav>
    </div>
  </header>
  <main class="container">${content}</main>
  <footer class="container">Built for local services · dark-mode MVP</footer>
</body>
</html>`;
}

function homePage(user) {
  const content = `
<section class="hero card">
  <div>
    <p class="eyebrow">Growth Assistant</p>
    <h1>Simplify your follow-up, reviews, and lead recovery.</h1>
    <p class="muted">A premium dashboard for home-service businesses that turns missed leads into booked jobs with guided actions and AI-assisted outreach.</p>
    <div class="actions">
      <a class="btn primary" href="/intake">Start Free Trial</a>
      <a class="btn ghost" href="/login">Sign In</a>
      <a class="btn ghost" href="/intake">Request Demo</a>
    </div>
  </div>
  <div class="hero-side">
    <h3>Why it works</h3>
    <ol>
      <li>Capture every new client in one intake flow.</li>
      <li>Generate personalized follow-up in seconds.</li>
      <li>Share a private portal with weekly growth fixes.</li>
    </ol>
  </div>
</section>

<section class="pricing">
  <h2>Plans built for local operators</h2>
  <div class="grid-3">
    <article class="card plan"><h3>Starter</h3><p class="price">$79<span>/mo</span></p><p class="muted">Essential weekly fixes + review scripts.</p><a class="btn primary" href="/intake">Choose Starter</a></article>
    <article class="card plan"><h3>Pro</h3><p class="price">$149<span>/mo</span></p><p class="muted">Advanced follow-up workflows + support.</p><a class="btn primary" href="/intake">Choose Pro</a></article>
    <article class="card plan"><h3>Setup + Monthly</h3><p class="price">$199 + $79<span>/mo</span></p><p class="muted">Done-with-you setup, then weekly execution.</p><a class="btn primary" href="/intake">Book Setup</a></article>
  </div>
</section>`;

  return layout('Local Growth Portal', content, user);
}

function loginPage(message = '') {
  const notice = message ? `<p class="notice">${escapeHtml(message)}</p>` : '';
  const content = `<section class="card auth-card"><h2>Admin sign in</h2>${notice}
<form method="POST" action="/login" class="auth-form">
  <label>Username<input name="username" required /></label>
  <label>Password<input name="password" type="password" required /></label>
  <button class="btn primary" type="submit">Sign In</button>
</form></section>`;
  return layout('Sign In', content, null);
}

function intakePage(user) {
  const content = `<section class="card"><h2>Client intake</h2><p class="muted">Create a client profile and private portal link.</p>
<form method="POST" action="/intake" class="form-grid">
  <label>Business Name<input required name="businessName" /></label>
  <label>Owner<input required name="owner" /></label>
  <label>Email<input required type="email" name="email" /></label>
  <label>Phone<input name="phone" /></label>
  <label>Website<input name="website" /></label>
  <label>Category<input name="category" /></label>
  <label class="full">Main Goal<input name="goal" /></label>
  <label class="full">Notes<textarea name="notes"></textarea></label>
  <button class="btn primary full" type="submit">Save client</button>
</form></section>`;
  return layout('Client Intake', content, user);
}

function adminPage(clients, query, user) {
  const q = query.toLowerCase();
  const filtered = clients.filter((c) =>
    [c.businessName, c.owner, c.email, c.category].join(' ').toLowerCase().includes(q)
  );

  const rows = filtered
    .map(
      (c) => `<tr>
<td>${escapeHtml(c.businessName)}</td>
<td>${escapeHtml(c.email)}</td>
<td>${new Date(c.createdAt).toLocaleDateString()}</td>
<td><span class="status">Active</span></td>
<td><a href="/admin/client/${c.id}">Open</a></td>
<td><a href="/portal/${c.portalToken}">Portal</a></td>
</tr>`
    )
    .join('');

  const content = `<section class="card"><h2>Admin dashboard</h2>
<form method="GET" action="/admin" class="search-form">
  <input name="q" value="${escapeHtml(query)}" placeholder="Search clients" />
  <button class="btn ghost" type="submit">Search</button>
</form>
<p class="muted">Showing ${filtered.length} of ${clients.length} clients.</p>
<table><thead><tr><th>Business</th><th>Email</th><th>Date</th><th>Status</th><th>Details</th><th>Portal</th></tr></thead><tbody>${rows}</tbody></table>
</section>`;

  return layout('Admin Dashboard', content, user);
}

function adminClientPage(client, user) {
  const content = `<section class="card"><h2>${escapeHtml(client.businessName)}</h2>
<p class="muted">Owner: ${escapeHtml(client.owner)} · Category: ${escapeHtml(client.category)}</p>
<div class="detail-grid">
  <p><strong>Email:</strong> ${escapeHtml(client.email)}</p>
  <p><strong>Phone:</strong> ${escapeHtml(client.phone || 'N/A')}</p>
  <p><strong>Website:</strong> ${escapeHtml(client.website || 'N/A')}</p>
  <p><strong>Portal Link:</strong> <a href="/portal/${client.portalToken}">/portal/${client.portalToken}</a></p>
</div>
<p><strong>Main goal:</strong> ${escapeHtml(client.goal || 'N/A')}</p>
<p><strong>Notes:</strong> ${escapeHtml(client.notes || 'N/A')}</p>
<div class="ai-box">
  <button class="btn primary" data-followup-button data-client-id="${client.id}">Generate AI Follow-up</button>
  <pre id="followup-output">Click “Generate AI Follow-up” to draft a message.</pre>
</div>
</section>`;
  return layout(`${client.businessName} | Admin`, content, user);
}

function portalPage(client, user) {
  const fixes = ['Respond to missed calls in under 5 minutes.', 'Add financing CTA to homepage.', 'Ask for one Google review after each completed job.', 'Publish one GBP update weekly.', 'Follow up on all unbooked estimates in 24 hours.'];
  const reviewTemplates = ['Hi {{name}}, thanks for choosing us today. Could you leave a quick Google review?', 'Your feedback helps neighbors choose trusted local pros. Would you share your experience?'];
  const content = `<section class="card"><h2>${escapeHtml(client.businessName)} Client Portal</h2><p class="muted">Private growth plan for ${escapeHtml(client.owner)}</p></section>
<section class="portal-grid">
  <article class="card"><h3>Top 5 fixes</h3><ul>${fixes.map((f) => `<li>${f}</li>`).join('')}</ul></article>
  <article class="card"><h3>Review templates</h3><ul>${reviewTemplates.map((f) => `<li>${f}</li>`).join('')}</ul></article>
  <article class="card"><h3>Progress notes</h3><p class="muted">${escapeHtml(client.notes || 'No notes yet.')}</p></article>
  <article class="card"><h3>Next steps</h3><p class="muted">Run AI follow-up from admin and send this week’s outreach campaign.</p></article>
</section>`;
  return layout(`${client.businessName} Portal`, content, user);
}

function buildFallbackFollowup(client) {
  return `Hi ${client.owner},\n\nQuick follow-up from Local Growth Portal for ${client.businessName}.\nThis week we recommend focusing on: ${client.goal || 'capturing and converting missed leads'}.\n\nWould you like us to prepare your next review request and missed-call recovery message?\n\n— Your Growth Assistant`;
}

function callOpenAI(promptText) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'gpt-4.1-mini',
      input: promptText
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/responses',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const output = parsed.output_text || '';
            if (!output) {
              return reject(new Error(parsed.error?.message || 'No output_text returned.'));
            }
            resolve(output.trim());
          } catch {
            reject(new Error('Failed to parse OpenAI response.'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function handleFollowupApi(req, res) {
  if (!getUserFromRequest(req)) {
    return sendJson(res, { error: 'Unauthorized' }, 401);
  }

  const body = await parseJsonBody(req);
  const client = readClients().find((c) => c.id === body.clientId);
  if (!client) return sendJson(res, { error: 'Client not found' }, 404);

  const fallback = buildFallbackFollowup(client);

  if (!OPENAI_API_KEY) {
    return sendJson(res, { followup: fallback, source: 'template' });
  }

  const prompt = `Write a concise, friendly follow-up message for ${client.owner} at ${client.businessName}. Goal: ${client.goal || 'Improve follow-up and review generation'}. Keep it practical and action-oriented.`;

  try {
    const followup = await callOpenAI(prompt);
    return sendJson(res, { followup, source: 'openai' });
  } catch (error) {
    return sendJson(res, { followup: fallback, source: 'template', warning: error.message });
  }
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const user = getUserFromRequest(req);

  if (req.method === 'GET' && pathname === '/styles.css') {
    const css = fs.readFileSync(path.join(__dirname, 'public', 'styles.css'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
    return res.end(css);
  }

  if (req.method === 'GET' && pathname === '/app.js') {
    const js = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    return res.end(js);
  }

  if (req.method === 'GET' && pathname === '/') return sendHtml(res, homePage(user));
  if (req.method === 'GET' && pathname === '/intake') return sendHtml(res, intakePage(user));

  if (req.method === 'POST' && pathname === '/intake') {
    const form = await parseFormBody(req);
    const clients = readClients();
    clients.push({
      id: `c${Date.now()}`,
      portalToken: crypto.randomBytes(8).toString('hex'),
      businessName: form.businessName || '',
      owner: form.owner || '',
      email: form.email || '',
      phone: form.phone || '',
      website: form.website || '',
      category: form.category || '',
      goal: form.goal || '',
      notes: form.notes || '',
      createdAt: new Date().toISOString()
    });
    writeClients(clients);
    res.writeHead(302, { Location: '/admin' });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/login') return sendHtml(res, loginPage());

  if (req.method === 'POST' && pathname === '/login') {
    const form = await parseFormBody(req);
    if (form.username === ADMIN_USER && form.password === ADMIN_PASSWORD) {
      const sid = crypto.randomBytes(18).toString('hex');
      sessions.set(sid, { username: form.username, createdAt: Date.now() });
      res.writeHead(302, {
        Location: '/admin',
        'Set-Cookie': `sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax`
      });
      return res.end();
    }
    return sendHtml(res, loginPage('Invalid username or password.'), 401);
  }

  if (req.method === 'GET' && pathname === '/logout') {
    const cookies = parseCookies(req);
    if (cookies.sid) sessions.delete(cookies.sid);
    res.writeHead(302, { Location: '/', 'Set-Cookie': 'sid=; Max-Age=0; Path=/; SameSite=Lax' });
    return res.end();
  }

  if (req.method === 'GET' && pathname === '/admin') {
    if (!requireAuth(req, res)) return;
    const q = parsedUrl.searchParams.get('q') || '';
    return sendHtml(res, adminPage(readClients(), q, user));
  }

  if (req.method === 'GET' && pathname.startsWith('/admin/client/')) {
    if (!requireAuth(req, res)) return;
    const id = pathname.split('/').pop();
    const client = readClients().find((c) => c.id === id);
    if (!client) return sendHtml(res, layout('Not Found', '<section class="card"><h2>Client not found</h2></section>', user), 404);
    return sendHtml(res, adminClientPage(client, user));
  }

  if (req.method === 'GET' && pathname.startsWith('/portal/')) {
    const token = pathname.split('/').pop();
    const client = readClients().find((c) => c.portalToken === token || c.id === token);
    if (!client) return sendHtml(res, layout('Not Found', '<section class="card"><h2>Portal not found</h2></section>', user), 404);
    return sendHtml(res, portalPage(client, user));
  }

  if (req.method === 'POST' && pathname === '/api/followup') {
    return handleFollowupApi(req, res);
  }

  return sendHtml(res, layout('404', '<section class="card"><h2>Page not found</h2></section>', user), 404);
});

server.listen(PORT, () => {
  console.log(`Local Growth Portal running on http://localhost:${PORT}`);
});
