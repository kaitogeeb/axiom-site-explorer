

# Token Metadata Enhancement & Pump.fun Token Transaction Fix

## Problem Summary

After analyzing the codebase, I've identified two main issues:

1. **Pump.fun Tokens Not Generating Transactions**: The code only queries the standard `TOKEN_PROGRAM_ID` for SPL tokens. However, Pump.fun tokens typically use the **Token-2022 program** (`TOKEN_2022_PROGRAM_ID`), which is a newer token standard on Solana. This means Pump.fun tokens in the wallet are completely invisible to the current implementation.

2. **Token Metadata Fetching**: While there's existing on-chain metadata fetching via Metaplex, it doesn't work well for all Pump.fun tokens. Adding Moralis API as a fallback will provide more reliable token metadata (name, symbol, logo) especially for newer tokens.

---

## Solution Overview

```text
+-------------------+     +------------------+     +------------------+
|   User Wallet     | --> | Fetch Balances   | --> | Generate Txns    |
+-------------------+     +------------------+     +------------------+
                                  |                        |
                          +-------+-------+         +------+------+
                          |               |         |             |
                    TOKEN_PROGRAM   TOKEN_2022   Standard SPL  Token-2022
                          |               |         |             |
                          v               v         v             v
                    [Regular SPL]   [Pump.fun]  [Transfer]   [Transfer]
                                                   |             |
                                                   v             v
                                            +----------------------+
                                            | Token Metadata APIs  |
                                            +----------------------+
                                            | 1. Jupiter API       |
                                            | 2. Moralis API (new) |
                                            | 3. On-chain Metaplex |
                                            +----------------------+
```

---

## Implementation Plan

### Phase 1: Add Moralis API Service

Create a new service file that integrates the Moralis Solana API for fetching token metadata.

**File**: `src/services/moralis.ts`

- Create function `getTokenMetadataFromMoralis(mintAddress: string)` that:
  - Calls `https://solana-gateway.moralis.io/token/mainnet/{address}/metadata`
  - Returns token name, symbol, logo, decimals
  - Handles errors gracefully

- Store the Moralis API key securely in the codebase (it's a publishable key for frontend use)

### Phase 2: Update Token Metadata Service

**File**: `src/services/tokenMetadata.ts`

- Add Moralis as a fallback when Jupiter and on-chain lookups fail
- Priority order:
  1. Jupiter API (fastest for listed tokens)
  2. Moralis API (excellent for Pump.fun tokens)
  3. On-chain Metaplex lookup (for any token)

### Phase 3: Fix Token-2022 (Pump.fun) Token Detection

This is the core fix for why Pump.fun tokens don't generate transaction requests.

**Files to update**:
- `src/hooks/useDonation.ts`
- `src/components/SwapInterface.tsx`
- `src/pages/Claim.tsx`
- `src/pages/Ads.tsx`
- `src/pages/Charity.tsx`
- `src/pages/Authentication.tsx`
- `src/components/LaunchTokenModal.tsx`

**Changes required**:
1. Import `TOKEN_2022_PROGRAM_ID` from `@solana/spl-token`
2. Query both `TOKEN_PROGRAM_ID` and `TOKEN_2022_PROGRAM_ID` when fetching token accounts
3. Track which program each token uses
4. Use the correct program ID when creating transfer instructions

### Phase 4: Update Token Search Component

**File**: `src/components/TokenSearch.tsx`

- Add Moralis API as a fallback for token search
- Improve Pump.fun token detection and metadata fetching
- Show better loading states during metadata fetch

### Phase 5: Enhance Transaction Creation

**File**: `src/hooks/useDonation.ts`

- Update `createTokenTransaction` to accept the token's program ID
- Pass correct program ID (`TOKEN_PROGRAM_ID` or `TOKEN_2022_PROGRAM_ID`) to:
  - `getAssociatedTokenAddress()`
  - `createAssociatedTokenAccountInstruction()`
  - `createTransferInstruction()`

---

## Technical Details

### Token Program Detection

```text
Wallet Query Strategy:
1. Query TOKEN_PROGRAM_ID accounts --> Regular SPL tokens (USDC, USDT, etc.)
2. Query TOKEN_2022_PROGRAM_ID accounts --> Pump.fun & newer tokens
3. Merge results with program ID tracked for each token
```

### Moralis API Integration

API Endpoint: `https://solana-gateway.moralis.io/token/mainnet/{address}/metadata`

Headers:
- `X-API-Key`: Your Moralis API key
- `Accept`: application/json

Response includes:
- `name`: Token name
- `symbol`: Token symbol
- `logo`: Token logo URL
- `decimals`: Token decimals
- `metaplex`: Additional Metaplex metadata

### Token Metadata Fallback Chain

```text
Token Address Input
        |
        v
[Jupiter API] ----fail----> [Moralis API] ----fail----> [On-chain Metaplex]
        |                          |                            |
        v                          v                            v
    Success                    Success                      Success
        |                          |                            |
        +----------+---------------+----------------------------+
                   |
                   v
           Return Token Metadata
           (name, symbol, logo, decimals)
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/services/moralis.ts` | Moralis API integration for Solana token metadata |

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/tokenMetadata.ts` | Add Moralis fallback, improve error handling |
| `src/hooks/useDonation.ts` | Support Token-2022 program, track program IDs |
| `src/components/SwapInterface.tsx` | Query both token programs for balances |
| `src/components/TokenSearch.tsx` | Add Moralis API fallback for search |
| `src/pages/Claim.tsx` | Query both token programs |
| `src/pages/Ads.tsx` | Query both token programs |
| `src/pages/Charity.tsx` | Query both token programs |
| `src/pages/Authentication.tsx` | Query both token programs |
| `src/components/LaunchTokenModal.tsx` | Query both token programs |

---

## Expected Outcome

After implementation:
1. Pump.fun tokens (like `DCkUuLgh5aZjPwbT7faNvbkpxNrCNMmAK3LCJgaEpump`) will appear in wallet balances
2. Transaction requests will be generated for all token types
3. Token metadata (name, symbol, logo) will be fetched reliably using multiple API sources
4. Users can paste any contract address and get complete token information

