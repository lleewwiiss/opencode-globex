#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GLOBEX_DIR="$PROJECT_DIR/.globex"
LOG_FILE="$GLOBEX_DIR/ralph-loop.log"
MAX_ITERATIONS=100

# Read active project
if [[ ! -f "$GLOBEX_DIR/active-project" ]]; then
  echo "ERROR: No active project. Run /globex-init first." >&2
  exit 1
fi
ACTIVE_PROJECT=$(cat "$GLOBEX_DIR/active-project")
PROJECT_STATE_DIR="$GLOBEX_DIR/projects/$ACTIVE_PROJECT"
COMPLETION_PROMISE="ALL_FEATURES_COMPLETE"
MODEL="anthropic/claude-opus-4-5"
RALPH_OUTPUT="/tmp/globex-ralph-output-$$.txt"
WIGGUM_OUTPUT="/tmp/globex-wiggum-output-$$.txt"

usage() {
  cat << 'EOF'
Ralph Loop for Globex - Coach/Player Execution

USAGE:
  ./scripts/ralph-loop.sh [OPTIONS]

OPTIONS:
  --max-iterations <n>    Maximum iterations before auto-stop (default: 100)
  --model <model>         OpenCode model to use (default: opencode/claude-opus-4-5)
  -h, --help              Show this help message

DESCRIPTION:
  Two-agent loop (coach/player pattern):
  1. Ralph (player): Implements ONE feature, outputs <ralph>DONE:FEATURE_ID</ralph>
  2. Wiggum (coach): Validates implementation against acceptance criteria
     - Outputs <wiggum>APPROVED</wiggum> if all criteria pass
     - Outputs <wiggum>REJECTED:reason</wiggum> with specific feedback
  
  On rejection, Ralph retries with feedback in next iteration.
  Loop continues until ALL_FEATURES_COMPLETE.

COMPLETION:
  Loop stops when Ralph outputs: <promise>ALL_FEATURES_COMPLETE</promise>

MONITORING:
  tail -f .globex/ralph-loop.log

STOPPING:
  Ctrl+C to stop. Codebase will be in clean state (last commit).
EOF
}

log() {
  local timestamp
  timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "[$timestamp] $*" | tee -a "$LOG_FILE"
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

mkdir -p "$GLOBEX_DIR"

if ! command -v opencode &> /dev/null; then
  log "ERROR: opencode CLI not found. Install from https://opencode.ai"
  exit 1
fi

if [[ ! -f "$PROJECT_STATE_DIR/state.json" ]]; then
  log "ERROR: Project state not found at $PROJECT_STATE_DIR/state.json"
  log "Run /globex-init first."
  exit 1
fi

CURRENT_PHASE=$(jq -r '.currentPhase' "$PROJECT_STATE_DIR/state.json")
if [[ "$CURRENT_PHASE" != "execute" ]]; then
  log "ERROR: Current phase is '$CURRENT_PHASE', expected 'execute'."
  exit 1
fi

log "════════════════════════════════════════════════════════════"
log "  Ralph Loop Started (Coach/Player Pattern)"
log "  Project: $ACTIVE_PROJECT"
log "  Max iterations: $MAX_ITERATIONS"
log "  Model: $MODEL"
log "════════════════════════════════════════════════════════════"

ITERATION=1

cleanup() {
  rm -f "$RALPH_OUTPUT" "$WIGGUM_OUTPUT"
  log "Loop stopped at iteration $ITERATION"
}
trap cleanup EXIT

while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
  log "────────────────────────────────────────────────────────────"
  log "Iteration $ITERATION / $MAX_ITERATIONS"
  log "────────────────────────────────────────────────────────────"
  
  # --- RALPH (PLAYER) PHASE ---
  log "RALPH: Starting implementation..."
  opencode run --agent globex-ralph -m "$MODEL" "Execute ONE autonomous Ralph loop iteration." 2>&1 | tee "$RALPH_OUTPUT" || true
  
  # Check for completion
  if grep -q "<promise>$COMPLETION_PROMISE</promise>" "$RALPH_OUTPUT"; then
    log "════════════════════════════════════════════════════════════"
    log "COMPLETE: All features implemented!"
    log "Total iterations: $ITERATION"
    log "════════════════════════════════════════════════════════════"
    exit 0
  fi
  
  # Parse Ralph output for feature ID
  FEATURE_ID=""
  if grep -qoE '<ralph>DONE:[^<]+</ralph>' "$RALPH_OUTPUT"; then
    FEATURE_ID=$(grep -oE '<ralph>DONE:[^<]+</ralph>' "$RALPH_OUTPUT" | sed 's/<ralph>DONE://;s/<\/ralph>//')
  fi
  
  if [[ -z "$FEATURE_ID" ]]; then
    log "RALPH: No DONE tag found. Retrying next iteration."
    ITERATION=$((ITERATION + 1))
    sleep 3
    continue
  fi
  
  log "RALPH: Completed $FEATURE_ID"
  
  # --- WIGGUM (COACH) PHASE ---
  log "WIGGUM: Starting validation of $FEATURE_ID..."
  WIGGUM_PROMPT="Validate feature $FEATURE_ID implementation. Check acceptance criteria in .globex/projects/$ACTIVE_PROJECT/features.json. Output <wiggum>APPROVED</wiggum> if all criteria pass, or <wiggum>REJECTED:reason</wiggum> with specific feedback."
  opencode run --agent globex-wiggum -m "$MODEL" "$WIGGUM_PROMPT" 2>&1 | tee "$WIGGUM_OUTPUT" || true
  
  # Parse Wiggum output
  if grep -q '<wiggum>APPROVED</wiggum>' "$WIGGUM_OUTPUT"; then
    log "WIGGUM: APPROVED - $FEATURE_ID validated"
  elif grep -qoE '<wiggum>REJECTED:[^<]+</wiggum>' "$WIGGUM_OUTPUT"; then
    REJECTION=$(grep -oE '<wiggum>REJECTED:[^<]+</wiggum>' "$WIGGUM_OUTPUT" | sed 's/<wiggum>REJECTED://;s/<\/wiggum>//')
    log "WIGGUM: REJECTED - $REJECTION"
    log "Feedback will be used in next iteration."
  else
    log "WIGGUM: No verdict tag found. Proceeding."
  fi
  
  ITERATION=$((ITERATION + 1))
  
  log "Iteration complete. Fresh context in 3s..."
  sleep 3
done

log "════════════════════════════════════════════════════════════"
log "WARNING: Max iterations ($MAX_ITERATIONS) reached."
log "Review .globex/progress.md for status."
log "════════════════════════════════════════════════════════════"
exit 1
