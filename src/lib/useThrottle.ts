import { useRef } from "react";

export const useThrottle = <T extends unknown[]>(
  fn: (...args: T) => void,
  ms: number
) => {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<{
    lastCall: number;
    lastArgs: T;
    timeout: number | null;
  }>({
    lastCall: 0,
    lastArgs: [] as unknown[] as T,
    timeout: null,
  });

  function onTimeout() {
    timer.current.timeout = null;
    fn(...timer.current.lastArgs);
  }

  return (...args: T) => {
    if (timer.current.timeout == null) {
      timer.current = {
        lastCall: Date.now(),
        lastArgs: args,
        timeout: setTimeout(onTimeout, ms + 5) as unknown as number,
      };
    } else {
      timer.current.lastCall = Date.now();
      timer.current.lastArgs = args;
    }
  };
};
