import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Bookmark,
  Trash2,
  Crown,
} from 'lucide-react';
import { AIConversation } from './types.ts';

interface ChatHistoryProps {
  conversations: AIConversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onToggleSave: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenPremiumModal?: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onToggleSave,
  onDelete,
  onOpenPremiumModal,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const savedChats = filtered.filter((c) => c.isSaved);
  const recentChats = filtered.filter((c) => !c.isSaved);

  const renderItem = (conv: AIConversation) => {
    const isActive = conv.id === activeId;
    return (
      <div
        key={conv.id}
        onClick={() => onSelect(conv.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(conv.id);
          }
        }}
        className={`group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
          isActive
            ? 'bg-emerald-500/12 border-emerald-500/35 text-slate-900 dark:text-white'
            : 'bg-transparent border-transparent hover:bg-slate-100/80 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300'
        }`}
      >
        <MessageSquare
          className={`w-4 h-4 mt-0.5 shrink-0 ${
            isActive ? 'text-emerald-500' : 'text-slate-400'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate">{conv.title}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {conv.preview}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            aria-label={conv.isSaved ? 'Saqlanganlardan olib tashlash' : 'Suhbatni saqlash'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(conv.id);
            }}
            className={`w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer ${
              conv.isSaved ? 'text-amber-400 opacity-100' : 'text-slate-400'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${conv.isSaved ? 'fill-current' : ''}`} />
          </button>
          {conversations.length > 1 && (
            <button
              type="button"
              aria-label="Suhbatni oʻchirish"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* New Conversation CTA */}
      <button
        type="button"
        onClick={onNewChat}
        className="w-full min-h-10 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#03251C] text-xs font-bold flex items-center justify-center gap-2 shadow-[0_6px_18px_rgba(16,185,129,0.25)] transition-all cursor-pointer shrink-0"
      >
        <Plus className="w-4 h-4 stroke-[2.5]" />
        <span>Yangi suhbat</span>
      </button>

      {/* Search Conversations */}
      <div className="relative shrink-0">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suhbatlarni qidirish..."
          aria-label="Suhbatlarni qidirish"
          className="w-full min-h-9 pl-8 pr-3 rounded-xl bg-slate-100/90 dark:bg-[#081220]/90 border border-slate-200 dark:border-white/[0.08] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Lists */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-0.5 min-h-0">
        {savedChats.length > 0 && (
          <div>
            <div className="px-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500/90 flex items-center gap-1">
              <Bookmark className="w-3 h-3 fill-current" />
              <span>Saqlangan suhbatlar</span>
            </div>
            <div className="space-y-1">{savedChats.map(renderItem)}</div>
          </div>
        )}

        <div>
          <div className="px-1.5 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Soʻnggi suhbatlar
          </div>
          {recentChats.length === 0 && savedChats.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              Suhbat topilmadi
            </div>
          ) : (
            <div className="space-y-1">{recentChats.map(renderItem)}</div>
          )}
        </div>
      </div>

      {/* Bottom Compact Premium Card */}
      {onOpenPremiumModal && (
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-emerald-500/[0.06] p-3 shrink-0">
          <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 text-xs font-bold mb-1">
            <Crown className="w-3.5 h-3.5" />
            <span>HISOBOT AI PRO</span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mb-2">
            Chuqur moliyaviy prognoz va cheksiz AI maslahatlari.
          </p>
          <button
            type="button"
            onClick={onOpenPremiumModal}
            className="w-full py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
          >
            Tarifni koʻrish
          </button>
        </div>
      )}
    </div>
  );
};
