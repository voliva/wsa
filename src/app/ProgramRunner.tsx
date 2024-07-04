import { FC, useEffect, useRef, useState } from "react";
import { Button, useThrottle } from "../lib";
import {
  initializeState,
  Program,
  step,
  stepOut,
  stepOver,
} from "../whitespace/execute";
import { Instructions } from "./InstructionsView";
import { useIo } from "./useIo";

export const ProgramRunner: FC<{ program: Program }> = ({ program }) => {
  const [state, setState] = useState(initializeState());
  const { inputQueue, inputRequested, output, io, setInputQueue, restartIo } =
    useIo();

  const debounceSetState = useThrottle(setState, 100);
  const stopped = useRef(false);
  const [running, setRunning] = useState(false);
  async function run() {
    let lastBreath = Date.now();
    const breathe = () => {
      const now = Date.now();
      if (now - lastBreath > 30) {
        lastBreath = now;
        return new Promise((resolve) => setTimeout(resolve, 5));
      }
    };

    let stepState = state;
    stepState.paused = false;
    stopped.current = false;
    setRunning(true);
    while (!stepState.halted && !stepState.paused && !stopped.current) {
      stepState = await step(program, stepState, io);
      if (stopped.current) break;
      debounceSetState(stepState);
      await breathe();
    }
    setRunning(false);
  }

  async function doStepOver() {
    setState(await stepOver(program, state, io));
  }
  async function doStepIn() {
    setState(await step(program, state, io));
  }
  async function doStepOut() {
    setState(await stepOut(program, state, io));
  }
  function pause() {
    stopped.current = true;
  }
  function restart() {
    stopped.current = true;
    debounceSetState(initializeState());
    restartIo();
    setRunning(false);
  }

  useEffect(() => {
    const handleKeyboardEvt = (evt: KeyboardEvent) => {
      switch (evt.key) {
        case "c":
          return run();
        case "s":
          return doStepOver();
        case "i":
          return doStepIn();
        case "o":
          return doStepOut();
        case "p":
          return pause();
        case "r":
          return restart();
      }
    };
    document.addEventListener("keypress", handleKeyboardEvt);
    return () => document.removeEventListener("keypress", handleKeyboardEvt);
  });

  return (
    <div className="flex gap-2 overflow-hidden">
      <Instructions program={program} pc={state.pc} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex gap-2">
          {running ? (
            <Button onClick={pause}>
              <u>P</u>ause
            </Button>
          ) : (
            <Button onClick={run}>
              <u>C</u>ontinue
            </Button>
          )}
          <Button onClick={doStepOver} disabled={running}>
            <u>S</u>tep over
          </Button>
          <Button onClick={doStepIn} disabled={running}>
            Step <u>i</u>n
          </Button>
          <Button onClick={doStepOut} disabled={running}>
            Step <u>o</u>ut
          </Button>
          <Button onClick={restart}>
            <u>R</u>estart
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex flex-1 gap-2 min-h-48 overflow-hidden">
            <StackView stack={state.stack} />
            <HeapView heap={state.heap} />
          </div>
          <InputView
            value={inputQueue}
            requested={inputRequested}
            onChange={setInputQueue}
          />
          <OutputView value={output} />
        </div>
      </div>
    </div>
  );
};

const StackView: FC<{ stack: bigint[] }> = ({ stack }) => {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="font-bold border-b">Stack view</h2>
      <ol className="overflow-auto">
        {stack.map((value, idx) => (
          <li key={idx}>
            {idx}: {value.toString()}
          </li>
        ))}
      </ol>
    </div>
  );
};

const HeapView: FC<{ heap: bigint[] }> = ({ heap }) => {
  return (
    <div className="flex flex-col max-h-full  flex-1">
      <h2 className="font-bold border-b">Heap view</h2>
      <ol className="overflow-auto">
        {Object.entries(heap).map(([idx, value]) => (
          <li key={idx}>
            {idx}: {value.toString()}
          </li>
        ))}
      </ol>
    </div>
  );
};

const InputView: FC<{
  value: string;
  requested: boolean;
  onChange: (value: string) => void;
}> = ({ value, requested, onChange }) => (
  <div className="flex flex-col">
    <h2 className="font-bold border-b">Input view</h2>
    <textarea
      value={value}
      onChange={(evt) => onChange(evt.target.value)}
      className={requested ? "bg-red-300 p-1 max-h-48" : "p-1 max-h-48"}
    />
  </div>
);

const OutputView: FC<{ value: string }> = ({ value }) => {
  const ref = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    ref.current!.scroll({
      top: ref.current!.scrollHeight,
    });
  }, [value]);

  return (
    <div className="flex flex-col h-48 overflow-hidden">
      <h2 className="font-bold border-b">Output view</h2>
      <pre ref={ref} className="overflow-auto max-w-full">
        {value}
      </pre>
    </div>
  );
};
