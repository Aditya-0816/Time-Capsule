# ⧗ TimeCapsule

Lock a keccak256 hash on-chain with a future unlock date.  
Only after the unlock time can the owner reveal the plaintext — verified by the contract.

## Project Structure

```
timecapsule/
├── contracts/
│   └── TimeCapsule.sol       ← main contract (~160 lines)
├── scripts/
│   └── deploy.js             ← Sepolia deployment script
├── test/
│   └── TimeCapsule.test.js   ← 14 Hardhat tests
├── frontend/
│   └── index.html            ← demo UI (single file, no build needed)
├── hardhat.config.js
├── package.json
├── .env.example              ← copy to .env and fill in keys
└── .gitignore
```

## Quick Start (GitHub Codespaces)

1. Open this repo in GitHub Codespaces
2. In the terminal:
   ```bash
   npm install
   npx hardhat compile
   npx hardhat test
   ```
3. Copy `.env.example` → `.env` and fill in your keys
4. Deploy:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```
5. Verify on Etherscan:
   ```bash
   npx hardhat verify --network sepolia <DEPLOYED_ADDRESS>
   ```
6. Paste the deployed address into `frontend/index.html` → `CONTRACT_ADDRESS`
7. Open `frontend/index.html` in your browser with MetaMask

## Key Concepts

- **keccak256** — Ethereum's native hash function (not SHA-256). Built-in opcode, cheapest to use.
- **block.timestamp gate** — `reveal()` only succeeds if `block.timestamp >= unlockTime`
- **Commitment scheme** — lock the hash first, reveal later. Proves prior knowledge.
- **Journalist scenario** — hash your evidence, lock it. Even if pressured, no one can forge the timestamp.

## Functions

| Function | Who | When |
|---|---|---|
| `lock(hash, days)` | anyone | anytime |
| `reveal(id, content)` | capsule owner | after unlockTime |
| `earlyTransfer(id, addr)` | capsule owner | before reveal |
| `timeRemaining(id)` | anyone | anytime (view) |
| `getCapsule(id)` | anyone | anytime (view) |

## Tests (14 total)

```bash
npx hardhat test
```

Covers: happy paths, all revert cases, double-reveal guard, transfer + new owner reveal, time gates.
