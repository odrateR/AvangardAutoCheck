import { defaultTreeAdapter as tree, parse, parseFragment, serialize } from 'parse5';
import pageCopy from '../content/page-translations.json' with { type: 'json' };
import interfaceCopy from '../content/interface-translations.json' with { type: 'json' };

export const languages = {
  ro: { name: 'Română', label: 'Limba site-ului', ogLocale: 'ro_MD' },
  ru: { name: 'Русский', label: 'Язык сайта', ogLocale: 'ru_MD' },
  en: { name: 'English', label: 'Website language', ogLocale: 'en_US' }
};

export function pagePath(file, language = 'ro') {
  const base = language === 'ro' ? '' : `/${language}`;
  return base + (file === 'index.html' ? '/' : `/${file.replace(/\.html$/, '')}`);
}

const canonicalAttributes = new Set(['alt', 'aria-label', 'placeholder', 'title']);
const translatedMetadata = new Set(['description', 'og:title', 'og:description']);
const normalise = value => value.trim().replace(/\s+/g, ' ');
const attribute = (element, name) => element?.attrs?.find(item => item.name === name)?.value;
const hasClass = (element, value) => attribute(element, 'class')?.split(/\s+/).includes(value);
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function fragment(html) {
  const nodes = [...parseFragment(html).childNodes];
  nodes.forEach(tree.detachNode);
  return nodes;
}

export function localizePage(html, { file, language, origin, routes }) {
  const document = parse(html);
  const translated = value => {
    if (language === 'ro') return value;
    const key = normalise(value);
    const copy = interfaceCopy[key]?.[language] ?? pageCopy[key]?.[language];
    return copy === undefined ? value : value.replace(/\S[\s\S]*\S|\S/, () => copy);
  };

  function localUrl(value) {
    if (value.startsWith('#') || value.startsWith('//') || /^[\w+.-]+:/.test(value)) return value;
    const url = new URL(value, 'https://site.invalid');
    const linkedFile = routes.get(url.pathname);
    if (linkedFile) return pagePath(linkedFile, language) + url.search + url.hash;
    return language === 'ro' ? value : url.pathname + url.search + url.hash;
  }

  function visit(node) {
    if (node.nodeName === '#text') {
      node.value = translated(node.value);
      return;
    }
    if (node.tagName === 'script' && attribute(node, 'type') === 'application/ld+json') {
      const schema = JSON.parse(node.childNodes[0].value);
      schema.headline = translated(schema.headline);
      schema.description = translated(schema.description);
      schema.inLanguage = language;
      node.childNodes[0].value = JSON.stringify(schema).replaceAll('<', '\\u003c');
      return;
    }
    if (node.tagName === 'script' || node.tagName === 'style') {
      for (const attr of node.attrs || []) if (attr.name === 'src') attr.value = localUrl(attr.value);
      return;
    }
    if (node.tagName === 'option' && attribute(node, 'value') === undefined) {
      // Keep the existing form API and service selection values in every language.
      node.attrs.push({ name: 'value', value: node.childNodes[0].value });
    }
    const metadata = attribute(node, 'name') || attribute(node, 'property');
    for (const attr of node.attrs || []) {
      if (node.tagName === 'html' && attr.name === 'lang') attr.value = language;
      if (attr.name === 'href' || attr.name === 'src') attr.value = localUrl(attr.value);
      if (canonicalAttributes.has(attr.name) || (attr.name === 'content' && translatedMetadata.has(metadata))) {
        attr.value = translated(attr.value);
      }
    }
    node.childNodes?.forEach(visit);
  }
  visit(document);

  const htmlNode = document.childNodes.find(node => node.tagName === 'html');
  const head = htmlNode.childNodes.find(node => node.tagName === 'head');
  const body = htmlNode.childNodes.find(node => node.tagName === 'body');
  const links = Object.keys(languages).map(code => {
    const label = languages[code].name;
    const path = pagePath(file === '404.html' ? 'index.html' : file, code);
    return code === language
      ? `<span lang="${code}" aria-current="page">${label}</span>`
      : `<a href="${path}" hreflang="${code}" lang="${code}">${label}</a>`;
  }).join('');
  const { label, name } = languages[language];
  const [switcher] = fragment(`<details class="language-switcher" data-language-switcher><summary aria-label="${label} (${name})">${language.toUpperCase()}</summary><div class="language-options">${links}</div></details>`);
  const header = body.childNodes.find(node => node.tagName === 'header');
  const container = hasClass(header, 'campaign-header') ? header.childNodes.find(node => hasClass(node, 'campaign-wrap')) : header;
  if (container) {
    const next = container.childNodes.find(node => hasClass(node, 'menu-toggle') || hasClass(node, 'campaign-phone'));
    if (next) tree.insertBefore(container, switcher, next);
    else tree.appendChild(container, switcher);
  } else {
    tree.appendChild(body.childNodes.find(node => node.tagName === 'main'), switcher);
  }

  if (file !== '404.html') {
    const url = code => escapeAttribute(origin + pagePath(file, code));
    const alternates = Object.keys(languages).map(code => `<link rel="alternate" hreflang="${code}" href="${url(code)}">`).join('');
    const metadata = `<link rel="canonical" href="${url(language)}">${alternates}<link rel="alternate" hreflang="x-default" href="${url('ro')}"><meta property="og:locale" content="${languages[language].ogLocale}">`;
    fragment(metadata).forEach(node => tree.appendChild(head, node));
  }
  return serialize(document);
}
