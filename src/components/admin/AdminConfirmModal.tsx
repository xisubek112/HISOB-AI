/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

interface AdminConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetSummary?: string;
  confirmLabel?: string;
  danger?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = ({
  isOpen,
  title,
  description,
  targetSummary,
  confirmLabel = 'Tasdiqlash va bajarish',
  danger = false,
  submitting = false,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setAcknowledged(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!acknowledged) {
      setError('Amalni bajarishdan oldin tasdiqlash katakchasini belgilang.');
      return;
    }
    if (trimmed.length < 3) {
      setError('Audit jurnali uchun kamida 3 ta belgidan iborat sabab kiriting.');
      return;
    }
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err: any) {
      setError(err?.message || 'Amalni bajarishda xatolik yuz berdi');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-confirm-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#061411]/75 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-[#0B1D20] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                danger
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 id="admin-confirm-title" className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h2>
              {targetSummary && (
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                  {targetSummary}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label
              htmlFor="admin-action-reason"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Audit jurnali uchun sabab *
            </label>
            <textarea
              id="admin-action-reason"
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: Toʻlov cheki tekshirildi va Pro tarifi faollashtirildi"
              className="w-full rounded-lg border border-slate-200 dark:border-white/[0.12] bg-slate-50 dark:bg-[#071B18] px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-emerald-500 cursor-pointer shrink-0"
            />
            <span>
              Ushbu imtiyozli administrator amali audit jurnaliga yozilishini tasdiqlayman.
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-[40px] px-4 rounded-lg border border-slate-200 dark:border-white/[0.12] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                danger
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-[#05251D]'
              }`}
            >
              {submitting ? 'Bajarilmoqda...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
