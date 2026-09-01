import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// Fallback Natural Language Parser if GEMINI_API_KEY is not configured
function ruleBasedNLP(promptText, todayStr, tomorrowStr, members, plansByDateAndMember) {
  const clean = promptText.toLowerCase();

  // 1. Detect target date
  let targetDate = todayStr;
  let dateLabel = 'Today';
  if (clean.includes('tomorrow') || clean.includes('kal')) {
    targetDate = tomorrowStr;
    dateLabel = 'Tomorrow';
  }

  // 2. Detect target member
  const foundMember = members.find(m => clean.includes(m.name.split(' ')[0].toLowerCase()));

  // 3. Detect target meal slot
  const slot = ['breakfast', 'lunch', 'dinner', 'snacks', 'nashta', 'jevan', 'khana'].find(s => {
    if (s === 'nashta') return clean.includes('breakfast') || clean.includes('nashta');
    if (s === 'jevan' || s === 'khana') return clean.includes('lunch') || clean.includes('dinner');
    return clean.includes(s);
  });

  const emojiMap = { breakfast: '🌅', lunch: '🍛', snacks: '🍪', dinner: '🌙' };

  // Case A: Specific Member + Specific Slot (e.g., "what is Agastya having for dinner?")
  if (foundMember && slot && (slot === 'breakfast' || slot === 'lunch' || slot === 'dinner' || slot === 'snacks')) {
    const p = plansByDateAndMember.get(`${targetDate}_${foundMember.id}`);
    const mealText = p?.[slot]?.trim();
    return `🍽️ <b>${foundMember.name}'s ${slot.toUpperCase()} for ${dateLabel}:</b>\n` +
      `${emojiMap[slot] || '🍴'} ${mealText ? mealText : '<i>Not set yet in portal</i>'}`;
  }

  // Case B: Specific Member Full Day (e.g., "what is Mandar's diet today?")
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

  // Case C: Specific Slot for Everyone (e.g., "what's for lunch today?")
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

  // Case D: General / Full Day Family Summary
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

        // Fetch upcoming 7 days meal plans for context
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

    // --- 1. HANDLE VOICE MESSAGE VIA GEMINI (If voice note sent) ---
    if (isVoice && GEMINI_API_KEY) {
      const voiceFileId = (msg.voice || msg.audio).file_id;
      const base64Audio = await downloadTelegramFile(voiceFileId);

      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      // Build context of all family meals
      let mealsContext = `Today is ${getFriendlyDate(todayStr, TIMEZONE)} (${todayStr}).\nFamily Profiles:\n`;
      members.forEach(m => {
        mealsContext += `- ${m.name} (Age: ${m.age || 'N/A'}, Relation: ${m.relation || 'Family'}, Diet: ${m.diet || 'Veg'})\n`;
      });
      mealsContext += `\nUpcoming Planned Meals Database:\n`;
      for (let i = 0; i < 4; i++) {
        const dStr = getTodayString(TIMEZONE, i);
        mealsContext += `\nDate: ${dStr} (${getFriendlyDate(dStr, TIMEZONE)}):\n`;
        members.forEach(m => {
          const p = plansByDateAndMember.get(`${dStr}_${m.id}`);
          mealsContext += `  ${m.name}: Breakfast=${p?.breakfast || 'Not set'}, Lunch=${p?.lunch || 'Not set'}, Dinner=${p?.dinner || 'Not set'}, Snacks=${p?.snacks || 'Not set'}\n`;
        });
      }

      const prompt = `You are MealBot, the personal family meal voice assistant for Mandar's family (Mandar, Madhura, Pankaj, Vrushali, Agastya).
Listen to the user's voice question carefully and answer their question based STRICTLY on the meals database below.
Format your answer with appropriate emojis (🌅 Breakfast, 🍛 Lunch, 🌙 Dinner, 🍪 Snacks) and keep it friendly, helpful, and concise.

Database Context:
${mealsContext}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: msg.voice?.mime_type || 'audio/ogg',
            data: base64Audio
          }
        }
      ]);

      const aiResponse = result.response.text();
      await sendTelegramReply(chatId, aiResponse);
      return res.status(200).json({ ok: true });
    }

    // --- 2. HANDLE NATURAL LANGUAGE TEXT VIA GEMINI (If GEMINI_API_KEY configured) ---
    if (GEMINI_API_KEY && userText && !userText.startsWith('/start') && !userText.startsWith('/help')) {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

      const systemPrompt = `You are MealBot, the personal family meal assistant for Mandar's family on their iPad.
Family members: MANDAR (31, Non-Veg), MADHURA (33, Non-Veg), PANKAJ (33, Non-Veg), VRUSHALI (60, Veg), AGASTYA (3, Non-Veg Toddler).
Answer the user's natural language question accurately based on the meal database provided.
Support Hindi, Marathi, Hinglish, and English questions.
Use clean HTML formatting (<b>bold</b>, <i>italic</i>, emojis).

Database:
${mealsContext}`;

      const result = await model.generateContent([
        { text: systemPrompt },
        { text: `User Question: "${userText}"` }
      ]);

      const aiResponse = result.response.text();
      await sendTelegramReply(chatId, aiResponse);
      return res.status(200).json({ ok: true });
    }

    // --- 3. BUILT-IN SMART NLP PARSER (Works out of the box with zero setup) ---
    if (userText) {
      if (userText === '/start' || userText === '/help' || userText === 'help') {
        const helpMsg = `🍽️ <b>Welcome to MealBot!</b>\n\n` +
          `You can talk to me in <b>Natural Language or Voice</b> on your iPad:\n\n` +
          `🎙️ <b>Voice:</b> Hold the mic button and ask <i>"What's for lunch today?"</i>\n` +
          `💬 <b>Natural Questions you can type:</b>\n` +
          `• <i>"What is Agastya eating for dinner?"</i>\n` +
          `• <i>"What's planned for lunch today?"</i>\n` +
          `• <i>"What is Mandar's diet tomorrow?"</i>\n` +
          `• <i>"Is Vrushali eating veg tonight?"</i>\n` +
          `• <i>"Aaj khane me kya hai?"</i>\n`;
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
