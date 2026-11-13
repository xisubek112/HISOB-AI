/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Button, Input, Modal } from '../../design-system/index.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [stepForgot, setStepForgot] = useState<'send' | 'reset'>('send');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setError('');
    setSuccessMsg('');
    setStepForgot('send');
  }, [isOpen, initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        if (!fullName.trim()) throw new Error('Ism va familiyangizni kiriting');
        await register(email, password, fullName);
        onClose();
      } else if (mode === 'forgot') {
        if (stepForgot === 'send') {
          const res = await api.forgotPassword(email);
          setSuccessMsg(res.message);
          setStepForgot('reset');
        } else {
          await api.resetPassword(email, resetCode, newPassword);
          setSuccessMsg('Parol muvaffaqiyatli yangilandi! Endi tizimga kirishingiz mumkin.');
          setTimeout(() => {
            setMode('login');
            setStepForgot('send');
            setSuccessMsg('');
          }, 2000);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setLoading(true);
    setError('');
    try {
      await loginDemo();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Demo kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle =
    mode === 'login'
      ? 'Tizimga kirish'
      : mode === 'register'
      ? 'Roʻyxatdan oʻtish'
      : 'Parolni tiklash';

  const modalSubtitle =
    mode === 'login'
      ? 'Moliyangizni aqlli boshqarish platformasiga xush kelibsiz'
      : mode === 'register'
      ? 'Yangi shaxsiy hisobingizni oching'
      : 'Elektron pochtangiz orqali parolni yangilang';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} subtitle={modalSubtitle} size="md">
      <div className="space-y-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-2.5 pb-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 font-extrabold flex items-center justify-center text-sm shadow-[0_6px_18px_rgba(16,185,129,0.28)]">
            H
          </div>
          <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
            HISOBOT AI
          </span>
        </div>

        {error && (
          <div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 rounded-xl flex items-center gap-2 border border-rose-500/30">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 rounded-xl flex items-center gap-2 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <Input
              label="Toʻliq ismingiz"
              type="text"
              required
              leadingIcon={<User className="w-4 h-4" />}
              placeholder="Anvar Qodirov"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}

          <Input
            label="Elektron pochta"
            type="email"
            required
            leadingIcon={<Mail className="w-4 h-4" />}
            placeholder="misol@hisobot.uz"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Parol <span className="text-rose-500">*</span>
                </span>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Parolni unutdingizmi?
                  </button>
                )}
              </div>
              <Input
                type="password"
                required
                leadingIcon={<Lock className="w-4 h-4" />}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          {mode === 'forgot' && stepForgot === 'reset' && (
            <>
              <Input
                label="Tiklash kodi (6 xonali)"
                type="text"
                required
                monospace
                placeholder="123456"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
              />
              <Input
                label="Yangi parol"
                type="password"
                required
                placeholder="Yangi parol"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={loading}
            trailingIcon={mode === 'login' ? <ArrowRight className="w-4 h-4" /> : undefined}
          >
            {loading
              ? 'Bajarilmoqda...'
              : mode === 'login'
              ? 'Kirish'
              : mode === 'register'
              ? 'Hisob yaratish'
              : stepForgot === 'send'
              ? 'Tiklash kodini yuborish'
              : 'Parolni yangilash'}
          </Button>
        </form>

        {/* Demo Fast Login */}
        <div className="pt-4 border-t border-slate-200/70 dark:border-white/[0.08] text-center space-y-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tezkor sinov uchun namunaviy hisob:
          </p>
          <Button
            variant="outline"
            size="md"
            fullWidth
            disabled={loading}
            leadingIcon={<Zap className="w-4 h-4 text-emerald-500" />}
            onClick={handleDemo}
          >
            Demo hisob bilan sinash (Anvar Qodirov)
          </Button>
        </div>

        {/* Mode Switch */}
        <div className="pt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <p>
              Hisobingiz yoʻqmi?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Roʻyxatdan oʻtish
              </button>
            </p>
          ) : (
            <p>
              Allaqachon hisobingiz bormi?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
              >
                Kirish
              </button>
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
};
