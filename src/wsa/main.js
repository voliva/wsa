#!/usr/bin/env node

import fs from "fs";
import { compileAndExit } from "./wsa.js";

if (!process.argv[2]) {
  console.log("needs file argument");
  process.exit(1);
}

const withAnnotations = false;
compileAndExit(fs.createReadStream(process.argv[2]), (file) =>
  fs.createReadStream(file)
).then((res) => {
  if (withAnnotations) {
    process.stdout.write(
      res.replaceAll("\n", "L\n").replaceAll("\t", "T\t").replaceAll(" ", "S ")
    );
  } else {
    process.stdout.write(res);
  }
});
