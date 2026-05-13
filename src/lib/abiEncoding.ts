import { encodeFunctionData, parseAbi, type Hex } from "viem";

type Address = `0x${string}`;

const claimRewardsAbi = parseAbi(["function claimRewards(address token)"]);
const approveAbi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
]);
const superTokenSendAbi = parseAbi([
  "function send(address recipient, uint256 amount, bytes userData)",
]);
const connectPoolAbi = parseAbi([
  "function connectPool(address pool, bytes userData) returns (bool)",
]);
const unstakeAbi = parseAbi(["function unstake(address to, uint256 amount)"]);
const zapAbi = parseAbi([
  "function zap(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
  "function zapETHx(address tokenOut, uint256 amountIn, uint256 amountOutMin, address stakingContract) payable returns (uint256)",
]);
const runMacroAbi = parseAbi([
  "function runMacro(address macro, bytes params)",
]);
const stakingRewardsFunderAbi = parseAbi([
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function withdrawAll()",
]);

export function encodeClaimRewardsData(token: Address): Hex {
  return encodeFunctionData({
    abi: claimRewardsAbi,
    functionName: "claimRewards",
    args: [token],
  });
}

export function encodeApproveData(spender: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: approveAbi,
    functionName: "approve",
    args: [spender, amount],
  });
}

export function encodeSuperTokenSendData(
  recipient: Address,
  amount: bigint,
  userData: Hex = "0x"
): Hex {
  return encodeFunctionData({
    abi: superTokenSendAbi,
    functionName: "send",
    args: [recipient, amount, userData],
  });
}

export function encodeConnectPoolData(pool: Address, userData: Hex = "0x"): Hex {
  return encodeFunctionData({
    abi: connectPoolAbi,
    functionName: "connectPool",
    args: [pool, userData],
  });
}

export function encodeUnstakeData(to: Address, amount: bigint): Hex {
  return encodeFunctionData({
    abi: unstakeAbi,
    functionName: "unstake",
    args: [to, amount],
  });
}

export function encodeZapData(
  functionName: "zap" | "zapETHx",
  tokenOut: Address,
  amountIn: bigint,
  amountOutMin: bigint,
  stakingContract: Address
): Hex {
  return encodeFunctionData({
    abi: zapAbi,
    functionName,
    args: [tokenOut, amountIn, amountOutMin, stakingContract],
  });
}

export function encodeRunMacroData(macro: Address, params: Hex): Hex {
  return encodeFunctionData({
    abi: runMacroAbi,
    functionName: "runMacro",
    args: [macro, params],
  });
}

export function encodeDepositData(amount: bigint): Hex {
  return encodeFunctionData({
    abi: stakingRewardsFunderAbi,
    functionName: "deposit",
    args: [amount],
  });
}

export function encodeWithdrawData(amount: bigint): Hex {
  return encodeFunctionData({
    abi: stakingRewardsFunderAbi,
    functionName: "withdraw",
    args: [amount],
  });
}

export function encodeWithdrawAllData(): Hex {
  return encodeFunctionData({
    abi: stakingRewardsFunderAbi,
    functionName: "withdrawAll",
    args: [],
  });
}
