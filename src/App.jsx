import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MealPlans } from './pages/MealPlans';
import { MonthlyMealList } from './pages/MonthlyMealList';
import { Members } from './pages/Members';

function App() {
  const [activeTab, setActiveTab] = useState('meals');

  // Handle hash changes for navigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'members' || hash === 'meals' || hash === 'month') {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar activeTab={activeTab} setActiveTab={handleTabChange} />
      <main className="flex-1 pb-16">
        {activeTab === 'meals' && <MealPlans />}
        {activeTab === 'month' && <MonthlyMealList />}
        {activeTab === 'members' && <Members />}
      </main>
      <footer className="py-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-400">
        <p>MealBot Portal • Mandar, Madhura, Pankaj, Vrushali & Agastya • Telegram iPad Notifier</p>
      </footer>
    </div>
  );
}

export default App;
