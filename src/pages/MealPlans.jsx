import React, { useState, useEffect, useCallback } from 'react';
import { getMembers } from '../services/memberService';
import { 
  getMealPlan, 
  saveMealPlan, 
  getMealPlansForRange, 
  duplicateMealPlan 
} from '../services/mealPlanService';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { DuplicateModal } from '../components/DuplicateModal';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Copy, 
  Upload, 
  Users, 
  Check, 
  Sun, 
  Utensils, 
  Moon, 
  Cookie,
  AlertCircle,
  RefreshCw,
  CloudCheck
} from 'lucide-react';
import { 
  format, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  parseISO 
} from 'date-fns';

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

  // Modals
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // 1. Initial Load of Members
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
      setErrorMessage('Failed to load family members: ' + err.message);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadInitialMembers();
  }, []);

  // 2. Load Active Meal Plan & Weekly Strip
  const fetchPlanAndWeek = useCallback(async () => {
    if (!selectedMemberId) return;
    try {
      setLoadingPlan(true);
      setErrorMessage('');

      // Fetch active day's plan
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

      // Fetch 7-day range for weekly overview
      const currentDateObj = parseISO(selectedDate);
      const start = format(startOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(currentDateObj, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const weekData = await getMealPlansForRange(selectedMemberId, start, end);
      setWeekOverview(weekData);

    } catch (err) {
      console.error(err);
      setErrorMessage('Could not load plan: ' + err.message);
    } finally {
      setLoadingPlan(false);
    }
  }, [selectedMemberId, selectedDate]);

  useEffect(() => {
    fetchPlanAndWeek();
  }, [fetchPlanAndWeek]);

  // Date Navigation handlers
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

  // Form input changes
  const handleMealChange = (type, value) => {
    setMeals(prev => ({
      ...prev,
      [type]: value
    }));
  };

  // Save Meal Plan
  const handleSavePlan = async (e) => {
    if (e) e.preventDefault();
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
    }
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
        <div className="flex items-center flex-wrap gap-3">
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Excel / PDF</span>
          </button>

          <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-200">
            <button
              onClick={handlePrevDay}
              className="p-2 hover:bg-white rounded-xl text-slate-600 transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-white rounded-xl transition-colors uppercase tracking-wider"
            >
              Today
            </button>

            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 px-2 py-1 focus:outline-none cursor-pointer"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 hover:bg-white rounded-xl text-slate-600 transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Date Strip */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600" />
            Weekly Overview for {currentMember?.name || 'Member'}
          </span>
          <span>
            {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d, yyyy')}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {weekDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isSelected = selectedDate === dateStr;
            const isTodayDate = isSameDay(day, new Date());
            const hasPlan = Boolean(weekOverview[dateStr]?.breakfast || weekOverview[dateStr]?.lunch || weekOverview[dateStr]?.dinner);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center transition-all border ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100/60'
                } ${isTodayDate && !isSelected ? 'border-amber-300 bg-amber-50/30' : ''}`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {format(day, 'EEE')}
                </span>
                <span className={`text-base sm:text-lg font-bold my-0.5 ${isSelected ? 'text-emerald-700' : 'text-slate-800'}`}>
                  {format(day, 'd')}
                </span>
                <div className="h-1.5 flex items-center justify-center mt-1">
                  {hasPlan ? (
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

      {/* Main Meal Editor Form */}
      <form onSubmit={handleSavePlan} className="space-y-6">
        {/* Banner with Actions */}
        <div className="bg-emerald-800 text-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-emerald-200">
              {currentMember?.name}'s Meal Plan
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-0.5">
              {format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDuplicateModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors border border-emerald-600/60 shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate Plan</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                savedStatus
                  ? 'bg-emerald-400 text-emerald-950 ring-2 ring-emerald-300'
                  : 'bg-white text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : savedStatus ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved to Cloud!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Plan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 4 Meal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {mealSections.map((section) => {
            const Icon = section.icon;
            const value = meals[section.id] || '';

            return (
              <div
                key={section.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl ${section.accentBg} text-white flex items-center justify-center shadow-xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">{section.title}</h3>
                      <p className="text-[10px] text-slate-400">Daily meal item</p>
                    </div>
                  </div>

                  {value && (
                    <button
                      type="button"
                      onClick={() => handleMealChange(section.id, '')}
                      className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={3}
                    value={value}
                    onChange={(e) => handleMealChange(section.id, e.target.value)}
                    placeholder={section.placeholder}
                    className={`w-full p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${section.borderFocus} transition-all leading-relaxed`}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                  <span>{value ? `${value.length} characters` : 'Empty'}</span>
                  {value && (
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Ready
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </form>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        members={members}
        onImportSuccess={handleBulkImportSuccess}
      />

      {/* Duplicate Plan Modal */}
      <DuplicateModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        sourceDate={selectedDate}
        memberName={currentMember?.name || 'Member'}
        currentPlan={meals}
        onDuplicate={handleDuplicate}
      />

    </div>
  );
};
