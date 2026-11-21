const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStore, KEY, SELECTION_KEY, VIEW_KEY } = require('../public/storage');
const validation = require('../public/validation');

function memory() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}
const vehicle = { name: 'Motor', type: 'Motorfiets', make: 'Honda', model: 'CB', license_plate: '' };
const entry = { performed_on: '2024-02-29', odometer: '10000', title: 'Olie', description: 'Filter', cost: '12,50' };

test('voertuigselectie wordt apart van de gegevens onthouden', () => {
  const storage = memory(), store = createStore(storage);
  assert.equal(store.getSelectedVehicleId(), null);
  store.setSelectedVehicleId(2);
  assert.equal(createStore(storage).getSelectedVehicleId(), 2);
  assert.equal(JSON.parse(store.exportJson()).selectedVehicleId, undefined);
  store.setSelectedVehicleId(null);
  assert.equal(store.getSelectedVehicleId(), null);
  assert.throws(() => store.setSelectedVehicleId(-1), /Ongeldige/);
  storage.setItem(SELECTION_KEY, 'ongeldig');
  assert.throws(() => store.getSelectedVehicleId(), /ongeldig/);
  assert.throws(() => createStore({ getItem: () => { throw new Error('Geblokkeerd'); } }).getSelectedVehicleId(), /Geblokkeerd/);
});

test('laatste weergave wordt apart van voertuigselectie en back-up onthouden', () => {
  const storage = memory(), store = createStore(storage);
  assert.equal(store.getLastView(), 'vehicle');
  store.setSelectedVehicleId(2);
  store.setLastView('overview');
  const reloaded = createStore(storage);
  assert.equal(reloaded.getLastView(), 'overview');
  assert.equal(reloaded.getSelectedVehicleId(), 2);
  assert.equal(JSON.parse(store.exportJson()).lastView, undefined);
  reloaded.setLastView('vehicle');
  assert.equal(createStore(storage).getLastView(), 'vehicle');
  assert.throws(() => store.setLastView('anders'), /Ongeldige/);
  storage.setItem(VIEW_KEY, 'anders');
  assert.throws(() => store.getLastView(), /ongeldig/);
  assert.throws(() => createStore({ getItem: () => { throw new Error('Geblokkeerd'); } }).getLastView(), /Geblokkeerd/);
  assert.throws(() => createStore({ setItem: () => { throw new Error('Geblokkeerd'); } }).setLastView('overview'), /Geblokkeerd/);
});

test('bewaren, bewerken, sorteren en verwijderen over herladen heen', () => {
  const storage = memory(), store = createStore(storage);
  const v = store.saveVehicle(null, vehicle);
  const other = store.saveVehicle(null, { ...vehicle, name: 'Auto', type: 'Auto' });
  const first = store.saveMaintenance(v.id, null, entry);
  const second = store.saveMaintenance(v.id, null, { ...entry, odometer: '12000', title: 'Banden' });
  store.saveMaintenance(other.id, null, entry);
  const reloaded = createStore(storage);
  assert.deepEqual(reloaded.listVehicles().map(x => x.name), ['Auto', 'Motor']);
  assert.deepEqual(reloaded.listMaintenance(v.id).map(x => x.id), [second.id, first.id]);
  assert.equal(reloaded.saveMaintenance(v.id, second.id, { ...entry, title: 'Remmen' }).title, 'Remmen');
  assert.equal(reloaded.saveVehicle(v.id, { ...vehicle, name: 'Motor 2' }).name, 'Motor 2');
  assert.throws(() => reloaded.deleteMaintenance(other.id, first.id), /niet gevonden/);
  reloaded.deleteMaintenance(v.id, first.id);
  reloaded.deleteVehicle(v.id);
  assert.equal(reloaded.read().maintenance.length, 1);
  assert.equal(reloaded.read().maintenance[0].vehicle_id, other.id);
});

