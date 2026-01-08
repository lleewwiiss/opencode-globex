#!/bin/bash

# Note: Plugin loop (globex_loop_control) has SDK bugs - using bash script for now

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GLOBEX_DIR="$PROJECT_DIR/.globex"
LOG_FILE="$GLOBEX_DIR/ralph-loop.log"
MAX_ITERATIONS=100
MODEL="anthropic/claude-opus-4-5"
VARIANT="max"
COMPLETION_PROMISE="ALL_FEATURES_COMPLETE"

# Read active project
if [[ ! -f "$GLOBEX_DIR/active-project" ]]; then
  echo -e "${RED}ERROR: No active project. Run /globex-init first.${RESET}" >&2
  exit 1
fi
ACTIVE_PROJECT=$(cat "$GLOBEX_DIR/active-project")
PROJECT_STATE_DIR="$GLOBEX_DIR/projects/$ACTIVE_PROJECT"
FEATURES_FILE="$PROJECT_STATE_DIR/features.json"

RALPH_OUTPUT="/tmp/globex-ralph-$$.txt"
WIGGUM_OUTPUT="/tmp/globex-wiggum-$$.txt"

usage() {
  cat << 'EOF'
Ralph Loop - Coach/Player Execution

USAGE:
  ./scripts/ralph-loop.sh [OPTIONS]

OPTIONS:
  --max-iterations <n>    Max iterations (default: 100)
  --model <model>         Model to use (default: anthropic/claude-opus-4-5)
  --variant <variant>     Reasoning effort: max, high, minimal (default: max)
  -h, --help              Show help

FLOW:
  1. Ralph implements feature (no commit)
  2. Wiggum validates implementation
  3. If APPROVED → commit + mark passes
  4. If REJECTED → Ralph retries with feedback

MONITORING:
  tail -f .globex/ralph-loop.log
EOF
}

log() {
  echo "$(date -u '+%H:%M:%S') $*" >> "$LOG_FILE"
}

print_header() {
  echo -e "\n${BOLD}${BLUE}═══════════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  $1${RESET}"
  echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════${RESET}"
}

print_status() {
  local icon=$1 color=$2 msg=$3
  echo -e "${color}${icon}${RESET} ${msg}"
}

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help) usage; exit 0 ;;
    --max-iterations)
      [[ -z "${2:-}" ]] && { echo "Error: --max-iterations requires integer" >&2; exit 1; }
      MAX_ITERATIONS="$2"; shift 2 ;;
    --model)
      [[ -z "${2:-}" ]] && { echo "Error: --model requires name" >&2; exit 1; }
      MODEL="$2"; shift 2 ;;
    --variant)
      [[ -z "${2:-}" ]] && { echo "Error: --variant requires value (max, high, minimal)" >&2; exit 1; }
      VARIANT="$2"; shift 2 ;;
    *) echo "Unknown: $1" >&2; usage; exit 1 ;;
  esac
done

# Validation
if ! command -v opencode &> /dev/null; then
  echo -e "${RED}ERROR: opencode CLI not found${RESET}" >&2
  exit 1
fi

if [[ ! -f "$PROJECT_STATE_DIR/state.json" ]]; then
  echo -e "${RED}ERROR: No project state. Run /globex-init first.${RESET}" >&2
  exit 1
fi

CURRENT_PHASE=$(jq -r '.currentPhase' "$PROJECT_STATE_DIR/state.json")
if [[ "$CURRENT_PHASE" != "execute" ]]; then
  echo -e "${RED}ERROR: Phase is '$CURRENT_PHASE', need 'execute'${RESET}" >&2
  exit 1
fi

# Check completion
if [[ -f "$FEATURES_FILE" ]]; then
  INCOMPLETE=$(jq '[.features[] | select(.passes != true and .blocked != true)] | length' "$FEATURES_FILE")
  TOTAL=$(jq '.features | length' "$FEATURES_FILE")
  COMPLETE=$((TOTAL - INCOMPLETE))
  if [[ "$INCOMPLETE" == "0" ]]; then
    print_header "All $TOTAL features complete!"
    exit 0
  fi
fi

