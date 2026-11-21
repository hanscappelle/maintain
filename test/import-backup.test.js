const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const storage = require('../public/storage');
const { downloadFilename } = require('../public/download');

function setup() {
  const values = new Map(), elements = new Map(), downloads = [];
  let downloadError = null, accepted = true;
  const confirmations = [];
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  function makeElement() {
    return {
      listeners: {},
      classList: { contains: () => false, toggle() {} },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      append() {}, remove() {}, replaceChildren() {}, setAttribute() {}, removeAttribute() {},
      click() {
        if (downloadError) throw downloadError;
        downloads.push({ blob: this.blob, filename: this.download });
      }
    };
  }
  const document = {
    body: { append() {} },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll: () => [],
    createElement: makeElement,
    addEventListener() {}
  };
  let blob;
  const store = storage.createStore(localStorage);
  runInNewContext(readFileSync(require.resolve('../public/app.js'), 'utf8'), {
    document,
    window: { localStorage, addEventListener() {} },
    garageStorage: { ...storage, createStore: () => ({ ...store, listVehicles: () => [] }) },
    downloadFilename: () => downloadFilename(new Date(2026, 10, 21)),
    Blob,
    URL: { createObjectURL(value) { blob = value; return 'blob:backup'; }, revokeObjectURL() {} },
    setTimeout() {},
    confirm: message => { confirmations.push(message); return accepted; }
  });
  const originalCreateElement = document.createElement;
  document.createElement = () => {
    const element = originalCreateElement();
    Object.defineProperty(element, 'href', { set() { element.blob = blob; } });
    return element;
  };
  return {
    store, downloads, elements, confirmations,
    setAccepted(value) { accepted = value; },
    failDownload() { downloadError = new Error('Download geblokkeerd'); },
    async upload(contents, size = Buffer.byteLength(contents)) {
      const input = { files: [{ size, text: async () => contents }], value: 'bestand.json' };
      await elements.get('#import-file').listeners.change({ currentTarget: input });
      assert.equal(input.value, '');
    }
  };
}

const vehicle = { name: 'Motor', type: 'Motorfiets', make: 'Honda', model: 'CB', license_plate: '' };

function populatedStore(store) {
  const { id } = store.saveVehicle(null, vehicle);
  store.saveMaintenance(id, null, { performed_on: '2024-02-29', odometer: '10000', title: 'Olie', description: 'Filter', cost: '12,50' });
  store.saveNote(id, null, { title: 'Banden', content: 'Spanning' });
  store.saveReminder(id, null, { title: 'Onderhoud', due_date: '2027-01-01', due_odometer: null });
  store.setVehicleArchived(id, true);
}

test('import downloadt de volledige oorspronkelijke gegevens voordat ze worden vervangen', async () => {
  const app = setup();
  populatedStore(app.store);
  const before = app.store.exportJson();
  const replacement = storage.createStore({ getItem: () => null }).exportJson();
  await app.upload(replacement);
  assert.equal(app.downloads.length, 1);
  assert.equal(await app.downloads[0].blob.text(), before);
  assert.equal(app.downloads[0].filename, 'garageboek-2026-11-21_00-00-00.json');
  assert.match(app.confirmations[0], /Huidige sessie: 1 voertuigen, 3 records/);
  assert.match(app.confirmations[0], /Te openen bestand: 0 voertuigen, 0 records/);
  assert.equal(app.store.exportJson(), replacement);
});

test('bevestiging vergelijkt alle records inclusief gearchiveerde voertuigen', async () => {
  const app = setup();
  const uploaded = setup();
  populatedStore(app.store);
  populatedStore(uploaded.store);
  const other = app.store.saveVehicle(null, { ...vehicle, name: 'Auto', type: 'Auto' });
  app.store.saveNote(other.id, null, { title: 'Sleutel', content: 'Reserve' });
  const before = app.store.exportJson();
  app.setAccepted(false);
  await app.upload(uploaded.store.exportJson());
  assert.match(app.confirmations[0], /Huidige sessie: 2 voertuigen, 4 records/);
  assert.match(app.confirmations[0], /Te openen bestand: 1 voertuigen, 3 records/);
  assert.match(app.confirmations[0], /onderhoudsregistraties, notities en geplande werkzaamheden/);
  assert.equal(app.store.exportJson(), before);
  assert.equal(app.downloads.length, 0);
});

test('bevestiging telt ontbrekende categorieën in oudere bestanden als nul', async () => {
  const app = setup();
  const legacy = { version: 1, vehicles: [{ id: 1, ...vehicle }], maintenance: [] };
  app.setAccepted(false);
  await app.upload(JSON.stringify(legacy));
  assert.match(app.confirmations[0], /Huidige sessie: 0 voertuigen, 0 records/);
  assert.match(app.confirmations[0], /Te openen bestand: 1 voertuigen, 0 records/);
});

test('annuleren en ongeldige of te grote bestanden starten geen backup en vervangen niets', async () => {
  const app = setup();
  populatedStore(app.store);
  const before = app.store.exportJson();
  app.setAccepted(false);
  await app.upload(before);
  app.setAccepted(true);
  await app.upload('{');
  await app.upload(JSON.stringify({ version: 5 }));
  await app.upload(before, 10 * 1024 * 1024 + 1);
  assert.equal(app.confirmations.length, 1);
  assert.equal(app.downloads.length, 0);
  assert.equal(app.store.exportJson(), before);
  assert.match(app.elements.get('#notice').textContent, /groter dan 10 MB/);
});

test('de knop Backup maken downloadt nog steeds de huidige gegevens', async () => {
  const app = setup();
  populatedStore(app.store);
  app.elements.get('#export-data').listeners.click();
  assert.equal(app.downloads.length, 1);
  assert.equal(app.downloads[0].filename, 'garageboek-2026-11-21_00-00-00.json');
  assert.equal(await app.downloads[0].blob.text(), app.store.exportJson());
});

test('een fout bij het starten van de backup voorkomt de import', async () => {
  const app = setup();
  populatedStore(app.store);
  const before = app.store.exportJson();
  app.failDownload();
  await app.upload(storage.createStore({ getItem: () => null }).exportJson());
  assert.equal(app.store.exportJson(), before);
  assert.match(app.elements.get('#notice').textContent, /Back-up maken mislukt: Download geblokkeerd/);
});
