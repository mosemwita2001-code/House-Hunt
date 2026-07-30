import 'dotenv/config';
import { getAuthToken, registerIPN } from '../pesapalService.js';

const callbackUrl = process.env.PESAPAL_IPN_URL;
if (!callbackUrl) throw new Error('PESAPAL_IPN_URL is not configured');

try {
  // Request the token explicitly so this one-time script verifies credentials
  // before registering the callback URL.
  await getAuthToken();
  const result = await registerIPN(callbackUrl);
  console.log(JSON.stringify({ callbackUrl, ...result }, null, 2));
  console.log(`IPN_ID=${result.ipn_id || result.ipnId || ''}`);
} catch (error) {
  console.error('PesaPal IPN registration failed:', error.message);
  process.exitCode = 1;
}
