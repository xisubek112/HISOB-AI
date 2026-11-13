/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  X,
  Sparkles,
  Check,
  RotateCcw,
  AlertCircle,
  Globe,
  ArrowDownLeft,
  ArrowUpRight,
  Volume2,
} from 'lucide-react';
import { AIParsedTransaction, Category, Transaction } from '../../types/finance.ts';
import { formatMoney, formatDateUz, PAYMENT_METHODS_MAP } from '../../utils/formatters.ts';
import { api } from '../../services/api.ts';

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
  categories = [],
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [language, setLanguage] = useState<'uz-UZ' | 'ru-RU' | 'en-US'>('uz-UZ');
  const [parsing, setParsing] = useState(false);
  const [parsedTx, setParsedTx] = useState<AIParsedTransaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

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
      setSpeechSupported(false);
      setError('Brauzeringizda ovozni aniqlash (SpeechRecognition) qoʻllab-quvvatlanmaydi. Matnni qoʻlda yozishingiz yoki tezkor namunalardan foydalanishingiz mumkin.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let current = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Mikrofon ruxsati berilmadi. Iltimos, brauzerda mikrofonga ruxsat bering.');
        } else {
          setError(`Ovozni yozishda xatolik yuz berdi (${event.error})`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

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
      setError(err.message || 'AI tahlilida xatolik yuz berdi');
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
        notes: `Ovozli buyruq orqali kiritildi («${transcript}»)`,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Ovozli tranzaksiya kiritish
              </h3>
              <p className="text-[11px] text-slate-400">
                Moliyaviy xabaringizni gapiring — AI uni tahlil qilib tasdiqlash uchun tayyorlaydi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language selector */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="text-slate-500 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            <span>Ovoz tili:</span>
          </span>
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setLanguage('uz-UZ')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                language === 'uz-UZ'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Oʻzbekcha
            </button>
            <button
              onClick={() => setLanguage('ru-RU')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                language === 'ru-RU'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Русский
            </button>
            <button
              onClick={() => setLanguage('en-US')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                language === 'en-US'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-3 p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl flex items-center gap-2 border border-rose-200 dark:border-rose-900/40">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Microphone Central Action */}
        <div className="my-6 flex flex-col items-center justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse ring-8 ring-rose-200 dark:ring-rose-900/40'
                : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
            }`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          <span className="text-xs font-semibold mt-3 text-slate-700 dark:text-slate-300">
            {isRecording ? 'Tinglanmoqda... Gapiring' : 'Gapirish uchun tugmani bosing'}
          </span>
        </div>

        {/* Transcript Box with Manual Edit */}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Aniqlangan matn (qoʻlda oʻzgartirish mumkin):
          </label>
          <textarea
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Ovozli xabaringiz matni bu yerda paydo boʻladi..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Sample phrases */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[10px] text-slate-400 shrink-0 font-medium">Namunalar:</span>
          {samplePhrases.map((phrase, i) => (
            <button
              key={i}
              onClick={() => {
                setTranscript(phrase);
                handleParse(phrase);
              }}
              className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 rounded-md shrink-0 transition-colors"
            >
              {phrase}
            </button>
          ))}
        </div>

        {/* Parse Button if not parsed */}
        {!parsedTx && transcript && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => handleParse()}
              disabled={parsing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{parsing ? 'AI tahlil qilmoqda...' : 'Tranzaksiyani aniqlash'}</span>
            </button>
          </div>
        )}

        {/* Confirmation Card (Requirement: Parsed before saving, user confirmation required) */}
        {parsedTx && (
          <div className="mt-4 p-4 bg-blue-50/60 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/50 dark:border-blue-900/50 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-slate-100">
                {parsedTx.type === 'income' ? (
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                )}
                <span>{parsedTx.type === 'income' ? 'Kirim' : 'Chiqim'} tranzaksiyasi</span>
              </span>
              <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                {parsedTx.type === 'income' ? '+' : '-'}
                {formatMoney(parsedTx.amount)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block">Toifa:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {parsedTx.categoryName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Sana:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatDateUz(parsedTx.date)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Tavsif:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {parsedTx.description}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Toʻlov usuli:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {PAYMENT_METHODS_MAP[parsedTx.paymentMethod]?.label || parsedTx.paymentMethod}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setParsedTx(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                Qaytadan
              </button>
              <button
                onClick={handleConfirmAndSave}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{saving ? 'Saqlanmoqda...' : 'Tasdiqlash va saqlash'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
