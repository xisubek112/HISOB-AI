/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Lock,
} from 'lucide-react';
import {
  FamilyGroup,
  FamilyMember,
  FamilyInvitation,
  FamilyRole,
  Transaction,
} from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  TransactionRow,
  useToast,
} from '../../design-system/index.ts';

export const FamilyView: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [group, setGroup] = useState<FamilyGroup | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invitations, setInvitations] = useState<FamilyInvitation[]>([]);
  const [sharedTransactions, setSharedTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyBudget: '5000000' });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as FamilyRole });
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  const loadData = useCallback(async () => {
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
      } else {
        setSharedTransactions([]);
      }
    } catch (e) {
      console.error('Failed to load family data:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    try {
      await api.createFamily(createForm.name.trim(), parseFloat(createForm.monthlyBudget) || 0);
      setIsCreateModalOpen(false);
      toast.success('Oilaviy guruh yaratildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Guruh yaratishda xatolik');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email.trim()) return;
    try {
      const res = await api.inviteFamilyMember(inviteForm.email.trim(), inviteForm.role);
      setGeneratedInviteCode(res.invitation.inviteCode);
      toast.success('Taklif kodi yaratildi');
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Taklif yaratishda xatolik');
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    if (!joinCode.trim()) return;
    try {
      await api.acceptFamilyInvite(joinCode.trim().toUpperCase());
      setIsJoinModalOpen(false);
      setJoinCode('');
      toast.success('Oilaviy guruhga muvaffaqiyatli qoʻshildingiz');
      await loadData();
    } catch (err: any) {
      setJoinError(err?.message || 'Kod notoʻgʻri yoki muddati oʻtgan');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Taklif kodi nusxalandi');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getRoleBadge = (role: FamilyRole) => {
    switch (role) {
      case 'owner':
        return (
          <Badge tone="amber">
            <Crown className="w-3 h-3" />
            <span>Oila boshligʻi</span>
          </Badge>
        );
      case 'admin':
        return (
          <Badge tone="blue">
            <Shield className="w-3 h-3" />
            <span>Admin</span>
          </Badge>
        );
      case 'member':
        return (
          <Badge tone="emerald">
            <Users className="w-3 h-3" />
            <span>Aʼzo</span>
          </Badge>
        );
      case 'viewer':
        return (
          <Badge tone="neutral">
            <Eye className="w-3 h-3" />
            <span>Kuzatuvchi</span>
          </Badge>
        );
    }
  };

  const totalSharedExpense = sharedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Oilaviy budjet va hamkorlik
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Oila aʼzolari bilan birgalikda xarajatlarni rejalashtiring va umumiy maqsadlarga erishing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!group ? (
            <>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<Key className="w-4 h-4 text-emerald-500" />}
                onClick={() => setIsJoinModalOpen(true)}
              >
                Kod orqali qoʻshilish
              </Button>
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Oila guruhi yaratish
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                setGeneratedInviteCode(null);
                setInviteForm({ email: '', role: 'member' });
                setIsInviteModalOpen(true);
              }}
            >
              Aʼzo taklif qilish
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !group ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title="Siz hali birorta oila guruhiga aʼzo emassiz"
          description="Yangi oilaviy budjet guruhini yarating yoki oila aʼzongiz yuborgan taklif kodi orqali mavjud guruhga qoʻshiling."
          action={
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
              <Button variant="primary" size="md" onClick={() => setIsCreateModalOpen(true)}>
                Yangi oila guruhi yaratish
              </Button>
              <Button variant="outline" size="md" onClick={() => setIsJoinModalOpen(true)}>
                Taklif kodi orqali kirish
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Family Banner — Deep Navy + Emerald Elite */}
          <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#081220] via-[#0B2D2B] to-[#0D433B] text-white border border-emerald-500/25 shadow-[0_12px_32px_rgba(16,185,129,0.12)] flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-emerald-300">Oilaviy guruh</span>
                <span className="text-xs text-slate-300 tabular-nums">
                  · {members.length} ta aʼzo
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                {group.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-200">
                <div>
                  <span className="text-emerald-300">Oylik umumiy budjet: </span>
                  <span className="font-bold font-mono tabular-nums text-white">
                    {formatMoney(group.monthlyBudget, group.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-300">Ushbu oy sarflandi: </span>
                  <span className="font-bold font-mono tabular-nums text-white">
                    {formatMoney(totalSharedExpense, group.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.08] rounded-2xl p-4 border border-white/[0.12] text-xs text-slate-200 max-w-sm">
              <div className="flex items-center gap-2 font-semibold text-white mb-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Maxfiylik nazorati</span>
              </div>
              Har bir tranzaksiyani «Oilaviy» yoki «Shaxsiy» deb belgilashingiz mumkin. Shaxsiy yozuvlaringiz boshqalarga koʻrinmaydi.
            </div>
          </section>

          {/* Members List */}
          <Card padding="lg">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.08]">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                Guruh aʼzolari ({members.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setGeneratedInviteCode(null);
                  setInviteForm({ email: '', role: 'member' });
                  setIsInviteModalOpen(true);
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Taklif qilish</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0D1927] flex items-center gap-3 min-w-0"
                >
                  <img
                    src={member.avatarUrl || '/src/assets/images/avatar_user_profile_1794280921902.jpg'}
                    alt={member.fullName}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-white/[0.12] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {member.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {member.email}
                    </div>
                    <div className="mt-1.5">{getRoleBadge(member.role)}</div>
                  </div>
                </div>
              ))}
            </div>

            {invitations.filter((i) => i.status === 'pending').length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.08]">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  Kutilayotgan taklifnomalar
                </div>
                <div className="space-y-2">
                  {invitations
                    .filter((i) => i.status === 'pending')
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/25 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {inv.email}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                            ({inv.role})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111B27] border border-amber-500/30 font-mono font-bold text-amber-700 dark:text-amber-300">
                            {inv.inviteCode}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inv.inviteCode)}
                            aria-label="Taklif kodini nusxalash"
                            className="p-2 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </Card>

          {/* Shared Transactions */}
          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Umumiy oilaviy xarajatlar va daromadlar
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Barcha aʼzolar tomonidan kiritilgan ochiq operatsiyalar
                </p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {sharedTransactions.length} ta yozuv
              </span>
            </div>

            {sharedTransactions.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Users className="w-6 h-6" />}
                  title="Hozircha oilaviy operatsiyalar yoʻq"
                  description="Tranzaksiya qoʻshishda «Oilaviy» belgisini tanlasangiz, u shu yerda koʻrinadi."
                />
              </div>
            ) : (
              <>
                <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06] px-2">
                  {sharedTransactions.map((tx) => (
                    <TransactionRow key={tx.id} transaction={tx} />
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/70 dark:bg-[#0D1927]/70 text-slate-500 dark:text-slate-400 font-semibold text-[11px] border-b border-slate-200/70 dark:border-white/[0.08]">
                      <tr>
                        <th className="py-3 px-4">Sana</th>
                        <th className="py-3 px-4">Tavsif</th>
                        <th className="py-3 px-4">Kategoriya</th>
                        <th className="py-3 px-4">Aʼzo</th>
                        <th className="py-3 px-4 text-right">Summa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-700 dark:text-slate-300">
                      {sharedTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                          <td className="py-3 px-4 font-mono tabular-nums text-[11px] text-slate-500">
                            {tx.date}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {tx.description}
                          </td>
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                            {tx.categoryName}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                            {tx.createdByMemberName || 'Oila aʼzosi'}
                          </td>
                          <td
                            className={[
                              'py-3 px-4 font-mono tabular-nums font-bold text-right',
                              tx.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400',
                            ].join(' ')}
                          >
                            {tx.type === 'income' ? '+' : '-'}
                            {formatMoney(tx.amount, 'UZS')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}

      {/* Create Family Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Yangi oilaviy guruh yaratish"
        size="md"
      >
        <form onSubmit={handleCreateFamily} className="space-y-4">
          <Input
            label="Oila guruhi nomi"
            type="text"
            required
            placeholder="Masalan: Karimovlar oilasi"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
          />

          <Input
            label="Oylik rejalashtirilgan budjet (UZS)"
            type="number"
            step="100000"
            required
            monospace
            trailingAddon="soʻm"
            value={createForm.monthlyBudget}
            onChange={(e) => setCreateForm({ ...createForm, monthlyBudget: e.target.value })}
          />

          <div className="pt-2 flex justify-end gap-2.5">
            <Button variant="ghost" size="md" onClick={() => setIsCreateModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" size="md">
              Guruhni yaratish
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Oila aʼzosini taklif qilish"
        size="md"
      >
        {generatedInviteCode ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center">
              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Taklif kodi yaratildi! Ushbu kodni aʼzoga yuboring:
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tracking-wider">
                  {generatedInviteCode}
                </span>
                <button
                  type="button"
                  aria-label="Taklif kodini nusxalash"
                  onClick={() => copyToClipboard(generatedInviteCode)}
                  className="p-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-2">
                Ushbu kod 7 kun davomida amal qiladi.
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={() => setIsInviteModalOpen(false)}>
                Tayyor
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              label="Aʼzo email manzili"
              type="email"
              required
              placeholder="masalan: turmush_ortogim@gmail.com"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />

            <Select
              label="Roli va huquqlari"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as FamilyRole })}
            >
              <option value="member">Aʼzo (Kiritish, tahrirlash huquqi)</option>
              <option value="admin">Admin (Taklif qilish va toʻliq boshqaruv)</option>
              <option value="viewer">Kuzatuvchi (Faqat koʻrish huquqi)</option>
            </Select>

            <div className="pt-2 flex justify-end gap-2.5">
              <Button variant="ghost" size="md" onClick={() => setIsInviteModalOpen(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" variant="primary" size="md">
                Kod yaratish
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Join Family by Code Modal */}
      <Modal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        title="Taklif kodi orqali guruhga qoʻshilish"
        size="sm"
      >
        <form onSubmit={handleAcceptInvite} className="space-y-4">
          {joinError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
              {joinError}
            </div>
          )}

          <Input
            label="Taklif kodi (FAM-XXXXXX)"
            type="text"
            required
            monospace
            placeholder="FAM-123456"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            className="uppercase tracking-wider text-center"
          />

          <div className="pt-2 flex justify-end gap-2.5">
            <Button variant="ghost" size="md" onClick={() => setIsJoinModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" size="md">
              Guruhga qoʻshilish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
