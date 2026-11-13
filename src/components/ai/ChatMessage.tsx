import React from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  RotateCcw,
  Volume2,
  Square,
  Receipt,
  AlertCircle,
  Target,
  Wallet,
} from 'lucide-react';
import { AIChatMessage, AIParsedTransaction, AIProposedAction } from '../../types/finance.ts';
import { formatMoney, formatDateUz, PAYMENT_METHODS_MAP } from '../../utils/formatters.ts';
import { Button } from '../../design-system/index.ts';
import { RobotMascot } from './RobotMascot.tsx';

interface ChatMessageProps {
  message: AIChatMessage;
  loading?: boolean;
  isSpeakingThis?: boolean;
  ttsSupported?: boolean;
  onSpeak?: (text: string, msgId: string) => void;
  onStopSpeak?: () => void;
  onConfirmTransaction: (msgId: string, parsed: AIParsedTransaction) => void;
  onCancelTransaction: (msgId: string) => void;
  onConfirmProposedAction?: (msgId: string, action: AIProposedAction) => void;
  onSaveReceipt?: (msgId: string) => void;
  onRetry?: (query: string) => void;
}

function renderFormattedLine(line: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong
          key={idx}
          className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  loading = false,
  isSpeakingThis = false,
  ttsSupported = false,
  onSpeak,
  onStopSpeak,
  onConfirmTransaction,
  onCancelTransaction,
  onConfirmProposedAction,
  onSaveReceipt,
  onRetry,
}) => {
  const isUser = message.role === 'user';
  const lines = message.content.split('\n');

  return (
    <div
      className={`flex gap-2.5 max-w-2xl hai-fade-up ${
        isUser ? 'ml-auto justify-end' : 'mr-auto justify-start'
      }`}
    >
      {!isUser && (
        <div className="mt-0.5 shrink-0">
          <RobotMascot
            state={message.isError ? 'error' : isSpeakingThis ? 'speaking' : 'idle'}
            size="avatar"
          />
        </div>
      )}

      <div className="space-y-1.5 max-w-[88%] sm:max-w-[82%] min-w-0">
        <div
          className={[
            'p-3.5 sm:p-4 rounded-2xl text-xs sm:text-[13px] leading-relaxed',
            isUser
              ? 'bg-emerald-500/18 dark:bg-emerald-500/20 border border-emerald-500/35 text-slate-900 dark:text-white font-medium rounded-br-xs shadow-[0_6px_20px_rgba(16,185,129,0.12)]'
              : message.isError
              ? 'bg-rose-500/10 border border-rose-500/30 text-slate-900 dark:text-rose-100 rounded-bl-xs'
              : 'bg-white dark:bg-[#0D1927]/95 border border-slate-200/85 dark:border-white/[0.10] text-slate-900 dark:text-slate-100 rounded-bl-xs shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.22)]',
          ].join(' ')}
        >
          {message.isError && (
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-300 font-bold mb-1.5 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Xatolik yuz berdi</span>
            </div>
          )}

          {/* Formatted text lines with highlighted figures */}
          <div className="space-y-1 break-words">
            {lines.map((line, i) =>
              line.trim() === '' ? (
                <div key={i} className="h-1" />
              ) : (
                <p key={i}>{renderFormattedLine(line)}</p>
              )
            )}
          </div>

          {/* Structured Key-Value Summary Table */}
          {message.structuredRows && message.structuredRows.length > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/80 dark:bg-[#081220]/80 divide-y divide-slate-200/60 dark:divide-white/[0.06] overflow-hidden">
              {message.structuredRows.map((row, idx) => (
                <div
                  key={idx}
                  className="px-3 py-2 flex items-center justify-between gap-3 text-[11px] sm:text-xs"
                >
                  <span className="text-slate-500 dark:text-slate-400">{row.label}</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      row.tone === 'rose'
                        ? 'text-rose-600 dark:text-rose-400'
                        : row.tone === 'amber'
                        ? 'text-amber-600 dark:text-amber-400'
                        : row.tone === 'teal'
                        ? 'text-cyan-600 dark:text-cyan-300'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Proposed Action Confirmation Card (Gemini Function Calling: Transaction / Budget / Goal) */}
          {message.proposedAction && message.confirmationState === 'pending' && (
            <div className="mt-3.5 p-3.5 bg-slate-50 dark:bg-[#111B27] rounded-xl border border-emerald-500/25 text-slate-900 dark:text-slate-100 space-y-3">
              {message.proposedAction.actionType === 'transaction' && (
                <>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-white/[0.08] text-xs">
                    <span className="font-bold flex items-center gap-1.5">
                      {message.proposedAction.payload.type === 'income' ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-500" />
                      )}
                      <span>
                        {message.proposedAction.payload.type === 'income' ? 'Kirim' : 'Chiqim'} operatsiyasi
                      </span>
                    </span>
                    <span
                      className={`font-mono font-bold tabular-nums text-sm ${
                        message.proposedAction.payload.type === 'income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {message.proposedAction.payload.type === 'income' ? '+' : '-'}
                      {formatMoney(message.proposedAction.payload.amount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Toifa</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {message.proposedAction.payload.categoryName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Sana</span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {formatDateUz(message.proposedAction.payload.date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Tavsif</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                        {message.proposedAction.payload.description}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Toʻlov usuli</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {PAYMENT_METHODS_MAP[message.proposedAction.payload.paymentMethod]?.label ||
                          message.proposedAction.payload.paymentMethod}
                      </span>
                    </div>
                  </div>
                </>
              )}

              {message.proposedAction.actionType === 'budget' && (
                <>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-white/[0.08] text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-cyan-600 dark:text-cyan-300">
                      <Wallet className="w-4 h-4" />
                      <span>Oylik budjet rejasi</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                      {formatMoney(message.proposedAction.payload.monthlyLimit)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Toifa</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {message.proposedAction.payload.categoryName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Ogohlantirish chegarasi</span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {message.proposedAction.payload.alertThreshold}%
                      </span>
                    </div>
                  </div>
                </>
              )}

              {message.proposedAction.actionType === 'goal' && (
                <>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-white/[0.08] text-xs">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300">
                      <Target className="w-4 h-4" />
                      <span>Yangi moliyaviy maqsad</span>
                    </span>
                    <span className="font-mono font-bold tabular-nums text-sm text-emerald-600 dark:text-emerald-400">
                      {formatMoney(message.proposedAction.payload.targetAmount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Maqsad nomi</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {message.proposedAction.payload.name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Muddat</span>
                      <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        {formatDateUz(message.proposedAction.payload.deadline)}
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="pt-1 flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={loading}
                  leadingIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={() => onConfirmProposedAction?.(message.id, message.proposedAction!)}
                >
                  Tasdiqlash
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => onCancelTransaction(message.id)}
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}

          {/* Legacy Transaction Confirmation Card */}
          {!message.proposedAction && message.parsedTransaction && message.confirmationState === 'pending' && (
            <div className="mt-3.5 p-3.5 bg-slate-50 dark:bg-[#111B27] rounded-xl border border-slate-200 dark:border-white/[0.10] text-slate-900 dark:text-slate-100 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-white/[0.08] text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  {message.parsedTransaction.type === 'income' ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-rose-500" />
                  )}
                  <span>
                    {message.parsedTransaction.type === 'income' ? 'Kirim' : 'Chiqim'} operatsiyasi
                  </span>
                </span>
                <span
                  className={`font-mono font-bold tabular-nums text-sm ${
                    message.parsedTransaction.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {message.parsedTransaction.type === 'income' ? '+' : '-'}
                  {formatMoney(message.parsedTransaction.amount)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Toifa</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {message.parsedTransaction.categoryName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Sana</span>
                  <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                    {formatDateUz(message.parsedTransaction.date)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tavsif</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 break-words">
                    {message.parsedTransaction.description}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Toʻlov usuli</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {PAYMENT_METHODS_MAP[message.parsedTransaction.paymentMethod]?.label ||
                      message.parsedTransaction.paymentMethod}
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
                  onClick={() => onConfirmTransaction(message.id, message.parsedTransaction!)}
                >
                  Tasdiqlash
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => onCancelTransaction(message.id)}
                >
                  Bekor qilish
                </Button>
              </div>
            </div>
          )}

          {/* Scanned Receipt Summary Card */}
          {message.scannedReceipt && (
            <div className="mt-3.5 p-3.5 bg-slate-50 dark:bg-[#111B27] rounded-xl border border-cyan-500/25 text-slate-900 dark:text-slate-100 space-y-2.5">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/70 dark:border-white/[0.08] text-xs">
                <span className="font-bold flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                  <Receipt className="w-4 h-4" />
                  <span>{message.scannedReceipt.merchantName}</span>
                </span>
                <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  -{formatMoney(message.scannedReceipt.totalAmount)}
                </span>
              </div>

              {message.scannedReceipt.lineItems?.length > 0 && (
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  {message.scannedReceipt.lineItems.slice(0, 4).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2">
                      <span className="truncate">{item.name}</span>
                      <span className="font-mono tabular-nums shrink-0">
                        {formatMoney(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!message.receiptSaved && onSaveReceipt ? (
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={loading}
                  leadingIcon={<Check className="w-3.5 h-3.5" />}
                  onClick={() => onSaveReceipt(message.id)}
                >
                  Xarajat sifatida saqlash
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Chek va xarajat saqlandi</span>
                </div>
              )}
            </div>
          )}

          {message.confirmationState === 'confirmed' && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Bazaga saqlandi</span>
            </div>
          )}

          {/* Retry Action on Errors */}
          {message.isError && message.retryQuery && onRetry && (
            <div className="mt-2.5">
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => onRetry(message.retryQuery!)}
              >
                Qayta urinish
              </Button>
            </div>
          )}
        </div>

        {/* Timestamp + optional TTS button for assistant messages */}
        <div
          className={`flex items-center gap-2 px-1 text-[10px] text-slate-400 tabular-nums ${
            isUser ? 'justify-end' : 'justify-start'
          }`}
        >
          <span>{message.timestamp}</span>
          {!isUser && ttsSupported && !message.isError && (
            <button
              type="button"
              onClick={() =>
                isSpeakingThis
                  ? onStopSpeak?.()
                  : onSpeak?.(message.content.replace(/\*\*/g, ''), message.id)
              }
              aria-label={isSpeakingThis ? 'Ovozni toʻxtatish' : 'Javobni ovozda tinglash'}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
            >
              {isSpeakingThis ? (
                <>
                  <Square className="w-2.5 h-2.5 fill-current text-emerald-400" />
                  <span className="text-emerald-400">Toʻxtatish</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3 h-3" />
                  <span>Tinglash</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
