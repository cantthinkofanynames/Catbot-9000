const { Client, GatewayIntentBits } = require('discord.js');
const { MinecraftServer } = require('mcping-js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ENV VARIABLES (IMPORTANT)
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = process.env.SERVER_PORT || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;

const server = new MinecraftServer(SERVER_IP, SERVER_PORT);

async function updateServerStatus() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;

  // Wrap mcping-js ping in a promise
  const status = await new Promise((resolve) => {
    server.ping(1000, (err, res) => {
      if (err) return resolve({ online: false });
      resolve({ online: true, res });
    });
  });

  if (!status.online) {
    await channel.setName("🔴 Offline");
  } else {
    const online = status.res.players.online;
    const max = status.res.players.max;
    await channel.setName(`🟢 ${online}/${max}`);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateServerStatus();
  setInterval(updateServerStatus, 30000);
});

client.login(process.env.TOKEN);