test('verbruik en energieprijs worden per voertuig bewaard en gevalideerd', () => {
  const storage = memory(), store = createStore(storage);
  const v = store.saveVehicle(null, {
    ...vehicle,
    energy_type: 'electric',
    consumption_per_100: '18,4',
    energy_price: '0,32'
  });
  const reloaded = createStore(storage).listVehicles()[0];
  assert.equal(reloaded.energy_type, 'electric');
  assert.equal(reloaded.consumption_per_100, '18.4');
  assert.equal(reloaded.energy_price, '0.32');
  assert.equal(JSON.parse(store.exportJson()).version, 6);
  assert.throws(() => store.saveVehicle(v.id, { ...v, consumption_per_100: '', energy_price: '0.32' }), /zowel het gemiddelde verbruik/);
  assert.throws(() => store.saveVehicle(v.id, { ...v, energy_type: 'diesel' }), /brandstof of elektrisch/);
  assert.throws(() => store.saveVehicle(v.id, { ...v, consumption_per_100: '0' }), /gemiddeld verbruik/);
  assert.throws(() => store.saveVehicle(v.id, { ...v, energy_price: '1.1234' }), /energieprijs/);
});

test('samenvoegen vult ontbrekende voertuigverbruiksgegevens aan', () => {
  const current = createStore(memory()), incoming = createStore(memory());
  const existing = current.saveVehicle(null, { ...vehicle, license_plate: '1-ABC-123' });
  incoming.saveVehicle(null, {
    ...vehicle,
    license_plate: '1-ABC-123',
    energy_type: 'electric',
    consumption_per_100: '18',
    energy_price: '0.32'
  });
  current.mergeJson(incoming.exportJson());
  const merged = current.listVehicles()[0];
  assert.equal(merged.id, existing.id);
  assert.equal(merged.energy_type, 'electric');
  assert.equal(merged.consumption_per_100, '18');
  assert.equal(merged.energy_price, '0.32');
});

test('JSON export en import behouden alle gegevens en vervangen de bestaande gegevens', () => {
  const store = createStore(memory());
  const v = store.saveVehicle(null, vehicle);
  store.saveMaintenance(v.id, null, entry);
  const json = store.exportJson();
  const destination = createStore(memory());
  destination.saveVehicle(null, { ...vehicle, name: 'Bestaand' });
  destination.importJson(json);
  assert.deepEqual(destination.read(), store.read());
  assert.equal(destination.read().maintenance[0].cost, '12.50');
  assert.equal(destination.saveMaintenance(v.id, null, entry).id, 2);
});

test('samenvoegen herkent voertuigen en records en behoudt de langste tekst', () => {
  const current = createStore(memory()), incoming = createStore(memory());
  const a = current.saveVehicle(null, { ...vehicle, license_plate: '1-ABC-123' });
  current.saveMaintenance(a.id, null, { ...entry, description: 'Kort', cost: '10' });
  const note = current.saveNote(a.id, null, { title: 'Sleutel', content: 'Kort' });
  current.setNoteImportant(a.id, note.id, true);
  current.saveReminder(a.id, null, { title: 'Service', due_date: '2027-01-01', due_odometer: null });
  current.setVehicleArchived(a.id, true);

  const b = incoming.saveVehicle(null, { ...vehicle, name: 'Lange motornaam', license_plate: '1-ABC-123' });
  incoming.saveMaintenance(b.id, null, { ...entry, description: 'Een langere beschrijving', cost: '100' });
  incoming.saveNote(b.id, null, { title: 'Sleutel', content: 'Een langere notitie' });
  incoming.saveReminder(b.id, null, { title: 'Service', due_date: '2028-01-01', due_odometer: 50000 });
  const other = incoming.saveVehicle(null, { ...vehicle, name: 'Auto', type: 'Auto', license_plate: '2-DEF-456' });
  incoming.saveNote(other.id, null, { title: 'Anders', content: 'Bij de auto' });

  current.mergeJson(incoming.exportJson());
  const data = current.read();
  assert.equal(data.vehicles.length, 2);
  assert.equal(data.vehicles[0].name, 'Lange motornaam');
  assert.equal(data.vehicles[0].archived, true);
  assert.equal(data.maintenance.length, 1);
  assert.equal(data.maintenance[0].description, 'Een langere beschrijving');
  assert.equal(data.maintenance[0].cost, '10');
  assert.equal(data.notes.find(item => item.id === note.id).content, 'Een langere notitie');
  assert.equal(data.notes.find(item => item.id === note.id).important, true);
  assert.equal(data.reminders[0].due_date, '2027-01-01');
  assert.equal(data.reminders[0].due_odometer, null);
  const importedVehicle = data.vehicles.find(item => item.name === 'Auto');
  assert.notEqual(importedVehicle.id, a.id);
  assert.equal(data.notes.find(item => item.title === 'Anders').vehicle_id, importedVehicle.id);
});

