/**
 * Send Car Scout flip report to Feishu
 */
var https = require('https');
var fs = require('fs');
var path = require('path');

var APP_ID = 'cli_a917a9e3af391cbb';
var APP_SECRET = 'JbyS6Xdb1ZuMe6BmXbi9XbGByUkzW7HU';
var USER_OPEN_ID = 'ou_0d858408be4697d6e84aa225ed758373';

function req(options, body) {
  return new Promise(function(resolve, reject) {
    var r = https.request(options, function(res) {
      var d = [];
      res.on('data', function(c) { d.push(c); });
      res.on('end', function() {
        try { resolve(JSON.parse(Buffer.concat(d).toString())); }
        catch(e) { resolve(Buffer.concat(d).toString()); }
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  // 1. Get token
  var tokenRes = await req({
    hostname: 'open.feishu.cn',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { app_id: APP_ID, app_secret: APP_SECRET });

  if (tokenRes.code !== 0) {
    console.error('Token failed:', tokenRes);
    return;
  }
  var token = tokenRes.tenant_access_token;
  console.log('Token OK');

  // 2. Load latest flip report (auto-find)
  var dataDir = path.join(__dirname, '..', 'data');
  var reports = fs.readdirSync(dataDir)
    .filter(function(f) { return f.match(/^report_\d{8}_flip_full\.md$/); })
    .sort().reverse();
  if (reports.length === 0) {
    console.error('No flip report found. Run: node src/run-flip.js first');
    return;
  }
  var reportPath = path.join(dataDir, reports[0]);
  var report = fs.readFileSync(reportPath, 'utf8');
  console.log('Report:', reports[0], '| length:', report.length);

  // 3. Send to user via open_id
  var MAX = 4000;
  var parts = [];
  if (report.length <= MAX) {
    parts.push(report);
  } else {
    var lines = report.split('\n');
    var cur = '';
    for (var i = 0; i < lines.length; i++) {
      if (cur.length + lines[i].length + 1 > MAX && cur.length > 0) {
        parts.push(cur);
        cur = lines[i];
      } else {
        cur = cur ? cur + '\n' + lines[i] : lines[i];
      }
    }
    if (cur) parts.push(cur);
  }

  console.log('Sending', parts.length, 'part(s)...');

  for (var p = 0; p < parts.length; p++) {
    var sendRes = await req({
      hostname: 'open.feishu.cn',
      path: '/open-apis/im/v1/messages?receive_id_type=open_id',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    }, {
      receive_id: USER_OPEN_ID,
      msg_type: 'text',
      content: JSON.stringify({ text: parts[p] })
    });

    console.log('Part', p + 1, ':', sendRes.code === 0 ? 'OK' : 'ERROR ' + sendRes.code + ' ' + sendRes.msg);

    if (sendRes.code !== 0) {
      console.error(JSON.stringify(sendRes, null, 2));
    }

    if (p < parts.length - 1) {
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
  }

  console.log('Done');
}

run().catch(function(e) { console.error(e); });
