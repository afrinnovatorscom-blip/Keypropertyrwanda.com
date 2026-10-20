import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function SectionHeading({ eyebrow, title, description, link, linkLabel = 'View all', className }) {
  return (
    <div className={cn('mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </div>
      {link && (
        <Link to={link} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {linkLabel} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export function PageHero({ title, description, eyebrow, children }) {
  return (
    <section className="hero-pattern text-white">
      <div className="container-page py-12 sm:py-16">
        {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-white/80">{description}</p>}
        {children}
      </div>
    </section>
  );
}

/** Renders admin-managed plain text: blank-line paragraphs, "- " lists and short heading lines. */
export function RichText({ text, className }) {
  const blocks = String(text ?? '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={cn('prose-content', className)}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const heading = lines.length > 1 && lines[0].length < 60 && !/[.:!?]$/.test(lines[0]) ? lines.shift() : null;
        const isList = lines.every((l) => l.trim().startsWith('- '));
        return (
          <div key={i}>
            {heading && <h2>{heading}</h2>}
            {isList ? (
              <ul>{lines.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>
            ) : lines.length === 1 && !heading && lines[0].length < 60 && !/[.:!?]$/.test(lines[0]) ? (
              <h2>{lines[0]}</h2>
            ) : (
              <p className="whitespace-pre-line">{lines.join('\n')}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
