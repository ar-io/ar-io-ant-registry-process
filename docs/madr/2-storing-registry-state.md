# Storing ANT Registry State in AO Process

- Status: Approved
- Approvers: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus]

## Context and Problem Statement

There are multiple options for storing state in ao Lua processes, namely thru
the use of the Lua `table` primitive, and a special build called aos-sqlite
which exposes the lua-sqlite3 library for using in-memory databases.

Directly using Lua tables for complex data has shown a need for better tooling
in manipulating and searching data, making the SQLite implementation a potential
solution. However, its novelty raises concerns about reliability in larger
products.

## Decision Drivers

The main drivers for this decision are:

- **Scalability**
  - The storage mechanism should be computation and storage efficient for
    optimal resource usage and data fetching.
- **Performance**
  - Fast queries are desired.
- **Ecosystem Integration**
  - Exploring new modules and their potential benefits within the ao ecosystem.
- **Maintenance**
  - How many development cycles will be needed to maintain the solution.

## Considered Options

### Option 1: Using Lua Primitive Tables

- **Pros:**
  - Known and stable.
  - No need for additional testing or integration.
  - Zero overhead of maintaining a third party implementation (e.g. DB schemas)
- **Cons:**
  - Demonstrated scalability issues when attempting to retrieve 150k records in
    ANTs.
  - Limited performance with larger datasets, namely deeply nested tables.
  - Lack of strictness on data types.
  - Higher potential for developer error due to nuances of high order functions
    with lua tables

### Option 2: Use aos-sqlite Module

- **Pros:**
  - Addresses _compute_ scalability issues with direct table usage due to
    efficient querying built into sqlite
  - Potential for improved performance with larger and more complex datasets and
    schemas
  - Maintained by core team of AO.
  - Additional flexibility in the ways we can store and query for data.
- **Cons:**
  - New and relatively untested in the aspect of range of applications of it in
    the ecosystem.
  - Higher maintenance of the implementation.
  - additional overhead in setup
  - lack of tooling to manage migrations
  - lack of tooling around testing
  - Unable to offer memory efficiency because, being in-memory, does not page to
    disk.

## Decision Outcome

It was decided to use Lua tables for storing the state of the registry for the
following reasons:

- **In-Memory Limitation**: Given that in `aos`, everything is in-memory and we
  can't write to disk, we lose out on certain features of SQLite.
- **Overhead**: While SQLite provides some useful tooling, it introduces
  significant overhead. A simple data structure with Lua table primitives can
  implement the same state management with less complexity.
- **Storage vs. Compute**: SQLite bloats the size of the data in an effort to
  reduce the compute for accessing data. In `aos`, being in-memory, storage is
  at a premium, so computing values is preferred over storing them (to an
  extent).

### Positive Consequences

- **Resource Efficiency**: More efficient use of in-memory storage by computing
  values rather than storing them.

### Negative Consequences

- **Tooling Limitations**: Loss of some tooling that SQLite offers for data
  manipulation and querying (though again we don't need much of that tooling in
  the first place)

## Links

- [AoLoader]
- [aos-sqlite Module Documentation]

---

[AoLoader]: https://github.com/permaweb/ao/tree/main/loader
[aos-sqlite Module Documentation]: https://github.com/permaweb/aos-sqlite
[ADR Template]: https://adr.github.io/
[Atticus]: https://github.com/atticusofsparta
[Dylan]: https://github.com/dtfiedler
[Ariel]: https://github.com/arielmelendez
[Phil]: https://github.com/vilenarios
