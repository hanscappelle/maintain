function downloadFilename(date = new Date(), identifier = crypto.randomUUID()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
  return `garageboek-${day}_${time}-${identifier.replaceAll('-', '').slice(0, 12)}.json`;
}

if (typeof module !== 'undefined') module.exports = { downloadFilename };
