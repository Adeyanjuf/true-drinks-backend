export interface LowStockProduct {
  name: string;
  stock: number;
  lowStockThreshold: number;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

export const lowStockTemplate = (products: LowStockProduct[]): string => `
  <!DOCTYPE html>
  <html>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1a1a1a;">Low stock warning</h2>
      <p style="color: #444;">These products have dropped to or below their low-stock threshold:</p>
      <table style="width:100%;border-collapse:collapse;color:#444;">
        <tr style="text-align:left;"><th>Product</th><th>In stock</th><th>Threshold</th></tr>
        ${products
          .map(
            (p) =>
              `<tr><td style="padding:6px 0;">${esc(p.name)}</td><td style="color:${p.stock === 0 ? '#c00' : '#444'};">${p.stock === 0 ? 'OUT OF STOCK' : p.stock}</td><td>${p.lowStockThreshold}</td></tr>`,
          )
          .join('')}
      </table>
    </body>
  </html>
`;
