// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Testnet message outbox, not an ETH bridge or escrow.
contract AirlockOutbox {
    address public immutable owner;
    address public immutable recipient;
    address public immutable destination;
    uint256 public constant destinationChainId = 420420777;
    uint64 public nonce;
    event ReleaseRequested(uint64 indexed nonce, address indexed recipient, uint128 amount, uint256 destinationChainId, address destination);
    constructor(address destination_, address recipient_) {
        require(block.chainid == 11155111, "Sepolia only");
        require(destination_ != address(0) && recipient_ != address(0), "Invalid destination");
        owner = msg.sender; destination = destination_; recipient = recipient_;
    }
    function requestRelease(uint128 amount) external {
        require(msg.sender == owner, "Only owner");
        require(amount > 0 && amount <= 5 ether, "Invalid test amount");
        emit ReleaseRequested(++nonce, recipient, amount, destinationChainId, destination);
    }
}
