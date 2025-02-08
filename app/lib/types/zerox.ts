interface Source {
  name: string;
  proportion: string;
}

interface Order {
  type: number;
  source: string;
  makerToken: string;
  takerToken: string;
  makerAmount: string;
  takerAmount: string;
  fillData: Record<string, unknown>;
}

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
  buyTokenAddress: string;
  sellTokenAddress: string;
  buyAmount: string;
  sellAmount: string;
  sources: Source[];
  orders: Order[];
  allowanceTarget: string;
  permit2?: {
    type: "Permit2";
    hash: string;
    eip712: {
      types: Record<string, Array<{ name: string; type: string }>>;
      domain: {
        name: string;
        chainId: number;
        verifyingContract: string;
      };
      message: {
        permitted: {
          token: string;
          amount: string;
        };
        spender: string;
        nonce: string;
        deadline: string;
      };
      primaryType: string;
    };
  };
}
