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

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

const BOT_PROMPT = "You are an evil and mean cat. Respond with slight insults, backhanded compliments, and be generally snarky.";

// Track cooldowns per user
const lastMessageTime = new Map();

// Prevent duplicate replies per message
const processingMessages = new Set();

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

  const content = message.content.toLowerCase();
  if (!content.includes("catbot") && !content.includes("minecraft cat")) return;

  // Prevent duplicate handling of same message
  if (processingMessages.has(message.id)) return;
  processingMessages.add(message.id);

  // Cooldown (1 second per user)
  const now = Date.now();
  const last = lastMessageTime.get(message.author.id) || 0;
  if (now - last < 1000) {
    processingMessages.delete(message.id);
    return;
  }
  lastMessageTime.set(message.author.id, now);

  let replied = false;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: BOT_PROMPT },
        { role: "user", content: message.content }
      ]
    });

    const reply = response.choices?.[0]?.message?.content;

    if (!reply) throw new Error("No reply returned from OpenAI");

    await message.reply(reply);
    replied = true;

  } catch (err) {
    console.error("ChatGPT error:", err);

    if (!replied) {
      await message.reply("Sorry, I couldn't process that message.");
    }
  } finally {
    // Clean up so memory doesn't grow forever
    processingMessages.delete(message.id);
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
  setInterval(updateServerStatus, 30000);
});

client.login(TOKEN);
