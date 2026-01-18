import { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface TokenSearchProps {
  onSelectToken: (token: Token) => void;
  selectedToken?: Token;
}

const JUPITER_TOKEN_SEARCH_API = 'https://lite-api.jup.ag/tokens/v2/search';
const POPULAR_TOKENS: Token[] = [
  { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL', name: 'Solana', decimals: 9, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png' },
  { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', name: 'USD Coin', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png' },
  { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT', name: 'USDT', decimals: 6, logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg' },
];

export const TokenSearch = ({ onSelectToken, selectedToken }: TokenSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Token[]>(POPULAR_TOKENS);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const searchTokens = async () => {
      if (searchQuery.length < 2) {
        setSearchResults(POPULAR_TOKENS);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`${JUPITER_TOKEN_SEARCH_API}?query=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();

        // Filter and validate results
        const validTokens = (data || []).filter((token: any) =>
          token?.id && token?.symbol && token?.name && token?.decimals !== undefined
        ).map((token: any) => ({
          address: token.id,
          symbol: token.symbol || 'UNK',
          name: token.name || 'Unknown',
          decimals: token.decimals,
          logoURI: token.icon
        }));

        setSearchResults(validTokens);
      } catch (error) {
        console.error('Error searching tokens:', error);
        setSearchResults(POPULAR_TOKENS);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchTokens, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectToken = (token: Token) => {
    onSelectToken(token);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 glass-card rounded-xl hover:bg-muted/50 transition-all hover:scale-[1.02] shrink-0"
      >
        {selectedToken ? (
          <>
            {selectedToken.logoURI ? (
              <img src={selectedToken.logoURI} alt={selectedToken.symbol} className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold">
                {selectedToken.symbol?.slice(0, 2) || '?'}
              </div>
            )}
            <span className="font-semibold">{selectedToken.symbol}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Select token</span>
        )}
        <ChevronDown className="w-4 h-4 ml-1" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Select a token</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass-card border-white/10"
              />
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">No tokens found</div>
              ) : (
                <div className="space-y-1">
                  {searchQuery.length === 0 && (
                    <div className="text-xs text-muted-foreground font-semibold mb-2 px-2">Popular tokens</div>
                  )}
                  {searchResults.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handleSelectToken(token)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl transition-all hover:scale-[1.01]"
                    >
                      {token.logoURI ? (
                        <img
                          src={token.logoURI}
                          alt={token.symbol}
                          className="w-10 h-10 rounded-full"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold ${token.logoURI ? 'hidden' : ''}`}
                      >
                        {token.symbol?.slice(0, 2) || '?'}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{token.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
