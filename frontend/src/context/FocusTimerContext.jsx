import { createContext, useContext, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// FocusTimerContext
// Provides a globally-persistent 45-minute countdown timer that continues
// ticking regardless of which page is currently rendered.
// The Provider is mounted at the App root so unmounting sub-pages never
// clears the interval.
// ─────────────────────────────────────────────────────────────────────────────

const INITIAL_SECONDS = 45 * 60; // 2700 seconds

const FocusTimerContext = createContext(null);

export function FocusTimerProvider({ children }) {
  const [timeLeft, setTimeLeft] = useState(INITIAL_SECONDS);
  const [isActive, setIsActive] = useState(false);
  // Keep a stable ref to the interval so cleanup is always accurate even if
  // the effect closure captures a stale version.
  const intervalRef = useRef(null);

  // ── Core tick logic ────────────────────────────────────────────────────────
  // This effect ONLY depends on `isActive` so it never re-mounts the interval
  // when `timeLeft` changes (which would cause drift).
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished — stop automatically.
            setIsActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Not active — ensure any running interval is cleared immediately.
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on effect tear-down (e.g. React StrictMode double-invoke).
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive]);

  // ── Public API ─────────────────────────────────────────────────────────────
  const startTimer = () => {
    if (timeLeft > 0) setIsActive(true);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(INITIAL_SECONDS);
  };

  return (
    <FocusTimerContext.Provider
      value={{ timeLeft, isActive, startTimer, pauseTimer, resetTimer }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}

// ── Custom hook ────────────────────────────────────────────────────────────
export function useFocusTimer() {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) {
    throw new Error("useFocusTimer must be used inside a <FocusTimerProvider>");
  }
  return ctx;
}

export default FocusTimerContext;
