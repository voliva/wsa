import { compileAndExit } from "./wsa.js";
import { readFile, readdir, writeFile } from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { spawn } from "child_process";
import { assert } from "console";
import { argv } from "process";

const filter = argv[2];

async function run_tests() {
  const files = await readdir("tests");
  const wsa_files = files.filter((file) => file.endsWith("wsa"));

  for (const file of wsa_files) {
    if (filter && !file.includes(filter)) {
      continue;
    }

    console.log("Running " + file);
    const filePath = path.join("tests", file);
    const compiled = await compileAndExit(
      createReadStream(filePath),
      createReadStream
    );
    await writeFile("/tmp/wsa_test.wspace", compiled, "utf-8");
    const expected = await readExpected(filePath);
    const compiler = spawn("./wspace", ["/tmp/wsa_test.wspace"]);
    const output = await new Promise((resolve) => {
      let result = "";
      compiler.stdout.on("data", (r) => {
        result += r.toString();
      });
      compiler.stdout.on("close", () => resolve(result));
    });
    assert(expected == output, expected, output);
  }

  console.log("done");
}
run_tests();

async function readExpected(file) {
  const contents = await readFile(file, "utf-8");
  const [, expectedContent] = contents.split(";EXPECTED\n");
  return expectedContent
    .split("\n")
    .filter((v) => v.length > 0)
    .map((v) => v.slice(1))
    .join("\n");
}
