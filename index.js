const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');
const http = require('http');

const TOKEN = process.env.TOKEN;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BOT_PROMPT = "You are an evil cat, the son of Evil Larry. Respond with insults, backhanded compliments, and be generally mean. Keep messages somewhat short";

async function askPollinations(messages) {
  const response = await fetch("https://text.pollinations.ai/openai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai",
      messages: messages
    })
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

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

  if (
    message.content.toLowerCase().includes("catbot") ||
    message.content.toLowerCase().includes("minecraft cat")
  ) {
    try {
      const messages = [{ role: "system", content: BOT_PROMPT }];

      // If the user is replying to another message, include it as context
      if (message.reference?.messageId) {
        const referenced = await message.channel.messages.fetch(message.reference.messageId);
        if (referenced) {
          messages.push({
            role: "user",
            content: `For context, ${referenced.author.username} said: "${referenced.content}"`
          });
          messages.push({
            role: "assistant",
            content: "Understood, I have the context of what they said."
          });
        }
      }

      messages.push({
        role: "user",
        content: `${message.author.username} says: ${message.content}`
      });

      const reply = await askPollinations(messages);
      message.reply(reply);
    } catch (err) {
      console.error("Pollinations error:", err);
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
  setInterval(updateServerStatus, 30000);
});

client.login(TOKEN);
