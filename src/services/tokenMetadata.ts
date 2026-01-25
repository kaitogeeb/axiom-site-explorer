import { Connection, PublicKey } from '@solana/web3.js';
import { getTokenMetadataFromMoralis } from './moralis';

const QUICKNODE_RPC = 'https://greatest-long-moon.solana-mainnet.quiknode.pro/ddf7c0e44cc3e924254561d8a240ef39de980a99/';
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  programId?: string; // Track which token program (TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID)
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
 * Metaplex uses a 4-byte length prefix followed by the string data
 */
const decodeMetaplexString = (buffer: Buffer, offset: number): { value: string; newOffset: number } => {
  const length = buffer.readUInt32LE(offset);
  const value = buffer.slice(offset + 4, offset + 4 + length).toString('utf8').replace(/\0/g, '').trim();
  return { value, newOffset: offset + 4 + length };
};

/**
 * Fetch token metadata using multiple sources with fallbacks:
 * 1. Moralis API (best for Pump.fun tokens)
 * 2. On-chain Metaplex metadata
 * 
 * This works for ANY SPL token, including newly created Pump.fun tokens
 */
export const getTokenMetadataFromChain = async (mintAddress: string): Promise<Token | null> => {
  try {
    // Validate the address format
    if (!isValidSolanaAddress(mintAddress)) {
      console.log('Invalid Solana address format:', mintAddress);
      return null;
    }

    // Try Moralis API first (excellent for Pump.fun tokens)
    const moralisToken = await getTokenMetadataFromMoralis(mintAddress);
    if (moralisToken && moralisToken.name && moralisToken.symbol) {
      console.log('Got metadata from Moralis:', moralisToken);
      return moralisToken;
    }

    // Fall back to on-chain metadata
    const connection = new Connection(QUICKNODE_RPC, 'confirmed');
    const mint = new PublicKey(mintAddress);

    // First, verify the mint account exists and get decimals
    const mintAccountInfo = await connection.getParsedAccountInfo(mint);
    
    if (!mintAccountInfo.value) {
      console.log('Mint account not found:', mintAddress);
      return null;
    }

    // Extract decimals from the mint account
    let decimals = 9; // Default to 9 (like SOL)
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
      
      // For Pump.fun tokens, we can still return a basic entry
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
    
    // Skip to name field (byte 65)
    let offset = 65;
    
    // Decode name
    const nameResult = decodeMetaplexString(buffer, offset);
    const name = nameResult.value || 'Unknown';
    offset = nameResult.newOffset;
    
    // Decode symbol
    const symbolResult = decodeMetaplexString(buffer, offset);
    const symbol = symbolResult.value || 'UNK';
    offset = symbolResult.newOffset;
    
    // Decode URI (for potential logo)
    const uriResult = decodeMetaplexString(buffer, offset);
    const uri = uriResult.value;

    // Try to fetch the logo from the metadata URI if it's a valid URL
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
 * Lighter weight than full metadata fetch
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
