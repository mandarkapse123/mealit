import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// --- CONFIGURATION ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SINGLE_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SERVICE_ACCOUNT_RAW = process.env.FIREBASE_SERVICE_ACCOUNT;
const TIMEZONE = process.env.TIMEZONE || 'Asia/Kolkata';
const DRY_RUN = (process.env.DRY_RUN || 'false').toLowerCase() === 'true';
const NOTIFY_MODE = process.env.NOTIFY_MODE || 'auto'; // 'breakfast' | 'lunch' | 'dinner' | 'snacks' | 'daily_summary' | 'weekly_grocery' | 'auto'
const OVERRIDE_DATE = process.env.OVERRIDE_DATE; // optional YYYY-MM-DD for testing

// Format date in specified timezone as YYYY-MM-DD
function getTodayString(tz) {
  if (OVERRIDE_DATE) return OVERRIDE_DATE;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

// Format friendly date string (e.g., "Tuesday, September 1, 2026")
function getFriendlyDate(dateStr, tz) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(dateObj);
}

// Format current hour in configured timezone (0-23)
function getCurrentHourInTimezone(tz) {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hour12: false
  }).format(now);
  return parseInt(hourStr, 10);
}

// Determine active meal slot based on 2-hour-prior reminder schedule
function determineAutoSlot(tz) {
  const hour = getCurrentHourInTimezone(tz);
  // 6:00 AM (for 8:00 AM breakfast)
  if (hour >= 5 && hour < 9) return 'breakfast';
  // 11:00 AM (for 1:00 PM lunch)
  if (hour >= 10 && hour < 14) return 'lunch';
  // 3:30 PM - 5:00 PM (for snacks)
  if (hour >= 15 && hour < 17) return 'snacks';
  // 6:00 PM (for 8:00 PM dinner)
  if (hour >= 17 && hour < 22) return 'dinner';
  return 'daily_summary';
}

// Parse Firebase Service Account credential
function getServiceAccount() {
  if (!SERVICE_ACCOUNT_RAW) {
    if (fs.existsSync('./serviceAccountKey.json')) {
      return JSON.parse(fs.readFileSync('./serviceAccountKey.json', 'utf8'));
    }
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT in environment variables or serviceAccountKey.json');
  }

  if (fs.existsSync(SERVICE_ACCOUNT_RAW)) {
    return JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_RAW, 'utf8'));
  }

  try {
    return JSON.parse(SERVICE_ACCOUNT_RAW);
  } catch (err) {
    throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${err.message}`);
  }
}

// Escape HTML special characters for Telegram HTML mode
function escapeHTML(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Send Telegram Message via Bot API
async function sendTelegramMessage(chatId, text) {
  if (DRY_RUN) {
    console.log(`\x1b[33m[DRY RUN]\x1b[0m Would send to chat ID ${chatId}:\n${text}\n---`);
    return { ok: true, dryRun: true };
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Telegram API Error (${data.error_code}): ${data.description}`);
  }
  return data;
}

