## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.

## Obsidian project memory

`knowledge-map/` is the Obsidian vault. Its Graphify-generated notes and `graph.canvas` are navigational/code context; `knowledge-map/Project memory.md` is the human-maintained durable memory. At the start of each task, read this short memory note, then use a focused Graphify query before browsing source for codebase questions (per the rules above). Prefer these compact references over re-reading broad files or conversation history.

When a task establishes durable context—such as a user preference, an architectural decision, a non-obvious constraint, an unresolved blocker, or a concrete next step—update `knowledge-map/Project memory.md` with a short, dated bullet and links to relevant notes. Do not copy transcripts, routine implementation details, secrets, or speculative assumptions. Keep it concise and replace stale entries instead of accumulating history. Refresh the generated Obsidian notes after a Graphify rebuild with `graphify export obsidian --graph graphify-out/graph.json --dir knowledge-map`; do not hand-edit generated notes.
