import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // ── Create tables if not exists ─────────────────────────────────────────
    await sql`
      CREATE TABLE IF NOT EXISTS rooster_resources (
        id         TEXT PRIMARY KEY,
        name       VARCHAR(200) NOT NULL,
        role       VARCHAR(100) DEFAULT '',
        color      VARCHAR(20)  DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS rooster_shifts (
        id          TEXT PRIMARY KEY,
        resource_id TEXT NOT NULL REFERENCES rooster_resources(id) ON DELETE CASCADE,
        title       VARCHAR(200) NOT NULL,
        shift_date  DATE NOT NULL,
        start_hour  INTEGER NOT NULL DEFAULT 8,
        end_hour    INTEGER NOT NULL DEFAULT 16,
        color       VARCHAR(20) NOT NULL DEFAULT '#3B82F6',
        created_at  TIMESTAMP DEFAULT NOW()
      )
    `;

    // ── GET — return resources + shifts ─────────────────────────────────────
    if (req.method === 'GET') {
      const resources = await sql`
        SELECT id, name, role, color
        FROM rooster_resources
        ORDER BY created_at ASC
      `;

      const shifts = await sql`
        SELECT id, resource_id, title, shift_date, start_hour, end_hour, color
        FROM rooster_shifts
        ORDER BY shift_date ASC, start_hour ASC
      `;

      return res.status(200).json({ success: true, resources, shifts });
    }

    // ── POST — upsert resource or shift ─────────────────────────────────────
    if (req.method === 'POST') {
      const { type } = req.body;

      if (type === 'resource') {
        const { id, name, role, color } = req.body;
        if (!id || !name) return res.status(400).json({ success: false, error: 'id and name required' });

        await sql`
          INSERT INTO rooster_resources (id, name, role, color)
          VALUES (${id}, ${name}, ${role ?? ''}, ${color ?? '#3B82F6'})
          ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                role = EXCLUDED.role,
                color = EXCLUDED.color
        `;
        return res.status(200).json({ success: true });
      }

      if (type === 'shift') {
        const { id, resource_id, title, shift_date, start_hour, end_hour, color } = req.body;
        if (!id || !resource_id || !title || !shift_date) {
          return res.status(400).json({ success: false, error: 'id, resource_id, title, shift_date required' });
        }

        await sql`
          INSERT INTO rooster_shifts (id, resource_id, title, shift_date, start_hour, end_hour, color)
          VALUES (${id}, ${resource_id}, ${title}, ${shift_date}, ${start_hour ?? 8}, ${end_hour ?? 16}, ${color ?? '#3B82F6'})
          ON CONFLICT (id) DO UPDATE
            SET resource_id = EXCLUDED.resource_id,
                title       = EXCLUDED.title,
                shift_date  = EXCLUDED.shift_date,
                start_hour  = EXCLUDED.start_hour,
                end_hour    = EXCLUDED.end_hour,
                color       = EXCLUDED.color
        `;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'type must be "resource" or "shift"' });
    }

    // ── DELETE — remove resource or shift ───────────────────────────────────
    if (req.method === 'DELETE') {
      const { type, id } = req.query;
      if (!id) return res.status(400).json({ success: false, error: 'id required' });

      if (type === 'resource') {
        // CASCADE will also delete its shifts
        await sql`DELETE FROM rooster_resources WHERE id = ${String(id)}`;
        return res.status(200).json({ success: true });
      }

      if (type === 'shift') {
        await sql`DELETE FROM rooster_shifts WHERE id = ${String(id)}`;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'type must be "resource" or "shift"' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  } catch (err: unknown) {
    console.error('[rooster api]', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
}
