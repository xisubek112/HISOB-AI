import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  PanelLeft,
  Sparkles,
  Volume2,
  VolumeX,
  ScanLine,
} from 'lucide-react';
import {
  AIChatMessage,
  AIParsedTransaction,
  AIProposedAction,
  Transaction,
  FinancialHealthScore,
} from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Drawer, useToast } from '../../design-system/index.ts';
import {
  AIConversation,
  AICapabilityItem,
  QUICK_SUGGESTIONS,
} from './types.ts';
import { useRobotStateController } from './RobotStateController.ts';
import { RobotMascot } from './RobotMascot.tsx';
import { TypingIndicator } from './TypingIndicator.tsx';
import { QuickSuggestion } from './QuickSuggestion.tsx';
import { ChatMessage } from './ChatMessage.tsx';
import { ChatHistory } from './ChatHistory.tsx';
import { AIInsightPanel } from './AIInsightPanel.tsx';
import { ChatComposer } from './ChatComposer.tsx';
import { VoiceModeOverlay } from './VoiceModeOverlay.tsx';

export interface AIAssistantPageProps {
  onTransactionSaved: (tx: Transaction) => void;
  onOpenVoiceModal?: () => void;
  onOpenPremiumModal?: () => void;
}

const STORAGE_KEY_PREFIX = 'hisobot_ai_conversations_v2_';

