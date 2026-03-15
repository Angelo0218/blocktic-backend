// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BlockTicSBT is ERC1155, Ownable {

    constructor() ERC1155("") Ownable(msg.sender) {}

    // === Soulbound: override transfer → only platform can operate ===
    function safeTransferFrom(
        address from, address to, uint256 id,
        uint256 amount, bytes memory data
    ) public override {
        require(msg.sender == owner(), "Soulbound: transfer disabled");
        super.safeTransferFrom(from, to, id, amount, data);
    }

    function safeBatchTransferFrom(
        address from, address to, uint256[] memory ids,
        uint256[] memory amounts, bytes memory data
    ) public override {
        require(msg.sender == owner(), "Soulbound: transfer disabled");
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    // === Only platform can mint (ticket / KYC attestation) ===
    function mint(address to, uint256 id, uint256 amount) external onlyOwner {
        _mint(to, id, amount, "");
    }

    function mintBatch(address to, uint256[] memory ids,
        uint256[] memory amounts) external onlyOwner {
        _mintBatch(to, ids, amounts, "");
    }

    // === Only platform can burn (refund) ===
    function burn(address from, uint256 id, uint256 amount) external onlyOwner {
        _burn(from, id, amount);
    }

    // === VRF draw record (event log, no token) ===
    event DrawResult(
        uint256 indexed eventId,
        uint256 indexed zoneId,
        uint256 vrfRequestId,
        uint256 randomSeed,
        address[] winners
    );

    function recordDraw(
        uint256 eventId, uint256 zoneId,
        uint256 vrfRequestId, uint256 randomSeed,
        address[] calldata winners
    ) external onlyOwner {
        emit DrawResult(eventId, zoneId, vrfRequestId, randomSeed, winners);
    }
}
