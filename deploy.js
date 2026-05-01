const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("─────────────────────────────────────");
  console.log("Deploying TimeCapsule to Sepolia...");
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "ETH");

  const Factory    = await ethers.getContractFactory("TimeCapsule");
  const timeCapsule = await Factory.deploy();
  await timeCapsule.waitForDeployment();

  const address = await timeCapsule.getAddress();
  console.log("─────────────────────────────────────");
  console.log("TimeCapsule deployed at:", address);
  console.log("─────────────────────────────────────");
  console.log("Next steps:");
  console.log("1. Copy the contract address above");
  console.log("2. Paste it into frontend/index.html  →  CONTRACT_ADDRESS");
  console.log("3. Verify on Etherscan:");
  console.log("   npx hardhat verify --network sepolia", address);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
