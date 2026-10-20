import { executor } from '../config/database.js';
import { bool, buildSet, likeTerm, LIVE_WINDOW, num, uploadUrl } from './helpers.js';

/** Publicly visible listing: published and not withdrawn from the market. */
export const PUBLIC_VISIBLE = "p.publication_status = 'published' AND p.availability_status <> 'unavailable'";

const SELECT_COLUMNS = `
  p.*,
  c.name AS category_name, c.slug AS category_slug, c.type_group AS category_group,
  (SELECT pi.file_path FROM property_images pi WHERE pi.property_id = p.id ORDER BY pi.sort_order, pi.id LIMIT 1) AS main_image,
  (SELECT COUNT(*) FROM property_images pi2 WHERE pi2.property_id = p.id) AS image_count,
  CASE WHEN fc.property_id IS NOT NULL AND p.publication_status = 'published' AND p.availability_status = 'available'
       THEN 1 ELSE 0 END AS is_featured,
  CASE WHEN fc.property_id IS NOT NULL AND p.publication_status = 'published' AND p.availability_status = 'available'
       THEN fc.priority ELSE 0 END AS featured_priority,
  EXISTS (
    SELECT 1 FROM hot_deals hd WHERE hd.property_id = p.id AND hd.status IN ('scheduled','active') AND ${LIVE_WINDOW('hd')}
  ) AS has_hot_deal`;

const FROM_CLAUSE = `
  FROM properties p
  JOIN property_categories c ON c.id = p.category_id
  LEFT JOIN (
    SELECT f.property_id, MAX(f.priority_in_search) AS priority
    FROM featured_property_campaigns f
    WHERE f.is_active = 1 AND ${LIVE_WINDOW('f')}
    GROUP BY f.property_id
  ) fc ON fc.property_id = p.id`;

export function mapProperty(r) {
  if (!r) return null;
  return {
    id: r.id,
    reference: r.reference,
    title: r.title,
    slug: r.slug,
    description: r.description,
    category: { id: r.category_id, name: r.category_name, slug: r.category_slug, typeGroup: r.category_group },
    purpose: r.purpose,
    price: num(r.price),
    currency: r.currency,
    pricePeriod: r.price_period,
    address: r.address,
    neighborhood: r.neighborhood,
    district: r.district,
    city: r.city,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    propertySize: num(r.property_size),
    landSize: num(r.land_size),
    videoUrl: r.video_url,
    virtualTourUrl: r.virtual_tour_url,
    availabilityStatus: r.availability_status,
    publicationStatus: r.publication_status,
    publishedAt: r.published_at,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    mainImage: uploadUrl(r.main_image),
    imageCount: r.image_count !== undefined ? Number(r.image_count) : undefined,
    isFeatured: bool(r.is_featured),
    hasHotDeal: bool(r.has_hot_deal),
  };
}

const SORTS = {
  recommended: 'featured_priority DESC, is_featured DESC, COALESCE(p.published_at, p.created_at) DESC, p.id DESC',
  newest: 'COALESCE(p.published_at, p.created_at) DESC, p.id DESC',
  oldest: 'COALESCE(p.published_at, p.created_at) ASC, p.id ASC',
  price_asc: 'p.price ASC, p.id DESC',
  price_desc: 'p.price DESC, p.id DESC',
  size_desc: 'COALESCE(p.property_size, p.land_size, 0) DESC, p.id DESC',
  updated: 'p.updated_at DESC, p.id DESC',
};

