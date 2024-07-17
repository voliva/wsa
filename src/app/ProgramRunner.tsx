import { FC, useEffect, useRef, useState } from "react";
import { Button, useThrottle } from "../lib";
import {
  initializeState,
  MachineState,
  Program,
  step,
  stepOut,
  stepOver,
} from "../whitespace/execute";
import { Instructions } from "./InstructionsView";
import { useIo } from "./useIo";
import { FlowOp } from "../whitespace";

export const ProgramRunner: FC<{ program: Program }> = ({ program }) => {
  const [state, setState] = useState(initializeState());
  const { inputQueue, inputRequested, output, io, setInputQueue, restartIo } =
    useIo();

  const debounceSetState = useThrottle(
    (state: MachineState) => setState({ ...state }),
    100
  );
  const stopped = useRef(false);
  const [running, setRunning] = useState(false);
  async function captureExceptions(fn: () => void | Promise<void>) {
    try {
      return await fn();
    } catch (ex) {
      console.error(ex);

      "\nException triggered\n".split("").forEach(io.output.char);
      if (ex instanceof Error) {
        ex.message.split("").forEach(io.output.char);
      }
    }
  }
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
    await captureExceptions(async () => {
      while (!stepState.halted && !stepState.paused && !stopped.current) {
        stepState = await step(program, stepState, io);
        if (stopped.current) break;
        debounceSetState(stepState);
        await breathe();
      }
    });
    setRunning(false);
  }

  function doStepOver() {
    captureExceptions(async () =>
      setState({
        ...(await stepOver(program, state, io)),
      })
    );
  }
  function doStepIn() {
    captureExceptions(async () =>
      setState({
        ...(await step(program, state, io)),
      })
    );
  }
  function doStepOut() {
    captureExceptions(async () =>
      setState({
        ...(await stepOut(program, state, io)),
      })
    );
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
          return running || run();
        case "s":
          return running || doStepOver();
        case "i":
          return running || doStepIn();
        case "o":
          return running || state.callStack.length === 0 || doStepOut();
        case "p":
          return !running || pause();
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
          <Button
            onClick={doStepOut}
            disabled={running || state.callStack.length === 0}
          >
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
          <CallStackView value={getCallStack(program, state)} />
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

function memoryValueToString(value: bigint) {
  if (value > 32n && value < 127n) {
    return (
      value.toString(16).padStart(3, "\u{00A0}") +
      " " +
      String.fromCharCode(Number(value))
    );
  }
  return value.toString(16);
}
const StackView: FC<{ stack: bigint[] }> = ({ stack }) => {
  return (
    <div className="flex flex-col flex-1">
      <h2 className="font-bold border-b">Stack view</h2>
      <ol className="overflow-auto font-mono whitespace-nowrap">
        {stack.map((value, idx) => (
          <li key={idx}>
            {idx}: {memoryValueToString(value)}
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
      <ol className="overflow-auto font-mono whitespace-nowrap">
        {Object.entries(heap).map(([idx, value]) => (
          <li key={idx}>
            {Number(idx).toString(16)}: {memoryValueToString(value)}
          </li>
        ))}
      </ol>
    </div>
  );
};

function getCallStack(program: Program, state: MachineState) {
  const callInstructions = state.callStack.map(
    (instr) => program.instructions[instr - 1]
  ) as FlowOp[];

  return callInstructions.map((v) => (v.op.type === "call" ? v.op.value : ""));
}
const CallStackView: FC<{ value: string[] }> = ({ value }) => {
  return (
    <div className="flex flex-col flex-0">
      <h2 className="font-bold border-b">Call stack</h2>
      <div className="whitespace-nowrap overflow-auto">
        {value.map((label, i) => (i == 0 ? "" : " > ") + label)}&nbsp;
      </div>
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
      onChange={(evt) => {
        onChange(evt.target.value);
      }}
      onKeyPress={(evt) => evt.stopPropagation()}
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
