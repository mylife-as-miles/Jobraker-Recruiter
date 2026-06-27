#!/bin/bash
set -e

# build jobraker-recruiter-x next.js app
(cd apps/jobraker-recruiter-x && \
    npm install && \
    npm run build)

# build jobraker-recruiter server
(cd apps/cli && \
    npm install && \
    npm run build)