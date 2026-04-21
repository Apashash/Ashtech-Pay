#!/bin/bash
set -e
npm install
yes "No, add the constraint without truncating the table" | npm run db:push || true
