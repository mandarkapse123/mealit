import React, { useState, useEffect } from 'react';
import { getMembers } from '../services/memberService';
import { getMealPlansForMonth, saveMealPlan, duplicateMealPlan } from '../services/mealPlanService';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { DuplicateModal } from '../components/DuplicateModal';
import * as XLSX from 'xlsx';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Edit3, 
  Copy, 
  Search, 
  Download, 
  Upload, 
  Check, 
  X, 
  Sun, 
  Utensils, 
  Moon, 
  Cookie, 
  RefreshCw, 
  Printer,
  Heart
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isWeekend,
  parseISO 
} from 'date-fns';

export const MonthlyMealList = () => {
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [monthPlans, setMonthPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Row Quick Edit Modal
  const [editingDay, setEditingDay] = useState(null);
  const [editingMeals, setEditingMeals] = useState({ breakfast: '', lunch: '', dinner: '', snacks: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // Duplication & Bulk Modals
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // 1. Load initial members
  const fetchMembers = async () => {
    try {
      const data = await getMembers();
      setMembers(data);
      if (data.length > 0 && !selectedMemberId) {
        setSelectedMemberId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // 2. Fetch month plans whenever selectedMemberId or currentMonthDate changes
  const fetchMonthPlans = async () => {
    if (!selectedMemberId) return;
    try {
      setLoading(true);
      const data = await getMealPlansForMonth(selectedMemberId, currentMonthDate);
      setMonthPlans(data);
    } catch (err) {
      console.error('Failed to load month plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthPlans();
  }, [selectedMemberId, currentMonthDate]);

  // Month navigation
  const handlePrevMonth = () => setCurrentMonthDate(subMonths(currentMonthDate, 1));
  const handleNextMonth = () => setCurrentMonthDate(addMonths(currentMonthDate, 1));
  const handleCurrentMonth = () => setCurrentMonthDate(new Date());

  // Days of the active month
  const monthStart = startOfMonth(currentMonthDate);
  const monthEnd = endOfMonth(currentMonthDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const currentMember = members.find(m => m.id === selectedMemberId);

  // Quick edit handlers
  const handleOpenEdit = (dayDateStr) => {
    const existing = monthPlans[dayDateStr] || { breakfast: '', lunch: '', dinner: '', snacks: '' };
    setEditingDay(dayDateStr);
    setEditingMeals({
      breakfast: existing.breakfast || '',
      lunch: existing.lunch || '',
      dinner: existing.dinner || '',
      snacks: existing.snacks || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingDay || !selectedMemberId) return;
    try {
      setSavingEdit(true);
      await saveMealPlan({
        memberId: selectedMemberId,
        date: editingDay,
        ...editingMeals
      });
      setMonthPlans(prev => ({
        ...prev,
        [editingDay]: {
          memberId: selectedMemberId,
          date: editingDay,
          ...editingMeals
        }
      }));
      setEditingDay(null);
    } catch (err) {
      alert('Failed to save meal plan: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Export to Excel
  const handleExportMonth = () => {
    const exportData = daysInMonth.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const plan = monthPlans[dateStr] || {};
      return {
        'Date': dateStr,
        'Day': format(day, 'EEEE'),
        'Member': currentMember?.name || 'Family',
        'Diet': currentMember?.diet || 'Veg',
        'Breakfast': plan.breakfast || '',
        'Lunch': plan.lunch || '',
        'Snacks': plan.snacks || '',
        'Dinner': plan.dinner || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, format(currentMonthDate, 'MMM_yyyy'));
    XLSX.writeFile(wb, `${currentMember?.name || 'Member'}_Meals_${format(currentMonthDate, 'yyyy-MM')}.xlsx`);
  };

  // Filter rows based on search
  const filteredDays = daysInMonth.filter(day => {
    if (!searchQuery.trim()) return true;
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayName = format(day, 'EEEE');
    const plan = monthPlans[dateStr] || {};
    const text = `${dateStr} ${dayName} ${plan.breakfast || ''} ${plan.lunch || ''} ${plan.dinner || ''} ${plan.snacks || ''}`.toLowerCase();
    return text.includes(searchQuery.toLowerCase());
  });

  const totalPlannedDays = Object.values(monthPlans).filter(p => p.breakfast || p.lunch || p.dinner || p.snacks).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      
      {/* ========================================================================= */}
      {/* 1. STATIONARY STICKY TOP CONTROL PANEL (Remains fixed while scrolling)    */}
      {/* ========================================================================= */}
      <div className="sticky top-16 z-30 bg-slate-50/95 backdrop-blur-md pt-2 pb-3 space-y-3 border-b border-slate-200/60 shadow-xs">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Monthly Meal Plan Chart
                </h2>
                {currentMember && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                    currentMember.diet === 'Veg' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {currentMember.diet || 'Veg'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing full month breakdown for the selected family member.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={() => setIsBulkModalOpen(true)}
                className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all flex items-center gap-1.5 shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Bulk Upload (Excel/PDF)</span>
              </button>
              <button
                onClick={handleExportMonth}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Month</span>
              </button>
              <button
                onClick={() => window.print()}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors hidden sm:flex"
                title="Print Monthly Chart"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Member Selection Chips */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Select Member ({members.length} Family Members)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const isSelected = selectedMemberId === m.id;
                const isVeg = m.diet === 'Veg';
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 font-bold scale-102'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    <span>{m.name}</span>
                    {m.age && <span className="opacity-80 text-[10px]">({m.age})</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Month Selector Bar */}
        <div className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h3 className="text-sm sm:text-base font-bold text-slate-800 min-w-[150px] text-center">
              {format(currentMonthDate, 'MMMM yyyy')}
            </h3>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleCurrentMonth}
              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider ml-1"
            >
              This Month
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search dishes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-[11px] font-bold whitespace-nowrap bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-100">
              {totalPlannedDays} / {daysInMonth.length} Days Planned
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. THE SCROLLABLE MONTHLY MEAL TABLE                                      */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm font-medium">Loading {currentMember?.name}'s monthly meal list...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-100">
              <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="py-3 px-3.5 w-28 bg-slate-100">Date & Day</th>
                  <th className="py-3 px-3 bg-slate-100">
                    <span className="flex items-center gap-1 text-amber-700">
                      <Sun className="w-3.5 h-3.5 text-amber-500" /> Breakfast
                    </span>
                  </th>
                  <th className="py-3 px-3 bg-slate-100">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Utensils className="w-3.5 h-3.5 text-emerald-500" /> Lunch
                    </span>
                  </th>
                  <th className="py-3 px-3 bg-slate-100">
                    <span className="flex items-center gap-1 text-purple-700">
                      <Cookie className="w-3.5 h-3.5 text-purple-500" /> Snacks
                    </span>
                  </th>
                  <th className="py-3 px-3 bg-slate-100">
                    <span className="flex items-center gap-1 text-indigo-700">
                      <Moon className="w-3.5 h-3.5 text-indigo-500" /> Dinner
                    </span>
                  </th>
                  <th className="py-3 px-3 text-center w-24 bg-slate-100">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredDays.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isTodayDate = isSameDay(day, new Date());
                  const isWeekendDay = isWeekend(day);
                  const plan = monthPlans[dateStr] || {};
                  const hasAny = plan.breakfast || plan.lunch || plan.dinner || plan.snacks;

                  return (
                    <tr
                      key={dateStr}
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isTodayDate ? 'bg-emerald-50/40 font-medium' : isWeekendDay ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Date & Day */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex flex-col items-center justify-center font-bold text-[10px] ${
                            isTodayDate 
                              ? 'bg-emerald-600 text-white shadow-xs' 
                              : isWeekendDay 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <span className="text-[8px] uppercase leading-none">{format(day, 'EEE')}</span>
                            <span className="text-[11px] leading-tight">{format(day, 'd')}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{format(day, 'MMM d')}</div>
                            <div className="text-[9px] text-slate-400 font-mono">{dateStr}</div>
                          </div>
                        </div>
                      </td>

                      {/* Breakfast */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        {plan.breakfast ? (
                          <div className="text-slate-800 line-clamp-2 leading-relaxed bg-amber-50/50 p-1.5 rounded-lg border border-amber-100/60">
                            {plan.breakfast}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Lunch */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        {plan.lunch ? (
                          <div className="text-slate-800 line-clamp-2 leading-relaxed bg-emerald-50/50 p-1.5 rounded-lg border border-emerald-100/60">
                            {plan.lunch}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Snacks */}
                      <td className="py-2.5 px-3 max-w-[180px]">
                        {plan.snacks ? (
                          <div className="text-slate-800 line-clamp-2 leading-relaxed bg-purple-50/50 p-1.5 rounded-lg border border-purple-100/60">
                            {plan.snacks}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Dinner */}
                      <td className="py-2.5 px-3 max-w-[200px]">
                        {plan.dinner ? (
                          <div className="text-slate-800 line-clamp-2 leading-relaxed bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100/60">
                            {plan.dinner}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">Not set</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => handleOpenEdit(dateStr)}
                            className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors font-medium flex items-center gap-1 text-[11px]"
                            title="Edit meals for this date"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          {hasAny && (
                            <button
                              onClick={() => setDuplicateSource({ dateStr, plan })}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                              title="Copy this day's diet to other days"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Edit Row Modal */}
      {editingDay && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-600" />
                  Edit Diet: {currentMember?.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {format(parseISO(editingDay), 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={() => setEditingDay(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-amber-700 mb-1 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-500" /> Breakfast
                </label>
                <input
                  type="text"
                  value={editingMeals.breakfast}
                  onChange={(e) => setEditingMeals({ ...editingMeals, breakfast: e.target.value })}
                  placeholder="e.g. Oatmeal with fruits, eggs & toast"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-emerald-700 mb-1 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-emerald-500" /> Lunch
                </label>
                <input
                  type="text"
                  value={editingMeals.lunch}
                  onChange={(e) => setEditingMeals({ ...editingMeals, lunch: e.target.value })}
                  placeholder="e.g. Paneer wrap, quinoa salad, chicken bowl"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-purple-700 mb-1 flex items-center gap-1.5">
                  <Cookie className="w-3.5 h-3.5 text-purple-500" /> Snacks & Extras
                </label>
                <input
                  type="text"
                  value={editingMeals.snacks}
                  onChange={(e) => setEditingMeals({ ...editingMeals, snacks: e.target.value })}
                  placeholder="e.g. Greek yogurt, walnuts, seasonal fruit"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block font-bold text-indigo-700 mb-1 flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-indigo-500" /> Dinner
                </label>
                <input
                  type="text"
                  value={editingMeals.dinner}
                  onChange={(e) => setEditingMeals({ ...editingMeals, dinner: e.target.value })}
                  placeholder="e.g. Soup with multigrain roti, steamed fish"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{savingEdit ? 'Saving...' : 'Save Meals'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Day Modal */}
      {duplicateSource && (
        <DuplicateModal
          isOpen={Boolean(duplicateSource)}
          onClose={() => setDuplicateSource(null)}
          sourceDate={duplicateSource.dateStr}
          memberName={currentMember?.name || 'Member'}
          currentPlan={duplicateSource.plan}
          onDuplicate={async (dates) => {
            await duplicateMealPlan({
              memberId: selectedMemberId,
              ...duplicateSource.plan
            }, dates);
            await fetchMonthPlans();
            setDuplicateSource(null);
          }}
        />
      )}

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        members={members}
        onImportSuccess={fetchMonthPlans}
      />

    </div>
  );
};
