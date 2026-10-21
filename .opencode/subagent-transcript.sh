#!/usr/bin/env bash
# Inspect opencode sessions, including subagent (child) sessions.
#
#   ./subagent-transcript.sh list              # recent sessions with parent + agent
#   ./subagent-transcript.sh children [id]     # child sessions of a session (default: newest)
#   ./subagent-transcript.sh show <sessionID>  # full transcript of one session
#
# Note: `opencode session list` / `opencode export` are broken in this
# opencode version (they read the legacy `session` table while live data
# lives in `session_v2` + `session_message`). We query the DB directly.

set -euo pipefail

CMD="${1:-list}"
SESSION_ID="${2:-}"

db() { opencode db "$1" --format json; }

case "$CMD" in
  list)
    db "select id, parent_id, agent, title, time_created from session_v2 order by time_created desc limit 25" \
      | jq -r '.[] | [(.id // ""), (.parent_id // "-"), (.agent // "-"), (.title // "(untitled)"), ((.time_created/1000)|strftime("%Y-%m-%d %H:%M"))] | @tsv' \
      | awk -F'\t' '{printf "%-28s parent=%-28s agent=%-10s %s  %s\n", $1, $2, $3, $5, $4}'
    ;;
  children)
    if [ -n "$SESSION_ID" ]; then
      WHERE="parent_id = '$SESSION_ID'"
    else
      WHERE="parent_id is not null"
    fi
    db "select id, parent_id, agent, title from session_v2 where $WHERE order by time_created desc limit 25" \
      | jq -r '.[] | "\(.id)\t\(.parent_id)\t\(.agent // "-")\t\(.title // "(untitled)")"' \
      | awk -F'\t' '{printf "%-28s parent=%-28s agent=%-10s %s\n", $1, $2, $3, $4}'
    ;;
  show)
    if [ -z "$SESSION_ID" ]; then
      echo "usage: $0 show <sessionID>" >&2
      exit 1
    fi
    db "select data from session_message where session_id = '$SESSION_ID' order by seq" \
      | jq -r '.[].data | fromjson' \
      | jq -r 'if .text then "USER: \(.text)"
               else (.content[]? |
                 if .type == "text" then "TEXT: \(.text)"
                 elif .type == "reasoning" then "REASONING: \(.text // "")"
                 elif .type == "tool" then "TOOL[\(.name // "?"): \(.state.status // "")] \(.state.input // {} | tostring | .[0:300])"
                 else empty end)
               end'
    ;;
  *)
    echo "usage: $0 {list|children [sessionID]|show <sessionID>}" >&2
    exit 1
    ;;
esac
