import React, { useState, useEffect } from 'react';
import { getMembers } from '../services/memberService';
import { getMealPlan, saveMealPlan, getMealPlansForRange, duplicateMealPlan } from '../services/mealPlanService';
import { DuplicateModal } from '../components/DuplicateModal';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Save, 
  Sun, 
  Utensils, 
  Moon, 
  Cookie, 
  Users, 
  Check, 
  AlertCircle,
  RefreshCw,
  Upload,
  ArrowRight
} from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';

export const MealPlans = () => {
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [meals, setMeals] = useState({
    breakfast: '',
    lunch: '',
    dinner: '',
    snacks: ''
  });

  const [weekOverview, setWeekOverview] = useState({});
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // Load members on mount
  const loadInitialMembers = async () => {
    try {
      setLoadingMembers(true);
      const data = await getMembers();
      setMembers(data);
      if (data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load members.');
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadInitialMembers();
  }, []);

  const fetchPlanAndWeek = async () => {
    if (!selectedMemberId) return;
    try {
      setLoadingPlan(true);
      setErrorMessage('');
      setSavedStatus(false);

      // Fetch selected day's plan
      const plan = await getMealPlan(selectedMemberId, selectedDate);
      if (plan) {
        setMeals({
          breakfast: plan.breakfast || '',
          lunch: plan.lunch || '',
          dinner: plan.dinner || '',
          snacks: plan.snacks || ''
        });
      } else {
        setMeals({
          breakfast: '',
          lunch: '',
          dinner: '',
          snacks: ''
        });
      }

      // Fetch current week overview
      const currentDateObj = parseISO(selectedDate);
      const start = format(startOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekData = await getMealPlansForRange(selectedMemberId, start, end);
      setWeekOverview(weekData);

    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load meal plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  // Fetch meal plan & weekly strip when selectedMember or selectedDate changes
  useEffect(() => {
    fetchPlanAndWeek();
  }, [selectedMemberId, selectedDate]);

  const handleDateChange = (newDateStr) => {
    setSelectedDate(newDateStr);
  };

  const handlePrevDay = () => {
    const prev = subDays(parseISO(selectedDate), 1);
    setSelectedDate(format(prev, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const next = addDays(parseISO(selectedDate), 1);
    setSelectedDate(format(next, 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleSave = async () => {
    if (!selectedMemberId) return;
    try {
      setSaving(true);
      setErrorMessage('');
      await saveMealPlan({
        memberId: selectedMemberId,
        date: selectedDate,
        ...meals
      });

      // Update week overview cache
      setWeekOverview(prev => ({
        ...prev,
        [selectedDate]: {
          memberId: selectedMemberId,
          date: selectedDate,
          ...meals
        }
      }));

      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 3000);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to save meal plan: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (targetDates) => {
    try {
      await duplicateMealPlan({
        memberId: selectedMemberId,
        ...meals
      }, targetDates);

      // Refresh week overview
      const currentDateObj = parseISO(selectedDate);
      const start = format(startOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekData = await getMealPlansForRange(selectedMemberId, start, end);
      setWeekOverview(weekData);

      setSavedStatus(true);
      setTimeout(() => setSavedStatus(false), 3000);
    } catch (err) {
      throw err;
    }
  };

  const handleBulkImportSuccess = async () => {
    await loadInitialMembers();
    await fetchPlanAndWeek();
  };

  const currentMember = members.find(m => m.id === selectedMemberId);

  // Generate 7 days for weekly strip
  const currentDateObj = parseISO(selectedDate);
  const weekStart = startOfWeek(currentDateObj, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  if (loadingMembers) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <p className="text-sm">Loading meal planner...</p>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Family Members Found</h2>
          <p className="text-slate-500 text-sm mt-2">
            Before creating meal plans, please add at least one family member.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Upload via Excel / PDF</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const mealSections = [
    {
      id: 'breakfast',
      title: 'Breakfast',
      icon: Sun,
      color: 'amber',
      accentBg: 'bg-amber-500',
      lightBg: 'bg-amber-50/50',
      borderFocus: 'focus:ring-amber-500',
      placeholder: 'e.g. Scrambled eggs with toast, oatmeal, black coffee',
    },
    {
      id: 'lunch',
      title: 'Lunch',
      icon: Utensils,
      color: 'emerald',
      accentBg: 'bg-emerald-500',
      lightBg: 'bg-emerald-50/50',
      borderFocus: 'focus:ring-emerald-500',
      placeholder: 'e.g. Quinoa salad, paneer wrap, chicken bowl',
    },
    {
      id: 'dinner',
      title: 'Dinner',
      icon: Moon,
      color: 'indigo',
      accentBg: 'bg-indigo-500',
      lightBg: 'bg-indigo-50/50',
      borderFocus: 'focus:ring-indigo-500',
      placeholder: 'e.g. Steamed salmon, mixed vegetable soup, roti',
    },
    {
      id: 'snacks',
      title: 'Snacks & Extras',
      icon: Cookie,
      color: 'purple',
      accentBg: 'bg-purple-500',
      lightBg: 'bg-purple-50/50',
      borderFocus: 'focus:ring-purple-500',
      placeholder: 'e.g. Greek yogurt, walnuts, seasonal fruits',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header: Member Selection & Controls */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        {/* Member Selector Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Family Member (All 5 on 1 Telegram)
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const isSelected = selectedMemberId === m.id;
              const isVeg = m.diet === 'Veg';
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm scale-102 ring-2 ring-emerald-600/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  <span>{m.name}</span>
                  {m.age && <span className="opacity-80 text-xs">({m.age})</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Date Navigation & Bulk Upload */}
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            title="Bulk Upload Excel / CSV / PDF"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel / PDF</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition-all font-bold"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-2.5 py-1 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs text-xs font-bold transition-all uppercase tracking-wider"
            >
              Today
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:shadow-xs transition-all font-bold"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7-Day Weekly Strip */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
            Weekly Overview for {currentMember?.name}
          </span>
          <span className="text-xs text-slate-400">
            {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = dateStr === selectedDate;
            const isTodayDate = isSameDay(day, new Date());
            const dayPlan = weekOverview[dateStr];
            const hasMeals = dayPlan && (dayPlan.breakfast || dayPlan.lunch || dayPlan.dinner || dayPlan.snacks);

            return (
              <button
                key={dateStr}
                onClick={() => handleDateChange(dateStr)}
                className={`py-3 px-1 sm:px-2 rounded-xl text-center transition-all flex flex-col items-center justify-between border ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20 font-bold shadow-xs'
                    : isTodayDate
                    ? 'border-slate-300 bg-slate-50 text-slate-900 font-semibold'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 text-slate-600'
                }`}
              >
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  {format(day, 'EEE')}
                </span>
                <span className={`text-sm sm:text-base my-0.5 ${isSelected ? 'text-emerald-700 font-extrabold' : ''}`}>
                  {format(day, 'd')}
                </span>
                <div className="h-1.5 w-full flex justify-center items-center gap-0.5 mt-1">
                  {hasMeals ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  ) : (
                    <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Meal Editor */}
      <div className="space-y-4">
        {/* Banner with date title and duplicate action */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">
              {currentMember?.name}'s Meal Plan
            </span>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5">
              {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDuplicateModalOpen(true)}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-md rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 border border-white/20"
              title="Duplicate to other dates"
            >
              <Copy className="w-4 h-4" />
              <span>Duplicate Plan</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : savedStatus ? (
                <Check className="w-4 h-4 text-emerald-600 font-extrabold" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : savedStatus ? 'Saved!' : 'Save Plan'}</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 4 Meals Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mealSections.map((section) => {
            const Icon = section.icon;
            const mealValue = meals[section.id];

            return (
              <div
                key={section.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-xl text-white ${section.accentBg} shadow-xs`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{section.title}</h3>
                        <span className="text-[11px] text-slate-400 font-medium">Daily meal item</span>
                      </div>
                    </div>

                    {mealValue && (
                      <button
                        type="button"
                        onClick={() => setMeals({ ...meals, [section.id]: '' })}
                        className="text-xs text-slate-400 hover:text-rose-500 font-medium transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      value={mealValue}
                      onChange={(e) => setMeals({ ...meals, [section.id]: e.target.value })}
                      placeholder={section.placeholder}
                      className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 ${section.borderFocus} focus:border-transparent transition-all resize-none`}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>{mealValue.trim().length > 0 ? `${mealValue.trim().length} chars` : 'Empty'}</span>
                  {mealValue.trim().length > 0 && (
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ready for Telegram
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom floating save bar on mobile */}
        <div className="pt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-base"
          >
            {saving ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : savedStatus ? (
              <Check className="w-5 h-5" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            <span>{saving ? 'Saving...' : savedStatus ? 'Saved Successfully!' : 'Save Meal Plan'}</span>
          </button>
        </div>
      </div>

      <DuplicateModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onDuplicate={handleDuplicate}
        sourceDate={selectedDate}
        memberName={currentMember?.name || 'Member'}
        currentPlan={meals}
      />

      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        members={members}
        onImportSuccess={handleBulkImportSuccess}
      />
    </div>
  );
};
