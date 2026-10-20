import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Blend, FlipHorizontal2, MoveHorizontal, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AdminPage, ConfirmButton, useAdminMutation } from '@/components/admin/AdminUi';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { HeroCarousel } from '@/components/promotions/HeroCarousel';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { cn } from '@/lib/utils';
import { adminApi } from '@/services/adminApi';

const ANIMATIONS = [
  { value: 'slide', label: 'Slide', icon: MoveHorizontal, text: 'Slides move sideways, one replacing the other.' },
  { value: 'fade', label: 'Fade', icon: Blend, text: 'Slides cross-fade smoothly.' },
  { value: 'flip', label: 'Flip', icon: FlipHorizontal2, text: 'Slides turn over like a card.' },
];

function SlideDialog({ slide, onClose }) {
  const { control, register, handleSubmit, watch, setError, formState: { errors } } = useForm({
    defaultValues: slide
      ? {
          title: slide.title, subtitle: slide.subtitle ?? '', buttonLabel: slide.buttonLabel ?? '', buttonUrl: slide.buttonUrl ?? '',
          overlayOpacity: slide.overlayOpacity, textAlign: slide.textAlign, isActive: slide.isActive,
          image: slide.backgroundImagePath ? { path: slide.backgroundImagePath, url: slide.backgroundImage } : null,
        }
      : { title: '', subtitle: '', buttonLabel: '', buttonUrl: '', overlayOpacity: 55, textAlign: 'left', isActive: true, image: null },
  });
  const save = useAdminMutation(
    ({ image, ...v }) => {
      const body = { ...v, overlayOpacity: Number(v.overlayOpacity), backgroundImage: image?.path ?? null };
      return slide ? adminApi.hero.updateSlide(slide.id, body) : adminApi.hero.createSlide(body);
    },
    {
      success: slide ? 'Slide updated' : 'Slide added',
      invalidate: [['admin', 'hero'], ['hero']],
      onSuccess: onClose,
      onError: (e) => applyServerErrors(e, (path, err) => setError(path === 'backgroundImage' ? 'image' : path, err)),
    },
  );
  const v = watch();
  const previewSlide = { id: 1, title: v.title || 'Slide title', subtitle: v.subtitle, buttonLabel: v.buttonLabel, buttonUrl: v.buttonUrl || '#', overlayOpacity: Number(v.overlayOpacity), textAlign: v.textAlign, backgroundImage: v.image?.url };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent wide className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{slide ? 'Edit hero slide' : 'New hero slide'}</DialogTitle>
          <DialogDescription>Use a wide, high-quality photo (at least 1600×900). Text is shown on top of a dark overlay for readability.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => save.mutate(values))} className="space-y-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Heading" htmlFor="h-title" error={errors.title?.message} required><Input id="h-title" {...register('title')} /></Field>
              <Field label="Subheading" htmlFor="h-sub" error={errors.subtitle?.message}><Textarea id="h-sub" rows={3} {...register('subtitle')} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Button text (optional)" htmlFor="h-btn" error={errors.buttonLabel?.message}><Input id="h-btn" placeholder="Browse properties" {...register('buttonLabel')} /></Field>
                <Field label="Button link" htmlFor="h-url" error={errors.buttonUrl?.message} hint="/properties or https://…"><Input id="h-url" {...register('buttonUrl')} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`Overlay darkness (${v.overlayOpacity}%)`} htmlFor="h-overlay">
                  <input id="h-overlay" type="range" min="0" max="90" step="5" className="w-full accent-[var(--primary)]" {...register('overlayOpacity')} />
                </Field>
                <Field label="Text alignment" htmlFor="h-align">
                  <Select id="h-align" {...register('textAlign')}><option value="left">Left</option><option value="center">Centered</option></Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox {...register('isActive')} /> Show this slide on the homepage</label>
            </div>
            <Field label="Background image" error={errors.image?.message}>
              <Controller name="image" control={control} render={({ field }) => <ImageUploadField folder="hero" value={field.value} onChange={field.onChange} label="Upload background photo" aspect="aspect-[16/9]" />} />
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Preview</p>
            <div className="overflow-hidden rounded-xl border">
              <HeroCarousel slides={[previewSlide]} preview />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>Save slide</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function HomeHero() {
  const { can } = useAuth();
  const manage = can('content.manage');
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['admin', 'hero'], queryFn: adminApi.hero.get });
  const [settings, setSettings] = useState({ animation: 'fade', intervalSeconds: 6 });
  const [editing, setEditing] = useState(undefined);
  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data?.settings]);

  const invalidate = [['admin', 'hero'], ['hero']];
  const saveSettings = useAdminMutation(() => adminApi.hero.updateSettings({ animation: settings.animation, intervalSeconds: Number(settings.intervalSeconds) }), { success: 'Hero animation saved', invalidate });
  const toggle = useAdminMutation((slide) => adminApi.hero.updateSlide(slide.id, { isActive: !slide.isActive }), { success: (s) => (s.isActive ? 'Slide shown' : 'Slide hidden'), invalidate });
  const reorder = useAdminMutation((ids) => adminApi.hero.reorder(ids), { invalidate });
  const remove = useAdminMutation((id) => adminApi.hero.deleteSlide(id), { success: 'Slide deleted', invalidate });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const slides = data.slides;
  const activeSlides = slides.filter((s) => s.isActive);
  const dirty = settings.animation !== data.settings.animation || Number(settings.intervalSeconds) !== data.settings.intervalSeconds;
  const move = (from, to) => {
    const ids = slides.map((s) => s.id);
    const [item] = ids.splice(from, 1);
    ids.splice(to, 0, item);
    reorder.mutate(ids);
  };

  return (
    <AdminPage
      title="Home Hero"
      description="The large banner at the top of the homepage: slide text, background photos and animation."
      actions={manage && <Button onClick={() => setEditing(null)} disabled={slides.length >= 10}><Plus /> Add slide</Button>}
    >
      <Card>
        <CardHeader>
          <CardTitle>Animation</CardTitle>
          <CardDescription>How the homepage moves from one slide to the next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div role="radiogroup" aria-label="Hero animation" className="grid gap-3 sm:grid-cols-3">
            {ANIMATIONS.map(({ value, label, icon: Icon, text }) => {
              const selected = settings.animation === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!manage}
                  onClick={() => setSettings((s) => ({ ...s, animation: value }))}
                  className={cn('flex items-start gap-3 rounded-xl border-2 p-4 text-left transition', selected ? 'border-primary bg-secondary' : 'border-border hover:border-primary/50', !manage && 'cursor-not-allowed opacity-70')}
                >
                  <span className={cn('rounded-lg p-2', selected ? 'bg-primary text-primary-foreground' : 'bg-muted')}><Icon className="size-5" /></span>
                  <span>
                    <span className="block font-semibold">{label}</span>
                    <span className="block text-xs text-muted-foreground">{text}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Change slide every (seconds)" htmlFor="hero-interval" className="sm:w-60">
              <Input id="hero-interval" type="number" min="3" max="30" disabled={!manage} value={settings.intervalSeconds} onChange={(e) => setSettings((s) => ({ ...s, intervalSeconds: e.target.value }))} />
            </Field>
            {manage && <Button onClick={() => saveSettings.mutate()} disabled={!dirty || saveSettings.isPending}><Save /> Save animation</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
          <CardDescription>{activeSlides.length ? `Showing ${activeSlides.length} active slide${activeSlides.length === 1 ? '' : 's'} with the “${settings.animation}” animation (unsaved changes included). Hover to pause.` : 'No active slides — the homepage falls back to the text in Website Content → Homepage hero.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {activeSlides.length > 0 && (
            <div className="overflow-hidden rounded-xl border">
              <HeroCarousel key={settings.animation} slides={activeSlides} animation={settings.animation} intervalSeconds={Math.max(Number(settings.intervalSeconds) || 6, 3)} preview />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Slides ({slides.length}/10)</CardTitle>
          <CardDescription>Shown in this order. Hidden slides are kept but not displayed.</CardDescription>
        </CardHeader>
        <CardContent>
          {!slides.length ? (
            <EmptyState title="No slides yet" description="Add a slide with a heading and a background photo." action={manage && <Button onClick={() => setEditing(null)}><Plus /> Add slide</Button>} />
          ) : (
            <ul className="divide-y">
              {slides.map((s, i) => (
                <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                  {s.backgroundImage ? <img src={s.backgroundImage} alt="" className="h-16 w-28 shrink-0 rounded-md object-cover" /> : <div className="hero-pattern h-16 w-28 shrink-0 rounded-md" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{s.subtitle ?? '—'}</p>
                    <div className="mt-1 flex gap-1.5">
                      <StatusBadge status={s.isActive ? 'active' : 'paused'}>{s.isActive ? 'Visible' : 'Hidden'}</StatusBadge>
                      {s.buttonLabel && <StatusBadge status="scheduled">Button: {s.buttonLabel}</StatusBadge>}
                    </div>
                  </div>
                  {manage && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" disabled={i === 0 || reorder.isPending} onClick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp /></Button>
                      <Button size="sm" variant="ghost" disabled={i === slides.length - 1 || reorder.isPending} onClick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown /></Button>
                      <Button size="sm" variant="outline" onClick={() => toggle.mutate(s)}>{s.isActive ? 'Hide' : 'Show'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}><Pencil /><span className="sr-only">Edit</span></Button>
                      <ConfirmButton variant="ghost" title="Delete this slide?" confirmLabel="Delete" onConfirm={() => remove.mutate(s.id)}><Trash2 className="text-destructive" /><span className="sr-only">Delete</span></ConfirmButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing !== undefined && <SlideDialog slide={editing} onClose={() => setEditing(undefined)} />}
    </AdminPage>
  );
}
