import { useState } from "react";
import { Program, loadProgram } from "../whitespace/execute";
import { ProgramLoader } from "./ProgramLoader";
import { ProgramRunner } from "./ProgramRunner";

function App() {
  const [program, setProgram] = useState<Program | null>(null);

  if (!program) {
    return <ProgramLoader onSubmit={(v) => setProgram(loadProgram(v))} />;
  }

  return <ProgramRunner program={program} />;
}

export default App;
