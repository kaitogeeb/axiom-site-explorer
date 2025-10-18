import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type TransactionStatus = 'pending' | 'processing' | 'success' | 'error';

export interface TokenTransaction {
  id: string;
  name: string;
  status: TransactionStatus;
  usdValue: number;
}

interface PumpProgressProps {
  transactions: TokenTransaction[];
  currentIndex: number;
}

export const PumpProgress: React.FC<PumpProgressProps> = ({ transactions, currentIndex }) => {
  const completedCount = transactions.filter(tx => tx.status === 'success').length;
  const progress = transactions.length > 0 ? (completedCount / transactions.length) * 100 : 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">PUMP Progress</h3>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {transactions.length} complete
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="space-y-2 mt-4">
        {transactions.map((tx, index) => (
          <div
            key={tx.id}
            className={cn(
              "flex justify-between items-center p-3 rounded-lg border",
              index === currentIndex && tx.status === 'processing' ? "bg-primary/10 border-primary" : "bg-card/30 border-border/50"
            )}
          >
            <div className="flex items-center gap-3">
              <StatusIcon status={tx.status} />
              <span className="font-medium text-white">{tx.name}</span>
            </div>
            <span className="text-sm font-medium">
              ${tx.usdValue.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatusIcon: React.FC<{ status: TransactionStatus }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return (
        <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
        </svg>
      );
    case 'processing':
      return (
        <svg className="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth="2" />
          <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    case 'success':
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'error':
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
  }
};
