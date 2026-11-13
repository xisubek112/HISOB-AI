/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  Upload,
  Receipt,
  Sparkles,
  CheckCircle2,
  ShieldAlert,
  Loader2,
  X,
} from 'lucide-react';
import { ScannedReceipt } from '../../types/finance.ts';
import { api } from '../../services/api.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  useToast,
} from '../../design-system/index.ts';

export const ReceiptScannerView: React.FC<{ onTransactionSaved?: () => void }> = ({
  onTransactionSaved,
}) => {
  const { user } = useAuth();
  const toast = useToast();
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<Omit<ScannedReceipt, 'id' | 'userId' | 'createdAt'> | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReceipts = useCallback(async () => {
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
  }, [user]);

  useEffect(() => {
    if (user) {
      loadReceipts();
    }
  }, [user, loadReceipts]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreviewError(false);
      setSelectedImage(base64);
      triggerScan(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const triggerScan = async (imgData: string) => {
    try {
      setScanning(true);
      setParsedResult(null);
      const res = await api.scanReceipt(imgData);
      setParsedResult(res.parsed);
    } catch (err: any) {
      toast.error(err?.message || 'Chekni skanerlashda xatolik yuz berdi');
    } finally {
      setScanning(false);
    }
  };

  const loadSampleReceipt = () => {
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

    setImagePreviewError(false);
    setSelectedImage('__sample__');
    triggerScan(sampleText);
  };

  const handleConfirmAndSave = async () => {
    if (!parsedResult) return;
    try {
      setSaving(true);
      await api.saveReceipt(parsedResult);
      setParsedResult(null);
      setSelectedImage(null);
      await loadReceipts();
      toast.success('Chek xarajatlar roʻyxatiga saqlandi');
      if (onTransactionSaved) {
        onTransactionSaved();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Tranzaksiyani saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const confidencePercent = parsedResult
    ? parsedResult.confidence <= 1
      ? Math.round(parsedResult.confidence * 100)
      : Math.round(parsedResult.confidence)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white text-balance">
            Chek skaneri (OCR)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Xarid chekining suratini yuklang — tizim doʻkon nomi, sana va mahsulotlarni ajratib beradi
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leadingIcon={<Sparkles className="w-4 h-4 text-cyan-500" />}
          onClick={loadSampleReceipt}
          className="border-cyan-500/30 text-cyan-700 dark:text-cyan-300"
        >
          Sinov chekini tekshirish (Demo)
        </Button>
      </div>

      {/* Main Scanner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload & Preview Zone */}
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className="border-2 border-dashed border-slate-300 dark:border-white/[0.14] hover:border-cyan-500 rounded-2xl p-6 sm:p-8 text-center cursor-pointer bg-white dark:bg-[#111B27] transition-colors flex flex-col items-center justify-center min-h-[260px]"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {selectedImage === '__sample__' ? (
              <div className="w-full max-w-xs rounded-xl bg-slate-50 dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.10] p-4 text-left font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white border-b border-dashed border-slate-300 dark:border-white/[0.12] pb-1.5 mb-1.5">
                  <span>KORZINKA SUPERMARKET</span>
                  <span>№48291</span>
                </div>
                <div className="flex justify-between"><span>1. Sut 3.2% 1L</span><span>12 500</span></div>
                <div className="flex justify-between"><span>2. Non qolipli</span><span>4 000</span></div>
                <div className="flex justify-between"><span>3. Pishloq</span><span>48 000</span></div>
                <div className="flex justify-between"><span>4. Banan 1.4kg</span><span>31 500</span></div>
                <div className="flex justify-between"><span>5. Shokolad</span><span>16 000</span></div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 border-t border-dashed border-slate-300 dark:border-white/[0.12] pt-1.5 mt-1.5">
                  <span>JAMI:</span>
                  <span>112 000 soʻm</span>
                </div>
              </div>
            ) : selectedImage && !imagePreviewError ? (
              <div className="relative w-full max-w-xs">
                <img
                  src={selectedImage}
                  alt="Yuklangan chek"
                  referrerPolicy="no-referrer"
                  onError={() => setImagePreviewError(true)}
                  className="max-h-52 mx-auto rounded-xl object-contain border border-slate-200 dark:border-white/[0.10]"
                />
                <button
                  type="button"
                  aria-label="Tanlangan rasmni tozalash"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage(null);
                    setParsedResult(null);
                  }}
                  className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4">
                  <Camera className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  Chek fotosuratini yuklang yoki shu yerga tashlang
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                  JPG, PNG formatidagi kassa cheklari va xarid kvitansiyalari
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#0D1927] border border-slate-200 dark:border-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Faylni tanlash</span>
                </div>
              </>
            )}
          </div>

          <Card padding="md" className="bg-cyan-500/[0.06] border-cyan-500/20">
            <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Avtomatik chek tahlili (demo OCR):
                </span>{' '}
                Mahalliy savdo nuqtalari cheklaridan doʻkon nomi, sana, umumiy summa va mahsulotlar roʻyxatini ajratib koʻrsatadi.
              </div>
            </div>
          </Card>
        </div>

        {/* Scan Result & Confirmation Panel */}
        <Card padding="lg" className="flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.08] mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-cyan-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Ajratib olingan maʼlumotlar
                </h3>
              </div>
              {parsedResult && (
                <Badge tone="emerald" className="tabular-nums">
                  Ishonch: {confidencePercent}%
                </Badge>
              )}
            </div>

            {scanning ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <Loader2 className="w-9 h-9 text-cyan-500 animate-spin mb-3" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Chek tahlil qilinmoqda...
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Doʻkon nomi, sana va mahsulotlar roʻyxati aniqlanmoqda
                </div>
              </div>
            ) : parsedResult ? (
              <div className="space-y-4">
                {parsedResult.isDuplicate && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Ehtimoliy takroriy chek:</span> Ushbu sana va summada oldin ham operatsiya qayd etilgan.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Doʻkon / Savdo nuqtasi"
                    type="text"
                    value={parsedResult.merchantName}
                    onChange={(e) =>
                      setParsedResult({ ...parsedResult, merchantName: e.target.value })
                    }
                  />

                  <Input
                    label="Sana"
                    type="date"
                    value={parsedResult.date}
                    onChange={(e) => setParsedResult({ ...parsedResult, date: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/25">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold block">
                      Jami summa
                    </span>
                    <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {formatMoney(parsedResult.totalAmount, parsedResult.currency)}
                    </div>
                  </div>

                  <Input
                    label="Tavsiya etilgan kategoriya"
                    type="text"
                    value={parsedResult.categorySuggested}
                    onChange={(e) =>
                      setParsedResult({ ...parsedResult, categorySuggested: e.target.value })
                    }
                  />
                </div>

                {parsedResult.lineItems && parsedResult.lineItems.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 tabular-nums">
                      Mahsulotlar tarkibi ({parsedResult.lineItems.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-white/[0.08] divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {parsedResult.lineItems.map((item, idx) => (
                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs gap-2">
                          <span className="text-slate-800 dark:text-slate-200 truncate">
                            {item.name}
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white shrink-0">
                            {formatMoney(item.price, 'UZS')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs">
                Chek skanerlangandan soʻng bu yerda hisob-kitob va mahsulotlar tarkibi koʻrinadi.
              </div>
            )}
          </div>

          {parsedResult && (
            <div className="pt-4 border-t border-slate-100 dark:border-white/[0.08] flex items-center justify-end gap-2.5 mt-4">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setParsedResult(null);
                  setSelectedImage(null);
                }}
              >
                Bekor qilish
              </Button>
              <Button
                variant="primary"
                size="md"
                loading={saving}
                leadingIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleConfirmAndSave}
              >
                {saving ? 'Saqlanmoqda...' : 'Tasdiqlash va saqlash'}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Scanned Receipts History */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/70 dark:border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Skanerlangan cheklar arxivi
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Saqlangan kassa cheklari va mahsulotlar tafsiloti
            </p>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {receipts.length} ta chek
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Receipt className="w-6 h-6" />}
              title="Hali skanerlangan cheklar yoʻq"
              description="Chek suratini yuklang yoki yuqoridagi sinov chekini ishga tushiring."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {receipts.map((rec) => (
              <div
                key={rec.id}
                className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                      {rec.merchantName}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums block truncate">
                      {rec.date} · {rec.lineItems?.length || 0} ta mahsulot · {rec.categorySuggested}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatMoney(rec.totalAmount, rec.currency)}
                  </div>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    Saqlangan
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
