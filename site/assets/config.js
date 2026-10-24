// Paste published browser-store URLs here. Empty values show “Coming soon”.
const MYLIMITS_CONFIG = Object.freeze({
  stores: {
    chrome: '',
    edge: '',
    firefox: '',
  },
});

for (const link of document.querySelectorAll('[data-store]')) {
  const url = MYLIMITS_CONFIG.stores[link.dataset.store];
  if (url && URL.canParse(url) && new URL(url).protocol === 'https:') {
    link.href = url;
    link.removeAttribute('aria-disabled');
    link.querySelector('small').textContent = 'Install extension ↗';
  }
}
