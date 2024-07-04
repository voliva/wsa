# WSA

Whitespace interpreter and visualiser / debugger.

(Work in progress, proof of concept, side project, might not update in a while)

It also compiles a modified version of [Burghard's WSA](https://github.com/wspace/burghard-wsa)

## Machine details

Targeting compatibility with [Lazy wspace](https://github.com/thaliaarchi/lazy-wspace/), the following assumptions are in place:

- Each memory position can store up to a u128 number
- Memory is addressable within 32 bit, from 0 to 4_294_967_294

## Memory layout convention

The stdlib defined by this repo sets a couple of conventions to perform calls and manage the heap.

To start off, the default convention for calls is pass arguments through the stack, pushing them in the original order. The call will consume all of the arguments, removing them from the stack, and optionally it will push a value for the return value.

Strings, vectors, etc. Must be allocated in the heap, and are always passed by reference.

The heap is split in 2 pieces: A stack, used to store local variables, and a heap, where blocks can be allocated or freed.

The heap stack helps storing temporary values. Usually, the native stack will suffice, but it has a few disadvantages:

- It can only peek past values.
- It can't reorganise values.
- It's the only way of performing any operation.
- This makes the offset for peeking also not stable.

With the heap stack, each function can assume that their stack is empty, and then use as much space as they need with something that the offsets will remain stable while performing operations.

The memory layout is as follows:

- 0: Pointer to head of stack
- 1..: Stack
- 4_294_967_294: Pointer to first element of the heap, NIL if none

### Stack

The standard library on memory provides a few methods to deal with heap stack:

- `stack_freeze(n)`: Removes `n` from the native stack and pushes them onto the native stack, in the same order.
- `stack_restore(n)`: Removes `n` from the heap stack and pushes them onto the native stack, in the same order.
- `stack_discard(n)`: Removes `n` from the heap stack.
- `stack_get(offset)`: Gets the nth element from the stack (starting at 0).
- `stack_get_head()`: Sugar for `stack_get(0)`.
- `stack_set(offset, value)`: Sets the nth element of the stack (starting at 0) to `value`.

### Heap

The heap tries to stay as much to the end of the memory as possible. Each entry will have:

- +0: Next element in the heap (or NIL)
- +1: Length of element
- +2..: Data of element

The standard library on memory provides few methods to deal with heap:

- malloc(size): Creates a new block.
  - It will try to put it as close to the end of the memory as possible.
  - If no gaps are found, it will put it as the new first element.
  - If gaps are found, then it will get in between.
  - Returns pointer to start of data.
- mfree(data_pointer): Frees up a block.
  - It will update the linked list accordingly.
  - No need for the blocks to be double-linked, I can always search from the start.
- realloc(data_pointer, size): Reallocates a block.
  - Shrinking will not move it.
  - Expanding will try to not move it if possible.
  - If not, it will allocate a new block, move everything, and delete.
  - Returns pointer to start of data.
- memcpy(source, dest, size): Copies data from one side to the other.
  - Doesn't handle overlaps
- memset(dest, value, size): Sets all the values of block to `value`.

## Assembly language

It reusues [Burghard's WSA](https://github.com/wspace/burghard-wsa) as assembly language, but with a few modifications:

- Removes `pushs`, `ifoption`, `elseoption`, `endoption`, `elseifoption`, `debug_printstack`, `debug_printheap`
- Adds:
  - `copy n`: Copy the nth element from the stack to the top of the stack (operand added in whitespace v0.3)
  - `slide n`: Slide n ittems off the stack, keeping the top one (operand added in whitespace v0.3)
  - `storestr str`: Stores `str` in the heap using the address defined in the top of the stack (and consuming it).
  - `debugger`: Signals the interpreter to pause execution at that point.
- Modifies:
  - Strings (labels, string literals) don't need to be wrapped between ""
  - `retrive` renamed to `retrieve`.
  - `doub` renamed to `dup`.
  - `inc` renamed to `readc`.
  - `inn` renamed to `readn`.
