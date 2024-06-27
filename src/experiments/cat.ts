/* eslint-disable @typescript-eslint/no-explicit-any */
import { execute, loadProgram } from "../whitespace/execute.ts";
import { callbackOutput, staticInput } from "../whitespace/io.ts";
import { parseWhitespaceProgram } from "../whitespace/parse.ts";

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

const program = loadProgram(parseWhitespaceProgram(programStr));
console.log(program.instructions);

declare const process: any;

execute(program, {
  input: staticInput("asdf\nfdsa\nasdf\0"),
  output: callbackOutput((v) => process.stdout.write(v)),
});
