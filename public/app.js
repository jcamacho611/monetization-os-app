(async function () {
  const button = document.querySelector('[data-followup-button]');
  const output = document.getElementById('followup-output');
  if (!button || !output) return;

  button.addEventListener('click', async () => {
    const clientId = button.getAttribute('data-client-id');
    button.disabled = true;
    output.textContent = 'Generating follow-up...';

    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to generate follow-up.');
      }

      output.textContent = `${data.followup}\n\nSource: ${data.source}${data.warning ? ` (${data.warning})` : ''}`;
    } catch (error) {
      output.textContent = `Error: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
})();
