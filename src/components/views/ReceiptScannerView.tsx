/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Receipt,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { ScannedReceipt, ReceiptLineItem, CurrencyCode } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney, formatDateUz } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const ReceiptScannerView: React.FC<{ onTransactionSaved?: () => void }> = ({
  onTransactionSaved,
}) => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  // Scanning flow state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.getReceipts();
      setReceipts(res.receipts || []);
    } catch (e) {
      console.error('Failed to load receipts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadReceipts();
    }
  }, [user]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      triggerScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSelectedImage(base64);
      triggerScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const triggerScan = async (imgData: string) => {
    try {
      setScanning(true);
      setParsedResult(null);
      setSaveSuccess(false);

      const res = await api.scanReceipt(imgData);
      setParsedResult(res.parsed);
    } catch (err: any) {
      alert(err.message || 'Chekni skanerlashda xatolik yuz berdi');
    } finally {
      setScanning(false);
    }
  };

  const loadSampleReceipt = () => {
    // Demo receipt sample
    const sampleText = `KORZINKA SUPERMARKET
Xarid cheki №48291
Sana: ${new Date().toISOString().split('T')[0]} 18:42
--------------------------------
1. Sut 3.2% 1L           12,500
2. Non qolipli            4,000
3. Pishloq Gollandskiy   48,000
4. Banan 1.4kg           31,500
5. Shokolad Nestle       16,000
--------------------------------
JAMI:                   112,000 UZS
To'lov turi: Karta (HUMO)
Fiskal belgi: 8943180921`;

    setSelectedImage('/src/assets/images/sample_receipt.png');
    triggerScan(sampleText);
  };

  const handleConfirmAndSave = async () => {
    if (!parsedResult) return;
    try {
      setSaving(true);
      await api.saveReceipt(parsedResult);
      setSaveSuccess(true);
      setParsedResult(null);
      setSelectedImage(null);
      await loadReceipts();
      if (onTransactionSaved) {
        onTransactionSaved();
      }
    } catch (err: any) {
      alert(err.message || 'Tranzaksiyani saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            AI Chek Skaneri (OCR)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Xarid chekining suratini yuklang — Gemini AI tovarlar roʻyxati va summani avtomatik ajratib oladi
          </p>
        </div>

        <button
          onClick={loadSampleReceipt}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl hover:bg-blue-100 transition-colors shadow-xs"
        >
          <Sparkles className="w-4 h-4" />
          <span>Sinov chekini tekshirish (Demo)</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold">
              Chek muvaffaqiyatli xarajatlar roʻyxatiga qoʻshildi va hisobotingiz yangilandi!
            </span>
          </div>
          <button
            onClick={() => setSaveSuccess(false)}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-3xl p-8 text-center cursor-pointer bg-white dark:bg-slate-900 transition-all group flex flex-col items-center justify-center min-h-[280px]"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Camera className="w-8 h-8" />
            </div>

            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
              Chek fotosuratini yuklang yoki bu yerga tashlang
            </h3>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              JPG, PNG formatidagi kassa cheklari, supermarket yoki restoran hisob-fakturalari
            </p>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Upload className="w-3.5 h-3.5" />
              <span>Faylni tanlash</span>
            </div>
          </div>

          {/* AI Security Note */}
          <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-200">
                Gemini 3.8 Flash Multimodal OCR:
              </span>{' '}
              Oʻzbekistondagi fiskal cheklar (Korzinka, Havas, Makro, Click, Payme va boshqalar) matnini aniq taniydi va mahsulotlar kesimida tahlil qiladi.
            </div>
          </div>
        </div>

        {/* Scan Result & Confirmation Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  Tan olingan maʼlumotlar
                </h3>
              </div>
              {parsedResult && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  Ishonch: {parsedResult.confidence}%
                </span>
              )}
            </div>

            {scanning ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Chek tahlil qilinmoqda...
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Gemini AI chekdagi doʻkon nomi, sana va mahsulotlarni oʻqimoqda
                </div>
              </div>
            ) : parsedResult ? (
              <div className="space-y-4">
                {/* Duplicate Warning */}
                {parsedResult.isDuplicate && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Ehtimoliy takroriy chek:</span> Ushbu sana va summada oldin ham operatsiya qayd etilgan. Saqlashdan oldin tekshirib oling.
                    </div>
                  </div>
                )}

                {/* Form preview */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Doʻkon / Savdo nuqtasi</span>
                    <input
                      type="text"
                      value={parsedResult.merchantName}
                      onChange={(e) => setParsedResult({ ...parsedResult, merchantName: e.target.value })}
                      className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-0 focus:outline-hidden mt-0.5"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Sana</span>
                    <input
                      type="date"
                      value={parsedResult.date}
                      onChange={(e) => setParsedResult({ ...parsedResult, date: e.target.value })}
                      className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-0 focus:outline-hidden mt-0.5 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40">
                    <span className="text-[10px] text-blue-500 uppercase font-semibold">Jami summa</span>
                    <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                      {formatMoney(parsedResult.totalAmount, parsedResult.currency)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Tavsiya etilgan kategoriya</span>
                    <input
                      type="text"
                      value={parsedResult.categorySuggested}
                      onChange={(e) => setParsedResult({ ...parsedResult, categorySuggested: e.target.value })}
                      className="w-full text-xs font-bold text-slate-900 dark:text-slate-100 bg-transparent border-0 focus:outline-hidden mt-0.5"
                    />
                  </div>
                </div>

                {/* Line items table */}
                {parsedResult.lineItems && parsedResult.lineItems.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Mahsulotlar tarkibi ({parsedResult.lineItems.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedResult.lineItems.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                          <span className="text-slate-800 dark:text-slate-200 truncate pr-2">
                            {item.name}
                          </span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                            {formatMoney(item.price, 'UZS')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 text-xs">
                Chek skanerlangandan soʻng bu yerda toʻliq hisob-kitob va mahsulotlar tarkibi paydo boʻladi.
              </div>
            )}
          </div>

          {parsedResult && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setParsedResult(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleConfirmAndSave}
                disabled={saving}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tasdiqlash va saqlash</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scanned Receipts History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              Skanerlangan cheklar arxivi
            </h3>
            <p className="text-[11px] text-slate-400">
              Barcha saqlangan kassa cheklari va mahsulotlar tafsiloti
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {receipts.length} ta chek
          </span>
        </div>

        {receipts.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hali skanerlangan cheklar yoʻq.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {receipts.map((rec) => (
              <div key={rec.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {rec.merchantName}
                    </h4>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {rec.date} • {rec.lineItems?.length || 0} ta mahsulot • {rec.categorySuggested}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-extrabold font-mono text-slate-900 dark:text-slate-100">
                    {formatMoney(rec.totalAmount, rec.currency)}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    Saqlangan
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
