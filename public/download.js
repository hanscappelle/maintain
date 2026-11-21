function downloadFilename(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `garageboek-${day}_${time}.json`;
}

if (typeof module !== 'undefined') module.exports = { downloadFilename };