function buildFilters(filters, { publicOnly }) {
  const where = [];
  const params = [];

  if (publicOnly) {
    where.push(PUBLIC_VISIBLE);
  } else if (filters.publicationStatus) {
    where.push('p.publication_status = ?');
    params.push(filters.publicationStatus);
  } else if (!filters.includeArchived) {
    where.push("p.publication_status <> 'archived'");
  }

  if (filters.q) {
    const term = likeTerm(filters.q);
    where.push(`(p.title LIKE ? OR p.reference LIKE ? OR p.neighborhood LIKE ? OR p.district LIKE ?
      OR p.city LIKE ? OR p.description LIKE ?)`);
    params.push(term, term, term, term, term, term);
  }
  if (filters.location) {
    where.push('(p.district = ? OR p.city = ? OR p.neighborhood = ?)');
    params.push(filters.location, filters.location, filters.location);
  }
  if (filters.district) {
    where.push('p.district = ?');
    params.push(filters.district);
  }
  if (filters.category) {
    where.push('c.slug = ?');
    params.push(filters.category);
  }
  if (filters.categoryId) {
    where.push('p.category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.group) {
    where.push('c.type_group = ?');
    params.push(filters.group);
  }
  if (filters.purpose) {
    where.push('p.purpose = ?');
    params.push(filters.purpose);
  }
  if (filters.minPrice !== undefined) {
    where.push('p.price >= ?');
    params.push(filters.minPrice);
  }
  if (filters.maxPrice !== undefined) {
    where.push('p.price <= ?');
    params.push(filters.maxPrice);
  }
  if (filters.bedrooms !== undefined) {
    where.push('p.bedrooms >= ?');
    params.push(filters.bedrooms);
  }
  if (filters.bathrooms !== undefined) {
    where.push('p.bathrooms >= ?');
    params.push(filters.bathrooms);
  }
  if (filters.minSize !== undefined) {
    where.push('COALESCE(p.property_size, p.land_size) >= ?');
    params.push(filters.minSize);
  }
  if (filters.maxSize !== undefined) {
    where.push('COALESCE(p.property_size, p.land_size) <= ?');
    params.push(filters.maxSize);
  }
  if (filters.availability) {
    where.push('p.availability_status = ?');
    params.push(filters.availability);
  }
  if (filters.excludeId) {
    where.push('p.id <> ?');
    params.push(filters.excludeId);
  }
  if (filters.ids) {
    where.push('p.id IN (?)');
    params.push(filters.ids.length ? filters.ids : [0]);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export const Property = {
  SORTS: Object.keys(SORTS),

  /**
   * Search properties. `publicOnly` restricts to published listings that are
   * not marked unavailable — unpublished, draft and archived records never leak.
   */
  async search(filters, { limit, offset, publicOnly = true } = {}, conn) {
    const db = executor(conn);
    const { whereSql, params } = buildFilters(filters, { publicOnly });
    const order = SORTS[filters.sort] ?? (publicOnly ? SORTS.recommended : SORTS.updated);
    const [rows] = await db.query(
      `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} ${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${FROM_CLAUSE} ${whereSql}`, params);
    return { rows: rows.map(mapProperty), total: Number(total) };
  },

  async findById(id, conn) {
    const [rows] = await executor(conn).query(`SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} WHERE p.id = ?`, [id]);
    return mapProperty(rows[0]);
  },

  async findBySlug(slug, { publicOnly = true } = {}, conn) {
    const visibility = publicOnly ? `AND ${PUBLIC_VISIBLE}` : '';
    const [rows] = await executor(conn).query(
      `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} WHERE p.slug = ? ${visibility}`,
      [slug],
    );
    return mapProperty(rows[0]);
  },

  async findByReference(reference, conn) {
    const [rows] = await executor(conn).query(
      'SELECT id, reference, title, slug, publication_status, availability_status FROM properties WHERE reference = ?',
      [reference],
    );
    return rows[0] ?? null;
  },

  /** Minimal rows by id (used to validate campaign associations). */
  async findBasicByIds(ids, conn) {
    if (!ids.length) return [];
    const [rows] = await executor(conn).query(
      `SELECT id, reference, title, slug, price, currency, publication_status, availability_status
       FROM properties WHERE id IN (?)`,
      [ids],
    );
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      slug: r.slug,
      price: num(r.price),
      currency: r.currency,
      publicationStatus: r.publication_status,
      availabilityStatus: r.availability_status,
    }));
  },

  /** Lightweight list for admin pickers (featured / deals / promotions). */
  async options({ q, limit = 20, promotableOnly = false }, conn) {
    const where = ["p.publication_status <> 'archived'"];
    const params = [];
    if (promotableOnly) where.push("p.publication_status = 'published' AND p.availability_status = 'available'");
    if (q) {
      where.push('(p.title LIKE ? OR p.reference LIKE ?)');
      params.push(likeTerm(q), likeTerm(q));
    }
    const [rows] = await executor(conn).query(
      `SELECT p.id, p.reference, p.title, p.price, p.currency, p.publication_status, p.availability_status
       FROM properties p WHERE ${where.join(' AND ')} ORDER BY p.updated_at DESC LIMIT ?`,
      [...params, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      title: r.title,
      price: num(r.price),
      currency: r.currency,
      publicationStatus: r.publication_status,
      availabilityStatus: r.availability_status,
    }));
  },

  async slugExists(slug, excludeId = 0, conn) {
    const [rows] = await executor(conn).query('SELECT id FROM properties WHERE slug = ? AND id <> ?', [
      slug,
      excludeId,
    ]);
    return rows.length > 0;
  },

  async create(data, conn) {
    const db = executor(conn);
    const [result] = await db.query(
      `INSERT INTO properties (title, slug, description, category_id, purpose, price, currency, price_period,
         address, neighborhood, district, city, latitude, longitude, bedrooms, bathrooms, property_size, land_size,
         video_url, virtual_tour_url, availability_status, publication_status, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      [
        data.title,
        data.slug,
        data.description,
        data.categoryId,
        data.purpose,
        data.price,
        data.currency,
        data.pricePeriod,
        data.address ?? null,
        data.neighborhood ?? null,
        data.district,
        data.city,
        data.latitude ?? null,
        data.longitude ?? null,
        data.bedrooms ?? null,
        data.bathrooms ?? null,
        data.propertySize ?? null,
        data.landSize ?? null,
        data.videoUrl ?? null,
        data.virtualTourUrl ?? null,
        data.availabilityStatus ?? 'available',
        data.userId ?? null,
        data.userId ?? null,
      ],
    );
    const id = result.insertId;
    // Human-friendly unique reference derived from the primary key.
    await db.query('UPDATE properties SET reference = ? WHERE id = ?', [`KPR-${String(id).padStart(5, '0')}`, id]);
    return id;
  },

  async update(id, data, conn) {
    const set = buildSet(
      {
        title: 'title',
        slug: 'slug',
        description: 'description',
        categoryId: 'category_id',
        purpose: 'purpose',
        price: 'price',
        currency: 'currency',
        pricePeriod: 'price_period',
        address: 'address',
        neighborhood: 'neighborhood',
        district: 'district',
        city: 'city',
        latitude: 'latitude',
        longitude: 'longitude',
        bedrooms: 'bedrooms',
        bathrooms: 'bathrooms',
        propertySize: 'property_size',
        landSize: 'land_size',
        videoUrl: 'video_url',
        virtualTourUrl: 'virtual_tour_url',
        updatedBy: 'updated_by',
      },
      data,
    );
    if (!set) return;
    await executor(conn).query(`UPDATE properties SET ${set.sql} WHERE id = ?`, [...set.params, id]);
  },

  async setPublicationStatus(id, status, userId, conn) {
    const extra =
      status === 'published'
        ? ', published_at = COALESCE(published_at, NOW()), archived_at = NULL'
        : status === 'archived'
          ? ', archived_at = NOW()'
          : ', archived_at = NULL';
    await executor(conn).query(
      `UPDATE properties SET publication_status = ?, updated_by = ? ${extra} WHERE id = ?`,
      [status, userId ?? null, id],
    );
  },

  async setAvailability(id, status, userId, conn) {
    await executor(conn).query('UPDATE properties SET availability_status = ?, updated_by = ? WHERE id = ?', [
      status,
      userId ?? null,
      id,
    ]);
  },

  /** Published listings similar to the given one (same category, then same purpose / district). */
  async related(property, limit = 4, conn) {
    const [rows] = await executor(conn).query(
      `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE}
       WHERE ${PUBLIC_VISIBLE} AND p.id <> ? AND (p.category_id = ? OR p.district = ?)
       ORDER BY (p.category_id = ?) DESC, (p.purpose = ?) DESC, (p.district = ?) DESC,
                ABS(p.price - ?) ASC
       LIMIT ?`,
      [
        property.id,
        property.category.id,
        property.district,
        property.category.id,
        property.purpose,
        property.district,
        property.price,
        limit,
      ],
    );
    return rows.map(mapProperty);
  },

  /** Distinct public locations with listing counts (for the location selector). */
  async publicLocations(conn) {
    const [rows] = await executor(conn).query(
      `SELECT p.district, p.city, COUNT(*) AS n FROM properties p WHERE ${PUBLIC_VISIBLE}
       GROUP BY p.district, p.city ORDER BY n DESC, p.district`,
    );
    return rows.map((r) => ({ district: r.district, city: r.city, count: Number(r.n) }));
  },

  async publicSlugs(conn) {
    const [rows] = await executor(conn).query(
      `SELECT p.slug, p.updated_at FROM properties p WHERE ${PUBLIC_VISIBLE} ORDER BY p.updated_at DESC`,
    );
    return rows.map((r) => ({ slug: r.slug, updatedAt: r.updated_at }));
  },

  async stats(conn) {
    const [[row]] = await executor(conn).query(
      `SELECT
         COUNT(*) AS total,
         SUM(publication_status = 'published') AS published,
         SUM(publication_status = 'draft') AS drafts,
         SUM(publication_status = 'unpublished') AS unpublished,
         SUM(publication_status = 'archived') AS archived,
         SUM(publication_status <> 'archived' AND purpose = 'sale') AS for_sale,
         SUM(publication_status <> 'archived' AND purpose = 'rent') AS for_rent,
         SUM(publication_status = 'published' AND purpose = 'sale' AND availability_status = 'available') AS live_for_sale,
         SUM(publication_status = 'published' AND purpose = 'rent' AND availability_status = 'available') AS live_for_rent,
         SUM(availability_status = 'sold') AS sold,
         SUM(availability_status = 'rented') AS rented
       FROM properties`,
    );
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v ?? 0)]));
  },

  async exportRows(filters, conn) {
    const { whereSql, params } = buildFilters(filters, { publicOnly: false });
    const [rows] = await executor(conn).query(
      `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE} ${whereSql} ORDER BY p.id LIMIT 10000`,
      params,
    );
    return rows.map(mapProperty);
  },
};

export default Property;
