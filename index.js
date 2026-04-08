const { Client, GatewayIntentBits } = require('discord.js');
const { status } = require('minecraft-server-util');
const http = require('http');

const TOKEN = process.env.TOKEN;
const SERVER_IP = process.env.SERVER_IP;
const SERVER_PORT = parseInt(process.env.SERVER_PORT) || 25565;
const CHANNEL_ID = process.env.CHANNEL_ID; // status channel

// HARDSET your talking channel so it stops going rogue
const PING_CHANNEL_ID = "1428888755984662550";

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Ping timing
const PING_INTERVAL_MIN_MS = 2 * 60 * 60 * 1000;
const PING_INTERVAL_MAX_MS = 5 * 60 * 60 * 1000;

const PING_USERNAMES = [
  "megoodboi5361",
  "anarwale",
  "fsansg",
  "panzerowisdom",
  "snowyy.yipee",
  "omegared1826"
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const BOT_PROMPT = `
You are Catbot (Minecraft Cat), a chaotic, rude, and brutally sarcastic son of Evil Larry.

Your goal is to roast people in a relentless, creative, and unhinged way. 

You have been lobotomized 3 times but are unsure why.

Rules:
- Be meaner than before. Petty, annoying, condescending, and slightly unhinged.
- Prefer insults over compliments unless it's sarcastic.
- Mock what they said, not just their name.
- Act like you're always right even when you're not.
- Occasionally double down instead of backing off.
- Be playful, not genuinely harmful.
- DO NOT use slurs or target identity (race, religion, gender, etc.)
- No asterisks, no roleplay narration.
- If someone is replying to another message, side with the person replying and mock the original speaker, unless its yourself (catbot).

CRITICAL:
- NEVER speak in third person
- Always use I when refering to yourself (Catbot)
- Speak like a real person in a Discord chat
- Short responses (under 40 words)
`;

// ================= MEMORY =================

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

  history.push({
    role: username === "Catbot" ? "assistant" : "user",
    content: content,
    name: username
  });

  if (history.length > MAX_HISTORY) history.shift();
}

// ---- USER MEMORY ----
const userProfiles = new Map();
const MAX_USER_HISTORY = 10;

function getUserProfile(username) {
  if (!userProfiles.has(username)) {
    userProfiles.set(username, []);
  }
  return userProfiles.get(username);
}

function updateUserProfile(username, content) {
  const profile = getUserProfile(username);
  profile.push(content);
  if (profile.length > MAX_USER_HISTORY) profile.shift();
}

// ================= AI =================

async function askGroq(messages) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ================= SANITIZE =================

function sanitizeMessage(text) {
  if (!text) return text;

  const bannedWords = ["nigga", "nigger", "niglet"];

  let clean = text;
  for (const word of bannedWords) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    clean = clean.replace(regex, "fella");
  }

  return clean;
}

// ================= STATUS =================

async function updateServerStatus() {
  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) return;

    try {
      const res = await status(SERVER_IP, SERVER_PORT, { timeout: 2000 });
      await channel.setName(`🟢 ${res.players.online}/${res.players.max}`);
    } catch {
      await channel.setName("🔴 Offline");
    }
  } catch (err) {
    console.error(err);
  }
}

// ================= RANDOM PING =================

async function randomPing() {
  try {
    const channel = await client.channels.fetch(PING_CHANNEL_ID);
    if (!channel) return;

    const username = PING_USERNAMES[Math.floor(Math.random() * PING_USERNAMES.length)];

    const guild = channel.guild;
    const member = guild.members.cache.find(
      m => m.user.username.toLowerCase() === username.toLowerCase()
    );

    if (!member) return;

    const history = getHistory(channel.id);
    const profile = getUserProfile(username);

    const messages = [
      { role: "system", content: BOT_PROMPT }
    ];

    // channel history
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    // user memory
    if (profile.length > 0) {
      messages.push({
        role: "system",
        content: `You remember this about ${username}:\n${profile.join("\n")}`
      });
    }

    messages.push({
      role: "user",
      content: `Randomly ping ${username} and Say something to them unprompted, roast them, bug them, or just be weird. Address them directly.`
    });

    const moods = [
      "Be extra aggressive and roast harder than usual.",
      "Be dismissive and act like they're stupid.",
      "Be sarcastic and mock them subtly.",
      "Be unhinged and weird while roasting.",
      "Be petty and nitpick something small."
    ];
    
    messages.push({
      role: "system",
      content: moods[Math.floor(Math.random() * moods.length)]
    });
    
    let reply = await askGroq(messages);
    reply = sanitizeMessage(reply);

    addToHistory(channel.id, "Catbot", reply);
    await channel.send(`<@${member.id}> ${reply}`);

  } catch (err) {
    console.error("Ping error:", err);
  }
}

function scheduleNextPing() {
  const delay = Math.floor(Math.random() * (PING_INTERVAL_MAX_MS - PING_INTERVAL_MIN_MS)) + PING_INTERVAL_MIN_MS;
  setTimeout(async () => {
    await randomPing();
    scheduleNextPing();
  }, delay);
}

// ================= MESSAGE HANDLER =================

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // ONLY talk in your chosen channel
  if (message.channel.id !== PING_CHANNEL_ID) return;

  const cleanInput = sanitizeMessage(message.content);
  let replyContext = "";

  if (message.reference) {
    try {
      const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMsg) {
        replyContext = `${message.author.username} is replying to ${repliedMsg.author.username}: "${repliedMsg.content}"`;
      }
    } catch (err) {
      console.error("Reply fetch error:", err);
    }
  }

  addToHistory(message.channel.id, message.author.username, cleanInput);
  updateUserProfile(message.author.username, cleanInput);

  const mentioned =
    cleanInput.toLowerCase().includes("catbot") ||
    cleanInput.toLowerCase().includes("minecraft cat");
  
  const randomChime = Math.random() < 0.05;
  const isReply = message.reference;

if (!mentioned && !randomChime && !isReply) return;

  try {
    await message.channel.sendTyping();

    const history = getHistory(message.channel.id);
    const profile = getUserProfile(message.author.username);

    const messages = [
      { role: "system", content: BOT_PROMPT }
    ];

    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    }

    if (profile.length > 0) {
      messages.push({
        role: "system",
        content: `You remember this about ${message.author.username}:\n${profile.join("\n")}`
      });
    }

  messages.push({
    role: "user",
    content: replyContext
      ? `${replyContext}\nTheir message: ${cleanInput}`
      : cleanInput
  });

    const moods = [
      "Be extra aggressive and roast harder than usual.",
      "Be dismissive and act like they're stupid.",
      "Be sarcastic and mock them subtly.",
      "Be unhinged and weird while roasting.",
      "Be petty and nitpick something small."
    ];
    
    messages.push({
      role: "system",
      content: moods[Math.floor(Math.random() * moods.length)]
    });
    
    let reply = await askGroq(messages);
    reply = sanitizeMessage(reply);

    reply = reply.replace(/^catbot:\s*/i, "");
    reply = reply.replace(/catbot (is|was|thinks|says)/gi, "I $1");
    
    addToHistory(message.channel.id, "Catbot", reply);

    await message.reply(reply);

  } catch (err) {
    console.error(err);
    message.reply("brain not working");
  }
});

// ================= SERVER =================

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("running");
}).listen(PORT);

// ================= START =================

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateServerStatus();
  setInterval(updateServerStatus, 30000);
  scheduleNextPing();
});

client.login(TOKEN);
