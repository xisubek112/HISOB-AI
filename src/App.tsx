/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { Header, DashboardPeriod } from './components/layout/Header.tsx';
import { MobileBottomNav } from './components/layout/MobileBottomNav.tsx';
import { DashboardView } from './components/views/DashboardView.tsx';
import { IncomeView } from './components/views/IncomeView.tsx';
import { ExpenseView } from './components/views/ExpenseView.tsx';
import { AIAssistantView } from './components/views/AIAssistantView.tsx';
import { ReportsView } from './components/views/ReportsView.tsx';
import { BudgetView } from './components/views/BudgetView.tsx';
import { GoalsView } from './components/views/GoalsView.tsx';
import { DebtsView } from './components/views/DebtsView.tsx';
import { SettingsView } from './components/views/SettingsView.tsx';

// Expanded Views
import { WalletsView } from './components/views/WalletsView.tsx';
import { FamilyView } from './components/views/FamilyView.tsx';
import { SubscriptionsView } from './components/views/SubscriptionsView.tsx';
import { RecurringView } from './components/views/RecurringView.tsx';
import { ReceiptScannerView } from './components/views/ReceiptScannerView.tsx';
import { ForecastView } from './components/views/ForecastView.tsx';
import { CurrenciesView } from './components/views/CurrenciesView.tsx';
import { BanksView } from './components/views/BanksView.tsx';
import { TelegramView } from './components/views/TelegramView.tsx';

// Modals & App Lock Security
import { TransactionModal } from './components/modals/TransactionModal.tsx';
import { CategoryModal } from './components/modals/CategoryModal.tsx';
import { BudgetModal } from './components/modals/BudgetModal.tsx';
import { GoalModal, GoalDepositModal } from './components/modals/GoalModal.tsx';
import { DebtModal, DebtPayModal } from './components/modals/DebtModal.tsx';
import { AuthModal } from './components/modals/AuthModal.tsx';
import { VoiceTransactionModal } from './components/modals/VoiceTransactionModal.tsx';
import { PremiumModal } from './components/modals/PremiumModal.tsx';
import { BiometricLockGate } from './components/modals/BiometricLockGate.tsx';
import { PinSetupModal } from './components/security/PinSetupModal.tsx';
import { FirstUsePinModal } from './components/security/FirstUsePinModal.tsx';
import {
  clearHiddenTimestamp,
  evaluateShouldLock,
  getAppLockConfig,
  hasSeenFirstUsePinPrompt,
  markAppHidden,
  markFirstUsePinPromptSeen,
} from './services/appLock.ts';

import { ToastProvider, useToast, Drawer } from './design-system/index.ts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Mic,
  Receipt,
  Bot,
  ArrowRightLeft,
} from 'lucide-react';

import {
  Transaction,
  Category,
  Budget,
  FinancialGoal,
  Debt,
  FinancialSummary,
  TransactionType,
} from './types/finance.ts';
import { api } from './services/api.ts';

