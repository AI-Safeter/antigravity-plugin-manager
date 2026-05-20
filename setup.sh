#!/bin/bash

echo "Setting up antigravity-cli Plugin Ecosystem..."

cd "$(dirname "$0")"

npm install

echo "--------------------------------------------------"
echo "✅ Setup Complete"
echo ""
echo "To run the dashboard:"
echo "👉 ag-plugin"
echo ""
echo "To link globally:"
echo "👉 sudo npm link"
echo "--------------------------------------------------"
