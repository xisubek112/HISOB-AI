import { AIChatMessage } from '../../types/finance.ts';

export type RobotState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'success'
  | 'error';

export interface AIConversation {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  isSaved: boolean;
  messages: AIChatMessage[];
}

export interface QuickSuggestionItem {
  id: string;
  label: string;
  prompt: string;
  category: 'analysis' | 'budget' | 'goals' | 'forecast' | 'transaction';
}

export interface AICapabilityItem {
  id: string;
  title: string;
  subtitle: string;
  prompt?: string;
  actionType: 'prompt' | 'receipt' | 'health';
  tone: 'emerald' | 'teal' | 'amber' | 'blue';
}

export const QUICK_SUGGESTIONS: QuickSuggestionItem[] = [
  {
    id: 'sug-analyze',
    label: 'Bu oygi xarajatlarimni tahlil qil',
    prompt: 'Bu oygi xarajatlarimni tahlil qil?',
    category: 'analysis',
  },
  {
    id: 'sug-top-spend',
    label: "Qayerda ko'p pul sarfladim?",
    prompt: "Qayerda ko'p pul sarfladim?",
    category: 'analysis',
  },
  {
    id: 'sug-budget',
    label: 'Budjet rejamni tuz',
    prompt: 'Budjet rejamni tuz?',
    category: 'budget',
  },
  {
    id: 'sug-goals',
    label: "Moliyaviy maqsadlarimni ko'rsat",
    prompt: "Moliyaviy maqsadlarimni ko'rsat?",
    category: 'goals',
  },
  {
    id: 'sug-forecast',
    label: 'Kelgusi oy xarajatlarimni prognoz qil',
    prompt: 'Kelgusi oy xarajatlarimni prognoz qil?',
    category: 'forecast',
  },
];

export const AI_CAPABILITIES: AICapabilityItem[] = [
  {
    id: 'cap-analysis',
    title: 'Moliyaviy tahlil',
    subtitle: 'Daromad va sarf balansi',
    prompt: 'Bu oygi xarajatlarimni tahlil qil?',
    actionType: 'prompt',
    tone: 'emerald',
  },
  {
    id: 'cap-recommend',
    title: 'Xarajat tavsiyalari',
    subtitle: 'Tejash nuqtalarini topish',
    prompt: 'Qayerdan tejashim mumkin?',
    actionType: 'prompt',
    tone: 'teal',
  },
  {
    id: 'cap-budget',
    title: 'Budjet rejalash',
    subtitle: '50/30/20 taqsimot rejasi',
    prompt: 'Budjet rejamni tuz?',
    actionType: 'prompt',
    tone: 'blue',
  },
  {
    id: 'cap-forecast',
    title: 'Moliyaviy prognoz',
    subtitle: 'Kelgusi oy bashorati',
    prompt: 'Kelgusi oy xarajatlarimni prognoz qil?',
    actionType: 'prompt',
    tone: 'amber',
  },
  {
    id: 'cap-goals',
    title: 'Maqsad yordamchisi',
    subtitle: "Jamg'arma sur'ati nazorati",
    prompt: "Moliyaviy maqsadlarimni ko'rsat?",
    actionType: 'prompt',
    tone: 'emerald',
  },
  {
    id: 'cap-receipt',
    title: 'Chek tahlili',
    subtitle: 'Chekdan summani aniqlash',
    actionType: 'receipt',
    tone: 'teal',
  },
];
