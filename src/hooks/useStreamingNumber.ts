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
  const rafRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (flowRatePerSecond <= 0) {
      setStreamedAmount(0);
      return;
    }

    // Use requestAnimationFrame for smooth animations
    const useRAF = updateInterval <= 100 && !isMobileOptimized;
    
    if (useRAF) {
      // Use requestAnimationFrame for smooth 60fps updates
      const updateWithRAF = (timestamp: number) => {
        if (pauseWhenHidden && document.hidden) {
          rafRef.current = requestAnimationFrame(updateWithRAF);
          return;
        }
        
        // Throttle updates to the desired interval
        if (timestamp - lastUpdateRef.current >= updateInterval) {
          const elapsed = (Date.now() - lastUpdateTime) / 1000;
          const newStreamed = flowRatePerSecond * elapsed;
          setStreamedAmount(newStreamed);
          lastUpdateRef.current = timestamp;
        }
        
        rafRef.current = requestAnimationFrame(updateWithRAF);
      };
      
      rafRef.current = requestAnimationFrame(updateWithRAF);
    } else {
      // Use setInterval for less frequent updates
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
    }

    const handleVisibilityChange = () => {
      // Visibility change is handled within the animation loops
    };

    if (pauseWhenHidden && !useRAF) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (pauseWhenHidden && !useRAF) {
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
  const rafRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    setCurrentRewards(initialRewards);
    startTimeRef.current = Date.now();
  }, [initialRewards]);

  useEffect(() => {
    if (rewardsPerSecond <= 0) return;

    // Use requestAnimationFrame for smooth animations when update interval is fast
    const useRAF = updateInterval <= 100;
    
    if (useRAF) {
      const updateWithRAF = (timestamp: number) => {
        if (document.hidden) {
          rafRef.current = requestAnimationFrame(updateWithRAF);
          return;
        }
        
        // Throttle updates to the desired interval
        if (timestamp - lastUpdateRef.current >= updateInterval) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const additionalRewards = rewardsPerSecond * elapsed;
          setCurrentRewards(initialRewards + additionalRewards);
          lastUpdateRef.current = timestamp;
        }
        
        rafRef.current = requestAnimationFrame(updateWithRAF);
      };
      
      rafRef.current = requestAnimationFrame(updateWithRAF);
    } else {
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
    }

    const handleVisibilityChange = () => {
      // Visibility change is handled within the animation loops
    };

    if (!useRAF) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (!useRAF) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [initialRewards, rewardsPerSecond, updateInterval]);

  return currentRewards;
}