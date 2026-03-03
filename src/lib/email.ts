export async function sendTextEmail(to: string, subject: string, text: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'No-reply', email: 'support@nychightimes.com' },
      to: [{ email: to }],
      subject,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Brevo Error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  return await res.json();
}

export async function sendWelcomeEmail(to: string, name?: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'No-reply', email: 'support@nychightimes.com' },
      to: [{ email: to }],
      subject: 'Welcome to the Platform!',
      textContent: `Hello${name ? ` ${name}` : ''}, thanks for signing up!`,
    }),
  });

  if (!res.ok) {
    const error = await res.json();
    console.error('Failed to send email via Brevo:', error);
    throw new Error(error.message || 'Brevo email failed');
  }

  return await res.json();
}

const DEFAULT_ADMIN_NOTIFICATION_EMAIL = 'nychightimes@yahoo.com';

export function getAdminNotificationEmail() {
  const configured = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  return configured ? configured : DEFAULT_ADMIN_NOTIFICATION_EMAIL;
}

type AdminRegistrationNotificationPayload = {
  userId: string;
  status: string;
  name?: string | null;
  identifier: string;
  identifierType: 'email' | 'phone';
  createdAt?: Date | string;
};

export async function sendAdminRegistrationNotification(payload: AdminRegistrationNotificationPayload) {
  const to = getAdminNotificationEmail();
  const createdAtIso =
    payload.createdAt instanceof Date
      ? payload.createdAt.toISOString()
      : (payload.createdAt || new Date().toISOString());

  const subject = `New account registration (${payload.status})`;
  const textContent = [
    'A new account was created.',
    '',
    `Time: ${createdAtIso}`,
    `User ID: ${payload.userId}`,
    `Status: ${payload.status}`,
    `Name: ${payload.name || '(not provided)'}`,
    `${payload.identifierType === 'email' ? 'Email' : 'Phone'}: ${payload.identifier}`,
  ].join('\n');

  return await sendTextEmail(to, subject, textContent);
}

type AdminOrderNotificationPayload = {
  orderNumber: string;
  orderType: string;
  total: number;
  itemCount: number;
  userId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  createdAt?: Date | string;
};

export async function sendAdminOrderNotification(payload: AdminOrderNotificationPayload) {
  const to = getAdminNotificationEmail();
  const createdAtIso =
    payload.createdAt instanceof Date
      ? payload.createdAt.toISOString()
      : (payload.createdAt || new Date().toISOString());

  const subject = `New order created: ${payload.orderNumber}`;
  const textContent = [
    'A new order was created.',
    '',
    `Time: ${createdAtIso}`,
    `Order #: ${payload.orderNumber}`,
    `Order type: ${payload.orderType}`,
    `Total: $${Number.isFinite(payload.total) ? payload.total.toFixed(2) : String(payload.total)}`,
    `Items: ${payload.itemCount}`,
    `User ID: ${payload.userId}`,
    `Customer name: ${payload.customerName || '(not provided)'}`,
    `Customer email: ${payload.customerEmail || '(not provided)'}`,
    `Customer phone: ${payload.customerPhone || '(not provided)'}`,
  ].join('\n');

  return await sendTextEmail(to, subject, textContent);
}
