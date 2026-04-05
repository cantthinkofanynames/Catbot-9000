const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ENV VARIABLES
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;

async function updateServerStatus() {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;

  try {
    const res = await status(SERVER_IP, SERVER_PORT, { timeout: 2000 });
    const online = res.players.online;
    const max = res.players.max;
    await channel.setName(`🟢 ${online}/${max}`);
  } catch (err) {
    await channel.setName("🔴 Offline");
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateServerStatus();
  setInterval(updateServerStatus, 30000);
});

client.login(process.env.TOKEN);

const http = require('http');

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running');
}).listen(PORT, () => console.log(`Listening on port ${PORT}`));
