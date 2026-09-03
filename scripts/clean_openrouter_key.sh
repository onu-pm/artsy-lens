#!/usr/bin/env bash
set -e
if [ -f server/openrouterService.ts ]; then
  perl -0777 -pe 's/const DEFAULT_OPENROUTER_KEY = ["'].*?["'];/const DEFAULT_OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;/gs' -i server/openrouterService.ts || true
fi