test('samenvoegen zonder nummerplaat gebruikt naam merk en model en houdt gelijke tekstlengte aan', () => {
  const current = createStore(memory()), incoming = createStore(memory());
  const a = current.saveVehicle(null, vehicle);
  current.saveNote(a.id, null, { title: 'Info', content: 'abcd' });
  const b = incoming.saveVehicle(null, { ...vehicle, type: 'Auto' });
  incoming.saveNote(b.id, null, { title: 'Info', content: 'wxyz' });
  incoming.saveNote(b.id, null, { title: 'Nieuw', content: 'Toegevoegd' });
  current.mergeJson(incoming.exportJson());
  assert.equal(current.read().vehicles.length, 1);
  assert.equal(current.read().vehicles[0].type, 'Motorfiets');
  assert.equal(current.listNotes(a.id).find(item => item.title === 'Info').content, 'abcd');
  assert.equal(current.listNotes(a.id).length, 2);
});

test('ongeldige en dubbelzinnige samenvoegingen wijzigen de opslag niet', () => {
  const current = createStore(memory()), incoming = createStore(memory());
  const a = current.saveVehicle(null, vehicle);
  current.saveNote(a.id, null, { title: 'Info', content: 'Eerste' });
  current.saveNote(a.id, null, { title: 'Info', content: 'Tweede' });
  const b = incoming.saveVehicle(null, vehicle);
  incoming.saveNote(b.id, null, { title: 'Info', content: 'Derde' });
  const before = current.exportJson();
  assert.throws(() => current.mergeJson(incoming.exportJson()), /meerdere voertuigen of records/);
  assert.equal(current.exportJson(), before);
  assert.throws(() => current.mergeJson('{'));
  assert.equal(current.exportJson(), before);
});

test('samenvoegen ondersteunt oudere bestanden zonder notities of planning', () => {
  const current = createStore(memory());
  const old = { version: 1, vehicles: [{ id: 1, ...vehicle }], maintenance: [{ id: 1, vehicle_id: 1, ...entry }] };
  current.mergeJson(JSON.stringify(old));
  assert.equal(current.read().vehicles.length, 1);
  assert.equal(current.read().maintenance.length, 1);
  assert.deepEqual(current.read().notes, []);
  assert.deepEqual(current.read().reminders, []);
});

test('ongeldige en onvolledige bestanden vervangen bestaande gegevens niet', () => {
  const store = createStore(memory());
  const v = store.saveVehicle(null, vehicle);
  store.saveMaintenance(v.id, null, entry);
  const before = store.exportJson(), data = JSON.parse(before);
  const invalid = [
    '{',
    JSON.stringify({ ...data, version: 7 }),
    JSON.stringify({ ...data, unknown: true }),
    JSON.stringify({ ...data, vehicles: [data.vehicles[0], data.vehicles[0]] }),
    JSON.stringify({ ...data, maintenance: [{ ...data.maintenance[0], vehicle_id: 999 }] }),
    JSON.stringify({ ...data, maintenance: [{ ...data.maintenance[0], performed_on: '2023-02-29' }] }),
    JSON.stringify({ ...data, maintenance: [{ ...data.maintenance[0], description: null }] }),
    JSON.stringify({ ...data, vehicles: [{ ...data.vehicles[0], energy_type: 'steam' }] })
  ];
  for (const json of invalid) {
    assert.throws(() => store.importJson(json));
    assert.equal(store.exportJson(), before);
  }
});

