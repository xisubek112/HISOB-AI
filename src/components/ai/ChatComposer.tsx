import React, { useRef } from 'react';
import { Send, Mic, Paperclip, Loader2 } from 'lucide-react';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onOpenVoice: () => void;
  onUploadFile: (file: File) => void;
  loading?: boolean;
  isListening?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSend,
  onOpenVoice,
  onUploadFile,
  loading = false,
  isListening = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
    }
    e.target.value = '';
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && value.trim()) {
          onSend();
        }
      }}
      className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-white dark:bg-[#081220]/95 shadow-[0_8px_28px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.32)] focus-within:border-emerald-500/60 transition-colors"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.txt"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* Receipt / File Upload */}
      <button
        type="button"
        disabled={loading}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Chek rasmi yoki fayl yuklash"
        title="Chek rasmi yoki fayl yuklash"
        className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors shrink-0 disabled:opacity-45 cursor-pointer"
      >
        <Paperclip className="w-[18px] h-[18px]" />
      </button>

      {/* Text Input */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        placeholder="Savol bering yoki «150 ming ovqatga» deb yozing..."
        aria-label="Xabar matni"
        className="flex-1 min-w-0 bg-transparent px-1.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
      />

      {/* Voice Mode Trigger */}
      <button
        type="button"
        disabled={loading}
        onClick={onOpenVoice}
        aria-label="Ovozli rejimni ochish"
        title="Ovozli rejim"
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-45 cursor-pointer ${
          isListening
            ? 'bg-cyan-500/20 text-cyan-400 ring-2 ring-cyan-400/50'
            : 'text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
        }`}
      >
        <Mic className="w-[18px] h-[18px]" />
      </button>

      {/* Send Button */}
      <button
        type="submit"
        disabled={loading || !value.trim()}
        aria-label="Xabar yuborish"
        title="Yuborish"
        className="h-10 px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#03251C] font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_6px_18px_rgba(16,185,129,0.28)] transition-all disabled:opacity-40 disabled:shadow-none shrink-0 cursor-pointer"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">Yuborish</span>
      </button>
    </form>
  );
};
