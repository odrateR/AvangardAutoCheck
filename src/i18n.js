import messages from '../content/interface-translations.json';

const language = document.documentElement.lang;
const translated = language === 'en' || language === 'ru';

export const text = value => translated ? messages[value]?.[language] ?? value : value;
export const localizedPath = path => translated ? `/${language}${path}` : path;

export function articleCount(count) {
  if (language === 'en') return `${count} ${count === 1 ? 'article shown' : 'articles shown'}`;
  if (language === 'ru') {
    const forms = { one: 'Показана {count} статья', few: 'Показано {count} статьи', many: 'Показано {count} статей' };
    return forms[new Intl.PluralRules('ru').select(count)].replace('{count}', count);
  }
  return `${count} articole afișate`;
}

document.addEventListener('click', event => {
  for (const switcher of document.querySelectorAll('[data-language-switcher][open]')) {
    if (!switcher.contains(event.target)) switcher.open = false;
  }
  const link = event.target.closest?.('[data-language-switcher] a');
  if (!link) return;
  const destination = new URL(link.href);
  destination.search = location.search;
  destination.hash = location.hash;
  link.href = destination.href;
});

document.addEventListener('focusout', event => {
  const switcher = event.target.closest?.('[data-language-switcher][open]');
  if (switcher && event.relatedTarget && !switcher.contains(event.relatedTarget)) switcher.open = false;
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const switcher = event.target.closest?.('[data-language-switcher][open]');
  if (!switcher) return;
  event.preventDefault();
  event.stopPropagation();
  switcher.open = false;
  switcher.querySelector('summary').focus();
}, { capture: true });
