# Source

Build:  npx esbuild src/main.js --bundle --format=esm --minify --outfile=../main.js
Assets: ../assets  (CC0 photoscans from polyhaven.com, fetched via tools/fetch)
Dev:    node server.cjs  then open http://localhost:8930/

Harnesses
  ./shoot.sh   render the vet views to PNG
  ./walk.sh    scripted climb, asserts collision / eye height / floors reached
  ./lean.sh    single small frame (cheap check)
