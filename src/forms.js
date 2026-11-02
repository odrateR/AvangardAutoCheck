import { trackEvent } from './tracking.js';

export function bindLeadForm(form, onSuccess = () => {}) {
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.sending === 'true' || !form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    const result = form.querySelector('[role="status"]');
    const label = button.innerHTML;
    const fields = Object.fromEntries(new FormData(form));
    const source = fields.type === 'callback' ? 'quick_booking' : 'contact_form';
    form.dataset.sending = 'true';
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = 'Se trimite…';
    result.hidden = false;
    result.removeAttribute('data-state');
    result.textContent = 'Trimitem cererea ta…';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(fields), signal: AbortSignal.timeout(30000)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) throw new Error(data?.message || 'Cererea nu a putut fi trimisă. Încearcă din nou sau sună la 069 448 878.');
      result.dataset.state = 'success';
      result.textContent = data.message;
      // Only accepted requests count as leads. Never pass form values to advertising tools.
      trackEvent('generate_lead', { source, service: fields.service });
      form.reset();
      onSuccess(data);
    } catch (error) {
      result.dataset.state = 'error';
      result.textContent = error.name === 'TimeoutError' || error.name === 'TypeError'
        ? 'Conexiunea nu a putut fi confirmată. Datele au rămas în formular. Încearcă din nou sau sună la 069 448 878.'
        : error.message;
    } finally {
      form.dataset.sending = 'false';
      form.removeAttribute('aria-busy');
      button.disabled = false;
      button.innerHTML = label;
    }
  });
}
