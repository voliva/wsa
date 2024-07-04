import { FC, useEffect, useRef, useState } from "react";
import { WhitespaceOp } from "../whitespace";
import { Program } from "../whitespace/execute";

export const Instructions: FC<{ program: Program; pc: number }> = ({
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
