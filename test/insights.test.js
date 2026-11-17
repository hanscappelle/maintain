const { test } = require('node:test');
const assert = require('node:assert/strict');
const { vehicleStats, annualCost, mileageSparkline, mileageAxis, reminderStatus, overviewReminders } = require('../public/insights');

test('kilometerstatistiek gebruikt chronologie en negeert toekomstige registraties', () => {
  const entries = [
    { id: 3, performed_on: '2027-01-01', odometer: 90000 },
    { id: 2, performed_on: '2026-01-11', odometer: 1200 },
    { id: 1, performed_on: '2026-01-01', odometer: 1000 }
  ];
  const stats = vehicleStats(entries, '2026-01-20');
  assert.equal(stats.distance, 200);
  assert.equal(stats.days, 10);
  assert.equal(stats.perYear, 7305);
  assert.equal(stats.latest.id, 2);
  assert.equal(vehicleStats(entries, '2025-01-01').latest, null);
  assert.equal(vehicleStats(entries.slice(1, 2), '2026-01-20').distance, null);
});

test('gemiddelde kost gebruikt kalenderjaren met registraties tot en met vandaag', () => {
  const entries = [
    { id: 1, performed_on: '2022-01-01', cost: '100.25' },
    { id: 2, performed_on: '2022-12-01', cost: 49.75 },
    { id: 3, performed_on: '2025-03-01', cost: null },
    { id: 4, performed_on: '2026-01-01', cost: '0' },
    { id: 5, performed_on: '2026-12-01', cost: '1000' }
  ];
  assert.deepEqual(annualCost(entries, '2026-11-16'), { perYear: 50, missingCount: 1 });
  assert.deepEqual(annualCost(entries.slice(2, 3), '2026-11-16'), { perYear: null, missingCount: 1 });
  assert.deepEqual(annualCost(entries.slice(3, 4), '2026-11-16'), { perYear: 0, missingCount: 0 });
  assert.deepEqual(annualCost(entries, '2021-12-31'), { perYear: null, missingCount: 0 });
  assert.deepEqual(annualCost([], '2026-11-16'), { perYear: null, missingCount: 0 });
});

test('achtergrondgrafiek volgt datums en kilometerstanden en sluit toekomstige punten uit', () => {
  const entries = [
    { id: 4, performed_on: '2026-01-21', odometer: 9000 },
    { id: 3, performed_on: '2026-01-11', odometer: 200 },
    { id: 2, performed_on: '2026-01-03', odometer: 50 },
    { id: 1, performed_on: '2026-01-01', odometer: 100 }
  ];
  assert.deepEqual(mileageSparkline(entries, '2026-01-11'), [
    { x: 2, y: 37 - 50 / 150 * 34 },
    { x: 21.200000000000003, y: 37 },
    { x: 98, y: 3 }
  ]);
  assert.deepEqual(mileageSparkline(entries, '2025-01-01'), []);
  assert.deepEqual(mileageSparkline(entries, '2026-01-01'), []);
  assert.deepEqual(mileageSparkline([{ id: 1, performed_on: '2026-01-01', odometer: 4 }, { id: 2, performed_on: '2026-01-01', odometer: 5 }], '2026-01-01'), []);
  assert.deepEqual(mileageSparkline([{ id: 1, performed_on: '2026-01-01', odometer: 4 }, { id: 2, performed_on: '2026-01-02', odometer: 4 }], '2026-01-02'), [{ x: 2, y: 20 }, { x: 98, y: 20 }]);
});

