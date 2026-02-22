#!/usr/bin/env bash
set -euo pipefail

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✔${NC}  $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}✖${NC}  $*" >&2; }
header()  { echo -e "\n${BOLD}${CYAN}$*${NC}"; }

# ── usage ─────────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") [options] [branch]

${BOLD}Description:${NC}
  Pull latest main, merge a side branch into it, push, and clean up.

${BOLD}Arguments:${NC}
  branch          Branch to merge into main (prompted if omitted)

${BOLD}Options:${NC}
  -b, --base      Base branch to merge into  (default: main)
  -k, --keep      Keep the side branch after merge
  -l, --list      List mergeable branches and exit
  -n, --dry-run   Show what would happen without making changes
  -h, --help      Show this help

${BOLD}Examples:${NC}
  $(basename "$0")                              # interactive: pick branch
  $(basename "$0") feature/my-branch            # merge specific branch
  $(basename "$0") -b develop feature/my-branch # merge into develop
  $(basename "$0") --list                       # list available branches
  $(basename "$0") --dry-run feature/my-branch  # preview actions
EOF
}

# ── arg parsing ───────────────────────────────────────────────────────────────
BASE_BRANCH="main"
KEEP_BRANCH=false
DRY_RUN=false
LIST_ONLY=false
SOURCE_BRANCH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--base)    BASE_BRANCH="$2"; shift 2 ;;
    -k|--keep)    KEEP_BRANCH=true; shift ;;
    -l|--list)    LIST_ONLY=true; shift ;;
    -n|--dry-run) DRY_RUN=true; shift ;;
    -h|--help)    usage; exit 0 ;;
    -*) error "Unknown option: $1"; usage; exit 1 ;;
    *)  SOURCE_BRANCH="$1"; shift ;;
  esac
done

# ── helpers ───────────────────────────────────────────────────────────────────
run() {
  if $DRY_RUN; then
    echo -e "  ${YELLOW}[dry-run]${NC} $*"
  else
    "$@"
  fi
}

require_git() {
  git rev-parse --git-dir &>/dev/null || { error "Not inside a git repository."; exit 1; }
}

list_branches() {
  # All local branches except the base branch
  git branch --format='%(refname:short)' | grep -v "^${BASE_BRANCH}$" || true
}

