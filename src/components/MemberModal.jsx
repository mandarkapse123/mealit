import React, { useState, useEffect } from 'react';
import { X, User, AlertCircle, Heart, Utensils, Hash, Tag } from 'lucide-react';

export const MemberModal = ({ isOpen, onClose, onSave, member = null }) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [relation, setRelation] = useState('Self');
  const [diet, setDiet] = useState('Non-Veg'); // 'Veg' | 'Non-Veg' | 'Eggetarian'
  const [telegramChatId, setTelegramChatId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const relationsList = ['Self', 'Spouse', 'Mother', 'Father', 'Brother', 'Sister', 'Son', 'Daughter', 'Child', 'Grandparent', 'Other'];

  useEffect(() => {
    if (member) {
      setName(member.name || '');
      setAge(member.age || '');
      setRelation(member.relation || 'Self');
      setDiet(member.diet || 'Veg');
      setTelegramChatId(member.telegramChatId || '');
    } else {
      setName('');
      setAge('');
      setRelation('Family');
      setDiet('Veg');
      setTelegramChatId('');
    }
    setError('');
  }, [member, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Member name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      await onSave({
        name,
        age: age ? Number(age) : '',
        relation,
        diet,
        telegramChatId
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-600" />
            {member ? 'Edit Member Details' : 'Add Family Member'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Age Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mandar, Madhura"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                Age
              </label>
              <input
                type="number"
                min="0"
                max="120"
                placeholder="e.g. 31"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          {/* Relation Dropdown */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Relation / Role
            </label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
            >
              {relationsList.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Dietary Preference (Veg vs Non-Veg) */}
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5 text-emerald-600" />
              Dietary Preference
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDiet('Veg')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-center flex items-center justify-center gap-1.5 transition-all ${
                  diet === 'Veg'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 flex-shrink-0"></span>
                <span>Veg 🟢</span>
              </button>

              <button
                type="button"
                onClick={() => setDiet('Non-Veg')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-center flex items-center justify-center gap-1.5 transition-all ${
                  diet === 'Non-Veg'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 flex-shrink-0"></span>
                <span>Non-Veg 🔴</span>
              </button>

              <button
                type="button"
                onClick={() => setDiet('Eggetarian')}
                className={`py-2 px-2.5 rounded-xl border font-bold text-center flex items-center justify-center gap-1.5 transition-all ${
                  diet === 'Eggetarian'
                    ? 'border-amber-600 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 flex-shrink-0"></span>
                <span>Egg 🟡</span>
              </button>
            </div>
          </div>

          {/* Telegram Chat ID (Optional) */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">
              Personal Telegram Chat ID (Optional)
            </label>
            <input
              type="text"
              placeholder="Leave empty if using shared iPad Telegram"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Since all 5 family members use the iPad Telegram, you can leave this blank!
            </p>
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submitting ? 'Saving...' : member ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
