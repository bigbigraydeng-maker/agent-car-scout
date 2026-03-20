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
  console.log('='.repeat(60));
  console.log('🚀 发送 Car Scout 最新报告到飞书 (v3.1)');
  console.log('='.repeat(60));

  // 1. Get token
  console.log('\n📋 步骤 1: 获取飞书 Token...');
  var tokenRes = await req({
    hostname: 'open.feishu.cn',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { app_id: APP_ID, app_secret: APP_SECRET });

  if (tokenRes.code !== 0) {
    console.error('❌ Token 获取失败:', tokenRes);
    return;
  }
  var token = tokenRes.tenant_access_token;
  console.log('✅ Token 获取成功');

  // 2. Load latest report
  console.log('\n📂 步骤 2: 加载最新报告...');
  var dataDir = path.join(__dirname, 'data');
  var reportPath = path.join(dataDir, 'report_20260303_final_full.md');

  if (!fs.existsSync(reportPath)) {
    console.error('❌ 未找到报告文件:', reportPath);
    return;
  }

  var report = fs.readFileSync(reportPath, 'utf8');
  console.log('✅ 报告加载成功 (长度:', report.length, '字符)');

  // 3. Send to user via open_id
  console.log('\n📤 步骤 3: 发送到飞书...');
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

  console.log('   将分', parts.length, '部分发送');

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

    console.log('   第', p + 1, '部分:', sendRes.code === 0 ? '✅ 成功' : '❌ 失败 ' + sendRes.code + ' ' + sendRes.msg);

    if (sendRes.code !== 0) {
      console.error('   错误详情:', JSON.stringify(sendRes, null, 2));
    }

    if (p < parts.length - 1) {
      await new Promise(function(r) { setTimeout(r, 1500); });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ 飞书发送完成！');
  console.log('='.repeat(60));
}

run().catch(function(e) { console.error('❌ 发送过程出错:', e); });
