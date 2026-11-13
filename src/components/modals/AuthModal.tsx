/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';

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

  if (!isOpen) return null;

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
    try {
      await loginDemo();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Demo kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              H
            </span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              HISOBOT AI
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {mode === 'login'
              ? 'Tizimga kirish'
              : mode === 'register'
              ? 'Roʻyxatdan oʻtish'
              : 'Parolni tiklash'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login'
              ? 'Moliyangizni aqlli boshqarish platformasiga xush kelibsiz'
              : mode === 'register'
              ? 'Yangi shaxsiy hisobingizni oching'
              : 'Elektron pochtangiz orqali parolni yangilang'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 rounded-xl flex items-center gap-2 border border-rose-200 dark:border-rose-900/50">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl flex items-center gap-2 border border-emerald-200 dark:border-emerald-900/50">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Toʻliq ismingiz
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  required
                  placeholder="Anvar Qodirov"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Elektron pochta
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                placeholder="misol@hisobot.uz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Parol
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Parolni unutdingizmi?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {mode === 'forgot' && stepForgot === 'reset' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tiklash kodi (6 xonali)
                </label>
                <input
                  type="text"
                  required
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Yangi parol
                </label>
                <input
                  type="password"
                  required
                  placeholder="Yangi parol"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              'Bajarilmoqda...'
            ) : mode === 'login' ? (
              <>
                <span>Kirish</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : mode === 'register' ? (
              'Hisob yaratish'
            ) : stepForgot === 'send' ? (
              'Tiklash kodini yuborish'
            ) : (
              'Parolni yangilash'
            )}
          </button>
        </form>

        {/* Demo Fast Login Option */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-400 mb-2">
            Tezkor sinov uchun tayyor namunaviy maʼlumotlar:
          </p>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            ⚡ Demo hisob bilan sinash (Anvar Qodirov)
          </button>
        </div>

        {/* Mode switch */}
        <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <p>
              Hisobingiz yoʻqmi?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
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
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Kirish
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
