/**
 * BlockTic 整合測試 -- 使用真實合約跑完整生命週期。
 *
 * 流程：
 *   1. 計算 AA 錢包地址（counterfactual）
 *   2. 鑄造 KYC SBT -> 驗證持有
 *   3. 鑄造 Ticket SBT -> 驗證持有
 *   4. 記錄抽籤結果到鏈上（DrawResult event）
 *   5. 銷毀 Ticket SBT -> 驗證已銷毀
 *
 * 使用方式：
 *   node scripts/integration-test.js
 */
const path = require('path');
const { JsonRpcProvider, Wallet, Contract, keccak256, solidityPacked } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BLOCK_TIC_SBT_ABI = [
  'function mint(address to, uint256 id, uint256 amount) external',
  'function burn(address from, uint256 id, uint256 amount) external',
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function recordDraw(uint256 eventId, uint256 zoneId, uint256 vrfRequestId, uint256 randomSeed, address[] calldata winners) external',
  'event DrawResult(uint256 indexed eventId, uint256 indexed zoneId, uint256 vrfRequestId, uint256 randomSeed, address[] winners)',
];

const SIMPLE_ACCOUNT_FACTORY_ABI = [
  'function getAddress(address owner, uint256 salt) external view returns (address)',
];

// 測試結果追蹤
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${label}`);
    failed++;
  }
}

async function main() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  const sbtAddress = process.env.SBT_CONTRACT_ADDRESS;
  const factoryAddress = process.env.WALLET_FACTORY_ADDRESS;

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const sbt = new Contract(sbtAddress, BLOCK_TIC_SBT_ABI, wallet);
  const factory = new Contract(factoryAddress, SIMPLE_ACCOUNT_FACTORY_ABI, provider);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  console.log(`=== BlockTic Integration Test ===`);
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Deployer: ${wallet.address}`);
  console.log(`Balance: ${(Number(balance) / 1e18).toFixed(4)} POL`);
  console.log(`SBT Contract: ${sbtAddress}`);
  console.log(`Factory: ${factoryAddress}`);
  console.log('');

  const testUserId = `integration-test-${Date.now()}`;
  const kycTokenId = 1;
  const ticketTokenId = 1000 + Math.floor(Math.random() * 100000);

  // ── Step 1: 計算 AA 錢包地址 ──────────────────────────
  console.log('Step 1: AA Wallet (counterfactual address)');
  const salt = BigInt(keccak256(solidityPacked(['string'], [testUserId])));
  const getAddr = factory.getFunction('getAddress');
  const walletAddress = await getAddr(wallet.address, salt);
  assert(walletAddress && walletAddress.startsWith('0x') && walletAddress.length === 42,
    `AA wallet computed: ${walletAddress}`);
  console.log('');

  // ── Step 2: 鑄造 KYC SBT ─────────────────────────────
  console.log('Step 2: Mint KYC SBT');
  const preKycBalance = await sbt.balanceOf(walletAddress, kycTokenId);
  assert(preKycBalance === 0n, `Pre-mint KYC balance = ${preKycBalance}`);

  const kycTx = await sbt.mint(walletAddress, kycTokenId, 1);
  const kycReceipt = await kycTx.wait();
  assert(!!kycReceipt.hash, `KYC SBT minted, tx: ${kycReceipt.hash}`);

  const postKycBalance = await sbt.balanceOf(walletAddress, kycTokenId);
  assert(postKycBalance === 1n, `Post-mint KYC balance = ${postKycBalance}`);
  console.log('');

  // ── Step 3: 鑄造 Ticket SBT ──────────────────────────
  console.log('Step 3: Mint Ticket SBT');
  const preTicketBalance = await sbt.balanceOf(walletAddress, ticketTokenId);
  assert(preTicketBalance === 0n, `Pre-mint Ticket balance = ${preTicketBalance}`);

  const ticketTx = await sbt.mint(walletAddress, ticketTokenId, 1);
  const ticketReceipt = await ticketTx.wait();
  assert(!!ticketReceipt.hash, `Ticket SBT minted, tx: ${ticketReceipt.hash}`);

  const postTicketBalance = await sbt.balanceOf(walletAddress, ticketTokenId);
  assert(postTicketBalance === 1n, `Post-mint Ticket balance = ${postTicketBalance}`);
  console.log('');

  // ── Step 4: 記錄抽籤結果（DrawResult event）─────────
  console.log('Step 4: Record Draw Result on-chain');
  const eventId = 42;
  const zoneId = 1;
  const vrfRequestId = 12345;
  const randomSeed = 67890;

  const drawTx = await sbt.recordDraw(eventId, zoneId, vrfRequestId, randomSeed, [walletAddress]);
  const drawReceipt = await drawTx.wait();
  assert(!!drawReceipt.hash, `Draw result recorded, tx: ${drawReceipt.hash}`);

  // 驗證 DrawResult event
  const drawEvent = drawReceipt.logs.find(log => {
    try {
      const parsed = sbt.interface.parseLog(log);
      return parsed && parsed.name === 'DrawResult';
    } catch { return false; }
  });
  if (drawEvent) {
    const parsed = sbt.interface.parseLog(drawEvent);
    assert(Number(parsed.args.eventId) === eventId, `DrawResult eventId = ${parsed.args.eventId}`);
    assert(Number(parsed.args.zoneId) === zoneId, `DrawResult zoneId = ${parsed.args.zoneId}`);
    assert(parsed.args.winners.length === 1, `DrawResult winners count = ${parsed.args.winners.length}`);
  } else {
    assert(false, 'DrawResult event not found in logs');
  }
  console.log('');

  // ── Step 5: 銷毀 Ticket SBT（退票）─────────────────
  console.log('Step 5: Burn Ticket SBT (refund)');
  const burnTx = await sbt.burn(walletAddress, ticketTokenId, 1);
  const burnReceipt = await burnTx.wait();
  assert(!!burnReceipt.hash, `Ticket SBT burned, tx: ${burnReceipt.hash}`);

  const postBurnBalance = await sbt.balanceOf(walletAddress, ticketTokenId);
  assert(postBurnBalance === 0n, `Post-burn Ticket balance = ${postBurnBalance}`);

  // KYC SBT 應該還在
  const kycStillExists = await sbt.balanceOf(walletAddress, kycTokenId);
  assert(kycStillExists === 1n, `KYC SBT still exists after ticket burn = ${kycStillExists}`);
  console.log('');

  // ── 結果 ──────────────────────────────────────────────
  console.log('=== Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[ERROR] Integration test failed:', err.message);
  process.exit(1);
});
