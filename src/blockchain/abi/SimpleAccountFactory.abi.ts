/**
 * ERC-4337 SimpleAccountFactory ABI — 用於計算 counterfactual 錢包地址。
 * 相容 eth-infinitism/account-abstraction 的 SimpleAccountFactory。
 */
export const SIMPLE_ACCOUNT_FACTORY_ABI = [
  'function getAddress(address owner, uint256 salt) external view returns (address)',
  'function createAccount(address owner, uint256 salt) external returns (address)',
] as const;
