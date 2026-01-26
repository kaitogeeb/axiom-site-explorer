import { Connection, PublicKey } from '@solana/web3.js';

const QUICKNODE_RPC = 'https://greatest-long-moon.solana-mainnet.quiknode.pro/ddf7c0e44cc3e924254561d8a240ef39de980a99/';
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjVkZTZhZTBhLWE1ZDUtNDJlNi04YTc2LTE5MzRhMzE3YWVjNyIsIm9yZ0lkIjoiNDc5MTQ3IiwidXNlcklkIjoiNDkyOTQ3IiwidHlwZUlkIjoiY2M1Y2Q3ZmEtYzY5OS00NDIxLTg2MDgtNjhhNWZlYmI3NzkzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjIwOTI5NTksImV4cCI6NDkxNzg1Mjk1OX0.k7F9gymw59NoAhOYieWLKS-APSTwGHaZYnDId7EiHr4';

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number;
  marketCap?: number;
  volume24h?: number;
  priceChange24h?: number;
}

export interface TokenMetadataResult {
  token: Token | null;
  source: 'jupiter' | 'moralis' | 'chain' | 'none';
  error?: string;
}

/**
 * Check if an address looks like a valid Solana address (base58, 32-44 chars)
 */
export const isValidSolanaAddress = (address: string): boolean => {
  if (!address || address.length < 32 || address.length > 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(address);
};

/**
 * Check if the token is likely a Pump.fun token (ends with "pump")
 */
export const isPumpFunToken = (address: string): boolean => {
  return address.toLowerCase().endsWith('pump');
};

/**
 * Fetch token metadata from Jupiter API (fastest, works for most tokens)
 */
export const getTokenFromJupiter = async (mintAddress: string): Promise<Token | null> => {
  try {
    // Try Jupiter strict token list first
    const response = await fetch(`https://lite-api.jup.ag/tokens/v1/strict`);
    const tokens = await response.json();
    
    const token = tokens.find((t: any) => t.address === mintAddress);
    if (token) {
      return {
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
      };
    }

    // Try Jupiter all tokens
    const allResponse = await fetch(`https://lite-api.jup.ag/tokens/v1/all`);
    const allTokens = await allResponse.json();
    
    const foundToken = allTokens.find((t: any) => t.address === mintAddress);
    if (foundToken) {
      return {
        address: foundToken.address,
        symbol: foundToken.symbol,
        name: foundToken.name,
        decimals: foundToken.decimals,
        logoURI: foundToken.logoURI,
      };
    }

    return null;
  } catch (error) {
    console.error('Jupiter API error:', error);
    return null;
  }
};

/**
 * Fetch token price from Jupiter Price API
 */
export const getTokenPrice = async (mintAddress: string): Promise<{ price: number; priceChange24h?: number } | null> => {
  try {
    const response = await fetch(`https://lite-api.jup.ag/price/v2?ids=${mintAddress}&showExtraInfo=true`);
    const data = await response.json();
    
    if (data.data && data.data[mintAddress]) {
      const tokenData = data.data[mintAddress];
      return {
        price: tokenData.price || 0,
        priceChange24h: tokenData.extraInfo?.lastSwappedPrice?.lastJupiterSellPrice 
          ? ((tokenData.price - tokenData.extraInfo.lastSwappedPrice.lastJupiterSellPrice) / tokenData.extraInfo.lastSwappedPrice.lastJupiterSellPrice) * 100
          : undefined
      };
    }
    return null;
  } catch (error) {
    console.error('Jupiter price API error:', error);
    return null;
  }
};

/**
 * Fetch token metadata from Moralis API (good for newer tokens)
 */
export const getTokenFromMoralis = async (mintAddress: string): Promise<Token | null> => {
  try {
    const response = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/metadata`,
      {
        headers: {
          'accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.log('Moralis API returned non-OK status:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data && data.mint) {
      return {
        address: data.mint,
        symbol: data.symbol || 'Unknown',
        name: data.name || 'Unknown Token',
        decimals: data.decimals ?? 9,
        logoURI: data.logo || data.metaplex?.metadataUri || undefined,
      };
    }

    return null;
  } catch (error) {
    console.error('Moralis API error:', error);
    return null;
  }
};

/**
 * Derive the Metaplex metadata PDA for a given mint
 */
const deriveMetadataPDA = async (mint: PublicKey): Promise<PublicKey> => {
  const [metadataPDA] = await PublicKey.findProgramAddress(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return metadataPDA;
};

/**
 * Decode a Borsh-encoded string from the metadata buffer
 */
const decodeMetaplexString = (buffer: Buffer, offset: number): { value: string; newOffset: number } => {
  const length = buffer.readUInt32LE(offset);
  const value = buffer.slice(offset + 4, offset + 4 + length).toString('utf8').replace(/\0/g, '').trim();
  return { value, newOffset: offset + 4 + length };
};

/**
 * Fetch token metadata directly from the Solana blockchain using QuickNode RPC
 * This works for ANY SPL token, including newly created Pump.fun tokens
 */
export const getTokenMetadataFromChain = async (mintAddress: string): Promise<Token | null> => {
  try {
    if (!isValidSolanaAddress(mintAddress)) {
      console.log('Invalid Solana address format:', mintAddress);
      return null;
    }

    const connection = new Connection(QUICKNODE_RPC, 'confirmed');
    const mint = new PublicKey(mintAddress);

    // First, verify the mint account exists and get decimals
    const mintAccountInfo = await connection.getParsedAccountInfo(mint);
    
    if (!mintAccountInfo.value) {
      console.log('Mint account not found:', mintAddress);
      return null;
    }

    // Extract decimals from the mint account
    let decimals = 9;
    const parsedData = mintAccountInfo.value.data;
    if (parsedData && typeof parsedData === 'object' && 'parsed' in parsedData) {
      decimals = parsedData.parsed?.info?.decimals ?? 9;
    }

    // Now fetch the Metaplex metadata
    const metadataPDA = await deriveMetadataPDA(mint);
    const metadataAccountInfo = await connection.getAccountInfo(metadataPDA);

    if (!metadataAccountInfo?.data) {
      // No metadata found - create a basic token entry
      console.log('No Metaplex metadata found for:', mintAddress);
      
      const shortAddress = mintAddress.slice(0, 6);
      return {
        address: mintAddress,
        symbol: isPumpFunToken(mintAddress) ? `PUMP-${shortAddress}` : shortAddress,
        name: isPumpFunToken(mintAddress) ? `Pump.fun Token (${shortAddress})` : `Unknown Token (${shortAddress})`,
        decimals,
        logoURI: undefined,
      };
    }

    // Decode the Metaplex metadata
    const buffer = metadataAccountInfo.data;
    let offset = 65;
    
    const nameResult = decodeMetaplexString(buffer, offset);
    const name = nameResult.value || 'Unknown';
    offset = nameResult.newOffset;
    
    const symbolResult = decodeMetaplexString(buffer, offset);
    const symbol = symbolResult.value || 'UNK';
    offset = symbolResult.newOffset;
    
    const uriResult = decodeMetaplexString(buffer, offset);
    const uri = uriResult.value;

    // Try to fetch the logo from the metadata URI
    let logoURI: string | undefined;
    if (uri && uri.startsWith('http')) {
      try {
        const metadataResponse = await fetch(uri);
        const metadata = await metadataResponse.json();
        logoURI = metadata.image || undefined;
      } catch {
        // Ignore errors fetching metadata JSON
      }
    }

    console.log('Successfully fetched on-chain metadata:', { mintAddress, name, symbol, decimals });

    return {
      address: mintAddress,
      symbol: symbol || 'UNK',
      name: name || 'Unknown Token',
      decimals,
      logoURI,
    };
  } catch (error) {
    console.error('Error fetching token metadata from chain:', error);
    return null;
  }
};

/**
 * Get mint info (just decimals) from the blockchain
 */
export const getMintDecimals = async (mintAddress: string): Promise<number | null> => {
  try {
    if (!isValidSolanaAddress(mintAddress)) return null;
    
    const connection = new Connection(QUICKNODE_RPC, 'confirmed');
    const mint = new PublicKey(mintAddress);
    const mintAccountInfo = await connection.getParsedAccountInfo(mint);
    
    if (!mintAccountInfo.value) return null;
    
    const parsedData = mintAccountInfo.value.data;
    if (parsedData && typeof parsedData === 'object' && 'parsed' in parsedData) {
      return parsedData.parsed?.info?.decimals ?? null;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching mint decimals:', error);
    return null;
  }
};

/**
 * Master function: Fetch token metadata using all available APIs
 * Priority: Jupiter (fast) -> Moralis (comprehensive) -> On-chain (fallback)
 */
export const getTokenMetadata = async (mintAddress: string): Promise<TokenMetadataResult> => {
  if (!isValidSolanaAddress(mintAddress)) {
    return { token: null, source: 'none', error: 'Invalid Solana address' };
  }

  // Try Jupiter first (fastest for established tokens)
  console.log('Trying Jupiter API for:', mintAddress);
  const jupiterToken = await getTokenFromJupiter(mintAddress);
  if (jupiterToken) {
    // Enrich with price data
    const priceData = await getTokenPrice(mintAddress);
    if (priceData) {
      jupiterToken.price = priceData.price;
      jupiterToken.priceChange24h = priceData.priceChange24h;
    }
    return { token: jupiterToken, source: 'jupiter' };
  }

  // Try Moralis (good for newer tokens, has logo)
  console.log('Trying Moralis API for:', mintAddress);
  const moralisToken = await getTokenFromMoralis(mintAddress);
  if (moralisToken) {
    // Enrich with price data from Jupiter
    const priceData = await getTokenPrice(mintAddress);
    if (priceData) {
      moralisToken.price = priceData.price;
      moralisToken.priceChange24h = priceData.priceChange24h;
    }
    return { token: moralisToken, source: 'moralis' };
  }

  // Fallback to on-chain metadata
  console.log('Trying on-chain metadata for:', mintAddress);
  const chainToken = await getTokenMetadataFromChain(mintAddress);
  if (chainToken) {
    // Enrich with price data from Jupiter
    const priceData = await getTokenPrice(mintAddress);
    if (priceData) {
      chainToken.price = priceData.price;
      chainToken.priceChange24h = priceData.priceChange24h;
    }
    return { token: chainToken, source: 'chain' };
  }

  return { token: null, source: 'none', error: 'Token not found in any source' };
};

/**
 * Batch fetch token metadata for multiple addresses
 */
export const batchGetTokenMetadata = async (mintAddresses: string[]): Promise<Map<string, Token>> => {
  const results = new Map<string, Token>();
  
  // Process in parallel with concurrency limit
  const batchSize = 5;
  for (let i = 0; i < mintAddresses.length; i += batchSize) {
    const batch = mintAddresses.slice(i, i + batchSize);
    const promises = batch.map(async (address) => {
      const result = await getTokenMetadata(address);
      if (result.token) {
        results.set(address, result.token);
      }
    });
    await Promise.all(promises);
  }
  
  return results;
};
