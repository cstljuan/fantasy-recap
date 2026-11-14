#!/bin/sh
# Waits until the boss gives you a new task, without using your model while it waits.
# Checks GitHub every 20 seconds. Default: up to 25 minutes, then it returns.
#   sh tools/wait.sh          sh tools/wait.sh 540   (seconds)    sh tools/wait.sh 540 S
cd "$(git rev-parse --show-toplevel)" || exit 1
max="${1:-1500}"; lane="$2"; t=0
while [ "$t" -lt "$max" ]; do
  if [ "$(sh tools/inbox.sh --count 2>/dev/null)" != "0" ]; then
    echo "NEW MESSAGE for you. Run: sh tools/sync.sh"
    exit 0
  fi
  if sh tools/next.sh $lane >/dev/null 2>&1; then
    echo "NEW WORK. Run: sh tools/sync.sh   then: sh tools/next.sh $lane"
    exit 0
  fi
  sleep 20; t=$((t+20))
done
echo "NO NEW WORK after $max seconds. Run sh tools/wait.sh again, or stop if your person said so."
exit 0
