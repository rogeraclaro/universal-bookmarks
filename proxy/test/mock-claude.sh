#!/bin/bash
# Mock claude binary for hermetic proxy tests
# Inspects prompt args to decide output shape
if echo "$@" | grep -qi "Categorize this bookmark"; then
  echo '{"structured_output":{"categories":["IA","Eines"]},"result":"OK"}'
else
  echo '{"structured_output":{"originalId":"test-id","isAI":true,"title":"Test Tweet","categories":["IA"],"externalLinks":[]},"result":"OK"}'
fi
