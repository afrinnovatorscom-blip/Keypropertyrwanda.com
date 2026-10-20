import { useSiteConfig } from '@/hooks/useSiteConfig';
import { generalMessage, whatsappLink } from '@/lib/whatsapp';
import { WhatsAppIcon } from './BrandIcons';

/** Floating WhatsApp contact button shown on every public page. */
export function WhatsAppFloat({ message = generalMessage }) {
  const { settings } = useSiteConfig();
  const href = whatsappLink(settings.whatsapp_number, message);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg transition hover:scale-105 hover:bg-[#1ebe5b] sm:px-5"
    >
      <WhatsAppIcon className="size-6" />
      <span className="hidden text-sm font-semibold sm:inline">WhatsApp us</span>
    </a>
  );
}
