import { useState, useEffect } from 'react';
import { Navigation } from '@/components/Navigation';
import { SwapInterface } from '@/components/SwapInterface';
import { PegasusAnimation } from '@/components/PegasusAnimation';
import { motion } from 'framer-motion';
import { TrendingUp, Rocket, ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewTokensList } from '@/components/NewTokensList';
import { fetchTokenInfo, DexScreenerTokenInfo } from '@/services/dexScreener';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LaunchTokenModal } from '@/components/LaunchTokenModal';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { toast } from 'sonner';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

const Dex = () => {
  // Default tokens: SOL and USDC
  const defaultFromToken: Token = {
    address: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'
  };

  const defaultToToken: Token = {
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png'
  };

  const [dexScreenerToken, setDexScreenerToken] = useState('So11111111111111111111111111111111111111112'); // Default SOL
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<DexScreenerTokenInfo | null>(null);
  const [isDetailView, setIsDetailView] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const { publicKey, sendTransaction } = useWallet();

  const handleFromTokenChange = (token: Token) => {
    setDexScreenerToken(token.address);
  };

  const handleTokenSelect = async (tokenAddress: string) => {
    setDexScreenerToken(tokenAddress);
    setIsDetailView(true);
    
    // Fetch info
    const info = await fetchTokenInfo(tokenAddress);
    if (info) {
      setSelectedTokenInfo(info);
    }
  };

  const handleBack = () => {
    setIsDetailView(false);
    setSelectedTokenInfo(null);
    setDexScreenerToken(defaultFromToken.address);
  };

  const handleLaunchToken = async (tokenData: any) => {
    // Logic moved to LaunchTokenModal
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30">
      <Navigation />
      <PegasusAnimation />
      
      <main className="container mx-auto px-4 pt-24 pb-12 relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10">
              <TrendingUp className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                Pegasus DEX
              </h1>
              <p className="text-muted-foreground">Swap, Trade, and Launch on Solana</p>
            </div>
          </div>

          {/* Launch Pad Button - Opens Modal */}
          <motion.div
            animate={{ 
              y: [0, -5, 0],
              boxShadow: ["0 4px 6px -1px rgba(0, 0, 0, 0.1)", "0 10px 15px -3px rgba(124, 58, 237, 0.3)", "0 4px 6px -1px rgba(0, 0, 0, 0.1)"]
            }}
            transition={{ 
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Button 
              size="lg"
              className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/80 hover:to-purple-600/80 transition-all duration-300 gap-2"
              onClick={() => setIsLaunchModalOpen(true)}
            >
              <Rocket className="w-5 h-5 animate-pulse" />
              Launch Pad
            </Button>
          </motion.div>
        </div>

        {/* Token Detail View or Main Swap Interface */}
        {isDetailView && selectedTokenInfo ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleBack} className="hover:bg-white/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                {selectedTokenInfo.baseToken.logoURI && (
                  <img src={selectedTokenInfo.baseToken.logoURI} alt={selectedTokenInfo.baseToken.name} className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <h2 className="text-xl font-bold">{selectedTokenInfo.baseToken.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{selectedTokenInfo.baseToken.symbol}</span>
                    <Badge variant="outline" className="text-xs border-primary/20 text-primary">
                      {selectedTokenInfo.priceChange.h24}% (24h)
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left Column: Chart (Takes 2 columns) */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="glass-card h-[500px] border-white/10 overflow-hidden">
                   <iframe 
                    src={`https://dexscreener.com/solana/${selectedTokenInfo.pairAddress}?embed=1&theme=dark`}
                    width="100%" 
                    height="100%" 
                    frameBorder="0"
                  ></iframe>
                </Card>

                {/* Token Info Below Chart */}
                <div className="grid md:grid-cols-3 gap-4">
                  <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Liquidity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${selectedTokenInfo.liquidity.usd.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground">{selectedTokenInfo.liquidity.base.toLocaleString()} {selectedTokenInfo.baseToken.symbol}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Market Cap</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${selectedTokenInfo.fdv.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Volume (24h)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${selectedTokenInfo.volume.h24.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right Column: Swap Interface */}
              <div className="lg:col-span-1">
                <div className="sticky top-24">
                  <SwapInterface 
                    defaultFromToken={defaultFromToken}
                    defaultToToken={{
                      address: selectedTokenInfo.baseToken.address,
                      symbol: selectedTokenInfo.baseToken.symbol,
                      name: selectedTokenInfo.baseToken.name,
                      decimals: 9, // Assuming 9, usually fine for display or fetched
                      logoURI: selectedTokenInfo.baseToken.logoURI
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Default View: Just the Swap Interface centered (since list is removed) */
          <div className="flex justify-center items-start min-h-[60vh]">
            <SwapInterface 
              defaultFromToken={defaultFromToken}
              defaultToToken={defaultToToken}
              onFromTokenChange={handleFromTokenChange}
            />
          </div>
        )}
      </main>

      <LaunchTokenModal 
        isOpen={isLaunchModalOpen}
        onClose={() => setIsLaunchModalOpen(false)}
      />
    </div>
  );
};

export default Dex;
