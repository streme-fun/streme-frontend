import { useState, useEffect, useRef } from "react";

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
  updateInterval = 33, // ~30fps for smoother animations
  pauseWhenHidden = true,
  isMobileOptimized = false,
}: UseStreamingNumberOptions) {
  const [streamedAmount, setStreamedAmount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const rafRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(true);

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
        if (pauseWhenHidden && (document.hidden || !isVisibleRef.current)) {
          rafRef.current = requestAnimationFrame(updateWithRAF);
          return;
        }

        // Throttle updates to the desired interval
        if (timestamp - lastUpdateRef.current >= updateInterval) {
          const elapsed = (Date.now() - lastUpdateTime) / 1000;
          const newStreamed = flowRatePerSecond * elapsed;
          // Only update if the change is significant (avoids excessive renders)
          setStreamedAmount((prev) => {
            const diff = Math.abs(newStreamed - prev);
            return diff > 0.001 ? newStreamed : prev; // Lower threshold for smoother small number animations
          });
          lastUpdateRef.current = timestamp;
        }

        rafRef.current = requestAnimationFrame(updateWithRAF);
      };

      rafRef.current = requestAnimationFrame(updateWithRAF);
    } else {
      // Use setInterval for less frequent updates
      const effectiveInterval = isMobileOptimized
        ? Math.max(updateInterval, 500)
        : updateInterval;

      const updateStreamed = () => {
        if (pauseWhenHidden && (document.hidden || !isVisibleRef.current))
          return;

        const elapsed = (Date.now() - lastUpdateTime) / 1000;
        const newStreamed = flowRatePerSecond * elapsed;
        // Only update if the change is significant (avoids excessive renders)
        setStreamedAmount((prev) => {
          const diff = Math.abs(newStreamed - prev);
          return diff > 0.001 ? newStreamed : prev; // Lower threshold for smoother small number animations
        });
      };

      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(updateStreamed, effectiveInterval);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current) {
        // Sync when page becomes visible
        const elapsed = (Date.now() - lastUpdateTime) / 1000;
        const newStreamed = flowRatePerSecond * elapsed;
        setStreamedAmount(newStreamed);
      }
    };

    if (pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
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
      if (pauseWhenHidden) {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
      }
    };
  }, [
    flowRatePerSecond,
    lastUpdateTime,
    updateInterval,
    pauseWhenHidden,
    isMobileOptimized,
  ]);

  return baseAmount + streamedAmount;
}

// Alternative hook for reward counters that start from 0 and continuously increment
export function useRewardCounter(
  initialRewards: number,
  rewardsPerSecond: number,
  updateInterval: number = 150 // Balanced between performance and smoothness
) {
  const [currentRewards, setCurrentRewards] = useState(initialRewards);
  const startTimeRef = useRef(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isVisibleRef = useRef<boolean>(true);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Initialize intersection observer for performance
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      // Fallback for older browsers
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
        // If element becomes visible, sync the animation
        if (entry.isIntersecting) {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const additionalRewards = rewardsPerSecond * elapsed;
          setCurrentRewards(initialRewards + additionalRewards);
        }
      },
      { threshold: 0.1 }
    );

    // Find the closest element to observe (will be set by the component)
    const element = elementRef.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [initialRewards, rewardsPerSecond]);

  useEffect(() => {
    setCurrentRewards(initialRewards);
    startTimeRef.current = Date.now();
  }, [initialRewards]);

  useEffect(() => {
    if (rewardsPerSecond <= 0) return;

    // Always use setInterval for better performance - no RAF needed for counter displays
    const effectiveInterval = Math.max(updateInterval, 100); // Minimum 100ms for better smoothness

    const updateRewards = () => {
      // Skip updates if page is hidden or element is not visible
      if (document.hidden || !isVisibleRef.current) return;

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const additionalRewards = rewardsPerSecond * elapsed;
      const newRewards = initialRewards + additionalRewards;

      // Only update if the change is significant (avoids excessive renders)
      setCurrentRewards((prevRewards) => {
        const diff = Math.abs(newRewards - prevRewards);
        return diff > 0.001 ? newRewards : prevRewards; // Lower threshold for smoother small number animations
      });
    };

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(updateRewards, effectiveInterval);

    const handleVisibilityChange = () => {
      if (!document.hidden && isVisibleRef.current) {
        // Sync when page becomes visible
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const additionalRewards = rewardsPerSecond * elapsed;
        setCurrentRewards(initialRewards + additionalRewards);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialRewards, rewardsPerSecond, updateInterval]);

  return { currentRewards, elementRef };
}
