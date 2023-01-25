import { BigNumber, ethers } from "ethers";
import riskEngineAbi from "./abi/risk-engine.json" assert { type: "json" };
import registryAbi from "./abi/registry.json" assert { type: "json" };
import liquidatorAbi from "./abi/liquidator.json" assert { type: "json" };
import { Contract, Provider } from "ethcall";

const IS_DEV = true;
const provider = new ethers.providers.JsonRpcProvider(
  IS_DEV ? "http://127.0.0.1:8545" : "https://rpc.ankr.com/arbitrum"
);
const wallet = ethers.Wallet.createRandom();
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
  bal: number;
  borrows: number;
}

// List of contract addresses and ABIs
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

const ethcallProvider = new Provider();
await ethcallProvider.init(provider);
const registryEthCall = new Contract(
  contracts.registry.address,
  contracts.registry.abi
);
const riskEngineEthCall = new Contract(
  contracts.riskEngine.address,
  contracts.riskEngine.abi
);

const liquidator = getContract(ContractNames.Liquidator);
const registry = getContract(ContractNames.Registry);
const riskEngine = getContract(ContractNames.RiskEngine);

const getAccount = async (index: number) => {
  try {
    return await registry.accounts(index);
  } catch (e: any) {
    // Throw error to retry on SERVER_ERROR
    if (e.error && e.error.code == "SERVER_ERROR") throw e;
    else {
      console.log("Error fetching account index", index);
      console.log(e); // Likely an out of bounds error, don't retry
      return undefined;
    }
  }
};

// Get all registered accounts from the Registry
const fetchAllAccounts = async () => {
  console.log("Fetching all accounts...");
  let accounts: string[] = [];
  const totalAccounts = 9907;
  const batchSize = 100; // Parallelize requests in batches
  for (let i = 0; i < totalAccounts; i += batchSize) {
    try {
      const arraySize =
        i + batchSize > totalAccounts ? totalAccounts - i : batchSize;
      const arr: Promise<string>[] = Array.from(Array(arraySize)).map((_, j) =>
        getAccount(i + j)
      );
      const res = await Promise.all(arr);
      console.log(`Fetched ${i + batchSize} accounts`);
      accounts = accounts.concat(res);
    } catch (e: any) {
      console.log(
        "Server error fetching accounts",
        i,
        i + batchSize,
        "Retrying..."
      );
      await wait(15); // Throttle requests
      i -= batchSize; // Retry batch
    }
  }
  return accounts;
  // return await registry.getAllAccounts();
};

// Calculate health factor for an account
const getHealthFactor = async (
  account: string
): Promise<{ health: number; bal: number; borrows: number }> => {
  if (!account) return { health: -1, bal: 0, borrows: 0 };
  try {
    const [balBn, borrowsBn]: BigNumber[] = await ethcallProvider.all([
      riskEngineEthCall.getBalance(account),
      riskEngineEthCall.getBorrows(account),
    ]);
    // Calculate health factor in gwei to prevent underflow
    const bal = Number(ethers.utils.formatUnits(balBn, "gwei"));
    const borrows = Number(ethers.utils.formatUnits(borrowsBn, "gwei"));
    if (borrowsBn.eq(0)) return { health: 100, bal, borrows };
    return { health: bal / borrows, bal, borrows };
  } catch (e: any) {
    // Throw error to retry on SERVER_ERROR
    if (e.error && e.error.code == "SERVER_ERROR") throw e;
    else {
      console.log("Error getting health factor", account);
      console.log(e);
    }
    return { health: -1, bal: 0, borrows: 0 };
  }
};

// Get health factor for all accounts
const getAccountsHealth = async (accounts: string[]): Promise<Account[]> => {
  console.log("Getting accounts health...");
  let healthFactors: { health: number; bal: number; borrows: number }[] = [];
  const batchSize = 50; // Parallelize requests in batches
  for (let i = 0; i < accounts.length; i += batchSize) {
    try {
      const arraySize =
        i + batchSize > accounts.length ? accounts.length - i : batchSize;
      const arr = Array.from(Array(arraySize)).map((_, j) =>
        getHealthFactor(accounts[i + j])
      );
      const res = await Promise.all(arr);
      console.log(`Fetched ${i + batchSize} health factors`);
      healthFactors = healthFactors.concat(res);
      await wait(1); // Throttle requests
    } catch (e: any) {
      console.log(
        "Server error fetching health",
        i,
        i + batchSize,
        "Retrying..."
      );
      await wait(15); // Throttle requests
      i -= batchSize; // Retry batch
    }
  }
  return healthFactors.map((health, i) => ({
    address: accounts[i],
    ...health,
  }));
};

// Attempt to liquidate an account
const liquidate = async (account: string) => {
  try {
    await liquidator.liquidate(account);
  } catch (e) {
    console.log("Error liquidating account: ", account, e);
  }
};

// Separate accounts according to health factors
const filterAccounts = (accounts: Account[]) => {
  const failed = accounts.filter((account) => account.health <= 0);
  let defaulted = accounts.filter(
    (account) => account.health > 0 && account.health <= 1.2
  );
  let highRisk = accounts.filter(
    (account) => account.health > 1.2 && account.health <= 1.21
  );
  let mediumRisk = accounts.filter(
    (account) => account.health > 1.21 && account.health <= 1.25
  );
  return { failed, defaulted, highRisk, mediumRisk };
};

const monitor = async (accounts: Account[]) => {
  // Separate accounts according to health factors
  let { failed, defaulted, highRisk, mediumRisk } = filterAccounts(accounts);
  console.log(
    `${defaulted.length} defaulted, ${highRisk.length} high risk, ${mediumRisk.length} medium risk, ${failed.length} failed`
  );

  // Permanent loop
  for (let i = 0; true; i++) {
    defaulted.map((account) => liquidate(account.address));
    const updatedAccounts = await getAccountsHealth(
      failed
        .concat(defaulted)
        .concat(highRisk)
        .concat(mediumRisk)
        .map((a) => a.address)
    );
    const filters = filterAccounts(updatedAccounts);
    failed = filters.failed;
    defaulted = filters.defaulted;
    highRisk = filters.highRisk;
    mediumRisk = filters.mediumRisk;
    console.log(
      `${defaulted.length} defaulted, ${highRisk.length} high risk, ${mediumRisk.length} medium risk, ${failed.length} failed`
    );
    await wait(10);
  }
};

const wait = (s: number) => {
  console.log("Waiting for", s, "seconds");
  return new Promise((resolve) => setTimeout(resolve, s * 1000));
};

const main = async () => {
  const accounts = await fetchAllAccounts();
  const accountsHealth = await getAccountsHealth(accounts);
  await monitor(accountsHealth);
};

await main();

// 💝
