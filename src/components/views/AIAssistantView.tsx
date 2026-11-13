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
  X,
  AlertCircle,
  HelpCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  CheckCircle2,
  Calendar,
  CreditCard,
  Tag,
  Mic,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
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

interface AIAssistantViewProps {
  onTransactionSaved: (tx: Transaction) => void;
  onOpenVoiceModal?: () => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  onTransactionSaved,
  onOpenVoiceModal,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Assalomu alaykum! Men sizning shaxsiy moliyaviy yordamchingiz — HISOBOT AI man.\n\nSiz menga tabiiy oʻzbek tilida xarajat yoki daromadingizni aytishingiz mumkin (masalan: «Bugun 150 ming ovqatga sarfladim»), ovozli xabar qoldirishingiz yoki moliyaviy holatingiz haqida savol berishingiz mumkin («Bu oy qancha pul sarfladim?», «Mening sof daromadim qancha?»).',
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
          content = `Sizning xabaringizdan quyidagi tranzaksiyani aniqladim. Uni tizimga kiritishni tasdiqlaysizmi?`;
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
        notes: `AI yordamchi orqali kiritildi`,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                confirmationState: 'confirmed',
                content: `Tranzaksiya muvaffaqiyatli saqlandi! ${
                  parsed.type === 'income' ? 'Kirim' : 'Chiqim'
                }: +${formatMoney(parsed.amount)} (${parsed.categoryName}). Bosh sahifa yangilandi.`,
              }
            : m
        )
      );

      onTransactionSaved(res.transaction);
    } catch (err: any) {
      alert(`Xatolik: ${err.message}`);
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

  return (
    <div className="space-y-4">
      {/* Financial Health Score Widget */}
      {healthScore && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex flex-col items-center justify-center font-mono shrink-0">
                <span className="text-xl font-extrabold text-emerald-400 leading-none">
                  {healthScore.score}
                </span>
                <span className="text-[10px] text-blue-200 mt-0.5">/ 100</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300">
                    AI Moliyaviy Salomatlik Indeksi
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Daraja: {healthScore.grade} ({healthScore.title})
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-1 max-w-xl leading-relaxed">
                  {healthScore.summary}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHealthBreakdown(!showHealthBreakdown)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-200 hover:text-white transition-colors self-end sm:self-center"
            >
              <span>{showHealthBreakdown ? 'Yashirish' : 'Tafsilotlar'}</span>
              {showHealthBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showHealthBreakdown && (
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {healthScore.breakdown.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="flex items-center justify-between text-blue-200 font-semibold mb-1">
                    <span>{item.factor}</span>
                    <span className="font-mono text-emerald-300">
                      {item.score}/{item.maxScore}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-100 leading-normal">
                    {item.feedback}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat Container */}
      <div className="h-[calc(100vh-14rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Assistant Header Banner */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  HISOBOT AI Assistent
                </span>
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Oʻzbek tilidagi tabiiy matn va ovozli soʻrovlarni qabul qiladi
              </p>
            </div>
          </div>

          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Ovoz bilan kiritish</span>
            </button>
          )}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${
                  isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className="space-y-2 max-w-[85%] sm:max-w-[78%]">
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {/* Transaction Confirmation Card */}
                    {msg.parsedTransaction && msg.confirmationState === 'pending' && (
                      <div className="mt-3.5 p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs text-slate-900 dark:text-slate-100 space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                          <span className="font-bold flex items-center gap-1.5">
                            {msg.parsedTransaction.type === 'income' ? (
                              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-rose-600" />
                            )}
                            <span>
                              {msg.parsedTransaction.type === 'income' ? 'Kirim' : 'Chiqim'} tranzaksiyasi
                            </span>
                          </span>
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {msg.parsedTransaction.type === 'income' ? '+' : '-'}
                            {formatMoney(msg.parsedTransaction.amount)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Toifa:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {msg.parsedTransaction.categoryName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Sana:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {formatDateUz(msg.parsedTransaction.date)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Tavsif:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {msg.parsedTransaction.description}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Toʻlov usuli:</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {PAYMENT_METHODS_MAP[msg.parsedTransaction.paymentMethod]?.label ||
                                msg.parsedTransaction.paymentMethod}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleConfirmTransaction(msg.id, msg.parsedTransaction!)}
                            disabled={loading}
                            className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Tasdiqlash va saqlash</span>
                          </button>
                          <button
                            onClick={() => handleCancelTransaction(msg.id)}
                            disabled={loading}
                            className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            Bekor qilish
                          </button>
                        </div>
                      </div>
                    )}

                    {msg.confirmationState === 'confirmed' && (
                      <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Bazaga saqlandi</span>
                      </div>
                    )}
                  </div>

                  <div className={`text-[10px] text-slate-400 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 mr-auto items-center">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-500 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                <span>HISOBOT AI tahlil qilmoqda...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Quick Prompt Bubbles */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-x-auto whitespace-nowrap scrollbar-none flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider shrink-0">
            Misollar:
          </span>
          {suggestedQueries.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Matn kiriting (masalan: «Bugun 200 ming soʻm internet toʻlovini qildim» yoki «Mening sof daromadim qancha?»)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />

            {onOpenVoiceModal && (
              <button
                type="button"
                onClick={onOpenVoiceModal}
                title="Ovozli kiritish"
                className="p-2.5 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
