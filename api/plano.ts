import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS plano_vm (
        id TEXT PRIMARY KEY,
        pages JSONB DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Ensure default row exists
    await sql`
      INSERT INTO plano_vm (id, pages)
      VALUES ('default', '[]')
      ON CONFLICT (id) DO NOTHING
    `;

    if (req.method === 'GET') {
      const result = await sql`SELECT pages FROM plano_vm WHERE id = 'default'`;
      const pages = result[0]?.pages ?? [];
      return res.status(200).json({ success: true, data: pages });
    }

    if (req.method === 'POST') {
      const { pages } = req.body;
      if (!Array.isArray(pages)) {
        return res.status(400).json({ success: false, error: 'pages array diperlukan' });
      }

      await sql`
        UPDATE plano_vm
        SET pages = ${JSON.stringify(pages)}, updated_at = NOW()
        WHERE id = 'default'
      `;

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
