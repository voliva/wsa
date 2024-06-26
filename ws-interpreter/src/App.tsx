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

  return (
    <div>
      <textarea placeholder="Put your program here..." ref={ref} />
      <button
        type="button"
        onClick={() => onSubmit(parseWhitespaceProgram(ref.current!.value))}
      >
        Load
      </button>
    </div>
  );
};

const io: IO = {
  input: callbackInput(async () => window.prompt("Wants more input") ?? ""),
  output: callbackOutput(console.log),
};

const ProgramRunner: FC<{ program: Program }> = ({ program }) => {
  const [state, setState] = useState(initializeState());

  return (
    <div>
      <Instructions program={program} pc={state.pc} />
      <div>
        <div>
          <button
            type="button"
            onClick={async () => {
              // TODO granular updates, so we can see things moving
              setState(await runUntilPause(program, state, io));
            }}
          >
            Run
          </button>
          <button
            type="button"
            onClick={async () => {
              // TODO granular updates, so we can see things moving
              setState(await step(program, state, io));
            }}
          >
            Step
          </button>
        </div>
        <div>
          <StackView stack={state.stack} />
          <HeapView heap={state.heap} />
        </div>
      </div>
    </div>
  );
};

const Instructions: FC<{ program: Program; pc: number }> = ({
  program,
  pc,
}) => {
  return (
    <ol>
      {program.instructions.map((instr, idx) => (
        <li key={idx} className={idx === pc ? "active" : ""}>
          {`${instr.imp} ${instr.op.type} (${
            "value" in instr.op ? instr.op.value : ""
          })`}
        </li>
      ))}
    </ol>
  );
};

const StackView: FC<{ stack: bigint[] }> = ({ stack }) => {
  return (
    <ol>
      {stack.map((value, idx) => (
        <li key={idx}>{value.toString()}</li>
      ))}
    </ol>
  );
};
const HeapView: FC<{ heap: bigint[] }> = ({ heap }) => {
  return (
    <ol>
      {Object.entries(heap).map(([idx, value]) => (
        <li key={idx}>
          {idx}. {value.toString()}
        </li>
      ))}
    </ol>
  );
};

export default App;
