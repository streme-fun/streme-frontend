import { useState, useEffect, useRef } from 'react';

interface UseStreamingNumberOptions {
  baseAmount: number;
  flowRatePerSecond: number;
  lastUpdateTime: number;
  updateInterval?: number; // Default 100ms
  pauseWhenHidden?: boolean; // Default true
  isMobileOptimized?: boolean; // Use less frequent updates on mobile
}

export function useStreamingNumber({
  baseAmount,
  flowRatePerSecond,
  lastUpdateTime,
  updateInterval = 200, // Increased default from 50ms to 200ms
  pauseWhenHidden = true,
  isMobileOptimized = false
}: UseStreamingNumberOptions) {
  const [streamedAmount, setStreamedAmount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    if (flowRatePerSecond <= 0) {
      setStreamedAmount(0);
      return;
    }

    // Use less frequent updates on mobile/mini-app for better performance
    const effectiveInterval = isMobileOptimized ? Math.max(updateInterval, 500) : updateInterval;

    const updateStreamed = () => {
      if (pauseWhenHidden && document.hidden) return;
      
      const elapsed = (Date.now() - lastUpdateTime) / 1000;
      const newStreamed = flowRatePerSecond * elapsed;
      setStreamedAmount(newStreamed);
    };

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(updateStreamed, effectiveInterval);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      } else {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(updateStreamed, effectiveInterval);
        }
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (pauseWhenHidden) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [flowRatePerSecond, lastUpdateTime, updateInterval, pauseWhenHidden, isMobileOptimized]);

  return baseAmount + streamedAmount;
}

// Alternative hook for reward counters that start from 0 and continuously increment
export function useRewardCounter(
  initialRewards: number,
  rewardsPerSecond: number,
  updateInterval: number = 50
) {
  const [currentRewards, setCurrentRewards] = useState(initialRewards);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    setCurrentRewards(initialRewards);
    startTimeRef.current = Date.now();
  }, [initialRewards]);

  useEffect(() => {
    if (rewardsPerSecond <= 0) return;

    const updateRewards = () => {
      if (document.hidden) return;
      
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const additionalRewards = rewardsPerSecond * elapsed;
      setCurrentRewards(initialRewards + additionalRewards);
    };

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(updateRewards, updateInterval);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      } else {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(updateRewards, updateInterval);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [initialRewards, rewardsPerSecond, updateInterval]);

  return currentRewards;
}