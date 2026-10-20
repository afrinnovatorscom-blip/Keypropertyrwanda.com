/** Keep only digits (WhatsApp click-to-chat requires the international number without "+"). */
export function normalizeWhatsAppNumber(number) {
  return String(number ?? '').replace(/\D/g, '');
}

/** Build the default inquiry message for a property. */
export function propertyWhatsAppMessage(property, siteUrl) {
  const lines = [
    `Hello Key Property Rwanda, I am interested in "${property.title}"`,
    property.reference ? `Reference: ${property.reference}` : null,
    siteUrl && property.slug ? `${siteUrl.replace(/\/$/, '')}/property/${property.slug}` : null,
    'Please share more details.',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Build a https://wa.me link with a properly URI-encoded message. */
export function buildWhatsAppLink(number, message) {
  const digits = normalizeWhatsAppNumber(number);
  if (!digits) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}
