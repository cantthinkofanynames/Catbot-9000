const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');
const OpenAI = require("openai");
const http = require('http');

const TOKEN = process.env.TOKEN;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI.OpenAI({
  apiKey: OPENAI_API_KEY
});

const BOT_PROMPT = "You are an evil and mean cat. Respond with slight insults, backhanded compliments, and be generally snarky.";

async function updateServerStatus() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    try {
      const res = await status(SERVER_IP, SERVER_PORT, { timeout: 2000 });
      const online = res.players.online;
      const max = res.players.max;
      await channel.setName(`🟢 ${online}/${max}`);
    } catch {
      await channel.setName("🔴 Offline");
    }
  } catch (err) {
    console.error("Failed to update channel:", err);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Respond to one or more keywords
  if (
    message.content.toLowerCase().includes("catbot") ||
    message.content.toLowerCase().includes("minecraft cat")
  ) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: BOT_PROMPT },
          { role: "user", content: message.content }
        ]
      });

      const reply = response.choices[0].message.content;
      message.reply(reply);
    } catch (err) {
      console.error("ChatGPT error:", err);
      message.reply("Sorry, I couldn't process that message.");
    }
  }
});

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Catbot is running!");
}).listen(PORT, () => console.log(`Listening on port ${PORT}`));

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  updateServerStatus();
  setInterval(updateServerStatus, 30000); // update every 30s
});

client.login(TOKEN);
