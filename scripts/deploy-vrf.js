/**
 * BlockTicVRF 合約部署腳本 — Polygon Amoy Testnet
 *
 * 使用方式：
 *   node scripts/deploy-vrf.js <subscriptionId>
 *
 * 前置需求：
 *   1. 到 https://vrf.chain.link/ 建立 VRF v2.5 subscription (選 Polygon Amoy)
 *   2. 到 https://faucets.chain.link/polygon-amoy 取得 LINK 測試幣
 *   3. 在 subscription 頁面充值 LINK
 *   4. 部署後，在 subscription 頁面加入 consumer 合約地址
 */
const path = require('path');
const fs = require('fs');
const solc = require('solc');
const { JsonRpcProvider, Wallet, ContractFactory } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Chainlink VRF v2.5 on Polygon Amoy
const VRF_COORDINATOR_AMOY = '0x343300b5d84999FffC6d42C81776E9C4E8bb8a20';
const KEY_HASH_AMOY = '0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899';

async function main() {
  const subscriptionId = process.argv[2];
  if (!subscriptionId) {
    console.error('[ERROR] 請提供 subscription ID');
    console.error('  用法: node scripts/deploy-vrf.js <subscriptionId>');
    console.error('');
    console.error('  建立 subscription 的步驟:');
    console.error('  1. 前往 https://vrf.chain.link/');
    console.error('  2. 連接錢包，選擇 Polygon Amoy 網路');
    console.error('  3. 點選 "Create Subscription"');
    console.error('  4. 取得 subscription ID 後執行此腳本');
    process.exit(1);
  }

  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.POLYGON_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('[ERROR] 請設定 POLYGON_RPC_URL 和 POLYGON_PRIVATE_KEY');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`[INFO] Deployer: ${wallet.address}`);
  console.log(`[INFO] 餘額: ${(Number(balance) / 1e18).toFixed(4)} POL`);
  console.log(`[INFO] Subscription ID: ${subscriptionId}`);

  // ── 編譯 Solidity ──
  console.log('\n[INFO] 編譯 BlockTicVRF.sol...');

  const contractSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'contracts', 'BlockTicVRF.sol'),
    'utf8',
  );

  const input = {
    language: 'Solidity',
    sources: {
      'BlockTicVRF.sol': { content: contractSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('[ERROR] 編譯失敗:');
      errors.forEach((e) => console.error(e.formattedMessage));
      process.exit(1);
    }
    output.errors
      .filter((e) => e.severity === 'warning')
      .forEach((e) => console.warn(`[WARN] ${e.message}`));
  }

  const contract = output.contracts['BlockTicVRF.sol']['BlockTicVRF'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  console.log(`[INFO] 編譯完成 — bytecode ${bytecode.length} bytes`);

  // ── 部署 ──
  console.log('\n[INFO] 部署 BlockTicVRF 到 Polygon Amoy...');
  console.log(`[INFO] VRF Coordinator: ${VRF_COORDINATOR_AMOY}`);
  console.log(`[INFO] Key Hash: ${KEY_HASH_AMOY}`);

  const factory = new ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.deploy(
    VRF_COORDINATOR_AMOY,
    KEY_HASH_AMOY,
    BigInt(subscriptionId),
  );

  console.log(`[INFO] 交易已送出 — txHash: ${deployTx.deploymentTransaction().hash}`);
  console.log('[INFO] 等待確認...');

  await deployTx.waitForDeployment();
  const deployedAddress = await deployTx.getAddress();

  console.log(`\n[OK] BlockTicVRF 部署成功`);
  console.log(`[OK] 合約地址: ${deployedAddress}`);
  console.log(`[OK] Polygonscan: https://amoy.polygonscan.com/address/${deployedAddress}`);

  // ── 更新 .env ──
  const envPath = path.resolve(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /VRF_COORDINATOR_ADDRESS=.*/,
    `VRF_COORDINATOR_ADDRESS=${deployedAddress}`,
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`[OK] .env 已更新 VRF_COORDINATOR_ADDRESS=${deployedAddress}`);

  console.log('\n[NEXT] 後續步驟:');
  console.log(`  1. 前往 https://vrf.chain.link/`);
  console.log(`  2. 開啟 subscription #${subscriptionId}`);
  console.log(`  3. 點選 "Add Consumer"，輸入: ${deployedAddress}`);
  console.log(`  4. 確保 subscription 有足夠的 LINK 餘額`);
}

main().catch((err) => {
  console.error('[ERROR] 部署失敗:', err.message);
  process.exit(1);
});
