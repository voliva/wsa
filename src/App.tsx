import { FC, useEffect, useRef, useState } from "react";
import {
  Program,
  initializeState,
  loadProgram,
  step,
  stepOut,
  stepOver,
} from "./whitespace/execute";
import { WhitespaceOp, parseWhitespaceProgram } from "./whitespace";
import { IO, callbackInput, callbackOutput } from "./whitespace/io";
import { Button } from "./Button";
import {
  compileAndExit,
  enableDebugExtensions,
  stringToLineStream,
} from "./wsa/wsa";

function App() {
  const [program, setProgram] = useState<Program | null>(null);

  if (!program) {
    return <ProgramLoader onSubmit={(v) => setProgram(loadProgram(v))} />;
  }

  return <ProgramRunner program={program} />;
}

const ProgramLoader: FC<{
  onSubmit: (instructions: WhitespaceOp[]) => void;
}> = ({ onSubmit }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const loadASM = async () => {
    const stringValue = ref.current!.value;
    enableDebugExtensions();

    if (stringValue.includes("[LF]")) {
      onSubmit(
        parseWhitespaceProgram(
          stringValue
            .replaceAll("\n", "")
            .replaceAll(" ", "")
            .replaceAll("\t", "")
            .replaceAll("[LF]", "\n")
            .replaceAll("[Space]", " ")
            .replaceAll("[Tab]", "\t")
        )
      );
    } else {
      onSubmit(
        parseWhitespaceProgram(
          await compileAndExit(stringToLineStream(ref.current!.value), () => {
            throw new Error("Can't import other files");
          })
        )
      );
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        placeholder="Put your program here..."
        ref={ref}
        className="w-full max-w-2xl self-center border rounded p-2 min-h-36"
      />
      <div className="flex justify-center gap-2">
        <Button
          onClick={() => onSubmit(parseWhitespaceProgram(ref.current!.value))}
        >
          Load WS
        </Button>
        <Button onClick={loadASM}>Load ASM</Button>
      </div>
    </div>
  );
};

const useIo = () => {
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

const useDebounce = <T extends unknown[]>(
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
    // const now = Date.now();
    // if (timer.current.lastCall + ms <= now) {
    timer.current.timeout = null;
    fn(...timer.current.lastArgs);
    // } else {
    //   timer.current.timeout = setTimeout(
    //     onTimeout,
    //     timer.current.lastCall + ms + 5 - now
    //   );
    // }
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

const ProgramRunner: FC<{ program: Program }> = ({ program }) => {
  const [state, setState] = useState(initializeState());
  const { inputQueue, inputRequested, output, io, setInputQueue, restartIo } =
    useIo();

  const debounceSetState = useDebounce(setState, 100);
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

const Instructions: FC<{ program: Program; pc: number }> = ({
  program,
  pc,
}) => {
  const [breakpoints, setBreakpoints] = useState(program.breakpoints);
  const toggleBreakpoint = (line: number) => {
    setBreakpoints((old) => {
      const newValue = new Set(old);
      if (newValue.has(line)) {
        newValue.delete(line);
      } else {
        newValue.add(line);
      }
      // Megahack, don't do this in your job or you'll get fired :)
      program.breakpoints = newValue;

      return newValue;
    });
  };

  const instrToString = (instr: WhitespaceOp) => {
    const values: string[] = [instr.op.type];
    if ("value" in instr.op) {
      values.push(String(instr.op.value));
    }
    return values.join(" ");
  };

  const olRef = useRef<HTMLOListElement | null>(null);
  useEffect(() => {
    const element = olRef.current?.childNodes[pc] as HTMLElement;
    element?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [pc]);

  return (
    <ol className="flex-shrink-0 overflow-auto" ref={olRef}>
      {program.instructions.map((instr, idx) => (
        <li
          key={idx}
          className={idx === pc ? "bg-red-300 px-1 rounded" : "px-1"}
        >
          <input
            type="checkbox"
            checked={breakpoints.has(idx)}
            onChange={() => toggleBreakpoint(idx)}
          />{" "}
          {instrToString(instr)}
        </li>
      ))}
    </ol>
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

export default App;
