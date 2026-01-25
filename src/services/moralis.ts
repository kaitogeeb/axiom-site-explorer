/**
 * Moralis API Integration for Solana Token Metadata
 * This service fetches token metadata (name, symbol, logo, decimals) from Moralis
 */

const MORALIS_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjVkZTZhZTBhLWE1ZDUtNDJlNi04YTc2LTE5MzRhMzE3YWVjNyIsIm9yZ0lkIjoiNDc5MTQ3IiwidXNlcklkIjoiNDkyOTQ3IiwidHlwZUlkIjoiY2M1Y2Q3ZmEtYzY5OS00NDIxLTg2MDgtNjhhNWZlYmI3NzkzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjIwOTI5NTksImV4cCI6NDkxNzg1Mjk1OX0.k7F9gymw59NoAhOYieWLKS-APSTwGHaZYnDId7EiHr4';

export interface MoralisTokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  thumbnail?: string;
  possibleSpam?: boolean;
  verifiedContract?: boolean;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

/**
 * Fetch token metadata from Moralis Solana API
 * Works great for Pump.fun tokens and all SPL tokens
 */
export const getTokenMetadataFromMoralis = async (mintAddress: string): Promise<Token | null> => {
  try {
    const response = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/metadata`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.log('Moralis API returned non-200:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data || data.error) {
      console.log('Moralis returned error or no data:', data?.error);
      return null;
    }

    console.log('Moralis metadata fetched successfully:', {
      address: mintAddress,
      name: data.name,
      symbol: data.symbol,
    });

    return {
      address: mintAddress,
      symbol: data.symbol || 'UNK',
      name: data.name || 'Unknown Token',
      decimals: data.decimals ?? 9,
      logoURI: data.logo || data.thumbnail || undefined,
    };
  } catch (error) {
    console.error('Error fetching token metadata from Moralis:', error);
    return null;
  }
};

/**
 * Get token price from Moralis (if available)
 */
export const getTokenPriceFromMoralis = async (mintAddress: string): Promise<number | null> => {
  try {
    const response = await fetch(
      `https://solana-gateway.moralis.io/token/mainnet/${mintAddress}/price`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': MORALIS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data?.usdPrice ?? null;
  } catch (error) {
    console.error('Error fetching token price from Moralis:', error);
    return null;
  }
};

/**
 * Batch fetch multiple token metadata
 */
export const getMultipleTokenMetadata = async (mintAddresses: string[]): Promise<Map<string, Token>> => {
  const results = new Map<string, Token>();
  
  // Moralis doesn't have a batch endpoint, so we fetch in parallel with rate limiting
  const batchSize = 5;
  
  for (let i = 0; i < mintAddresses.length; i += batchSize) {
    const batch = mintAddresses.slice(i, i + batchSize);
    const promises = batch.map(address => getTokenMetadataFromMoralis(address));
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach((token, index) => {
      if (token) {
        results.set(batch[index], token);
      }
    });
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < mintAddresses.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
};
