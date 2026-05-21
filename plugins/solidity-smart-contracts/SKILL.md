---
name: solidity-smart-contracts
description: Solidity smart contract development covering ERC-20/721/1155 token standards, common vulnerability patterns (reentrancy, integer overflow, access control, tx.origin), Solidity-specific idioms (custom errors, immutable/constant, modifiers, events), and integration with OpenZeppelin contracts. Use this skill when writing, reviewing, or auditing Solidity code for Ethereum or EVM-compatible chains (Polygon, Arbitrum, Optimism, Base).
---

# Solidity Smart Contracts

Solidity 0.8+ development for Ethereum and EVM-compatible chains. Focuses on safe patterns, gas-aware idioms, and the OpenZeppelin contract library. Covers token standards (ERC-20/721/1155), access control, upgradeability awareness, and the most common audit findings.

## Use this skill when

- Writing a new ERC-20, ERC-721, or ERC-1155 token contract
- Adding access control, pausing, or role management to a contract
- Reviewing a contract for reentrancy, access, or arithmetic issues
- Migrating legacy 0.7.x code to 0.8.x with custom errors and unchecked blocks
- Designing modifiers, events, and storage layout for gas efficiency
- Integrating OpenZeppelin libraries via Foundry or Hardhat

## Do not use this skill when

- Targeting non-EVM chains such as Solana (use Anchor/Rust instead)
- Writing only the off-chain dApp frontend (use wagmi/viem/ethers skills)
- Building zk circuits or Cairo contracts

## Core concepts

Solidity 0.8 includes checked arithmetic by default, so overflow/underflow reverts unless wrapped in `unchecked {}`. Storage is expensive (20k gas per new slot, 5k to update), so pack structs and prefer `immutable`/`constant` for deploy-time values. Always emit events for state changes that off-chain indexers care about.

## Quick start

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    error CapExceeded(uint256 requested, uint256 cap);

    uint256 public immutable CAP;

    event Minted(address indexed to, uint256 amount);

    constructor(uint256 cap_) ERC20("MyToken", "MTK") Ownable(msg.sender) {
        CAP = cap_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        if (totalSupply() + amount > CAP) revert CapExceeded(amount, CAP);
        _mint(to, amount);
        emit Minted(to, amount);
    }
}
```

## Key patterns

### Custom errors over require strings
```solidity
error Unauthorized(address caller);
if (msg.sender != owner) revert Unauthorized(msg.sender);
```
Custom errors cost less gas than `require(cond, "string")` and carry typed args.

### Checks-Effects-Interactions
Update state before any external call. Pair with OpenZeppelin's `ReentrancyGuard` (`nonReentrant`) when calling unknown contracts or sending ETH.

### Immutable and constant
```solidity
uint256 public constant FEE_BPS = 30;       // compile-time
address public immutable TREASURY;          // set in constructor only
```
Both skip storage and are dramatically cheaper than regular state variables.

### Access control
Prefer `AccessControl` over `Ownable` once you need more than one privileged role. Define roles as `bytes32` constants computed from `keccak256("MINTER_ROLE")`.

### Pull over push for payments
Let users withdraw their balance rather than pushing ETH out in a loop. Avoids gas-griefing and reentrancy.

### Safe casting and unchecked blocks
```solidity
unchecked { ++i; }  // safe in `for` loops bounded by array length
```
Use `unchecked` only where overflow is mathematically impossible.

## Common pitfalls

- Violating checks-effects-interactions and exposing reentrancy across functions sharing state.
- Using `tx.origin` for auth; it can be spoofed by an intermediate contract. Always use `msg.sender`.
- Wrapping arithmetic in `unchecked` for "gas savings" without proving the math cannot wrap.
- Forgetting that `transferFrom` returns a bool that some non-standard ERC-20s skip; use OpenZeppelin's `SafeERC20.safeTransferFrom`.
- Public state variables auto-generate getters but cannot be returned as structs cleanly; prefer explicit view functions for complex shapes.
- Initializing upgradeable contracts in a `constructor` instead of an `initializer` function (constructors do not run for proxies).
- Reading storage in a loop instead of caching to memory: `uint256 len = arr.length;` then iterate.
- Misordering `_burn`/`_mint` hooks when overriding ERC-20 with multiple inheritance; use `super._update(...)` in 0.8.20+ OZ v5.

## Reference

- Official docs: https://docs.soliditylang.org/
- OpenZeppelin Contracts: https://docs.openzeppelin.com/contracts/
- SWC registry: https://swcregistry.io/
- Related: [[foundry-toolkit]]
