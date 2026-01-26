

# Plan: Integrate Full Token Metadata Lookup Across the Site

## Overview
Enhance the site so that whenever a user inputs a contract address, it automatically fetches complete token information (logo, name, symbol, price) using all available APIs (Jupiter, Moralis, QuickNode on-chain).

## Changes Required

### 1. Enhance TokenSearch Component
**File:** `src/components/TokenSearch.tsx`

Update the token search to use the full `getTokenMetadata` function instead of just `getTokenMetadataFromChain`. This will:
- Try Jupiter API first (fastest for established tokens)
- Fall back to Moralis API (good for newer tokens with logos)
- Finally use on-chain QuickNode RPC (works for any SPL token including Pump.fun)

**Technical Changes:**
- Import `getTokenMetadata` from `tokenMetadata.ts`
- Replace calls to `getTokenMetadataFromChain` with `getTokenMetadata`
- Display price information when available

### 2. Add Token Lookup to Index Page (Swap Interface)
**File:** `src/pages/Index.tsx`

The swap interface already has TokenSearch which will benefit from the enhanced lookup. No additional changes needed after updating TokenSearch.

### 3. Integrate ContractAddressLookup Component
**Files:** Add to pages where users should be able to lookup tokens

Option A: Add a dedicated token lookup section to the Dex page
Option B: Add token lookup to the Index page below the swap interface

I recommend Option A since it keeps the main swap interface clean while providing a dedicated space for token research.

### 4. Enhance Token Display in Wallet Balances
**Files:** `src/components/SwapInterface.tsx`, `src/pages/Claim.tsx`, `src/pages/Authentication.tsx`

Currently, wallet token balances only show the mint address (truncated). Enhance to show:
- Token logo (if available)
- Token name and symbol
- Current price (if available)

This will use the `batchGetTokenMetadata` function to efficiently fetch metadata for all tokens in the wallet.

## Implementation Details

### TokenSearch Enhancement
```text
Current flow:
User types address → Jupiter search → On-chain fallback

New flow:
User types address → getTokenMetadata() which tries:
  1. Jupiter API (strict + all tokens)
  2. Moralis API
  3. On-chain QuickNode RPC
```

### Wallet Balance Enhancement
```text
When wallet connects:
1. Fetch all token account addresses
2. Call batchGetTokenMetadata() with all mint addresses
3. Display enhanced token info (logo, name, symbol, price)
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/TokenSearch.tsx` | Use `getTokenMetadata` instead of `getTokenMetadataFromChain` |
| `src/pages/Dex.tsx` | Add `ContractAddressLookup` component for dedicated token lookup |
| `src/components/SwapInterface.tsx` | Fetch and display token metadata for wallet balances |
| `src/pages/Claim.tsx` | Display token logos/names for wallet token list |
| `src/pages/Authentication.tsx` | Display token metadata for tokens in connected wallet |

## Important Note
All existing transaction request generation logic and buttons will remain completely unchanged as per your requirements. Only the UI display and metadata fetching will be enhanced.

## Expected Result
- When user enters any Solana contract address in token search, the site will fetch and display:
  - Token logo
  - Token name
  - Token symbol
  - Token decimals
  - Current price (if available)
  - 24h price change (if available)
- The lookup will work for ALL tokens including newly created Pump.fun tokens

