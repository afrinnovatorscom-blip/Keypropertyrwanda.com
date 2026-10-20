import { useEffect } from 'react';

const SITE = 'Key Property Rwanda';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Client-side SEO metadata (the production server also injects these into the
 * initial HTML for crawlers). `jsonLd` is rendered as application/ld+json.
 */
export function useSeo({ title, description, image, jsonLd, noindex = false }) {
  const ld = jsonLd ? JSON.stringify(jsonLd) : null;
  useEffect(() => {
    const fullTitle = title ? (title.includes(SITE) ? title : `${title} | ${SITE}`) : SITE;
    document.title = fullTitle;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:url', window.location.href.split('?')[0]);
    if (image) setMeta('property', 'og:image', new URL(image, window.location.origin).href);
    setCanonical(window.location.origin + window.location.pathname);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

    // Replace any server-injected structured data with the current page's.
    document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
    if (ld) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = ld;
      document.head.appendChild(script);
    }
  }, [title, description, image, noindex, ld]);
}
