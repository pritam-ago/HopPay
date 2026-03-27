// scripts/transferTokens.ts
import { ethers } from "ethers";

const RPC_URL = "https://testnet.evm.nodes.onflow.org";
const CONTRACT_ADDRESS = "0xd1Eb9CeAA265D4d2f13E4dDD815AA5fe7212fdA8";

// Address that has tokens (deployer/owner)
const SENDER_PRIVATE_KEY = "cfd4c7154cd0cf56c94d1327812ccb5fa8b9d024b97d649b304eb92b3434ac42";

// Address to send tokens to
const RECIPIENT_ADDRESS = "0xA37EDfF34e2f01Fee837e5baC232ec3009Da24b4";

// Amount to transfer
const AMOUNT_TO_TRANSFER = "100"; // 100 tokens

const contractABI = [
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

(async () => {
  try {
    console.log("🚀 Transferring tokens...");
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const senderWallet = new ethers.Wallet(SENDER_PRIVATE_KEY, provider);
    
    console.log(`Sender Address: ${senderWallet.address}`);
    
    const tokenContract = new ethers.Contract(
      CONTRACT_ADDRESS,
      contractABI,
      senderWallet
    );
    
    // Convert amount to wei
    const amountInWei = ethers.parseEther(AMOUNT_TO_TRANSFER);
    
    console.log(`\n📝 Transferring ${AMOUNT_TO_TRANSFER} tokens to ${RECIPIENT_ADDRESS}...`);
    
    const tx = await tokenContract.transfer(RECIPIENT_ADDRESS, amountInWei);
    console.log(`\n⏳ Transaction sent! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("\n✅ Tokens transferred successfully!");
    console.log(`Block Number: ${receipt.blockNumber}`);
    console.log(`\nView on explorer: https://evm-testnet.flowscan.io/tx/${tx.hash}`);
  } catch (error: any) {
    console.error("❌ Error transferring tokens:", error);
  }
})();