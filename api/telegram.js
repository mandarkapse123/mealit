import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

// Firebase Database Singleton
function getDb() {
  if (getApps().length === 0) {
    if (!SERVICE_ACCOUNT_RAW) {
      return null;
    }
    try {
      const cred = typeof SERVICE_ACCOUNT_RAW === 'string' ? JSON.parse(SERVICE_ACCOUNT_RAW) : SERVICE_ACCOUNT_RAW;
      initializeApp({ credential: cert(cred) });
    } catch (e) {
      console.error('Failed to parse service account:', e);
      return null;
    }
  }
  return getFirestore();
}

function getTodayString(tz, offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function getFriendlyDate(dateStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(dateObj);
}

// Send Telegram Message
async function sendTelegramReply(chatId, text) {
  if (!BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}

// Download Telegram voice note file buffer
async function downloadTelegramFile(fileId) {
  const getFileUrl = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
  const fileRes = await fetch(getFileUrl);
  const fileData = await fileRes.json();
  if (!fileData.ok || !fileData.result.file_path) {
    throw new Error('Could not retrieve file path from Telegram');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
  const audioRes = await fetch(downloadUrl);
  const arrayBuffer = await audioRes.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

// Dynamically discover supported models and iterate through available models
async function callGeminiDynamic(apiKey, contents, systemPrompt = '') {
  let modelCandidates = [
    'gemini-3.6-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (listData.models && listData.models.length > 0) {
      const active = listData.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));
      if (active.length > 0) {
        modelCandidates = [...active, ...modelCandidates];
      }
    }
  } catch (err) {
    console.warn('Could not list models dynamically:', err.message);
  }

  // Remove duplicates
  const uniqueModels = Array.from(new Set(modelCandidates));
  let lastError = null;

  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = { contents: contents };
      if (systemPrompt) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (data.error) {
        lastError = new Error(data.error.message);
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All available Gemini models were tried but failed');
}

// Fallback Natural Language Parser
function ruleBasedNLP(promptText, todayStr, tomorrowStr, members, plansByDateAndMember) {
  const clean = promptText.toLowerCase();

  let targetDate = todayStr;
  let dateLabel = 'Today';
  if (clean.includes('tomorrow') || clean.includes('kal')) {
    targetDate = tomorrowStr;
    dateLabel = 'Tomorrow';
  }

  const foundMember = members.find(m => clean.includes(m.name.split(' ')[0].toLowerCase()));

  const slot = ['breakfast', 'lunch', 'dinner', 'snacks', 'nashta', 'jevan', 'khana'].find(s => {
    if (s === 'nashta') return clean.includes('breakfast') || clean.includes('nashta');
    if (s === 'jevan' || s === 'khana') return clean.includes('lunch') || clean.includes('dinner');
    return clean.includes(s);
  });

  const emojiMap = { breakfast: '🌅', lunch: '🍛', snacks: '🍪', dinner: '🌙' };

  if (foundMember && slot && (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'snacks')) {
    const p = plansByDateAndMember.get(`${targetDate}_${foundMember.id}`);
    const mealText = p?.[slot]?.trim();
    return `🍽️ <b>${foundMember.name}'s ${slot.toUpperCase()} for ${dateLabel}:</b>\n` +
      `${emojiMap[slot] || '🍴'} ${mealText ? mealText : '<i>Not set yet in portal</i>'}`;
  }

  if (foundMember) {
    const p = plansByDateAndMember.get(`${targetDate}_${foundMember.id}`);
    return `🍽️ <b>${dateLabel}'s Meal Plan for ${foundMember.name}</b>\n` +
      `📅 <i>${getFriendlyDate(targetDate, TIMEZONE)}</i>\n` +
      `🏷️ <b>Diet:</b> ${foundMember.diet || 'Veg'} (${foundMember.relation || 'Family'})\n\n` +
      `🌅 <b>Breakfast:</b> ${p?.breakfast?.trim() || '<i>Not set</i>'}\n` +
      `🍛 <b>Lunch:</b> ${p?.lunch?.trim() || '<i>Not set</i>'}\n` +
      `🍪 <b>Snacks:</b> ${p?.snacks?.trim() || '<i>Not set</i>'}\n` +
      `🌙 <b>Dinner:</b> ${p?.dinner?.trim() || '<i>Not set</i>'}\n`;
  }

  if (slot && (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'snacks')) {
    let reply = `🍽️ <b>${emojiMap[slot] || '🍴'} ${dateLabel}'s ${slot.toUpperCase()} for Everyone:</b>\n` +
      `📅 <i>${getFriendlyDate(targetDate, TIMEZONE)}</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    members.forEach(m => {
      const p = plansByDateAndMember.get(`${targetDate}_${m.id}`);
      const val = p?.[slot]?.trim();
      reply += `• <b>${m.name}:</b> ${val ? val : '<i>Not set</i>'}\n`;
    });
    return reply;
  }

  let reply = `🍽️ <b>${dateLabel}'s Family Meal Plan</b>\n` +
    `📅 <i>${getFriendlyDate(targetDate, TIMEZONE)}</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  members.forEach(m => {
    const p = plansByDateAndMember.get(`${targetDate}_${m.id}`);
    reply += `👤 <b>${m.name} (${m.diet || 'Veg'}):</b>\n`;
    reply += `  🌅 <b>Breakfast:</b> ${p?.breakfast?.trim() || '<i>Not set</i>'}\n`;
    reply += `  🍛 <b>Lunch:</b> ${p?.lunch?.trim() || '<i>Not set</i>'}\n`;
    reply += `  🍪 <b>Snacks:</b> ${p?.snacks?.trim() || '<i>Not set</i>'}\n`;
    reply += `  🌙 <b>Dinner:</b> ${p?.dinner?.trim() || '<i>Not set</i>'}\n\n`;
  });

  return reply;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('MealBot Telegram Webhook with Natural Language & Voice is Online! 🚀');
  }

  const update = req.body;
  if (!update || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg.chat?.id;
  const userText = msg.text ? msg.text.trim() : '';
  const isVoice = Boolean(msg.voice || msg.audio);

  if (!chatId) return res.status(200).json({ ok: true });

  try {
    const db = getDb();
    const todayStr = getTodayString(TIMEZONE, 0);
    const tomorrowStr = getTodayString(TIMEZONE, 1);

    // Fetch members
    let members = [
      { id: 'member-mandar', name: 'MANDAR (31)', diet: 'Non-Veg', relation: 'Self' },
      { id: 'member-madhura', name: 'MADHURA (33)', diet: 'Non-Veg', relation: 'Spouse' },
      { id: 'member-pankaj', name: 'PANKAJ (33)', diet: 'Non-Veg', relation: 'Brother' },
      { id: 'member-vrushali', name: 'VRUSHALI (60)', diet: 'Veg', relation: 'Mother' },
      { id: 'member-agastya', name: 'AGASTYA (3)', diet: 'Non-Veg', relation: 'Son' }
    ];

    const plansByDateAndMember = new Map();

    if (db) {
      try {
        const membersSnap = await db.collection('members').get();
        if (!membersSnap.empty) {
          members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }

        const weekDates = [0, 1, 2, 3, 4, 5, 6].map(i => getTodayString(TIMEZONE, i));
        const plansSnap = await db.collection('mealPlans')
          .where('date', '>=', weekDates[0])
          .where('date', '<=', weekDates[6])
          .get();

        plansSnap.forEach(doc => {
          const d = doc.data();
          plansByDateAndMember.set(`${d.date}_${d.memberId}`, d);
        });
      } catch (dbErr) {
        console.warn('Firestore fetch warning:', dbErr.message);
      }
    }

    // Build context string of all meals
    let mealsContext = `Today is ${getFriendlyDate(todayStr, TIMEZONE)} (${todayStr}).\nFamily Profiles:\n`;
    members.forEach(m => {
      mealsContext += `- ${m.name} (Age: ${m.age || 'N/A'}, Relation: ${m.relation || 'Family'}, Diet: ${m.diet || 'Veg'})\n`;
    });
    mealsContext += `\nPlanned Meals Database:\n`;
    for (let i = 0; i < 4; i++) {
      const dStr = getTodayString(TIMEZONE, i);
      mealsContext += `\nDate: ${dStr} (${getFriendlyDate(dStr, TIMEZONE)}):\n`;
      members.forEach(m => {
        const p = plansByDateAndMember.get(`${dStr}_${m.id}`);
        mealsContext += `  ${m.name}: Breakfast=${p?.breakfast || 'Not set'}, Lunch=${p?.lunch || 'Not set'}, Dinner=${p?.dinner || 'Not set'}, Snacks=${p?.snacks || 'Not set'}\n`;
      });
    }

    const systemPrompt = `You are MealBot, the friendly personal family meal voice assistant for Mandar's family on their iPad.
Family members: MANDAR (31, Non-Veg), MADHURA (33, Non-Veg), PANKAJ (33, Non-Veg), VRUSHALI (60, Veg), AGASTYA (3, Non-Veg Toddler).
Answer accurately based on the meal database.
Use clean HTML formatting (<b>bold</b>, <i>italic</i>, emojis: 🌅 Breakfast, 🍛 Lunch, 🌙 Dinner, 🍪 Snacks).

Database Context:
${mealsContext}`;

    // --- 1. HANDLE VOICE MESSAGE (Voice notes on Telegram) ---
    if (isVoice) {
      if (!GEMINI_API_KEY) {
        const voiceMissingKeyNotice = `🎙️ <b>Voice Message Received!</b>\n\n` +
          `To enable AI voice processing, please add <code>GEMINI_API_KEY</code> in Vercel Environment Variables.`;
        await sendTelegramReply(chatId, voiceMissingKeyNotice);
        return res.status(200).json({ ok: true });
      }

      const voiceFileId = (msg.voice || msg.audio).file_id;
      const base64Audio = await downloadTelegramFile(voiceFileId);

      const contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: msg.voice?.mime_type || 'audio/ogg',
                data: base64Audio
              }
            },
            {
              text: 'Please listen to this voice message carefully and answer the user question based on the family meal database.'
            }
          ]
        }
      ];

      const aiResponse = await callGeminiDynamic(GEMINI_API_KEY, contents, systemPrompt);
      await sendTelegramReply(chatId, aiResponse);
      return res.status(200).json({ ok: true });
    }

    // --- 2. HANDLE NATURAL LANGUAGE TEXT VIA GEMINI ---
    if (GEMINI_API_KEY && userText && !userText.startsWith('/start') && !userText.startsWith('/help')) {
      const contents = [
        {
          role: 'user',
          parts: [{ text: `User Question: "${userText}"` }]
        }
      ];

      try {
        const aiResponse = await callGeminiDynamic(GEMINI_API_KEY, contents, systemPrompt);
        await sendTelegramReply(chatId, aiResponse);
        return res.status(200).json({ ok: true });
      } catch (geminiErr) {
        console.warn('Gemini text error, falling back to NLP:', geminiErr.message);
        const fallbackReply = ruleBasedNLP(userText, todayStr, tomorrowStr, members, plansByDateAndMember);
        await sendTelegramReply(chatId, fallbackReply);
        return res.status(200).json({ ok: true });
      }
    }

    // --- 3. BUILT-IN SMART NLP PARSER (Fallback) ---
    if (userText) {
      if (userText === '/start' || userText === '/help' || userText === 'help') {
        const helpMsg = `🍽️ <b>Welcome to MealBot!</b>\n\n` +
          `You can talk to me in <b>Natural Language or Voice</b> on your iPad:\n\n` +
          `🎙️ <b>Voice:</b> Hold the mic button and ask <i>"What's for lunch today?"</i>\n` +
          `💬 <b>Natural Questions:</b>\n` +
          `• <i>"What is Agastya eating for dinner?"</i>\n` +
          `• <i>"What's planned for lunch today?"</i>\n` +
          `• <i>"What is Mandar's diet tomorrow?"</i>\n` +
          `• <i>"Is Vrushali eating veg tonight?"</i>\n`;
        await sendTelegramReply(chatId, helpMsg);
        return res.status(200).json({ ok: true });
      }

      const nlpReply = ruleBasedNLP(userText, todayStr, tomorrowStr, members, plansByDateAndMember);
      await sendTelegramReply(chatId, nlpReply);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    await sendTelegramReply(chatId, `⚠️ Could not process: ${err.message}`);
    return res.status(200).json({ ok: true });
  }
}
