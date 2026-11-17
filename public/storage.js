const garageStorage = (() => {
  const validator = typeof module !== 'undefined' ? require('./validation') : validation;
  const KEY = 'garageboek.data.v1';
  const SELECTION_KEY = 'garageboek.selectedVehicle';
  const VIEW_KEY = 'garageboek.lastView';
  const MAX_ID = 4294967295;
  const empty = () => ({ version: 5, vehicles: [], maintenance: [], notes: [], reminders: [] });
  const validId = id => Number.isInteger(id) && id > 0 && id <= MAX_ID;

  function exactKeys(value, keys) {
    return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
  }

  function validateData(data) {
    const legacy = data?.version === 1 && exactKeys(data, ['version', 'vehicles', 'maintenance']);
    const previous = data?.version === 2 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes']);
    const prior = data?.version === 3 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    const v4 = data?.version === 4 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    const current = data?.version === 5 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    if ((!legacy && !previous && !prior && !v4 && !current) || !Array.isArray(data.vehicles) || !Array.isArray(data.maintenance) ||
        (!legacy && !Array.isArray(data.notes)) || ((current || v4 || prior) && !Array.isArray(data.reminders))) {
      throw new Error('Ongeldig of niet-ondersteund Garageboek-bestand.');
    }
    const vehicleIds = new Set(), entryIds = new Set();
    const vehicles = data.vehicles.map(item => {
      const keys = ['id', 'name', 'type', 'make', 'model', 'license_plate'];
      if (!exactKeys(item, current ? [...keys, 'archived'] : keys) ||
          (current && typeof item.archived !== 'boolean') ||
          !validId(item.id) || vehicleIds.has(item.id) ||
          !['name', 'type', 'make', 'model', 'license_plate'].every(key => typeof item[key] === 'string')) {
        throw new Error('Ongeldig of dubbel voertuig in het bestand.');
      }
      vehicleIds.add(item.id);
      return { id: item.id, ...validator.vehicle(item), archived: current ? item.archived : false };
    });
    const maintenance = data.maintenance.map(item => {
      if (!exactKeys(item, ['id', 'vehicle_id', 'performed_on', 'odometer', 'title', 'description', 'cost']) ||
          !validId(item.id) || entryIds.has(item.id) || !vehicleIds.has(item.vehicle_id) ||
          typeof item.description !== 'string' || (item.cost !== null && typeof item.cost !== 'string' && typeof item.cost !== 'number')) {
        throw new Error('Ongeldige onderhoudsregistratie of onbekend voertuig in het bestand.');
      }
      entryIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.maintenance(item) };
    });
    const noteIds = new Set();
    const notes = (legacy ? [] : data.notes).map(item => {
      const hasImportant = current || v4;
      const keys = hasImportant ? ['id', 'vehicle_id', 'title', 'content', 'important'] : ['id', 'vehicle_id', 'title', 'content'];
      if (!exactKeys(item, keys) || (hasImportant && typeof item.important !== 'boolean') ||
          !validId(item.id) || noteIds.has(item.id) || !vehicleIds.has(item.vehicle_id)) {
        throw new Error('Ongeldige of dubbele notitie of onbekend voertuig in het bestand.');
      }
      noteIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.note(item), important: hasImportant ? item.important : false };
    });
    const reminderIds = new Set();
    const reminders = (current || v4 || prior ? data.reminders : []).map(item => {
      if (!exactKeys(item, ['id', 'vehicle_id', 'title', 'due_date', 'due_odometer']) ||
          !validId(item.id) || reminderIds.has(item.id) || !vehicleIds.has(item.vehicle_id) ||
          (item.due_date !== null && typeof item.due_date !== 'string') ||
          (item.due_odometer !== null && typeof item.due_odometer !== 'number')) {
        throw new Error('Ongeldige of dubbele geplande werkzaamheid of onbekend voertuig in het bestand.');
      }
      reminderIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.reminder(item) };
    });
    return { version: 5, vehicles, maintenance, notes, reminders };
  }

  function parse(json) {
    let data;
    try { data = JSON.parse(json); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error('Het bestand bevat geen geldige JSON.');
    }
    return validateData(data);
  }

  function createStore(storage) {
    function read() {
      const json = storage.getItem(KEY);
      return json === null ? empty() : parse(json);
    }
    function write(data) {
      storage.setItem(KEY, JSON.stringify(data));
    }
    function nextId(items) {
      const id = items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
      if (id > MAX_ID) throw new Error('Er zijn geen nieuwe identificatienummers beschikbaar.');
      return id;
    }
    function findVehicle(data, id) {
      const vehicle = data.vehicles.find(item => item.id === id);
      if (!vehicle) throw new Error('Voertuig niet gevonden.');
      return vehicle;
    }
    function findEntry(data, vehicleId, id) {
      const entry = data.maintenance.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!entry) throw new Error('Onderhoud niet gevonden.');
      return entry;
    }
    function findNote(data, vehicleId, id) {
      const note = data.notes.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!note) throw new Error('Notitie niet gevonden.');
      return note;
    }
    function findReminder(data, vehicleId, id) {
      const reminder = data.reminders.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!reminder) throw new Error('Geplande werkzaamheid niet gevonden.');
      return reminder;
    }
    return {
      read,
      getLastView() {
        const value = storage.getItem(VIEW_KEY);
        if (value === null) return 'vehicle';
        if (value !== 'vehicle' && value !== 'overview') throw new Error('De opgeslagen weergave is ongeldig.');
        return value;
      },
      setLastView(view) {
        if (view !== 'vehicle' && view !== 'overview') throw new Error('Ongeldige weergave.');
        storage.setItem(VIEW_KEY, view);
      },
      getSelectedVehicleId() {
        const value = storage.getItem(SELECTION_KEY);
        if (value === null || value === 'null') return null;
        if (!/^[1-9]\d*$/.test(value) || !validId(Number(value))) {
          throw new Error('De opgeslagen voertuigselectie is ongeldig.');
        }
        return Number(value);
      },
      setSelectedVehicleId(id) {
        if (id !== null && !validId(id)) throw new Error('Ongeldige voertuigselectie.');
        storage.setItem(SELECTION_KEY, String(id));
      },
      importJson(json) { const data = parse(json); write(data); },
      exportJson() { return JSON.stringify(read(), null, 2) + '\n'; },
      listVehicles() { return read().vehicles.sort((a, b) => a.name.localeCompare(b.name, 'nl') || a.id - b.id); },
      listMaintenance(vehicleId) {
        const data = read();
        findVehicle(data, vehicleId);
        return data.maintenance.filter(item => item.vehicle_id === vehicleId)
          .sort((a, b) => b.performed_on.localeCompare(a.performed_on) || b.id - a.id);
      },
      listNotes(vehicleId) {
        const data = read();
        findVehicle(data, vehicleId);
        return data.notes.filter(item => item.vehicle_id === vehicleId).sort((a, b) => b.id - a.id);
      },
      listReminders(vehicleId) {
        const data = read();
        findVehicle(data, vehicleId);
        return data.reminders.filter(item => item.vehicle_id === vehicleId).sort((a, b) => b.id - a.id);
      },
      saveVehicle(id, input) {
        const data = read(), fields = validator.vehicle(input);
        let vehicle;
        if (id === null) {
          vehicle = { id: nextId(data.vehicles), ...fields, archived: false };
          data.vehicles.push(vehicle);
        } else {
          vehicle = findVehicle(data, id);
          Object.assign(vehicle, fields);
        }
        write(data);
        return vehicle;
      },
      setVehicleArchived(id, archived) {
        if (typeof archived !== 'boolean') throw new Error('Ongeldige archiefstatus.');
        const data = read();
        const vehicle = findVehicle(data, id);
        vehicle.archived = archived;
        write(data);
        return vehicle;
      },
      deleteVehicle(id) {
        const data = read();
        findVehicle(data, id);
        data.vehicles = data.vehicles.filter(item => item.id !== id);
        data.maintenance = data.maintenance.filter(item => item.vehicle_id !== id);
        data.notes = data.notes.filter(item => item.vehicle_id !== id);
        data.reminders = data.reminders.filter(item => item.vehicle_id !== id);
        write(data);
      },
      saveNote(vehicleId, id, input) {
        const data = read(), fields = validator.note(input);
        findVehicle(data, vehicleId);
        let note;
        if (id === null) {
          note = { id: nextId(data.notes), vehicle_id: vehicleId, ...fields, important: false };
          data.notes.push(note);
        } else {
          note = findNote(data, vehicleId, id);
          Object.assign(note, fields);
        }
        write(data);
        return note;
      },
      setNoteImportant(vehicleId, id, important) {
        if (typeof important !== 'boolean') throw new Error('Ongeldige belangrijkmarkering.');
        const data = read();
        const note = findNote(data, vehicleId, id);
        note.important = important;
        write(data);
        return note;
      },
      deleteNote(vehicleId, id) {
        const data = read();
        findNote(data, vehicleId, id);
        data.notes = data.notes.filter(item => item.id !== id);
        write(data);
      },
      saveReminder(vehicleId, id, input) {
        const data = read(), fields = validator.reminder(input);
        findVehicle(data, vehicleId);
        let reminder;
        if (id === null) {
          reminder = { id: nextId(data.reminders), vehicle_id: vehicleId, ...fields };
          data.reminders.push(reminder);
        } else {
          reminder = findReminder(data, vehicleId, id);
          Object.assign(reminder, fields);
        }
        write(data);
        return reminder;
      },
      deleteReminder(vehicleId, id) {
        const data = read();
        findReminder(data, vehicleId, id);
        data.reminders = data.reminders.filter(item => item.id !== id);
        write(data);
      },
      saveMaintenance(vehicleId, id, input) {
        const data = read(), fields = validator.maintenance(input);
        findVehicle(data, vehicleId);
        let entry;
        if (id === null) {
          entry = { id: nextId(data.maintenance), vehicle_id: vehicleId, ...fields };
          data.maintenance.push(entry);
        } else {
          entry = findEntry(data, vehicleId, id);
          Object.assign(entry, fields);
        }
        write(data);
        return entry;
      },
      deleteMaintenance(vehicleId, id) {
        const data = read();
        findEntry(data, vehicleId, id);
        data.maintenance = data.maintenance.filter(item => item.id !== id);
        write(data);
      }
    };
  }
  return { KEY, SELECTION_KEY, VIEW_KEY, createStore, validateData };
})();

if (typeof module !== 'undefined') {
  module.exports = garageStorage;
}
