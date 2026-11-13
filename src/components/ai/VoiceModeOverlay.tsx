import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Pause,
  Play,
  X,
  Send,
  AlertCircle,
  Settings,
  Volume2,
  VolumeX,
  Check,
  Target,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { RobotMascot } from './RobotMascot.tsx';
import { VoiceWaveform } from './VoiceWaveform.tsx';
import { RobotState } from './types.ts';
import { AIChatMessage, AIProposedAction } from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { PermissionPromptModal } from '../modals/PermissionPromptModal.tsx';
import {
  AppPermissionStatus,
  checkPermission,
  getPrivacyControls,
  openAppSettings,
  requestPermission,
  setPrivacyControl,
} from '../../services/permissions.ts';

interface VoiceModeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSendVoiceMessage: (text: string, langCode: 'uz' | 'ru' | 'en') => Promise<AIChatMessage | null>;
  onConfirmVoiceAction: (msgId: string, action: AIProposedAction) => Promise<string | void>;
  onCancelVoiceAction: (msgId: string) => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onSendVoiceMessage,
  onConfirmVoiceAction,
  onCancelVoiceAction,
}) => {
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lang, setLang] = useState<'uz-UZ' | 'ru-RU' | 'en-US'>('uz-UZ');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [assistantReply, setAssistantReply] = useState<AIChatMessage | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [micStatus, setMicStatus] = useState<AppPermissionStatus>('prompt');
  const [micPromptOpen, setMicPromptOpen] = useState(false);
  const [micFeatureDisabled, setMicFeatureDisabled] = useState(false);

  const recognitionRef = useRef<any>(null);
  const isPausedRef = useRef(false);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopTTS = useCallback(() => {
    if (ttsSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }, [ttsSupported]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const speakReply = useCallback(
    (rawText: string, speechLang: string) => {
      if (!ttsEnabled || !ttsSupported || !rawText.trim()) {
        setRobotState('idle');
        return;
      }

      try {
        stopTTS();
        const clean = rawText.replace(/\*\*/g, '').replace(/\n+/g, '. ');
        const utterance = new SpeechSynthesisUtterance(clean);
        const availableVoices = window.speechSynthesis.getVoices();
        const requestedLanguage = speechLang.toLowerCase();
        const matchingVoice =
          availableVoices.find((voice) => voice.lang.toLowerCase() === requestedLanguage) ||
          availableVoices.find((voice) =>
            voice.lang.toLowerCase().startsWith(requestedLanguage.split('-')[0])
          );
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
        utterance.lang = matchingVoice?.lang || speechLang;
        utterance.rate = 0.95;
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          if (!isPausedRef.current) {
            setRobotState('speaking');
          }
        };
        utterance.onend = () => {
          if (!isPausedRef.current) {
            setRobotState('idle');
          }
        };
        utterance.onerror = (event) => {
          if (!isPausedRef.current) {
            setRobotState('error');
            setErrorMsg(
              event.error === 'not-allowed'
                ? 'Ovoz chiqarishga ruxsat berilmadi. Telefon ovoz sozlamalarini tekshiring.'
                : 'Ovoz sintezi ishlamadi. Android sozlamalarida Text-to-Speech ovoz paketini tekshiring.'
            );
          }
        };

        // Android WebView may initially pause speech synthesis; resume before speaking.
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        setRobotState('idle');
      }
    },
    [stopTTS, ttsEnabled, ttsSupported]
  );

  const startRecognition = useCallback(
    (targetLang: 'uz-UZ' | 'ru-RU' | 'en-US') => {
      setErrorMsg('');
      stopTTS();
      isPausedRef.current = false;

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setRobotState('error');
        setErrorMsg(
          'Bu brauzer jonli mikrofonni qoʻllab-quvvatlamaydi. Quyiga matn yozib yuborishingiz mumkin.'
        );
        return;
      }

      try {
        stopRecognition();
        const recognition = new SpeechRecognition();
        recognition.lang = targetLang;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
          isPausedRef.current = false;
          setRobotState('listening');
        };
        recognition.onresult = (event: any) => {
          let full = '';
          for (let i = 0; i < event.results.length; i++) {
            full += event.results[i][0].transcript + ' ';
          }
          setTranscript(full.trim());
        };
        recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
            setErrorMsg('Mikrofon ruxsati berilmadi. Brauzer sozlamalaridan ruxsat bering.');
            setRobotState('error');
          } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            setErrorMsg(`Ovozni aniqlashda xatolik (${event.error})`);
            setRobotState('error');
          }
        };
        recognition.onend = () => {
          setRobotState((prev) => (prev === 'listening' ? 'idle' : prev));
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (e: any) {
        setErrorMsg(e?.message || 'Mikrofonni ishga tushirib boʻlmadi');
        setRobotState('error');
      }
    },
    [stopRecognition, stopTTS]
  );

  const ensureMicAndStart = useCallback(
    async (targetLang: 'uz-UZ' | 'ru-RU' | 'en-US') => {
      const controls = getPrivacyControls();
      if (!controls.microphone) {
        setMicFeatureDisabled(true);
        setMicStatus('denied');
        setMicPromptOpen(true);
        setRobotState('idle');
        return;
      }
      setMicFeatureDisabled(false);

      const summary = await checkPermission('microphone');
      setMicStatus(summary.status);
      if (summary.status === 'granted') {
        startRecognition(targetLang);
        return;
      }

      if (summary.status === 'unavailable') {
        setRobotState('error');
        setErrorMsg(
          'Bu qurilma yoki brauzerda mikrofon aniqlanmadi. Quyiga matn yozib yuborishingiz mumkin.'
        );
        return;
      }

      setRobotState('idle');
      setMicPromptOpen(true);
    },
    [startRecognition]
  );

  useEffect(() => {
    if (!isOpen) {
      stopRecognition();
      stopTTS();
      isPausedRef.current = false;
      setRobotState('idle');
      setElapsedSec(0);
      setTranscript('');
      setErrorMsg('');
      setAssistantReply(null);
      setMicPromptOpen(false);
      return;
    }

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    ensureMicAndStart(lang);

    return () => {
      window.removeEventListener('keydown', onEsc);
      stopRecognition();
      stopTTS();
    };
  }, [isOpen, lang, onClose, ensureMicAndStart, stopRecognition, stopTTS]);

  useEffect(() => {
    if (!isOpen || robotState !== 'listening') return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, robotState]);

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const langHintCode: 'uz' | 'ru' | 'en' = lang.startsWith('ru')
    ? 'ru'
    : lang.startsWith('en')
    ? 'en'
    : 'uz';

  const handleTogglePause = () => {
    if (robotState === 'paused') {
      isPausedRef.current = false;
      ensureMicAndStart(lang);
    } else {
      isPausedRef.current = true;
      stopRecognition();
      stopTTS();
      setRobotState('paused');
    }
  };

  const handleSendTurn = async () => {
    const clean = transcript.trim();
    if (!clean || robotState === 'thinking') return;

    isPausedRef.current = false;
    stopRecognition();
    stopTTS();
    setErrorMsg('');
    setRobotState('thinking');

    try {
      const msg = await onSendVoiceMessage(clean, langHintCode);
      setTranscript('');
      if (msg) {
        setAssistantReply(msg);
        speakReply(msg.content, lang);
      } else {
        setRobotState('idle');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gemini AI bilan aloqada xatolik yuz berdi');
      setRobotState('error');
    }
  };

  const handleConfirmInVoice = async () => {
    if (!assistantReply?.proposedAction || confirmLoading) return;
    try {
      setConfirmLoading(true);
      const confirmationText = await onConfirmVoiceAction(
        assistantReply.id,
        assistantReply.proposedAction
      );
      setAssistantReply((prev) =>
        prev
          ? {
              ...prev,
              confirmationState: 'confirmed',
              content:
                typeof confirmationText === 'string'
                  ? confirmationText
                  : 'Muvaffaqiyatli saqlandi!',
            }
          : null
      );
      setRobotState('success');
      if (typeof confirmationText === 'string' && ttsEnabled) {
        speakReply(confirmationText, lang);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Saqlashda xatolik');
      setRobotState('error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelInVoice = () => {
    if (!assistantReply) return;
    onCancelVoiceAction(assistantReply.id);
    setAssistantReply((prev) =>
      prev
        ? {
            ...prev,
            confirmationState: 'cancelled',
            content: 'Bekor qilindi va bazaga saqlanmadi.',
          }
        : null
    );
    setRobotState('idle');
  };

  const statusLabel =
    robotState === 'listening'
      ? 'Sizni tinglayapman...'
      : robotState === 'thinking'
      ? 'Gemini AI javob tayyorlamoqda...'
      : robotState === 'speaking'
      ? 'HISOBOT AI javob bermoqda...'
      : robotState === 'paused'
      ? 'Pauza qilindi'
      : robotState === 'success'
      ? 'Bazaga saqlandi!'
      : robotState === 'error'
      ? 'Xatolik yuz berdi'
      : 'Gapirish uchun mikrofonni bosing';

  const statusToneClass =
    robotState === 'error'
      ? 'text-rose-300'
      : robotState === 'paused'
      ? 'text-amber-300'
      : robotState === 'speaking' || robotState === 'success'
      ? 'text-emerald-300'
      : 'text-cyan-300';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ovozli AI muloqot rejimi"
      className="fixed inset-0 z-50 bg-[#061411]/95 backdrop-blur-2xl text-white flex flex-col justify-between p-4 sm:p-8 pb-safe overflow-y-auto hai-scale-in"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2 max-w-2xl w-full mx-auto shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {(['uz-UZ', 'ru-RU', 'en-US'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                lang === code
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {code === 'uz-UZ' ? 'Oʻzbekcha' : code === 'ru-RU' ? 'Русский' : 'English'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {ttsSupported && (
            <button
              type="button"
              onClick={() => {
                if (ttsEnabled) stopTTS();
                setTtsEnabled((v) => !v);
              }}
              aria-label={ttsEnabled ? 'Ovozli javobni oʻchirish' : 'Ovozli javobni yoqish'}
              title={ttsEnabled ? 'Ovozli javob yoqilgan' : 'Ovozli javob oʻchirilgan'}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                ttsEnabled
                  ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              stopRecognition();
              stopTTS();
              onClose();
            }}
            aria-label="Ovozli rejimni yopish"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Mascot, Reply & Live Waveform */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg w-full mx-auto gap-3.5 py-4">
        <RobotMascot state={robotState} size="medium" />

        <div>
          <div className={`text-sm sm:text-base font-bold ${statusToneClass}`}>{statusLabel}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-400 tabular-nums">
            {formatTimer(elapsedSec)}
          </div>
        </div>

        <VoiceWaveform
          active={robotState === 'listening' || robotState === 'speaking'}
          paused={robotState === 'paused'}
          mode={robotState === 'speaking' ? 'speaking' : 'listening'}
          className="w-full max-w-xs"
        />

        {/* Assistant Reply Card inside Voice Mode */}
        {assistantReply && (
          <div className="w-full p-3.5 rounded-2xl bg-[#0D1927]/90 border border-emerald-500/25 text-left space-y-2.5 max-h-56 overflow-y-auto">
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-100 whitespace-pre-line">
              {assistantReply.content.replace(/\*\*/g, '')}
            </p>

            {assistantReply.structuredRows && assistantReply.structuredRows.length > 0 && (
              <div className="rounded-xl bg-[#081220]/90 border border-white/[0.08] divide-y divide-white/[0.06]">
                {assistantReply.structuredRows.slice(0, 4).map((r, i) => (
                  <div
                    key={i}
                    className="px-3 py-1.5 flex items-center justify-between text-[11px]"
                  >
                    <span className="text-slate-400">{r.label}</span>
                    <span className="font-mono font-bold text-emerald-300 tabular-nums">
                      {r.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {assistantReply.proposedAction && assistantReply.confirmationState === 'pending' && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-200">
                    {assistantReply.proposedAction.actionType === 'transaction' ? (
                      assistantReply.proposedAction.payload.type === 'income' ? (
                        <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-400" />
                      )
                    ) : assistantReply.proposedAction.actionType === 'budget' ? (
                      <Wallet className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <Target className="w-4 h-4 text-emerald-400" />
                    )}
                    <span className="truncate">{assistantReply.proposedAction.summary}</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-300 shrink-0 tabular-nums">
                    {assistantReply.proposedAction.actionType === 'transaction'
                      ? formatMoney(assistantReply.proposedAction.payload.amount)
                      : assistantReply.proposedAction.actionType === 'budget'
                      ? formatMoney(assistantReply.proposedAction.payload.monthlyLimit)
                      : formatMoney(assistantReply.proposedAction.payload.targetAmount)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={confirmLoading}
                    onClick={handleConfirmInVoice}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#03251C] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Tasdiqlash</span>
                  </button>
                  <button
                    type="button"
                    disabled={confirmLoading}
                    onClick={handleCancelInVoice}
                    className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold cursor-pointer"
                  >
                    Bekor qilish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="w-full p-3 rounded-xl bg-rose-500/15 border border-rose-500/35 text-rose-200 text-xs flex flex-wrap items-center justify-between gap-2 text-left">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            {micStatus === 'permanently_denied' && (
              <button
                type="button"
                onClick={() => openAppSettings()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-semibold shrink-0 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Sozlamalar</span>
              </button>
            )}
          </div>
        )}

        {/* Live Transcript Preview / Editable Fallback */}
        <div className="w-full">
          <textarea
            rows={2}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendTurn();
              }
            }}
            placeholder="Gapirganingiz bu yerda koʻrinadi yoki qoʻlda yozing..."
            className="w-full px-4 py-2.5 rounded-2xl bg-[#0D1927]/90 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>
      </div>

      {/* Bottom Controls: Pause/Resume, Large Mic, Send / End */}
      <div className="flex items-center justify-center gap-4 max-w-md w-full mx-auto shrink-0">
        <button
          type="button"
          onClick={handleTogglePause}
          className="min-h-11 px-4 rounded-2xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
        >
          {robotState === 'paused' ? (
            <Play className="w-4 h-4 text-emerald-400" />
          ) : (
            <Pause className="w-4 h-4 text-amber-300" />
          )}
          <span>{robotState === 'paused' ? 'Davom etish' : 'Pauza'}</span>
        </button>

        <button
          type="button"
          onClick={
            robotState === 'listening'
              ? () => {
                  stopRecognition();
                  if (transcript.trim()) {
                    handleSendTurn();
                  } else {
                    setRobotState('idle');
                  }
                }
              : () => ensureMicAndStart(lang)
          }
          aria-label={
            robotState === 'listening' ? 'Tinglashni toʻxtatish' : 'Tinglashni boshlash'
          }
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            robotState === 'listening'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_32px_rgba(6,182,212,0.55)] ring-4 ring-cyan-400/25'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_26px_rgba(16,185,129,0.4)]'
          }`}
        >
          {robotState === 'listening' ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
        </button>

        {transcript.trim() ? (
          <button
            type="button"
            disabled={robotState === 'thinking'}
            onClick={handleSendTurn}
            className="min-h-11 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#03251C] text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Yuborish</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              stopRecognition();
              stopTTS();
              onClose();
            }}
            className="min-h-11 px-4 rounded-2xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-200 cursor-pointer"
          >
            Yakunlash
          </button>
        )}
      </div>

      <PermissionPromptModal
        isOpen={micPromptOpen}
        permissionKey="microphone"
        status={micStatus}
        featureDisabled={micFeatureDisabled}
        onEnableInPrivacy={() => {
          setPrivacyControl('microphone', true);
          setMicFeatureDisabled(false);
          setMicPromptOpen(false);
          ensureMicAndStart(lang);
        }}
        onAllow={async () => {
          const res = await requestPermission('microphone');
          setMicStatus(res.status);
          if (res.status === 'granted') {
            setMicPromptOpen(false);
            startRecognition(lang);
          } else if (res.status === 'denied' || res.status === 'permanently_denied') {
            setErrorMsg(
              res.status === 'permanently_denied'
                ? 'Mikrofon ruxsati tizimda bloklangan. Quyida matn yozishingiz yoki Sozlamalardan yoqishingiz mumkin.'
                : 'Mikrofon ruxsati berilmadi. Quyiga matn yozib yuborishingiz mumkin.'
            );
            setRobotState('error');
          }
        }}
        onDismiss={() => {
          setMicPromptOpen(false);
          setRobotState('idle');
        }}
      />
    </div>
  );
};
