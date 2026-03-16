// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// ── Chainlink VRF v2.5 最小介面（避免引入完整 @chainlink/contracts）──

interface IVRFCoordinatorV2Plus {
    function requestRandomWords(
        bytes32 keyHash,
        uint256 subId,
        uint16 requestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes memory extraArgs
    ) external returns (uint256 requestId);
}

/**
 * BlockTicVRF — Chainlink VRF v2.5 Consumer for BlockTic lottery.
 *
 * 此合約負責：
 * 1. 向 VRF Coordinator 請求隨機數
 * 2. 接收 Chainlink 節點回填的隨機數
 * 3. 提供查詢介面供後端讀取結果
 */
contract BlockTicVRF {
    // ── Chainlink VRF 設定 ──
    IVRFCoordinatorV2Plus public immutable coordinator;
    bytes32 public immutable keyHash;
    uint256 public subscriptionId;
    uint16 public constant REQUEST_CONFIRMATIONS = 3;
    uint32 public constant CALLBACK_GAS_LIMIT = 100000;
    uint32 public constant NUM_WORDS = 1;

    address public owner;

    // ── 請求結果儲存 ──
    struct RequestResult {
        bool fulfilled;
        uint256 randomWord;
    }

    mapping(uint256 => RequestResult) public requests;
    uint256 public lastRequestId;

    // ── 事件 ──
    event RandomnessRequested(uint256 indexed requestId);
    event RandomnessFulfilled(uint256 indexed requestId, uint256 randomWord);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(
        address _coordinator,
        bytes32 _keyHash,
        uint256 _subscriptionId
    ) {
        coordinator = IVRFCoordinatorV2Plus(_coordinator);
        keyHash = _keyHash;
        subscriptionId = _subscriptionId;
        owner = msg.sender;
    }

    /**
     * 請求隨機數 — 後端呼叫此函數觸發 VRF 請求。
     */
    function requestRandomWords() external onlyOwner returns (uint256 requestId) {
        // VRF v2.5 extraArgs: 指定以 LINK 付費（非 native token）
        bytes memory extraArgs = abi.encodePacked(
            bytes4(keccak256("VRF ExtraArgsV1")),
            abi.encode(false) // nativePayment = false (pay with LINK)
        );

        requestId = coordinator.requestRandomWords(
            keyHash,
            subscriptionId,
            REQUEST_CONFIRMATIONS,
            CALLBACK_GAS_LIMIT,
            NUM_WORDS,
            extraArgs
        );

        requests[requestId] = RequestResult({ fulfilled: false, randomWord: 0 });
        lastRequestId = requestId;

        emit RandomnessRequested(requestId);
    }

    /**
     * Chainlink VRF 節點回填隨機數 — 由 Coordinator 呼叫。
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == address(coordinator), "Only coordinator");
        require(!requests[requestId].fulfilled, "Already fulfilled");

        requests[requestId].fulfilled = true;
        requests[requestId].randomWord = randomWords[0];

        emit RandomnessFulfilled(requestId, randomWords[0]);
    }

    /**
     * 查詢請求結果 — 後端輪詢此函數。
     */
    function getRequestResult(uint256 requestId) external view returns (bool fulfilled, uint256 randomWord) {
        RequestResult memory result = requests[requestId];
        return (result.fulfilled, result.randomWord);
    }

    /**
     * 更新 subscription ID（若需更換）。
     */
    function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
        subscriptionId = _subscriptionId;
    }
}
