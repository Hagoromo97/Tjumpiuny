import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Create table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL,
        shift VARCHAR(50) DEFAULT 'AM',
        delivery_points JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM routes ORDER BY created_at ASC`;
      const routes = result.map((row: Record<string, unknown>) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        shift: row.shift,
        deliveryPoints: row.delivery_points,
        updatedAt: row.updated_at,
      }));
      return res.status(200).json({ success: true, data: routes });
    }

    if (req.method === 'POST') {
      // Bulk upsert all routes (replace entire list)
      const { routes } = req.body;
      if (!Array.isArray(routes)) {
        return res.status(400).json({ success: false, error: 'routes array diperlukan' });
      }

      // Delete routes not in the new list
      const ids = routes.map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        await sql`DELETE FROM routes WHERE id != ALL(${ids}::text[])`;
      } else {
        await sql`DELETE FROM routes`;
      }

      // Upsert each route
      for (const route of routes) {
        await sql`
          INSERT INTO routes (id, name, code, shift, delivery_points, updated_at)
          VALUES (${route.id}, ${route.name}, ${route.code}, ${route.shift}, ${JSON.stringify(route.deliveryPoints)}, NOW())
          ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                code = EXCLUDED.code,
                shift = EXCLUDED.shift,
                delivery_points = EXCLUDED.delivery_points,
                updated_at = NOW()
        `;
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
