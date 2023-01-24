import { BigNumber, ethers } from "ethers";
import riskEngineAbi from "./abi/risk-engine.json" assert { type: "json" };
import registryAbi from "./abi/registry.json" assert { type: "json" };
import accountManagerAbi from "./abi/account-manager.json" assert { type: "json" };
import accountAbi from "./abi/account.json" assert { type: "json" };
import erc20Abi from "./abi/erc20.json" assert { type: "json" };
import liquidatorAbi from "./abi/liquidator.json" assert { type: "json" };

const IS_DEV = true;
const balanceToBorrowThreshold = ethers.utils.parseEther("1.2");
const wallet = ethers.Wallet.createRandom();
const provider = new ethers.providers.JsonRpcProvider(
  IS_DEV ? "http://127.0.0.1:8545" : "https://rpc.ankr.com/arbitrum"
);
wallet.connect(provider);

enum ContractNames {
  Liquidator = "liquidator",
  Registry = "registry",
  RiskEngine = "riskEngine",
}

interface ContractDetails {
  address: string;
  abi: any;
}

interface Account {
  address: string;
  health: number;
}

const contracts: Record<ContractNames, ContractDetails> = {
  liquidator: {
    address: IS_DEV ? "0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690" : "0x0",
    abi: liquidatorAbi,
  },
  registry: {
    address: "0x17b07cfbab33c0024040e7c299f8048f4a49679b",
    abi: registryAbi,
  },
  riskEngine: {
    address: "0xc0ac97a0ea320aa1e32e9ded16fb580ef3c078da",
    abi: riskEngineAbi,
  },
};

const getContract = (contract: ContractNames) => {
  return new ethers.Contract(
    contracts[contract].address,
    contracts[contract].abi,
    provider.getSigner()
  );
};

const liquidator = getContract(ContractNames.Liquidator);
const registry = getContract(ContractNames.Registry);
const riskEngine = getContract(ContractNames.RiskEngine);

// Get all registered accounts from the Registry
const fetchAllAccounts = async () => {
  console.log("Fetching all accounts...");
  let accounts: any[] = [];
  for (let i = 0; i < 100; i++) {
    console.log("Fetching account", i);
    accounts.push((await registry.accounts(i)) as any);
  }
  return accounts;
  // return await registry.getAllAccounts();
};

const getHealthFactor = async (account: string): Promise<number> => {
  const [balBn, borrowsBn]: BigNumber[] = await Promise.all([
    riskEngine.getBalance(account),
    riskEngine.getBorrows(account),
  ]);
  if (borrowsBn.eq(0)) return 2;

  const bal = Number(ethers.utils.formatEther(balBn));
  const borrows = Number(ethers.utils.formatEther(borrowsBn));
  console.log("got balance", bal);
  console.log("got borrows", borrows);
  return bal / borrows;
};

// Get health factor for all accounts
const getAccountsHealth = async (accounts: string[]) => {
  let accountsHealth: any[] = [];
  for (let account of accounts) {
    const healthBN = await getHealthFactor(account);
    console.log(healthBN.toString());
    const health = ethers.utils.formatEther(healthBN);
    accountsHealth.push({ address: account, health: Number(health) });
  }
};

const liquidate = async (account: string) => {
  return await liquidator.liquidate(account);
};

const monitor = async (accounts: Account[]) => {
  // Separate accounts according to health factors
  const highRisk = accounts.filter((account) => account.health < 1.4);
  const mediumRisk = accounts.filter(
    (account) => account.health >= 1.4 && account.health < 1.6
  );
  const lowRisk = accounts.filter((account) => account.health >= 1.6);
  console.log(`${highRisk.length} accounts in danger zone`);
  console.log(`${mediumRisk.length} medium risk accounts`);
  console.log(`${lowRisk.length} low risk accounts`);

  // while (true) {
  //   // Liquidate accounts in danger zone
  //   if (highRisk.length > 0) {
  //     console.log("Liquidating accounts in danger zone...");
  //     await Promise.all(highRisk.map((account) => liquidate(account.account)));
  //   }
  //   // Monitor accounts
  //   const accountsHealth = await getAccountsHealth(accounts.map((a) => a.account));
  //   const newHighRisk = accountsHealth.filter((account) => account.health < 0.4);
  //   const newMediumRisk = accountsHealth.filter(
  //     (account) => account.health >= 0.4 && account.health < 0.6
  //   );
  //   const newLowRisk = accountsHealth.filter((account) => account.health >= 0.6);
  //   // Wait 15 seconds
  //   await new Promise((resolve) => setTimeout(resolve, 15000));
  // }
};

const main = async () => {
  const accounts = await fetchAllAccounts();
  console.log(`${accounts.length} accounts found`);

  console.log("Getting accounts health...");
  const accountsHealth = await getAccountsHealth(accounts);
  // console.log(`Fetched ${accountsHealth.length} health factors`);

  console.log("Monitoring accounts health...");
  // await monitor(accountsHealth);
};

await main();

// 💝