print_header "Ralph Loop: $ACTIVE_PROJECT"
echo -e "${DIM}Model: $MODEL | Variant: $VARIANT | Max: $MAX_ITERATIONS iterations${RESET}"
echo -e "${DIM}Progress: $COMPLETE/$TOTAL features${RESET}\n"

log "Started: $ACTIVE_PROJECT, model=$MODEL"

cleanup() {
  rm -f "$RALPH_OUTPUT" "$WIGGUM_OUTPUT"
}
trap cleanup EXIT

ITERATION=1

while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
  # Progress bar
  INCOMPLETE=$(jq '[.features[] | select(.passes != true and .blocked != true)] | length' "$FEATURES_FILE" 2>/dev/null || echo "?")
  TOTAL=$(jq '.features | length' "$FEATURES_FILE" 2>/dev/null || echo "?")
  
  echo -e "\n${CYAN}────── Iteration $ITERATION ──────${RESET} ${DIM}($((TOTAL - INCOMPLETE))/$TOTAL done)${RESET}"
  
  # --- RALPH ---
  print_status "🔨" "$YELLOW" "Ralph implementing..."
  log "Ralph starting iteration $ITERATION"
  
  # Capture output, suppress live output
  if ! opencode run --agent globex-ralph -m "$MODEL" --variant "$VARIANT" \
    "Implement ONE feature. Output <ralph>DONE:FEATURE_ID</ralph> when ready for validation. Do NOT commit. Do NOT call globex_update_feature with passes:true." \
    > "$RALPH_OUTPUT" 2>&1; then
    print_status "⚠" "$YELLOW" "Ralph exited with error, checking output..."
  fi
  
  # Check completion (use -a to treat as text, output may contain escape codes)
  if grep -qa "<promise>$COMPLETION_PROMISE</promise>" "$RALPH_OUTPUT"; then
    print_header "✅ ALL FEATURES COMPLETE"
    echo -e "${GREEN}Total iterations: $ITERATION${RESET}"
    log "Complete at iteration $ITERATION"
    exit 0
  fi
  
  # Parse DONE tag (use -a to treat as text, output may contain escape codes)
  FEATURE_ID=""
  if grep -qaoE '<ralph>DONE:[^<]+</ralph>' "$RALPH_OUTPUT"; then
    FEATURE_ID=$(grep -aoE '<ralph>DONE:[^<]+</ralph>' "$RALPH_OUTPUT" | head -1 | sed 's/<ralph>DONE://;s/<\/ralph>//')
  fi
  
  if [[ -z "$FEATURE_ID" ]]; then
    print_status "⚠" "$YELLOW" "No DONE tag, retrying..."
    log "No DONE tag found"
    # Show last 10 lines of output for debugging
    echo -e "${DIM}Last output:${RESET}"
    tail -5 "$RALPH_OUTPUT" | sed 's/^/  /'
    ITERATION=$((ITERATION + 1))
    sleep 2
    continue
  fi
  
  print_status "✓" "$GREEN" "Ralph done: ${BOLD}$FEATURE_ID${RESET}"
  log "Ralph completed $FEATURE_ID"
  
  # --- WIGGUM ---
  print_status "🔍" "$BLUE" "Wiggum validating..."
  log "Wiggum validating $FEATURE_ID"
  
  WIGGUM_PROMPT="Validate $FEATURE_ID. Check acceptance criteria in $FEATURES_FILE. Output <wiggum>APPROVED</wiggum> or <wiggum>REJECTED</wiggum> with IMMEDIATE ACTIONS NEEDED."
  
  if ! opencode run --agent globex-wiggum -m "$MODEL" --variant "$VARIANT" "$WIGGUM_PROMPT" > "$WIGGUM_OUTPUT" 2>&1; then
    print_status "⚠" "$YELLOW" "Wiggum exited with error, checking output..."
  fi
  
  # Parse verdict (use -a to treat as text, output may contain escape codes)
  if grep -qa '<wiggum>APPROVED</wiggum>' "$WIGGUM_OUTPUT"; then
    print_status "✅" "$GREEN" "APPROVED"
    log "Wiggum approved $FEATURE_ID"
    
    # Commit the changes
    print_status "📦" "$CYAN" "Committing..."
    COMMIT_MSG="feat(globex): $FEATURE_ID"
    if git -C "$PROJECT_DIR" add -A && git -C "$PROJECT_DIR" commit -m "$COMMIT_MSG" --quiet; then
      print_status "✓" "$GREEN" "Committed: $COMMIT_MSG"
      log "Committed $FEATURE_ID"
    else
      print_status "⚠" "$YELLOW" "Nothing to commit (no changes?)"
      log "No changes to commit for $FEATURE_ID"
    fi
    
    # Mark passes + clear feedback via jq
    jq --arg id "$FEATURE_ID" '
      .features |= map(if .id == $id then .passes = true | .completedAt = (now | todate) | del(.feedback) else . end)
    ' "$FEATURES_FILE" > "$FEATURES_FILE.tmp" && mv "$FEATURES_FILE.tmp" "$FEATURES_FILE"
    
    print_status "✓" "$GREEN" "Marked $FEATURE_ID as complete"
    log "Marked $FEATURE_ID passes=true"
    
  elif grep -qa '<wiggum>REJECTED</wiggum>' "$WIGGUM_OUTPUT"; then
    print_status "❌" "$RED" "REJECTED"
    log "Wiggum rejected $FEATURE_ID"
    
    # Extract feedback
    FEEDBACK=""
    if grep -qa "IMMEDIATE ACTIONS" "$WIGGUM_OUTPUT"; then
      FEEDBACK=$(sed -n '/IMMEDIATE ACTIONS/,/^$/p' "$WIGGUM_OUTPUT" | head -15 | tr '\n' ' ' | sed 's/  */ /g')
    else
      FEEDBACK="Rejected without specific actions"
    fi
    
    echo -e "${DIM}Feedback: ${FEEDBACK:0:100}...${RESET}"
    
    # Increment attempts + save feedback to feature in JSON
    ATTEMPTS=$(jq --arg id "$FEATURE_ID" '.features[] | select(.id == $id) | .attempts // 0' "$FEATURES_FILE")
    NEW_ATTEMPTS=$((ATTEMPTS + 1))
    
    if [[ $NEW_ATTEMPTS -ge 5 ]]; then
      print_status "🚫" "$RED" "Max attempts (5) reached, blocking $FEATURE_ID"
      jq --arg id "$FEATURE_ID" --arg fb "$FEEDBACK" '
        .features |= map(if .id == $id then .blocked = true | .blockedReason = "Max attempts exceeded" | .attempts = 5 | .feedback = $fb else . end)
      ' "$FEATURES_FILE" > "$FEATURES_FILE.tmp" && mv "$FEATURES_FILE.tmp" "$FEATURES_FILE"
      log "Blocked $FEATURE_ID after 5 attempts"
      # Discard changes only when blocking
      git -C "$PROJECT_DIR" checkout . 2>/dev/null || true
      git -C "$PROJECT_DIR" clean -fd 2>/dev/null || true
    else
      jq --arg id "$FEATURE_ID" --argjson att "$NEW_ATTEMPTS" --arg fb "$FEEDBACK" '
        .features |= map(if .id == $id then .attempts = $att | .feedback = $fb else . end)
      ' "$FEATURES_FILE" > "$FEATURES_FILE.tmp" && mv "$FEATURES_FILE.tmp" "$FEATURES_FILE"
      print_status "↻" "$YELLOW" "Attempt $NEW_ATTEMPTS/5, keeping changes..."
      log "Attempt $NEW_ATTEMPTS for $FEATURE_ID"
    fi
    
  else
    print_status "⚠" "$YELLOW" "No verdict tag, treating as needs retry"
    log "No verdict from Wiggum"
    echo -e "${DIM}Last output:${RESET}"
    tail -5 "$WIGGUM_OUTPUT" | sed 's/^/  /'
  fi
  
  ITERATION=$((ITERATION + 1))
  sleep 1
done

print_header "⚠ Max iterations reached ($MAX_ITERATIONS)"
echo -e "${YELLOW}Check .globex/progress.md for status${RESET}"
log "Max iterations reached"
exit 1