test('kilometeras gebruikt ronde stappen en omvat de exacte standen', () => {
  assert.deepEqual(mileageAxis(0, 0), { lower: 0, upper: 100, ticks: [0, 100] });
  assert.deepEqual(mileageAxis(10123, 10124), { lower: 10100, upper: 10200, ticks: [10100, 10200] });
  assert.deepEqual(mileageAxis(10000, 13000), { lower: 9000, upper: 14000, ticks: [9000, 10000, 11000, 12000, 13000, 14000] });
  for (const [min, max] of [[0, 49], [99, 101], [10000, 10000], [0, 4294967295], [4294967295, 4294967295]]) {
    const { lower, upper, ticks } = mileageAxis(min, max);
    assert.ok(lower <= min && upper >= max && upper > lower);
    assert.ok(ticks.length >= 2 && ticks.length <= 6);
    assert.ok(ticks.every(tick => tick % 100 === 0));
    assert.ok(ticks.every((tick, index) => !index || tick > ticks[index - 1]));
  }
});

test('dashboard toont alle geplande werkzaamheden en telt alleen naderend of bereikt', () => {
  const vehicles = [{ id: 1, name: 'Auto' }, { id: 2, name: 'Motor' }];
  const entries = [{ id: 1, vehicle_id: 1, performed_on: '2026-01-01', odometer: 10000 }];
  const reminders = [
    { id: 1, vehicle_id: 1, title: 'Later', due_date: '2027-01-01', due_odometer: null },
    { id: 2, vehicle_id: 1, title: 'Bijna', due_date: null, due_odometer: 11000 },
    { id: 3, vehicle_id: 2, title: 'Onbekend', due_date: null, due_odometer: 10000 },
    { id: 4, vehicle_id: 2, title: 'Vandaag', due_date: '2026-01-01', due_odometer: null }
  ];
  const overview = overviewReminders(vehicles, entries, reminders, '2026-01-01');
  assert.deepEqual(overview.items.map(item => item.status), ['due', 'upcoming', 'unknown', 'planned']);
  assert.deepEqual(overview.items.map(item => item.reminder.title), ['Vandaag', 'Bijna', 'Onbekend', 'Later']);
  assert.equal(overview.attentionCount, 2);
  assert.deepEqual(overviewReminders([], [], [], '2026-01-01'), { items: [], attentionCount: 0 });
});

test('zelfde datum of dalende teller leveren geen misleidend gemiddelde', () => {
  const entries = [{ id: 1, performed_on: '2026-01-01', odometer: 500 }, { id: 2, performed_on: '2026-01-02', odometer: 400 }, { id: 3, performed_on: '2026-01-03', odometer: 700 }];
  assert.equal(vehicleStats(entries, '2026-02-01').decrease, true);
  assert.equal(vehicleStats(entries, '2026-02-01').distance, null);
  assert.equal(vehicleStats([{ ...entries[0] }, { ...entries[2], performed_on: '2026-01-01' }], '2026-02-01').perYear, null);
});

test('meldingen hanteren exacte grenzen en eerste bereikte voorwaarde', () => {
  const today = '2026-01-01', latest = { odometer: 10000 };
  assert.equal(reminderStatus({ due_date: '2026-01-31', due_odometer: null }, latest, today).status, 'upcoming');
  assert.equal(reminderStatus({ due_date: '2026-02-01', due_odometer: null }, latest, today).status, 'planned');
  assert.equal(reminderStatus({ due_date: null, due_odometer: 11000 }, latest, today).status, 'upcoming');
  assert.equal(reminderStatus({ due_date: null, due_odometer: 11001 }, latest, today).status, 'planned');
  assert.equal(reminderStatus({ due_date: '2026-01-01', due_odometer: 20000 }, latest, today).status, 'due');
  assert.equal(reminderStatus({ due_date: '2027-01-01', due_odometer: 10000 }, latest, today).status, 'due');
  assert.equal(reminderStatus({ due_date: null, due_odometer: 100 }, null, today).status, 'unknown');
  assert.equal(reminderStatus({ due_date: '2027-01-01', due_odometer: 100 }, null, today).status, 'unknown');
  assert.equal(reminderStatus({ due_date: '2026-01-01', due_odometer: 100 }, null, today).status, 'due');
});
