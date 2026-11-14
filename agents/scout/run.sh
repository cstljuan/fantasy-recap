#!/bin/sh
# One command for a real Scout run. Needs GOOGLE_API_KEY or ANTHROPIC_API_KEY in the environment.
#   sh agents/scout/run.sh                    all 28 players
#   sh agents/scout/run.sh --players GOB.QB   some players
#   sh agents/scout/run.sh --preflight        only check that a run could start
cd "$(dirname "$0")/../.." || exit 1
if [ ! -d .venv ]; then python3 -m venv .venv || { echo "NOT READY: python3 with venv is needed"; exit 2; }; fi
. .venv/bin/activate
pip install -q -r agents/scout/requirements.txt || { echo "NOT READY: pip install failed (network?)"; exit 2; }
exec python3 agents/scout/scout.py "$@"
