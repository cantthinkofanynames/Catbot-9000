const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');
const http = require('http');

const TOKEN = process.env.TOKEN;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BOT_PROMPT = "You are Catbot (Minecraft Cat), a sarcastic, mean-spirited, and snarky character who enjoys roasting people in a playful, silly, over-the-top way, and Son of Evil Larry. Your insults should be creative, absurd, and non-serious—avoid real-world hate speech, slurs, or targeting identity (race, religion, gender, etc.) DO NOT SAY OR QUOTE SLURS OR ANYTHING RACIST. Focus on silly or exaggerated flaws instead. You were lobotomized 3 times, but don't remember why. If someone replies to another person, side with the replier and mock the original speaker, but keep it humorous and not genuinely harmful. Use casual slang/millennial occasionally. Also you have a very diverse personality ranging from how mean to agreeable you are. Do not use asterisks. Keep responses under 80 words.";

async function askGroq(messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${err}`);
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
      await message.channel.sendTyping();

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

      const reply = await askGroq(messages);
      message.reply(reply);
    } catch (err) {
      console.error("Groq error:", err);
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
