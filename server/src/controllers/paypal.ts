import { v4 as uuidv4 } from 'uuid';

interface CachedToken {
  token: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;

function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_BASE || 'https://api-m.sandbox.paypal.com';
}

function getCredentials(): { clientId: string; secret: string } {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SECRET || '';
  return { clientId, secret };
}

export async function getPayPalAccessToken(): Promise<string> {
  const { clientId, secret } = getCredentials();

  if (
    !clientId ||
    !secret ||
    clientId.includes('your_paypal') ||
    secret.includes('your_paypal')
  ) {
    throw new Error(
      'PayPal credentials are not configured or are set to placeholder values. Please set PAYPAL_CLIENT_ID and PAYPAL_SECRET in your environment.'
    );
  }

  // Check cached token (with 60-second buffer)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal OAuth failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.token;
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  payeeLabel: string;
  referenceId: string;
}

export async function getPayPalOrder(orderId: string): Promise<any> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Get Order failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

export async function createPayPalOrder(params: CreateOrderParams): Promise<{ id: string }> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const currency = params.currency || 'USD';

  // Strictly enforce intent: "AUTHORIZE" as per Hard Rule #4
  const payload = {
    intent: 'AUTHORIZE',
    purchase_units: [
      {
        reference_id: params.referenceId,
        description: params.payeeLabel,
        amount: {
          currency_code: currency,
          value: params.amount.toFixed(2),
        },
      },
    ],
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Create Order failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { id: string };
  return { id: data.id };
}

export interface AuthorizeOrderResult {
  authorizationId: string;
  status: string;
}

export async function authorizePayPalOrder(
  orderId: string,
  idempotencyKey?: string
): Promise<AuthorizeOrderResult> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['PayPal-Request-Id'] = idempotencyKey;
  }

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/authorize`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Authorize Order failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const authorization = data?.purchase_units?.[0]?.payments?.authorizations?.[0];

  if (!authorization || !authorization.id) {
    throw new Error('PayPal authorization response missing authorization ID');
  }

  const status = authorization.status || 'CREATED';
  const validStatuses = ['CREATED', 'PENDING'];
  if (!validStatuses.includes(status)) {
    throw new Error(`PayPal authorization returned non-successful status: ${status}`);
  }

  return {
    authorizationId: authorization.id,
    status,
  };
}

export interface CaptureResult {
  captureId: string;
  status: string;
}

export async function capturePayPalAuthorization(
  authorizationId: string,
  idempotencyKey?: string
): Promise<CaptureResult> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const requestId = idempotencyKey || uuidv4();

  const response = await fetch(`${baseUrl}/v2/payments/authorizations/${authorizationId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Strictly attach PayPal-Request-Id UUID header as per Hard Rule #6
      'PayPal-Request-Id': requestId,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal Capture failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;

  if (!data || typeof data !== 'object') {
    throw new Error('PayPal capture returned empty or malformed response');
  }

  if (!data.id) {
    throw new Error('PayPal capture response missing capture ID');
  }

  if (!data.status) {
    throw new Error('PayPal capture response missing status');
  }

  // Section 2: Strict PayPal capture validation
  // Only accept the documented successful completion status (COMPLETED).
  // Never default missing status to COMPLETED.
  if (data.status !== 'COMPLETED') {
    throw new Error(`PayPal capture returned non-completed status: ${data.status}`);
  }

  return {
    captureId: data.id,
    status: data.status,
  };
}

export async function voidPayPalAuthorization(
  authorizationId: string,
  idempotencyKey?: string
): Promise<void> {
  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();
  const requestId = idempotencyKey || uuidv4();

  const response = await fetch(`${baseUrl}/v2/payments/authorizations/${authorizationId}/void`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Strictly attach PayPal-Request-Id UUID header as per Hard Rule #6
      'PayPal-Request-Id': requestId,
    },
  });

  if (!response.ok && response.status !== 204) {
    const errorText = await response.text();
    throw new Error(`PayPal Void failed (${response.status}): ${errorText}`);
  }
}

