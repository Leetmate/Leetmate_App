/**
 * Build script only — no Firebase CLI. Reads .env and firebase-config.template.js,
 * replaces variable placeholders with values from .env, and writes firebase-config.js.
 * Run before packaging for Chrome Web Store: npm run build:config
 * After deployment, the extension uses the generated firebase-config.js (values baked in at build time).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const TEMPLATE_PATH = path.join(ROOT, 'firebase-config.template.js');
const OUT_PATH = path.join(ROOT, 'firebase-config.js');

const ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error('Missing .env. Copy .env.example to .env and set your Firebase values.');
    process.exit(1);
  }
  const raw = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error('Missing firebase-config.template.js');
  process.exit(1);
}

const env = loadEnv();
let template = fs.readFileSync(TEMPLATE_PATH, 'utf8');

// Replace each placeholder (variable name) with the value from .env
ENV_KEYS.forEach(function (key) {
  const value = env[key] || '';
  template = template.split(key).join(value);
});

// Update the generated file header
const generatedHeader = '/**\n * Firebase config – generated from .env (see firebase-config.template.js for variable names). Do not edit.\n */';
template = template.replace(/^\/\*\*[\s\S]*?\*\/\s*/, generatedHeader + '\n');

fs.writeFileSync(OUT_PATH, template, 'utf8');
console.log('Wrote firebase-config.js from .env variables.');
console.log('Extension is ready to package for Chrome Web Store.');
console.log('(Pack the Leetmate folder or zip it for the Chrome Web Store.)');
console.log('');
console.log('Committed source uses variable names in firebase-config.template.js;');
console.log('firebase-config.js is generated and contains values from .env.');
console.log('No Firebase CLI required — env vars are applied at build time and work after deployment.');