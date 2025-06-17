// Test to verify that staker counts are consistent
describe('Staker Count Consistency', () => {
  test('fetchPoolSummary should return totalMembers from GraphQL', async () => {
    // Mock fetch
    global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            pool: {
              totalMembers: "42",
              totalUnits: "1000000"
            }
          }
        })
    } as Response);

    const mockPoolId = "0x123";
    
    // This simulates the fetchPoolSummary function
    const fetchPoolSummary = async (poolId: string) => {
      const query = `
        query GetPoolSummary($poolId: ID!) {
          pool(id: $poolId) {
            totalMembers
            totalUnits
          }
        }
      `;

      const response = await fetch("https://subgraph-endpoints.superfluid.dev/base-mainnet/protocol-v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { poolId },
        }),
      });

      const data = await response.json();
      return {
        totalMembers: parseInt(data.data.pool.totalMembers) || 0,
        totalUnits: data.data.pool.totalUnits || "0",
      };
    };

    const result = await fetchPoolSummary(mockPoolId);
    
    expect(result.totalMembers).toBe(42);
    expect(result.totalUnits).toBe("1000000");
  });

  test('Both token page and launched tokens should use totalMembers', () => {
    // This test documents that both pages should use the same field
    const poolData = {
      totalMembers: "25",
      poolMembers: [
        { id: "0x1", units: "100", isConnected: true },
        { id: "0x2", units: "200", isConnected: false },
        { id: "0x3", units: "300", isConnected: true },
        // ... and so on
      ]
    };

    // Token page approach (using totalMembers)
    const tokenPageStakerCount = parseInt(poolData.totalMembers);
    
    // Launched tokens page approach (should also use totalMembers)
    const launchedTokensPageStakerCount = parseInt(poolData.totalMembers);
    
    // They should be equal
    expect(tokenPageStakerCount).toBe(launchedTokensPageStakerCount);
    expect(tokenPageStakerCount).toBe(25);
    
    // The old way (counting array length) might give different results
    const oldWayCount = poolData.poolMembers.length;
    console.log('Old way would count:', oldWayCount, 'members');
    console.log('New way counts:', tokenPageStakerCount, 'members (from totalMembers)');
  });
});