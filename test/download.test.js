const { test } = require('node:test');
const assert = require('node:assert/strict');
const { downloadFilename } = require('../public/download');

test('downloadnaam bevat lokale datum en tijd met een korte identificatie', () => {
  const date = new Date(2026, 10, 16, 17, 9, 4, 7);
  assert.equal(downloadFilename(date, '12345678-9abc-4def-8123-456789abcdef'), 'garageboek-2026-11-16_17-09-04-007-123456789abc.json');
  assert.notEqual(downloadFilename(date), downloadFilename(date));
});
