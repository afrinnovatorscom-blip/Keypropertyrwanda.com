import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/api';
import { adminApi } from '@/services/adminApi';

const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Uploads a single campaign image and reports the stored path via onChange({ path, url }). */
export function ImageUploadField({ folder, value, onChange, label = 'Upload image', aspect = 'aspect-[16/5]' }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const stored = await adminApi.uploadImage(folder, file);
      onChange(stored);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value?.url ? (
        <div className={`relative overflow-hidden rounded-lg border bg-muted ${aspect}`}>
          <img src={value.url} alt="" className="size-full object-cover" />
          <Button type="button" size="sm" variant="destructive" className="absolute right-2 top-2" onClick={() => onChange(null)}>
            <Trash2 /> Remove
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary ${aspect} min-h-24`}>
          <ImagePlus className="size-6" />
          {busy ? 'Uploading…' : label}
          <span className="text-xs">JPEG, PNG or WebP</span>
        </button>
      )}
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
