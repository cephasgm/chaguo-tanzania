const { Telegraf } = require('telegraf');

const bot = new Telegraf('7755870093:AAEdv6vOw-d1PmL08h44WHntMBi0HOCgDCA');

bot.start((ctx) => {
  ctx.reply(
    'Welcome to Chaguo Tanzania! 🇹🇿\n\n' +
    'Get VPN configurations to bypass internet restrictions.\n\n' +
    'Commands:\n' +
    '/config - Get VPN configuration\n' +
    '/help - Show help message'
  );
});

bot.command('config', (ctx) => {
  const config = {
    server: "server1.kenya.chaguo.tz",
    port: 443,
    protocol: "v2ray-ws",
    userId: "b831381d-6324-4d53-ad4f-8cda48b30811",
    alterId: 0
  };
  
  ctx.reply(
    `Your Chaguo Configuration:\n\n` +
    `Server: ${config.server}\n` +
    `Port: ${config.port}\n` +
    `Protocol: ${config.protocol}\n` +
    `User ID: \`${config.userId}\`\n\n` +
    'Copy this to your VPN client.',
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', (ctx) => {
  ctx.reply(
    'Need help?\n\n' +
    '1. Use /config to get configuration\n' +
    '2. Import to v2rayN or similar client\n' +
    '3. Connect and enjoy!\n\n' +
    'Website: https://cephasgm.github.io/chaguo-tanzania/'
  );
});

// Start bot
bot.launch().then(() => {
  console.log('Chaguo Telegram Bot started');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
