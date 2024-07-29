# Working with AoLoader and WASM

if you come across this error:

```sh
  RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): maximum memory size (262144 pages) is larger than implementation limit (65536) @+5948)
      at abort (/Users/atticus/Documents/code/ar-io/ar-io-ant-registry-process/node_modules/@permaweb/ao-loader/dist/index.cjs:12071:19)
      at /Users/atticus/Documents/code/ar-io/ar-io-ant-registry-process/node_modules/@permaweb/ao-loader/dist/index.cjs:12132:13
```

Ensure that you are using the appropriate node version. The above was fixed by
switching to node 20.
