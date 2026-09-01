import 'dotenv/config';

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken) {
  console.error('\x1b[31m%s\x1b[0m', '❌ Error: TELEGRAM_BOT_TOKEN is missing in environment variables.');
  console.log('👉 Please create a .env file in the notifier/ folder with:');
  console.log('   TELEGRAM_BOT_TOKEN=your_bot_token_here\n');
  process.exit(1);
}

async function getChatIds() {
  console.log('\x1b[36m%s\x1b[0m', '🔍 Fetching recent updates from Telegram Bot API...');

  try {
    const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      console.error('\x1b[31m%s\x1b[0m', `❌ Telegram API error: ${data.description}`);
      return;
    }

    const updates = data.result || [];

    if (updates.length === 0) {
      console.log('\x1b[33m%s\x1b[0m', '⚠️  No recent messages found.');
      console.log('👉 Instructions:');
      console.log('   1. Open Telegram and search for your bot username.');
      console.log('   2. Click "Start" or send any message (e.g. "Hello").');
      console.log('   3. Run this script again: npm run get-chat-ids\n');
      return;
    }

    console.log('\x1b[32m%s\x1b[0m', `\n✅ Found ${updates.length} message update(s)! Here are the sender details:\n`);

    const seenChats = new Map();

    updates.forEach((u) => {
      const msg = u.message || u.channel_post || u.my_chat_member;
      if (!msg || !msg.chat) return;

      const chat = msg.chat;
      const user = msg.from || chat;
      const key = chat.id;

      if (!seenChats.has(key)) {
        seenChats.set(key, {
          chatId: chat.id,
          type: chat.type, // 'private', 'group', 'supergroup', 'channel'
          title: chat.title || null,
          username: user.username ? `@${user.username}` : 'N/A',
          fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'N/A',
          lastText: msg.text || '(Non-text message)'
        });
      }
    });

    console.table(Array.from(seenChats.values()));

    console.log('\n💡 Copy the numeric `chatId` for each person and paste it into the Web Portal under "Family Members"!\n');

  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Network error connecting to Telegram:', err.message);
  }
}

getChatIds();
