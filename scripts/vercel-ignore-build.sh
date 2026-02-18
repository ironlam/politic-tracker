#!/bin/bash

# Vercel Ignored Build Step
# ─────────────────────────
# This script controls when Vercel should proceed with a build.
# Exit 0 = skip build | Exit 1 = proceed with build
#
# By default, all git-push triggered builds are skipped.
# To deploy from the Vercel dashboard:
#   1. Go to your project → Deployments → Redeploy
#   2. Expand "Environment Variables" and set FORCE_BUILD=true
#
# Or set FORCE_BUILD=true permanently in Project Settings → Environment Variables
# (and remove it when you want to pause deployments again).

echo "🔍 Vercel Ignored Build Step"
echo "   Branch: $VERCEL_GIT_COMMIT_REF"
echo "   Env:    $VERCEL_ENV"

if [[ "$FORCE_BUILD" == "true" ]]; then
  echo "✅ FORCE_BUILD=true — proceeding with build"
  exit 1
fi

echo "⏭️  Build skipped (set FORCE_BUILD=true to deploy)"
exit 0