test('notities blijven per voertuig bewaard en worden meegestuurd in JSON', () => {
  const storage = memory(), store = createStore(storage);
  const a = store.saveVehicle(null, vehicle);
  const b = store.saveVehicle(null, { ...vehicle, name: 'Auto' });
  const note = store.saveNote(a.id, null, { title: 'Bandenspanning', content: 'Voor 2,5 bar\nAchter 2,9 bar' });
  const other = store.saveNote(b.id, null, { title: 'Sleutel', content: 'Reserve thuis' });
  assert.equal(createStore(storage).listNotes(a.id)[0].content, 'Voor 2,5 bar\nAchter 2,9 bar');
  assert.equal(store.listNotes(b.id)[0].id, other.id);
  assert.throws(() => store.saveNote(b.id, note.id, { title: 'Anders', content: 'Inhoud' }), /niet gevonden/);
  assert.throws(() => store.deleteNote(b.id, note.id), /niet gevonden/);
  store.saveNote(a.id, note.id, { title: 'Banden', content: 'Aangepast' });
  const imported = createStore(memory());
  imported.importJson(store.exportJson());
  assert.equal(imported.listNotes(a.id)[0].title, 'Banden');
  imported.deleteNote(a.id, note.id);
  assert.equal(imported.listNotes(a.id).length, 0);
  store.deleteVehicle(a.id);
  assert.deepEqual(store.read().notes.map(item => item.id), [other.id]);
});

test('versie 1 tot en met 5 worden zonder gegevensverlies gelezen als versie 6', () => {
  const storage = memory();
  const old = { version: 1, vehicles: [{ id: 1, ...vehicle }], maintenance: [{ id: 1, vehicle_id: 1, ...entry }] };
  storage.setItem(KEY, JSON.stringify(old));
  const store = createStore(storage);
  assert.equal(store.listMaintenance(1).length, 1);
  assert.deepEqual(store.listNotes(1), []);
  const exported = JSON.parse(store.exportJson());
  assert.equal(exported.version, 6);
  assert.equal(exported.vehicles[0].archived, false);
  assert.equal(exported.vehicles[0].energy_type, 'fuel');
  assert.equal(exported.vehicles[0].consumption_per_100, null);
  assert.equal(exported.vehicles[0].name, 'Motor');
  store.saveNote(1, null, { title: 'Test', content: 'Inhoud' });
  assert.equal(JSON.parse(storage.getItem(KEY)).version, 6);
  const imported = createStore(memory());
  imported.importJson(JSON.stringify(old));
  assert.deepEqual(imported.listNotes(1), []);
  assert.equal(imported.listMaintenance(1).length, 1);
  const oldV2 = { version: 2, vehicles: old.vehicles, maintenance: old.maintenance, notes: [{ id: 1, vehicle_id: 1, title: 'Test', content: 'Inhoud' }] };
  imported.importJson(JSON.stringify(oldV2));
  assert.equal(imported.listNotes(1)[0].content, 'Inhoud');
  assert.equal(imported.listNotes(1)[0].important, false);
  assert.deepEqual(imported.listReminders(1), []);
  const oldV3 = { ...oldV2, version: 3, reminders: [{ id: 1, vehicle_id: 1, title: 'Olie', due_date: '2027-01-01', due_odometer: null }] };
  imported.importJson(JSON.stringify(oldV3));
  assert.equal(imported.listNotes(1)[0].important, false);
  assert.equal(imported.listReminders(1)[0].title, 'Olie');
  const oldV4 = { ...oldV3, version: 4, notes: [{ ...oldV2.notes[0], important: true }] };
  imported.importJson(JSON.stringify(oldV4));
  assert.equal(imported.listVehicles()[0].archived, false);
  assert.equal(imported.listNotes(1)[0].important, true);

  const oldV5 = {
    version: 5,
    vehicles: [{ id: 1, ...vehicle, archived: true }],
    maintenance: [],
    notes: [],
    reminders: []
  };
  imported.importJson(JSON.stringify(oldV5));
  assert.equal(imported.listVehicles()[0].archived, true);
  assert.equal(imported.listVehicles()[0].energy_type, 'fuel');
  assert.equal(imported.listVehicles()[0].energy_price, null);
});

