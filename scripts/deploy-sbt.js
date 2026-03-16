/**
 * BlockTicSBT 合約部署腳本 — Polygon Amoy Testnet
 *
 * 使用方式：
 *   node scripts/deploy-sbt.js
 *
 * 前置需求：
 *   - .env 中的 POLYGON_RPC_URL 和 POLYGON_PRIVATE_KEY 已設定
 *   - deployer 帳戶有足夠的測試 POL
 */
const path = require('path');
const fs = require('fs');
const solc = require('solc');
const { JsonRpcProvider, Wallet, ContractFactory } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const rpcUrl = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.POLYGON_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    console.error('[ERROR] 請設定 POLYGON_RPC_URL 和 POLYGON_PRIVATE_KEY');
    process.exit(1);
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  console.log(`[INFO] 網路: ${network.name} (chainId: ${network.chainId})`);
  console.log(`[INFO] Deployer: ${wallet.address}`);
  console.log(`[INFO] 餘額: ${(Number(balance) / 1e18).toFixed(4)} POL`);

  if (balance === 0n) {
    console.error('[ERROR] 餘額為 0，請先取得測試 POL');
    process.exit(1);
  }

  // ── 編譯 Solidity ──
  console.log('\n[INFO] 編譯 BlockTicSBT.sol...');

  const contractSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'contracts', 'BlockTicSBT.sol'),
    'utf8',
  );

  const input = {
    language: 'Solidity',
    sources: {
      'BlockTicSBT.sol': { content: contractSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode.object'] },
      },
    },
  };

  // 處理 OpenZeppelin import
  function findImports(importPath) {
    const ozPath = path.resolve(__dirname, '..', 'node_modules', importPath);
    if (fs.existsSync(ozPath)) {
      return { contents: fs.readFileSync(ozPath, 'utf8') };
    }
    return { error: `File not found: ${importPath}` };
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  if (output.errors) {
    const errors = output.errors.filter((e) => e.severity === 'error');
    if (errors.length > 0) {
      console.error('[ERROR] 編譯失敗:');
      errors.forEach((e) => console.error(e.formattedMessage));
      process.exit(1);
    }
    // 只有 warning，繼續
    output.errors
      .filter((e) => e.severity === 'warning')
      .forEach((e) => console.warn(`[WARN] ${e.message}`));
  }

  const contract = output.contracts['BlockTicSBT.sol']['BlockTicSBT'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;

  console.log(`[INFO] 編譯完成 — bytecode ${bytecode.length} bytes`);

  // ── 部署 ──
  console.log('\n[INFO] 部署 BlockTicSBT 到 Polygon Amoy...');

  const factory = new ContractFactory(abi, bytecode, wallet);
  const deployTx = await factory.deploy();

  console.log(`[INFO] 交易已送出 — txHash: ${deployTx.deploymentTransaction().hash}`);
  console.log('[INFO] 等待確認...');

  await deployTx.waitForDeployment();
  const deployedAddress = await deployTx.getAddress();

  console.log(`\n[OK] BlockTicSBT 部署成功`);
  console.log(`[OK] 合約地址: ${deployedAddress}`);
  console.log(`[OK] Polygonscan: https://amoy.polygonscan.com/address/${deployedAddress}`);

  // ── 更新 .env ──
  const envPath = path.resolve(__dirname, '..', '.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /SBT_CONTRACT_ADDRESS=.*/,
    `SBT_CONTRACT_ADDRESS=${deployedAddress}`,
  );
  fs.writeFileSync(envPath, envContent);
  console.log(`\n[OK] .env 已更新 SBT_CONTRACT_ADDRESS=${deployedAddress}`);
}

main().catch((err) => {
  console.error('[ERROR] 部署失敗:', err.message);
  process.exit(1);
});
