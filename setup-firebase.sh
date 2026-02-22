#!/usr/bin/env bash
# =============================================================
# Greece Family Trip 2026 – One-command Firebase setup & deploy
# Run this ONCE on your local machine (Mac/Linux/WSL)
# =============================================================
set -euo pipefail

# ── Prerequisites ────────────────────────────────────────────
command -v node  >/dev/null || { echo "ERROR: node not found. Install from nodejs.org"; exit 1; }
command -v npm   >/dev/null || { echo "ERROR: npm not found."; exit 1; }
command -v git   >/dev/null || { echo "ERROR: git not found."; exit 1; }

# Install firebase-tools if not already present
if ! command -v firebase >/dev/null; then
  echo "Installing firebase-tools..."
  npm install -g firebase-tools
fi

# ── Login ────────────────────────────────────────────────────
echo ""
echo "Step 1/5 – Sign in with your Google account"
firebase login

# ── Create project ───────────────────────────────────────────
echo ""
echo "Step 2/5 – Create Firebase project"
echo "Enter a project ID (lowercase letters, digits, hyphens; e.g. greece-trip-2026):"
read -r PROJECT_ID

firebase projects:create "$PROJECT_ID" --display-name "Greece Family Trip 2026"

# Enable required Google Cloud APIs (Firestore + Auth + Storage are enabled
# automatically when you first use them via Firebase Console, but we force it here)
echo "Enabling Firestore, Auth, and Storage via Firebase..."
firebase --project "$PROJECT_ID" firestore:databases:create --location europe-west1 2>/dev/null || true

# ── Register web app & extract config ────────────────────────
echo ""
echo "Step 3/5 – Register web app in Firebase project"
APP_OUTPUT=$(firebase apps:create WEB "Greece Family Trip 2026" --project "$PROJECT_ID" 2>&1)
APP_ID=$(echo "$APP_OUTPUT" | grep -oP '(?<=App ID: )[\w:]+' || true)

if [[ -z "$APP_ID" ]]; then
  echo "Could not auto-detect App ID. Please visit:"
  echo "  https://console.firebase.google.com/project/$PROJECT_ID/settings/general"
  echo "  → Add web app → copy the config values below when prompted."
else
  echo "Fetching SDK config for App ID: $APP_ID"
  CONFIG=$(firebase apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" 2>&1)
  API_KEY=$(echo "$CONFIG"         | grep -oP '(?<="apiKey": ")[^"]+')
  AUTH_DOMAIN=$(echo "$CONFIG"     | grep -oP '(?<="authDomain": ")[^"]+')
  STORAGE_BUCKET=$(echo "$CONFIG"  | grep -oP '(?<="storageBucket": ")[^"]+')
  MSG_SENDER=$(echo "$CONFIG"      | grep -oP '(?<="messagingSenderId": ")[^"]+')
  DETECTED_APP_ID=$(echo "$CONFIG" | grep -oP '(?<="appId": ")[^"]+')
fi

# ── Write .env ───────────────────────────────────────────────
echo ""
echo "Step 4/5 – Writing .env"
if [[ -n "${API_KEY:-}" ]]; then
  cat > .env << EOF
VITE_FIREBASE_API_KEY=$API_KEY
VITE_FIREBASE_AUTH_DOMAIN=$AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID=$MSG_SENDER
VITE_FIREBASE_APP_ID=$DETECTED_APP_ID
EOF
  echo ".env written successfully."
else
  echo "Please paste these values from the Firebase Console (Project Settings → Your apps → SDK config):"
  echo ""
  read -rp "apiKey: " v_key
  read -rp "authDomain: " v_domain
  read -rp "storageBucket: " v_bucket
  read -rp "messagingSenderId: " v_sender
  read -rp "appId: " v_appid
  cat > .env << EOF
VITE_FIREBASE_API_KEY=$v_key
VITE_FIREBASE_AUTH_DOMAIN=$v_domain
VITE_FIREBASE_PROJECT_ID=$PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET=$v_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=$v_sender
VITE_FIREBASE_APP_ID=$v_appid
EOF
fi

# Write .firebaserc
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

# Enable Anonymous Auth (REST API call using firebase-tools token)
echo ""
echo "Enable Anonymous Auth in the Firebase Console:"
echo "  https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
echo "  → Sign-in method → Anonymous → Enable → Save"
echo ""
read -rp "Press ENTER once you've enabled Anonymous Auth..."

# Enable Firebase Storage
echo ""
echo "Enable Firebase Storage in the Console:"
echo "  https://console.firebase.google.com/project/$PROJECT_ID/storage"
echo "  → Get started → Production mode → Next → Done"
echo ""
read -rp "Press ENTER once Storage is enabled..."

# ── Build & Deploy ───────────────────────────────────────────
echo ""
echo "Step 5/5 – Building and deploying..."
npm install
npm run build
firebase deploy --project "$PROJECT_ID"

echo ""
echo "============================================================"
echo "DONE!  Your app is live at:"
echo "  https://$PROJECT_ID.web.app"
echo ""
echo "Share that URL with family members. On mobile:"
echo "  1. Open the URL in Chrome (Android) or Safari (iPhone)"
echo "  2. Tap the share/menu button"
echo "  3. Choose 'Add to Home Screen'"
echo "  4. Enter trip code: greece2026"
echo "============================================================"

# Generate CI token for GitHub Actions (optional)
echo ""
echo "Optional: To enable auto-deploy from GitHub Actions, run:"
echo "  firebase login:ci"
echo "Then add the token as FIREBASE_SERVICE_ACCOUNT secret in:"
echo "  https://github.com/avielbl/family-trip-app/settings/secrets/actions"
