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
  const link = event.target.closest?.('[data-language-switcher] a');
  if (!link) return;
  const destination = new URL(link.href);
  destination.search = location.search;
  destination.hash = location.hash;
  link.href = destination.href;
});
