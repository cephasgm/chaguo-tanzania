// Quick test script for Tanzania
const https = require('https');

const tests = [
  { url: 'https://google.com', name: 'Google' },
  { url: 'https://api.ipify.org', name: 'IP Check' },
  { url: 'https://1.1.1.1', name: 'Cloudflare DNS' }
];

console.log('Testing from Tanzania...\n');

tests.forEach(test => {
  const start = Date.now();
  
  const req = https.get(test.url, (res) => {
    const latency = Date.now() - start;
    console.log(`✅ ${test.name}: HTTP ${res.statusCode} (${latency}ms)`);
  });
  
  req.on('error', (err) => {
    console.log(`❌ ${test.name}: ${err.message}`);
  });
  
  req.setTimeout(10000, () => {
    req.destroy();
    console.log(`⏱️ ${test.name}: Timeout`);
  });
});
