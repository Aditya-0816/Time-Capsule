const { expect }       = require("chai");
const { ethers }       = require("hardhat");
const { time }         = require("@nomicfoundation/hardhat-network-helpers");

// ─────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────

/**
 * Compute keccak256 of a plain string the same way Solidity does:
 *   keccak256(abi.encodePacked(content))
 */
function hashContent(content) {
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

const ONE_DAY = 24 * 60 * 60;   // seconds

// ─────────────────────────────────────────────────────────
//  Test Suite
// ─────────────────────────────────────────────────────────

describe("TimeCapsule", function () {

  let tc;          // contract instance
  let owner;       // default signer
  let other;       // second signer (for transfer tests)

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const Factory  = await ethers.getContractFactory("TimeCapsule");
    tc             = await Factory.deploy();
  });

  // ───────────────────────────────────────────
  //  lock()
  // ───────────────────────────────────────────

  describe("lock()", function () {

    it("creates a capsule and returns its ID", async function () {
      const hash = hashContent("my secret message");
      const tx   = await tc.lock(hash, 1);
      const rc   = await tx.wait();

      // capsuleCounter starts at 0
      const capsuleId = 0n;
      const capsule   = await tc.getCapsule(capsuleId);

      expect(capsule.owner).to.equal(owner.address);
      expect(capsule.contentHash).to.equal(hash);
      expect(capsule.revealed).to.equal(false);
      expect(capsule.revealedContent).to.equal("");
    });

    it("emits CapsuleLocked with correct fields", async function () {
      const hash = hashContent("journalist evidence");
      await expect(tc.lock(hash, 7))
        .to.emit(tc, "CapsuleLocked")
        .withArgs(0n, owner.address, hash, (v) => v > 0n);
    });

    it("increments capsuleCounter for each lock", async function () {
      const h = hashContent("a");
      await tc.lock(h, 1);
      await tc.lock(h, 2);
      expect(await tc.capsuleCounter()).to.equal(2n);
    });

    it("reverts if unlockDays is 0", async function () {
      await expect(tc.lock(hashContent("x"), 0))
        .to.be.revertedWith("TimeCapsule: unlock must be in the future");
    });

    it("reverts if hash is bytes32(0)", async function () {
      await expect(tc.lock(ethers.ZeroHash, 1))
        .to.be.revertedWith("TimeCapsule: hash cannot be empty");
    });
  });

  // ───────────────────────────────────────────
  //  reveal()
  // ───────────────────────────────────────────

  describe("reveal()", function () {

    const SECRET = "the mayor took the bribe on 2025-01-15";

    beforeEach(async function () {
      // Lock capsule 0 with a 1-day unlock
      await tc.lock(hashContent(SECRET), 1);
    });

    it("reveals content after unlock time with correct hash", async function () {
      // Fast-forward 1 day + 1 second
      await time.increase(ONE_DAY + 1);

      await expect(tc.reveal(0n, SECRET))
        .to.emit(tc, "CapsuleRevealed")
        .withArgs(0n, owner.address, SECRET);

      const capsule = await tc.getCapsule(0n);
      expect(capsule.revealedContent).to.equal(SECRET);
      expect(capsule.revealed).to.equal(true);
    });

    it("reverts if called before unlock time", async function () {
      // Do NOT fast-forward — still locked
      await expect(tc.reveal(0n, SECRET))
        .to.be.revertedWith("TimeCapsule: still locked until");
    });

    it("reverts if content does not match hash (wrong content)", async function () {
      await time.increase(ONE_DAY + 1);
      await expect(tc.reveal(0n, "wrong content here"))
        .to.be.revertedWith("TimeCapsule: content does not match stored hash");
    });

    it("reverts if non-owner tries to reveal", async function () {
      await time.increase(ONE_DAY + 1);
      await expect(tc.connect(other).reveal(0n, SECRET))
        .to.be.revertedWith("TimeCapsule: caller is not the capsule owner");
    });

    it("reverts on double-reveal", async function () {
      await time.increase(ONE_DAY + 1);
      await tc.reveal(0n, SECRET);
      await expect(tc.reveal(0n, SECRET))
        .to.be.revertedWith("TimeCapsule: already revealed");
    });

    it("reverts if capsule does not exist", async function () {
      await expect(tc.reveal(999n, SECRET))
        .to.be.revertedWith("TimeCapsule: capsule does not exist");
    });
  });

  // ───────────────────────────────────────────
  //  earlyTransfer()
  // ───────────────────────────────────────────

  describe("earlyTransfer()", function () {

    beforeEach(async function () {
      await tc.lock(hashContent("transfer test"), 5);
    });

    it("transfers ownership before unlock", async function () {
      await expect(tc.earlyTransfer(0n, other.address))
        .to.emit(tc, "CapsuleTransferred")
        .withArgs(0n, owner.address, other.address);

      const capsule = await tc.getCapsule(0n);
      expect(capsule.owner).to.equal(other.address);
    });

    it("new owner can reveal after unlock", async function () {
      await tc.earlyTransfer(0n, other.address);
      await time.increase(5 * ONE_DAY + 1);
      await expect(tc.connect(other).reveal(0n, "transfer test"))
        .to.emit(tc, "CapsuleRevealed");
    });

    it("old owner can no longer reveal after transfer", async function () {
      await tc.earlyTransfer(0n, other.address);
      await time.increase(5 * ONE_DAY + 1);
      await expect(tc.connect(owner).reveal(0n, "transfer test"))
        .to.be.revertedWith("TimeCapsule: caller is not the capsule owner");
    });

    it("reverts if non-owner tries to transfer", async function () {
      await expect(tc.connect(other).earlyTransfer(0n, other.address))
        .to.be.revertedWith("TimeCapsule: caller is not the capsule owner");
    });

    it("reverts if new owner is zero address", async function () {
      await expect(tc.earlyTransfer(0n, ethers.ZeroAddress))
        .to.be.revertedWith("TimeCapsule: new owner is zero address");
    });
  });

  // ───────────────────────────────────────────
  //  timeRemaining()
  // ───────────────────────────────────────────

  describe("timeRemaining()", function () {

    it("returns > 0 before unlock", async function () {
      await tc.lock(hashContent("time test"), 1);
      const remaining = await tc.timeRemaining(0n);
      expect(remaining).to.be.gt(0n);
    });

    it("returns 0 after unlock time passes", async function () {
      await tc.lock(hashContent("time test"), 1);
      await time.increase(ONE_DAY + 1);
      expect(await tc.timeRemaining(0n)).to.equal(0n);
    });
  });

});
