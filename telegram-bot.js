const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const crypto = require('crypto');

class ChaguoBot {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN || '7755870093:AAEdv6vOw-d1PmL08h44WHntMBi0HOCgDCA');
    this.users = new Map();
    this.configs = new Map();
    this.stats = {
      totalUsers: 0,
      activeToday: 0,
      configsSent: 0,
      errors: 0
    };
    
    this.init();
  }

  init() {
    this.loadConfigs();
    this.setupCommands();
    this.setupHandlers();
    this.start();
  }

  async loadConfigs() {
    try {
      // Load configs from multiple sources
      const sources = [
        'https://raw.githubusercontent.com/cephasgm/chaguo-tanzania/main/configs/latest.json',
        'https://cdn.jsdelivr.net/gh/cephasgm/chaguo-tanzania@main/configs/latest.json'
      ];
      
      for (const source of sources) {
        const response = await axios.get(source);
        const configs = response.data;
        
        // Process and store configs
        this.processConfigs(configs);
      }
      
      console.log(`Loaded ${this.configs.size} configurations`);
      
    } catch (error) {
      console.error('Failed to load configs:', error.message);
    }
  }

  processConfigs(configs) {
    if (!configs || !configs.servers) return;
    
    configs.servers.forEach(server => {
      const configId = this.generateConfigId(server);
      this.configs.set(configId, {
        ...server,
        id: configId,
        added: Date.now(),
        usage: 0
      });
    });
  }

  generateConfigId(server) {
    const hash = crypto.createHash('md5');
    hash.update(`${server.host}:${server.port}:${server.protocol}`);
    return hash.digest('hex').substring(0, 8);
  }

  setupCommands() {
    // Start command
    this.bot.command('start', (ctx) => {
      const userId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name;
      
      this.registerUser(userId, username);
      
      ctx.reply(
        `👋 Welcome *${username}* to Chaguo Tanzania! 🇹🇿\n\n` +
        `I'm here to help you bypass internet restrictions in Tanzania.\n\n` +
        `*Available Commands:*\n` +
        `/config - Get latest VPN configuration\n` +
        `/status - Check server status\n` +
        `/help - Show help message\n` +
        `/about - About Chaguo project\n\n` +
        `Click the buttons below to get started!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('📱 Get Config', 'get_config')],
            [Markup.button.callback('🌐 Server Status', 'server_status')],
            [Markup.button.callback('❓ Help', 'help')],
            [Markup.button.callback('ℹ️ About', 'about')]
          ])
        }
      );
    });
    
    // Config command
    this.bot.command('config', async (ctx) => {
      await this.sendConfig(ctx);
    });
    
    // Status command
    this.bot.command('status', (ctx) => {
      this.sendStatus(ctx);
    });
    
    // Help command
    this.bot.command('help', (ctx) => {
      ctx.reply(
        `*Chaguo Bot Help* 🤖\n\n` +
        `*Commands:*\n` +
        `/start - Start the bot\n` +
        `/config - Get VPN configuration\n` +
        `/status - Check server status\n` +
        `/help - Show this message\n` +
        `/about - About the project\n\n` +
        `*Features:*\n` +
        `• Daily updated configurations\n` +
        `• Multiple protocol support\n` +
        `• Server status monitoring\n` +
        `• Quick setup guides\n\n` +
        `*Need more help?*\n` +
        `Visit our website: https://cephasgm.github.io/chaguo-tanzania/`,
        { parse_mode: 'Markdown' }
      );
    });
    
    // About command
    this.bot.command('about', (ctx) => {
      ctx.reply(
        `*Chaguo Tanzania* 🇹🇿\n\n` +
        `An open-source internet freedom toolkit for Tanzania.\n\n` +
        `*Mission:*\n` +
        `To provide reliable and secure internet access for all Tanzanians.\n\n` +
        `*Features:*\n` +
        `• Multiple bypass methods\n` +
        `• Daily updated configs\n` +
        `• User-friendly tools\n` +
        `• Community support\n\n` +
        `*Links:*\n` +
        `🌐 Website: https://cephasgm.github.io/chaguo-tanzania/\n` +
        `💻 GitHub: https://github.com/cephasgm/chaguo-tanzania\n` +
        `📱 Desktop App: https://cephasgm.github.io/chaguo-tanzania/desktop-app/\n\n` +
        `*Disclaimer:*\n` +
        `For educational purposes only. Use responsibly.`,
        { parse_mode: 'Markdown' }
      );
    });
  }

  setupHandlers() {
    // Handle callback queries
    this.bot.action('get_config', async (ctx) => {
      await ctx.answerCbQuery();
      await this.sendConfig(ctx);
    });
    
    this.bot.action('server_status', async (ctx) => {
      await ctx.answerCbQuery();
      this.sendStatus(ctx);
    });
    
    this.bot.action('help', async (ctx) => {
      await ctx.answerCbQuery();
      ctx.reply(
        `Need help? Here are some tips:\n\n` +
        `1. Use /config to get latest configuration\n` +
        `2. Import config to your VPN client\n` +
        `3. If one server doesn't work, try another\n` +
        `4. Check /status for server availability\n\n` +
        `For detailed guides, visit our website.`,
        Markup.inlineKeyboard([
          [Markup.button.url('📖 Visit Website', 'https://cephasgm.github.io/chaguo-tanzania/')]
        ])
      );
    });
    
    this.bot.action('about', async (ctx) => {
      await ctx.answerCbQuery();
      ctx.reply(
        `Chaguo means "Choice" in Swahili.\n\n` +
        `We believe everyone deserves the choice to access information freely and securely.\n\n` +
        `Join us in fighting for internet freedom in Tanzania!`,
        Markup.inlineKeyboard([
          [Markup.button.url('🌟 Star on GitHub', 'https://github.com/cephasgm/chaguo-tanzania')]
        ])
      );
    });
    
    // Handle protocol selection
    this.bot.action(/protocol_(.+)/, async (ctx) => {
      const protocol = ctx.match[1];
      await ctx.answerCbQuery(`Selected: ${protocol}`);
      await this.sendConfigForProtocol(ctx, protocol);
    });
    
    // Handle config selection
    this.bot.action(/config_(.+)/, async (ctx) => {
      const configId = ctx.match[1];
      await ctx.answerCbQuery('Sending configuration...');
      await this.sendSpecificConfig(ctx, configId);
    });
    
    // Handle text messages
    this.bot.on('text', (ctx) => {
      const message = ctx.message.text.toLowerCase();
      
      if (message.includes('vpn') || message.includes('config')) {
        ctx.reply(
          'Looking for VPN configurations? Use /config command or click the button below!',
          Markup.inlineKeyboard([
            [Markup.button.callback('📱 Get Config', 'get_config')]
          ])
        );
      } else if (message.includes('help') || message.includes('problem')) {
        ctx.reply(
          'Having issues? Try these:\n1. Use different protocol\n2. Try different server\n3. Check server status with /status\n\nOr visit our website for detailed guides.',
          Markup.inlineKeyboard([
            [Markup.button.url('Visit Help Page', 'https://cephasgm.github.io/chaguo-tanzania/#help')]
          ])
        );
      }
    });
  }

  registerUser(userId, username) {
    if (!this.users.has(userId)) {
      this.users.set(userId, {
        id: userId,
        username: username,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        configsReceived: 0,
        requests: 0
      });
      
      this.stats.totalUsers++;
      this.stats.activeToday++;
      
      console.log(`New user registered: ${username} (${userId})`);
    } else {
      const user = this.users.get(userId);
      user.lastSeen = Date.now();
      user.requests++;
      this.users.set(userId, user);
    }
  }

  async sendConfig(ctx) {
    const userId = ctx.from.id;
    this.registerUser(userId, ctx.from.username || ctx.from.first_name);
    
    // Check rate limiting
    if (this.isRateLimited(userId)) {
      ctx.reply(
        '⚠️ Please wait before requesting another configuration.\nTry again in 5 minutes.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Send protocol selection
    ctx.reply(
      '*Select Protocol:* 🔧\n\n' +
      'Choose the protocol you want to use:',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('V2Ray', 'protocol_v2ray'),
            Markup.button.callback('Shadowsocks', 'protocol_shadowsocks')
          ],
          [
            Markup.button.callback('WireGuard', 'protocol_wireguard'),
            Markup.button.callback('Trojan', 'protocol_trojan')
          ],
          [Markup.button.callback('Auto Select', 'protocol_auto')]
        ])
      }
    );
  }

  async sendConfigForProtocol(ctx, protocol) {
    const userId = ctx.from.id;
    const availableConfigs = Array.from(this.configs.values())
      .filter(config => 
        protocol === 'auto' || 
        config.protocols?.includes(protocol) || 
        config.protocol === protocol
      )
      .slice(0, 5); // Show only 5 configs
    
    if (availableConfigs.length === 0) {
      ctx.reply(
        `⚠️ No configurations available for *${protocol}*.\n` +
        `Try a different protocol or use Auto Select.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Create buttons for each config
    const buttons = availableConfigs.map(config => [
      Markup.button.callback(
        `${config.name || config.host} (${config.region || 'Global'})`,
        `config_${config.id}`
      )
    ]);
    
    buttons.push([Markup.button.callback('« Back to Protocols', 'get_config')]);
    
    ctx.reply(
      `*Available Configurations for ${protocol}:* 🌐\n\n` +
      `Select a server to get configuration:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  }

  async sendSpecificConfig(ctx, configId) {
    const config = this.configs.get(configId);
    
    if (!config) {
      ctx.reply('⚠️ Configuration not found. Please try again.');
      return;
    }
    
    // Update usage stats
    config.usage = (config.usage || 0) + 1;
    this.configs.set(configId, config);
    
    // Update user stats
    const userId = ctx.from.id;
    const user = this.users.get(userId);
    if (user) {
      user.configsReceived++;
      this.users.set(userId, user);
    }
    
    // Update bot stats
    this.stats.configsSent++;
    
    // Generate config message
    const configMessage = this.generateConfigMessage(config);
    
    // Send config
    ctx.reply(configMessage, { parse_mode: 'Markdown' });
    
    // Send additional instructions
    setTimeout(() => {
      ctx.reply(
        `*How to Use:* 📖\n\n` +
        `1. Copy the configuration above\n` +
        `2. Import into your VPN client\n` +
        `3. Connect and enjoy!\n\n` +
        `*Need Help?*\n` +
        `• Visit our website for tutorials\n` +
        `• Use /help for more commands\n` +
        `• Try different servers if one doesn't work\n\n` +
        `*This configuration expires in 24 hours.*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.url('🌐 Visit Website', 'https://cephasgm.github.io/chaguo-tanzania/')],
            [Markup.button.callback('🔄 Get Another Config', 'get_config')]
          ])
        }
      );
    }, 1000);
  }

  generateConfigMessage(config) {
    const timestamp = new Date().toISOString();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    let configText = `*Configuration Details:* 🔧\n\n`;
    configText += `*Server:* ${config.host}\n`;
    configText += `*Port:* ${config.port}\n`;
    configText += `*Protocol:* ${config.protocol || config.protocols?.join(', ')}\n`;
    
    if (config.password) {
      configText += `*Password:* \`${config.password}\`\n`;
    }
    
    if (config.userId) {
      configText += `*User ID:* \`${config.userId}\`\n`;
    }
    
    if (config.method) {
      configText += `*Method:* ${config.method}\n`;
    }
    
    if (config.path) {
      configText += `*Path:* ${config.path}\n`;
    }
    
    if (config.hostname) {
      configText += `*Hostname:* ${config.hostname}\n`;
    }
    
    configText += `\n*Region:* ${config.region || 'Global'}\n`;
    configText += `*Status:* ✅ Active\n`;
    configText += `*Generated:* ${timestamp}\n`;
    configText += `*Expires:* ${expiry}\n\n`;
    
    configText += `*Config String:*\n\`\`\`\n${JSON.stringify(config, null, 2)}\n\`\`\``;
    
    return configText;
  }

  sendStatus(ctx) {
    const activeConfigs = Array.from(this.configs.values())
      .filter(config => config.usage !== undefined)
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 5);
    
    let statusMessage = `*Server Status Report:* 📊\n\n`;
    statusMessage += `*Total Configurations:* ${this.configs.size}\n`;
    statusMessage += `*Active Users Today:* ${this.stats.activeToday}\n`;
    statusMessage += `*Configs Sent Total:* ${this.stats.configsSent}\n\n`;
    
    statusMessage += `*Top Servers:* 🏆\n`;
    activeConfigs.forEach((config, index) => {
      statusMessage += `${index + 1}. ${config.host} - ${config.usage || 0} uses\n`;
    });
    
    statusMessage += `\n*Last Updated:* ${new Date().toLocaleString()}\n`;
    statusMessage += `*Bot Uptime:* ${this.formatUptime()}\n\n`;
    statusMessage += `Use /config to get a working configuration!`;
    
    ctx.reply(statusMessage, { parse_mode: 'Markdown' });
  }

  isRateLimited(userId) {
    const user = this.users.get(userId);
    if (!user) return false;
    
    // Check if user has made more than 5 requests in the last minute
    const recentRequests = this.getRecentRequests(userId);
    return recentRequests >= 5;
  }

  getRecentRequests(userId) {
    // In a real implementation, this would track timestamps
    // For now, return a dummy value
    return 0;
  }

  formatUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  start() {
    this.bot.launch()
      .then(() => {
        console.log('Chaguo Telegram Bot is running...');
        this.scheduleDailyTasks();
      })
      .catch(error => {
        console.error('Failed to start bot:', error);
      });
  }

  scheduleDailyTasks() {
    // Reset daily stats at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyStats();
      this.scheduleDailyTasks(); // Reschedule for next day
    }, timeUntilMidnight);
    
    // Update configs every 6 hours
    setInterval(() => {
      this.loadConfigs();
    }, 6 * 60 * 60 * 1000);
  }

  resetDailyStats() {
    this.stats.activeToday = 0;
    console.log('Daily stats reset');
  }

  getStats() {
    return {
      ...this.stats,
      uniqueUsers: this.users.size,
      loadedConfigs: this.configs.size
    };
  }
}

// Create and start bot
const chaguoBot = new ChaguoBot();

// Export for use in other files
module.exports = chaguoBot;

// Handle graceful shutdown
process.once('SIGINT', () => {
  console.log('Shutting down bot...');
  chaguoBot.bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Shutting down bot...');
  chaguoBot.bot.stop('SIGTERM');
});
