import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/** Main photo + thumbnails, with a full-screen lightbox. */
export function PropertyGallery({ images, title }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  if (!images?.length) {
    return <div className="flex aspect-[16/10] items-center justify-center rounded-xl bg-muted text-muted-foreground">No photos available</div>;
  }
  const current = images[Math.min(index, images.length - 1)];
  const go = (delta) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-xl bg-muted">
        <img src={current.url} alt={current.altText || title} className="aspect-[16/10] w-full object-cover" />
        <button type="button" onClick={() => setOpen(true)} className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white hover:bg-black/75">
          <Expand className="size-3.5" /> View {images.length} photo{images.length === 1 ? '' : 's'}
        </button>
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2 shadow hover:bg-white">
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`shrink-0 overflow-hidden rounded-md border-2 ${i === index ? 'border-primary' : 'border-transparent opacity-75 hover:opacity-100'}`}
            >
              <img src={img.url} alt="" loading="lazy" className="h-16 w-24 object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide className="max-w-5xl bg-black p-2 sm:p-3">
          <DialogTitle className="sr-only">{title} — photos</DialogTitle>
          <div className="relative">
            <img src={current.url} alt={current.altText || title} className="max-h-[80vh] w-full rounded object-contain" />
            {images.length > 1 && (
              <>
                <button type="button" aria-label="Previous photo" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2"><ChevronLeft className="size-5" /></button>
                <button type="button" aria-label="Next photo" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-2"><ChevronRight className="size-5" /></button>
              </>
            )}
          </div>
          <p className="text-center text-sm text-white/80">{index + 1} / {images.length}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
