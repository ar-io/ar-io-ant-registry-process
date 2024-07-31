# An event driven ANT registration system in AO to optimize ANT listings by access role

- Status: accepted
- Approvers: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus], [Dylan], [Ariel], [Phil]

## Context and Problem Statement

Listing all ANTs registered to [ArNS] names and owned by a specific owner or
owners becomes more computationally expensive as more ArNS names are registered.
Additionally, it is difficult to find ANTs not registered to an registered ArNS
name using existing ecosystem tools (Graphql, Gateways, ao.link, etc.)

Ultimately, a permissionless and efficient data store of ANT ownership for
ArNS-affiliated client applications (e.g., Arconnect, arns.app, BazAR, etc.)
would improve the discoverability, extensibility, and usability of ANTs.

### Additional Background

The [IO/AO Network Process] is responsible for recording which ANTs are
registered to each ArNS name. It does not store or track additional information
about the owner of the ANT. This reduces the amount of state managed, providing
more concurrency in the operations in the overall name system's design, (e.g.
individual ANT's activities do not impact performance of the ArNS Process).

The downside of this separation is that listing all the ANTs for any owner is
computationally expensive. You need to retrieve every ArNS record and perform a
lookup of each associated ANT's owner, then filter the resulting owner map by
the owner(s) in question - an O(N) operation where N is the total number of
registered names. An additional downside is that unregistered (from an ArNS
perspective) ANTs that one owns are not discoverable via this expensive
algorithm.

### Why we use ANTs

We have ANTs instead of maintaining the metadata of ArNS name on the [IO/AO
Network Process] so that the permissionless state changes and interactions for
that metadata is seperated from the interactions and state changes of the [IO/AO
Network Process] itself.

## Decision Drivers

The main drivers for this decision revolve around:

- **Speed**
  - Uses fewer resources client-side.
- **Scalability**
  - We cannot load the entire ArNS ecosystem client-side if it grows.
- **Ecosystem Integrations**
  - Having this utility process solely for ANT contract indexing provides
    integration points for other applications and reduces our reliance on other
    teams/products (e.g., Bazar profile processes).
- **Maintainability**
  - Since we control the registry process, we can drive its maintenance.

## Considered Options

### Dedicated ANT Registry Process

A permissionless AO Process that maintains a registry of ANTs and their
respective ownership information.

- **Pros:**
  - Dedicated registry for ANTs.
  - Event-driven updates from ANTs.
  - Separate state and compute from the resolver process, thus preserving system
    concurrency while providing for better UX in the system.
  - **Can support permissionless registration, thus allowing us to pre-register
    every ANT we've previously created during our migration to AO AND allowing
    3rd party Processes to create and register ANTs on behalf of users.**
- **Cons:**
  - Additional maintenance required.
  - Permissionlessness may invite spamming or DOSing
  - Gas management requirements since the ANT Registry will have to send
    messages to ANT processes

### Polling-based ArNS Resolver

The ArNS Resolver is an AOS process that acts as an indexer for the entire ArNS
ecosystem - it tracks owner and controller relationship by maintaining a state
of all ANTs registered to ArNS names, thereby allowing efficient lookups of
relational data from a central process.

- **Pros:**
  - Capable of resolving records and ANTs.
- **Cons:**
  - **Does not resolve ANTs that are not registered.**
  - Complexity increases with integration of ANT updates.
  - Performs unnecessary work for ANTs that have not changed
  - **Potentially shoulders all the gas burden for fetching ANT information**

### Adding Ownership Info to the Network Process

This would entail updates to the Network Process, either to make it so the ANT
associated with an ArNS name can send it a state update (like the pattern the
[ANT Registry](#dedicated-ant-registry-process) implements) on role changes (eg
ANT is transferred or a controller is added to it), or removing said role
changes from happening on the ANT and applying those handlers to the Network
process to allow the owner of the domain to manage those fields directly on the
Network process.

- **Pros:**
  - Centralized control.
- **Cons:**
  - Increases complexity of the Network process.
  - **Reduces flexibility of ANT processes.**
  - **Massively increases computational load and process memory - i.e. reduction
    in system concurrency**

### Bazar Profile Processes and Profile Registry

[Bazar Profiles] are AOS processes that implement asset tracking and account abstraction,
whereby the profile itself owns the assets it is tracking, and the profile is owned
by the user. This allows for event driven portfolio management. The Profile Registry
is a similar organism to the ANT Registry, therein tracking existing profiles that
register themselves to at, allowing for profile discovery by user address.

- **Pros:**
  - Promising technology.
  - Future integration potential.
- **Cons:**
  - **Currently in rapid development.**
  - Managed by another team.
  - Complicates ownership resolution due to account abstraction.

## Decision Outcome

After weighing the pros and cons, it was decided to use an
[ANT registry](#dedicated-ant-registry-process).

### Positive Consequences

- Asset discovery will be optimized, allowing easy querying for users' assets,
  specifically ANT processes, which can then be used to retrieve owned domains
  from the network process.

### Negative Consequences

- Maintenance: It is another process for us to maintain, though it seems
  necessary.
- Future Redundancy: The problem this is solving may be solved in the future by
  more ecosystem-wide projects (e.g., Bazar profiles), making this redundant.

## Links

- [Bazar Profiles]

---

[AoConnect]: https://github.com/permaweb/ao/tree/main/connect
[Bazar Profiles]:
  https://github.com/permaweb/ao-permaweb/tree/main/services/profiles
[ADR Template]: https://adr.github.io/
[ArNS]: https://docs.ar.io/
[IO/AO Network Process]: https://github.com/ar-io/ar-io-network-process
[Atticus]: https://github.com/atticusofsparta
[Dylan]: https://github.com/dtfiedler
[Ariel]: https://github.com/arielmelendez
[Phil]: https://github.com/vilenarios
