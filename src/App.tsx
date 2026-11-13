/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Sidebar, NavTab } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
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

// Modals
import { TransactionModal } from './components/modals/TransactionModal.tsx';
import { CategoryModal } from './components/modals/CategoryModal.tsx';
import { BudgetModal } from './components/modals/BudgetModal.tsx';
import { GoalModal, GoalDepositModal } from './components/modals/GoalModal.tsx';
import { DebtModal, DebtPayModal } from './components/modals/DebtModal.tsx';
import { AuthModal } from './components/modals/AuthModal.tsx';
import { VoiceTransactionModal } from './components/modals/VoiceTransactionModal.tsx';
import { PremiumModal } from './components/modals/PremiumModal.tsx';

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
  const { user, loading: authLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Data State
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

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

  // Central Data Fetcher
  const refreshAllData = useCallback(async () => {
    if (!user) return;
    try {
      setDataLoading(true);
      const [sumRes, txRes, catRes, bdgRes, goalRes, debtRes] = await Promise.all([
        api.getSummary({ period: 'this_month' }),
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
    } catch (e) {
      console.error('Failed to load application data:', e);
    } finally {
      setDataLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Transaction Actions
  const handleSaveTransaction = async (txData: Omit<Transaction, 'id' | 'userId' | 'createdAt'>) => {
    if (editingTx) {
      await api.updateTransaction(editingTx.id, txData);
    } else {
      await api.addTransaction(txData);
    }
    await refreshAllData();
  };

  const handleDeleteTransaction = async (id: string) => {
    if (window.confirm('Haqiqatan ham ushbu tranzaksiyani oʻchirmoqchimisiz?')) {
      await api.deleteTransaction(id);
      await refreshAllData();
    }
  };

  // Category Actions
  const handleSaveCategory = async (cat: { name: string; type: TransactionType; icon: string; color: string }) => {
    await api.addCategory(cat);
    const catRes = await api.getCategories();
    setCategories(catRes.categories);
  };

  // Budget Actions
  const handleSaveBudget = async (budget: Omit<Budget, 'id' | 'userId'>) => {
    await api.setBudget(budget);
    await refreshAllData();
  };

  const handleDeleteBudget = async (id: string) => {
    if (window.confirm('Ushbu budjet limitini oʻchirmoqchimisiz?')) {
      await api.deleteBudget(id);
      await refreshAllData();
    }
  };

  // Goal Actions
  const handleSaveGoal = async (goal: Omit<FinancialGoal, 'id' | 'userId' | 'createdAt'>) => {
    if (editingGoal) {
      await api.updateGoal(editingGoal.id, goal);
    } else {
      await api.addGoal(goal);
    }
    await refreshAllData();
  };

  const handleDepositGoal = async (goalId: string, amount: number) => {
    await api.depositToGoal(goalId, amount);
    await refreshAllData();
  };

  const handleDeleteGoal = async (id: string) => {
    if (window.confirm('Ushbu maqsadni oʻchirmoqchimisiz?')) {
      await api.deleteGoal(id);
      await refreshAllData();
    }
  };

  // Debt Actions
  const handleSaveDebt = async (debt: Omit<Debt, 'id' | 'userId' | 'remainingAmount'>) => {
    if (editingDebt) {
      await api.updateDebt(editingDebt.id, debt);
    } else {
      await api.addDebt(debt);
    }
    await refreshAllData();
  };

  const handlePayDebt = async (debtId: string, amount: number) => {
    await api.payDebt(debtId, amount);
    await refreshAllData();
  };

  const handleDeleteDebt = async (id: string) => {
    if (window.confirm('Ushbu qarz qaydnomasini oʻchirmoqchimisiz?')) {
      await api.deleteDebt(id);
      await refreshAllData();
    }
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg animate-pulse mb-3">
          H
        </div>
        <div className="text-sm font-semibold tracking-tight">HISOBOT AI yuklanmoqda...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenPremiumModal={() => setPremiumModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenTransactionModal={(type) => {
            setEditingTx(null);
            setTxModalType(type);
            setTxModalOpen(true);
          }}
          onOpenVoiceModal={() => setVoiceModalOpen(true)}
          onOpenAI={() => setCurrentTab('ai')}
          onNavigateTab={setCurrentTab}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onOpenPremiumModal={() => setPremiumModalOpen(true)}
        />

        {/* View Content Viewport */}
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8">
          <div className="w-full min-w-0 max-w-7xl mx-auto">
            {currentTab === 'dashboard' && (
              <DashboardView
                summary={summary}
                recentTransactions={transactions}
                goals={goals}
                onOpenVoiceModal={() => setVoiceModalOpen(true)}
                onOpenPremiumModal={() => setPremiumModalOpen(true)}
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
              />
            )}

            {/* Expanded New Modules */}
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

            {/* Reports & Planning */}
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
              <SettingsView onOpenPremiumModal={() => setPremiumModalOpen(true)} />
            )}
          </div>
        </main>
      </div>

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
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
