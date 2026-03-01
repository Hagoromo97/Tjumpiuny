import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      // Buat table jika belum ada
      await sql`
        CREATE TABLE IF NOT EXISTS deliveries (
          id SERIAL PRIMARY KEY,
          tracking_no VARCHAR(100) UNIQUE NOT NULL,
          recipient_name VARCHAR(255),
          address TEXT,
          status VARCHAR(50) DEFAULT 'pending',
          delivery_date DATE,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;

      const deliveries = await sql`
        SELECT * FROM deliveries ORDER BY created_at DESC
      `;
      return res.status(200).json({ success: true, data: deliveries });
    }

    if (req.method === 'POST') {
      const { tracking_no, recipient_name, address, status, delivery_date, notes } = req.body;

      if (!tracking_no) {
        return res.status(400).json({ success: false, error: 'tracking_no diperlukan' });
      }

      const result = await sql`
        INSERT INTO deliveries (tracking_no, recipient_name, address, status, delivery_date, notes)
        VALUES (${tracking_no}, ${recipient_name}, ${address}, ${status ?? 'pending'}, ${delivery_date}, ${notes})
        ON CONFLICT (tracking_no) DO UPDATE
          SET recipient_name = EXCLUDED.recipient_name,
              address        = EXCLUDED.address,
              status         = EXCLUDED.status,
              delivery_date  = EXCLUDED.delivery_date,
              notes          = EXCLUDED.notes,
              updated_at     = NOW()
        RETURNING *
      `;
      return res.status(200).json({ success: true, data: result[0] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id diperlukan' });

      await sql`DELETE FROM deliveries WHERE id = ${Number(id)}`;
      return res.status(200).json({ success: true, message: 'Delivery dipadam' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
