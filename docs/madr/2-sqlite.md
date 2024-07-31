# Using aos-sqlite to manage data registered in the ANT Registry Process

- Status: proposed
- Approvers: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus]

## Context and Problem Statement

The `aos-sqlite` module, is a WebAssembly (Wasm) binary in the Arweave (ao)
ecosystem, and extends the standard `aos` Wasm module. The `aos` module includes
an `Eval` handler that executes Lua strings using the `load` method of the
stdlib in Lua. The `aos-sqlite` module, compiled with `lua-sqlite3` from C to
Wasm, adds SQLite functionality.

Directly using Lua tables has shown a need for better tooling in manipulating
and searching data, making the SQLite implementation a potential solution.
However, its novelty raises concerns about reliability in larger products.

## Decision Drivers

The main drivers for this decision are:

- **Scalability**
  - The current method of using tables has scalability issues that SQLite can
    potentially address.
- **Performance**
  - Improved performance in handling larger datasets with SQLite.
- **Risk Management**
  - Mitigating risks in larger products by testing the module in a controlled
    environment first.
- **Ecosystem Integration**
  - Exploring new modules and their potential benefits within the ao ecosystem.

## Considered Options

### Option 1: Continue Using Existing Tables

- **Pros:**
  - Known and stable.
  - No need for additional testing or integration.
- **Cons:**
  - Demonstrated scalability issues when attempting to retrieve 150k records in
    ANT's.
  - Limited performance with larger datasets.
  - Lack of strictness on data types.

### Option 2: Use aos-sqlite Module

- **Pros:**
  - Addresses scalability issues with direct table usage.
  - Potential for improved performance with larger datasets.
  - Maintained by core team of AO
  - Additional flexibility in the ways we can store and query for data
- **Cons:**
  - New and relatively untested in the ecosystem.
  - Potential stability issues in larger products.

## Decision Outcome

It was decided to use the `aos-sqlite` module to address scalability issues in
the controlled environment of the ANT Registry, since it stands apart from other
mission critical products. This approach allows us to test its effectiveness and
performance before considering wider adoption in larger products.

### Positive Consequences

- **Scalability Improvements:** Potential solution to scalability issues with
  direct table usage.
- **Performance Benefits:** Improved performance handling larger datasets.
- **Future Integration:** Provides insights into the module's potential for
  wider adoption.

### Negative Consequences

- **Stability Concerns:** New module with potential stability issues in larger
  products.
- **Testing Effort:** Requires additional testing and monitoring to ensure
  reliability.

## Implementation Recommendations

- **Testing Framework:** Use a testing framework to evaluate the module's
  scalability and performance. ( eg with [AoLoader])
- **Monitoring:** Implement monitoring tools like grafana to track the module's
  performance, stability, and resource usage.

## Links

- [AOS-SQLITE][aos-sqlite Module Documentation]

[AoLoader]: (https://github.com/permaweb/ao/tree/main/loader)
[aos-sqlite Module Documentation]: (https://github.com/permaweb/aos-sqlite)
[ADR Template]: (https://adr.github.io/)
[Atticus]: (https://github.com/atticusofsparta)
[Dylan]: (https://github.com/dtfiedler)
[Ariel]: (https://github.com/arielmelendez)
[Phil]: (https://github.com/vilenarios)
