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

function isMockMode(): boolean {
  const { clientId, secret } = getCredentials();
  return (
    !clientId ||
    !secret ||
    clientId.includes('your_paypal') ||
    secret.includes('your_paypal')
  );
}

export async function getPayPalAccessToken(): Promise<string> {
  if (isMockMode()) {
    return 'mock_sandbox_access_token';
  }

  // Check cached token (with 60-second buffer)
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 60000) {
    return tokenCache.token;
  }

  const { clientId, secret } = getCredentials();
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

export async function createPayPalOrder(params: CreateOrderParams): Promise<{ id: string }> {
  if (isMockMode()) {
    console.warn('[PayPal] Mock mode active: returning simulated orderId.');
    return { id: `MOCK_ORDER_${uuidv4().substring(0, 12).toUpperCase()}` };
  }

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

export async function authorizePayPalOrder(orderId: string): Promise<AuthorizeOrderResult> {
  if (isMockMode()) {
    console.warn('[PayPal] Mock mode active: returning simulated authorizationId.');
    return {
      authorizationId: `MOCK_AUTH_${uuidv4().substring(0, 12).toUpperCase()}`,
      status: 'CREATED',
    };
  }

  const token = await getPayPalAccessToken();
  const baseUrl = getPayPalBaseUrl();

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/authorize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

  return {
    authorizationId: authorization.id,
    status: authorization.status || 'CREATED',
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
  if (isMockMode()) {
    console.warn('[PayPal] Mock mode active: returning simulated captureId.');
    return {
      captureId: `MOCK_CAP_${uuidv4().substring(0, 12).toUpperCase()}`,
      status: 'COMPLETED',
    };
  }

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
  return {
    captureId: data.id,
    status: data.status || 'COMPLETED',
  };
}

export async function voidPayPalAuthorization(
  authorizationId: string,
  idempotencyKey?: string
): Promise<void> {
  if (isMockMode()) {
    console.warn('[PayPal] Mock mode active: simulated void successful.');
    return;
  }

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

