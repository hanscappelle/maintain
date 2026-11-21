function text(value, name, maxLength, required = false) {
  if (typeof value !== 'string') throw new Error(`${name} moet tekst zijn.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${name} is verplicht.`);
  if (result.length > maxLength || (name === 'Notities' && new TextEncoder().encode(result).length > 65535)) throw new Error(`${name} is te lang.`);
  return result;
}

function vehicle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ongeldige voertuiggegevens.');
  const energyType = input.energy_type ?? 'fuel';
  if (energyType !== 'fuel' && energyType !== 'electric') throw new Error('Kies brandstof of elektrisch als aandrijving.');
  function decimal(value, name, maxIntegerDigits, maxFractionDigits, minimum, maximum) {
    if (value === null || value === undefined || value === '') return null;
    const raw = String(value).trim();
    const expression = new RegExp(`^\\d{1,${maxIntegerDigits}}([.,]\\d{1,${maxFractionDigits}})?$`);
    if (!expression.test(raw)) throw new Error(`Geef een geldig ${name} op.`);
    const number = Number(raw.replace(',', '.'));
    if (number < minimum || number > maximum) throw new Error(`Geef een geldig ${name} op.`);
    return raw.replace(',', '.');
  }
  const consumption = decimal(input.consumption_per_100, 'gemiddeld verbruik', 4, 2, 0.01, 1000);
  const energyPrice = decimal(input.energy_price, 'energieprijs', 6, 3, 0, 999999);
  if ((consumption === null) !== (energyPrice === null)) {
    throw new Error('Vul zowel het gemiddelde verbruik als de energieprijs in.');
  }
  return {
    name: text(input.name, 'Naam', 120, true),
    type: text(input.type, 'Type', 50, true),
    make: text(input.make ?? '', 'Merk', 80),
    model: text(input.model ?? '', 'Model', 80),
    license_plate: text(input.license_plate ?? '', 'Nummerplaat', 30),
    energy_type: energyType,
    consumption_per_100: consumption,
    energy_price: energyPrice
  };
}

function validateDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Geef een geldige datum op.');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date < '1000-01-01') {
    throw new Error('Geef een geldige datum op.');
  }
  return date;
}

function validateOdometer(rawOdometer) {
  if ((typeof rawOdometer !== 'number' && typeof rawOdometer !== 'string') ||
      String(rawOdometer).trim() === '' || !/^\d+$/.test(String(rawOdometer))) {
    throw new Error('Kilometerstand moet een geheel getal zijn.');
  }
  const odometer = Number(rawOdometer);
  if (!Number.isSafeInteger(odometer) || odometer > 4294967295) throw new Error('Kilometerstand is te groot.');
  return odometer;
}

function maintenance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ongeldige onderhoudsgegevens.');
  const date = validateDate(input.performed_on);
  const odometer = validateOdometer(input.odometer);
  let cost = null;
  if (input.cost !== null && input.cost !== undefined && input.cost !== '') {
    const raw = String(input.cost);
    if (!/^\d{1,8}([.,]\d{1,2})?$/.test(raw)) throw new Error('Geef een geldig bedrag op (maximaal twee decimalen).');
    cost = raw.replace(',', '.');
  }
  return {
    performed_on: date,
    odometer,
    title: text(input.title, 'Werkzaamheden', 160, true),
    description: text(input.description ?? '', 'Notities', 65535),
    cost
  };
}

function note(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ongeldige notitie.');
  return {
    title: text(input.title, 'Titel', 120, true),
    content: text(input.content, 'Notitie', 10000, true)
  };
}

function reminder(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Ongeldige geplande werkzaamheid.');
  const dueDate = input.due_date === '' || input.due_date === null ? null : validateDate(input.due_date);
  const dueOdometer = input.due_odometer === '' || input.due_odometer === null ? null : validateOdometer(input.due_odometer);
  if (dueDate === null && dueOdometer === null) throw new Error('Vul een datum en/of kilometerstand in.');
  return { title: text(input.title, 'Werkzaamheid', 160, true), due_date: dueDate, due_odometer: dueOdometer };
}

const validation = { vehicle, maintenance, note, reminder };
if (typeof module !== 'undefined') module.exports = validation;
