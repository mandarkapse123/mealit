import React, { useState } from 'react';
import { X, Copy, Calendar, Check, AlertCircle } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';

export const DuplicateModal = ({ isOpen, onClose, onDuplicate, sourceDate, memberName, currentPlan }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const baseDate = parseISO(sourceDate);

  // Generate next 7 days list for quick check
  const candidateDays = Array.from({ length: 7 }, (_, i) => addDays(baseDate, i + 1));

  const toggleDate = (dateStr) => {
    if (selectedDates.includes(dateStr)) {
      setSelectedDates(selectedDates.filter(d => d !== dateStr));
    } else {
      setSelectedDates([...selectedDates, dateStr]);
    }
  };

  const selectQuickPreset = (preset) => {
    if (preset === 'tomorrow') {
      const tomorrow = format(addDays(baseDate, 1), 'yyyy-MM-dd');
      setSelectedDates([tomorrow]);
    } else if (preset === 'next3') {
      const next3 = [1, 2, 3].map(i => format(addDays(baseDate, i), 'yyyy-MM-dd'));
      setSelectedDates(next3);
    } else if (preset === 'week') {
      const nextWeek = [1, 2, 3, 4, 5, 6, 7].map(i => format(addDays(baseDate, i), 'yyyy-MM-dd'));
      setSelectedDates(nextWeek);
    } else if (preset === 'clear') {
      setSelectedDates([]);
    }
  };

  const handleConfirm = async () => {
    if (selectedDates.length === 0) {
      setError('Please select at least one target date');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await onDuplicate(selectedDates);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to duplicate meal plan');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
              <Copy className="w-5 h-5 text-emerald-600" />
              Duplicate Meal Plan
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Copying {memberName}'s plan from <span className="font-medium text-slate-700">{format(baseDate, 'EEEE, MMM d')}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick presets */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Quick Selection
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectQuickPreset('tomorrow')}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium transition-colors"
              >
                Tomorrow Only
              </button>
              <button
                type="button"
                onClick={() => selectQuickPreset('next3')}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium transition-colors"
              >
                Next 3 Days
              </button>
              <button
                type="button"
                onClick={() => selectQuickPreset('week')}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300 font-medium transition-colors"
              >
                Next 7 Days
              </button>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => selectQuickPreset('clear')}
                  className="text-xs px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Days picker grid */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Choose Upcoming Days
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {candidateDays.map((d) => {
                const dStr = format(d, 'yyyy-MM-dd');
                const isSelected = selectedDates.includes(dStr);
                return (
                  <button
                    key={dStr}
                    type="button"
                    onClick={() => toggleDate(dStr)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-sm transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 font-medium shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span>{format(d, 'EEE, MMM d')}</span>
                    </div>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Selected: <strong className="text-slate-800">{selectedDates.length}</strong> day(s)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting || selectedDates.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? 'Copying...' : `Copy to ${selectedDates.length} day(s)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
