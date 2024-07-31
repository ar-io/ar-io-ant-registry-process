# Provide a "Register" handler in the ANT Registry to provide for permissionless registration of previously undiscovered ANTs

- Status: proposed
- Approvers: [Dylan], [Ariel], [Phil]
- Date: 2024-07-22
- Authors: [Atticus], [Dylan]

## Context and Problem Statement

To enable the functionality of the ANT registry as outlined in the [Initial
ADR], new process handlers need to be defined and implemented. The main goal is to
ensure that the registry is always up to date and can efficiently handle ownership
queries and integrations with our current (and future) systems.

When originally conceived, it was decided that the ANT Registry would have two
handlers to process incoming callback messages from ANTs and to field requests
for information about an ANTs ACL.

The `State-Notice` handler would be triggered in response to a message
originating from the Registry itself to fetch an ANTs state asynchronously for
the purposes of updating its registration info. It was also conceived that ANTs
could be upgraded to "phone home" back to the registry any state updates that
could impact its registry state, although that it outside the scope of this ADR.

The `Access-Control-List` handler is intended to serve in a manner to a callable
function for other Processes or dry-runners to fetch the latest registry info
for all the ANTs that a provided address or list of addresses own(s) or
control(s). Casts could be replied to with an `Access-Control-List-Notice`
message, and in either case the ACLs could be returned as message results.

## Decision Drivers

The main drivers for this decision revolve around:

- **Efficiency**
  - Optimized lookups for process IDs and wallet addresses.
- **Scalability**
  - Ability to handle increasing numbers of ANTs and associated processes.
- **Maintainability**
  - Clear, modular handlers for different operations.
- **Security**
  - Consideration for preventing abuse and spam in the future.

## Considered Options

The `State-Notice` and `Access-Control-List` handlers are required for storing
the ANT owner, however the `Register` handler was discussed deeply to see if it
was necessary at all. The names were decided based on the ANT contracts

### With Register

- **Pros:**
  - Allows triggering other workflows by notifying the ANT with a
    `Register-Notice`
  - Can Register ANT's from other workflow without the ANT registering itself.
- **Cons:**
  - Increased complexity in management.
  - Higher initial development effort.

### Without Register

- **Pros:**
  - Less complex
- **Cons:**
  - Increased complexity in management.
  - Unable to index ANT's without the ANT itself sending the state to the
    registry, which could be added as a handler to ants, but uneccesary.

## Decision Outcome

It was decided to proceed with the `Register` handler with the caveat that it is
not necessarily required for ANT's to add their state to the registry and that
the `State-Notice` handler can still accept state to include the ANT.

### Initial Process Handlers

#### Register Handler

- **Permission:** Permissionless
- **Function:** Requires a Process-Id and sends a State message to the process
  ID. Responds with a Register-Notice to the caller if the process ID is valid.
  Returns Register-Notice-Failure if the process ID is invalid.
- **Notes:**
  - ANTs can call this themselves on initialization (or through the SDK after
    the process is created) - not in scope.
  - Preventing abuse (e.g., spamming with nonsense) is a future consideration -
    not in scope.

### Integration with IO ArNS Registry

**Function:** Update the handler to support process IDs. It can return the names
affiliated with the provided process IDs - not in scope.

### Positive Consequences

- Efficient querying of asset ownership and control.
- Modular handlers allow for easy updates and maintenance.
- Future-proofing for preventing abuse and spamming.

### Negative Consequences

- Initial development and integration effort.
- Future maintenance of additional handlers and updates to the ANT source code.

### Implementation Recommendations

- Use two indexes for process IDs and wallet addresses to ensure lookups are
  O(n).

### Links

---

- [Bazar Profiles](https://github.com/permaweb/ao-permaweb/tree/main/services/profiles)

---

[Initial ADR]: (1.md)
[ADR Template]: (https://adr.github.io/)
[Atticus]: (https://github.com/atticusofsparta)
[Dylan]: (https://github.com/dtfiedler)
[Ariel]: (https://github.com/arielmelendez)
[Phil]: (https://github.com/vilenarios)
