#!/usr/bin/env bash
cd "D:/src"
for f in \
  index.ts \
  main.tsx \
  context.ts \
  core.ts \
  commands.ts \
  setup.ts \
  tools.ts \
  Tool.ts \
  tasks.ts \
  Task.ts \
  history.ts \
  debug.ts \
  cost-tracker.ts \
  costHook.ts \
  feature-repository.ts \
  globals.d.ts \
  GrowthBook.ts \
  GrowthBookClient.ts \
  projectOnboardingState.ts \
  query.ts \
  QueryEngine.ts \
  source-manager.ts \
  sticky-bucket-service.ts \
  util.ts \
  mongrule.ts \
  ink.ts \
  replLauncher.tsx \
  interactiveHelpers.tsx \
  dialogLaunchers.tsx \
  auto-wrapper.ts \
  bootstrap-entry.ts \
  bootstrapMacro.ts \
  dev-entry.ts
do
  if [ -f "$f" ]; then
    echo "=== $f ==="
    rg -n "^(export\s+(default\s+)?(function|const|let|var|interface|type|class|enum)\s+)" "$f" 2>/dev/null || echo "(no matches or rg failed)"
  else
    echo "=== $f === NOT FOUND"
  fi
done
