/**
 * BlockTicSBT (ERC-1155 Soulbound) 合約 ABI — 僅包含後端需要的函數。
 * 來源：contracts/BlockTicSBT.sol
 */
export const BLOCK_TIC_SBT_ABI = [
  // === 寫入（onlyOwner）===
  'function mint(address to, uint256 id, uint256 amount) external',
  'function burn(address from, uint256 id, uint256 amount) external',
  'function recordDraw(uint256 eventId, uint256 zoneId, uint256 vrfRequestId, uint256 randomSeed, address[] calldata winners) external',

  // === 讀取 ===
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function owner() external view returns (address)',

  // === 事件 ===
  'event DrawResult(uint256 indexed eventId, uint256 indexed zoneId, uint256 vrfRequestId, uint256 randomSeed, address[] winners)',
] as const;
