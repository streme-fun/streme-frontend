export const REWARDS_PER_SECOND = 634.1958449;

async function fetchPoolData(poolId: string, stakingPool: string) {
  const query = `
    query MyQuery {
      pool(id: "${stakingPool}") {
        totalMembers
        flowRate
        token {
          id
          name
          symbol
          isListed
          createdAtBlockNumber
          createdAtTimestamp
        }
        totalUnits
      }
    }
  `;

  console.log(
    "Fetching pool data for token:",
    poolId,
    "staking pool:",
    stakingPool
  );
  try {
    const response = await fetch(
      "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      }
    );

    const data = await response.json();

    if (data.errors) {
      console.error("Subgraph errors:", data.errors);
      throw new Error("Subgraph query failed");
    }

    const poolData = data.data?.pool;
    if (!poolData) {
      console.error("No pool data found");
      throw new Error("No pool data found");
    }

    return poolData;
  } catch (error) {
    console.error("Error fetching pool data:", error);
    return {
      totalMembers: "0",
      flowRate: "0",
      token: {
        createdAtTimestamp: "0",
      },
      totalUnits: "0",
    };
  }
}

export async function calculateRewards(
  createdAt: string,
  poolId: string,
  stakingPool: string
) {
  const poolData = await fetchPoolData(poolId, stakingPool);
  const creationTimestamp = parseInt(poolData.token.createdAtTimestamp);
  const now = Math.floor(Date.now() / 1000);
  const secondsElapsed = now - creationTimestamp;

  return {
    totalStreamed: secondsElapsed * REWARDS_PER_SECOND,
    flowRate: REWARDS_PER_SECOND,
    totalStakers: parseInt(poolData.totalMembers),
    totalMembers: poolData.totalMembers,
  };
}
