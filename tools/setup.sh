#!/bin/sh
# Run once per clone, and at the start of every session:  sh tools/setup.sh
# Turns on the commit checks in .githooks and says who commits here will be authored by.
# Safe to run again. It never changes your git name or email.
cd "$(git rev-parse --show-toplevel)" || exit 0
git config core.hooksPath .githooks
chmod +x .githooks/* tools/*.sh 2>/dev/null
sh tools/check-authors.sh --ident
exit 0
