# Working with AoLoader and WASM

# Common Errors

## WebAssembly Memory Limit Error

**Error Message:**

```sh
RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): maximum memory size (262144 pages) is larger than implementation limit (65536) @+5948)
    at abort (/Users/atticus/Documents/code/ar-io/ar-io-ant-registry-process/node_modules/@permaweb/ao-loader/dist/index.cjs:12071:19)
    at /Users/atticus/Documents/code/ar-io/ar-io-ant-registry-process/node_modules/@permaweb/ao-loader/dist/index.cjs:12132:13
```

**Solution:** Ensure that you are using the appropriate Node.js version. This
issue was resolved by switching to Node.js version 20.
