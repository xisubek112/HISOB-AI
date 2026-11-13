/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Mic,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import {
  AIChatMessage,
  AIParsedTransaction,
  Transaction,
  FinancialHealthScore,
} from '../../types/finance.ts';
import { formatMoney, formatDateUz, PAYMENT_METHODS_MAP } from '../../utils/formatters.ts';
import { api } from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { Badge, Button, Card, useToast } from '../../design-system/index.ts';

interface AIAssistantViewProps {
  onTransactionSaved: (tx: Transaction) => void;
  onOpenVoiceModal?: () => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  onTransactionSaved,
  onOpenVoiceModal,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [aiAvatarFailed, setAiAvatarFailed] = useState(false);

  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Assalomu alaykum! Men sizning shaxsiy moliyaviy yordamchingiz — HISOBOT AI man.\n\nTabiiy oʻzbek tilida xarajat yoki daromadingizni yozing (masalan: «Bugun 150 ming ovqatga sarfladim»), ovozli xabar qoldiring yoki moliyaviy holatingiz haqida savol bering («Bu oy qancha pul sarfladim?», «Mening sof daromadim qancha?»).',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthScore, setHealthScore] = useState<FinancialHealthScore | null>(null);
  const [showHealthBreakdown, setShowHealthBreakdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (!user) return;
    const loadHealth = async () => {
      try {
        const res = await api.getHealthScore();
        setHealthScore(res.healthScore);
      } catch (e) {
        console.error('Failed to load health score:', e);
      }
    };
    loadHealth();
  }, [user]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: AIChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const qLower = query.toLowerCase();
      const isQuestion =
        query.includes('?') ||
        qLower.includes('qancha') ||
        qLower.includes('nimaga') ||
        qLower.includes('qayerdan') ||
        qLower.includes('maslahat') ||
        qLower.includes('taqqos') ||
        qLower.includes('holat') ||
        qLower.includes('balans') ||
        qLower.includes('koʻp pulim');