test('archiveren en terugzetten bewaren alle gegevens en de archiefstatus in JSON', () => {
  const store = createStore(memory());
  const v = store.saveVehicle(null, vehicle);
  store.saveMaintenance(v.id, null, entry);
  const note = store.saveNote(v.id, null, { title: 'Test', content: 'Inhoud' });
  store.setNoteImportant(v.id, note.id, true);
  store.saveReminder(v.id, null, { title: 'Olie', due_date: '2026-12-01', due_odometer: '' });
  assert.equal(v.archived, false);
  store.setVehicleArchived(v.id, true);
  store.saveVehicle(v.id, { ...vehicle, name: 'Verkocht' });
  const imported = createStore(memory());
  imported.importJson(store.exportJson());
  assert.equal(imported.listVehicles()[0].archived, true);
  assert.equal(imported.listMaintenance(v.id).length, 1);
  assert.equal(imported.listNotes(v.id)[0].important, true);
  assert.equal(imported.listReminders(v.id).length, 1);
  const before = imported.exportJson(), invalid = JSON.parse(before);
  invalid.vehicles[0].archived = 'true';
  assert.throws(() => imported.importJson(JSON.stringify(invalid)), /voertuig/i);
  assert.equal(imported.exportJson(), before);
  assert.throws(() => imported.setVehicleArchived(v.id, 'false'), /archiefstatus/);
  assert.throws(() => imported.setVehicleArchived(999, true), /niet gevonden/);
  imported.setVehicleArchived(v.id, false);
  assert.equal(imported.listVehicles()[0].archived, false);
  assert.equal(imported.listReminders(v.id).length, 1);
});

test('belangrijkmarkering wordt bewaard, geëxporteerd en kan worden verwijderd', () => {
  const storage = memory(), store = createStore(storage);
  const a = store.saveVehicle(null, vehicle);
  const b = store.saveVehicle(null, { ...vehicle, name: 'Auto' });
  const note = store.saveNote(a.id, null, { title: 'Test', content: 'Inhoud' });
  assert.equal(note.important, false);
  assert.throws(() => store.setNoteImportant(b.id, note.id, true), /niet gevonden/);
  assert.throws(() => store.setNoteImportant(a.id, note.id, 'true'), /Ongeldige/);
  store.setNoteImportant(a.id, note.id, true);
  store.saveNote(a.id, note.id, { title: 'Gewijzigd', content: 'Nieuwe inhoud' });
  assert.equal(createStore(storage).listNotes(a.id)[0].important, true);
  const imported = createStore(memory());
  imported.importJson(store.exportJson());
  assert.equal(imported.listNotes(a.id)[0].important, true);
  const before = imported.exportJson(), invalid = JSON.parse(before);
  invalid.notes[0].important = 'true';
  assert.throws(() => imported.importJson(JSON.stringify(invalid)), /notitie/);
  assert.equal(imported.exportJson(), before);
  imported.setNoteImportant(a.id, note.id, false);
  assert.equal(imported.listNotes(a.id)[0].important, false);
});

