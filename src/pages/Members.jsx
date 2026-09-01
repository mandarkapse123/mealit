import React, { useState, useEffect } from 'react';
import { getMembers, addMember, updateMember, deleteMember } from '../services/memberService';
import { MemberModal } from '../components/MemberModal';
import { 
  Users, 
  UserPlus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  HelpCircle, 
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Utensils,
  Heart
} from 'lucide-react';

export const Members = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getMembers();
      setMembers(data);
    } catch (err) {
      setError('Failed to load family members.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingMember(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member) => {
    setEditingMember(member);
    setIsModalOpen(true);
  };

  const handleSaveMember = async (memberData) => {
    if (editingMember) {
      await updateMember(editingMember.id, memberData);
    } else {
      await addMember(memberData);
    }
    await fetchMembers();
  };

  const handleDeleteMember = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name}?`)) {
      try {
        await deleteMember(id);
        await fetchMembers();
      } catch (err) {
        alert('Failed to delete member: ' + err.message);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-7 h-7 text-emerald-600" />
            Family Members (5 Profiles)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure each family member's Name, Age, Relation, and Dietary preference (Veg / Non-Veg).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Member Cards Grid */}
      <div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
            <p className="text-sm font-medium">Loading family members...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {members.map((member) => {
              const isVeg = member.diet === 'Veg';
              const isEgg = member.diet === 'Eggetarian';
              const isNonVeg = member.diet === 'Non-Veg';

              return (
                <div
                  key={member.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs ${
                          isVeg ? 'bg-emerald-600' : isNonVeg ? 'bg-rose-600' : 'bg-amber-500'
                        }`}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-base">{member.name}</h3>
                            {member.age && (
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                Age {member.age}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            <Heart className="w-3 h-3 text-rose-400" />
                            {member.relation || 'Family Member'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(member)}
                          className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Edit member details"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id, member.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          title="Delete member"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Diet Badge & Settings */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold flex items-center gap-1">
                        <Utensils className="w-3.5 h-3.5 text-slate-400" />
                        Diet:
                      </span>
                      <span className={`font-bold px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 ${
                        isVeg 
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                          : isNonVeg 
                          ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${isVeg ? 'bg-emerald-600' : isNonVeg ? 'bg-rose-600' : 'bg-amber-500'}`}></span>
                        {member.diet || 'Veg'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMember}
        member={editingMember}
      />
    </div>
  );
};
