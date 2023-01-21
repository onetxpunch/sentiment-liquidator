import { Contract, Wallet, constants, providers } from "ethers";

const wallet = Wallet.createRandom();
const provider = new providers.JsonRpcProvider("https://rpc.ankr.com/arbitrum");
const addr = "";
const abi = [];
const contract = new Contract(addr, abi, provider);

const hi = async () => {
  console.log("Hello world!");
};

await hi();

// 💝
