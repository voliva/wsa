import { Command } from "@commander-js/extra-typings";
import { LineStream, compileAndExit, enableDebugExtensions } from "./wsa/wsa";
import readline from "readline";
import fs from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import { execute, loadProgram } from "./whitespace/execute";
import { parseWhitespaceProgram } from "./whitespace";
import { callbackInput, callbackOutput } from "./whitespace/io";

const program = new Command();

program.name("wsa").description("Whitespace assembly and interpreter");

program
  .command("compile")
  .description("Compile assembly file into whitespace")
  .argument("<main>", "entry point file to compile")
  .argument("<output>", "output file to store the result")
  .option("--debugger", "include debugger symbols")
  .action(async (main, output, options) => {
    if (options.debugger) {
      enableDebugExtensions();
    }

    const result = await compileAndExit(
      getFileLineStream(main),
      getFileLineStream
    );
    await writeFile(output, result, "utf-8");

    console.log("success");
  });

program
  .command("run")
  .description("Run a whitespace program")
  .argument("<file>", "entry point file in whitespace")
  .option("--asm", "assemble before running")
  .action(async (file, options) => {
    let program = options.asm
      ? await compileAndExit(getFileLineStream(file), getFileLineStream)
      : await readFile(file, "utf-8");

    if (program.includes("[LF]")) {
      program = program
        .replaceAll("\n", "")
        .replaceAll("[LF]", "\n")
        .replaceAll("[Space]", " ")
        .replaceAll("[Tab]", "\t");
    }

    await execute(loadProgram(parseWhitespaceProgram(program)), {
      input: callbackInput(() => {
        return new Promise<string>((resolve) =>
          process.stdin.once("data", (v) => resolve(v.toString()))
        );
      }),
      output: callbackOutput((v) => process.stdout.write(v)),
    });

    process.exit(0);
  });

program.parse();

function getFileLineStream(filename: string): LineStream {
  return (onLine) => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream(filename),
    });
    lineReader.on("line", onLine);
    lineReader.on("close", () => onLine(null));

    return () => {
      lineReader.close();
    };
  };
}
