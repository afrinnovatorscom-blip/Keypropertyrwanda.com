import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { getAttribution } from '@/lib/analytics';
import { applyServerErrors, errorMessage } from '@/lib/api';
import { publicApi } from '@/services/publicApi';

const schema = z
  .object({
    customerName: z.string().trim().min(2, 'Please enter your name').max(120),
    phone: z.string().trim().regex(/^\+?[0-9\s()-]{7,30}$/, 'Enter a valid phone number'),
    email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]),
    preferredContact: z.enum(['phone', 'email', 'whatsapp']),
    message: z.string().trim().min(10, 'Please write at least 10 characters').max(3000),
    consent: z.boolean().refine((v) => v, 'Please agree so we can contact you'),
    website: z.string().optional(),
  })
  .refine((v) => v.preferredContact !== 'email' || v.email, { message: 'Add your email to be contacted by email', path: ['email'] });

/**
 * Inquiry form (stored in MySQL via the public API). Includes a hidden
 * honeypot field and fill-time measurement for spam protection.
 */
export function InquiryForm({ property, hotDealId, source = 'website', defaultMessage, compact = false }) {
  const startedAt = useRef(Date.now());
  const [reference, setReference] = useState(null);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      preferredContact: 'phone',
      message: defaultMessage ?? (property ? `Hello, I am interested in "${property.title}" (Ref: ${property.reference}). Please contact me with more details.` : ''),
      consent: false,
      website: '',
    },
  });
  const { register, handleSubmit, formState: { errors }, setError, reset } = form;

  const mutation = useMutation({
    mutationFn: (values) => {
      const attribution = getAttribution();
      return publicApi.submitInquiry({
        ...values,
        propertySlug: property?.slug,
        source,
        hotDealId: hotDealId ?? attribution.hotDealId,
        advertisementId: attribution.advertisementId,
        promotionId: attribution.promotionId,
        elapsedMs: Date.now() - startedAt.current,
      });
    },
    onSuccess: (data) => {
      setReference(data.reference ?? 'received');
      reset();
    },
    onError: (error) => applyServerErrors(error, setError),
  });

  if (reference) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900" role="status">
        <CheckCircle2 className="mb-2 size-7" />
        <p className="font-semibold">Thank you — your inquiry has been sent.</p>
        <p className="mt-1 text-sm">Our team will contact you shortly{reference !== 'received' ? ` (reference ${reference})` : ''}.</p>
        <Button variant="link" className="mt-2 h-auto p-0" onClick={() => { setReference(null); startedAt.current = Date.now(); }}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="space-y-4">
      {mutation.isError && !mutation.error?.details && <Alert variant="error">{errorMessage(mutation.error)}</Alert>}
      <div className={compact ? 'space-y-4' : 'grid gap-4 sm:grid-cols-2'}>
        <Field label="Full name" htmlFor="inq-name" error={errors.customerName?.message} required>
          <Input id="inq-name" autoComplete="name" aria-invalid={!!errors.customerName} {...register('customerName')} />
        </Field>
        <Field label="Phone" htmlFor="inq-phone" error={errors.phone?.message} required>
          <Input id="inq-phone" type="tel" autoComplete="tel" placeholder="+250 7xx xxx xxx" aria-invalid={!!errors.phone} {...register('phone')} />
        </Field>
        <Field label="Email" htmlFor="inq-email" error={errors.email?.message}>
          <Input id="inq-email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Preferred contact" htmlFor="inq-contact" error={errors.preferredContact?.message}>
          <Select id="inq-contact" {...register('preferredContact')}>
            <option value="phone">Phone call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </Select>
        </Field>
      </div>
      <Field label="Message" htmlFor="inq-message" error={errors.message?.message} required>
        <Textarea id="inq-message" rows={compact ? 4 : 5} aria-invalid={!!errors.message} {...register('message')} />
      </Field>
      {/* Honeypot: hidden from people, tempting for bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="inq-website">Website</label>
        <input id="inq-website" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" {...register('consent')} />
          <span>I agree that Key Property Rwanda may contact me about this inquiry, as described in the <a href="/privacy-policy" className="text-primary underline">Privacy Policy</a>.</span>
        </label>
        {errors.consent && <p role="alert" className="mt-1 text-xs text-destructive">{errors.consent.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={mutation.isPending}>
        <Send /> {mutation.isPending ? 'Sending…' : 'Send inquiry'}
      </Button>
    </form>
  );
}
