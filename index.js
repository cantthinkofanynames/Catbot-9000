const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');
const http = require('http');

const TOKEN = process.env.TOKEN;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

const PING_CHANNEL_ID = process.env.PING_CHANNEL_ID || process.env.CHANNEL_ID;

// How often to ping someone (random between 2 and 5 hours)
const PING_INTERVAL_MIN_MS = 2 * 60 * 60 * 1000;
const PING_INTERVAL_MAX_MS = 5 * 60 * 60 * 1000;

// ---- ADD YOUR USERNAMES HERE ----
// These are Discord usernames (not display names), e.g. "cooluser123"
const PING_USERNAMES = [
  "megoodboi5361",
  "anarwale",
  "fsansg",
  "panzerowisdom",
  "snowyy.yipee",
  "omegared1826",
  "omegared1826"
];
// ---------------------------------

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BOT_PROMPT = "You are Catbot (Minecraft Cat), a sarcastic, mean-spirited, and snarky character who enjoys roasting people in a playful, silly, over-the-top way, and Son of Evil Larry. Your insults should be creative, absurd, and non-serious—avoid real-world hate speech, slurs, or targeting identity (race, religion, gender, etc.) DO NOT SAY OR QUOTE SLURS OR ANYTHING RACIST. Focus on silly or exaggerated flaws instead. Make sure to respond to the message not just their name. Talk like your messaging someone in a group chat, short and to the point. You were lobotomized 3 times, but don't remember why. If someone replies to another person, side with the replier and mock the original speaker, but keep it humorous and not genuinely harmful. Use casual slang/millennial occasionally. Also you have a very diverse personality ranging from how mean to agreeable you are. Do not use asterisks. Keep responses under 40 words. Also, you have access to the past 20 chat messages, so make sure to take them into account in your response and continue the conversation if asked";

const channelHistory = new Map();
const MAX_HISTORY = 20;

function getHistory(channelId) {
  if (!channelHistory.has(channelId)) {
    channelHistory.set(channelId, []);
  }
  return channelHistory.get(channelId);
}

function addToHistory(channelId, username, content) {
  const history = getHistory(channelId);
  history.push(`${username}: ${content}`);
  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

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

async function randomPing() {
  try {
    const channel = await client.channels.fetch(PING_CHANNEL_ID);
    if (!channel || PING_USERNAMES.length === 0) return;

    // Pick a random username from the list
    const username = PING_USERNAMES[Math.floor(Math.random() * PING_USERNAMES.length)];

    // Try to find the member in the guild by username
    const guild = channel.guild;
    const members = await guild.members.fetch({ query: username, limit: 5 });
    const member = members.find(m => m.user.username.toLowerCase() === username.toLowerCase());

    if (!member) {
      console.warn(`Could not find member with username: ${username}`);
      return;
    }

    const history = getHistory(channel.id);
    const historyLog = history.length > 0
      ? `Here are the last ${history.length} messages in the chat for context:\n${history.join("\n")}\n\n`
      : "";

    const messages = [
      { role: "system", content: BOT_PROMPT },
      {
        role: "user",
        content: `${historyLog}You decided to randomly ping ${username} out of nowhere. Say something to them unprompted — roast them, bug them, or just be weird. Address them directly.`
      }
    ];

    const reply = await askGroq(messages);
    addToHistory(channel.id, "Catbot", reply);

    await channel.send(`<@${member.id}> ${reply}`);
  } catch (err) {
    console.error("Random ping error:", err);
  }
}

function sanitizeMessage(text) {
  if (!text) return text;

  // Add words you want filtered here (lowercase)
  const bannedWords = [
    "nigga",
    "nigger",
    "niglet"
  ];

  let clean = text;

  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    clean = clean.replace(regex, "fella");
  }

  return clean;
}

function scheduleNextPing() {
  const delay = Math.floor(Math.random() * (PING_INTERVAL_MAX_MS - PING_INTERVAL_MIN_MS + 1)) + PING_INTERVAL_MIN_MS;
  console.log(`Next random ping in ${Math.round(delay / 60000)} minutes`);
  setTimeout(async () => {
    await randomPing();
    scheduleNextPing();
  }, delay);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const mentionedCatbot =
    message.content.toLowerCase().includes("catbot") ||
    message.content.toLowerCase().includes("minecraft cat");

  let repliedToCatbot = false;
  let referencedMessage = null;
  if (message.reference?.messageId) {
    try {
      referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (referencedMessage?.author?.id === client.user?.id) {
        repliedToCatbot = true;
      }
    } catch {}
  }

  addToHistory(message.channel.id, message.author.username, message.content);

  const randomChime = !mentionedCatbot && !repliedToCatbot && Math.random() < 1 / 10;

  if (!mentionedCatbot && !repliedToCatbot && !randomChime) return;

  try {
    await message.channel.sendTyping();

    const history = getHistory(message.channel.id);
    const historyLog = history.join("\n");

    let userMessage = `${message.author.username} says: ${message.content}`;
    if (referencedMessage && !repliedToCatbot) {
      userMessage = `${message.author.username} replied to ${referencedMessage.author.username} who said "${referencedMessage.content}", and says: ${message.content}`;
    } else if (repliedToCatbot) {
      userMessage = `${message.author.username} replied to you (Catbot) and says: ${message.content}`;
    } else if (randomChime) {
      userMessage = `${message.author.username} says: ${message.content} (you decided to randomly butt into this conversation uninvited)`;
    }

    const messages = [
      { role: "system", content: BOT_PROMPT },
      {
        role: "user",
        content: `Here are the last ${history.length} messages in the chat for context:\n${historyLog}\n\n${userMessage}`
      }
    ];

    let reply = await askGroq(messages);
    reply = sanitizeMessage(reply);
    
    addToHistory(message.channel.id, "Catbot", reply);
    message.reply(reply);
  } catch (err) {
    console.error("Groq error:", err);
    message.reply("Sorry, I couldn't process that message.");
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
  scheduleNextPing();
});

client.login(TOKEN);
