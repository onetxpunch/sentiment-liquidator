import { ethers } from "ethers";
import riskEngineAbi from "./abi/risk-engine.json" assert { type: "json" };
import registryAbi from "./abi/registry.json" assert { type: "json" };
import accountManagerAbi from "./abi/account-manager.json" assert { type: "json" };
import accountAbi from "./abi/account.json" assert { type: "json" };
import erc20Abi from "./abi/erc20.json" assert { type: "json" };

const liquidatorAbi = [
  "function healthFactor(address account) public view returns (uint256)",
  "function liquidate(address account) public",
];
const wallet = ethers.Wallet.createRandom();
const provider = new ethers.providers.JsonRpcProvider(
  "https://rpc.ankr.com/arbitrum"
);

enum ContractNames {
  Liquidator = "liquidator",
  Registry = "registry",
  RiskEngine = "riskEngine",
}

interface ContractDetails {
  address: string;
  abi: any;
}

const contracts: Record<ContractNames, ContractDetails> = {
  liquidator: {
    address: "0x0",
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
    provider
  );
};

const liquidator = getContract(ContractNames.Liquidator);
const registry = getContract(ContractNames.Registry);
const riskEngine = getContract(ContractNames.RiskEngine);

// Get all registered accounts from the Registry
const fetchAllAccounts = async () => {
  console.log("Fetching all accounts...");
  return await registry.getAllAccounts();
};

// Get health factor for all accounts
const getAccountsHealth = async (
  accounts: string[]
): Promise<{ account: string; health: number }[]> => {
  return Promise.all(
    accounts.map(async (account) => {
      const health: number = await liquidator.healthFactor(account);
      return { account, health };
    })
  );
};

const liquidate = async (account: string) => {
  return await liquidator.liquidate(account);
};

const monitor = async (accounts: { account: string; health: number }[]) => {
  // Separate accounts according to health factors
  const highRisk = accounts.filter((account) => account.health < 0.4);
  const mediumRisk = accounts.filter(
    (account) => account.health >= 0.4 && account.health < 0.6
  );
  const lowRisk = accounts.filter((account) => account.health >= 0.6);
  console.log(`${highRisk.length} accounts in danger zone`);
  console.log(`${mediumRisk.length} medium risk accounts`);
  console.log(`${lowRisk.length} low risk accounts`);

  while (true) {
    // Liquidate accounts in danger zone
    // if (highRisk.length > 0) {
    //   console.log("Liquidating accounts in danger zone...");
    //   await Promise.all(highRisk.map((account) => liquidate(account.account)));
    // }
    // // Monitor accounts
    // const accountsHealth = await getAccountsHealth(accounts.map((a) => a.account));
    // const newHighRisk = accountsHealth.filter((account) => account.health < 0.4);
    // const newMediumRisk = accountsHealth.filter(
    //   (account) => account.health >= 0.4 && account.health < 0.6
    // );
    // const newLowRisk = accountsHealth.filter((account) => account.health >= 0.6);
    // // Wait 15 seconds
    // await new Promise((resolve) => setTimeout(resolve, 15000));
  }
};

const main = async () => {
  const accounts = await fetchAllAccounts();
  console.log(`${accounts.length} accounts found`);

  const accountsHealth = await getAccountsHealth(accounts);
  console.log(`Fetched ${accountsHealth.length} health factors`);

  console.log("Monitoring accounts health...");
  await monitor(accountsHealth);
};

await main();

// 💝
