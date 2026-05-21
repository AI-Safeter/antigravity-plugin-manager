---
name: foundry-toolkit
description: Foundry toolkit for Solidity development with forge, cast, anvil, and chisel. Covers project setup, unit testing, fuzz testing, invariant testing, fork tests against live RPCs, cheat codes (vm.prank, vm.expectRevert, vm.deal, vm.warp), gas snapshots, and dependency management via forge install for OpenZeppelin and other libraries. Use this skill when testing, deploying, or debugging Solidity contracts with Foundry.
---

# Foundry Toolkit

Foundry is a Rust-built Solidity toolkit: `forge` for build/test, `cast` for chain RPC interaction, `anvil` for a local node, and `chisel` for a Solidity REPL. Tests are written in Solidity itself, which keeps the assertion language and the production language aligned.

## Use this skill when

- Starting a new Solidity project with `forge init`
- Writing unit, fuzz, or invariant tests in Solidity
- Running fork tests against mainnet, Arbitrum, Base, or another live RPC
- Using cheat codes to manipulate block time, prank callers, or expect reverts
- Installing OpenZeppelin or Solady via `forge install`
- Producing gas snapshots and coverage reports

## Do not use this skill when

- The project is locked into Hardhat with TypeScript scripts the team won't migrate
- You only need to deploy via a GUI (Remix) and won't write tests
- Working in a non-Solidity language

## Core concepts

Foundry projects use `foundry.toml` for config, `src/` for contracts, `test/` for tests, and `lib/` for git-submodule dependencies. Tests are functions prefixed with `test`, `testFuzz`, or `invariant_`. Cheat codes are exposed through the `vm` instance from `forge-std/Test.sol`.

## Quick start

```bash
forge init my-project && cd my-project
forge install OpenZeppelin/openzeppelin-contracts --no-commit
forge test -vvv
forge test --match-test testFuzz_ --fuzz-runs 10000
forge test --fork-url $MAINNET_RPC --match-contract ForkTest
forge snapshot
cast call $ADDR "balanceOf(address)(uint256)" $USER --rpc-url $RPC
anvil --fork-url $MAINNET_RPC
```

```solidity
// test/MyToken.t.sol
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {MyToken} from "../src/MyToken.sol";

contract MyTokenTest is Test {
    MyToken token;
    address alice = makeAddr("alice");

    function setUp() public {
        token = new MyToken(1_000_000 ether);
    }

    function test_MintByOwner() public {
        token.mint(alice, 100 ether);
        assertEq(token.balanceOf(alice), 100 ether);
    }

    function test_RevertWhen_NotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        token.mint(alice, 1 ether);
    }

    function testFuzz_MintWithinCap(uint96 amount) public {
        vm.assume(amount <= 1_000_000 ether);
        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
    }
}
```

## Key patterns

### Cheat codes
- `vm.prank(addr)` next call uses `addr` as `msg.sender`; `vm.startPrank/stopPrank` for ranges.
- `vm.deal(addr, 1 ether)` set ETH balance.
- `vm.warp(timestamp)` and `vm.roll(block)` move chain time/block.
- `vm.expectRevert(SomeError.selector)` assert next call reverts with a specific custom error.
- `vm.expectEmit(true, true, false, true)` check emitted event topics and data.

### Fuzz tests
Function args become randomized inputs. Use `vm.assume(...)` to discard impossible inputs and `bound(x, lo, hi)` to constrain. Increase runs with `--fuzz-runs` for CI.

### Invariant tests
Declare functions `invariant_xxx()` that must always hold. Foundry randomly sequences calls against a target contract; use `targetContract`, `targetSelector`, or a handler pattern to scope state space.

### Fork tests
`vm.createSelectFork(vm.envString("MAINNET_RPC"), 19_000_000)` pins to a block for reproducibility. Great for integrating with real Uniswap, AAVE, or other protocols.

### Scripts and deploys
Put deployments in `script/Deploy.s.sol` extending `forge-std/Script.sol`. Run with `forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --verify`.

## Common pitfalls

- Forgetting `vm.stopPrank()` after `vm.startPrank()`, leaking the pranked sender into other tests.
- Running fork tests without pinning a block, leading to flaky CI as mainnet state shifts.
- `vm.expectRevert()` without a selector hides regressions; prefer the typed form once stable.
- Asserting on logs without configuring `vm.expectEmit` topics correctly; the four bools must match indexed-ness.
- Treating fuzz inputs as exhaustive proof; pair with invariant tests for state-machine bugs.
- Installing deps without `--no-commit` then committing submodule bumps you didn't intend.
- Mixing Hardhat node and Anvil block numbers; pick one runner per project.

## Reference

- Official docs: https://book.getfoundry.sh/
- Cheat codes index: https://book.getfoundry.sh/cheatcodes/
- Related: [[solidity-smart-contracts]]
