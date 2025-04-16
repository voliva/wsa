import { FC, useRef } from "react";
import { Button } from "../lib";
import { WhitespaceOp, parseWhitespaceProgram } from "../whitespace";
import { stringToLineStream } from "../wsa/loader";
import { compileAndExit, enableExtensions } from "../wsa/wsa";

export const ProgramLoader: FC<{
  onSubmit: (instructions: WhitespaceOp[]) => void;
}> = ({ onSubmit }) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const loadASM = async () => {
    const stringValue = ref.current!.value;
    enableExtensions();

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
