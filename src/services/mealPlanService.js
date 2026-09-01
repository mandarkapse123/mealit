import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const MEAL_PLANS_COLLECTION = 'mealPlans';
const STORAGE_KEY = 'mealbot_plans_local';

export const getMealPlanDocId = (memberId, date) => `${memberId}_${date}`;

const getLocalPlans = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
};

const saveLocalPlans = (plans) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
};

export const getMealPlan = async (memberId, date) => {
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      const plans = getLocalPlans();
      const docId = getMealPlanDocId(memberId, date);
      return plans[docId] || null;
    }
    const q = query(
      collection(db, MEAL_PLANS_COLLECTION),
      where('memberId', '==', memberId),
      where('date', '==', date)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      const plans = getLocalPlans();
      const docId = getMealPlanDocId(memberId, date);
      return plans[docId] || null;
    }
    const docData = snapshot.docs[0];
    return {
      id: docData.id,
      ...docData.data()
    };
  } catch (error) {
    const plans = getLocalPlans();
    const docId = getMealPlanDocId(memberId, date);
    return plans[docId] || null;
  }
};

export const getMealPlansForRange = async (memberId, startDate, endDate) => {
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      const plans = getLocalPlans();
      const map = {};
      Object.values(plans).forEach(p => {
        if (p.memberId === memberId && p.date >= startDate && p.date <= endDate) {
          map[p.date] = p;
        }
      });
      return map;
    }
    const q = query(
      collection(db, MEAL_PLANS_COLLECTION),
      where('memberId', '==', memberId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const snapshot = await getDocs(q);
    const map = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      map[data.date] = { id: doc.id, ...data };
    });
    return map;
  } catch (error) {
    const plans = getLocalPlans();
    const map = {};
    Object.values(plans).forEach(p => {
      if (p.memberId === memberId && p.date >= startDate && p.date <= endDate) {
        map[p.date] = p;
      }
    });
    return map;
  }
};

export const getMealPlansForMonth = async (memberId, dateObj) => {
  const start = format(startOfMonth(dateObj), 'yyyy-MM-dd');
  const end = format(endOfMonth(dateObj), 'yyyy-MM-dd');
  return getMealPlansForRange(memberId, start, end);
};

export const saveMealPlan = async ({ memberId, date, breakfast = '', lunch = '', dinner = '', snacks = '' }) => {
  const docId = getMealPlanDocId(memberId, date);
  const payload = {
    id: docId,
    memberId,
    date,
    breakfast: (breakfast || '').trim(),
    lunch: (lunch || '').trim(),
    dinner: (dinner || '').trim(),
    snacks: (snacks || '').trim(),
    updatedAt: new Date().toISOString()
  };

  const local = getLocalPlans();
  local[docId] = payload;
  saveLocalPlans(local);

  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' && import.meta.env.VITE_FIREBASE_API_KEY) {
      const planRef = doc(db, MEAL_PLANS_COLLECTION, docId);
      await setDoc(planRef, payload, { merge: true });
    }
  } catch (err) {
    console.warn('Saved locally:', err.message);
  }
  return payload;
};

export const duplicateMealPlan = async (sourcePlan, targetDates) => {
  const local = getLocalPlans();
  const promises = targetDates.map(async (date) => {
    const docId = getMealPlanDocId(sourcePlan.memberId, date);
    const payload = {
      id: docId,
      memberId: sourcePlan.memberId,
      date,
      breakfast: sourcePlan.breakfast || '',
      lunch: sourcePlan.lunch || '',
      dinner: sourcePlan.dinner || '',
      snacks: sourcePlan.snacks || '',
      updatedAt: new Date().toISOString()
    };
    local[docId] = payload;

    if (import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' && import.meta.env.VITE_FIREBASE_API_KEY) {
      const planRef = doc(db, MEAL_PLANS_COLLECTION, docId);
      return setDoc(planRef, payload, { merge: true });
    }
    return Promise.resolve();
  });

  saveLocalPlans(local);
  await Promise.all(promises);
  return true;
};

export const bulkSaveMealPlans = async (plansList) => {
  const local = getLocalPlans();
  const promises = plansList.map(async (plan) => {
    const docId = getMealPlanDocId(plan.memberId, plan.date);
    const payload = {
      id: docId,
      memberId: plan.memberId,
      date: plan.date,
      breakfast: (plan.breakfast || '').trim(),
      lunch: (plan.lunch || '').trim(),
      dinner: (plan.dinner || '').trim(),
      snacks: (plan.snacks || '').trim(),
      updatedAt: new Date().toISOString()
    };
    local[docId] = payload;

    if (import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' && import.meta.env.VITE_FIREBASE_API_KEY) {
      const planRef = doc(db, MEAL_PLANS_COLLECTION, docId);
      return setDoc(planRef, payload, { merge: true });
    }
    return Promise.resolve();
  });

  saveLocalPlans(local);
  await Promise.all(promises);
  return true;
};
