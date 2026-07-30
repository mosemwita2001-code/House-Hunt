const baseUrl = () => (process.env.PESAPAL_BASE_URL || 'https://pay.pesapal.com/v3').replace(/\/$/, '');

async function pesapalRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...options,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch (error) {
    const detail = error.cause?.code || error.code || error.cause?.message || error.message;
    const requestError = new Error(`Unable to reach PesaPal (${detail}). Please try again.`);
    requestError.code = 'PESAPAL_NETWORK_ERROR';
    throw requestError;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `PesaPal request failed (${response.status})`);
  return body;
}

export async function getAuthToken() {
  if (!process.env.PESAPAL_CONSUMER_KEY || !process.env.PESAPAL_CONSUMER_SECRET) {
    throw new Error('PesaPal consumer credentials are not configured');
  }
  const data = await pesapalRequest('/api/Auth/RequestToken', {
    method: 'POST',
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });
  if (!data.token) throw new Error('PesaPal did not return an auth token');
  return data.token;
}

export async function registerIPN(callbackUrl = process.env.PESAPAL_IPN_URL, token) {
  if (!callbackUrl) throw new Error('PESAPAL_IPN_URL is not configured');
  const authToken = token || await getAuthToken();
  const result = await pesapalRequest('/api/URLSetup/RegisterIPN', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ url: callbackUrl, ipn_notification_type: 'POST' }),
  });
  if (!result.ipn_id) throw new Error('PesaPal did not return an IPN ID');
  return result;
}

async function resolveIpnId(token) {
  if (process.env.PESAPAL_IPN_ID) return process.env.PESAPAL_IPN_ID;
  // A newly registered URL's returned ID is used immediately for this order.
  const registration = await registerIPN(process.env.PESAPAL_IPN_URL, token);
  return registration.ipn_id;
}

export async function submitOrder({ amount, reference, phone, description, billingAddress }) {
  const token = await getAuthToken();
  const ipnId = await resolveIpnId(token);
  const amountValue = Number(amount);
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }
  const billing_address = {
    email_address: billingAddress?.email,
    phone_number: phone,
    country_code: billingAddress?.countryCode || 'KE',
    first_name: billingAddress?.firstName,
    last_name: billingAddress?.lastName,
  };
  if (!billing_address.email_address || !billing_address.phone_number || !billing_address.country_code || !billing_address.first_name || !billing_address.last_name) {
    throw new Error('A billing email, phone number, country code, first name, and last name are required');
  }
  if (!process.env.PESAPAL_CALLBACK_URL) throw new Error('PESAPAL_CALLBACK_URL is not configured');
  const payload = {
    id: reference,
    currency: 'KES',
    amount: amountValue,
    description,
    callback_url: process.env.PESAPAL_CALLBACK_URL,
    notification_id: ipnId,
    billing_address,
  };
  console.info('[PesaPal] SubmitOrderRequest payload:', JSON.stringify(payload));
  return pesapalRequest('/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export async function getTransactionStatus(orderTrackingId) {
  const token = await getAuthToken();
  return pesapalRequest(`/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(orderTrackingId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function handleIPN(payload) {
  if (!payload?.OrderTrackingId) throw new Error('Missing PesaPal order tracking ID');
  return getTransactionStatus(payload.OrderTrackingId);
}
