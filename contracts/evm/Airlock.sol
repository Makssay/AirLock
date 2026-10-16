// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Native-currency release firewall. Relay attestation is trusted.
/// @dev Solidity reference for EVM testing. Portaldot V3/revive compatibility is unverified.
contract Airlock {
    enum Status { Missing, Queued, Released, Cancelled }
    struct Policy { uint128 instant; uint128 cap; uint64 delaySeconds; uint128 maxPending; }
    struct Message { Status status; address recipient; uint128 amount; uint64 eligibleAt; }
    struct Plan { Policy policy; uint64 eligibleAt; bool resume; bool exists; }

    address public immutable relay;
    address public immutable guardian;
    bytes32 public immutable sourceDomain;
    uint64 public immutable windowSeconds;
    uint64 public immutable policyDelaySeconds;
    uint128 public immutable reserveFloor;
    Policy public policy;
    Plan public pendingPolicy;
    mapping(bytes32 => Message) public messages;
    uint256 public reserved;
    uint256 private spent;
    uint256 private windowId;
    bool public paused;
    bool private entered;

    error Unauthorized();
    error InvalidPolicy();
    error InvalidMessage();
    error Replay();
    error Paused();
    error InsufficientReserve();
    error QueueFull();
    error WindowCap();
    error NotQueued();
    error TooEarly();
    error TransferFailed();
    error NoPlan();
    error Reentrancy();

    event Queued(bytes32 indexed id, address indexed recipient, uint256 amount, uint64 eligibleAt);
    event Released(bytes32 indexed id, address indexed recipient, uint256 amount);
    event Cancelled(bytes32 indexed id, uint256 amount);
    event ReleasesPaused();
    event PolicyScheduled(uint64 eligibleAt, bool resume);
    event PolicyActivated();
    event PolicyCancelled();

    modifier guarded() { if (entered) revert Reentrancy(); entered = true; _; entered = false; }
    modifier onlyGuardian() { if (msg.sender != guardian) revert Unauthorized(); _; }

    constructor(address relay_, address guardian_, bytes32 sourceDomain_, Policy memory initial,
        uint64 windowSeconds_, uint64 policyDelaySeconds_, uint128 reserveFloor_) payable {
        if (relay_ == address(0) || guardian_ == address(0) || relay_ == guardian_ ||
            windowSeconds_ == 0 || policyDelaySeconds_ == 0) revert InvalidPolicy();
        validate(initial);
        if (msg.value < reserveFloor_) revert InsufficientReserve();
        relay = relay_; guardian = guardian_; sourceDomain = sourceDomain_;
        windowSeconds = windowSeconds_; policyDelaySeconds = policyDelaySeconds_;
        reserveFloor = reserveFloor_; policy = initial;
    }

    receive() external payable {}

    function validate(Policy memory p) private pure {
        if (p.instant == 0 || p.cap < p.instant || p.delaySeconds == 0 || p.maxPending == 0)
            revert InvalidPolicy();
    }

    function messageId(bytes32 domain, uint64 nonce) public pure returns (bytes32) {
        return keccak256(abi.encode(domain, nonce));
    }

    function spentThisWindow() public view returns (uint256) {
        return windowId == block.timestamp / windowSeconds ? spent : 0;
    }

    function consume(uint256 amount) private {
        uint256 id = block.timestamp / windowSeconds;
        uint256 next = (windowId == id ? spent : 0) + amount;
        if (next > policy.cap) revert WindowCap();
        windowId = id; spent = next;
    }

    function pay(address recipient, uint256 amount) private {
        (bool success,) = payable(recipient).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function submit(bytes32 domain, uint64 nonce, address recipient, uint128 amount)
        external guarded returns (bytes32 id) {
        if (msg.sender != relay) revert Unauthorized();
        if (paused) revert Paused();
        if (domain != sourceDomain || recipient == address(0) || amount == 0 || amount > policy.cap)
            revert InvalidMessage();
        id = messageId(domain, nonce);
        if (messages[id].status != Status.Missing) revert Replay();
        if (reserved + amount + reserveFloor > address(this).balance) revert InsufficientReserve();
        if (amount <= policy.instant && spentThisWindow() + amount <= policy.cap) {
            messages[id] = Message(Status.Released, recipient, amount, 0);
            consume(amount); pay(recipient, amount);
            emit Released(id, recipient, amount);
        } else {
            if (reserved + amount > policy.maxPending) revert QueueFull();
            uint64 ready = uint64(block.timestamp) + policy.delaySeconds;
            messages[id] = Message(Status.Queued, recipient, amount, ready);
            reserved += amount;
            emit Queued(id, recipient, amount, ready);
        }
    }

    function execute(bytes32 id) external guarded {
        if (paused) revert Paused();
        Message storage m = messages[id];
        if (m.status != Status.Queued) revert NotQueued();
        if (block.timestamp < m.eligibleAt) revert TooEarly();
        if (reserved + reserveFloor > address(this).balance) revert InsufficientReserve();
        consume(m.amount); reserved -= m.amount; m.status = Status.Released;
        pay(m.recipient, m.amount); emit Released(id, m.recipient, m.amount);
    }

    function cancel(bytes32 id) external onlyGuardian guarded {
        Message storage m = messages[id];
        if (m.status != Status.Queued) revert NotQueued();
        reserved -= m.amount; m.status = Status.Cancelled;
        emit Cancelled(id, m.amount);
    }

    function pause() external onlyGuardian guarded { paused = true; emit ReleasesPaused(); }

    function schedulePolicy(Policy calldata next, bool resume) external onlyGuardian guarded {
        validate(next);
        uint64 ready = uint64(block.timestamp) + policyDelaySeconds;
        pendingPolicy = Plan(next, ready, resume, true);
        emit PolicyScheduled(ready, resume);
    }

    function activatePolicy() external guarded {
        Plan memory p = pendingPolicy;
        if (!p.exists) revert NoPlan();
        if (block.timestamp < p.eligibleAt) revert TooEarly();
        policy = p.policy; delete pendingPolicy;
        if (p.resume) paused = false;
        emit PolicyActivated();
    }

    function cancelPolicy() external onlyGuardian guarded {
        delete pendingPolicy; emit PolicyCancelled();
    }
}

/// @dev Adversarial fixture: recipient rejects payment, or attempts a nested withdrawal.
contract AdversarialRecipient {
    Airlock public target;
    bytes32 public queuedId;
    bool public rejectPayment;
    bool public reentryBlocked;
    function configure(Airlock target_, bytes32 id_, bool reject_) external {
        target = target_; queuedId = id_; rejectPayment = reject_;
    }
    receive() external payable {
        require(!rejectPayment, "reject");
        try target.execute(queuedId) { revert("reentry succeeded"); }
        catch { reentryBlocked = true; }
    }
}
