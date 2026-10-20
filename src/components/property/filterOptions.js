import { formatMoney } from '@/lib/format';

export const SALE_PRICES = [10e6, 25e6, 50e6, 100e6, 200e6, 350e6, 500e6, 1e9];
export const RENT_PRICES = [100e3, 250e3, 500e3, 750e3, 1e6, 2e6, 5e6];

export const priceOptions = (purpose) => (purpose === 'rent' ? RENT_PRICES : purpose === 'sale' ? SALE_PRICES : [...RENT_PRICES.slice(0, 4), ...SALE_PRICES]);

export const shortMoney = (n) => {
  if (n >= 1e9) return `${n / 1e9}B RWF`;
  if (n >= 1e6) return `${n / 1e6}M RWF`;
  if (n >= 1e3) return `${n / 1e3}K RWF`;
  return formatMoney(n);
};

export const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'size_desc', label: 'Largest first' },
];

export const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'under_offer', label: 'Under offer' },
  { value: 'sold', label: 'Sold' },
  { value: 'rented', label: 'Rented' },
];

/** Filter keys that live in the URL query string. */
export const FILTER_KEYS = ['q', 'location', 'category', 'purpose', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'minSize', 'maxSize', 'availability'];

export function describeFilter(key, value, categories = []) {
  switch (key) {
    case 'q': return `“${value}”`;
    case 'location': return value;
    case 'category': return categories.find((c) => c.slug === value)?.name ?? value;
    case 'purpose': return value === 'rent' ? 'For rent' : 'For sale';
    case 'minPrice': return `Min ${shortMoney(Number(value))}`;
    case 'maxPrice': return `Max ${shortMoney(Number(value))}`;
    case 'bedrooms': return `${value}+ bedrooms`;
    case 'bathrooms': return `${value}+ bathrooms`;
    case 'minSize': return `≥ ${value} m²`;
    case 'maxSize': return `≤ ${value} m²`;
    case 'availability': return AVAILABILITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
    default: return value;
  }
}
