# 🍽️ Daily Meal Plan Telegram Notifier & Portal

A modern, full-stack, **100% free-tier** meal planning system for families. 

Features:
1. **Web Portal:** React + Vite + Tailwind CSS dashboard to add family members and customize daily meal plans (Breakfast, Lunch, Dinner, Snacks) with weekly calendars and 1-click plan duplication.
2. **Automated Telegram Notifier:** GitHub Actions cron workflow that queries Firestore every morning and delivers personalized meal plans directly to each family member's Telegram chat.

---

## 🏗️ Architecture & Free Tier Stack

- **Database & Auth:** Firebase Firestore & Firebase Authentication (Email/Password) on the **Spark (Free) Plan**.
- **Web App Hosting:** Firebase Hosting (Free SSL + CDN).
- **Daily Notification Engine:** Node.js script run via **GitHub Actions** (`cron` schedule) — *Bypasses Firebase Spark Plan outbound network restrictions without needing billing or credit cards.*
- **Messaging:** Telegram Bot API (Free via `@BotFather`).

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Set Up Firebase (Free Spark Plan)

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Add project** (e.g. `family-meal-planner`).
2. **Enable Firestore Database:**
   - In the sidebar, go to **Build > Firestore Database** -> Click **Create database**.
   - Select a location (e.g. `nam5 (us-central)` or `asia-south1`).
   - Start in **Production mode**.
3. **Enable Firebase Authentication:**
   - In the sidebar, go to **Build > Authentication** -> Click **Get Started**.
   - Under the **Sign-in method** tab, enable **Email/Password**.
   - Under the **Users** tab, click **Add user** and create your admin account (e.g. `admin@example.com` and a secure password).
4. **Register Web App & Get Config Keys:**
   - In Project Settings (gear icon ⚙️), scroll to *Your apps* -> click the **Web icon (`</>`)**.
   - Register the app as `Meal Planner Portal`.
   - Copy the `firebaseConfig` object values into a `.env` file in the project root:
     ```env
     VITE_FIREBASE_API_KEY=AIzaSy...
     VITE_FIREBASE_AUTH_DOMAIN=family-meal-planner.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID=family-meal-planner
     VITE_FIREBASE_STORAGE_BUCKET=family-meal-planner.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
     VITE_FIREBASE_APP_ID=1:1234567890:web:...
     ```
5. **Generate Service Account Key for the Daily Notifier:**
   - In Firebase Console > **Project Settings (⚙️) > Service accounts** tab.
   - Click **Generate new private key** -> Download the JSON file.
   - *(Keep this file secure! You'll use its JSON contents in GitHub Secrets).*

---

### Step 2: Create Telegram Bot & Find Member Chat IDs

1. **Create the Bot:**
   - Open Telegram and search for [@BotFather](https://t.me/BotFather).
   - Send `/newbot` and follow the prompts (choose a name and username ending in `bot`, e.g., `MyFamilyMealBot`).
   - Copy the **Bot Token** (e.g., `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`).
2. **Get Member Chat IDs:**
   - Have each family member open your bot in Telegram and hit **Start** (or send a quick message like "hello").
   - In the `notifier/` directory, create a `.env` file containing `TELEGRAM_BOT_TOKEN=your_token_here`.
   - Run the helper script:
     ```bash
     cd notifier
     npm install
     npm run get-chat-ids
     ```
   - It will print a table showing each member's name and their **Telegram Chat ID**.
   - *(Alternative: visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser to inspect chat IDs).*

---

### Step 3: Configure GitHub Repository Secrets

Push this codebase to a GitHub repository (Public or Private). Then:

1. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret** and add:
   - `FIREBASE_SERVICE_ACCOUNT`: Paste the entire content of the downloaded Firebase service account JSON file.
   - `TELEGRAM_BOT_TOKEN`: Paste the Telegram bot token from `@BotFather`.
3. *(Optional Variables)* Under **Variables** tab, you can set:
   - `TIMEZONE`: e.g. `Asia/Kolkata` (defaults to `Asia/Kolkata`).
   - `NOTIFY_IF_EMPTY`: `true` or `false` (default: `false`).

---

### Step 4: Deploy the Web Portal to Firebase Hosting

1. Install Firebase CLI globally if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```
2. Log into Firebase:
   ```bash
   firebase login
   ```
3. Link your Firebase project in `.firebaserc` or run:
   ```bash
   firebase use --add
   ```
4. Build the web app and deploy:
   ```bash
   npm install
   npm run build
   firebase deploy
   ```
5. Open the Firebase Hosting URL shown in your terminal, log in with your admin credentials, and start adding family members & meal plans!

---

### Step 5: Test the Telegram Daily Notifier

1. **Manual Test via GitHub Actions (`workflow_dispatch`):**
   - Go to your GitHub repository > **Actions** tab.
   - Select **Daily Meal Plan Telegram Notifier** on the left.
   - Click **Run workflow**. You can enable `Dry run mode` or test sending live notifications.
2. **Local Test (Optional):**
   ```bash
   cd notifier
   # In notifier/.env set TELEGRAM_BOT_TOKEN and FIREBASE_SERVICE_ACCOUNT
   npm run notify
   ```

---

## ⏰ Cron Schedule Customization

The workflow schedule is in `.github/workflows/daily-meal-notify.yml`. GitHub Actions runs cron triggers in **UTC time**.

| Target Local Time | Timezone Offset | UTC Equivalent | Cron Expression |
| :--- | :--- | :--- | :--- |
| **07:00 AM IST** | UTC + 5:30 | 01:30 UTC | `cron: '30 1 * * *'` *(Default)* |
| **07:00 AM EST** | UTC - 5:00 | 12:00 UTC | `cron: '0 12 * * *'` |
| **07:00 AM PST** | UTC - 8:00 | 15:00 UTC | `cron: '0 15 * * *'` |
| **07:30 AM GMT** | UTC + 0:00 | 07:30 UTC | `cron: '30 7 * * *'` |

---

## 📁 Repository Structure

```
.
├── .github/workflows/
│   └── daily-meal-notify.yml     # Automated morning cron workflow
├── notifier/
│   ├── notify.js                 # Daily notification engine (Firebase Admin + Telegram API)
│   ├── get-chat-ids.js           # CLI utility to find family Telegram Chat IDs
│   ├── package.json
│   └── .env.example
├── src/
│   ├── components/               # Modals, Navbar, cards
│   ├── context/                  # AuthContext (Firebase Auth)
│   ├── pages/                    # MealPlans & Members management
│   ├── services/                 # Firestore CRUD & Firebase client
│   ├── App.jsx
│   └── main.jsx
├── firebase.json                 # Firebase Hosting & Firestore rules config
├── firestore.rules               # Authenticated-only Firestore security rules
├── package.json
├── tailwind.config.js
└── README.md
```
