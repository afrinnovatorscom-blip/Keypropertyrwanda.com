import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { adminApi } from '@/services/adminApi';
import { ConfirmButton } from './AdminUi';

/**
 * Upload, reorder (drag & drop or arrows), caption and delete property photos.
 * The first photo is the main image.
 */
export function ImageManager({ propertyId, images: initial, canEdit }) {
  const queryClient = useQueryClient();
  const [images, setImages] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const fileInput = useRef(null);
  useEffect(() => {
    setImages(initial);
  }, [initial]);

  const refresh = (next) => {
    setImages(next);
    queryClient.invalidateQueries({ queryKey: ['admin', 'property', String(propertyId)] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'properties'] });
  };

  const upload = async (fileList) => {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      refresh(await adminApi.properties.uploadImages(propertyId, files));
      toast.success(`${files.length} photo${files.length === 1 ? '' : 's'} uploaded`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const saveOrder = async (next) => {
    const previous = images;
    setImages(next);
    try {
      refresh(await adminApi.properties.reorderImages(propertyId, next.map((i) => i.id)));
    } catch (error) {
      setImages(previous);
      toast.error(errorMessage(error));
    }
  };

  const move = (from, to) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    saveOrder(next);
  };

  const remove = async (imageId) => {
    try {
      refresh(await adminApi.properties.deleteImage(propertyId, imageId));
      toast.success('Photo deleted');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const saveAlt = async (image, altText) => {
    if ((image.altText ?? '') === altText) return;
    try {
      await adminApi.properties.updateImage(propertyId, image.id, altText);
      setImages((list) => list.map((i) => (i.id === image.id ? { ...i, altText } : i)));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
          }}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground"
        >
          <ImagePlus className="size-7" />
          <p>Drag photos here, or</p>
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            {uploading ? 'Uploading…' : 'Choose photos'}
          </Button>
          <p className="text-xs">JPEG, PNG or WebP · up to 20 at a time · the first photo is the main image</p>
          <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
      )}

      {!images.length ? (
        <p className="text-sm text-muted-foreground">No photos yet. At least one photo is required to publish.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {images.map((image, index) => (
            <li
              key={image.id}
              draggable={canEdit}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
              }}
              className={`min-w-0 overflow-hidden rounded-lg border bg-card ${dragIndex === index ? 'opacity-50' : ''}`}
            >
              <div className="relative">
                <img src={image.url} alt={image.altText ?? ''} className="aspect-[4/3] w-full object-cover" />
                {index === 0 && <Badge variant="accent" className="absolute left-2 top-2"><Star className="fill-current" /> Main</Badge>}
                {canEdit && <GripVertical className="absolute right-2 top-2 size-5 cursor-grab rounded bg-white/80 p-0.5" aria-hidden="true" />}
              </div>
              <div className="space-y-2 p-2">
                <Input
                  defaultValue={image.altText ?? ''}
                  placeholder="Caption / alt text"
                  aria-label={`Caption for photo ${index + 1}`}
                  disabled={!canEdit}
                  onBlur={(e) => saveAlt(image, e.target.value)}
                  className="h-8 text-xs"
                />
                {canEdit && (
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Move earlier"><ArrowLeft /></Button>
                      <Button type="button" size="sm" variant="ghost" disabled={index === images.length - 1} onClick={() => move(index, index + 1)} aria-label="Move later"><ArrowRight /></Button>
                      {index !== 0 && <Button type="button" size="sm" variant="ghost" onClick={() => move(index, 0)}>Set main</Button>}
                    </div>
                    <ConfirmButton variant="ghost" title="Delete this photo?" description="The file will be removed permanently." confirmLabel="Delete" onConfirm={() => remove(image.id)}>
                      <Trash2 className="text-destructive" /><span className="sr-only">Delete</span>
                    </ConfirmButton>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
