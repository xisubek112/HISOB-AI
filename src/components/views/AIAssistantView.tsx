/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Transaction } from '../../types/finance.ts';
import { AIAssistantPage } from '../ai/AIAssistantPage.tsx';

interface AIAssistantViewProps {
  onTransactionSaved: (tx: Transaction) => void;
  onOpenVoiceModal?: () => void;
  onOpenPremiumModal?: () => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  onTransactionSaved,
  onOpenVoiceModal,
  onOpenPremiumModal,
}) => {
  return (
    <AIAssistantPage
      onTransactionSaved={onTransactionSaved}
      onOpenVoiceModal={onOpenVoiceModal}
      onOpenPremiumModal={onOpenPremiumModal}
    />
  );
};
