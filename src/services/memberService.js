import { 
  collection, 
  getDocs, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';

const MEMBERS_COLLECTION = 'members';
const STORAGE_KEY = 'mealbot_members_v2';

export const defaultMembers = [
  { id: 'member-mandar', name: 'Mandar', age: 31, relation: 'Self', diet: 'Non-Veg', telegramChatId: '', createdAt: new Date().toISOString() },
  { id: 'member-madhura', name: 'Madhura', age: 33, relation: 'Spouse', diet: 'Non-Veg', telegramChatId: '', createdAt: new Date().toISOString() },
  { id: 'member-pankaj', name: 'Pankaj', age: 33, relation: 'Brother', diet: 'Non-Veg', telegramChatId: '', createdAt: new Date().toISOString() },
  { id: 'member-vrushali', name: 'Vrushali', age: 60, relation: 'Mother', diet: 'Veg', telegramChatId: '', createdAt: new Date().toISOString() },
  { id: 'member-agastya', name: 'Agastya', age: 3, relation: 'Son', diet: 'Non-Veg', telegramChatId: '', createdAt: new Date().toISOString() }
];

const getLocalMembers = () => {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMembers));
    return defaultMembers;
  }
  try {
    const parsed = JSON.parse(data);
    return parsed.length > 0 ? parsed : defaultMembers;
  } catch {
    return defaultMembers;
  }
};

const saveLocalMembers = (members) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
};

export const getMembers = async () => {
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      return getLocalMembers();
    }
    const q = query(collection(db, MEMBERS_COLLECTION), orderBy('createdAt', 'asc'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return getLocalMembers();
    }
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.warn('Firestore not connected yet, using local storage:', error.message);
    return getLocalMembers();
  }
};

export const addMember = async (memberData) => {
  const payload = {
    name: memberData.name.trim(),
    age: memberData.age ? Number(memberData.age) : '',
    relation: (memberData.relation || 'Family').trim(),
    diet: memberData.diet || 'Veg', // 'Veg' | 'Non-Veg' | 'Eggetarian'
    telegramChatId: (memberData.telegramChatId || '').trim(),
    createdAt: new Date().toISOString()
  };

  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      const current = getLocalMembers();
      const newMember = {
        id: 'member-' + Date.now(),
        ...payload
      };
      saveLocalMembers([...current, newMember]);
      return newMember;
    }
    const docRef = await addDoc(collection(db, MEMBERS_COLLECTION), payload);
    return { id: docRef.id, ...payload };
  } catch (error) {
    console.warn('Fallback to local storage for addMember:', error.message);
    const current = getLocalMembers();
    const newMember = {
      id: 'member-' + Date.now(),
      ...payload
    };
    saveLocalMembers([...current, newMember]);
    return newMember;
  }
};

export const updateMember = async (id, memberData) => {
  const payload = {
    name: memberData.name.trim(),
    age: memberData.age ? Number(memberData.age) : '',
    relation: (memberData.relation || 'Family').trim(),
    diet: memberData.diet || 'Veg',
    telegramChatId: (memberData.telegramChatId || '').trim(),
    updatedAt: new Date().toISOString()
  };

  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      const current = getLocalMembers();
      const updated = current.map(m => m.id === id ? { ...m, ...payload } : m);
      saveLocalMembers(updated);
      return { id, ...payload };
    }
    const memberRef = doc(db, MEMBERS_COLLECTION, id);
    await updateDoc(memberRef, payload);
    return { id, ...payload };
  } catch (error) {
    console.warn('Fallback to local storage for updateMember:', error.message);
    const current = getLocalMembers();
    const updated = current.map(m => m.id === id ? { ...m, ...payload } : m);
    saveLocalMembers(updated);
    return { id, ...payload };
  }
};

export const deleteMember = async (id) => {
  try {
    if (import.meta.env.VITE_FIREBASE_API_KEY === 'demo-key' || !import.meta.env.VITE_FIREBASE_API_KEY) {
      const current = getLocalMembers();
      saveLocalMembers(current.filter(m => m.id !== id));
      return id;
    }
    const memberRef = doc(db, MEMBERS_COLLECTION, id);
    await deleteDoc(memberRef);
    return id;
  } catch (error) {
    console.warn('Fallback to local storage for deleteMember:', error.message);
    const current = getLocalMembers();
    saveLocalMembers(current.filter(m => m.id !== id));
    return id;
  }
};
