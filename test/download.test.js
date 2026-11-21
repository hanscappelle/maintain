const { test } = require('node:test');
const assert = require('node:assert/strict');
const { downloadFilename } = require('../public/download');

test('downloadnaam bevat lokale datum en tijd tot op de seconde', () => {
  const date = new Date(2026, 10, 16, 17, 9, 4, 7);
  assert.equal(downloadFilename(date), 'garageboek-2026-11-16_17-09-04.json');
  assert.equal(downloadFilename(new Date(2026, 10, 16, 17, 9, 4, 999)), downloadFilename(date));
  assert.equal(downloadFilename(new Date(2026, 0, 1, 0, 0, 0)), 'garageboek-2026-01-01_00-00-00.json');
});
