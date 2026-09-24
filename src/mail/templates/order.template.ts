import { OrderStatus } from '@prisma/client';
import { customerStatusText } from '../../orders/order-status';

export interface OrderEmailData {
  trackingId: string;
  name: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postcode: string;
  subtotalPence: number;
  discountPence: number;
  shippingPence: number;
  totalPence: number;
  promoCode: string | null;
  items: { name: string; quantity: number; unitPricePence: number }[];
}

// Names/addresses are customer-supplied, so everything is escaped before going into HTML.
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const shell = (title: string, body: string) => `
  <!DOCTYPE html>
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">${esc(title)}</h2>
      ${body}
    </body>
  </html>
`;

const trackingBox = (trackingId: string) => `
  <div style="background:#f4f4f4;border-radius:8px;padding:16px;text-align:center;margin:24px 0;">
    <div style="color:#888;font-size:12px;">Your tracking ID</div>
    <div style="font-size:22px;font-weight:bold;letter-spacing:2px;color:#1a1a1a;">${esc(trackingId)}</div>
  </div>
`;

export const orderReceiptTemplate = (o: OrderEmailData): string =>
  shell(
    'Thanks for your order',
    `
    <p style="color:#444;">Hi ${esc(o.name)}, we've received your payment. This email is your receipt.</p>
    ${trackingBox(o.trackingId)}
    <table style="width:100%;border-collapse:collapse;color:#444;">
      ${o.items
        .map(
          (i) => `<tr>
            <td style="padding:6px 0;">${esc(i.name)} × ${i.quantity}</td>
            <td style="padding:6px 0;text-align:right;">${gbp(i.unitPricePence * i.quantity)}</td>
          </tr>`,
        )
        .join('')}
      <tr><td style="padding-top:12px;">Subtotal</td><td style="padding-top:12px;text-align:right;">${gbp(o.subtotalPence)}</td></tr>
      ${o.discountPence > 0 ? `<tr><td>Discount${o.promoCode ? ` (${esc(o.promoCode)})` : ''}</td><td style="text-align:right;">-${gbp(o.discountPence)}</td></tr>` : ''}
      <tr><td>Delivery</td><td style="text-align:right;">${gbp(o.shippingPence)}</td></tr>
      <tr><td style="padding-top:8px;font-weight:bold;">Total paid</td><td style="padding-top:8px;text-align:right;font-weight:bold;">${gbp(o.totalPence)}</td></tr>
    </table>
    <p style="color:#444;margin-top:24px;"><strong>Delivering to:</strong><br/>
      ${esc(o.addressLine1)}<br/>${o.addressLine2 ? `${esc(o.addressLine2)}<br/>` : ''}${esc(o.city)}<br/>${esc(o.postcode)}</p>
    <p style="color:#444;">Use your tracking ID on our order tracking page to follow your order. Someone aged 18+ may be asked for ID on delivery of alcohol.</p>
  `,
  );

export const orderStatusTemplate = (
  o: Pick<OrderEmailData, 'trackingId' | 'name'>,
  status: OrderStatus,
): string => {
  const text = customerStatusText[status];
  return shell(
    text.title,
    `
    <p style="color:#444;">Hi ${esc(o.name)},</p>
    <p style="color:#444;">${esc(text.description)}</p>
    ${trackingBox(o.trackingId)}
  `,
  );
};
