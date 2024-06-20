# WSA

Whitespace Assembly

Implementation of a modified version of [Burghard's WSA](https://github.com/wspace/burghard-wsa)

## Machine details

Targeting compatibility with [Lazy wspace](https://github.com/thaliaarchi/lazy-wspace/), the following assumptions are in place:

- Each memory position can store up to a u128 number
- Memory is addressable within 32 bit, from 0 to 4_294_967_294

## Memory layout convention

As the language doesn't have a way of offsetting and/or peeking from the stack, we need a convention in order to pass multiple parameters and store locals, which will be what the standard library assumes that will be used.

We're calling "Native stack" and "Native heap" to the stack and heap provided by the language. The terms "Stack" and "Heap" without anything else, mean the "virtual" stack and heap respectively, which both will be hosted in the Native heap.

- Native stack is used for performing operations.
- Native heap is split into several parts:
    - 0: Pointer to head of stack
    - 1..: Stack
    - 4_294_967_294: Pointer to first element of the heap, NIL if none

Values in the heap are always 1 value = 1 argument. Strings, vectors, etc. Must be allocated in the heap, and are always passed by reference.

### Stack

vpush 1
vpush 2
call foo
pop

foo:
retrive 0
doub
retrive -1
swap
retrive -2
add
vpop
vpop
ret

; Option1:
; With local variables, I'll have to reserve them with `vpush` at the start, then offset everything accordingly. When making a call then it's the same as before. Disadvantage is that adding a local variable will have to shift all the offsets

; Option2:
; Use offsets for everything without vpush, but when doing a call:
retrive 0
doub
store +3 ; assuming we had locals on +1 and +2
add 3
store 0 ; move vstack to new offset
; up to here could be a new operator `vbackup 3`
vpush 1
vpush 2
call foo
pop
; vstack is now at moved root, which points to the original root.
retrive
store 0
; this could be abstracted as operator `vrestore`
; Keep using offsets as before.
; I'm thinking that it could be simpler. If we know we add 3 and then substract 3, we don't need to store these offsets into a new part. Just hardcode.
; Btw, this also means that adding a new local will have to shift all of these offsets. Oh well?

; vpush definition:
retrive 0
doub
push {v}
swap ; ??? maybe not, depends on store spec
store
add 1
store 0

; vpop definition:
retrive 0
sub 1
store 0

### Heap

The heap tries to stay as much to the end of the memory as possible. Each entry will have:
- +0: Next element in the heap (or NIL)
- +1: Length of element
- +2..: Data of element

The standard library on memory will provide few methods to deal with heap:
- malloc(size): Creates a new block.
    - It will try to put it as close to the end of the memory as possible.
    - If no gaps are found, it will put it as the new first element.
    - If gaps are found, then it will get in between.
    - Returns pointer to start of data.
- free(data_pointer): Frees up a block.
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
