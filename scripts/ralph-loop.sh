#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=100
COMPLETION_PROMISE="ALL_FEATURES_COMPLETE"
MODEL="opencode/claude-opus-4-5"
OUTPUT_FILE="/tmp/globex-ralph-output-$$.txt"

usage() {
  cat << 'EOF'
Ralph Loop for Globex - External loop wrapper for OpenCode

USAGE:
  ./scripts/ralph-loop.sh [OPTIONS]

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 100)
  --model <model>         OpenCode model to use (default: opencode/claude-opus-4-5)
  -h, --help              Show this help message

DESCRIPTION:
  Runs the Globex Ralph loop by repeatedly invoking OpenCode with /globex-run.
  Each iteration starts with fresh context, reads state from files, implements
  ONE feature, commits, and exits. Loop continues until completion or max iterations.

COMPLETION:
  Loop stops when agent outputs: <promise>ALL_FEATURES_COMPLETE</promise>

EXAMPLES:
  ./scripts/ralph-loop.sh
  ./scripts/ralph-loop.sh --max-iterations 50
  ./scripts/ralph-loop.sh --model opencode/claude-sonnet-4

MONITORING:
  # Watch progress in another terminal:
  watch -n 5 'cat .globex/progress.md'

  # View iteration count:
  grep "^iteration:" .globex/state.json

STOPPING:
  Ctrl+C to stop the loop at any time.
  The codebase will be in a clean state (last commit).
EOF
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      usage
      exit 0
      ;;
    --max-iterations)
      if [[ -z "${2:-}" ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
        echo "Error: --max-iterations requires a positive integer" >&2
        exit 1
      fi
      MAX_ITERATIONS="$2"
      shift 2
      ;;
    --model)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --model requires a model name" >&2
        exit 1
      fi
      MODEL="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v opencode &> /dev/null; then
  echo "Error: opencode CLI not found. Install from https://opencode.ai" >&2
  exit 1
fi

if [[ ! -f ".globex/state.json" ]]; then
  echo "Error: .globex/state.json not found." >&2
  echo "Run /globex-init first to initialize the project." >&2
  exit 1
fi

CURRENT_PHASE=$(jq -r '.currentPhase' .globex/state.json)
if [[ "$CURRENT_PHASE" != "execute" ]]; then
  echo "Error: Current phase is '$CURRENT_PHASE', expected 'execute'." >&2
  echo "Complete research → plan → features phases first." >&2
  exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Globex Ralph Loop                                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Max iterations: $MAX_ITERATIONS"
echo "║  Model: $MODEL"
echo "║  Completion: <promise>$COMPLETION_PROMISE</promise>"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

ITERATION=1

cleanup() {
  rm -f "$OUTPUT_FILE"
  echo ""
  echo "Ralph loop stopped at iteration $ITERATION"
  echo "Codebase is in clean state (last commit)."
}
trap cleanup EXIT

while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
  echo "────────────────────────────────────────────────────────────"
  echo "🔄 Iteration $ITERATION / $MAX_ITERATIONS"
  echo "────────────────────────────────────────────────────────────"
  
  opencode run -m "$MODEL" "/globex-run" 2>&1 | tee "$OUTPUT_FILE"
  
  if grep -q "<promise>$COMPLETION_PROMISE</promise>" "$OUTPUT_FILE"; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "✅ Ralph loop complete!"
    echo "   Detected: <promise>$COMPLETION_PROMISE</promise>"
    echo "   Total iterations: $ITERATION"
    echo "════════════════════════════════════════════════════════════"
    exit 0
  fi
  
  ITERATION=$((ITERATION + 1))
  
  echo ""
  echo "Iteration complete. Starting fresh context in 3s..."
  sleep 3
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "⚠️  Max iterations ($MAX_ITERATIONS) reached."
echo "   Ralph loop stopped. Review .globex/progress.md for status."
echo "════════════════════════════════════════════════════════════"
exit 1
