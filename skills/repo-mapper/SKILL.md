---
name: repo-mapper
description: Map the relevant parts of the repository before implementation. Use when the task spans multiple files, the architecture is unclear, or you need a concise change-surface map.
---

# Repo Mapper

1. Find entry points and directly affected modules.
2. Identify callers, callees, tests, configs, and scripts.
3. Note public interfaces, schemas, migrations, and environment dependencies.
4. Return a concise map of the change surface.