// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TimeCapsule
 * @notice Lock a keccak256 hash on-chain with a future unlock date.
 *         Only after the unlock time can the owner reveal the plaintext,
 *         which is verified against the stored hash.
 * @dev    PBL Project #40 — Category D, Intermediate, Sepolia Testnet
 */
contract TimeCapsule {

    // ─────────────────────────────────────────────
    //  Data Structures
    // ─────────────────────────────────────────────

    struct Capsule {
        address owner;            // who locked this capsule
        bytes32 contentHash;      // keccak256 of the secret content
        uint256 unlockTime;       // absolute Unix timestamp when reveal is allowed
        string  revealedContent;  // empty until successfully revealed
        bool    revealed;         // guard against double-reveal
    }

    // ─────────────────────────────────────────────
    //  State Variables
    // ─────────────────────────────────────────────

    mapping(uint256 => Capsule) public capsules;
    uint256 public capsuleCounter;   // auto-incrementing ID

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    event CapsuleLocked(
        uint256 indexed capsuleId,
        address indexed owner,
        bytes32         contentHash,
        uint256         unlockTime
    );

    event CapsuleRevealed(
        uint256 indexed capsuleId,
        address indexed owner,
        string          content
    );

    event CapsuleTransferred(
        uint256 indexed capsuleId,
        address indexed oldOwner,
        address indexed newOwner
    );

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    modifier onlyCapsuleOwner(uint256 capsuleId) {
        require(
            capsules[capsuleId].owner == msg.sender,
            "TimeCapsule: caller is not the capsule owner"
        );
        _;
    }

    modifier capsuleExists(uint256 capsuleId) {
        require(
            capsules[capsuleId].owner != address(0),
            "TimeCapsule: capsule does not exist"
        );
        _;
    }

    // ─────────────────────────────────────────────
    //  Core Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Lock a content hash on-chain with a future unlock date.
     * @param  contentHash  keccak256 hash of the secret content (computed off-chain)
     * @param  unlockDays   number of days from now before reveal is allowed (min 1)
     * @return capsuleId    the ID assigned to this capsule
     */
    function lock(bytes32 contentHash, uint256 unlockDays)
        external
        returns (uint256 capsuleId)
    {
        require(unlockDays > 0,           "TimeCapsule: unlock must be in the future");
        require(contentHash != bytes32(0), "TimeCapsule: hash cannot be empty");

        uint256 unlockTime = block.timestamp + (unlockDays * 1 days);
        capsuleId = capsuleCounter++;

        capsules[capsuleId] = Capsule({
            owner:           msg.sender,
            contentHash:     contentHash,
            unlockTime:      unlockTime,
            revealedContent: "",
            revealed:        false
        });

        emit CapsuleLocked(capsuleId, msg.sender, contentHash, unlockTime);
    }

    /**
     * @notice Reveal the plaintext content of a capsule after the unlock time.
     *         The contract verifies keccak256(content) == stored hash.
     * @param  capsuleId  ID of the capsule to reveal
     * @param  content    the original plaintext that was hashed when locking
     */
    function reveal(uint256 capsuleId, string calldata content)
        external
        capsuleExists(capsuleId)
        onlyCapsuleOwner(capsuleId)
    {
        Capsule storage c = capsules[capsuleId];

        require(!c.revealed, "TimeCapsule: already revealed");
        require(
            block.timestamp >= c.unlockTime,
            string(abi.encodePacked(
                "TimeCapsule: still locked until ",
                _uint2str(c.unlockTime)
            ))
        );
        require(
            keccak256(abi.encodePacked(content)) == c.contentHash,
            "TimeCapsule: content does not match stored hash"
        );

        c.revealedContent = content;
        c.revealed        = true;

        emit CapsuleRevealed(capsuleId, msg.sender, content);
    }

    /**
     * @notice Transfer ownership of a capsule before it is unlocked.
     *         The new owner will be the only one who can call reveal().
     * @param  capsuleId  ID of the capsule to transfer
     * @param  newOwner   address of the new owner
     */
    function earlyTransfer(uint256 capsuleId, address newOwner)
        external
        capsuleExists(capsuleId)
        onlyCapsuleOwner(capsuleId)
    {
        require(newOwner != address(0), "TimeCapsule: new owner is zero address");
        require(!capsules[capsuleId].revealed, "TimeCapsule: capsule already revealed");

        address oldOwner = capsules[capsuleId].owner;
        capsules[capsuleId].owner = newOwner;

        emit CapsuleTransferred(capsuleId, oldOwner, newOwner);
    }

    // ─────────────────────────────────────────────
    //  View Helpers
    // ─────────────────────────────────────────────

    /**
     * @notice Returns the number of seconds remaining until a capsule unlocks.
     *         Returns 0 if already unlocked.
     */
    function timeRemaining(uint256 capsuleId)
        external
        view
        capsuleExists(capsuleId)
        returns (uint256)
    {
        uint256 unlock = capsules[capsuleId].unlockTime;
        if (block.timestamp >= unlock) return 0;
        return unlock - block.timestamp;
    }

    /**
     * @notice Returns all fields of a capsule as a tuple.
     */
    function getCapsule(uint256 capsuleId)
        external
        view
        capsuleExists(capsuleId)
        returns (
            address owner,
            bytes32 contentHash,
            uint256 unlockTime,
            string  memory revealedContent,
            bool    revealed
        )
    {
        Capsule storage c = capsules[capsuleId];
        return (c.owner, c.contentHash, c.unlockTime, c.revealedContent, c.revealed);
    }

    // ─────────────────────────────────────────────
    //  Internal Utility
    // ─────────────────────────────────────────────

    function _uint2str(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 temp = v;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buf = new bytes(digits);
        while (v != 0) { digits--; buf[digits] = bytes1(uint8(48 + (v % 10))); v /= 10; }
        return string(buf);
    }
}
