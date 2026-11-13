import { useState, useCallback, useRef, useEffect } from 'react';
import { RobotState } from './types.ts';

export const ROBOT_STATUS_MESSAGES: Record<RobotState, string> = {
  idle: 'Savol bering yoki operatsiya kiriting',
  listening: 'Sizni tinglayapman...',
  thinking: 'Gemini AI tahlil qilmoqda...',
  speaking: 'HISOBOT AI javob bermoqda...',
  paused: 'Ovozli suhbat pauzada',
  success: 'Muvaffaqiyatli bajarildi!',
  error: 'Xatolik yuz berdi — qayta urinib koʻring',
};

export function useRobotStateController() {
  const [robotState, setRobotState] = useState<RobotState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>(ROBOT_STATUS_MESSAGES.idle);
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResetTimer, [clearResetTimer]);

  const setState = useCallback(
    (next: RobotState, customMessage?: string, autoResetMs?: number) => {
      clearResetTimer();
      setRobotState(next);
      setStatusMessage(customMessage || ROBOT_STATUS_MESSAGES[next]);

      if (autoResetMs && autoResetMs > 0) {
        resetTimerRef.current = window.setTimeout(() => {
          setRobotState('idle');
          setStatusMessage(ROBOT_STATUS_MESSAGES.idle);
        }, autoResetMs);
      }
    },
    [clearResetTimer]
  );

  const setIdle = useCallback(() => setState('idle'), [setState]);
  const setListening = useCallback(() => setState('listening'), [setState]);
  const setThinking = useCallback(() => setState('thinking'), [setState]);
  const setSpeaking = useCallback(() => setState('speaking'), [setState]);
  const setPaused = useCallback(() => setState('paused'), [setState]);
  const setSuccess = useCallback(
    (msg?: string) => setState('success', msg, 2400),
    [setState]
  );
  const setError = useCallback(
    (msg?: string) => setState('error', msg, 4500),
    [setState]
  );

  return {
    robotState,
    statusMessage,
    setState,
    setIdle,
    setListening,
    setThinking,
    setSpeaking,
    setPaused,
    setSuccess,
    setError,
  };
}