function MainApp() {
  const { user, loading: authLoading, logout } = useAuth();
  const toast = useToast();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('this_month');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [quickAddSheetOpen, setQuickAddSheetOpen] = useState(false);

  // Core Data State
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Modals state
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txModalType, setTxModalType] = useState<TransactionType>('expense');
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null);
  const [goalDepositModalOpen, setGoalDepositModalOpen] = useState(false);
  const [selectedGoalForDeposit, setSelectedGoalForDeposit] = useState<FinancialGoal | null>(null);

  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [debtModalDefaultType, setDebtModalDefaultType] = useState<'borrowed' | 'lent'>('borrowed');
  const [debtPayModalOpen, setDebtPayModalOpen] = useState(false);
  const [selectedDebtForPay, setSelectedDebtForPay] = useState<Debt | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  // App Lock State (PIN & Biometrics)
  const [appLocked, setAppLocked] = useState(false);
  const [firstUsePinOpen, setFirstUsePinOpen] = useState(false);
  const [firstUsePinCreateOpen, setFirstUsePinCreateOpen] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Prompt login modal cleanly if session was signed out (e.g. "Barcha qurilmalardan chiqish")
  useEffect(() => {
    if (!authLoading && !user) {
      setAppLocked(false);
      setFirstUsePinOpen(false);
      setAuthModalOpen(true);
    }
  }, [authLoading, user]);

  // Evaluate PIN lock on app open / user switch, and offer first-use setup once
  useEffect(() => {
    if (!user?.id) {
      setAppLocked(false);
      return;
    }

    const cfg = getAppLockConfig(user.id);
    if (cfg.pinEnabled) {
      const shouldLock = evaluateShouldLock(user.id, { isAppLaunch: true });
      setAppLocked(shouldLock);
      setFirstUsePinOpen(false);
    } else {
      setAppLocked(false);
      if (!hasSeenFirstUsePinPrompt(user.id)) {
        setFirstUsePinOpen(true);
      }
    }
  }, [user?.id]);

  // Background, visibility, inactivity & settings lock listeners
  useEffect(() => {
    if (!user?.id) return;
    const uid = user.id;

    const bumpActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const handleVisibilityChange = () => {
      const cfg = getAppLockConfig(uid);
      if (!cfg.pinEnabled) return;

      if (document.hidden) {
        markAppHidden(uid);
        if (cfg.autoLockSeconds === 0) {
          setAppLocked(true);
        }
      } else {
        if (evaluateShouldLock(uid, { lastActivityAt: lastActivityRef.current })) {
          setAppLocked(true);
        } else {
          clearHiddenTimestamp(uid);
          bumpActivity();
        }
      }
    };

    const handlePageHide = () => {
      const cfg = getAppLockConfig(uid);
      if (!cfg.pinEnabled) return;
      markAppHidden(uid);
      if (cfg.autoLockSeconds === 0) {
        setAppLocked(true);
      }
    };

    const handleWindowFocus = () => {
      const cfg = getAppLockConfig(uid);
      if (!cfg.pinEnabled) return;
      if (evaluateShouldLock(uid, { lastActivityAt: lastActivityRef.current })) {
        setAppLocked(true);
      } else {
        clearHiddenTimestamp(uid);
        bumpActivity();
      }
    };

    const handleLockUpdated = () => {
      const cfg = getAppLockConfig(uid);
      if (!cfg.pinEnabled) {
        setAppLocked(false);
      } else if (cfg.isLocked) {
        setAppLocked(true);
      }
    };

    const idleInterval = window.setInterval(() => {
      const cfg = getAppLockConfig(uid);
      if (!cfg.pinEnabled || cfg.autoLockSeconds === 0) return;
      if (evaluateShouldLock(uid, { lastActivityAt: lastActivityRef.current })) {
        setAppLocked(true);
      }
    }, 5000);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pointerdown', bumpActivity, { passive: true });
    window.addEventListener('keydown', bumpActivity, { passive: true });
    window.addEventListener('touchstart', bumpActivity, { passive: true });
    window.addEventListener('hisobot:applock-changed', handleLockUpdated);

    return () => {
      window.clearInterval(idleInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pointerdown', bumpActivity);
      window.removeEventListener('keydown', bumpActivity);
      window.removeEventListener('touchstart', bumpActivity);
      window.removeEventListener('hisobot:applock-changed', handleLockUpdated);
    };
  }, [user?.id]);

  // Central Data Fetcher
  const refreshAllData = useCallback(async () => {
    if (!user) return;
    try {
      setDataLoading(true);
      setDataError(null);
      const [sumRes, txRes, catRes, bdgRes, goalRes, debtRes] = await Promise.all([
        api.getSummary({ period: selectedPeriod }),
        api.getTransactions(),
        api.getCategories(),
        api.getBudgets(),
        api.getGoals(),
        api.getDebts(),
      ]);

      setSummary(sumRes.summary);
      setTransactions(txRes.transactions);
      setCategories(catRes.categories);
      setBudgets(bdgRes.budgets);
      setGoals(goalRes.goals);
      setDebts(debtRes.debts);
    } catch (e: any) {
      console.error('Failed to load application data:', e);
      setDataError(e?.message || 'Maʼlumotlarni yuklashda xatolik yuz berdi');
    } finally {
      setDataLoading(false);
    }
  }, [user, selectedPeriod]);

  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Transaction Actions
  const handleSaveTransaction = async (txData: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
    if (editingTx) {
      await api.updateTransaction(editingTx.id, txData);
      toast.success('Tranzaksiya yangilandi');
    } else {
      await api.addTransaction(txData);
      toast.success('Tranzaksiya saqlandi');
    }
    await refreshAllData();
  };

  const handleDeleteTransaction = async (id: string) => {
    const ok = await toast.confirm({
      title: 'Tranzaksiyani oʻchirish',
      message: 'Haqiqatan ham ushbu tranzaksiyani oʻchirmoqchimisiz? Bu amalni qaytarib boʻlmaydi.',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteTransaction(id);
      toast.success('Tranzaksiya oʻchirildi');
      await refreshAllData();
    } catch (e: any) {
      toast.error(e.message || 'Oʻchirishda xatolik yuz berdi');
    }
  };

  // Category Actions
  const handleSaveCategory = async (cat: { name: string; type: TransactionType; icon: string; color: string }) => {
    await api.addCategory(cat);
    const catRes = await api.getCategories();
    setCategories(catRes.categories);
    toast.success('Yangi toifa qoʻshildi');
  };

  // Budget Actions
  const handleSaveBudget = async (budget: Omit<Budget, 'id' | 'userId'>) => {
    await api.setBudget(budget);
    toast.success('Budjet limiti saqlandi');
    await refreshAllData();
  };

  const handleDeleteBudget = async (id: string) => {
    const ok = await toast.confirm({
      title: 'Budjet limitini oʻchirish',
      message: 'Ushbu toifa uchun belgilangan budjet limitini oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteBudget(id);
      toast.success('Budjet limiti oʻchirildi');
      await refreshAllData();
    } catch (e: any) {
      toast.error(e.message || 'Oʻchirishda xatolik yuz berdi');
    }
  };

  // Goal Actions
  const handleSaveGoal = async (goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>) => {
    if (editingGoal) {
      await api.updateGoal(editingGoal.id, goal);
      toast.success('Jamgʻarma maqsadi yangilandi');
    } else {
      await api.addGoal(goal);
      toast.success('Yangi jamgʻarma maqsadi yaratildi');
    }
    await refreshAllData();
  };

  const handleDepositGoal = async (goalId: string, amount: number) => {
    await api.depositToGoal(goalId, amount);
    toast.success('Jamgʻarmaga mablagʻ qoʻshildi');
    await refreshAllData();
  };

  const handleDeleteGoal = async (id: string) => {
    const ok = await toast.confirm({
      title: 'Maqsadni oʻchirish',
      message: 'Ushbu jamgʻarma maqsadini oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteGoal(id);
      toast.success('Maqsad oʻchirildi');
      await refreshAllData();
    } catch (e: any) {
      toast.error(e.message || 'Oʻchirishda xatolik yuz berdi');
    }
  };

  // Debt Actions
  const handleSaveDebt = async (debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>) => {
    if (editingDebt) {
      await api.updateDebt(editingDebt.id, debt);
      toast.success('Qarz qaydnomasi yangilandi');
    } else {
      await api.addDebt(debt);
      toast.success('Qarz qaydnomasi saqlandi');
    }
    await refreshAllData();
  };

  const handlePayDebt = async (debtId: string, amount: number) => {
    await api.payDebt(debtId, amount);
    toast.success('Qarz toʻlovi qayd etildi');
    await refreshAllData();
  };

  const handleDeleteDebt = async (id: string) => {
    const ok = await toast.confirm({
      title: 'Qarz qaydnomasini oʻchirish',
      message: 'Ushbu qarz qaydnomasini oʻchirmoqchimisiz?',
      confirmLabel: 'Oʻchirish',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteDebt(id);
      toast.success('Qarz qaydnomasi oʻchirildi');
      await refreshAllData();
    } catch (e: any) {
      toast.error(e.message || 'Oʻchirishda xatolik yuz berdi');
    }
  };

  if (authLoading) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#F4F7F8] dark:bg-[#081220] text-slate-900 dark:text-slate-100">
        <div className="w-12 h-12 rounded-2xl bg-[#0D1927] border border-emerald-500/40 flex items-center justify-center shadow-[0_0_28px_rgba(16,185,129,0.25)] mb-3">
          <div className="w-5 h-5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        </div>
        <div className="text-sm font-bold tracking-tight">HISOBOT AI yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] bg-[#F4F7F8] dark:bg-[#061411] text-[#0F172A] dark:text-white overflow-hidden font-sans">
      {/* Subtle Emerald / Teal Ambient Glow Layers (Dark mode) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden hidden dark:block" aria-hidden="true">
        <div className="absolute -left-40 -top-40 h-[460px] w-[460px] rounded-full bg-emerald-500/[0.11] blur-[130px]" />
        <div className="absolute right-[-140px] top-[20%] h-[400px] w-[400px] rounded-full bg-teal-500/[0.08] blur-[130px]" />
        <div className="absolute bottom-[-180px] left-[30%] h-[380px] w-[380px] rounded-full bg-emerald-400/[0.06] blur-[140px]" />
      </div>

      {/* Desktop & Mobile Drawer Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenPremiumModal={() => setPremiumModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="relative flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* View Content Viewport */}
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden px-3 pt-3 pb-24 sm:px-5 lg:px-7 lg:pb-8">
          <div className="w-full min-w-0 max-w-[1600px] mx-auto">
            <Header
              currentTab={currentTab}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              transactions={transactions}
              onEditTransaction={(tx) => {
                setEditingTx(tx);
                setTxModalType(tx.type);
                setTxModalOpen(true);
              }}
              onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
              onNavigateTab={setCurrentTab}
              onOpenAuthModal={() => setAuthModalOpen(true)}
            />
            {dataError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                <span>{dataError}</span>
                <button
                  type="button"
                  onClick={refreshAllData}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold shrink-0"
                >
                  Qayta urinish
                </button>
              </div>
            )}

            {currentTab === 'dashboard' && (
              <DashboardView
                summary={summary}
                recentTransactions={transactions}
                goals={goals}
                loading={dataLoading && !summary}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={setSelectedPeriod}
                onOpenVoiceModal={() => setVoiceModalOpen(true)}
                onOpenGoalModal={() => {
                  setEditingGoal(null);
                  setGoalModalOpen(true);
                }}
                onOpenTransactionModal={(type) => {
                  setEditingTx(null);
                  setTxModalType(type);
                  setTxModalOpen(true);
                }}
                onEditTransaction={(tx) => {
                  setEditingTx(tx);
                  setTxModalType(tx.type);
                  setTxModalOpen(true);
                }}
                onDeleteTransaction={handleDeleteTransaction}
                onNavigateTab={setCurrentTab}
                onOpenGoalDeposit={(goal) => {
                  setSelectedGoalForDeposit(goal);
                  setGoalDepositModalOpen(true);
                }}
              />
            )}

            {currentTab === 'income' && (
              <IncomeView
                transactions={transactions}
                categories={categories}
                onAddIncome={() => {
                  setEditingTx(null);
                  setTxModalType('income');
                  setTxModalOpen(true);
                }}
                onEditTransaction={(tx) => {
                  setEditingTx(tx);
                  setTxModalType('income');
                  setTxModalOpen(true);
                }}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {currentTab === 'expense' && (
              <ExpenseView
                transactions={transactions}
                categories={categories}
                onAddExpense={() => {
                  setEditingTx(null);
                  setTxModalType('expense');
                  setTxModalOpen(true);
                }}
                onOpenCategoryModal={() => setCategoryModalOpen(true)}
                onEditTransaction={(tx) => {
                  setEditingTx(tx);
                  setTxModalType('expense');
                  setTxModalOpen(true);
                }}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {currentTab === 'ai' && (
              <AIAssistantView
                onTransactionSaved={() => {
                  refreshAllData();
                }}
                onOpenVoiceModal={() => setVoiceModalOpen(true)}
                onOpenPremiumModal={() => setPremiumModalOpen(true)}
              />
            )}

            {currentTab === 'wallets' && <WalletsView />}
            {currentTab === 'family' && <FamilyView />}
            {currentTab === 'subscriptions' && <SubscriptionsView />}
            {currentTab === 'recurring' && <RecurringView />}
            {currentTab === 'receipts' && (
              <ReceiptScannerView
                onTransactionSaved={() => {
                  refreshAllData();
                }}
              />
            )}
            {currentTab === 'forecast' && <ForecastView />}
            {currentTab === 'currencies' && <CurrenciesView />}
            {currentTab === 'banks' && <BanksView />}
            {currentTab === 'telegram' && <TelegramView />}
            {currentTab === 'reports' && <ReportsView />}

            {currentTab === 'budgets' && (
              <BudgetView
                budgets={budgets}
                categories={categories}
                onOpenBudgetModal={(b) => {
                  setEditingBudget(b || null);
                  setBudgetModalOpen(true);
                }}
                onDeleteBudget={handleDeleteBudget}
              />
            )}

            {currentTab === 'goals' && (
              <GoalsView
                goals={goals}
                onOpenGoalModal={(g) => {
                  setEditingGoal(g || null);
                  setGoalModalOpen(true);
                }}
                onOpenGoalDeposit={(g) => {
                  setSelectedGoalForDeposit(g);
                  setGoalDepositModalOpen(true);
                }}
                onDeleteGoal={handleDeleteGoal}
              />
            )}

            {currentTab === 'debts' && (
              <DebtsView
                debts={debts}
                onOpenDebtModal={(d, defType) => {
                  setEditingDebt(d || null);
                  if (defType) setDebtModalDefaultType(defType);
                  setDebtModalOpen(true);
                }}
                onOpenDebtPay={(d) => {
                  setSelectedDebtForPay(d);
                  setDebtPayModalOpen(true);
                }}
                onDeleteDebt={handleDeleteDebt}
              />
            )}

            {currentTab === 'settings' && (
              <SettingsView
                onOpenPremiumModal={() => setPremiumModalOpen(true)}
                onRequireAuth={() => setAuthModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenQuickAdd={() => setQuickAddSheetOpen(true)}
      />

      {/* Mobile Quick Add Action Sheet */}
      <Drawer
        isOpen={quickAddSheetOpen}
        onClose={() => setQuickAddSheetOpen(false)}
        side="bottom"
        title="Tezkor amal tanlang"
      >
        <div className="grid grid-cols-2 gap-3 pb-2">
          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setEditingTx(null);
              setTxModalType('income');
              setTxModalOpen(true);
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Kirim</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Daromad kiritish</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setEditingTx(null);
              setTxModalType('expense');
              setTxModalOpen(true);
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Chiqim</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Xarajat yozish</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setVoiceModalOpen(true);
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500 text-slate-950 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Ovoz bilan</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">AI ovozli kiritish</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setCurrentTab('receipts');
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white/10 text-white flex items-center justify-center shrink-0">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Chek skaner</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">OCR tahlili</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setCurrentTab('ai');
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">AI Yordamchi</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Savol va tahlil</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickAddSheetOpen(false);
              setCurrentTab('wallets');
            }}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-white/[0.10] bg-slate-50 dark:bg-white/[0.04] text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">Oʻtkazma</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Hamyonlar aro</div>
            </div>
          </button>
        </div>
      </Drawer>

      {/* Central Modals */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => {
          setTxModalOpen(false);
          setEditingTx(null);
        }}
        onSave={handleSaveTransaction}
        categories={categories}
        initialType={txModalType}
        editingTransaction={editingTx}
        onOpenCategoryModal={() => setCategoryModalOpen(true)}
      />

      <VoiceTransactionModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        categories={categories}
        onTransactionSaved={() => {
          toast.success('Ovozli tranzaksiya saqlandi');
          refreshAllData();
        }}
      />

      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
      />

      <BudgetModal
        isOpen={budgetModalOpen}
        onClose={() => {
          setBudgetModalOpen(false);
          setEditingBudget(null);
        }}
        onSave={handleSaveBudget}
        categories={categories}
        editingBudget={editingBudget}
      />

      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        editingGoal={editingGoal}
      />

      <GoalDepositModal
        isOpen={goalDepositModalOpen}
        onClose={() => {
          setGoalDepositModalOpen(false);
          setSelectedGoalForDeposit(null);
        }}
        goal={selectedGoalForDeposit}
        onDeposit={handleDepositGoal}
      />

      <DebtModal
        isOpen={debtModalOpen}
        onClose={() => {
          setDebtModalOpen(false);
          setEditingDebt(null);
        }}
        onSave={handleSaveDebt}
        editingDebt={editingDebt}
        defaultType={debtModalDefaultType}
      />

      <DebtPayModal
        isOpen={debtPayModalOpen}
        onClose={() => {
          setDebtPayModalOpen(false);
          setSelectedDebtForPay(null);
        }}
        debt={selectedDebtForPay}
        onPay={handlePayDebt}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      <PremiumModal
        isOpen={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
      />

      {user?.id && (
        <>
          <FirstUsePinModal
            isOpen={firstUsePinOpen && !appLocked}
            onSetupNow={() => {
              markFirstUsePinPromptSeen(user.id);
              setFirstUsePinOpen(false);
              setFirstUsePinCreateOpen(true);
            }}
            onDismiss={() => {
              markFirstUsePinPromptSeen(user.id);
              setFirstUsePinOpen(false);
            }}
          />

          <PinSetupModal
            isOpen={firstUsePinCreateOpen}
            mode="create"
            userId={user.id}
            onClose={() => setFirstUsePinCreateOpen(false)}
            onComplete={(msg) => {
              window.dispatchEvent(new CustomEvent('hisobot:applock-changed'));
              toast.success(msg);
            }}
          />
        </>
      )}

      {appLocked && user && (
        <BiometricLockGate
          userId={user.id}
          userName={user.fullName}
          userEmail={user.email}
          onUnlock={() => {
            lastActivityRef.current = Date.now();
            setAppLocked(false);
          }}
          onSetupNewPin={() => setFirstUsePinCreateOpen(true)}
          onSignOut={async () => {
            setAppLocked(false);
            await logout();
            setAuthModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </AuthProvider>
  );
}
