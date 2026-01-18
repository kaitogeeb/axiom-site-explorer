import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter, 
  TorusWalletAdapter,
  TrustWalletAdapter,
  CoinbaseWalletAdapter,
  LedgerWalletAdapter,
  Coin98WalletAdapter,
  BitKeepWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { ExodusWalletAdapter } from '@solana/wallet-adapter-exodus';
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack';
import { GlowWalletAdapter } from '@solana/wallet-adapter-glow';
import { clusterApiUrl } from '@solana/web3.js';
import { SolflareDeepLinkHandler } from '@/components/SolflareDeepLinkHandler';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

const QUICKNODE_RPC = 'https://greatest-long-moon.solana-mainnet.quiknode.pro/ddf7c0e44cc3e924254561d8a240ef39de980a99/';

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  const endpoint = useMemo(() => QUICKNODE_RPC, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new ExodusWalletAdapter(),
      new TrustWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new GlowWalletAdapter(),
      new LedgerWalletAdapter(),
      new Coin98WalletAdapter(),
      new BitKeepWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolflareDeepLinkHandler />
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
