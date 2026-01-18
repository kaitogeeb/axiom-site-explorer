import { useEffect, useState, useRef } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Loader2, Rocket, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchTokenInfo, fetchLatestTokens } from '@/services/dexScreener';

interface NewToken {
  mint: string;
  signature: string;
  timestamp: number;
  name?: string;
  symbol?: string;
  uri?: string;
  image?: string;
}

interface NewTokensListProps {
  onTokenSelect?: (tokenAddress: string) => void;
}

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
// Using the same RPC as in WalletProvider
const RPC_ENDPOINT = 'https://greatest-long-moon.solana-mainnet.quiknode.pro/ddf7c0e44cc3e924254561d8a240ef39de980a99/';

export const NewTokensList = ({ onTokenSelect }: NewTokensListProps) => {
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const processedSigs = useRef(new Set<string>());

  const handleSearch = async () => {
    if (!searchQuery) return;
    
    setIsSearching(true);
    try {
      const info = await fetchTokenInfo(searchQuery);
      if (info && onTokenSelect) {
        onTokenSelect(searchQuery);
      }
    } catch (error) {
      console.error("Error searching token:", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    // Fetch initial tokens from DexScreener
    const loadInitialTokens = async () => {
        setIsLoading(true);
        const latest = await fetchLatestTokens();
        if (latest && latest.length > 0) {
            const mappedTokens: NewToken[] = latest.map(t => ({
                mint: t.baseToken.address,
                signature: `dex-${t.pairAddress}`, // Placeholder signature
                timestamp: Date.now(), // We don't have exact creation time from this endpoint
                name: t.baseToken.name,
                symbol: t.baseToken.symbol,
                image: t.url // DexScreener url as placeholder or we can use logo URI if available
            }));
            setTokens(mappedTokens);
        }
        setIsLoading(false);
    };

    loadInitialTokens();

    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    
    const handleNewLog = async (logs: any) => {
      if (logs.err) return;
      
      const signature = logs.signature;
      if (processedSigs.current.has(signature)) return;
      processedSigs.current.add(signature);

      try {
        // We found a transaction interacting with Metadata Program
        // To be efficient, we might want to skip fetching full tx immediately 
        // and instead verify if it looks like a "Create Metadata" instruction from logs
        // But logs are just strings. 
        
        // For now, let's fetch the transaction to get the mint
        const tx = await connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: 'confirmed'
        });

        if (!tx?.meta || tx.meta.err) return;

        // Look for the mint address in the account keys
        // Usually the mint is one of the writable accounts and is not the payer
        // This is a simplification. A robust indexer is needed for 100% accuracy.
        // We'll look for new account creation or mint initialization.
        
        // A better heuristic for "New Coin" is looking for 'InitializeMint' instruction
        // combined with 'CreateMetadataAccount'
        
        // Let's scan instructions
        const instructions = tx.transaction.message.instructions;
        let mintAddress: string | null = null;

        // Check inner instructions too if needed, but top level is often enough for simple launches
        // We are looking for the mint account.
        
        // Simplistic approach: Check for Metadata Program instruction
        // and extract the mint account from it.
        // The CreateMetadataAccount instruction usually takes [metadata, mint, mintAuthority, payer, updateAuthority, systemProgram, rent]
        
        // Parse logs to confirm it's a creation
        const logMessages = tx.meta.logMessages || [];
        const isCreation = logMessages.some(log => 
          log.includes('Instruction: CreateMetadataAccount') || 
          log.includes('Instruction: Create Metadata Accounts')
        );

        if (!isCreation) return;

        // Find the mint address. It's usually the 2nd account passed to the instruction (index 1)
        // We need to find the instruction that calls the Metadata Program
        const metadataInstruction = instructions.find((ix: any) => 
          ix.programId.toString() === METADATA_PROGRAM_ID.toString()
        );

        if (metadataInstruction && 'accounts' in metadataInstruction) {
            // accounts[1] is typically the mint
            const mintKey = (metadataInstruction as any).accounts[1];
            if (mintKey) {
                mintAddress = mintKey.toString();
            }
        }

        if (mintAddress) {
            // Fetch token info
            // For now, we just add it to the list
            // In a real app, we would fetch the metadata account content to get name/symbol
            
            const newToken: NewToken = {
                mint: mintAddress,
                signature,
                timestamp: Date.now(),
            };

            // Try to fetch metadata (name, symbol)
            // This requires parsing the metadata account data
            try {
                // This is a placeholder for metadata fetching logic
                // For this demo, we'll try to fetch off-chain metadata if we had the URI
                // or just display the address
            } catch (e) {
                console.error("Error fetching metadata", e);
            }

            setTokens(prev => [newToken, ...prev].slice(0, 40));
        }

      } catch (error) {
        console.error("Error processing transaction:", error);
      }
    };

    // Subscribe to logs
    const subscriptionId = connection.onLogs(
      METADATA_PROGRAM_ID,
      handleNewLog,
      'confirmed'
    );

    setIsLoading(false);

    return () => {
      connection.removeOnLogsListener(subscriptionId);
    };
  }, []);

  return (
    <Card className="w-full glass-card border-primary/20">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex-1 flex gap-2">
          <Input 
            placeholder="Search by token address..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-black/20 border-white/10"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            onClick={handleSearch} 
            disabled={isSearching}
            variant="secondary"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        <Badge variant="outline" className="animate-pulse bg-green-500/10 text-green-500 border-green-500/50 shrink-0">
            Live Feed
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading && tokens.length === 0 ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center text-muted-foreground p-8">
            Waiting for new deployments...
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {tokens.map((token) => (
                <div 
                  key={token.signature} 
                  className="flex items-center justify-between p-4 rounded-lg bg-black/20 border border-white/5 hover:border-primary/20 transition-all cursor-pointer hover:bg-white/5"
                  onClick={() => onTokenSelect?.(token.mint)}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                            {token.timestamp ? new Date(token.timestamp).toLocaleTimeString() : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">
                            {token.symbol || 'Unknown Token'}
                        </span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {token.mint}
                        </span>
                    </div>
                  </div>
                  {!token.signature.startsWith('dex-') && (
                  <a 
                    href={`https://solscan.io/tx/${token.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
