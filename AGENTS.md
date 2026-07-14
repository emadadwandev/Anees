# Repository engineering rules

## Dependency policy

- Use the latest stable release of every package or dependency when adding or upgrading it.
- Verify the published version and peer/runtime requirements before changing a dependency, and commit the lockfile with the manifest.
- Do not introduce beta, canary, nightly, or release-candidate packages unless the user explicitly approves that exception or the existing integration requires it and the exception is documented.
- Keep framework, runtime, and type-package versions compatible; never satisfy the rule by silently downgrading an existing integration.
