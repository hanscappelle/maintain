const state = { vehicles: [], selectedId: null, entries: [], notes: [], reminders: [], editingVehicle: null, editingEntry: null, editingNote: null, editingReminder: null, showingOverview: false, loadToken: 0 };
let vehicleConsumptionSaveTimer = null;
const store = garageStorage.createStore({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value)
});
const DATA_WARNING_DISMISSED_KEY = 'garageboek-data-warning-dismissed';
const $ = selector => document.querySelector(selector);
const formatNumber = value => new Intl.NumberFormat('nl-BE').format(value);
const formatCurrency = value => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(value);
const formatDate = value => new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function showError(message) {
  const notice = $('#notice');
  notice.textContent = message;
  notice.hidden = false;
}
function clearError() { $('#notice').hidden = true; }
function setDataWarningDismissed(dismissed) {
  const warning = $('#data-warning');
  if (!dismissed && !warning.hidden) return;
  warning.hidden = dismissed;
  try {
    if (dismissed) window.localStorage.setItem(DATA_WARNING_DISMISSED_KEY, 'true');
    else window.localStorage.removeItem(DATA_WARNING_DISMISSED_KEY);
  } catch (error) {
    showError(`Melding kon niet worden opgeslagen: ${error.message}`);
  }
}
try {
  $('#data-warning').hidden = window.localStorage.getItem(DATA_WARNING_DISMISSED_KEY) === 'true';
} catch (error) {
  showError(`Meldingvoorkeur kon niet worden gelezen: ${error.message}`);
}
function rememberSelection() {
  try { store.setSelectedVehicleId(state.selectedId); } catch (error) {
    showError(`Voertuigselectie kon niet worden onthouden: ${error.message}`);
  }
}
function rememberView() {
  try { store.setLastView(state.showingOverview ? 'overview' : 'vehicle'); } catch (error) {
    showError(`Weergave kon niet worden onthouden: ${error.message}`);
  }
}
$('#sidebar-toggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') === 'true';
  $('#sidebar-heading').hidden = expanded;
  $('#archive-heading').hidden = expanded || !state.vehicles.some(v => v.archived);
  $('#sidebar-bottom').hidden = expanded;
  document.querySelector('.sidebar').classList.toggle('collapsed', expanded);
  button.setAttribute('aria-expanded', String(!expanded));
  const label = expanded ? 'Zijmenu uitklappen' : 'Zijmenu inklappen';
  button.setAttribute('aria-label', label);
  button.title = label;
});
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function linkedText(tag, className, text) {
  const node = element(tag, className);
  for (const part of splitLinks(text)) {
    if (!part.url) {
      node.append(document.createTextNode(part.text));
    } else {
      const link = element('a', 'text-link', part.text);
      link.href = part.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `${part.text} (opent in een nieuw tabblad of venster)`);
      node.append(link);
    }
  }
  return node;
}
function action(label, className, iconPath, handler) {
  const button = element('button', className);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', iconPath);
  svg.append(path);
  button.append(svg);
  button.addEventListener('click', handler);
  return button;
}
async function refreshVehicles(preferredId = state.selectedId) {
  state.vehicles = store.listVehicles();
  state.selectedId = state.vehicles.some(v => v.id === preferredId) ? preferredId : state.vehicles.find(v => !v.archived)?.id ?? null;
  renderVehicles();
  await loadSelected();
  rememberSelection();
}
function renderVehicles() {
  const list = $('#vehicle-list'), archive = $('#archive-list');
  list.replaceChildren();
  archive.replaceChildren();
  $('#archive-heading').hidden = document.querySelector('.sidebar').classList.contains('collapsed') || !state.vehicles.some(v => v.archived);
  const overviewButton = $('#show-overview');
  overviewButton.classList.toggle('active', state.showingOverview);
  if (state.showingOverview) overviewButton.setAttribute('aria-current', 'page');
  else overviewButton.removeAttribute('aria-current');
  for (const vehicle of state.vehicles) {
    const button = element('button', `vehicle-link${!state.showingOverview && vehicle.id === state.selectedId ? ' active' : ''}`);
    button.type = 'button';
    button.setAttribute('aria-label', `${vehicle.name} (${vehicle.type}${vehicle.archived ? ', gearchiveerd' : ''})`);
    button.title = `${vehicle.name} (${vehicle.type}${vehicle.archived ? ', gearchiveerd' : ''})`;
    if (!state.showingOverview && vehicle.id === state.selectedId) button.setAttribute('aria-current', 'true');
    const icon = element('span', 'vehicle-link-icon');
    icon.setAttribute('aria-hidden', 'true');
    const words = vehicle.name.trim().split(/\s+/);
    const initials = words.length > 1 ? Array.from(words[0])[0] + Array.from(words[1])[0] : Array.from(words[0]).slice(0, 2).join('');
    icon.append(element('span', 'vehicle-type-icon', vehicle.type === 'Motorfiets' ? '◈' : '▰'), element('span', 'vehicle-initials', initials.toLocaleUpperCase('nl')));
    const details = element('span', 'vehicle-details');
    details.append(element('strong', '', vehicle.name), element('small', '', vehicle.archived ? `${vehicle.type} · Gearchiveerd` : vehicle.type));
    button.append(icon, details);
    button.addEventListener('click', async () => {
      const hadFocus = document.activeElement === button;
      await selectVehicle(vehicle.id);
      if (hadFocus) (vehicle.archived ? archive : list).querySelector('[aria-current="true"]')?.focus();
    });
    (vehicle.archived ? archive : list).append(button);
  }
}
async function loadSelected() {
  const token = ++state.loadToken;
  const vehicle = state.vehicles.find(v => v.id === state.selectedId);
  $('#overview').hidden = !state.showingOverview;
  if (state.showingOverview) {
    $('#empty-garage').hidden = true;
    $('#dashboard').hidden = true;
    renderOverview();
    return;
  }
  $('#empty-garage').hidden = Boolean(vehicle);
  $('#empty-garage-message').textContent = state.vehicles.length
    ? 'Er zijn geen actieve voertuigen. Voeg een voertuig toe of open een voertuig in het archief.'
    : 'Voeg je eerste voertuig toe om de onderhoudshistoriek bij te houden.';
  $('#dashboard').hidden = true;
  if (!vehicle) return;
  const entries = store.listMaintenance(vehicle.id);
  const notes = store.listNotes(vehicle.id);
  const reminders = store.listReminders(vehicle.id);
  if (token !== state.loadToken) return;
  state.entries = entries;
  state.notes = notes;
  state.reminders = reminders;
  $('#vehicle-name').textContent = vehicle.name;
  $('#vehicle-status').textContent = vehicle.archived ? 'GEARCHIVEERD VOERTUIG' : 'GESELECTEERD VOERTUIG';
  $('#archive-vehicle').textContent = vehicle.archived ? 'Terugzetten' : 'Archiveren';
  $('#vehicle-meta').textContent = [vehicle.type, [vehicle.make, vehicle.model].filter(Boolean).join(' '), vehicle.license_plate].filter(Boolean).join('  ·  ');
  fillForm($('#vehicle-consumption-form'), vehicle);
  $('#vehicle-consumption-error').textContent = '';
  updateVehicleEnergyLabels();
  $('#vehicle-mileage-card').replaceChildren(createMileageCard(vehicle, entries, today()));
  $('#stat-odometer').textContent = entries.length ? `${formatNumber(entries[0].odometer)} km` : '—';
  $('#stat-count').textContent = formatNumber(entries.length);
  $('#stat-date').textContent = entries.length ? formatDate(entries[0].performed_on) : '—';
  renderHistory();
  renderChart();
  renderNotes();
  renderReminders();
  $('#dashboard').hidden = false;
}
function reminderDetails(reminder, latest, day) {
  const result = garageInsights.reminderStatus(reminder, latest, day);
  const parts = [];
  if (reminder.due_date !== null) parts.push(`Datum: ${formatDate(reminder.due_date)}`);
  if (reminder.due_odometer !== null) {
    parts.push(`Grens: ${formatNumber(reminder.due_odometer)} km`);
    parts.push(latest ? `Laatste stand: ${formatNumber(latest.odometer)} km (${formatDate(latest.performed_on)})` : 'Geen kilometerstand beschikbaar');
  }
  return { ...result, text: parts.join(' · ') };
}
function statusBadge(status) {
  return element('span', `status-label ${status}`, { due: 'Bereikt', upcoming: 'Nadert', planned: 'Gepland', unknown: 'Kilometerstand ontbreekt' }[status]);
}
function renderReminders() {
  const list = $('#reminders-list');
  list.replaceChildren();
  if (!state.reminders.length) {
    list.append(element('p', 'overview-empty', 'Nog geen werkzaamheden gepland.'));
    return;
  }
  const latest = garageInsights.vehicleStats(state.entries, today()).latest;
  for (const reminder of state.reminders) {
    const details = reminderDetails(reminder, latest, today());
    const row = element('div', 'overview-row'), info = element('div');
    info.append(element('strong', '', reminder.title), statusBadge(details.status), element('p', '', details.text));
    const buttons = element('div', 'row-actions');
    for (const [label, handler, className] of [
      ['Bewerken', () => openReminder(reminder), ''],
      ['Afgehandeld', () => deleteReminder(reminder, true), ''],
      ['Verwijderen', () => deleteReminder(reminder, false), 'danger']
    ]) {
      const button = element('button', className, label);
      button.type = 'button';
      button.setAttribute('aria-label', `${reminder.title} ${label.toLowerCase()}`);
      button.addEventListener('click', handler);
      buttons.append(button);
    }
    row.append(info, buttons);
    list.append(row);
  }
}
function createMileageSparkline(entries, day) {
  const points = garageInsights.mileageSparkline(entries, day);
  if (!points.length) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'overview-sparkline');
  svg.setAttribute('viewBox', '0 0 100 40');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
  svg.append(line);
  return svg;
}
function vehicleCostPerKilometer(entries, day, distance) {
  if (typeof garageInsights.costPerKilometer === 'function') {
    return garageInsights.costPerKilometer(entries, day);
  }
  const knownCosts = entries.filter(entry => entry.performed_on <= day && entry.cost !== null);
  const total = knownCosts.reduce((sum, entry) => sum + Number(entry.cost), 0);
  return {
    perKilometer: knownCosts.length && distance !== null && distance > 0 ? total / distance : null
  };
}
function vehicleEnergyCostPerKilometer(vehicle) {
  if (typeof garageInsights.energyCostPerKilometer === 'function') {
    return garageInsights.energyCostPerKilometer(vehicle);
  }
  if (vehicle.consumption_per_100 === null || vehicle.energy_price === null) {
    return { per100Km: null, perKilometer: null };
  }
  const per100Km = Number(vehicle.consumption_per_100) * Number(vehicle.energy_price);
  return { per100Km, perKilometer: per100Km / 100 };
}
function updateVehicleEnergyLabels() {
  const electric = $('#vehicle-energy-type').value === 'electric';
  $('#vehicle-consumption-unit').textContent = electric ? 'kWh/100 km' : 'L/100 km';
  $('#vehicle-energy-price-label').textContent = electric ? 'Elektriciteitsprijs (€/kWh)' : 'Brandstofprijs (€/L)';
  updateVehicleEnergyPreview();
}
function updateVehicleEnergyPreview() {
  const form = $('#vehicle-consumption-form');
  const consumption = Number(form.elements.namedItem('consumption_per_100').value);
  const price = Number(form.elements.namedItem('energy_price').value);
  const preview = $('#vehicle-energy-preview');
  if (!form.elements.namedItem('consumption_per_100').value || !form.elements.namedItem('energy_price').value) {
    preview.textContent = 'Vul beide waarden in om de energiekost per 100 km te berekenen.';
    return;
  }
  const per100Km = consumption * price;
  preview.textContent = `Berekende energiekost: ${formatCurrency(per100Km)} per 100 km (${formatCurrency(per100Km / 100)} per km).`;
}
function saveVehicleConsumption(vehicleId, data) {
  const formError = $('#vehicle-consumption-error');
  try {
    clearError();
    const vehicle = state.vehicles.find(item => item.id === vehicleId);
    if (!vehicle) throw new Error('Het voertuig voor deze wijziging is niet meer beschikbaar.');
    const savedVehicle = store.saveVehicle(vehicleId, { ...vehicle, ...data });
    state.vehicles = state.vehicles.map(item => item.id === vehicleId ? savedVehicle : item);
    formError.textContent = '';
    if (state.selectedId === vehicleId && !$('#dashboard').hidden) {
      $('#vehicle-mileage-card').replaceChildren(createMileageCard(savedVehicle, state.entries, today()));
    }
  } catch (error) {
    formError.textContent = error.message;
  }
}
function scheduleVehicleConsumptionSave(delay) {
  if (vehicleConsumptionSaveTimer !== null) clearTimeout(vehicleConsumptionSaveTimer);
  const form = $('#vehicle-consumption-form');
  const vehicleId = state.selectedId;
  const data = Object.fromEntries(new FormData(form));
  vehicleConsumptionSaveTimer = setTimeout(() => {
    vehicleConsumptionSaveTimer = null;
    saveVehicleConsumption(vehicleId, data);
  }, delay);
}
function createMileageCard(vehicle, entries, day, inOverview = false) {
  const row = element('article', 'overview-mileage-card'), info = element('div', 'overview-mileage-info');
  const sparkline = createMileageSparkline(entries, day);
  if (sparkline) row.append(sparkline);
  const stats = garageInsights.vehicleStats(entries, day);
  if (inOverview) info.append(element('strong', '', vehicle.name));
  let message = stats.latest ? `Laatste stand: ${formatNumber(stats.latest.odometer)} km op ${formatDate(stats.latest.performed_on)}.` : 'Nog geen kilometerstand tot en met vandaag.';
  if (stats.decrease) message += ' Een daling in de tellerstand verhindert een betrouwbare afstandsberekening.';
  else if (stats.distance !== null) message += ` ${formatNumber(stats.distance)} km tussen ${formatDate(stats.first.performed_on)} en ${formatDate(stats.latest.performed_on)}; gemiddeld `;
  else if (stats.latest) message += ' Voeg standen op verschillende datums toe voor een gemiddelde.';
  const description = element('p', '', message);
  if (!stats.decrease && stats.distance !== null) {
    description.append(element('strong', '', `${formatNumber(Math.round(stats.perYear))} km per jaar`), '.');
  }
  info.append(description);
  const costs = garageInsights.annualCost(entries, day);
  const maintenancePerKilometer = vehicleCostPerKilometer(entries, day, stats.distance).perKilometer;
  const energyPerKilometer = vehicleEnergyCostPerKilometer(vehicle).perKilometer;
  const totalPerKilometer = maintenancePerKilometer === null && energyPerKilometer === null
    ? null
    : (maintenancePerKilometer ?? 0) + (energyPerKilometer ?? 0);
  const costDescription = element('p', '', 'Gemiddelde kost: ');
  if (costs.perYear === null) {
    costDescription.append('geen onderhoudskosten geregistreerd.');
  } else {
    costDescription.append(element('strong', '', `${formatCurrency(costs.perYear)} per kalenderjaar`), '.');
  }
  if (totalPerKilometer !== null) {
    costDescription.append(' Totale kost inclusief verbruik: ', element('strong', '', `${formatCurrency(totalPerKilometer)} per km`), ' (');
    const components = [];
    if (maintenancePerKilometer !== null) components.push(`onderhoud ${formatCurrency(maintenancePerKilometer)}`);
    if (energyPerKilometer !== null) components.push(`energie ${formatCurrency(energyPerKilometer)}`);
    costDescription.append(`${components.join(' + ')}).`);
  } else if (costs.perYear !== null) {
    costDescription.append(' Kost per kilometer niet beschikbaar.');
  }
  info.append(costDescription);
  row.append(info);
  if (inOverview) {
    const button = element('button', 'overview-vehicle-button', 'Bekijk voertuig');
    button.type = 'button';
    button.setAttribute('aria-label', `${vehicle.name} bekijken`);
    button.addEventListener('click', () => selectVehicle(vehicle.id));
    row.append(button);
  }
  return row;
}
function renderOverview() {
  const data = store.read(), day = today();
  const activeVehicles = state.vehicles.filter(vehicle => !vehicle.archived);
  const activeIds = new Set(activeVehicles.map(vehicle => vehicle.id));
  $('#overview-vehicles').textContent = formatNumber(activeVehicles.length);
  $('#overview-entries').textContent = formatNumber(data.maintenance.filter(entry => activeIds.has(entry.vehicle_id)).length);
  const list = $('#overview-vehicles-list'), planning = $('#overview-reminders');
  list.replaceChildren();
  planning.replaceChildren();
  const notesGrid = $('#overview-notes');
  notesGrid.replaceChildren();
  let importantNotes = 0;
  for (const vehicle of activeVehicles) {
    const entries = data.maintenance.filter(entry => entry.vehicle_id === vehicle.id);
    list.append(createMileageCard(vehicle, entries, day, true));
    for (const note of data.notes.filter(item => item.vehicle_id === vehicle.id && item.important)) {
      importantNotes++;
      const card = element('article', 'note-card important');
      card.append(
        element('span', 'note-important-label', '★ Belangrijk'),
        linkedText('h4', '', note.title),
        linkedText('p', '', note.content),
        element('span', 'overview-note-vehicle', vehicle.name)
      );
      const noteButton = element('button', 'overview-vehicle-button', 'Bekijk voertuig');
      noteButton.type = 'button';
      noteButton.setAttribute('aria-label', `${vehicle.name} bekijken voor notitie ${note.title}`);
      noteButton.addEventListener('click', () => selectVehicle(vehicle.id));
      card.append(noteButton);
      notesGrid.append(card);
    }
  }
  $('#overview-notes-empty').hidden = importantNotes > 0;
  const reminderOverview = garageInsights.overviewReminders(activeVehicles, data.maintenance, data.reminders, day);
  for (const { vehicle, reminder, latest } of reminderOverview.items) {
    const details = reminderDetails(reminder, latest, day);
    const taskRow = element('div', 'overview-row'), taskInfo = element('div');
    taskInfo.append(element('strong', '', `${vehicle.name} · ${reminder.title}`), statusBadge(details.status), element('p', '', details.text));
    const taskButton = element('button', 'overview-vehicle-button', 'Bekijk voertuig');
    taskButton.type = 'button';
    taskButton.setAttribute('aria-label', `${vehicle.name} bekijken voor ${reminder.title}`);
    taskButton.addEventListener('click', () => selectVehicle(vehicle.id));
    taskRow.append(taskInfo, taskButton);
    planning.append(taskRow);
  }
  if (!activeVehicles.length) list.append(element('p', 'overview-empty', 'Geen actieve voertuigen. Voeg een voertuig toe of zet er een terug uit het archief.'));
  if (!reminderOverview.items.length) planning.append(element('p', 'overview-empty', 'Geen werkzaamheden gepland. Plan werkzaamheden bij een voertuig.'));
  $('#overview-due').textContent = formatNumber(reminderOverview.attentionCount);
}
async function selectVehicle(id) {
  state.showingOverview = false;
  state.selectedId = id;
  renderVehicles();
  try { clearError(); await loadSelected(); rememberSelection(); rememberView(); } catch (error) { showError(error.message); }
}
$('#show-overview').addEventListener('click', async () => {
  state.showingOverview = true;
  renderVehicles();
  try { clearError(); await loadSelected(); rememberView(); } catch (error) { showError(error.message); }
});
function renderNotes() {
  const grid = $('#notes-grid');
  grid.replaceChildren();
  $('#notes-empty').hidden = state.notes.length > 0;
  for (const note of state.notes) {
    const card = element('article', `note-card${note.important ? ' important' : ''}`);
    const header = element('div', 'note-card-header');
    const menu = element('details', 'note-menu');
    const toggle = element('summary', 'note-menu-toggle', '⋮');
    toggle.setAttribute('aria-label', `Acties voor ${note.title}`);
    toggle.title = 'Notitieacties';
    const controls = element('div', 'note-actions');
    const mark = element('button', '', note.important ? 'Belangrijkmarkering verwijderen' : 'Markeren als belangrijk');
    mark.type = 'button';
    mark.setAttribute('aria-label', `${note.title}: ${mark.textContent}`);
    mark.addEventListener('click', () => { menu.open = false; setNoteImportant(note); });
    const edit = element('button', '', 'Bewerken');
    edit.type = 'button';
    edit.setAttribute('aria-label', `${note.title} bewerken`);
    edit.addEventListener('click', () => { menu.open = false; openNote(note); });
    const remove = element('button', 'danger', 'Verwijderen');
    remove.type = 'button';
    remove.setAttribute('aria-label', `${note.title} verwijderen`);
    remove.addEventListener('click', () => { menu.open = false; toggle.focus(); deleteNote(note); });
    toggle.addEventListener('click', () => {
      if (!menu.open) {
        for (const other of grid.querySelectorAll('.note-menu[open]')) other.open = false;
      }
    });
    controls.append(mark, edit, remove);
    menu.append(toggle, controls);
    header.append(linkedText('h4', '', note.title), menu);
    card.append(header);
    if (note.important) card.append(element('span', 'note-important-label', '★ Belangrijk'));
    card.append(linkedText('p', '', note.content));
    grid.append(card);
  }
}
document.addEventListener('click', event => {
  for (const menu of document.querySelectorAll('.note-menu[open]')) {
    if (!menu.contains(event.target)) menu.open = false;
  }
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const menu = document.querySelector('.note-menu[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus();
    event.preventDefault();
  }
});
function renderHistory() {
  const body = $('#history-body');
  body.replaceChildren();
  $('#history-empty').hidden = state.entries.length > 0;
  for (const entry of state.entries) {
    const row = element('tr');
    const date = element('td', '', formatDate(entry.performed_on));
    const work = element('td');
    work.append(linkedText('strong', '', entry.title));
    if (entry.description) work.append(linkedText('span', 'notes', entry.description));
    const km = element('td', '', `${formatNumber(entry.odometer)} km`);
    const cost = element('td', '', entry.cost === null ? '—' : formatCurrency(entry.cost));
    const actions = element('td');
    const wrapper = element('div', 'actions');
    wrapper.append(
      action(`${entry.title} bewerken`, 'table-action', 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z', () => openMaintenance(entry)),
      action(`${entry.title} verwijderen`, 'table-action danger', 'M4 7h16 M10 3h4 M6 7l1 13h10l1-13 M10 11v5 M14 11v5', () => deleteMaintenance(entry))
    );
    actions.append(wrapper);
    row.append(date, work, km, cost, actions);
    body.append(row);
  }
}
function renderChart() {
  const container = $('#chart');
  container.replaceChildren();
  if (!state.entries.length) {
    container.append(element('div', 'chart-empty', 'Voeg onderhoud toe om het kilometerverloop te zien.'));
    return;
  }
  const points = [...state.entries].reverse();
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 900 240');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Kilometerverloop met ${points.length} registratie(s), van ${formatDate(points[0].performed_on)} tot ${formatDate(points.at(-1).performed_on)}.`);
  const add = (tag, attrs, content) => {
    const node = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (content !== undefined) node.textContent = content;
    svg.append(node);
    return node;
  };
  const times = points.map(p => Date.parse(`${p.performed_on}T00:00:00Z`));
  const minTime = times.reduce((a, b) => Math.min(a, b)), maxTime = times.reduce((a, b) => Math.max(a, b));
  const values = points.map(p => Number(p.odometer));
  const minValue = values.reduce((a, b) => Math.min(a, b)), maxValue = values.reduce((a, b) => Math.max(a, b));
  const { lower, upper, ticks } = garageInsights.mileageAxis(minValue, maxValue);
  const x = t => minTime === maxTime ? 470 : 75 + (t - minTime) / (maxTime - minTime) * 790;
  const y = v => 190 - (v - lower) / (upper - lower) * 165;
  for (const value of ticks) {
    const position = y(value);
    add('line', { x1: 75, x2: 865, y1: position, y2: position, stroke: '#edf1ec' });
    add('text', { x: 65, y: position + 4, 'text-anchor': 'end', fill: '#9daaa1', 'font-size': 11 }, formatNumber(value));
  }
  const linePoints = points.map((p, i) => `${x(times[i])},${y(values[i])}`);
  if (linePoints.length > 1) {
    add('polygon', {
      points: `${linePoints.join(' ')} ${x(times.at(-1))},190 ${x(times[0])},190`,
      fill: '#6f9c6d',
      'fill-opacity': 0.14
    });
  }
  add('polyline', { points: linePoints.join(' '), fill: 'none', stroke: '#6f9c6d', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  points.forEach((point, i) => {
    const circle = add('circle', { cx: x(times[i]), cy: y(values[i]), r: 4, fill: '#fff', stroke: '#6f9c6d', 'stroke-width': 2 });
    const title = document.createElementNS(ns, 'title');
    title.textContent = `${formatDate(point.performed_on)}: ${formatNumber(point.odometer)} km — ${point.title}`;
    circle.append(title);
  });
  add('text', { x: minTime === maxTime ? 470 : 75, y: 225, 'text-anchor': minTime === maxTime ? 'middle' : 'start', fill: '#9daaa1', 'font-size': 11 }, formatDate(points[0].performed_on));
  if (minTime !== maxTime) add('text', { x: 865, y: 225, 'text-anchor': 'end', fill: '#9daaa1', 'font-size': 11 }, formatDate(points.at(-1).performed_on));
  container.append(svg);
}
function fillForm(form, data) {
  form.reset();
  const formError = form.querySelector('.form-error');
  if (formError) formError.textContent = '';
  for (const [key, value] of Object.entries(data)) {
    if (form.elements.namedItem(key)) form.elements.namedItem(key).value = value ?? '';
  }
}
function openVehicle(vehicle = null) {
  state.editingVehicle = vehicle?.id ?? null;
  $('#vehicle-dialog-title').textContent = vehicle ? 'Voertuig bewerken' : 'Voertuig toevoegen';
  const select = $('#vehicle-form [name=type]');
  select.querySelector('option[data-custom]')?.remove();
  if (vehicle && !Array.from(select.options).some(option => option.value === vehicle.type)) {
    const option = element('option', '', vehicle.type);
    option.value = vehicle.type;
    option.dataset.custom = 'true';
    select.append(option);
  }
  fillForm($('#vehicle-form'), vehicle || {});
  $('#vehicle-dialog').showModal();
}
function openMaintenance(entry = null) {
  state.editingEntry = entry?.id ?? null;
  $('#maintenance-dialog-title').textContent = entry ? 'Onderhoud of waarneming bewerken' : 'Onderhoud of waarneming toevoegen';
  fillForm($('#maintenance-form'), entry || { performed_on: today() });
  $('#maintenance-dialog').showModal();
}
function openNote(note = null) {
  state.editingNote = note?.id ?? null;
  $('#note-dialog-title').textContent = note ? 'Notitie bewerken' : 'Notitie toevoegen';
  fillForm($('#note-form'), note || {});
  $('#note-dialog').showModal();
}
function openReminder(reminder = null) {
  state.editingReminder = reminder?.id ?? null;
  $('#reminder-dialog-title').textContent = reminder ? 'Werkzaamheid bewerken' : 'Werkzaamheid plannen';
  fillForm($('#reminder-form'), reminder || {});
  $('#reminder-dialog').showModal();
}
async function submitForm(form, save, dialog, afterSave) {
  const button = form.querySelector('[type=submit]');
  let formError = form.querySelector('.form-error');
  if (!formError) {
    formError = element('p', 'form-error');
    formError.setAttribute('role', 'alert');
    form.insertBefore(formError, form.querySelector('.dialog-actions'));
  }
  formError.textContent = '';
  button.disabled = true;
  try {
    clearError();
    const result = save(Object.fromEntries(new FormData(form)));
    if (dialog) dialog.close();
    await afterSave(result);
  } catch (error) {
    if (!dialog || dialog.open) formError.textContent = error.message;
    else showError(error.message);
  } finally { button.disabled = false; }
}
for (const selector of ['#add-vehicle', '#add-vehicle-side', '#add-first']) $(selector).addEventListener('click', () => openVehicle());
$('#dismiss-data-warning').addEventListener('click', () => {
  setDataWarningDismissed(true);
  $('#add-vehicle').focus();
});
$('#edit-vehicle').addEventListener('click', () => openVehicle(state.vehicles.find(v => v.id === state.selectedId)));
$('#add-maintenance').addEventListener('click', () => openMaintenance());
$('#add-note').addEventListener('click', () => openNote());
$('#add-reminder').addEventListener('click', () => openReminder());
for (const button of document.querySelectorAll('.close-dialog, .cancel-dialog')) button.addEventListener('click', () => button.closest('dialog').close());
$('#vehicle-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = state.editingVehicle;
  const existingVehicle = state.vehicles.find(vehicle => vehicle.id === id);
  const startsProject = id === null && state.vehicles.length === 0;
  submitForm(event.currentTarget, data => store.saveVehicle(id, { ...existingVehicle, ...data }), $('#vehicle-dialog'), async vehicle => {
    if (startsProject) setDataWarningDismissed(false);
    state.showingOverview = false;
    await refreshVehicles(vehicle.id);
    rememberView();
  });
});
$('#vehicle-consumption-form').addEventListener('submit', event => {
  event.preventDefault();
  scheduleVehicleConsumptionSave(0);
});
$('#vehicle-energy-type').addEventListener('change', () => {
  updateVehicleEnergyLabels();
  scheduleVehicleConsumptionSave(0);
});
$('#vehicle-consumption-form [name=consumption_per_100]').addEventListener('input', () => {
  updateVehicleEnergyPreview();
  scheduleVehicleConsumptionSave(500);
});
$('#vehicle-consumption-form [name=energy_price]').addEventListener('input', () => {
  updateVehicleEnergyPreview();
  scheduleVehicleConsumptionSave(500);
});
$('#vehicle-consumption-form [name=consumption_per_100]').addEventListener('change', () => scheduleVehicleConsumptionSave(0));
$('#vehicle-consumption-form [name=energy_price]').addEventListener('change', () => scheduleVehicleConsumptionSave(0));
$('#maintenance-form').addEventListener('submit', event => {
  event.preventDefault();
  const vehicleId = state.selectedId, id = state.editingEntry;
  submitForm(event.currentTarget, data => store.saveMaintenance(vehicleId, id, data), $('#maintenance-dialog'), () => refreshVehicles(vehicleId));
});
$('#note-form').addEventListener('submit', event => {
  event.preventDefault();
  const vehicleId = state.selectedId, id = state.editingNote;
  submitForm(event.currentTarget, data => store.saveNote(vehicleId, id, data), $('#note-dialog'), () => refreshVehicles(vehicleId));
});
$('#reminder-form').addEventListener('submit', event => {
  event.preventDefault();
  const vehicleId = state.selectedId, id = state.editingReminder;
  submitForm(event.currentTarget, data => store.saveReminder(vehicleId, id, data), $('#reminder-dialog'), () => refreshVehicles(vehicleId));
});
$('#archive-vehicle').addEventListener('click', async () => {
  const vehicle = state.vehicles.find(v => v.id === state.selectedId);
  if (!vehicle.archived && !confirm(`"${vehicle.name}" archiveren? De historiek, notities en planning blijven bewaard.`)) return;
  try {
    clearError();
    store.setVehicleArchived(vehicle.id, !vehicle.archived);
    await refreshVehicles(vehicle.id);
  } catch (error) { showError(error.message); }
});
$('#delete-vehicle').addEventListener('click', async () => {
  const vehicle = state.vehicles.find(v => v.id === state.selectedId);
  if (!confirm(`"${vehicle.name}" en alle bijbehorende onderhoudsregistraties, notities en geplande werkzaamheden verwijderen?`)) return;
  try { clearError(); store.deleteVehicle(vehicle.id); await refreshVehicles(); } catch (error) { showError(error.message); }
});
async function deleteMaintenance(entry) {
  const vehicleId = state.selectedId;
  if (!confirm(`"${entry.title}" verwijderen?`)) return;
  try { clearError(); store.deleteMaintenance(vehicleId, entry.id); await refreshVehicles(vehicleId); } catch (error) { showError(error.message); }
}
async function deleteNote(note) {
  const vehicleId = state.selectedId;
  if (!confirm(`Notitie "${note.title}" verwijderen?`)) return;
  try { clearError(); store.deleteNote(vehicleId, note.id); await refreshVehicles(vehicleId); } catch (error) { showError(error.message); }
}
async function setNoteImportant(note) {
  const vehicleId = state.selectedId;
  try { clearError(); store.setNoteImportant(vehicleId, note.id, !note.important); await refreshVehicles(vehicleId); } catch (error) { showError(error.message); }
}
async function deleteReminder(reminder, completed) {
  const vehicleId = state.selectedId;
  const question = completed ? `"${reminder.title}" als afgehandeld verwijderen uit de planning? Dit maakt geen onderhoudsregistratie aan.` : `"${reminder.title}" uit de planning verwijderen?`;
  if (!confirm(question)) return;
  try { clearError(); store.deleteReminder(vehicleId, reminder.id); await refreshVehicles(vehicleId); } catch (error) { showError(error.message); }
}
function downloadBackup() {
  const json = store.exportJson();
  const filename = downloadFilename();
  const link = element('a');
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
function importSummary(data) {
  const records = data.maintenance.length + data.notes.length + data.reminders.length;
  return `${formatNumber(data.vehicles.length)} voertuigen, ${formatNumber(records)} records`;
}
function chooseImport(current, imported) {
  const dialog = $('#import-dialog');
  $('#import-current').textContent = `Huidige sessie: ${importSummary(current)}`;
  $('#import-incoming').textContent = `Te openen bestand: ${importSummary(imported)}`;
  dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}
$('#export-data').addEventListener('click', () => {
  try { clearError(); downloadBackup(); } catch (error) { showError(`Download mislukt: ${error.message}`); }
});
$('#import-data').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', async event => {
  const input = event.currentTarget;
  const file = input.files[0];
  if (!file) return;
  try {
    clearError();
    if (file.size > 10 * 1024 * 1024) throw new Error('Het bestand is groter dan 10 MB.');
    const contents = await file.text();
    const imported = garageStorage.validateData(JSON.parse(contents));
    const current = store.read();
    const snapshot = JSON.stringify(current);
    const choice = await chooseImport(current, imported);
    if (choice !== 'replace' && choice !== 'merge') return;
    if (JSON.stringify(store.read()) !== snapshot) throw new Error('De huidige gegevens zijn gewijzigd. Open het bestand opnieuw om de aantallen te vergelijken.');
    try { downloadBackup(); } catch (error) { throw new Error(`Back-up maken mislukt: ${error.message}`); }
    if (choice === 'replace') store.importJson(contents);
    else store.mergeJson(contents);
    setDataWarningDismissed(false);
    await refreshVehicles(choice === 'replace' ? null : state.selectedId);
  } catch (error) {
    showError(`Upload mislukt: ${error instanceof SyntaxError ? 'Het bestand bevat geen geldige JSON.' : error.message}`);
  } finally { input.value = ''; }
});
window.addEventListener('storage', event => {
  if (event.key !== garageStorage.KEY && event.key !== null) return;
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog) openDialog.close();
  refreshVehicles().then(() => {
    showError(openDialog ? 'Gegevens zijn gewijzigd in een ander tabblad. Je formulier is gesloten; voer de wijzigingen opnieuw in.' : 'Gegevens zijn bijgewerkt vanuit een ander tabblad.');
  }).catch(error => showError(error.message));
});
try {
  state.selectedId = store.getSelectedVehicleId();
} catch (error) {
  showError(`Voertuigselectie kon niet worden gelezen: ${error.message}`);
}
try {
  state.showingOverview = store.getLastView() === 'overview';
} catch (error) {
  showError(`Weergave kon niet worden gelezen: ${error.message}`);
}
refreshVehicles().catch(error => showError(error.message));
