const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const translations = {
  nl: require('../public/translations/nl'),
  en: require('../public/translations/en'),
  fr: require('../public/translations/fr')
};
const i18n = require('../public/i18n');

test('translation lookup works in all locales and interpolates values', () => {
  assert.equal(i18n.locale, 'en');
  assert.equal(i18n.t('session', { summary: '1 vehicle, 2 records' }), 'Current session: 1 vehicle, 2 records');
  const dutch = i18n.create('nl', translations);
  const english = i18n.create('en', translations);
  const french = i18n.create('fr', translations);
  assert.equal(dutch.t('dashboard'), 'Dashboard');
  assert.equal(dutch.t('session', { summary: '1 voertuig, 2 records' }), 'Huidige sessie: 1 voertuig, 2 records');
  assert.equal(english.t('dashboard'), 'Dashboard');
  assert.equal(english.t('session', { summary: '1 vehicle, 2 records' }), 'Current session: 1 vehicle, 2 records');
  assert.equal(french.t('dashboard'), 'Tableau de bord');
  assert.ok(french.t('session', { summary: '1 véhicule, 2 enregistrements' }).includes('1 véhicule, 2 enregistrements'));
});

test('missing translations and interpolation values fail explicitly', () => {
  assert.throws(() => i18n.t('Unknown message'), /Missing translation/);
  assert.throws(() => i18n.t('session'), /Missing translation value/);
});

test('all web UI translation references exist in the Dutch locale', () => {
  const root = path.join(__dirname, '..', 'public');
  const sources = ['index.html', 'app.js', 'theme.js', 'validation.js', 'storage.js'];
  const references = [];

  for (const file of sources) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const pattern = file.endsWith('.html')
      ? /data-i18n(?:-[a-z-]+)?="([^"]+)"/g
      : /(?:appText|validationText|storageText|garageI18n\.t)\('([^']+)'/g;
    for (const [, key] of source.matchAll(pattern)) references.push(key);
  }

  for (const [locale, messages] of Object.entries(translations)) {
    assert.deepEqual([...new Set(references.filter(key => !Object.hasOwn(messages, key)))], [], `${locale} is missing UI messages`);
  }
});

test('all locales contain the same keys and preserve placeholders', () => {
  assert.ok(Object.keys(translations.en).every(key => /^[a-z][A-Za-z0-9]*$/.test(key)));
  for (const [locale, messages] of Object.entries(translations)) {
    assert.deepEqual(Object.keys(messages).filter(key => !Object.hasOwn(translations.en, key)), [], `${locale} has extra keys`);
    assert.deepEqual(Object.keys(translations.en).filter(key => !Object.hasOwn(messages, key)), [], `${locale} has missing keys`);
  }
  const placeholders = message => [...message.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
  for (const [key, value] of Object.entries(translations.en)) {
    for (const [locale, messages] of Object.entries(translations)) {
      assert.deepEqual(placeholders(messages[key]), placeholders(value), `${locale} placeholder mismatch for "${key}"`);
    }
  }
});
