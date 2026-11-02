import { bindLeadForm } from './forms.js';
import { trackEvent } from './tracking.js';

const dialog = document.querySelector('#booking-dialog');
const form = document.querySelector('#booking-form');
const success = document.querySelector('#booking-success');
let opener;
let lockedScroll = 0;
let viewportBaseline = 0;

function updateViewport() {
  if (!dialog?.open) return;
  const viewport = window.visualViewport;
  dialog.style.setProperty('--booking-height', `${viewport?.height || innerHeight}px`);
  dialog.style.setProperty('--booking-top', `${viewport?.offsetTop || 0}px`);
  const editing = form.contains(document.activeElement) && document.activeElement.matches('input:not([type="hidden"])');
  dialog.classList.toggle('keyboard-open', Boolean(editing && viewport && viewportBaseline - viewport.height > 120));
}

function openBooking(trigger) {
  if (!dialog || dialog.open) return;
  opener = trigger;
  const selectedService = trigger.dataset.service || 'Premium Check';
  form.elements.service.value = selectedService;
  document.querySelector('#booking-service').textContent = selectedService === 'Premium Check' ? 'Premium Check · 69 € / mașină' : selectedService;
  document.querySelector('#booking-title').textContent = 'Hai să verificăm mașina.';
  document.querySelector('#booking-description').hidden = false;
  form.hidden = false;
  success.hidden = true;
  // Keep incomplete input when a visitor closes the dialog and returns.
  if (form.querySelector('[role="status"]').dataset.state === 'success') form.querySelector('[role="status"]').hidden = true;
  document.querySelector('.menu-toggle[aria-expanded="true"]')?.click();
  lockedScroll = window.scrollY;
  viewportBaseline = window.visualViewport?.height || innerHeight;
  document.body.style.top = `-${lockedScroll}px`;
  document.body.classList.add('booking-open');
  dialog.showModal();
  updateViewport();
  // Avoid opening the phone keyboard until the visitor selects a field.
  dialog.querySelector('[data-booking-close]').focus({ preventScroll: true });
  trackEvent('booking_open', { source: trigger.dataset.bookingSource || 'cta', service: selectedService });
}

document.querySelectorAll('a[href$="#contact"], [data-booking-open]').forEach(trigger => trigger.addEventListener('click', event => {
  if (!dialog || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (trigger.classList.contains('nav-contact')) return;
  event.preventDefault();
  openBooking(trigger);
}));
dialog?.querySelectorAll('[data-booking-close]').forEach(button => button.addEventListener('click', () => dialog.close()));
// Native dialog handles focus trapping and Escape. Only close an actual backdrop click.
dialog?.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog?.addEventListener('close', () => {
  document.body.classList.remove('booking-open');
  document.body.style.top = '';
  window.scrollTo({ top: lockedScroll, behavior: 'instant' });
  opener?.focus({ preventScroll: true });
});
window.visualViewport?.addEventListener('resize', updateViewport);
window.visualViewport?.addEventListener('scroll', updateViewport);
window.addEventListener('resize', updateViewport);
form?.addEventListener('focusin', updateViewport);
form?.addEventListener('focusout', () => requestAnimationFrame(updateViewport));
bindLeadForm(form, () => {
  document.activeElement?.blur();
  form.hidden = true;
  document.querySelector('#booking-description').hidden = true;
  document.querySelector('#booking-title').textContent = 'Mulțumim. Vorbim curând!';
  success.hidden = false;
  success.focus({ preventScroll: true });
  updateViewport();
});

const mobile = matchMedia('(max-width: 640px)');
function updateDisclosures() {
  document.querySelectorAll('.mobile-disclosure').forEach(details => { details.open = !mobile.matches; });
}
updateDisclosures();
mobile.addEventListener('change', updateDisclosures);

const bookingBar = document.querySelector('.mobile-booking');
if (bookingBar && 'IntersectionObserver' in window) {
  let heroVisible = true;
  let contactVisible = false;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.target.matches('.hero, [data-booking-hero]')) heroVisible = entry.isIntersecting;
      else contactVisible = entry.isIntersecting;
    });
    bookingBar.hidden = heroVisible || contactVisible;
  });
  document.querySelectorAll('.hero, [data-booking-hero], #contact').forEach(section => observer.observe(section));
}
