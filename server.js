const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const dataFile = path.join(__dirname, 'data', 'clients.json');

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

function layout(title, content) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <header>
      <div class="container">
        <nav>
          <a class="brand" href="/">Local Growth Portal</a>
          <div>
            <a href="/intake">Intake</a>
            <a href="/admin">Admin</a>
          </div>
        </nav>
      </div>
    </header>
    <main>
      <div class="container">${content}</div>
    </main>
    <footer class="container">Local Growth Portal MVP · fully local Node.js app</footer>
  </body>
  </html>`;
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

function parseBody(req) {
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

function homePage() {
  const content = `
    <section class="hero">
      <div class="card">
        <h1>Turn missed leads into booked jobs.</h1>
        <p class="muted">A lightweight weekly growth portal for local service businesses. Track fixes, follow-up scripts, reviews, and client progress in one place.</p>
        <p>
          <a class="btn" href="/intake">Start Intake</a>
          <a class="btn secondary" href="/admin">View Admin</a>
        </p>
      </div>
      <div class="card">
        <h3>How it works</h3>
        <ol class="muted">
          <li>Submit business details through intake.</li>
          <li>Review each client in the admin dashboard.</li>
          <li>Share each client's private portal page.</li>
        </ol>
      </div>
    </section>

    <section>
      <h2>Simple pricing</h2>
      <div class="grid-3">
        <article class="card">
          <h3>Starter</h3>
          <p class="price">$79/mo</p>
          <p class="muted">Weekly essentials for growing lead response and reviews.</p>
          <a class="btn" href="/intake">Choose Starter</a>
        </article>
        <article class="card">
          <h3>Pro</h3>
          <p class="price">$149/mo</p>
          <p class="muted">Everything in Starter plus deeper follow-up support.</p>
          <a class="btn" href="/intake">Choose Pro</a>
        </article>
        <article class="card">
          <h3>Setup + Monthly</h3>
          <p class="price">$199 + $79/mo</p>
          <p class="muted">Done-with-you setup and ongoing weekly optimization.</p>
          <a class="btn" href="/intake">Book Setup</a>
        </article>
      </div>
    </section>
  `;

  return layout('Local Growth Portal', content);
}

function intakePage() {
  const content = `
    <div class="card">
      <h2>Client intake</h2>
      <p class="muted">Submit a business to create a record in the local dashboard.</p>
      <form method="POST" action="/intake">
        <div><label>Business Name</label><input required name="businessName" /></div>
        <div><label>Owner</label><input required name="owner" /></div>
        <div><label>Email</label><input required type="email" name="email" /></div>
        <div><label>Phone</label><input name="phone" /></div>
        <div><label>Website</label><input name="website" /></div>
        <div><label>Category</label><input name="category" /></div>
        <div class="full"><label>Main Goal</label><input name="goal" /></div>
        <div class="full"><label>Notes</label><textarea name="notes"></textarea></div>
        <div class="full"><button class="btn" type="submit">Save Client</button></div>
      </form>
    </div>
  `;

  return layout('Intake | Local Growth Portal', content);
}

function adminPage(clients) {
  const rows = clients
    .map(
      (client) => `<tr>
      <td>${escapeHtml(client.businessName)}</td>
      <td>${escapeHtml(client.email)}</td>
      <td>${new Date(client.createdAt).toLocaleDateString()}</td>
      <td><span class="status">Active</span></td>
      <td><a href="/admin/client/${client.id}">Open</a></td>
    </tr>`
    )
    .join('');

  const content = `
    <div class="card">
      <h2>Admin dashboard</h2>
      <p class="muted">Total clients: <strong>${clients.length}</strong></p>
      <table>
        <thead>
          <tr><th>Business</th><th>Email</th><th>Created</th><th>Status</th><th>Details</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return layout('Admin | Local Growth Portal', content);
}

