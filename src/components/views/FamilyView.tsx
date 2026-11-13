/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Crown,
  Eye,
  Check,
  Copy,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
  Sparkles,
} from 'lucide-react';
import {
  FamilyGroup,
  FamilyMember,
  FamilyInvitation,
  FamilyRole,
  Transaction,
} from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const FamilyView: React.FC = () => {
  const { user } = useAuth();
  const [group, setGroup] = useState<FamilyGroup | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [sharedTransactions, setSharedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyBudget: '5000000' });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as FamilyRole });
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getFamily();
      setGroup(res.group);
      setMembers(res.members || []);
      setInvitations(res.invitations || []);

      if (res.group) {
        const txRes = await api.getFamilyTransactions();
        setSharedTransactions(txRes.transactions || []);
      }
    } catch (e) {
      console.error('Failed to load family data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name) return;
    try {
      await api.createFamily(createForm.name, parseFloat(createForm.monthlyBudget) || 0);
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to create family:', err);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email) return;
    try {
      const res = await api.inviteFamilyMember(inviteForm.email, inviteForm.role);
      setGeneratedInviteCode(res.invitation.inviteCode);
      await loadData();
    } catch (err) {
      console.error('Failed to send invite:', err);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode) return;
    try {
      await api.acceptFamilyInvite(joinCode.trim().toUpperCase());
      setIsJoinModalOpen(false);
      setJoinCode('');
      await loadData();
    } catch (err: any) {
      setJoinError(err.message || 'Kod notoʻgʻri yoki muddati oʻtgan');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getRoleBadge = (role: FamilyRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <Crown className="w-3 h-3" /> Oila boshligʻi (Owner)
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'member':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
            <Users className="w-3 h-3" /> Aʼzo
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Eye className="w-3 h-3" /> Kuzatuvchi
          </span>
        );
    }
  };

  const totalSharedExpense = sharedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSharedIncome = sharedTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Oilaviy Budjet va Hamkorlik
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Oila aʼzolari bilan birgalikda xarajatlarni rejalashtiring va umumiy maqsadlarga erishing
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!group ? (
            <>
              <button
                onClick={() => setIsJoinModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-xs"
              >
                <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Kod orqali qoʻshilish</span>
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Oila guruhi yaratish</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setGeneratedInviteCode(null);
                setInviteForm({ email: '', role: 'member' });
                setIsInviteModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Aʼzo taklif qilish</span>
            </button>
          )}
        </div>
      </div>

      {!group ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center max-w-xl mx-auto my-8 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
            Siz hali biron bir oila guruhiga aʼzo emassiz
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            Yangi oilaviy budjet guruhini yarating yoki oila aʼzongiz yuborgan taklif kodi orqali mavjud guruhga qoʻshiling.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
            >
              Yangi oila guruhi yaratish
            </button>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Taklif kodi orqali kirish
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Family Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  Oilaviy guruh
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  {members.length} ta aʼzo
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {group.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-blue-100">
                <div>
                  <span className="text-blue-300">Oylik umumiy budjet: </span>
                  <span className="font-bold font-mono text-white">
                    {formatMoney(group.monthlyBudget, group.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-blue-300">Ushbu oy sarflandi: </span>
                  <span className="font-bold font-mono text-white">
                    {formatMoney(totalSharedExpense, group.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 text-xs text-slate-200 max-w-sm">
              <div className="flex items-center gap-2 font-semibold text-white mb-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Maxfiylik nazorati:</span>
              </div>
              Har bir tranzaksiyani kiritishda uni "Oilaviy" yoki "Shaxsiy" deb belgilashingiz mumkin. Shaxsiy yozuvlaringizni boshqa aʼzolar koʻra olmaydi.
            </div>
          </div>

          {/* Members List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Guruh aʼzolari ({members.length})
              </h3>
              <button
                onClick={() => {
                  setGeneratedInviteCode(null);
                  setInviteForm({ email: '', role: 'member' });
                  setIsInviteModalOpen(true);
                }}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Yangi aʼzo taklif qilish</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={member.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                      alt={member.fullName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                    <div className="overflow-hidden">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {member.fullName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {member.email}
                      </div>
                      <div className="mt-1">{getRoleBadge(member.role)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending Invitations */}
            {invitations.filter((i) => i.status === 'pending').length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Kutilayotgan taklifnomalar
                </div>
                <div className="space-y-2">
                  {invitations
                    .filter((i) => i.status === 'pending')
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.email}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-2">
                            ({inv.role.toUpperCase()})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 font-mono font-bold text-amber-800 dark:text-amber-300">
                            {inv.inviteCode}
                          </code>
                          <button
                            onClick={() => copyToClipboard(inv.inviteCode)}
                            className="p-1 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-200/50"
                            title="Nusxalash"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Shared Transactions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Umumiy oilaviy xarajatlar va daromadlar
                </h3>
                <p className="text-[11px] text-slate-400">
                  Barcha aʼzolar tomonidan kiritilgan ochiq operatsiyalar
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {sharedTransactions.length} ta yozuv
              </span>
            </div>

            {sharedTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Hozircha birgalikda kiritilgan operatsiyalar yoʻq. Tranzaksiya qoʻshishda "Oilaviy" belgisini tanlang.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Sana</th>
                      <th className="py-2.5 px-4">Tavsif</th>
                      <th className="py-2.5 px-4">Kategoriya</th>
                      <th className="py-2.5 px-4">Aʼzo</th>
                      <th className="py-2.5 px-4 text-right">Summa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {sharedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {tx.date}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {tx.description}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {tx.categoryName}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-medium">
                          {tx.createdByMemberName || 'Oila aʼzosi'}
                        </td>
                        <td className={`py-3 px-4 font-mono font-bold text-right ${
                          tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount, 'UZS')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Family Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Yangi oilaviy guruh yaratish
            </h3>
            <form onSubmit={handleCreateFamily} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Oila guruhi nomi
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masalan: Karimovlar oilasi"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Oylik rejalashtirilgan budjet (UZS)
                </label>
                <input
                  type="number"
                  step="100000"
                  required
                  value={createForm.monthlyBudget}
                  onChange={(e) => setCreateForm({ ...createForm, monthlyBudget: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Guruhni yaratish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Oila aʼzosini taklif qilish
            </h3>

            {generatedInviteCode ? (
              <div className="mt-4 space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-center">
                  <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                    Taklif kodi muvaffaqiyatli yaratildi! Ushbu kodni aʼzoga yuboring:
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-2xl font-mono font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider">
                      {generatedInviteCode}
                    </span>
                    <button
                      onClick={() => copyToClipboard(generatedInviteCode)}
                      className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                      title="Nusxa olish"
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2">
                    Ushbu kod 7 kun davomida amal qiladi.
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
                  >
                    Tayyor
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Aʼzo email manzili
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="masalan: turmush_ortogim@gmail.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Roli va huquqlari
                  </label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as FamilyRole })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="member">Aʼzo (Kiritish, tahrirlash huquqi)</option>
                    <option value="admin">Admin (Taklif qilish va toʻliq boshqaruv)</option>
                    <option value="viewer">Kuzatuvchi (Faqat koʻrish huquqi)</option>
                  </select>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Bekor qilish
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                  >
                    Kod yaratish
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Join Family by Code Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 pb-3 border-b border-slate-100 dark:border-slate-800">
              Taklif kodi orqali guruhga qoʻshilish
            </h3>

            {joinError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {joinError}
              </div>
            )}

            <form onSubmit={handleAcceptInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Taklif kodi (FAM-XXXXXX)
                </label>
                <input
                  type="text"
                  required
                  placeholder="FAM-123456"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-mono uppercase tracking-wider text-center"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsJoinModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Guruhga qoʻshilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
