# Asset resolution by way of an ANT Registry

- Status: accepted
- Deciders: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus], [Dylan], [Ariel], [Phil]

## Context and Problem Statement

Performance of loading a user’s registered name is slow with the current method of loading all of the ArNS ecosystem (all ArNS names and ANTs registered to them). There is no way to quickly identify ownership of an ANT, let alone any AO process.

## Decision Drivers

The main drivers for this decision revolve around:

- **Speed**
  - Uses fewer resources client-side.
- **Scalability**
  - We cannot load the entire ArNS ecosystem client-side if it grows.
- **Ecosystem Integrations**
  - Having this utility process solely for ANT contract indexing provides integration points for other applications and reduces our reliance on other teams/products (e.g., Bazar profile processes).
- **Maintainability**
  - Since we control the registry process, we can drive its maintenance.

## Considered Options

### ANT Registry

- **Pros:**
  - Dedicated registry for ANTs.
  - Event-driven updates from ANTs.
  - Separate state and compute from the resolver process.
- **Cons:**
  - Additional maintenance required.

### ArNS Resolver

- **Pros:**
  - Capable of resolving records and ANTs.
- **Cons:**
  - Does not resolve ANTs that are not registered.
  - Complexity increases with integration of ANT updates.

### Adding Ownership Info to the Network Process

- **Pros:**
  - Centralized control.
- **Cons:**
  - Increases complexity of the Network process.
  - Reduces flexibility of ANT processes.

### Bazar Profile Processes and Profile Registry

- **Pros:**
  - Promising technology.
  - Future integration potential.
- **Cons:**
  - Currently in rapid development.
  - Managed by another team.
  - Complicates ownership resolution due to account abstraction.

## Decision Outcome

It was decided to use an ANT registry due to the following downsides of other avenues:

#### ArNS Resolver

The ArNS Resolver interacts with the Network contract and is capable of resolving the records as well as the ANTs; however, it does not resolve ANTs that are not registered, only those that are registered. The ANT registry can implement event-driven updates from ANTs while separating the state and compute from the resolver process.

#### Adding Ownership Info to the Network Process

Part of the point of using the ANT processes for ownership control is to keep the state separated from the Network process. Adding this to the Network process would add complexity and reduce the flexibility of ANTs.

#### Bazar Profile Processes and Profile Registry

This tech is promising but still quite young and in rapid development at the time of writing, in the hands of another team making the architectural decisions. The profile process workflow is also an account abstraction, complicating the ownership resolution. With the ANT Registry, we should still be able to integrate with the profile processes in the future (since profile processes are, in fact, the owner of their listed assets).

### Positive Consequences

- Asset discovery will be optimized, allowing easy querying for users' assets, specifically ANT processes, which can then be used to retrieve owned domains from the network process.

### Negative Consequences

- Maintenance: It is another process for us to maintain, though it seems necessary.
- Future Redundancy: The problem this is solving may be solved in the future by more ecosystem-wide projects (e.g., Bazar profiles), making this redundant.

## Links

- [Bazar Profiles](https://github.com/permaweb/ao-permaweb/tree/main/services/profiles)

---

[ADR Template]: (https://adr.github.io/)
[Atticus]: (https://github.com/atticusofsparta)
[Dylan]: (https://github.com/dtfiedler)
[Ariel]: (https://github.com/arielmelendez)
[Phil]: (https://github.com/vilenarios)