function createInitialConversation(fullName?: string): AIConversation {
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const greetingName = fullName ? `, ${fullName.split(' ')[0]}` : '';
  return {
    id: `conv_${Date.now()}`,
    title: 'Yangi moliyaviy suhbat',
    preview: 'HISOBOT AI bilan suhbat',
    updatedAt: new Date().toISOString(),
    isSaved: false,
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Assalomu alaykum${greetingName}! Men sizning aqlli moliyaviy miyangiz — **HISOBOT AI** man.\n\nOʻzbek, rus yoki ingliz tillarida bemalol suhbatlashing, xarajat-daromadlaringizni yozing, budjet yoki maqsad tuzing, chek yuklang yoki ovozli rejimda gaplashing.`,
        timestamp: nowStr,
      },
    ],
  };
}

function detectSpeechLocale(text: string): string {
  const sample = text.trim();
  if (/[\u0400-\u04FF]{2,}/.test(sample)) return 'ru-RU';
  const lower = sample.toLowerCase();
  if (
    /\b(the|your|you|today|month|balance|budget|expenses|income|hello|please)\b/.test(lower)
  ) {
    return 'en-US';
  }
  return 'uz-UZ';
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  onTransactionSaved,
  onOpenPremiumModal,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const storageKey = `${STORAGE_KEY_PREFIX}${user?.id || 'guest'}`;

  const [conversations, setConversations] = useState<AIConversation[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [createInitialConversation(user?.fullName)];
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => conversations[0]?.id || '');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [voiceOverlayOpen, setVoiceOverlayOpen] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [mobileInsightOpen, setMobileInsightOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const {
    robotState,
    statusMessage,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
    setSuccess,
    setError,
  } = useRobotStateController();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const receiptTriggerRef = useRef<HTMLInputElement>(null);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const activeConv =
    conversations.find((c) => c.id === activeConvId) || conversations[0];
  const messages = activeConv?.messages || [];
  const hasUserMessages = messages.some((m) => m.role === 'user');

  // Persist conversation history
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversations.slice(0, 25)));
    } catch {
      // ignore storage quota errors
    }
  }, [conversations, storageKey]);

  // Load Financial Health Score
  const loadHealth = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getHealthScore();
      setHealthScore(res.healthScore);
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, loading]);

  // Cleanup active TTS on unmount
  useEffect(() => {
    return () => {
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
    setIdle();
  }, [ttsSupported, setIdle]);

  const speakText = useCallback(
    (text: string, msgId: string, preferredLang?: string) => {
      if (!ttsSupported) return;
      try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/\*\*/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = preferredLang || detectSpeechLocale(cleanText);
        utterance.rate = 1.02;
        utterance.onstart = () => {
          setSpeakingMsgId(msgId);
          setSpeaking();
        };
        utterance.onend = () => {
          setSpeakingMsgId(null);
          setIdle();
        };
        utterance.onerror = () => {
          setSpeakingMsgId(null);
          setIdle();
        };
        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeakingMsgId(null);
      }
    },
    [ttsSupported, setSpeaking, setIdle]
  );

  const appendMessagesToActive = useCallback(
    (newMsgs: AIChatMessage[], titleHint?: string) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== activeConv?.id) return conv;
          const lastMsg = newMsgs[newMsgs.length - 1];
          const shouldRename =
            titleHint && conv.title === 'Yangi moliyaviy suhbat';
          return {
            ...conv,
            title: shouldRename
              ? titleHint.slice(0, 38) + (titleHint.length > 38 ? '...' : '')
              : conv.title,
            preview: lastMsg.content.replace(/\*\*/g, '').slice(0, 60),
            updatedAt: new Date().toISOString(),
            messages: [...conv.messages, ...newMsgs],
          };
        })
      );
    },
    [activeConv?.id]
  );

  const executeAssistantTurn = useCallback(
    async (
      query: string,
      options?: { speakReply?: boolean; languageHint?: string; clearInput?: boolean }
    ): Promise<AIChatMessage | null> => {
      const clean = query.trim();
      if (!clean) return null;

      stopSpeaking();

      const recentHistory = messages
        .filter((m) => !m.isError && m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const nowTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userMsg: AIChatMessage = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        content: clean,
        timestamp: nowTime,
      };

      appendMessagesToActive([userMsg], clean);
      if (options?.clearInput) setInput('');
      setLoading(true);
      setThinking();

      try {
        const res = await api.askAIAssistant(
          clean,
          recentHistory,
          options?.languageHint || 'uz'
        );

        const assistantId = `msg_a_${Date.now()}`;
        const fullContent = res.warning
          ? `${res.reply}\n\n(${res.warning})`
          : res.reply;

        const assistantMsg: AIChatMessage = {
          id: assistantId,
          role: 'assistant',
          content: fullContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          structuredRows: res.structuredRows,
          proposedAction: res.proposedAction,
          confirmationState: res.proposedAction ? 'pending' : undefined,
          source: res.source,
        };

        appendMessagesToActive([assistantMsg]);

        if ((options?.speakReply ?? autoSpeak) && ttsSupported) {
          speakText(res.reply, assistantId, options?.languageHint);
        } else {
          setSuccess(res.proposedAction ? 'Amal tayyorlandi!' : 'Javob tayyor!');
        }

        return assistantMsg;
      } catch (err: any) {
        const errMsg: AIChatMessage = {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: `Soʻrovni qayta ishlashda xatolik yuz berdi: ${
            err?.message || 'Serverga ulanib boʻlmadi'
          }.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
          retryQuery: clean,
        };
        appendMessagesToActive([errMsg]);
        setError('Server bilan aloqada xatolik');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      appendMessagesToActive,
      autoSpeak,
      messages,
      setError,
      setSuccess,
      setThinking,
      speakText,
      stopSpeaking,
      ttsSupported,
    ]
  );

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || loading) return;
    try {
      await executeAssistantTurn(query, { clearInput: !textToSend });
    } catch {
      // handled in executeAssistantTurn
    }
  };

  const handleConfirmProposedAction = async (msgId: string, action: AIProposedAction) => {
    try {
      setLoading(true);
      setThinking();
      const res = await api.executeAIAction(action);

      let confirmedText = 'Amal muvaffaqiyatli bazaga saqlandi!';
      if (action.actionType === 'transaction') {
        const p = action.payload;
        confirmedText = `Tranzaksiya saqlandi! ${p.type === 'income' ? 'Kirim' : 'Chiqim'}: **${
          p.type === 'income' ? '+' : '-'
        }${formatMoney(p.amount)}** (${p.categoryName}).`;
      } else if (action.actionType === 'budget') {
        const p = action.payload;
        confirmedText = `Budjet limiti saqlandi! **${p.categoryName}** — oylik **${formatMoney(
          p.monthlyLimit
        )}**.`;
      } else if (action.actionType === 'goal') {
        const p = action.payload;
        confirmedText = `Moliyaviy maqsad yaratildi! **${p.name}** (${formatMoney(
          p.targetAmount
        )}).`;
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id !== activeConv?.id
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        confirmationState: 'confirmed',
                        content: confirmedText,
                      }
                    : m
                ),
              }
        )
      );

      toast.success('Muvaffaqiyatli saqlandi');
      onTransactionSaved((res.createdRecord || {}) as Transaction);
      await loadHealth();
      setSuccess('Bazaga saqlandi!');
      return confirmedText;
    } catch (err: any) {
      toast.error(err?.message || 'Amalni saqlashda xatolik yuz berdi');
      setError('Saqlashda xatolik');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransaction = async (msgId: string, parsed: AIParsedTransaction) => {
    try {
      setLoading(true);
      setThinking();
      const res = await api.addTransaction({
        type: parsed.type,
        amount: parsed.amount,
        categoryId: parsed.categoryId || 'cat_custom',
        categoryName: parsed.categoryName,
        date: parsed.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: parsed.description,
        paymentMethod: parsed.paymentMethod,
        notes: 'HISOBOT AI orqali kiritildi',
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id !== activeConv?.id
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        confirmationState: 'confirmed',
                        content: `Tranzaksiya saqlandi! ${
                          parsed.type === 'income' ? 'Kirim' : 'Chiqim'
                        }: **${parsed.type === 'income' ? '+' : '-'}${formatMoney(
                          parsed.amount
                        )}** (${parsed.categoryName}).`,
                      }
                    : m
                ),
              }
        )
      );

      toast.success('Tranzaksiya bazaga saqlandi');
      onTransactionSaved(res.transaction);
      await loadHealth();
      setSuccess('Tranzaksiya saqlandi!');
    } catch (err: any) {
      toast.error(err?.message || 'Tranzaksiyani saqlashda xatolik yuz berdi');
      setError('Saqlashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransaction = (msgId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== activeConv?.id
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId
                  ? {
                      ...m,
                      confirmationState: 'cancelled',
                      content: 'Tranzaksiya bekor qilindi va tizimga saqlanmadi.',
                    }
                  : m
              ),
            }
      )
    );
    setIdle();
  };

  const handleReceiptUpload = (file: File) => {
    if (loading) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const payload = typeof reader.result === 'string' ? reader.result : file.name;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const userMsg: AIChatMessage = {
        id: `msg_u_rcpt_${Date.now()}`,
        role: 'user',
        content: `Chek yuklandi: **${file.name}**`,
        timestamp: nowTime,
      };
      appendMessagesToActive([userMsg], `Chek: ${file.name}`);
      setLoading(true);
      setThinking();

      try {
        const res = await api.scanReceipt(payload);
        const parsed = res.parsed;
        const assistantMsg: AIChatMessage = {
          id: `msg_a_rcpt_${Date.now()}`,
          role: 'assistant',
          content: `Chek tahlili yakunlandi! **${parsed.merchantName}** doʻkonidan **${formatMoney(
            parsed.totalAmount
          )}** (${parsed.categorySuggested}) aniqlandi.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          scannedReceipt: parsed,
          receiptSaved: false,
        };
        appendMessagesToActive([assistantMsg]);
        setSuccess('Chek muvaffaqiyatli oʻqildi!');
      } catch (err: any) {
        appendMessagesToActive([
          {
            id: `msg_err_${Date.now()}`,
            role: 'assistant',
            content: err?.message || 'Chekni tahlil qilib boʻlmadi.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isError: true,
          },
        ]);
        setError('Chek tahlilida xatolik');
      } finally {
        setLoading(false);
      }
    };

    if (file.type.startsWith('text/')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleSaveScannedReceipt = async (msgId: string) => {
    const target = messages.find((m) => m.id === msgId);
    if (!target?.scannedReceipt) return;
    try {
      setLoading(true);
      setThinking();
      await api.saveReceipt({
        ...target.scannedReceipt,
        createTransaction: true,
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id !== activeConv?.id
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, receiptSaved: true } : m
                ),
              }
        )
      );

      toast.success('Chek xarajat sifatida saqlandi');
      const txRes = await api.getTransactions();
      if (txRes.transactions[0]) {
        onTransactionSaved(txRes.transactions[0]);
      }
      await loadHealth();
      setSuccess('Chek saqlandi!');
    } catch (err: any) {
      toast.error(err?.message || 'Chekni saqlashda xatolik');
      setError('Chekni saqlab boʻlmadi');
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    stopSpeaking();
    const fresh = createInitialConversation(user?.fullName);
    setConversations((prev) => [fresh, ...prev]);
    setActiveConvId(fresh.id);
    setMobileHistoryOpen(false);
    setIdle();
  };

  const handleToggleSaveConv = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isSaved: !c.isSaved } : c))
    );
  };

  const handleDeleteConv = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = createInitialConversation(user?.fullName);
        setActiveConvId(fresh.id);
        return [fresh];
      }
      if (activeConvId === id) {
        setActiveConvId(next[0].id);
      }
      return next;
    });
  };

  const handleSelectCapability = (cap: AICapabilityItem) => {
    setMobileInsightOpen(false);
    if (cap.actionType === 'receipt') {
      receiptTriggerRef.current?.click();
      return;
    }
    if (cap.prompt) {
      handleSend(cap.prompt);
    }
  };

  const firstName = user?.fullName?.split(' ')[0] || 'Foydalanuvchi';

  return (
    <div className="w-full min-w-0 hai-fade-up">
      {/* Hidden receipt trigger for Capability Panel */}
      <input
        ref={receiptTriggerRef}
        type="file"
        accept="image/*,.txt"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleReceiptUpload(f);
          e.target.value = '';
        }}
        className="hidden"
        aria-hidden="true"
      />

      {/* 3-Column Desktop Shell / Full-height Mobile Shell */}
      <div className="grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_272px] gap-4 items-stretch h-[calc(100dvh-11.2rem)] lg:h-[calc(100dvh-8.2rem)] min-h-[520px]">
        {/* LEFT COLUMN: Chat History (Desktop) */}
        <aside className="hidden xl:flex flex-col rounded-[22px] border border-slate-200/85 dark:border-white/[0.09] bg-white/95 dark:bg-[#0D1927]/90 p-4 min-h-0 shadow-[0_12px_36px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.22)]">
          <ChatHistory
            conversations={conversations}
            activeId={activeConv?.id || ''}
            onSelect={(id) => {
              stopSpeaking();
              setActiveConvId(id);
            }}
            onNewChat={handleNewChat}
            onToggleSave={handleToggleSaveConv}
            onDelete={handleDeleteConv}
            onOpenPremiumModal={onOpenPremiumModal}
          />
        </aside>

        {/* CENTER COLUMN: AI Financial Brain & Chat Workspace */}
        <section
          aria-label="HISOBOT AI suhbat maydoni"
          className="relative flex flex-col min-w-0 min-h-0 rounded-[22px] border border-slate-200/85 dark:border-white/[0.09] bg-white/95 dark:bg-[#0D1927]/90 overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.25)]"
        >
          {/* Subtle Ambient Glow inside AI Core */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 -top-24 -translate-x-1/2 w-80 h-56 rounded-full bg-emerald-500/[0.12] dark:bg-emerald-400/[0.10] blur-3xl"
          />

          {/* Top Compact Header inside AI Center */}
          <div className="relative z-10 px-3.5 sm:px-5 py-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/75 dark:bg-[#081220]/70 backdrop-blur-md flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(true)}
                aria-label="Suhbatlar tarixini ochish"
                className="xl:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-500 shrink-0 cursor-pointer"
              >
                <PanelLeft className="w-4 h-4" />
              </button>

              {hasUserMessages && (
                <div className="shrink-0">
                  <RobotMascot state={robotState} size="compact" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                    HISOBOT AI
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      robotState === 'listening'
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-600 dark:text-cyan-300'
                        : robotState === 'thinking' || robotState === 'speaking'
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-600 dark:text-emerald-300'
                        : robotState === 'paused'
                        ? 'bg-amber-500/15 border-amber-400/40 text-amber-600 dark:text-amber-300'
                        : robotState === 'error'
                        ? 'bg-rose-500/15 border-rose-400/40 text-rose-600 dark:text-rose-300'
                        : 'bg-emerald-500/12 border-emerald-500/25 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        robotState === 'error'
                          ? 'bg-rose-500'
                          : robotState === 'paused'
                          ? 'bg-amber-400'
                          : robotState === 'listening'
                          ? 'bg-cyan-400 animate-ping'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span className="truncate max-w-[140px] sm:max-w-xs">
                      {robotState === 'idle' ? 'Moliyaviy Miya' : statusMessage}
                    </span>
                  </span>
                </div>
                {hasUserMessages && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {statusMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {ttsSupported && (
                <button
                  type="button"
                  onClick={() => {
                    if (autoSpeak) stopSpeaking();
                    setAutoSpeak((prev) => !prev);
                  }}
                  aria-label={autoSpeak ? 'Avto-ovozni oʻchirish' : 'Javoblarni ovozda oʻqish'}
                  title={autoSpeak ? 'Avto-ovoz yoqilgan' : 'Javoblarni ovozda oʻqish'}
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                    autoSpeak
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {autoSpeak ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => receiptTriggerRef.current?.click()}
                aria-label="Chek skanerlash"
                title="Chek yuklash"
                className="hidden sm:flex w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-emerald-500 items-center justify-center cursor-pointer"
              >
                <ScanLine className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setMobileInsightOpen(true)}
                aria-label="AI imkoniyatlarini ochish"
                className="xl:hidden w-9 h-9 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 flex items-center justify-center cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* CENTER STREAM OR IMMERSIVE WELCOME HERO */}
          <div className="relative z-10 flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 space-y-4 min-h-0">
            {!hasUserMessages ? (
              <div className="min-h-full flex flex-col items-center justify-center text-center py-4 sm:py-6 max-w-xl mx-auto gap-4">
                {/* Prominent Centered 3D Robot Mascot */}
                <RobotMascot state={robotState} size="hero" />

                {/* Animated Speech Bubble */}
                <div className="relative px-4 py-2.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] dark:bg-[#081220]/90 text-xs sm:text-sm font-medium text-slate-800 dark:text-emerald-100 shadow-[0_8px_24px_rgba(16,185,129,0.12)] hai-scale-in">
                  <span>
                    {robotState === 'idle'
                      ? `Assalomu alaykum, ${firstName}! Bugun moliyangiz boʻyicha qanday yordam bera olaman?`
                      : statusMessage}
                  </span>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="w-full pt-1">
                  <QuickSuggestion
                    items={QUICK_SUGGESTIONS}
                    onSelect={(prompt) => handleSend(prompt)}
                    disabled={loading}
                    variant="grid"
                  />
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    loading={loading}
                    ttsSupported={ttsSupported}
                    isSpeakingThis={speakingMsgId === msg.id}
                    onSpeak={speakText}
                    onStopSpeak={stopSpeaking}
                    onConfirmTransaction={handleConfirmTransaction}
                    onConfirmProposedAction={handleConfirmProposedAction}
                    onCancelTransaction={handleCancelTransaction}
                    onSaveReceipt={handleSaveScannedReceipt}
                    onRetry={(q) => handleSend(q)}
                  />
                ))}

                {loading && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Bottom Suggestions Strip + Keyboard-safe Composer */}
          <div className="relative z-10 px-3 sm:px-5 pt-2 pb-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/85 dark:bg-[#081220]/75 backdrop-blur-md space-y-2 shrink-0">
            {hasUserMessages && (
              <QuickSuggestion
                items={QUICK_SUGGESTIONS}
                onSelect={(prompt) => handleSend(prompt)}
                disabled={loading}
                variant="chips"
              />
            )}

            <ChatComposer
              value={input}
              onChange={setInput}
              onSend={() => handleSend()}
              onOpenVoice={() => {
                stopSpeaking();
                setListening();
                setVoiceOverlayOpen(true);
              }}
              onUploadFile={handleReceiptUpload}
              loading={loading}
              isListening={voiceOverlayOpen}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: AI Capabilities & Financial Context (Desktop) */}
        <aside className="hidden xl:flex flex-col rounded-[22px] border border-slate-200/85 dark:border-white/[0.09] bg-white/95 dark:bg-[#0D1927]/90 p-4 min-h-0 shadow-[0_12px_36px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_45px_rgba(0,0,0,0.22)]">
          <AIInsightPanel
            healthScore={healthScore}
            onSelectCapability={handleSelectCapability}
            disabled={loading}
          />
        </aside>
      </div>

      {/* Mobile Drawer: Chat History */}
      <Drawer
        isOpen={mobileHistoryOpen}
        onClose={() => setMobileHistoryOpen(false)}
        side="left"
        title="Suhbatlar tarixi"
      >
        <div className="h-[75dvh]">
          <ChatHistory
            conversations={conversations}
            activeId={activeConv?.id || ''}
            onSelect={(id) => {
              stopSpeaking();
              setActiveConvId(id);
              setMobileHistoryOpen(false);
            }}
            onNewChat={handleNewChat}
            onToggleSave={handleToggleSaveConv}
            onDelete={handleDeleteConv}
            onOpenPremiumModal={
              onOpenPremiumModal
                ? () => {
                    setMobileHistoryOpen(false);
                    onOpenPremiumModal();
                  }
                : undefined
            }
          />
        </div>
      </Drawer>

      {/* Mobile Drawer: AI Capabilities & Health Score */}
      <Drawer
        isOpen={mobileInsightOpen}
        onClose={() => setMobileInsightOpen(false)}
        side="bottom"
        title="HISOBOT AI imkoniyatlari"
      >
        <div className="max-h-[70dvh] overflow-y-auto pb-2">
          <AIInsightPanel
            healthScore={healthScore}
            onSelectCapability={handleSelectCapability}
            disabled={loading}
          />
        </div>
      </Drawer>

      {/* Full Immersive Voice Mode Overlay */}
      <VoiceModeOverlay
        isOpen={voiceOverlayOpen}
        onClose={() => {
          setVoiceOverlayOpen(false);
          setIdle();
        }}
        onSendVoiceMessage={(spokenText, langCode) =>
          executeAssistantTurn(spokenText, { speakReply: false, languageHint: langCode })
        }
        onConfirmVoiceAction={(msgId, action) => handleConfirmProposedAction(msgId, action)}
        onCancelVoiceAction={(msgId) => handleCancelTransaction(msgId)}
      />
    </div>
  );
};
