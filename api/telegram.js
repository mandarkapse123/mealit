import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';

function getDb() {
  if (getApps().length === 0) {
    if (!SERVICE_ACCOUNT_RAW) {
      throw new Error('Missing FIREBASE_SERVICE_ACCOUNT');
    }
    const cred = typeof SERVICE_ACCOUNT_RAW === 'string' ? JSON.parse(SERVICE_ACCOUNT_RAW) : SERVICE_ACCOUNT_RAW;
    initializeApp({ credential: cert(cred) });
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

async function sendTelegramReply(chatId, text) {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('MealBot Telegram Webhook Running!');
  }

  const update = req.body;
  if (!update || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const msg = update.message;
  const chatId = msg.chat?.id;
  const text = (msg.text || '').trim().toLowerCase();

  if (!chatId) return res.status(200).json({ ok: true });

  try {
    const db = getDb();
    const todayStr = getTodayString(TIMEZONE, 0);
    const tomorrowStr = getTodayString(TIMEZONE, 1);

    // Fetch members
    const membersSnap = await db.collection('members').get();
    let members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (members.length === 0) {
      members = [
        { id: 'member-mandar', name: 'MANDAR (31)' },
        { id: 'member-madhura', name: 'MADHURA (33)' },
        { id: 'member-pankaj', name: 'PANKAJ (33)' },
        { id: 'member-vrushali', name: 'VRUSHALI (60)' },
        { id: 'member-agastya', name: 'AGASTYA (3)' }
      ];
    }

    // 1. HELP / START
    if (text === '/start' || text === '/help' || text === 'help') {
      const helpMsg = `🍽️ <b>Welcome to MealBot Query!</b>\n\n` +
        `You can ask me anytime on your iPad:\n\n` +
        `• <b>/today</b> — All meals planned for today\n` +
        `• <b>/tomorrow</b> — Tomorrow's meal plan\n` +
        `• <b>/breakfast</b> — Today's breakfast for everyone\n` +
        `• <b>/lunch</b> — Today's lunch for everyone\n` +
        `• <b>/dinner</b> — Today's dinner for everyone\n` +
        `• <b>/snacks</b> — Today's snacks\n` +
        `• <b>/grocery</b> — Coming week grocery checklist\n\n` +
        `<b>Check specific member:</b>\n` +
        `• <b>/mandar</b> | <b>/madhura</b> | <b>/pankaj</b> | <b>/vrushali</b> | <b>/agastya</b>\n`;
      await sendTelegramReply(chatId, helpMsg);
      return res.status(200).json({ ok: true });
    }

    // 2. SPECIFIC MEMBER QUERY (/mandar, /madhura, /pankaj, /vrushali, /agastya)
    const memberCmd = members.find(m => text.includes(m.name.split(' ')[0].toLowerCase()));
    if (memberCmd) {
      const planSnap = await db.collection('mealPlans').where('memberId', '==', memberCmd.id).where('date', '==', todayStr).get();
      const plan = planSnap.empty ? {} : planSnap.docs[0].data();
      const reply = `🍽️ <b>Today's Meal Plan for ${memberCmd.name}</b>\n` +
        `📅 <i>${getFriendlyDate(todayStr, TIMEZONE)}</i>\n\n` +
        `🌅 <b>Breakfast:</b> ${plan.breakfast || '<i>Not set</i>'}\n` +
        `🍛 <b>Lunch:</b> ${plan.lunch || '<i>Not set</i>'}\n` +
        `🍪 <b>Snacks:</b> ${plan.snacks || '<i>Not set</i>'}\n` +
        `🌙 <b>Dinner:</b> ${plan.dinner || '<i>Not set</i>'}\n`;
      await sendTelegramReply(chatId, reply);
      return res.status(200).json({ ok: true });
    }

    // 3. MEAL SLOT QUERY (/breakfast, /lunch, /dinner, /snacks)
    const slotMatches = ['breakfast', 'lunch', 'dinner', 'snacks'].find(s => text.includes(s));
    if (slotMatches) {
      const slot = slotMatches;
      const plansSnap = await db.collection('mealPlans').where('date', '==', todayStr).get();
      const plansMap = new Map();
      plansSnap.forEach(d => plansMap.set(d.data().memberId, d.data()));

      const emojiMap = { breakfast: '🌅', lunch: '🍛', snacks: '🍪', dinner: '🌙' };
      let reply = `🍽️ <b>${emojiMap[slot]} Today's ${slot.toUpperCase()}</b>\n📅 <i>${getFriendlyDate(todayStr, TIMEZONE)}</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      members.forEach(m => {
        const p = plansMap.get(m.id);
        const mealVal = p?.[slot]?.trim();
        reply += `• <b>${m.name}:</b> ${mealVal ? mealVal : '<i>Not set</i>'}\n`;
      });

      await sendTelegramReply(chatId, reply);
      return res.status(200).json({ ok: true });
    }

    // 4. TODAY OR TOMORROW FULL SUMMARY
    const targetDate = text.includes('tomorrow') ? tomorrowStr : todayStr;
    const dateLabel = text.includes('tomorrow') ? 'Tomorrow' : 'Today';

    const plansSnap = await db.collection('mealPlans').where('date', '==', targetDate).get();
    const plansMap = new Map();
    plansSnap.forEach(d => plansMap.set(d.data().memberId, d.data()));

    let reply = `🍽️ <b>${dateLabel}'s Family Meal Plan</b>\n📅 <i>${getFriendlyDate(targetDate, TIMEZONE)}</i>\n━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    members.forEach(m => {
      const p = plansMap.get(m.id);
      reply += `👤 <b>${m.name}:</b>\n`;
      reply += `  🌅 <b>Breakfast:</b> ${p?.breakfast?.trim() || '<i>Not set</i>'}\n`;
      reply += `  🍛 <b>Lunch:</b> ${p?.lunch?.trim() || '<i>Not set</i>'}\n`;
      reply += `  🍪 <b>Snacks:</b> ${p?.snacks?.trim() || '<i>Not set</i>'}\n`;
      reply += `  🌙 <b>Dinner:</b> ${p?.dinner?.trim() || '<i>Not set</i>'}\n\n`;
    });

    await sendTelegramReply(chatId, reply);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Webhook error:', err);
    await sendTelegramReply(chatId, `⚠️ Could not fetch meals: ${err.message}`);
    return res.status(200).json({ ok: true });
  }
}
