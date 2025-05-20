export const REWARDS_PER_SECOND = 634.1958449;

async function fetchPoolData(poolId: string, stakingPool: string, retries = 3) {
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

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(
        "https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.warn(
          `Subgraph errors (attempt ${attempt + 1}/${retries}):`,
          data.errors
        );
        if (attempt === retries - 1) {
          // On last attempt, return default values
          return {
            totalMembers: "0",
            flowRate: "0",
            token: {
              createdAtTimestamp: "0",
            },
            totalUnits: "0",
          };
        }
        // Otherwise, continue to next attempt
        continue;
      }

      const poolData = data.data?.pool;
      if (!poolData) {
        if (attempt === retries - 1) {
          return {
            totalMembers: "0",
            flowRate: "0",
            token: {
              createdAtTimestamp: "0",
            },
            totalUnits: "0",
          };
        }
        continue;
      }

      return poolData;
    } catch (error) {
      console.warn(
        `Error fetching pool data (attempt ${attempt + 1}/${retries}):`,
        error
      );
      if (attempt === retries - 1) {
        return {
          totalMembers: "0",
          flowRate: "0",
          token: {
            createdAtTimestamp: "0",
          },
          totalUnits: "0",
        };
      }
      // Add a small delay before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  // This should never be reached due to the return in the last retry attempt
  return {
    totalMembers: "0",
    flowRate: "0",
    token: {
      createdAtTimestamp: "0",
    },
    totalUnits: "0",
  };
}

export async function calculateRewards(
  createdAt: string,
  poolId: string,
  stakingPool: string
) {
  try {
    const poolData = await fetchPoolData(poolId, stakingPool);
    const creationTimestamp = parseInt(poolData.token.createdAtTimestamp);
    const now = Math.floor(Date.now() / 1000);
    const secondsElapsed = Math.max(0, now - creationTimestamp);

    return {
      totalStreamed: secondsElapsed * REWARDS_PER_SECOND,
      flowRate: REWARDS_PER_SECOND,
      totalStakers: parseInt(poolData.totalMembers) || 0,
      totalMembers: poolData.totalMembers || "0",
    };
  } catch (error) {
    console.error("Error calculating rewards:", error);
    return {
      totalStreamed: 0,
      flowRate: REWARDS_PER_SECOND,
      totalStakers: 0,
      totalMembers: "0",
    };
  }
}
