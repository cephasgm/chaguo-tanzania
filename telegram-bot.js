const { Telegraf } = require('telegraf');

// Use environment variable or placeholder
const BOT_TOKEN = process.env.BOT_TOKEN || '7755870093:AAEdv6vOw-d1PmL08h44WHntMBi0HOCgDCA';
const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    'Welcome to Chaguo Tanzania! 🇹🇿\n\n' +
    'Commands:\n' +
    '/config - Get VPN configuration\n' +
    '/help - Show help message\n' +
    '/about - About Chaguo project'
  );
});

bot.command('config', (ctx) => {
  const config = {
    server: 'server1.kenya.chaguo.tz',
    port: 443,
    protocol: 'v2ray-ws',
    userId: 'b831381d-6324-4d53-ad4f-8cda48b30811',
    alterId: 0
  };
  
  ctx.reply(
    'Your Chaguo Configuration:\n\n' +
    `Server: ${config.server}\n` +
    `Port: ${config.port}\n` +
    `Protocol: ${config.protocol}\n` +
    `User ID: \`${config.userId}\`\n\n` +
    'Copy this configuration to your VPN client.',
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', (ctx) => {
  ctx.reply(
    'Need help setting up?\n\n' +
    '1. Download v2rayN client\n' +
    '2. Import configuration\n' +
    '3. Connect and enjoy!\n\n' +
    'Website: https://cephasgm.github.io/chaguo-tanzania/'
  );
});

// Start bot
bot.launch()
  .then(() => console.log('Bot started'))
  .catch(err => console.error('Bot error:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
