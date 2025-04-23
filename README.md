# WSA

Whitespace interpreter and visualiser / debugger.

(Work in progress, proof of concept, side project, might not update in a while)

It also compiles a modified version of [Burghard's WSA](https://github.com/wspace/burghard-wsa)

## Machine details

Targeting compatibility with [Lazy wspace](https://github.com/thaliaarchi/lazy-wspace/), the following assumptions are in place:

- Each memory position can store up to a u128 number
- Memory is addressable within 32 bit, from 0 to 4_294_967_294
- Mod operation works as the original implementation in haskell (5%-3 = -1, -5%3 = 1)
- Supports up to whitespace 0.3 instructions (copy, slide)

## Memory layout convention

The stdlib defined by this repo sets a couple of conventions to perform calls and manage the heap.

To start off, the default convention for calls is pass arguments through the stack, pushing them in the original order. The call will consume all of the arguments, removing them from the stack, and it will push as many return values as defined for that function (0-infinite).

Strings, vectors, etc. Must be allocated in the heap, and are always passed by reference.

The heap is split in 2 pieces: A stack, used to store local variables, and a heap, where blocks can be allocated or freed.

The heap stack helps storing temporary values. Usually, the native stack will suffice, but it has a few disadvantages:

- It can only peek values below the stack pointer.
- It can't rearrange values except for the top 2 (`swap`).
- It's the only way of performing any operation (i.e. there are no registers).
- This makes the offset for peeking also not stable.

With the heap stack, each function can assume that their stack is empty, and then use as much space as they need with something that the offsets will remain stable while performing operations. There's a tradeoff with a small performance hit though, since reading and writing from the heap stack requires multiple operations.

The memory layout is as follows:

- 0: Pointer to head of stack
- 1..: Stack
- 4_294_967_294: Pointer to first element of the heap, NIL if none

### Stack

The standard library on memory provides a few methods to deal with heap stack:

- `stack_freeze(n)`: Removes `n` from the native stack and pushes them onto the native stack, in the same order.
- `stack_restore(n)`: Removes `n` from the heap stack and pushes them onto the native stack, in the same order.
- `stack_reserve(n)`: Moves the stack pointer `n` positions to the front.
- `stack_discard(n)`: Removes `n` from the heap stack.
- `stack_get(offset)`: Gets the nth element from the stack (starting at 0).
- `stack_get_head()`: Sugar for `stack_get(0)`.
- `stack_set(offset, value)`: Sets the nth element of the stack (starting at 0) to `value`.
- `stack_set_head(value)`: Sugar for `stack_get(0, value)`.

### Heap

The heap tries to stay as much to the end of the memory as possible. Each entry will have:

- +0: Next element in the heap (or NIL)
- +1: Length of element
- +2..: Data of element

The standard library on memory provides few methods to deal with heap:

- malloc(size): Creates a new block.
  - It will try to put it as close to the end of the memory as possible.
  - If no gaps are found, it will put it as the last block of the list.
  - If gaps are found, then it will get in between.
  - Returns pointer to start of data.
- mfree(data_pointer): Frees up a block.
  - It will update the linked list accordingly.
  - It will find the neighbouring blocks by traversing the block list from the start.
- realloc(data_pointer, size): Reallocates a block.
  - Shrinking will not move it.
  - Expanding will try to not move it if possible.
  - If not, it will allocate a new block, move everything, and delete.
  - Returns pointer to start of data.
- memcpy(source, dest, size): Copies data from one side to the other.
  - Doesn't handle overlaps (so it is the same behaviour as C's lib memcpy as opposed to memmove)
- memset(dest, value, size): Sets all the values of block to `value`.

## Assembly language

It's based on [Burghard's WSA](https://github.com/wspace/burghard-wsa) as assembly language, but with a few modifications:

- Removes `pushs`, `ifoption`, `elseoption`, `endoption`, `elseifoption`, `debug_printstack`, `debug_printheap`
- Adds:
  - `copy n`: Copy the nth element from the stack to the top of the stack (operation added in whitespace v0.3)
  - `slide n`: Slide n items off the stack, keeping the top one (operation added in whitespace v0.3)
  - `storestr str`: Stores `str` in the heap using the address defined in the top of the stack (and consuming it).
- Modifies:
  - Strings (labels, string literals) don't need to be wrapped between ""
  - `retrive` renamed to `retrieve`.
  - `doub` renamed to `dup`.
  - `inc` renamed to `readc`.
  - `inn` renamed to `readn`.

The compiler also performs tree shaking: it won't include unreachable parts of the code (unused labels).

## Extensions

While on debug mode, this interpreter adds some language extensions to debug or increase performance. For this, a few more operations are added, both to the assembler and the whitespace code ops:

- `dbg`: "LLS" Signals the interpreter to pause execution at that point.
- `and`: "TSLL" Performs the bitwise and operation of the top 2 values of the stack.
- `or`: "TSLS" Performs the bitwise or operation of the top 2 values of the stack.
- `not`: "TSLT" Performs the bitwise not operation to the top value of the stack.

As these are not whitespace standard, if the `--extensions` option is not enabled, the assembler will omit the `dbg` instruction and throw an Error for the bitwise operations.

## STD lib

This assembler has a few (WIP) std libraries with common operations. The ones dealing with the memory convention explained above can be imported with `include memory`.

The source of these libraries can be found in `src/wsa/lib`

### Memory

See [Memory layout convention](#memory-layout-convention)

### Bitwise

- `bitwise_and(a,b)`
- `bitwise_xor(a,b)`
- `bitwise_or(a,b)`
- `bitwise_not(a)`
- `bitwise_not_mod(a, m)`: Performs a bitwise not operation but only for the low `m` bits.
- `bitwise_mask(m)`: Creates a mask with `m` 1s (essentially 2^m-1)
- `bitwise_rotl(n,m,bits)`: Rotates the number `n`, `m` positions to the left, with a mask of `bits` bits.

This library uses the language extensions if they are enabled, otherwise uses the standard 0.3 WS opcodes.

### IO

- `prints(&s)`: Outputs the null-terminated string at address `s`.
- `printsln(&s)`: Outputs the null-terminated string at address `s`, with a `\n` at the end.
- `print_byte_hex(v)`: Prints the 8-bit value `v` as hex.
- `print_char_hex(v)`: Prints the 4-bit value `v` as hex.

### Math

- `math_exp_2(v)`: Performs the operation 2^v

### Memcontainer

Small data structure to have a stable reference on other data structures that can get reallocated.

It basically allocates 2 blocks: The container that can grow in size (and maybe reallocated), and a 1-byte one that just has the pointer to the container. This way the fixed one will keep the same reference across reallocations.

To get the actual address, just `retrieve` to read the pointer value.

- `memcontainer_new(capacity)`: Initializes a new container with an initial `capacity`
- `memcontainer_destroy(&container)`: Frees up the reference `&container`
- `memcontainer_get_capacity(&container)`: Returns the current capacity of the container.
- `memcontainer_ensure_capacity(&container, capacity)`: If the container has less than `capacity` capacity, it resizes it.

### Vector

Resizable data structure to add / remove items to a list. It keeps a stable reference through `memcontainer`.

- `vector_new(capacity)`: Creates a new vector
- `vector_destroy(&vector)`: Frees up the reference `&vector`
- `vector_fill(&vector, length, value)`: Fills in the vector with `value` for `length` (resizing the vector if needed).
- `vector_get_addr(&vector)`: Returns the current base address of the vector.
- `vector_get_capacity(&vector)`: Returns the capacity of the vector.
- `vector_get_length(&vector)`: Returns the length of the vector.
- `vector_set_length(&vector, length)`: Sets the length of the vector (truncating or resizing as needed).
- `vector_push(&vector, value)`: Pushes the value to the vector.
- `vector_pop(&vector)`: Pops the last element from the vector.
- `vector_slice(&vector, offset, length)`: Returns a new vector with a copy from offset for `length` bytes.
- `vector_splice(&vector, offset, length)`: Returns a new vector without the values from offset for `length` bytes.
- `vector_push_all(&vector, &other_vec)`: Pushes all the elements of `&other_vec` to `&vector`

### Slotmap

Data structure to allocate and free fixed-size blocks a bit more efficiently than through the heap. Meant to build other data structures on top that perform a lot of small allocations (e.g. trees, linked lists, etc.).

- `slotmap_new(element_size)`: Creates a new slotmap for elements of `element_size` bytes.
- `slotmap_destroy(&slotmap)`: Frees up the reference `&slotmap`.
- `slotmap_allocate(&slotmap)`: Allocates a new block, returns its id.
- `slotmap_free(&slotmap, id)`: Frees up the space for the block `id`.
- `slotmap_get_addr(&slotmap, id)`: Returns the base address for the block `id`.

### RBTree

Key-value data structure using a simplified implementation of a red-black tree. Deletion doesn't guarantee to keep the tree balanced.

- `rbtree_new()`: Creates a new RBTree-
- `rbtree_destroy(&RB)`: Frees up the reference `&RB`.
- `rbtree_insert(&RB, key, value)`: Inserts a new entry with `key` and `value`.
- `rbtree_get(&RB, key)`: Finds the entry by `key`, returns `[value,found]`, where found is 1 or 0 indicating if the value was found. If not found, `value` may have any random value.
- `rbtree_remove(&RB, key)`: Removes the entry by `key`.
- `rbtree_print(&RB)`: Prints the tree to the console (for debugging).
- `rbtree_get_sorted(&RB)`: returns the entries [key,value] into a vector, sorted by key ascending.
- `rbtree_is_empty(&RB)`: returns whether the tree is empty.
- `rbtree_get_smallest(&RB)`: returns the entry with smallest key.
- `rbtree_get_biggest(&RB)`: returns the entry with biggest key.