function adminClientPage(client) {
  const content = `
    <div class="card">
      <h2>${escapeHtml(client.businessName)}</h2>
      <p class="muted">Owner: ${escapeHtml(client.owner)} · Category: ${escapeHtml(client.category)}</p>
      <p><strong>Email:</strong> ${escapeHtml(client.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(client.phone || 'N/A')}</p>
      <p><strong>Website:</strong> ${escapeHtml(client.website || 'N/A')}</p>
      <p><strong>Goal:</strong> ${escapeHtml(client.goal || 'N/A')}</p>
      <p><strong>Notes:</strong> ${escapeHtml(client.notes || 'N/A')}</p>
      <p>
        <a class="btn" href="/portal/${client.id}">Open Client Portal</a>
        <a class="btn secondary" href="/admin">Back to Admin</a>
      </p>
    </div>
  `;

  return layout(`${client.businessName} | Admin`, content);
}

function clientPortalPage(client) {
  const fixes = [
    'Reply to all missed calls within 5 minutes.',
    'Add a clear call-to-action above the fold on website.',
    'Request a review after every completed job.',
    'Post one Google Business Profile update each week.',
    'Follow up unbooked estimates within 24 hours.'
  ];

  const reviews = [
    'Thanks for choosing us today. If we did a great job, would you share a quick Google review?',
    'We appreciate your business. Your feedback helps local customers trust us.'
  ];

  const content = `
    <div class="card">
      <h2>${escapeHtml(client.businessName)} Portal</h2>
      <p class="muted">Private growth overview for ${escapeHtml(client.owner)}</p>
    </div>
    <div class="portal-grid" style="margin-top:16px;">
      <section class="card">
        <h3>Top 5 fixes</h3>
        <ul>${fixes.map((item) => `<li>${item}</li>`).join('')}</ul>
      </section>
      <section class="card">
        <h3>Review templates</h3>
        <ul>${reviews.map((item) => `<li>${item}</li>`).join('')}</ul>
      </section>
      <section class="card">
        <h3>Client notes</h3>
        <p class="muted">${escapeHtml(client.notes || 'No notes yet.')}</p>
      </section>
      <section class="card">
        <h3>Next step</h3>
        <p class="muted">Schedule next follow-up call and update this week's progress score.</p>
      </section>
    </div>
  `;

  return layout(`${client.businessName} Portal`, content);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/styles.css') {
    const css = fs.readFileSync(path.join(__dirname, 'public', 'styles.css'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
    res.end(css);
    return;
  }

  if (req.method === 'GET' && pathname === '/') {
    sendHtml(res, homePage());
    return;
  }

  if (req.method === 'GET' && pathname === '/intake') {
    sendHtml(res, intakePage());
    return;
  }

  if (req.method === 'POST' && pathname === '/intake') {
    const form = await parseBody(req);
    const clients = readClients();
    const newClient = {
      id: `c${Date.now()}`,
      businessName: form.businessName || '',
      owner: form.owner || '',
      email: form.email || '',
      phone: form.phone || '',
      website: form.website || '',
      category: form.category || '',
      goal: form.goal || '',
      notes: form.notes || '',
      createdAt: new Date().toISOString()
    };

    clients.push(newClient);
    writeClients(clients);

    res.writeHead(302, { Location: '/admin' });
    res.end();
    return;
  }

  if (req.method === 'GET' && pathname === '/admin') {
    sendHtml(res, adminPage(readClients()));
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/admin/client/')) {
    const id = pathname.split('/').pop();
    const client = readClients().find((c) => c.id === id);

    if (!client) {
      sendHtml(res, layout('Not found', '<div class="card"><h2>Client not found</h2></div>'), 404);
      return;
    }

    sendHtml(res, adminClientPage(client));
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/portal/')) {
    const id = pathname.split('/').pop();
    const client = readClients().find((c) => c.id === id);

    if (!client) {
      sendHtml(res, layout('Not found', '<div class="card"><h2>Portal not found</h2></div>'), 404);
      return;
    }

    sendHtml(res, clientPortalPage(client));
    return;
  }

  sendHtml(res, layout('404', '<div class="card"><h2>Page not found</h2></div>'), 404);
});

server.listen(PORT, () => {
  console.log(`Local Growth Portal running at http://localhost:${PORT}`);
});
