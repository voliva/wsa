import { useRef, useState } from "react";
import { callbackInput, callbackOutput, IO } from "../whitespace/io";

export const useIo = () => {
  const inputQueueRef = useRef("");
  const [inputQueue, setInputQueue] = useState("");
  const [inputRequested, setInputRequested] = useState<
    null | ((character: string) => void)
  >(null);
  const [output, setOutput] = useState("");

  const [io] = useState(
    (): IO => ({
      input: callbackInput(async () => {
        if (inputQueueRef.current.length) {
          const value = inputQueueRef.current.slice(0, 1);
          const newQueue = inputQueueRef.current.slice(1);
          inputQueueRef.current = newQueue;
          setInputQueue(newQueue);
          return value;
        }
        return new Promise<string>((resolve) =>
          setInputRequested(() => resolve)
        );
      }),
      output: callbackOutput((r) => setOutput((o) => o + r)),
    })
  );

  return {
    inputQueue,
    inputRequested: !!inputRequested,
    output,
    io,
    setInputQueue: (value: string) => {
      if (inputRequested) {
        const char = value.slice(0, 1);
        value = value.slice(1);
        setInputQueue(value);
        inputQueueRef.current = value;
        setInputRequested(null);
        inputRequested(char);
      } else {
        inputQueueRef.current = value;
        setInputQueue(value);
      }
    },
    restartIo: () => {
      setInputQueue("");
      setOutput("");
      inputQueueRef.current = "";
      setInputRequested(null);
    },
  };
};
