const garageStorage = (() => {
  const storageText = typeof module !== 'undefined' ? require('./i18n').create('nl').t : garageI18n.t;
  const validator = typeof module !== 'undefined' ? require('./validation') : validation;
  const KEY = 'garageboek.data.v1';
  const SELECTION_KEY = 'garageboek.selectedVehicle';
  const VIEW_KEY = 'garageboek.lastView';
  const MAX_ID = 4294967295;
  const empty = () => ({ version: 7, vehicles: [], maintenance: [], notes: [], reminders: [] });
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
    const v5 = data?.version === 5 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    const v6 = data?.version === 6 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    const current = data?.version === 7 && exactKeys(data, ['version', 'vehicles', 'maintenance', 'notes', 'reminders']);
    if ((!legacy && !previous && !prior && !v4 && !v5 && !v6 && !current) || !Array.isArray(data.vehicles) || !Array.isArray(data.maintenance) ||
        (!legacy && !Array.isArray(data.notes)) || ((current || v6 || v5 || v4 || prior) && !Array.isArray(data.reminders))) {
      throw new Error(storageText('invalidUnsupported'));
    }
    const vehicleIds = new Set(), entryIds = new Set();
    const vehicles = data.vehicles.map(item => {
      const keys = ['id', 'name', 'type', 'make', 'model', 'license_plate'];
      const archivedKeys = [...keys, 'archived'];
      const energyKeys = [...archivedKeys, 'energy_type', 'consumption_per_100', 'energy_price'];
      const currentKeys = [...energyKeys, 'service_interval_km'];
      if (!exactKeys(item, current ? currentKeys : v6 ? energyKeys : v5 ? archivedKeys : keys) ||
          ((current || v6 || v5) && typeof item.archived !== 'boolean') ||
          !validId(item.id) || vehicleIds.has(item.id) ||
          !['name', 'type', 'make', 'model', 'license_plate'].every(key => typeof item[key] === 'string') ||
          (current && typeof item.service_interval_km !== 'number') ||
          ((current || v6) && (typeof item.energy_type !== 'string' ||
            (item.consumption_per_100 !== null && typeof item.consumption_per_100 !== 'string') ||
            (item.energy_price !== null && typeof item.energy_price !== 'string')))) {
        throw new Error(storageText('invalidDuplicate'));
      }
      vehicleIds.add(item.id);
      return {
        id: item.id,
        ...validator.vehicle(item),
        archived: current || v6 || v5 ? item.archived : false
      };
    });
    const maintenance = data.maintenance.map(item => {
      if (!exactKeys(item, ['id', 'vehicle_id', 'performed_on', 'odometer', 'title', 'description', 'cost']) ||
          !validId(item.id) || entryIds.has(item.id) || !vehicleIds.has(item.vehicle_id) ||
          typeof item.description !== 'string' || (item.cost !== null && typeof item.cost !== 'string' && typeof item.cost !== 'number')) {
        throw new Error(storageText('invalidMaintenanceEntry'));
      }
      entryIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.maintenance(item) };
    });
    const noteIds = new Set();
    const notes = (legacy ? [] : data.notes).map(item => {
      const hasImportant = current || v6 || v5 || v4;
      const keys = hasImportant ? ['id', 'vehicle_id', 'title', 'content', 'important'] : ['id', 'vehicle_id', 'title', 'content'];
      if (!exactKeys(item, keys) || (hasImportant && typeof item.important !== 'boolean') ||
          !validId(item.id) || noteIds.has(item.id) || !vehicleIds.has(item.vehicle_id)) {
        throw new Error(storageText('invalidDuplicateNote'));
      }
      noteIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.note(item), important: hasImportant ? item.important : false };
    });
    const reminderIds = new Set();
    const reminders = (current || v6 || v5 || v4 || prior ? data.reminders : []).map(item => {
      if (!exactKeys(item, ['id', 'vehicle_id', 'title', 'due_date', 'due_odometer']) ||
          !validId(item.id) || reminderIds.has(item.id) || !vehicleIds.has(item.vehicle_id) ||
          (item.due_date !== null && typeof item.due_date !== 'string') ||
          (item.due_odometer !== null && typeof item.due_odometer !== 'number')) {
        throw new Error(storageText('invalidScheduledEntry'));
      }
      reminderIds.add(item.id);
      return { id: item.id, vehicle_id: item.vehicle_id, ...validator.reminder(item) };
    });
    return { version: 7, vehicles, maintenance, notes, reminders };
  }

  function parse(json) {
    let data;
    try { data = JSON.parse(json); } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      throw new Error(storageText('fileContain'));
    }
    return validateData(data);
  }

  function mergeData(current, incoming) {
    function index(items, key) {
      const entries = new Map();
      for (const item of items) {
        const value = key(item);
        if (!entries.has(value)) entries.set(value, []);
        entries.get(value).push(item);
      }
      return entries;
    }
    function vehicleKey(vehicle) {
      return JSON.stringify(vehicle.license_plate
        ? ['plaat', vehicle.license_plate]
        : ['zonder plaat', vehicle.name, vehicle.make, vehicle.model]);
    }
    function mergeItems(existing, additions, key, textFields, transform = item => item, onMatch = () => {}) {
      const entries = index(existing, key), matched = new Set();
      let next = existing.reduce((max, item) => Math.max(max, item.id), 0);
      for (const addition of additions) {
        const item = transform(addition), value = key(item), matches = entries.get(value) ?? [];
        if (matches.length > 1 || (matches.length === 1 && matched.has(matches[0]))) {
          throw new Error(storageText('cannotMerge'));
        }
        let target = matches[0];
        if (target) {
          for (const field of textFields) {
            if (item[field].length > target[field].length) target[field] = item[field];
          }
        } else {
          if (next >= MAX_ID) throw new Error(storageText('newIds'));
          target = { ...item, id: ++next };
          existing.push(target);
          entries.set(value, [target]);
        }
        matched.add(target);
        onMatch(addition, target);
      }
    }
    const vehicleIds = new Map();
    mergeItems(current.vehicles, incoming.vehicles, vehicleKey, ['name', 'type', 'make', 'model', 'license_plate'],
      item => item, (source, target) => {
        vehicleIds.set(source.id, target.id);
        if (target.consumption_per_100 === null) {
          target.energy_type = source.energy_type;
          if (source.consumption_per_100 !== null) {
            target.consumption_per_100 = source.consumption_per_100;
            target.energy_price = source.energy_price;
          }
        }
      });
    const withVehicle = item => ({ ...item, vehicle_id: vehicleIds.get(item.vehicle_id) });
    mergeItems(current.maintenance, incoming.maintenance,
      item => JSON.stringify([item.vehicle_id, item.performed_on, item.odometer, item.title]),
      ['description'], withVehicle);
    mergeItems(current.notes, incoming.notes,
      item => JSON.stringify([item.vehicle_id, item.title]), ['content'], withVehicle);
    mergeItems(current.reminders, incoming.reminders,
      item => JSON.stringify([item.vehicle_id, item.title]), [], withVehicle);
    return validateData(current);
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
      if (id > MAX_ID) throw new Error(storageText('newIds'));
      return id;
    }
    function findVehicle(data, id) {
      const vehicle = data.vehicles.find(item => item.id === id);
      if (!vehicle) throw new Error(storageText('vehicleFound'));
      return vehicle;
    }
    function findEntry(data, vehicleId, id) {
      const entry = data.maintenance.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!entry) throw new Error(storageText('maintenanceEntry'));
      return entry;
    }
    function findNote(data, vehicleId, id) {
      const note = data.notes.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!note) throw new Error(storageText('noteFound'));
      return note;
    }
    function findReminder(data, vehicleId, id) {
      const reminder = data.reminders.find(item => item.vehicle_id === vehicleId && item.id === id);
      if (!reminder) throw new Error(storageText('scheduledMaintenance'));
      return reminder;
    }
    return {
      read,
      getLastView() {
        const value = storage.getItem(VIEW_KEY);
        if (value === null) return 'vehicle';
        if (value !== 'vehicle' && value !== 'overview') throw new Error(storageText('savedView'));
        return value;
      },
      setLastView(view) {
        if (view !== 'vehicle' && view !== 'overview') throw new Error(storageText('invalidView'));
        storage.setItem(VIEW_KEY, view);
      },
      getSelectedVehicleId() {
        const value = storage.getItem(SELECTION_KEY);
        if (value === null || value === 'null') return null;
        if (!/^[1-9]\d*$/.test(value) || !validId(Number(value))) {
          throw new Error(storageText('savedVehicle'));
        }
        return Number(value);
      },
      setSelectedVehicleId(id) {
        if (id !== null && !validId(id)) throw new Error(storageText('invalidVehicleSelection'));
        storage.setItem(SELECTION_KEY, String(id));
      },
      importJson(json) { const data = parse(json); write(data); },
      mergeJson(json) { const data = mergeData(read(), parse(json)); write(data); },
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
        const data = read();
        const existing = id === null ? null : findVehicle(data, id);
        const fields = validator.vehicle(existing && input?.service_interval_km === undefined
          ? { ...input, service_interval_km: existing.service_interval_km } : input);
        let vehicle;
        if (id === null) {
          vehicle = { id: nextId(data.vehicles), ...fields, archived: false };
          data.vehicles.push(vehicle);
        } else {
          vehicle = existing;
          Object.assign(vehicle, fields);
        }
        write(data);
        return vehicle;
      },
      setVehicleArchived(id, archived) {
        if (typeof archived !== 'boolean') throw new Error(storageText('invalidArchive'));
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
        if (typeof important !== 'boolean') throw new Error(storageText('invalidImportant'));
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
