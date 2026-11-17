const { test } = require('node:test');
const assert = require('node:assert/strict');
const { splitLinks } = require('../public/links');

test('herkent meerdere webadressen en behoudt tekst, witruimte en leestekens', () => {
  const input = 'Zie (https://example.org/a(b)) en http://voorbeeld.be/x?q=1, voor info.\nKlaar!';
  const parts = splitLinks(input);
  assert.deepEqual(parts.filter(item => item.url).map(item => item.url), ['https://example.org/a(b)', 'http://voorbeeld.be/x?q=1']);
  assert.equal(parts.map(item => item.text).join(''), input);
});

test('ongeldige adressen en andere protocollen blijven platte tekst', () => {
  for (const input of ['javascript:alert(1)', 'ftp://example.org', 'https://', 'https://[ongeldig]', '<script>alert(1)</script>', 'www.example.org']) {
    assert.deepEqual(splitLinks(input), [{ text: input }]);
  }
  assert.deepEqual(splitLinks(''), []);
});

test('behoudt onder meer IPv6 en linkfragmenten', () => {
  const parts = splitLinks('HTTP://[::1]:8080/a#deel.');
  assert.equal(parts[0].url, 'HTTP://[::1]:8080/a#deel');
  assert.equal(parts[1].text, '.');
});
