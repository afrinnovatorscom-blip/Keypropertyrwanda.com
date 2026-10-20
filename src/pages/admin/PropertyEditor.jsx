import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowLeft, ExternalLink, Eye, EyeOff, RotateCcw, Save, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { AdminPage, ConfirmButton, useAdminMutation } from '@/components/admin/AdminUi';
import { ImageManager } from '@/components/admin/ImageManager';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, ErrorState, Spinner } from '@/components/ui/feedback';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { applyServerErrors } from '@/lib/api';
import { formatDateTime, label, LABELS } from '@/lib/format';
import { adminApi } from '@/services/adminApi';

const schema = z.object({
  title: z.string().trim().min(5, 'At least 5 characters').max(200),
  slug: z.string().trim().max(200).optional(),
  description: z.string().trim().min(20, 'At least 20 characters'),
  categoryId: z.string().min(1, 'Choose a category'),
  purpose: z.enum(['sale', 'rent']),
  price: z.string().min(1, 'Enter a price').refine((v) => Number(v) > 0, 'Price must be greater than zero'),
  currency: z.enum(['RWF', 'USD', 'EUR']),
  pricePeriod: z.enum(['total', 'month', 'year', 'night']),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  district: z.string().trim().min(2, 'Required'),
  city: z.string().trim().min(2, 'Required'),
  bedrooms: z.string().optional(),
  bathrooms: z.string().optional(),
  propertySize: z.string().optional(),
  landSize: z.string().optional(),
  videoUrl: z.string().optional(),
  virtualTourUrl: z.string().optional(),
  availabilityStatus: z.string().optional(),
});

const str = (v) => (v === null || v === undefined ? '' : String(v));
const toForm = (p) => ({
  title: p.title, slug: p.slug, description: p.description, categoryId: str(p.category.id), purpose: p.purpose,
  price: str(p.price), currency: p.currency, pricePeriod: p.pricePeriod, address: str(p.address), neighborhood: str(p.neighborhood),
  district: p.district, city: p.city, bedrooms: str(p.bedrooms), bathrooms: str(p.bathrooms), propertySize: str(p.propertySize),
  landSize: str(p.landSize), videoUrl: str(p.videoUrl), virtualTourUrl: str(p.virtualTourUrl), availabilityStatus: p.availabilityStatus,
});

const EMPTY = { title: '', slug: '', description: '', categoryId: '', purpose: 'sale', price: '', currency: 'RWF', pricePeriod: 'total', address: '', neighborhood: '', district: '', city: 'Kigali', bedrooms: '', bathrooms: '', propertySize: '', landSize: '', videoUrl: '', virtualTourUrl: '', availabilityStatus: 'available' };

function AmenitiesInput({ value, onChange, suggestions }) {
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const name = raw.trim();
    if (name && !value.some((v) => v.toLowerCase() === name.toLowerCase())) onChange([...value, name]);
    setDraft('');
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs">
            {a}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== a))} aria-label={`Remove ${a}`}><X className="size-3" /></button>
          </span>
        ))}
      </div>
      <Input
        list="amenity-suggestions"
        value={draft}
        placeholder="Type an amenity and press Enter (e.g. Swimming pool)"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft && add(draft)}
      />
      <datalist id="amenity-suggestions">{suggestions.map((s) => <option key={s.id} value={s.name} />)}</datalist>
    </div>
  );
}

