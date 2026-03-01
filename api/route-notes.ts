import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS route_notes (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'note',
        text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_route_notes_route_id ON route_notes(route_id)
    `;

    if (req.method === 'GET') {
      const { routeId } = req.query;
      if (!routeId || typeof routeId !== 'string') {
        return res.status(400).json({ success: false, error: 'routeId diperlukan' });
      }
      const notes = await sql`
        SELECT * FROM route_notes
        WHERE route_id = ${routeId} AND type = 'note'
        ORDER BY created_at DESC
      `;
      const changelog = await sql`
        SELECT * FROM route_notes
        WHERE route_id = ${routeId} AND type = 'changelog'
        ORDER BY created_at DESC
        LIMIT 200
      `;
      return res.status(200).json({ success: true, notes, changelog });
    }

    if (req.method === 'POST') {
      const { id, routeId, type, text } = req.body;
      if (!id || !routeId || !type || !text) {
        return res.status(400).json({ success: false, error: 'id, routeId, type, text diperlukan' });
      }
      await sql`
        INSERT INTO route_notes (id, route_id, type, text)
        VALUES (${id}, ${routeId}, ${type}, ${text})
        ON CONFLICT (id) DO NOTHING
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ success: false, error: 'id diperlukan' });
      }
      await sql`DELETE FROM route_notes WHERE id = ${id} AND type = 'note'`;
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} tidak dibenarkan` });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
