const garageInsights = (() => {
  const dayMs = 86400000;
  function chronologicalEntries(entries, today) {
    return entries.filter(entry => entry.performed_on <= today)
      .sort((a, b) => a.performed_on.localeCompare(b.performed_on) || a.id - b.id);
  }
  function vehicleStats(entries, today) {
    const ordered = chronologicalEntries(entries, today);
    const latest = ordered.at(-1) || null;
    let decrease = false;
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i].odometer < ordered[i - 1].odometer) decrease = true;
    }
    const first = ordered[0];
    const days = latest && first ? (Date.parse(`${latest.performed_on}T00:00:00Z`) - Date.parse(`${first.performed_on}T00:00:00Z`)) / dayMs : 0;
    const distance = days > 0 && !decrease ? latest.odometer - first.odometer : null;
    return { latest, first: first || null, days, distance, perYear: distance === null ? null : distance / days * 365.25, decrease };
  }
  function annualCost(entries, today) {
    const ordered = chronologicalEntries(entries, today);
    const years = new Set(ordered.map(entry => entry.performed_on.slice(0, 4)));
    const knownCosts = ordered.filter(entry => entry.cost !== null);
    const total = knownCosts.reduce((sum, entry) => sum + Number(entry.cost), 0);
    return {
      perYear: knownCosts.length ? total / years.size : null,
      missingCount: ordered.length - knownCosts.length
    };
  }
  function mileageSparkline(entries, today) {
    const ordered = chronologicalEntries(entries, today);
    if (ordered.length < 2 || ordered[0].performed_on === ordered.at(-1).performed_on) return [];
    const start = Date.parse(`${ordered[0].performed_on}T00:00:00Z`);
    const end = Date.parse(`${ordered.at(-1).performed_on}T00:00:00Z`);
    const { min, max } = ordered.reduce((range, entry) => ({
      min: Math.min(range.min, entry.odometer),
      max: Math.max(range.max, entry.odometer)
    }), { min: Infinity, max: -Infinity });
    return ordered.map(entry => ({
      x: 2 + (Date.parse(`${entry.performed_on}T00:00:00Z`) - start) / (end - start) * 96,
      y: min === max ? 20 : 37 - (entry.odometer - min) / (max - min) * 34
    }));
  }
  function mileageAxis(min, max) {
    const padding = Math.max((max - min) * 0.1, 1);
    const paddedMin = Math.max(0, min - padding), paddedMax = max + padding;
    const desiredStep = Math.max(100, (paddedMax - paddedMin) / 4);
    const magnitude = 10 ** Math.floor(Math.log10(desiredStep));
    const fraction = desiredStep / magnitude;
    const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
    const lower = Math.floor(paddedMin / step) * step;
    const upper = Math.ceil(paddedMax / step) * step;
    const ticks = Array.from({ length: Math.round((upper - lower) / step) + 1 }, (_, i) => lower + i * step);
    return { lower, upper, ticks };
  }
  function reminderStatus(reminder, latest, today) {
    const days = reminder.due_date === null ? null :
      (Date.parse(`${reminder.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / dayMs;
    const km = reminder.due_odometer === null || !latest ? null : reminder.due_odometer - latest.odometer;
    const due = (days !== null && days <= 0) || (km !== null && km <= 0);
    const upcoming = (days !== null && days <= 30) || (km !== null && km <= 1000);
    const unknownKm = reminder.due_odometer !== null && !latest;
    return { days, km, status: due ? 'due' : upcoming ? 'upcoming' : unknownKm ? 'unknown' : 'planned' };
  }
  function overviewReminders(vehicles, entries, reminders, today) {
    const rank = { due: 0, upcoming: 1, unknown: 2, planned: 3 };
    const result = [];
    for (const vehicle of vehicles) {
      const latest = vehicleStats(entries.filter(entry => entry.vehicle_id === vehicle.id), today).latest;
      for (const reminder of reminders.filter(item => item.vehicle_id === vehicle.id)) {
        result.push({ vehicle, reminder, latest, ...reminderStatus(reminder, latest, today) });
      }
    }
    result.sort((a, b) => rank[a.status] - rank[b.status]);
    return {
      items: result,
      attentionCount: result.filter(item => item.status === 'due' || item.status === 'upcoming').length
    };
  }
  return { vehicleStats, annualCost, mileageSparkline, mileageAxis, reminderStatus, overviewReminders };
})();
if (typeof module !== 'undefined') module.exports = garageInsights;
