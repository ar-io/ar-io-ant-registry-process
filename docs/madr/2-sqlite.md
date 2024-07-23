# Using aos-sqlite Module

- Status: proposed
- Deciders: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus]

## Context and Problem Statement

The `aos-sqlite` module is a WebAssembly (Wasm) binary in the Arweave (ao) ecosystem that extends the functionality of the standard `aos` Wasm binary module. The `aos` module includes an `Eval` handler that consumes Lua strings and uses the `load` method of Lua to execute them. The `aos-sqlite` module is compiled with `lua-sqlite3` from C to Wasm, providing additional SQLite functionality. Given that directly using tables has demonstrated scalability issues, the SQLite implementation offers a potential solution. However, due to its novelty in the ecosystem, there are concerns about its stability in larger products. Therefore, using it here for the ANT Registry provides a suitable environment seperate from other products to test its stability.

## Decision Drivers

The main drivers for this decision are:

- **Scalability**
  - The current method of using tables has scalability issues that SQLite can potentially address.
- **Performance**
  - Improved performance in handling larger datasets with SQLite.
- **Risk Management**
  - Mitigating risks in larger products by testing the module in a controlled environment first.
- **Ecosystem Integration**
  - Exploring new modules and their potential benefits within the ao ecosystem.

## Considered Options

### Option 1: Continue Using Existing Tables

- **Pros:**
  - Known and stable.
  - No need for additional testing or integration.
- **Cons:**
  - Demonstrated scalability issues.
  - Limited performance with larger datasets.
  - Lack of strictness on data types

### Option 2: Use aos-sqlite Module

- **Pros:**
  - Addresses scalability issues with direct table usage.
  - Potential for improved performance with larger datasets.
  - Maintained by core team of AO
- **Cons:**
  - New and relatively untested in the ecosystem.
  - Potential stability issues in larger products.

## Decision Outcome

It was decided to use the `aos-sqlite` module to address scalability issues in a controlled environment. This approach allows us to test its effectiveness and performance before considering wider adoption in larger products.

### Implementation Details

#### aos-sqlite Module

- **Functionality:** Extends the `aos` module with SQLite functionality, compiled with `lua-sqlite3` from C to Wasm.
- **Handler:** Includes an `Eval` handler that consumes Lua strings and executes them using the `load` method of Lua.

#### Testing and Scalability

- **Controlled Environment:** The module will be tested in a controlled environment to assess its scalability and performance.
- **Risk Mitigation:** By testing in a smaller scope, we aim to mitigate the risks associated with its novelty and potential instability in larger products.

### Positive Consequences

- **Scalability Improvements:** Potential solution to scalability issues with direct table usage.
- **Performance Benefits:** Improved performance handling larger datasets.
- **Future Integration:** Provides insights into the module's potential for wider adoption.

### Negative Consequences

- **Stability Concerns:** New module with potential stability issues in larger products.
- **Testing Effort:** Requires additional testing and monitoring to ensure reliability.

## Implementation Recommendations

- **Testing Framework:** Use a testing framework to evaluate the module's scalability and performance. ( eg with [AoLoader])
- **Monitoring:** Implement monitoring tools like grafana to track the module's performance, stability, and resource usage.

## Links

- [AOS-SQLITE][aos-sqlite Module Documentation]

[AoLoader]: (https://github.com/permaweb/ao/tree/main/loader)
[aos-sqlite Module Documentation]: (https://github.com/permaweb/aos-sqlite)
[ADR Template]: (https://adr.github.io/)
[Atticus]: (https://github.com/atticusofsparta)
[Dylan]: (https://github.com/dtfiedler)
[Ariel]: (https://github.com/arielmelendez)
[Phil]: (https://github.com/vilenarios)
