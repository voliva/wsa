import { Command } from "@commander-js/extra-typings";
import fs from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import readline from "readline";
import { parseWhitespaceProgram } from "./whitespace";
import { execute, loadProgram } from "./whitespace/execute";
import { callbackInput, callbackOutput } from "./whitespace/io";
import { LineStream } from "./wsa/loader";
import { compileAndExit, enableExtensions } from "./wsa/wsa";

const program = new Command();

program.name("wsa").description("Whitespace assembly and interpreter");

program
  .command("compile")
  .description("Compile assembly file into whitespace")
  .argument("<main>", "entry point file to compile")
  .argument("<output>", "output file to store the result")
  .option("--extensions", "use extension instructions")
  .action(async (main, output, options) => {
    if (options.extensions) {
      enableExtensions();
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
        .replaceAll(" ", "")
        .replaceAll("\t", "")
        .replaceAll("[LF]", "\n")
        .replaceAll("[Space]", " ")
        .replaceAll("[Tab]", "\t");
    }

    await execute(loadProgram(parseWhitespaceProgram(program)), {
      input: callbackInput(() => {
        return new Promise<string>((resolve) =>
          process.stdin.once("data", (v) => {
            const value = v.toString();
            if (value === "\r\n" || value === "\n") {
              resolve("\n");
            }
            resolve(value.replace(/\r?\n$/, ""));
          })
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