export default function PropertyEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { can } = useAuth();
  const [amenities, setAmenities] = useState([]);

  const { data: property, isLoading, error } = useQuery({
    queryKey: ['admin', 'property', id],
    queryFn: () => adminApi.properties.get(id),
    enabled: !isNew,
  });
  const { data: categories = [], isSuccess: categoriesLoaded } = useQuery({ queryKey: ['admin', 'categories'], queryFn: adminApi.categories.list });
  const { data: amenityOptions = [] } = useQuery({ queryKey: ['admin', 'amenities'], queryFn: adminApi.amenities });

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const { register, handleSubmit, reset, setError, watch, formState: { errors, isDirty } } = form;
  useEffect(() => {
    // Wait for the category options, otherwise the select cannot show the stored value.
    if (property && categoriesLoaded) {
      // Refetches (after image or status changes) must not discard unsaved edits.
      reset(toForm(property), { keepDirtyValues: true });
      setAmenities(property.amenities ?? []);
    }
  }, [property, categoriesLoaded, reset]);

  const save = useAdminMutation(
    (values) => {
      const body = { ...values, amenities };
      if (isNew) return adminApi.properties.create(body);
      if (!can('properties.change_price')) {
        delete body.price;
        delete body.currency;
        delete body.pricePeriod;
      }
      // Availability has its own control in the status panel.
      delete body.availabilityStatus;
      return adminApi.properties.update(id, body);
    },
    {
      success: isNew ? 'Draft saved — now add photos' : 'Changes saved',
      invalidate: [['admin', 'properties'], ['admin', 'dashboard'], ['admin', 'amenities']],
      onSuccess: (saved) => {
        if (isNew) navigate(`/admin/properties/${saved.id}`, { replace: true });
        else reset(toForm(saved));
      },
      onError: (err) => applyServerErrors(err, setError),
    },
  );

  const action = useAdminMutation(({ name, status }) => (name === 'availability' ? adminApi.properties.setAvailability(id, status) : adminApi.properties.action(id, name)), {
    success: (_d, { name }) => ({ publish: 'Property published', unpublish: 'Property unpublished', archive: 'Property archived', restore: 'Property restored', availability: 'Availability updated' })[name],
    invalidate: [['admin', 'property', id], ['admin', 'properties'], ['admin', 'dashboard']],
  });

  if ((!isNew && isLoading) || !categoriesLoaded) return <Spinner />;
  if (error) return <ErrorState error={error} />;

  const archived = property?.publicationStatus === 'archived';
  const canEditFields = isNew ? can('properties.create') : can('properties.edit') && !archived;
  const priceLocked = !isNew && !can('properties.change_price');
  const purpose = watch('purpose');
  const categoryGroup = categories.find((c) => String(c.id) === watch('categoryId'))?.typeGroup;

  return (
    <AdminPage
      title={isNew ? 'New property' : property.title}
      description={isNew ? 'Save as a draft first, then upload photos and publish.' : `${property.reference} · last updated ${formatDateTime(property.updatedAt)}`}
      actions={
        <>
          <Button asChild variant="outline"><Link to="/admin/properties"><ArrowLeft /> All properties</Link></Button>
          {!isNew && <Button asChild variant="outline"><Link to={`/admin/properties/${id}/preview`}><Eye /> Preview</Link></Button>}
        </>
      }
    >
      {archived && <Alert variant="warning" title="This property is archived">Restore it to make changes. Its inquiries and campaign history are preserved.</Alert>}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <form onSubmit={handleSubmit((v) => save.mutate(v))} noValidate className="min-w-0 space-y-6">
          <fieldset disabled={!canEditFields} className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Listing details</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Title" htmlFor="title" error={errors.title?.message} required className="sm:col-span-2">
                  <Input id="title" aria-invalid={!!errors.title} {...register('title')} />
                </Field>
                <Field label="URL slug" htmlFor="slug" error={errors.slug?.message} hint={isNew ? 'Leave empty to generate from the title.' : 'Changing the slug changes the public URL.'} className="sm:col-span-2">
                  <Input id="slug" {...register('slug')} placeholder="modern-4-bedroom-house-kibagabaga" />
                </Field>
                <Field label="Category" htmlFor="categoryId" error={errors.categoryId?.message} required>
                  <Select id="categoryId" aria-invalid={!!errors.categoryId} {...register('categoryId')}>
                    <option value="">Choose…</option>
                    {categories.filter((c) => c.isActive || String(c.id) === watch('categoryId')).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Listing purpose" htmlFor="purpose" required>
                  <Select id="purpose" {...register('purpose')}>
                    <option value="sale">For sale</option>
                    <option value="rent">For rent</option>
                  </Select>
                </Field>
                <Field label="Description" htmlFor="description" error={errors.description?.message} required className="sm:col-span-2">
                  <Textarea id="description" rows={8} aria-invalid={!!errors.description} {...register('description')} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Price</CardTitle>
                {priceLocked && <p className="text-xs text-muted-foreground">Your role cannot change prices.</p>}
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <Field label="Price" htmlFor="price" error={errors.price?.message} required>
                  <Input id="price" type="number" min="0" step="any" disabled={priceLocked} aria-invalid={!!errors.price} {...register('price')} />
                </Field>
                <Field label="Currency" htmlFor="currency">
                  <Select id="currency" disabled={priceLocked} {...register('currency')}>
                    <option value="RWF">RWF</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </Field>
                <Field label="Price period" htmlFor="pricePeriod" error={errors.pricePeriod?.message}>
                  <Select id="pricePeriod" disabled={priceLocked} {...register('pricePeriod')}>
                    {Object.entries(LABELS.period).filter(([v]) => purpose === 'rent' || v === 'total').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Location</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="District" htmlFor="district" error={errors.district?.message} required>
                  <Input id="district" placeholder="Gasabo" aria-invalid={!!errors.district} {...register('district')} />
                </Field>
                <Field label="City" htmlFor="city" error={errors.city?.message} required>
                  <Input id="city" aria-invalid={!!errors.city} {...register('city')} />
                </Field>
                <Field label="Neighbourhood" htmlFor="neighborhood" error={errors.neighborhood?.message}>
                  <Input id="neighborhood" placeholder="Kibagabaga" {...register('neighborhood')} />
                </Field>
                <Field label="Street address" htmlFor="address" error={errors.address?.message}>
                  <Input id="address" placeholder="KG 123 St" {...register('address')} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Specifications</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-4">
                {categoryGroup !== 'land' && (
                  <>
                    <Field label="Bedrooms" htmlFor="bedrooms" error={errors.bedrooms?.message}><Input id="bedrooms" type="number" min="0" {...register('bedrooms')} /></Field>
                    <Field label="Bathrooms" htmlFor="bathrooms" error={errors.bathrooms?.message}><Input id="bathrooms" type="number" min="0" {...register('bathrooms')} /></Field>
                    <Field label="Property size (m²)" htmlFor="propertySize" error={errors.propertySize?.message}><Input id="propertySize" type="number" min="0" step="any" {...register('propertySize')} /></Field>
                  </>
                )}
                <Field label="Land size (m²)" htmlFor="landSize" error={errors.landSize?.message}><Input id="landSize" type="number" min="0" step="any" {...register('landSize')} /></Field>
                <Field label="Amenities" className="sm:col-span-4">
                  <AmenitiesInput value={amenities} onChange={setAmenities} suggestions={amenityOptions} />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Video & virtual tour</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Video URL" htmlFor="videoUrl" error={errors.videoUrl?.message} hint="YouTube or Vimeo links are embedded.">
                  <Input id="videoUrl" type="url" placeholder="https://www.youtube.com/watch?v=…" {...register('videoUrl')} />
                </Field>
                <Field label="Virtual tour URL" htmlFor="virtualTourUrl" error={errors.virtualTourUrl?.message}>
                  <Input id="virtualTourUrl" type="url" placeholder="https://…" {...register('virtualTourUrl')} />
                </Field>
              </CardContent>
            </Card>
          </fieldset>

          {canEditFields && (
            <div className="sticky bottom-0 z-10 -mx-1 flex justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur">
              <Button type="submit" disabled={save.isPending || (!isNew && !isDirty && amenities.join() === (property?.amenities ?? []).join())}>
                <Save /> {save.isPending ? 'Saving…' : isNew ? 'Save draft' : 'Save changes'}
              </Button>
            </div>
          )}
        </form>

        {!isNew && (
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader><CardTitle>Status</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Publication</span>
                  <StatusBadge status={property.publicationStatus}>{label('publication', property.publicationStatus)}</StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can('properties.publish') && !archived && property.publicationStatus !== 'published' && (
                    <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ name: 'publish' })}><Send /> Publish</Button>
                  )}
                  {can('properties.publish') && property.publicationStatus === 'published' && (
                    <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ name: 'unpublish' })}><EyeOff /> Unpublish</Button>
                  )}
                  {property.publicationStatus === 'published' && (
                    <Button asChild size="sm" variant="ghost"><a href={`/property/${property.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink /> View live</a></Button>
                  )}
                </div>
                <Field label="Availability" htmlFor="availability" hint={can('properties.change_availability') ? 'Sold, rented or unavailable ends running hot deals.' : 'Your role cannot change availability.'}>
                  <Select
                    id="availability"
                    value={property.availabilityStatus}
                    disabled={!can('properties.change_availability') || archived || action.isPending}
                    onChange={(e) => action.mutate({ name: 'availability', status: e.target.value })}
                  >
                    {Object.entries(LABELS.availability).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                </Field>
                {can('properties.archive') && (
                  <div className="border-t pt-4">
                    {archived ? (
                      <Button size="sm" variant="outline" onClick={() => action.mutate({ name: 'restore' })}><RotateCcw /> Restore property</Button>
                    ) : (
                      <ConfirmButton title="Archive this property?" description="It will be hidden from the website; running hot deals end and featured placements are deactivated. Inquiries and campaign history are kept." confirmLabel="Archive" onConfirm={() => action.mutate({ name: 'archive' })}>
                        <Archive /> Archive property
                      </ConfirmButton>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Photos ({property.images.length})</CardTitle></CardHeader>
              <CardContent>
                <ImageManager propertyId={property.id} images={property.images} canEdit={can('properties.edit') && !archived} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
