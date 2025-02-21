import { Address, type Hex } from "viem";
import { TypedData, TypedDataDomain } from "abitype";

export interface EIP712TypedData {
  types: TypedData;
  domain: TypedDataDomain;
  message: {
    [key: string]: unknown;
  };
  primaryType: string;
}

// This interface is subject to change as the API V2 endpoints aren't finalized.
export interface PriceResponse {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  grossSellAmount: string;
  grossBuyAmount: string;
  allowanceTarget: Address;
  route: [];
  fees: {
    integratorFee: {
      amount: string;
      token: string;
      type: "volume" | "gas";
    } | null;
    zeroExFee: {
      billingType: "on-chain" | "off-chain";
      feeAmount: string;
      feeToken: Address;
      feeType: "volume" | "gas";
    };
    gasFee: null;
  } | null;
  gas: string;
  gasPrice: string;
  auxiliaryChainData?: {
    l1GasEstimate?: number;
  };
}

// This interface is subject to change as the API V2 endpoints aren't finalized.
export interface QuoteResponse {
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  estimatedGas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  buyAmount: string;
  sellAmount: string;
  sources: any[];
  buyTokenAddress: string;
  sellTokenAddress: string;
  allowanceTarget: string;
  permit2?: {
    type: string;
    hash: string;
    eip712: {
      types: Record<string, Array<{ name: string; type: string }>>;
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };
      message: any;
      primaryType: string;
    };
  };
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice?: string;
  };
  minBuyAmount: string;
  issues?: {
    allowance?: {
      actual: string;
      expected: string;
      spender: string;
    };
  };
  fees?: {
    zeroExFee?: {
      amount: string;
      token: string;
      type: string;
    };
  };
}

export interface V2QuoteTransaction {
  data: Hex;
  gas: string | null;
  gasPrice: string;
  to: Address;
  value: string;
}
