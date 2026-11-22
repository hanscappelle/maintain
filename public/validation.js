const validationText = typeof module !== 'undefined' ? require('./i18n').create('nl').t : garageI18n.t;

function text(value, name, maxLength, required = false) {
  if (typeof value !== 'string') throw new Error(validationText('mustText', { name }));
  const result = value.trim();
  if (required && !result) throw new Error(validationText('required', { name }));
  if (result.length > maxLength || (name === validationText('notes') && new TextEncoder().encode(result).length > 65535)) throw new Error(validationText('tooLong', { name }));
  return result;
}

function vehicle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(validationText('invalidVehicle'));
  const energyType = input.energy_type ?? 'fuel';
  if (energyType !== 'fuel' && energyType !== 'electric') throw new Error(validationText('chooseFuel'));
  function decimal(value, name, maxIntegerDigits, maxFractionDigits, minimum, maximum) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    const expression = new RegExp(`^\\d{1,${maxIntegerDigits}}([.,]\\d{1,${maxFractionDigits}})?$`);
    if (!expression.test(raw)) throw new Error(validationText('enterValid', { name }));
    const number = Number(raw.replace(',', '.'));
    if (number < minimum || number > maximum) throw new Error(validationText('enterValid', { name }));
    return raw.replace(',', '.');
  }
  const consumption = decimal(input.consumption_per_100, validationText('averageConsumption3'), 4, 2, 0.01, 1000);
  const energyPrice = decimal(input.energy_price, validationText('energyPrice'), 6, 3, 0, 999999);
  const rawInterval = input.service_interval_km === undefined ? 10000 : input.service_interval_km;
  if ((typeof rawInterval !== 'number' && typeof rawInterval !== 'string') ||
      !/^\d+$/.test(String(rawInterval)) ||
      !Number.isSafeInteger(Number(rawInterval)) || Number(rawInterval) < 1 || Number(rawInterval) > 4294967295) {
    throw new Error(validationText('invalidServiceInterval'));
  }
  return {
    name: text(input.name, validationText('name'), 120, true),
    type: text(input.type, validationText('type'), 50, true),
    make: text(input.make ?? '', validationText('make'), 80),
    model: text(input.model ?? '', validationText('model'), 80),
    license_plate: text(input.license_plate ?? '', validationText('registrationNumber'), 30),
    energy_type: energyType,
    consumption_per_100: consumption,
    energy_price: energyPrice,
    service_interval_km: Number(rawInterval)
  };
}

function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(validationText('enterValidDate'));
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1000-01-01') {
    throw new Error(validationText('enterValidDate'));
  }
  return date;
}

function validateOdometer(rawOdometer) {
  if ((typeof rawOdometer !== 'number' && typeof rawOdometer !== 'string') ||
      String(rawOdometer).trim() === '' || !/^\d+$/.test(String(rawOdometer))) {
    throw new Error(validationText('odometerReadingMust'));
  }
  const odometer = Number(rawOdometer);
  if (!Number.isSafeInteger(odometer) || odometer > 4294967295) throw new Error(validationText('odometerReadingToo'));
  return odometer;
}

function maintenance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(validationText('invalidMaintenance'));
  const date = validateDate(input.performed_on);
  const odometer = validateOdometer(input.odometer);
  let cost = null;
  if (input.cost !== null && input.cost !== undefined && input.cost !== '') {
    const raw = String(input.cost);
    if (!/^\d{1,8}([.,]\d{1,2})?$/.test(raw)) throw new Error(validationText('enterValidAmount'));
    cost = raw.replace(',', '.');
  }
  return {
    performed_on: date,
    odometer,
    title: text(input.title, validationText('workPerformed'), 160, true),
    description: text(input.description ?? '', validationText('notes'), 65535),
    cost
  };
}

function note(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(validationText('invalidNote'));
  return {
    title: text(input.title, validationText('title'), 120, true),
    content: text(input.content, validationText('note'), 10000, true)
  };
}

function reminder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(validationText('invalidScheduled'));
  const dueDate = input.due_date === '' || input.due_date === null ? null : validateDate(input.due_date);
  const dueOdometer = input.due_odometer === '' || input.due_odometer === null ? null : validateOdometer(input.due_odometer);
  if (dueDate === null && dueOdometer === null) throw new Error(validationText('enterDate'));
  return { title: text(input.title, validationText('maintenance3'), 160, true), due_date: dueDate, due_odometer: dueOdometer };
}

const validation = { vehicle, maintenance, note, reminder };
if (typeof module !== 'undefined') module.exports = validation;
