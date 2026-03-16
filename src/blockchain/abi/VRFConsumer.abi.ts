/**
 * BlockTic VRF Consumer 合約 ABI。
 *
 * 此合約繼承 Chainlink VRFConsumerBaseV2Plus，
 * 負責向 VRF Coordinator 請求隨機數並儲存結果。
 */
export const VRF_CONSUMER_ABI = [
  'function requestRandomWords() external returns (uint256 requestId)',
  'function getRequestResult(uint256 requestId) external view returns (bool fulfilled, uint256 randomWord)',
  'function lastRequestId() external view returns (uint256)',
] as const;
