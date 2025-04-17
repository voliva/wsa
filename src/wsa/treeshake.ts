import { Instruction } from "./loader";

interface Block {
  youSonOfABImIn: boolean;
  instructions: Instruction[];
  adj: Block[];
}

export function treeshake(program: Instruction[]) {
  const orderedBlocks: Block[] = [];
  const blockMap: Record<string, Block> = {};

  let currentBlock: Block = {
    youSonOfABImIn: false,
    instructions: [],
    adj: [],
  };
  const main = currentBlock;
  orderedBlocks.push(currentBlock);
  for (const instr of program) {
    const [op, ...args] = instr.tokens;
    if (op.type !== "word") {
      currentBlock.instructions.push(instr);
      continue;
    }
    // label creates a new block that's connected
    // jump/ret connects the block to the label, and creates a new block that's disconnected
    // jump*/call connects the block to the label, and continues with the current block
    const opcode = op.value.toLowerCase();
    if (opcode === "label") {
      const label = String(args[0].value);
      const newBlock = (blockMap[label] = blockMap[label] ?? {
        youSonOfABImIn: false,
        instructions: [],
        adj: [],
      });
      orderedBlocks.push(newBlock);

      newBlock.instructions = [instr];
      currentBlock.adj.push(newBlock);
      currentBlock = newBlock;
    } else if (opcode.startsWith("jump") || opcode === "call") {
      const label = String(args[0].value);
      const newBlock = (blockMap[label] = blockMap[label] ?? {
        youSonOfABImIn: false,
        instructions: [],
        adj: [],
      });
      currentBlock.instructions.push(instr);
      currentBlock.adj.push(newBlock);

      if (opcode === "jump") {
        currentBlock = {
          youSonOfABImIn: false,
          instructions: [],
          adj: [],
        };
        orderedBlocks.push(currentBlock);
      }
    } else if (opcode === "ret") {
      currentBlock.instructions.push(instr);
      currentBlock = {
        youSonOfABImIn: false,
        instructions: [],
        adj: [],
      };
      orderedBlocks.push(currentBlock);
    } else {
      currentBlock.instructions.push(instr);
    }
  }

  const blocksToBeMarked = [main];
  while (blocksToBeMarked.length) {
    const block = blocksToBeMarked.pop()!;
    if (block.youSonOfABImIn) continue;
    block.youSonOfABImIn = true;
    block.adj.forEach((b) => blocksToBeMarked.push(b));
  }

  // return all instructions from the blocks that are in
  return orderedBlocks.flatMap((b) => (b.youSonOfABImIn ? b.instructions : []));
}