test('geplande werkzaamheden zijn gekoppeld aan een voertuig en worden bewaard en geëxporteerd', () => {
  const store = createStore(memory());
  const a = store.saveVehicle(null, vehicle);
  const b = store.saveVehicle(null, { ...vehicle, name: 'Auto' });
  const reminder = store.saveReminder(a.id, null, { title: 'Olie', due_date: '2026-12-01', due_odometer: '30000' });
  assert.equal(reminder.due_odometer, 30000);
  assert.throws(() => store.saveReminder(a.id, null, { title: 'Leeg', due_date: '', due_odometer: '' }), /datum en\/of/);
  assert.throws(() => store.saveReminder(a.id, null, { title: 'Fout', due_date: '2026-02-29', due_odometer: '' }), /datum/);
  assert.throws(() => store.deleteReminder(b.id, reminder.id), /niet gevonden/);
  store.saveReminder(a.id, reminder.id, { title: 'Filter', due_date: '', due_odometer: '0' });
  const copy = createStore(memory());
  copy.importJson(store.exportJson());
  assert.equal(copy.listReminders(a.id)[0].due_odometer, 0);
  const before = copy.exportJson(), invalid = JSON.parse(before);
  invalid.reminders[0].vehicle_id = 999;
  assert.throws(() => copy.importJson(JSON.stringify(invalid)), /onbekend/);
  assert.equal(copy.exportJson(), before);
  copy.deleteReminder(a.id, reminder.id);
  assert.equal(copy.listReminders(a.id).length, 0);
  store.deleteVehicle(a.id);
  assert.equal(store.read().reminders.length, 0);
});

test('ongeldige notities of ontbrekende verwijzingen worden geweigerd zonder gegevensverlies', () => {
  const store = createStore(memory());
  const v = store.saveVehicle(null, vehicle);
  const note = store.saveNote(v.id, null, { title: 'Test', content: 'Inhoud' });
  assert.throws(() => store.saveNote(v.id, null, { title: ' ', content: 'tekst' }), /Titel/);
  assert.throws(() => store.saveNote(v.id, null, { title: 'Titel', content: ' ' }), /Notitie/);
  const before = store.exportJson(), data = JSON.parse(before);
  for (const notes of [
    [note, note],
    [{ ...note, vehicle_id: 999 }],
    [{ ...note, content: null }],
    [{ ...note, content: 'x'.repeat(10001) }]
  ]) {
    assert.throws(() => store.importJson(JSON.stringify({ ...data, notes })));
    assert.equal(store.exportJson(), before);
  }
});

test('opslagfouten en beschadigde browserdata worden gemeld zonder lege data te bewaren', () => {
  const storage = memory();
  storage.setItem(KEY, '{');
  const store = createStore(storage);
  assert.throws(() => store.read(), /JSON/);
  assert.throws(() => store.saveVehicle(null, vehicle), /JSON/);
  assert.equal(storage.getItem(KEY), '{');
  assert.throws(() => createStore({ getItem: () => null, setItem: () => { throw new Error('Opslag vol'); } }).saveVehicle(null, vehicle), /Opslag vol/);
  store.importJson('{"version":1,"vehicles":[],"maintenance":[]}');
  assert.equal(store.listVehicles().length, 0);
});

test('validatie controleert datums, kilometerstanden en bedragen', () => {
  const valid = { performed_on: '2024-02-29', odometer: '0', title: 'Controle' };
  assert.equal(validation.maintenance(valid).odometer, 0);
  assert.equal(validation.maintenance(valid).cost, null);
  for (const performed_on of ['2023-02-29', '2024-13-01', '0999-12-31', '']) {
    assert.throws(() => validation.maintenance({ ...valid, performed_on }), /datum/);
  }
  for (const odometer of ['', '-1', '1.2', '4294967296', null]) {
    assert.throws(() => validation.maintenance({ ...valid, odometer }), /Kilometerstand/);
  }
  for (const cost of ['-1', '1.234', '100000000', 'abc']) {
    assert.throws(() => validation.maintenance({ ...valid, cost }), /bedrag/);
  }
  assert.throws(() => validation.maintenance({ ...valid, description: '🚗'.repeat(20000) }), /Notities/);
});
