/** Build a click-to-chat link with a URI-encoded message. Returns null without a number. */
export function whatsappLink(number, message) {
  const digits = String(number ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function propertyMessage(property) {
  const url = typeof window !== 'undefined' ? `${window.location.origin}/property/${property.slug}` : '';
  return [
    `Hello Key Property Rwanda, I am interested in "${property.title}"`,
    property.reference ? `Reference: ${property.reference}` : null,
    url,
    'Please share more details.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const generalMessage = 'Hello Key Property Rwanda, I would like some help finding a property.';