pick_branch() {
  local branches
  mapfile -t branches < <(list_branches)

  if [[ ${#branches[@]} -eq 0 ]]; then
    error "No side branches found (only '${BASE_BRANCH}' exists)."
    exit 1
  fi

  echo -e "${BOLD}Available branches:${NC}"
  for i in "${!branches[@]}"; do
    printf "  %2d) %s\n" $((i+1)) "${branches[$i]}"
  done
  echo
  read -rp "Pick a branch to merge [1-${#branches[@]}]: " choice

  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#branches[@]} )); then
    error "Invalid selection."
    exit 1
  fi

  echo "${branches[$((choice-1))]}"
}

# ── main ──────────────────────────────────────────────────────────────────────
require_git

# --list mode
if $LIST_ONLY; then
  header "Branches (merging into '${BASE_BRANCH}')"
  list_branches | sed 's/^/  /'
  exit 0
fi

# Resolve branch interactively if not supplied
if [[ -z "$SOURCE_BRANCH" ]]; then
  SOURCE_BRANCH=$(pick_branch)
fi

# Verify the branch exists
if ! git show-ref --verify --quiet "refs/heads/${SOURCE_BRANCH}"; then
  # Try fetching it first
  info "Branch '${SOURCE_BRANCH}' not found locally — fetching from remote..."
  run git fetch origin "${SOURCE_BRANCH}:${SOURCE_BRANCH}" || {
    error "Branch '${SOURCE_BRANCH}' not found locally or on remote."
    exit 1
  }
fi

header "Merge plan"
echo -e "  Source : ${YELLOW}${SOURCE_BRANCH}${NC}"
echo -e "  Target : ${GREEN}${BASE_BRANCH}${NC}"
echo -e "  Delete : $( $KEEP_BRANCH && echo "no (--keep)" || echo "yes (local + remote)")"
$DRY_RUN && echo -e "  Mode   : ${YELLOW}dry-run${NC}"

# ── step 1: pull base branch ──────────────────────────────────────────────────
header "1/4  Pulling '${BASE_BRANCH}'"
run git checkout "${BASE_BRANCH}"
run git pull origin "${BASE_BRANCH}" || {
  warn "Pull failed — continuing with local state."
}
success "Base branch up to date"

# ── step 2: merge ─────────────────────────────────────────────────────────────
header "2/4  Merging '${SOURCE_BRANCH}' → '${BASE_BRANCH}'"
run git merge --no-ff "${SOURCE_BRANCH}" -m "Merge '${SOURCE_BRANCH}' into ${BASE_BRANCH}"
success "Merge complete"

# ── step 3: push ──────────────────────────────────────────────────────────────
header "3/4  Pushing '${BASE_BRANCH}'"
push_failed=false
if $DRY_RUN; then
  run git push -u origin "${BASE_BRANCH}"
else
  if git push -u origin "${BASE_BRANCH}" 2>/dev/null; then
    success "Pushed to origin/${BASE_BRANCH}"
  else
    push_failed=true
    warn "Push to '${BASE_BRANCH}' was rejected (branch may be protected)."
    echo
    echo -e "  ${BOLD}Options:${NC}"
    echo -e "    1) Push to a 'claude/' branch and open a PR manually"
    echo -e "    2) Skip push and delete the branch locally only"
    echo -e "    3) Abort (leave everything as-is)"
    echo
    read -rp "Choice [1/2/3]: " push_choice

    case "${push_choice:-3}" in
      1)
        fallback_branch="claude/merge-${SOURCE_BRANCH//\//-}-$(date +%s)"
        info "Pushing to fallback branch: ${fallback_branch}"
        git checkout -b "${fallback_branch}"
        git push -u origin "${fallback_branch}"
        success "Pushed to origin/${fallback_branch}"
        warn "Open a PR: ${fallback_branch} → ${BASE_BRANCH}"
        # Switch back so branch deletion below targets the right branch
        git checkout "${BASE_BRANCH}"
        ;;
      2)
        warn "Skipping remote push."
        ;;
      *)
        warn "Aborting — no changes were pushed."
        exit 0
        ;;
    esac
  fi
fi

# ── step 4: delete side branch ────────────────────────────────────────────────
header "4/4  Cleaning up '${SOURCE_BRANCH}'"
if $KEEP_BRANCH; then
  info "Skipping deletion (--keep flag set)"
else
  run git branch -d "${SOURCE_BRANCH}"
  success "Deleted local branch '${SOURCE_BRANCH}'"

  if git ls-remote --exit-code origin "${SOURCE_BRANCH}" &>/dev/null; then
    if $DRY_RUN || ! $push_failed; then
      run git push origin --delete "${SOURCE_BRANCH}" || warn "Could not delete remote branch (may need permissions)."
      success "Deleted remote branch 'origin/${SOURCE_BRANCH}'"
    else
      warn "Skipping remote branch deletion (push was blocked)."
    fi
  else
    info "No remote branch 'origin/${SOURCE_BRANCH}' to delete."
  fi
fi

# ── summary ───────────────────────────────────────────────────────────────────
header "Done"
echo -e "  ${GREEN}✔${NC} Merged   : ${SOURCE_BRANCH} → ${BASE_BRANCH}"
$push_failed  || echo -e "  ${GREEN}✔${NC} Pushed   : origin/${BASE_BRANCH}"
$KEEP_BRANCH  || echo -e "  ${GREEN}✔${NC} Deleted  : ${SOURCE_BRANCH}"