// Normalize meal text for comparison (ignoring case, spaces, punctuation)
function normalizeMeal(text) {
  if (!text) return '';
  return text.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Group members by identical meal text (Deduplication)
function groupMembersByMeal(membersWithPlans, slotKey) {
  const groups = new Map(); // key: normalizedMealText -> { originalText, memberNames: [] }

  membersWithPlans.forEach(({ member, plan }) => {
    const rawMeal = plan?.[slotKey]?.trim() || '';
    const norm = normalizeMeal(rawMeal);
    const memberName = member.name || 'Member';

    if (!norm) {
      // Empty meal
      if (!groups.has('__EMPTY__')) {
        groups.set('__EMPTY__', { originalText: 'Not planned yet', memberNames: [] });
      }
      groups.get('__EMPTY__').memberNames.push(memberName);
    } else {
      if (!groups.has(norm)) {
        groups.set(norm, { originalText: rawMeal, memberNames: [] });
      }
      groups.get(norm).memberNames.push(memberName);
    }
  });

  return Array.from(groups.values());
}

// Build 2-Hour-Prior Single Meal Reminder Message (with Smart Deduplication)
function buildMealSlotReminderMessage(slotName, friendlyDate, membersWithPlans) {
  const slotEmojiMap = {
    breakfast: '🌅',
    lunch: '🍛',
    snacks: '🍪',
    dinner: '🌙'
  };
  const slotTitleMap = {
    breakfast: 'Breakfast (in 2 hours)',
    lunch: 'Lunch (in 2 hours)',
    snacks: 'Snacks (in 2 hours)',
    dinner: 'Dinner (in 2 hours)'
  };

  const emoji = slotEmojiMap[slotName] || '🍽️';
  const title = slotTitleMap[slotName] || `${slotName.toUpperCase()} Reminder`;

  let msg = `🍽️ <b>Family Meal Reminder</b>\n`;
  msg += `⏰ <b>${emoji} ${title}</b>\n`;
  msg += `📅 <i>${escapeHTML(friendlyDate)}</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const groups = groupMembersByMeal(membersWithPlans, slotName);

  // Check if all members have the same meal
  const nonEmptyGroups = groups.filter(g => g.originalText !== 'Not planned yet');

  if (nonEmptyGroups.length === 0) {
    msg += `⚠️ <i>No ${slotName} planned for today yet.</i>\n`;
  } else if (nonEmptyGroups.length === 1 && groups.length === 1) {
    // EVERYONE has the exact same meal!
    const g = nonEmptyGroups[0];
    msg += `👥 <b>Everyone (${g.memberNames.join(', ')}):</b>\n`;
    msg += `${emoji} <b>${escapeHTML(g.originalText)}</b>\n\n`;
  } else {
    // Mixed or separate meals
    groups.forEach(g => {
      if (g.originalText === 'Not planned yet') return;
      const isMultiple = g.memberNames.length > 1;
      const prefix = isMultiple ? '👥' : '👤';
      const namesStr = g.memberNames.join(', ');

      msg += `${prefix} <b>${escapeHTML(namesStr)}:</b>\n`;
      msg += `${emoji} ${escapeHTML(g.originalText)}\n\n`;
    });

    // Mention members with no meal set
    const emptyGroup = groups.find(g => g.originalText === 'Not planned yet');
    if (emptyGroup && emptyGroup.memberNames.length > 0) {
      msg += `⚠️ <i>No ${slotName} set for: ${escapeHTML(emptyGroup.memberNames.join(', '))}</i>\n\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✨ <i>Bon Appétit on your iPad!</i>`;
  return msg;
}

// Build Full Day Summary Message with Grouped Deduplication
function buildDailySummaryMessage(friendlyDate, membersWithPlans) {
  let msg = `🍽️ <b>Today's Family Meal Plan</b>\n`;
  msg += `📅 <i>${escapeHTML(friendlyDate)}</i>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const slots = [
    { key: 'breakfast', label: 'Breakfast', emoji: '🌅' },
    { key: 'lunch', label: 'Lunch', emoji: '🍛' },
    { key: 'snacks', label: 'Snacks', emoji: '🍪' },
    { key: 'dinner', label: 'Dinner', emoji: '🌙' },
  ];

  slots.forEach(({ key, label, emoji }) => {
    msg += `${emoji} <b>${label.toUpperCase()}:</b>\n`;
    const groups = groupMembersByMeal(membersWithPlans, key);
    const validGroups = groups.filter(g => g.originalText !== 'Not planned yet');

    if (validGroups.length === 0) {
      msg += `  <i>Not planned</i>\n\n`;
    } else if (validGroups.length === 1 && groups.length === 1) {
      msg += `  👥 <b>All:</b> ${escapeHTML(validGroups[0].originalText)}\n\n`;
    } else {
      validGroups.forEach(g => {
        const names = g.memberNames.join(', ');
        msg += `  • <b>${escapeHTML(names)}:</b> ${escapeHTML(g.originalText)}\n`;
      });
      msg += `\n`;
    }
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✨ <i>Have a great and nourishing day!</i>`;
  return msg;
}

// Extract essential grocery items from text
function extractGroceryKeywords(allMealsText) {
  const commonItems = [
    'Oats / Oatmeal', 'Eggs', 'Milk / Almond Milk', 'Greek Yogurt / Curd', 'Paneer', 'Chicken', 'Fish / Salmon',
    'Tofu', 'Quinoa', 'Rice / Brown Rice', 'Roti / Wheat Flour', 'Dalia', 'Moong Dal / Lentils',
    'Bananas', 'Apples', 'Strawberries / Berries', 'Avocado', 'Broccoli', 'Spinach / Greens',
    'Cucumber', 'Tomatoes', 'Bell Peppers', 'Carrots', 'Potatoes / Sweet Potatoes',
    'Almonds / Walnuts', 'Chia Seeds', 'Coffee / Tea', 'Cheese'
  ];

  const lower = allMealsText.toLowerCase();
  const detected = commonItems.filter(item => {
    const parts = item.toLowerCase().split(/[\s/]+/);
    return parts.some(p => p.length > 2 && lower.includes(p));
  });

  return detected.length > 0 ? detected : [
    'Fresh Vegetables & Greens', 'Fresh Fruits', 'Dairy & Eggs', 'Grains & Pulses', 'Proteins & Nuts'
  ];
}

// Build Sunday Weekly Grocery & Meal Plan Digest
async function buildWeeklyGroceryMessage(db, tz, members) {
  const now = new Date();
  // Get upcoming 7 days starting from Monday
  const dayOfWeek = now.getDay(); // 0 is Sunday
  const daysUntilMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(nextMonday);
    d.setDate(nextMonday.getDate() + i);
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    weekDates.push(dateStr);
  }

  const startDate = weekDates[0];
  const endDate = weekDates[6];

  // Query meal plans for range
  const snapshot = await db.collection('mealPlans')
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .get();

  const plansByDateAndMember = new Map();
  let allMealsCombinedText = '';

  snapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.date}_${data.memberId}`;
    plansByDateAndMember.set(key, data);
    allMealsCombinedText += ` ${data.breakfast || ''} ${data.lunch || ''} ${data.dinner || ''} ${data.snacks || ''}`;
  });

  let msg = `🛒 <b>Weekly Grocery & Meal Planner</b>\n`;
  msg += `📅 <b>Week: ${startDate} to ${endDate}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 1. Estimated Grocery Checklist
  const groceries = extractGroceryKeywords(allMealsCombinedText);
  msg += `📝 <b>Estimated Grocery Checklist:</b>\n`;
  groceries.forEach(item => {
    msg += `  ◽ ${item}\n`;
  });
  msg += `\n`;

  // 2. Day by Day Highlights
  msg += `🗓️ <b>Coming Week Highlights:</b>\n`;
  weekDates.forEach(dStr => {
    const [y, m, d] = dStr.split('-').map(Number);
    const dayObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', month: 'numeric', day: 'numeric' }).format(dayObj);

    const dayMembersWithPlans = members.map(m => ({
      member: m,
      plan: plansByDateAndMember.get(`${dStr}_${m.id}`) || null
    }));

    const lunchGroups = groupMembersByMeal(dayMembersWithPlans, 'lunch').filter(g => g.originalText !== 'Not planned yet');
    const dinnerGroups = groupMembersByMeal(dayMembersWithPlans, 'dinner').filter(g => g.originalText !== 'Not planned yet');

    msg += `<b>${dayName}:</b>\n`;
    if (lunchGroups.length > 0) {
      msg += `  🍛 Lunch: ${lunchGroups.map(g => `${g.memberNames.join('/')}: ${g.originalText}`).join(' | ')}\n`;
    }
    if (dinnerGroups.length > 0) {
      msg += `  🌙 Dinner: ${dinnerGroups.map(g => `${g.memberNames.join('/')}: ${g.originalText}`).join(' | ')}\n`;
    }
    if (lunchGroups.length === 0 && dinnerGroups.length === 0) {
      msg += `  <i>Plan in web portal</i>\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✨ <i>Sent Sunday 6:00 PM for family grocery planning!</i>`;
  return msg;
}

async function runNotifier() {
  console.log('\x1b[36m%s\x1b[0m', '==================================================');
  console.log('\x1b[36m%s\x1b[0m', '🚀 MealBot Telegram Notifier Starting...');
  console.log('\x1b[36m%s\x1b[0m', '==================================================');

  if (!BOT_TOKEN && !DRY_RUN) {
    console.error('\x1b[31m%s\x1b[0m', '❌ TELEGRAM_BOT_TOKEN is missing.');
    process.exit(1);
  }

  const todayStr = getTodayString(TIMEZONE);
  const friendlyDate = getFriendlyDate(todayStr, TIMEZONE);

  let activeMode = NOTIFY_MODE;
  if (activeMode === 'auto') {
    activeMode = determineAutoSlot(TIMEZONE);
  }

  console.log(`📍 Timezone: ${TIMEZONE}`);
  console.log(`📅 Target Date: ${todayStr} (${friendlyDate})`);
  console.log(`🔔 Active Mode: ${activeMode.toUpperCase()}`);

  // 1. Initialize Firebase Admin
  let db;
  try {
    const serviceAccount = getServiceAccount();
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    console.log('✅ Connected to Firebase Firestore.');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', `❌ Firebase Initialization Failed: ${err.message}`);
    process.exit(1);
  }

  // 2. Fetch Members (Mandar, Madhura, Pankaj, Vrushali, Agastya)
  const membersSnapshot = await db.collection('members').get();
  let members = [];
  if (!membersSnapshot.empty) {
    members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    members = [
      { id: 'member-mandar', name: 'MANDAR (31)' },
      { id: 'member-madhura', name: 'MADHURA (33)' },
      { id: 'member-pankaj', name: 'PANKAJ (33)' },
      { id: 'member-vrushali', name: 'VRUSHALI (60)' },
      { id: 'member-agastya', name: 'AGASTYA (3)' }
    ];
  }

  const targetChatId = SINGLE_CHAT_ID || members.find(m => m.telegramChatId)?.telegramChatId;

  if (!targetChatId && !DRY_RUN) {
    console.error('❌ No TELEGRAM_CHAT_ID provided.');
    process.exit(1);
  }

  let finalMessage = '';

  // Mode: Weekly Grocery
  if (activeMode === 'weekly_grocery') {
    console.log('\n🛒 Building Sunday Weekly Grocery & Meal Digest...');
    finalMessage = await buildWeeklyGroceryMessage(db, TIMEZONE, members);
  } else {
    // Fetch Today's Plans
    const mealPlansSnapshot = await db.collection('mealPlans')
      .where('date', '==', todayStr)
      .get();

    const plansByMemberId = new Map();
    mealPlansSnapshot.forEach(doc => {
      const data = doc.data();
      plansByMemberId.set(data.memberId, data);
    });

    const membersWithPlans = members.map(member => ({
      member,
      plan: plansByMemberId.get(member.id) || null
    }));

    if (activeMode === 'daily_summary') {
      finalMessage = buildDailySummaryMessage(friendlyDate, membersWithPlans);
    } else {
      // 2-hour before single meal slot reminder (breakfast, lunch, dinner, snacks)
      finalMessage = buildMealSlotReminderMessage(activeMode, friendlyDate, membersWithPlans);
    }
  }

  // Send message
  console.log(`\n📤 Dispatching message to iPad Telegram (${targetChatId || 'DRY RUN'})...`);
  try {
    await sendTelegramMessage(targetChatId || '000000', finalMessage);
    console.log('\x1b[32m✔\x1b[0m Successfully sent notification to your iPad!');
  } catch (err) {
    console.error('\x1b[31m✖\x1b[0m Failed to send message:', err.message);
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log('🎉 Notification execution completed.');
  console.log('==================================================\n');
}

runNotifier();
