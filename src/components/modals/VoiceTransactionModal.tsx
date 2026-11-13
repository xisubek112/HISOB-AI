/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Check,
  AlertCircle,
  Globe,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { AIParsedTransaction, Category, Transaction } from '../../types/finance.ts';
import { formatMoney, formatDateUz, PAYMENT_METHODS_MAP } from '../../utils/formatters.ts';
import { api } from '../../services/api.ts';
import { Modal, Button } from '../../design-system/index.ts';

interface VoiceTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransactionSaved: (tx: Transaction) => void;
  categories?: Category[];
}

export const VoiceTransactionModal: React.FC<VoiceTransactionModalProps> = ({
  isOpen,
  onClose,
  onTransactionSaved,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState<'uz-UZ' | 'ru-RU' | 'en-US'>('uz-UZ');
  const [parsing, setParsing] = useState(false);
  const [parsedTx, setParsedTx] = useState<AIParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopRecording();
      setTranscript('');
      setParsedTx(null);
      setError('');
    }
  }, [isOpen]);

  const startRecording = () => {
    setError('');
    setParsedTx(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        'Brauzeringizda ovozni aniqlash qoʻllab-quvvatlanmaydi. Matnni qoʻlda yozishingiz yoki tezkor namunalardan foydalanishingiz mumkin.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };
      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setError('Mikrofon ruxsati berilmadi. Brauzer sozlamalaridan mikrofonga ruxsat bering.');
        } else {
          setError(`Ovozni yozishda xatolik (${event.error})`);
        }
        setIsRecording(false);
      };
      recognition.onend = () => setIsRecording(false);

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e: any) {
      setError(e.message || 'Mikrofonni ishga tushirishda xatolik');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleParse = async (textToParse?: string) => {
    const text = (textToParse || transcript).trim();
    if (!text) {
      setError('Iltimos, avval ovozli xabar bering yoki matn kiriting');
      return;
    }

    setParsing(true);
    setError('');

    try {
      const langCode = language.startsWith('uz') ? 'uz' : language.startsWith('ru') ? 'ru' : 'en';
      const res = await api.parseAITransaction(text, langCode);
      setParsedTx(res.parsed);
    } catch (err: any) {
      setError(err.message || 'Tahlil qilishda xatolik yuz berdi');
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!parsedTx || parsedTx.amount <= 0) return;

    setSaving(true);
    try {
      const res = await api.addTransaction({
        type: parsedTx.type,
        amount: parsedTx.amount,
        categoryId: parsedTx.categoryId || 'cat_custom',
        categoryName: parsedTx.categoryName,
        date: parsedTx.date,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        description: parsedTx.description,
        paymentMethod: parsedTx.paymentMethod || 'card',
        notes: `Ovozli kiritish («${transcript}»)`,
      });

      onTransactionSaved(res.transaction);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const samplePhrases = [
    'Bugun 250 ming soʻm oziq-ovqatga sarfladim.',
    'Bugun ish haqimdan 6 million soʻm oldim.',
    'Kecha 100 ming soʻm transportga ketdi.',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Ovozli tranzaksiya kiritish"
      subtitle="Xabaringizni gapiring yoki yozing — tizim uni tahlil qilib tayyorlaydi"
    >
      <div className="space-y-4">
        {/* Language selector */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
            <Globe className="w-3.5 h-3.5 text-cyan-500" />
            <span>Ovoz tili:</span>
          </span>
          <div className="flex p-1 bg-slate-100 dark:bg-[#0D1927] rounded-xl border border-slate-200/70 dark:border-white/[0.08]">
            {[
              { id: 'uz-UZ' as const, label: 'Oʻzbekcha' },
              { id: 'ru-RU' as const, label: 'Русский' },
              { id: 'en-US' as const, label: 'English' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  language === lang.id
                    ? 'bg-white dark:bg-[#111B27] text-cyan-600 dark:text-cyan-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Microphone Action */}
        <div className="py-4 flex flex-col items-center justify-center">
          <button
            type="button"
            aria-label={isRecording ? 'Ovoz yozishni toʻxtatish' : 'Ovoz yozishni boshlash'}
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              isRecording
                ? 'bg-rose-600 text-white ring-8 ring-rose-500/25 shadow-[0_0_28px_rgba(239,68,68,0.45)]'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_10px_28px_rgba(6,182,212,0.32)] hover:scale-105'
            }`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          <span className="text-xs font-semibold mt-3 text-slate-700 dark:text-slate-300">
            {isRecording ? 'Tinglanmoqda... Gapiring' : 'Gapirish uchun mikrofonni bosing'}
          </span>
        </div>

        {/* Transcript Box */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Aniqlangan matn (qoʻlda oʻzgartirish mumkin):
          </label>
          <textarea
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Masalan: Bugun 150 ming soʻm tushlikka sarfladim..."
            className="w-full px-3.5 py-2.5 bg-[#F8FAFC] dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.12] rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500"
          />
        </div>

        {/* Sample phrases */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium">Namunalar:</span>
          {samplePhrases.map((phrase, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setTranscript(phrase);
                handleParse(phrase);
              }}
              className="text-[11px] px-2.5 py-1 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            >
              {phrase}
            </button>
          ))}
        </div>

        {!parsedTx && transcript.trim() && (
          <div className="flex justify-end">
            <Button
              onClick={() => handleParse()}
              loading={parsing}
              leadingIcon={<Sparkles className="w-4 h-4" />}
            >
              Tranzaksiyani aniqlash
            </Button>
          </div>
        )}

        {/* Confirmation Card */}
        {parsedTx && (
          <div className="p-4 bg-cyan-500/[0.08] dark:bg-cyan-500/[0.08] rounded-2xl border border-cyan-500/25 space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-cyan-500/20 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                {parsedTx.type === 'income' ? (
                  <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-rose-500" />
                )}
                <span>{parsedTx.type === 'income' ? 'Kirim' : 'Chiqim'} tranzaksiyasi</span>
              </span>
              <span className="font-mono font-extrabold text-sm tabular-nums text-slate-900 dark:text-white">
                {parsedTx.type === 'income' ? '+' : '-'}
                {formatMoney(parsedTx.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Toifa</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {parsedTx.categoryName}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Sana</span>
                <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatDateUz(parsedTx.date)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tavsif</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {parsedTx.description}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  Toʻlov usuli
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {PAYMENT_METHODS_MAP[parsedTx.paymentMethod]?.label || parsedTx.paymentMethod}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setParsedTx(null)}>
                Qaytadan
              </Button>
              <Button
                size="sm"
                loading={saving}
                onClick={handleConfirmAndSave}
                leadingIcon={<Check className="w-4 h-4" />}
              >
                Tasdiqlash va saqlash
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