      if (isQuestion) {
        const res = await api.askAIChat(query);
        const assistantMsg: AIChatMessage = {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const res = await api.parseAITransaction(query);
        const parsed = res.parsed;

        let content = '';
        if (parsed.missingFields && parsed.missingFields.length > 0) {
          content =
            parsed.clarificationQuestion ||
            'Tranzaksiyani toʻliq saqlash uchun summa yetishmayapti. Iltimos, summani kiriting.';
        } else {
          content =
            'Sizning xabaringizdan quyidagi tranzaksiyani aniqladim. Uni tizimga kiritishni tasdiqlaysizmi?';
        }

        const assistantMsg: AIChatMessage = {
          id: `msg_a_${Date.now()}`,
          role: 'assistant',
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          parsedTransaction: parsed.amount > 0 ? parsed : undefined,
          confirmationState: parsed.amount > 0 ? 'pending' : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          role: 'assistant',
          content: `Kechirasiz, soʻrovingizni qayta ishlashda xatolik yuz berdi: ${
            err.message || 'Serverga ulanib boʻlmadi'
          }. Iltimos, qaytadan urinib koʻring.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransaction = async (msgId: string, parsed: AIParsedTransaction) => {
    try {
      setLoading(true);
      const res = await api.addTransaction({
        type: parsed.type,
        amount: parsed.amount,
        categoryId: parsed.categoryId || 'cat_custom',
        categoryName: parsed.categoryName,
        date: parsed.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: parsed.description,
        paymentMethod: parsed.paymentMethod,
        notes: 'AI yordamchi orqali kiritildi',
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                confirmationState: 'confirmed',
                content: `Tranzaksiya muvaffaqiyatli saqlandi! ${
                  parsed.type === 'income' ? 'Kirim' : 'Chiqim'
                }: ${parsed.type === 'income' ? '+' : '-'}${formatMoney(parsed.amount)} (${parsed.categoryName}).`,
              }
            : m
        )
      );

      toast.success('Tranzaksiya bazaga saqlandi');
      onTransactionSaved(res.transaction);
    } catch (err: any) {
      toast.error(err?.message || 'Tranzaksiyani saqlashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransaction = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId
          ? {
              ...m,
              confirmationState: 'cancelled',
              content: 'Tranzaksiya bekor qilindi va tizimga saqlanmadi.',
            }
          : m
      )
    );
  };

  const suggestedQueries = [
    'Bugun 150 ming soʻm ovqatga sarfladim.',
    'Ishdan 5 million soʻm oylik oldim.',
    'Kecha 80 ming transportga ketdi.',
    'Bugun 200 ming soʻm internet toʻlovini qildim.',
    'Bu oy qancha pul sarfladim?',
    'Eng koʻp pulim nimaga ketmoqda?',
    'Mening sof daromadim qancha?',
    'Qayerdan tejashim mumkin?',
  ];

  const renderAIAvatar = (sizeClass = 'w-8 h-8') => {
    if (aiAvatarFailed) {
      return (
        <div
          className={`${sizeClass} rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-300 flex items-center justify-center shrink-0`}
        >
          <Bot className="w-4 h-4" />
        </div>
      );
    }
    return (
      <img
        src="/src/assets/images/avatar_ai_assistant_1794280921346.jpg"
        alt="HISOBOT AI"
        referrerPolicy="no-referrer"
        onError={() => setAiAvatarFailed(true)}
        className={`${sizeClass} rounded-xl object-cover border border-cyan-500/35 shrink-0`}
      />
    );
  };

  return (
    <div className="space-y-4">
      {/* Financial Health Score Widget — Deep Navy + Teal AI identity */}
      {healthScore && (
        <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#081220] via-[#0B2330] to-[#0D3A45] text-white border border-cyan-500/25 shadow-[0_12px_32px_rgba(6,182,212,0.12)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.08] border border-cyan-400/25 flex flex-col items-center justify-center font-mono tabular-nums shrink-0">
                <span className="text-xl font-extrabold text-emerald-400 leading-none">
                  {healthScore.score}
                </span>
                <span className="text-[10px] text-cyan-200 mt-0.5">/ 100</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-cyan-300">
                    AI moliyaviy salomatlik indeksi
                  </span>
                  <Badge tone="emerald">
                    Daraja: {healthScore.grade} ({healthScore.title})
                  </Badge>
                </div>
                <p className="text-xs text-slate-200 mt-1 max-w-xl leading-relaxed">
                  {healthScore.summary}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHealthBreakdown(!showHealthBreakdown)}
              className="min-h-10 px-3 py-1.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.12] flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-white transition-colors self-start sm:self-center shrink-0 cursor-pointer"
            >
              <span>{showHealthBreakdown ? 'Yashirish' : 'Tafsilotlar'}</span>
              {showHealthBreakdown ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {showHealthBreakdown && (
            <div className="mt-4 pt-4 border-t border-white/[0.10] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              {healthScore.breakdown.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/[0.05] border border-white/[0.08]"
                >
                  <div className="flex items-center justify-between text-cyan-200 font-semibold mb-1">
                    <span>{item.factor}</span>
                    <span className="font-mono tabular-nums text-emerald-300">
                      {item.score}/{item.maxScore}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-normal">{item.feedback}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Chat Container */}
      <Card
        padding="none"
        className="h-[calc(100dvh-16rem)] min-h-[440px] max-h-[720px] flex flex-col overflow-hidden"
      >
        {/* Assistant Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#0D1927] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {renderAIAvatar('w-9 h-9')}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  HISOBOT AI Assistent
                </span>
                <Badge tone="teal">Tabiiy til</Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Matn va ovozli moliyaviy soʻrovlarni tahlil qiladi
              </p>
            </div>
          </div>

          {onOpenVoiceModal && (
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Mic className="w-3.5 h-3.5 text-cyan-500" />}
              onClick={onOpenVoiceModal}
              className="border-cyan-500/30 text-cyan-700 dark:text-cyan-300"
            >
              <span className="hidden sm:inline">Ovoz bilan kiritish</span>
              <span className="sm:hidden">Ovoz</span>
            </Button>
          )}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 max-w-2xl ${
                  isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {!isUser && <div className="mt-0.5">{renderAIAvatar('w-8 h-8')}</div>}

                <div className="space-y-1.5 max-w-[86%] sm:max-w-[78%] min-w-0">
                  <div
                    className={[
                      'p-3.5 sm:p-4 rounded-2xl text-xs leading-relaxed',
                      isUser
                        ? 'bg-emerald-500 text-slate-950 font-medium rounded-br-xs shadow-[0_6px_18px_rgba(16,185,129,0.20)]'
                        : 'bg-slate-100 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 rounded-bl-xs',
                    ].join(' ')}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    {/* Transaction Confirmation Card */}
                    {msg.parsedTransaction && msg.confirmationState === 'pending' && (
                      <div className="mt-3.5 p-3.5 bg-white dark:bg-[#111B27] rounded-xl border border-slate-200 dark:border-white/[0.10] text-slate-900 dark:text-slate-100 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-white/[0.08] text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            {msg.parsedTransaction.type === 'income' ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-rose-500" />
                            )}
                            <span>
                              {msg.parsedTransaction.type === 'income' ? 'Kirim' : 'Chiqim'} operatsiyasi
                            </span>
                          </span>
                          <span
                            className={[
                              'font-mono font-bold tabular-nums text-sm',
                              msg.parsedTransaction.type === 'income'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400',
                            ].join(' ')}
                          >
                            {msg.parsedTransaction.type === 'income' ? '+' : '-'}
                            {formatMoney(msg.parsedTransaction.amount)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Toifa</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {msg.parsedTransaction.categoryName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Sana</span>
                            <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                              {formatDateUz(msg.parsedTransaction.date)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Tavsif</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                              {msg.parsedTransaction.description}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Toʻlov usuli</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {PAYMENT_METHODS_MAP[msg.parsedTransaction.paymentMethod]?.label ||
                                msg.parsedTransaction.paymentMethod}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            fullWidth
                            disabled={loading}
                            leadingIcon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => handleConfirmTransaction(msg.id, msg.parsedTransaction!)}
                          >
                            Tasdiqlash
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={loading}
                            onClick={() => handleCancelTransaction(msg.id)}
                          >
                            Bekor qilish
                          </Button>
                        </div>
                      </div>
                    )}

                    {msg.confirmationState === 'confirmed' && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Bazaga saqlandi</span>
                      </div>
                    )}
                  </div>

                  <div
                    className={`text-[10px] text-slate-400 tabular-nums px-1 ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-2.5 mr-auto items-center">
              {renderAIAvatar('w-8 h-8')}
              <div className="px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-[#0D1927] border border-slate-200/70 dark:border-white/[0.08] text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-500 animate-spin" />
                <span>HISOBOT AI tahlil qilmoqda...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompts */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/70 dark:bg-[#0D1927]/70 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            Misollar:
          </span>
          {suggestedQueries.map((q, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSend(q)}
              disabled={loading}
              className="min-h-8 px-3 py-1 bg-white dark:bg-[#111B27] border border-slate-200 dark:border-white/[0.10] hover:border-cyan-500/50 text-slate-700 dark:text-slate-200 rounded-xl text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Keyboard-safe Input Composer */}
        <div className="p-3 sm:p-4 border-t border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-[#111B27]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Masalan: «Bugun 200 ming internetga sarfladim» yoki savol yozing..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 min-h-11 px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.12] rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 disabled:opacity-50"
            />

            {onOpenVoiceModal && (
              <button
                type="button"
                onClick={onOpenVoiceModal}
                aria-label="Ovozli kiritish"
                className="min-h-11 min-w-11 flex items-center justify-center text-slate-500 hover:text-cyan-500 dark:text-slate-400 dark:hover:text-cyan-300 bg-slate-100 dark:bg-white/[0.06] rounded-xl transition-colors shrink-0 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={loading || !input.trim()}
              aria-label="Yuborish"
              className="min-w-11 px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};
