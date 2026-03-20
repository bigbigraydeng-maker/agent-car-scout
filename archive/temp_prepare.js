const fs = require('fs');
const fb = JSON.parse(fs.readFileSync('data/fb_search_all.json'));
const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
const data = {
  scrapeDate: new Date().toISOString(),
  totalCount: fb.totalCount,
  vehicles: fb.vehicles
};
fs.writeFileSync(`data/vehicles_${today}.json`, JSON.stringify(data, null, 2));
console.log('Created:', `data/vehicles_${today}.json`);
