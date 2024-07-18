# Process on AO

This repository contains the source code to start building on AO and AOS quickly. Includes testing and ci/cd configurations. Testing and building is done in typescript, with the module code designed for eval again AOS-Lua ao modules.

## Setup

### Install

First install the npm dependencies

```bash
yarn
```

Then install the ao cli - read the docs [here](https://github.com/permaweb/ao/tree/main/dev-cli)
Below is latest version as of writing, refer to the docs for the latest version.

```sh
curl -L https://arweave.net/iVthglhSN7G9LuJSU_h5Wy_lcEa0RE4VQmrtoBMj7Bw | bash
```

You may need to follow the instructions in the cli to add the program to your PATH.

### Testing

To test the module, you can use the following command to run the testing suites that use AoLoader and node native testing (requires node 20+)

```sh
yarn test
```

### Building the AOS code

#### Build

This bundles the ant-aos code and outputs it to `dist` folder. This can then be used to send to the `Eval` method on AOS to load the ANT source code.

```bash
yarn aos:build
```

#### Publish

Ensure that in the `tools` directory you place you Arweave JWK as `key.json`

```bash
yarn aos:publish
```

#### Load

This will load an AOS module into the loader, followed by the bundled aos Lua file to verify that it is a valid build.

```bash
yarn aos:load
```

#### Spawn

this will spawn an aos process and load the bundled lua code into it.

```bash
yarn aos:spawn
```

This will deploy the bundled lua file to arweave as an L1 transaction, so your wallet will need AR to pay the gas.

### Building the custom module

Using the ao-dev-cli.

#### Build

This will compile the standalone ANT module to wasm, as a file named `process.wasm` and loads the module in [AO Loader](https://github.com/permaweb/ao/tree/main/loader) to validate the WASM program is valid.

```bash
yarn module:build
```

#### Publish

Publishes the custom ANT module to arweave - requires you placed your JWK in the `tools` directory. May require AR in the wallet to pay gas.

```sh
yarn module:publish
```

#### Load

Loads the module in [AO Loader](https://github.com/permaweb/ao/tree/main/loader) to validate the WASM program is valid.

```bash
yarn module:load
```

Requires `module:build` to have been called so that `process.wasm` exists.

#### Spawn

Spawns a process with the `process.wasm` file.

```bash
yarn module:spawn
```

## Handler Methods

For interacting with handlers please refer to the [AO Cookbook]

### Read Methods

#### `Info`

Retrieves the Name, Ticker, Total supply, Logo, Denomination, and Owner of the ANT.

| Tag Name | Type   | Pattern | Required | Description                       |
| -------- | ------ | ------- | -------- | --------------------------------- |
| Action   | string | "Info"  | true     | Action tag for triggering handler |

## Developers

### Requirements

- Lua 5.3 - [Download](https://www.lua.org/download.html)
- Luarocks - [Download](https://luarocks.org/)

### Lua Setup (MacOS)

1. Clone the repository and navigate to the project directory.
1. Install `lua`
   - `brew install lua@5.3`
1. Add the following to your `.zshrc` or `.bashrc` file:

   ```bash
   echo 'export LDFLAGS="-L/usr/local/opt/lua@5.3/lib"' >> ~/.zshrc
   echo 'export CPPFLAGS="-I/usr/local/opt/lua@5.3/include"' >> ~/.zshrc
   echo 'export PKG_CONFIG_PATH="/usr/local/opt/lua@5.3/lib/pkgconfig"' >> ~/.zshrc
   echo 'export PATH="/usr/local/opt/lua@5.3/bin:$PATH"' >> ~/.zshrc
   ```

1. Run `source ~/.zshrc` or `source ~/.bashrc` to apply the changes.
1. Run `lua -v` to verify the installation.

### aos

To load the module into the `aos` REPL, run the following command:

```sh
aos --load src/main.lua
```

### Code Formatting

The code is formatted using `stylua`. To install `stylua`, run the following command:

```sh
cargo install stylua
stylua contract
```

### Testing

To run the tests, execute the following command:

```sh
yarn test
```

# Additional Resources

- [AR.IO Gateways]
- [AO Cookbook]

[AR.IO Gateways]: https://ar.io/docs/gateway-network/#overview
[AO Cookbook]: https://cookbook_ao.arweave.dev
