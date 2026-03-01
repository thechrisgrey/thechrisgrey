/**
 * Validates required environment variables before build.
 * Run as part of the build pipeline to fail early on missing config.
 */
const required = [
  'VITE_NEWSLETTER_ENDPOINT',
  'VITE_CONTACT_ENDPOINT',
  'VITE_CHAT_ENDPOINT',
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing required environment variables:');
  missing.forEach(key => console.error(`  - ${key}`));
  console.error('\nSet these in AWS Amplify console or .env.local for local development.');
  process.exit(1);
}

console.log('Environment validation passed.');
