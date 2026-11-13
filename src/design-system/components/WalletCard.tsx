import { CreditCard, Banknote, Building2, PiggyBank, Smartphone, Wallet as WalletIcon, Edit2, Archive, PlusCircle } from 'lucide-react';
import { Wallet, WalletType } from '../../types/finance.ts';
import { formatMoney } from '../../utils/formatters.ts';
import { IconButton } from './IconButton.tsx';

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: 'Naqd pul',
  card: 'Bank kartasi',
  bank_account: 'Bank hisobi',
  savings: 'Jamgʻarma',
  digital_wallet: 'Elektron hamyon',
  other: 'Boshqa',
};

function getWalletIcon(type: WalletType) {
  switch (type) {
    case 'cash':
      return Banknote;
    case 'card':
      return CreditCard;
    case 'bank_account':
      return Building2;
    case 'savings':
      return PiggyBank;
    case 'digital_wallet':
      return Smartphone;
    default:
      return WalletIcon;
  }
}

export interface WalletCardProps {
  wallet: Wallet;
  onEdit?: (wallet: Wallet) => void;
  onArchive?: (id: string) => void;
  onQuickTransfer?: (wallet: Wallet) => void;
}

export function WalletCard({ wallet, onEdit, onArchive, onQuickTransfer }: WalletCardProps) {
  const Icon = getWalletIcon(wallet.type);
  const accent = wallet.color || '#10B981';

  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#111B27] p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.22)] flex flex-col justify-between transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-emerald-500/35">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-xs"
            style={{ backgroundColor: accent }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {wallet.name}
            </h3>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{WALLET_TYPE_LABELS[wallet.type] || 'Hamyon'}</span>
              {wallet.accountNumber && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums font-medium">{wallet.accountNumber}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {(onEdit || onArchive) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {onEdit && (
              <IconButton label="Tahrirlash" size="sm" onClick={() => onEdit(wallet)}>
                <Edit2 className="w-3.5 h-3.5" />
              </IconButton>
            )}
            {onArchive && (
              <IconButton label="Arxivlash" variant="danger" size="sm" onClick={() => onArchive(wallet.id)}>
                <Archive className="w-3.5 h-3.5" />
              </IconButton>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-white/[0.06] flex items-end justify-between gap-3">
        <div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block">Joriy balans</span>
          <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
            {formatMoney(wallet.balance, wallet.currency)}
          </div>
        </div>

        {onQuickTransfer && (
          <button
            type="button"
            onClick={() => onQuickTransfer(wallet)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline py-1"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Oʻtkazma</span>
          </button>
        )}
      </div>
    </section>
  );
}
