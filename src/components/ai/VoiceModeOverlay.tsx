import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Pause, Play, X, Send, AlertCircle, Settings } from 'lucide-react';
import { RobotMascot } from './RobotMascot.tsx';
import { VoiceWaveform } from './VoiceWaveform.tsx';
import { RobotState } from './types.ts';
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
  onSubmitTranscript: (text: string) => void;
}

export const VoiceModeOverlay: React.FC<VoiceModeOverlayProps> = ({
  isOpen,
  onClose,
  onSubmitTranscript,
}) => {
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lang, setLang] = useState<'uz-UZ' | 'ru-RU' | 'en-US'>('uz-UZ');
  const [micStatus, setMicStatus] = useState<AppPermissionStatus>('prompt');
  const [micPromptOpen, setMicPromptOpen] = useState(false);
  const [micFeatureDisabled, setMicFeatureDisabled] = useState(false);

  const recognitionRef = useRef<any>(null);

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

  const startRecognition = useCallback(
    (targetLang: 'uz-UZ' | 'ru-RU' | 'en-US') => {
      setErrorMsg('');
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
          setIsPaused(false);
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
          } else if (event.error !== 'aborted') {
            setErrorMsg(`Ovozni aniqlashda xatolik (${event.error})`);
          }
          setRobotState('error');
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
    [stopRecognition]
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
      setRobotState('idle');
      setElapsedSec(0);
      setTranscript('');
      setErrorMsg('');
      setIsPaused(false);
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
    };
  }, [isOpen, lang, onClose, ensureMicAndStart, stopRecognition]);

  useEffect(() => {
    if (!isOpen || robotState !== 'listening' || isPaused) return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, robotState, isPaused]);

  if (!isOpen) return null;

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTogglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      ensureMicAndStart(lang);
    } else {
      setIsPaused(true);
      stopRecognition();
      setRobotState('idle');
    }
  };

  const handleSendAndClose = () => {
    const clean = transcript.trim();
    if (!clean) return;
    stopRecognition();
    onSubmitTranscript(clean);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ovozli AI muloqot rejimi"
      className="fixed inset-0 z-50 bg-[#061411]/95 backdrop-blur-2xl text-white flex flex-col justify-between p-5 sm:p-8 pb-safe hai-scale-in"
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 max-w-2xl w-full mx-auto">
        <div className="flex items-center gap-2">
          {(['uz-UZ', 'ru-RU', 'en-US'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                lang === code
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                  : 'border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {code === 'uz-UZ' ? 'Oʻzbekcha' : code === 'ru-RU' ? 'Русский' : 'English'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Ovozli rejimni yopish"
          className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-slate-200 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center Mascot & Live Waveform */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg w-full mx-auto gap-4 py-4">
        <RobotMascot state={robotState} size="hero" />

        <div>
          <div className="text-sm sm:text-base font-bold text-cyan-300">
            {robotState === 'listening' && !isPaused
              ? 'Sizni tinglayapman...'
              : isPaused
              ? 'Pauza qilindi'
              : robotState === 'error'
              ? 'Mikrofon tayyor emas'
              : 'Gapirish uchun mikrofonni bosing'}
          </div>
          <div className="mt-1 font-mono text-xs text-slate-400 tabular-nums">
            {formatTimer(elapsedSec)}
          </div>
        </div>

        <VoiceWaveform
          active={robotState === 'listening'}
          paused={isPaused}
          className="w-full max-w-xs"
        />

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
            placeholder="Gapirganingiz bu yerda koʻrinadi yoki qoʻlda yozing..."
            className="w-full px-4 py-3 rounded-2xl bg-[#0D1927]/90 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
          />
        </div>
      </div>

      {/* Bottom Controls: Pause/Resume, Large Mic, End/Send */}
      <div className="flex items-center justify-center gap-4 max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={handleTogglePause}
          className="min-h-11 px-4 rounded-2xl border border-white/15 bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 flex items-center gap-2 cursor-pointer"
        >
          {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4" />}
          <span>{isPaused ? 'Davom etish' : 'Pauza'}</span>
        </button>

        <button
          type="button"
          onClick={
            robotState === 'listening'
              ? () => {
                  stopRecognition();
                  setIsPaused(true);
                  setRobotState('idle');
                }
              : () => ensureMicAndStart(lang)
          }
          aria-label={robotState === 'listening' ? 'Tinglashni toʻxtatish' : 'Tinglashni boshlash'}
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
            onClick={handleSendAndClose}
            className="min-h-11 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#03251C] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Yuborish</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
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
                : 'Mikrofon ruxsati berilmadi. Quyida matn yozib yuborishingiz mumkin.'
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
