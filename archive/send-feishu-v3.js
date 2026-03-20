/**
 * 发送v3.1报告到飞书
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const APP_ID = 'cli_a917a9e3af391cbb';
const APP_SECRET = 'JbyS6Xdb1ZuMe6BmXbi9XbGByUkzW7HU';
const USER_OPEN_ID = 'ou_0d858408be4697d6e84aa225ed758373';

function req(options, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(options, (res) => {
      const d = [];
      res.on('data', c => d.push(c));
      res.on('end', () => {
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
  // 1. 获取token
  const tokenRes = await req({
    hostname: 'open.feishu.cn',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { app_id: APP_ID, app_secret: APP_SECRET });

  if (tokenRes.code !== 0) {
    console.error('Token failed:', tokenRes);
    return;
  }
  const token = tokenRes.tenant_access_token;
  console.log('Token OK');

  // 2. 加载最新v3报告
  const dataDir = path.join('C:', 'Users', 'Zhong', '.openclaw', 'workspace', 'skills', 'car-scout', 'data');
  const reports = fs.readdirSync(dataDir)
    .filter(f => f.match(/^report_\d{8}_flip_v3_full\.md$/))
    .sort().reverse();
  
  if (reports.length === 0) {
    console.error('No v3 report found');
    return;
  }
  
  const reportPath = path.join(dataDir, reports[0]);
  let report = fs.readFileSync(reportPath, 'utf8');
  console.log('Report:', reports[0], '| length:', report.length);

  // 添加v3.1标识
  report = '🚗 Car Scout v3.1 优化版日报\n' + report;
  report += '\n\n💡 v3.1优化特性:\n';
  report += '• 价格预测模型 (89.59%准确率)\n';
  report += '• 最低净利润门槛 15%\n';
  report += '• 动态建议出价 (每辆车不同)\n';
  report += '• 差异化目标利润率\n';

  // 3. 分段发送
  const MAX = 4000;
  const parts = [];
  if (report.length <= MAX) {
    parts.push(report);
  } else {
    const lines = report.split('\n');
    let cur = '';
    for (const line of lines) {
      if (cur.length + line.length + 1 > MAX && cur.length > 0) {
        parts.push(cur);
        cur = line;
      } else {
        cur = cur ? cur + '\n' + line : line;
      }
    }
    if (cur) parts.push(cur);
  }

  console.log('Sending', parts.length, 'part(s)...');

  for (let p = 0; p < parts.length; p++) {
    const sendRes = await req({
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

    console.log('Part', p + 1, ':', sendRes.code === 0 ? 'OK' : 'ERROR ' + sendRes.code);

    if (p < parts.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('\n✅ 报告已发送到飞书!');
}

run().catch(e => console.error(e));
