// Debug utility to track balance calls
class BalanceCallTracker {
  private static instance: BalanceCallTracker;
  private callCounts = new Map<string, number>();
  private recentCalls: Array<{
    timestamp: number;
    contract: string;
    address: string;
    component: string;
  }> = [];

  static getInstance(): BalanceCallTracker {
    if (!BalanceCallTracker.instance) {
      BalanceCallTracker.instance = new BalanceCallTracker();
    }
    return BalanceCallTracker.instance;
  }

  trackCall(contract: string, address: string, component: string) {
    const key = `${component}:${contract}:${address}`;
    this.callCounts.set(key, (this.callCounts.get(key) || 0) + 1);

    this.recentCalls.push({
      timestamp: Date.now(),
      contract,
      address,
      component,
    });

    // Keep only last 100 calls to prevent memory issues
    if (this.recentCalls.length > 100) {
      this.recentCalls = this.recentCalls.slice(-100);
    }

    // Log frequent callers
    const count = this.callCounts.get(key) || 0;
    if (count % 10 === 0) {
      // Log every 10th call
      console.warn(
        `🚨 FREQUENT CALLER: ${component} has made ${count} calls to balanceOf(${address}) on ${contract}`
      );
    }
  }

  getStats() {
    const now = Date.now();
    const last5Min = this.recentCalls.filter(
      (call) => now - call.timestamp < 5 * 60 * 1000
    );
    const last1Min = this.recentCalls.filter(
      (call) => now - call.timestamp < 60 * 1000
    );

    const componentCounts = new Map<string, number>();
    last5Min.forEach((call) => {
      componentCounts.set(
        call.component,
        (componentCounts.get(call.component) || 0) + 1
      );
    });

    console.log("📊 Balance Call Stats (Last 5 minutes):");
    console.log(`Total calls: ${last5Min.length}`);
    console.log(`Calls per minute: ${(last5Min.length / 5).toFixed(1)}`);
    console.log(`Last minute: ${last1Min.length} calls`);
    console.log("By component:", Object.fromEntries(componentCounts));

    return {
      total5Min: last5Min.length,
      total1Min: last1Min.length,
      byComponent: Object.fromEntries(componentCounts),
    };
  }

  startPeriodicLogging() {
    setInterval(() => {
      this.getStats();
    }, 60000); // Log every minute
  }
}

export const balanceCallTracker = BalanceCallTracker.getInstance();

// Start periodic logging in browser
if (typeof window !== "undefined") {
  balanceCallTracker.startPeriodicLogging();
}
