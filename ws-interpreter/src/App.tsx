import { FC, useRef, useState } from "react";
import {
  Program,
  initializeState,
  loadProgram,
  runUntilPause,
  step,
} from "./whitespace/execute";
import { WhitespaceOp, parseWhitespaceProgram } from "./whitespace";
import { IO, callbackInput, callbackOutput } from "./whitespace/io";
import { Button } from "./Button";

const programStr = `[LF][Space][Space][Space][LF]
[Space][Space][Space][Tab][LF]
[Tab][LF][Tab][Space]
[Space][Space][Space][Tab][LF]
[Tab][Tab][Tab]
[Tab][LF][Space][Space]
[Space][Space][Space][Tab][LF]
[Tab][Tab][Tab]
[LF][Tab][Space][Tab][LF]
[LF][Space][LF][Space][LF]
[LF][Space][Space][Tab][LF]
[LF][LF][LF]
`
  .replaceAll("\n", "")
  .replaceAll("[LF]", "\n")
  .replaceAll("[Space]", " ")
  .replaceAll("[Tab]", "\t");

function App() {
  const [program, setProgram] = useState<Program | null>(
    loadProgram(parseWhitespaceProgram(programStr))
  );

  if (!program) {
    return <ProgramLoader onSubmit={(v) => setProgram(loadProgram(v))} />;
  }

  return <ProgramRunner program={program} />;
}

const ProgramLoader: FC<{
  onSubmit: (instructions: WhitespaceOp[]) => void;
}> = ({ onSubmit }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        placeholder="Put your program here..."
        ref={ref}
        className="w-full max-w-2xl self-center border rounded p-2 min-h-36"
      />
      <Button
        className="self-center"
        onClick={() => onSubmit(parseWhitespaceProgram(ref.current!.value))}
      >
        Load
      </Button>
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
        console.log("request more", inputQueueRef.current);
        if (inputQueueRef.current.length) {
          const value = inputQueueRef.current.slice(0, 1);
          const newQueue = inputQueueRef.current.slice(1);
          inputQueueRef.current = newQueue;
          setInputQueue(newQueue);
          console.log("return", value);
          return value;
        }
        return new Promise<string>((resolve) =>
          setInputRequested(() => (v: string) => {
            console.log("resolved", v);
            resolve(v);
          })
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
      console.log("setQueue", value, inputRequested);
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
  };
};

const ProgramRunner: FC<{ program: Program }> = ({ program }) => {
  const [state, setState] = useState(initializeState());
  const { inputQueue, inputRequested, output, io, setInputQueue } = useIo();

  return (
    <div className="flex gap-2">
      <Instructions program={program} pc={state.pc} />
      <div className="flex flex-col flex-grow-[1]">
        <div className="flex gap-2">
          <Button
            onClick={async () => {
              // TODO granular updates, so we can see things moving
              setState(await runUntilPause(program, state, io));
            }}
          >
            Run
          </Button>
          <Button
            onClick={async () => setState(await step(program, state, io))}
          >
            Step
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <StackView stack={state.stack} />
          <HeapView heap={state.heap} />
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
  const instrToString = (instr: WhitespaceOp) => {
    const values: string[] = [instr.imp, instr.op.type];
    if ("value" in instr.op) {
      values.push(String(instr.op.value));
    }
    return values.join(" ");
  };

  return (
    <ol className="flex-1 flex-grow-[3]">
      {program.instructions.map((instr, idx) => (
        <li
          key={idx}
          className={idx === pc ? "bg-red-300 px-1 rounded" : "px-1"}
        >
          {idx}. {instrToString(instr)}
        </li>
      ))}
    </ol>
  );
};

const StackView: FC<{ stack: bigint[] }> = ({ stack }) => {
  return (
    <div className="flex flex-col h-32  overflow-auto">
      <h2 className="font-bold border-b">Stack view</h2>
      <ol>
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
    <div className="flex flex-col max-h-32 overflow-auto">
      <h2 className="font-bold border-b">Heap view</h2>
      <ol>
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
      className={requested ? "bg-red-300" : ""}
    />
  </div>
);

const OutputView: FC<{ value: string }> = ({ value }) => (
  <div className="flex flex-col max-h-32 overflow-auto">
    <h2 className="font-bold border-b">Output view</h2>
    <div>{value}</div>
  </div>
);

export default App;
