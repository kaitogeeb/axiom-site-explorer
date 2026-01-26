import { Connection, PublicKey } from '@solana/web3.js';
import { getMint, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

const QUICKNODE_RPC = 'https://greatest-long-moon.solana-mainnet.quiknode.pro/ddf7c0e44cc3e924254561d8a240ef39de980a99/';

export interface MintInfo {
  programId: PublicKey;
  decimals: number;
  isToken2022: boolean;
}

/**
 * Determine which token program (SPL Token or Token-2022) a mint belongs to.
 * Pump.fun tokens use Token-2022, while most other tokens use the legacy SPL Token program.
 */
export const getMintProgramId = async (
  connection: Connection,
  mintAddress: string
): Promise<MintInfo> => {
  try {
    const mintPubkey = new PublicKey(mintAddress);
    
    // First, try to get the account info to check which program owns it
    const accountInfo = await connection.getAccountInfo(mintPubkey);
    
    if (!accountInfo) {
      // Default to legacy TOKEN_PROGRAM_ID if account not found
      return {
        programId: TOKEN_PROGRAM_ID,
        decimals: 9,
        isToken2022: false
      };
    }

    // Check if the owner is Token-2022 program
    const isToken2022 = accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
    const programId = isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    // Get mint info using the correct program
    try {
      const mintInfo = await getMint(connection, mintPubkey, 'confirmed', programId);
      return {
        programId,
        decimals: mintInfo.decimals,
        isToken2022
      };
    } catch {
      // If getMint fails, return with default decimals
      return {
        programId,
        decimals: 9,
        isToken2022
      };
    }
  } catch (error) {
    console.error('Error determining mint program ID:', error);
    // Default to legacy program on error
    return {
      programId: TOKEN_PROGRAM_ID,
      decimals: 9,
      isToken2022: false
    };
  }
};

/**
 * Check if a token address is likely a Pump.fun token (ends with "pump")
 */
export const isPumpFunToken = (address: string): boolean => {
  return address.toLowerCase().endsWith('pump');
};

/**
 * Batch fetch mint program IDs for multiple tokens
 */
export const batchGetMintProgramIds = async (
  connection: Connection,
  mintAddresses: string[]
): Promise<Map<string, MintInfo>> => {
  const results = new Map<string, MintInfo>();
  
  // Process in parallel with concurrency limit
  const batchSize = 10;
  for (let i = 0; i < mintAddresses.length; i += batchSize) {
    const batch = mintAddresses.slice(i, i + batchSize);
    const promises = batch.map(async (address) => {
      const info = await getMintProgramId(connection, address);
      results.set(address, info);
    });
    await Promise.all(promises);
  }
  
  return results;
};
