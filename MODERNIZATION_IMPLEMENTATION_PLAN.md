# Modernization & Optimization Implementation Plan: 7 Core Upgrades (P1 to P3)

> **TARGET:** Any AI Coding Agent or Engineer executing this plan in a fresh or existing session.  
> **SCOPE:** Architectural modernization across Form Handling, API Schema Validation, Client-side Media Compression, Telephony Normalization, Data Layer Caching, Virtualized Rendering, and PDF Generation.  
> **NON-NEGOTIABLE GUARDRAILS:**
>
> 1. **Zero Radix Dependencies:** Base UI primitives (`@base-ui/react`) must remain untouched. Never install or import from `@radix-ui/*`.
> 2. **Strict 4-Locale i18n Parity:** Every new or adjusted user-facing string must be present in `messages/en.json`, `messages/es.json`, `messages/ko.json`, and `messages/pt.json`.
> 3. **Database Immutability:** Migrations `001_*.sql` to `133_*.sql` are strictly immutable. Any future schema changes must start at `134_*.sql`.
> 4. **React 19 Compatibility:** Adhere to React 19 render rules (no synchronous cascading `setState` in `useEffect`).
> 5. **Continuous Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` (all 105 test suites) must pass at the end of each phase before proceeding to the next.

---

## Architecture Overview & Dependency Matrix

| Category            | Upgrade                               | Target Library                                      | Primary Files Impacted                                                                                                                                           |
| :------------------ | :------------------------------------ | :-------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category 1 (P1)** | Server & API Schema Validation        | `zod` (^3.24.0)                                     | `src/lib/schemas/`, `src/app/api/v1/properties/`, `src/app/api/v1/site-visits/`, `src/app/api/portal/`                                                           |
| **Category 2 (P1)** | Client-Side Image Compression         | `browser-image-compression` (^2.0.2)                | `src/lib/storage/upload-media.ts`, `src/components/inbox/message-composer.tsx`, `src/components/social/post-composer-sheet.tsx`                                  |
| **Category 3 (P1)** | Form State & Validation               | `react-hook-form` (^7.54.0) + `@hookform/resolvers` | `src/components/properties/property-form-modal.tsx`, `src/components/pipelines/deal-form.tsx`, `src/components/contacts/contact-form.tsx`                        |
| **Category 4 (P2)** | Telephony & E.164 Normalization       | `libphonenumber-js` (^1.11.0)                       | `src/lib/whatsapp/phone-utils.ts`, `src/lib/contacts/dedupe.ts`                                                                                                  |
| **Category 5 (P2)** | Query Caching & State Synchronization | `@tanstack/react-query` (^5.66.0)                   | `src/app/(dashboard)/layout.tsx`, `src/app/(dashboard)/properties/page.tsx`, `src/app/(dashboard)/site-visits/page.tsx`, `src/app/(dashboard)/contacts/page.tsx` |
| **Category 6 (P3)** | High-Density List Virtualization      | `@tanstack/react-virtual` (^3.13.0)                 | `src/components/inbox/message-thread.tsx`, `src/components/inbox/conversation-list.tsx`                                                                          |
| **Category 7 (P3)** | PDF Cost Sheet & Brochure Engine      | `@react-pdf/renderer` (^4.2.0)                      | `src/components/contacts/cost-sheet-modal.tsx`, `src/components/properties/property-share-modal.tsx`, `src/lib/pdf/`                                             |

---

## Phase 0: Dependency Installation & Baseline Verification

### Step 0.1: Install Target Libraries

```bash
npm install zod react-hook-form @hookform/resolvers browser-image-compression libphonenumber-js @tanstack/react-query @tanstack/react-virtual @react-pdf/renderer
```

### Step 0.2: Baseline Sanity Check

Ensure the repository builds and passes all tests before touching any file:

```bash
npm run typecheck
npm run lint
npm run test
```

---

## Phase 1 (P1): Centralized Zod Schemas & API Request Validation

### Objectives

Replace fragile, manual `typeof body.field === 'string'` checks across public API routes and portal ingestion webhooks with declarative Zod schemas.

### Implementation Steps

#### 1.1 Create Shared Schemas Directory

Create `src/lib/schemas/`:

- `src/lib/schemas/property.ts`:
  ```ts
  import { z } from 'zod';

  export const PropertyTypeEnum = z.enum([
    'Apartment',
    'Villa',
    'Plot',
    'Commercial',
    'Penthouse',
    'Builder Floor',
  ]);

  export const PossessionStatusEnum = z.enum([
    'ready_to_move',
    'under_construction',
    'nearing_possession',
  ]);

  export const PropertyInputSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    location: z.string().trim().nullable().optional(),
    price: z.number().nonnegative().nullable().optional(),
    property_type: PropertyTypeEnum.nullable().optional(),
    bedrooms: z.number().int().min(0).max(20).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    configuration: z.string().nullable().optional(),
    builder_name: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    rera_id: z.string().nullable().optional(),
    possession_status: PossessionStatusEnum.nullable().optional(),
    possession_date: z.string().nullable().optional(),
    carpet_area: z.number().positive().nullable().optional(),
    facing: z.string().nullable().optional(),
  });

  export const PropertyPatchSchema = PropertyInputSchema.partial();
  export type PropertyInput = z.infer<typeof PropertyInputSchema>;
  ```
- `src/lib/schemas/site-visit.ts`:
  ```ts
  import { z } from 'zod';

  export const SiteVisitStatusEnum = z.enum([
    'pending',
    'confirmed',
    'completed',
    'no_show',
    'rescheduled',
  ]);

  export const SiteVisitInputSchema = z.object({
    contact_id: z.string().uuid().nullable().optional(),
    property_id: z.string().uuid().nullable().optional(),
    scheduled_at: z
      .string()
      .datetime({ message: 'Must be a valid ISO datetime' }),
    status: SiteVisitStatusEnum.default('pending'),
    notes: z.string().nullable().optional(),
    pickup_required: z.boolean().default(false),
    pickup_location: z.string().nullable().optional(),
  });

  export const SiteVisitPatchSchema = SiteVisitInputSchema.partial();
  ```
- `src/lib/schemas/portal-lead.ts`:
  Define validation for incoming webhook payloads from 99acres, MagicBricks, Housing.com, NoBroker, and Meta Lead Ads.

#### 1.2 Refactor Public API Routes with Zod

- **`src/app/api/v1/properties/route.ts` (POST):**
  Parse request body using `PropertyInputSchema.safeParse(body)`. Return standardized 400 response with Zod formatting if invalid:
  ```ts
  const parsed = PropertyInputSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      'bad_request',
      parsed.error.issues[0]?.message ?? 'Invalid input',
      400
    );
  }
  ```
- **`src/app/api/v1/properties/[id]/route.ts` (PATCH):**
  Validate updates with `PropertyPatchSchema.safeParse(body)`.
- **`src/app/api/v1/site-visits/route.ts` & `[id]/route.ts`:**
  Apply `SiteVisitInputSchema` and `SiteVisitPatchSchema`.

#### 1.3 Unit Tests

Create unit tests in:

- `src/lib/schemas/property.test.ts`
- `src/lib/schemas/site-visit.test.ts`
  Verify valid inputs pass and invalid types (e.g. negative prices, malformed dates) fail predictably.

#### 1.4 Verification Gate

```bash
npm run typecheck && npm run lint && npm run test
```

---

## Phase 2 (P1): Client-Side Image Compression & Pre-Upload Optimization

### Objectives

Prevent mobile agent upload failures caused by modern smartphone cameras producing 8MB–20MB photos that violate Meta’s strict 5MB image limit.

### Implementation Steps

#### 2.1 Enhance Storage Helper (`src/lib/storage/upload-media.ts`)

Add a smart pre-compression step:

```ts
import imageCompression from 'browser-image-compression';

export async function compressImageIfNeeded(file: File): Promise<File> {
  // Only compress images that exceed 1MB or are high-resolution camera photos
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/svg+xml' ||
    file.type === 'image/gif'
  ) {
    return file;
  }

  // If already under 1.5MB, no compression needed
  if (file.size <= 1.5 * 1024 * 1024) {
    return file;
  }

  try {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type as string,
    };
    const compressed = await imageCompression(file, options);
    return new File([compressed], file.name, { type: file.type });
  } catch (err) {
    console.warn(
      '[upload-media] Client compression failed, using original file:',
      err
    );
    return file;
  }
}
```

#### 2.2 Wire into Upload Callers

Integrate `compressImageIfNeeded(file)` in:

1. `src/lib/storage/upload-media.ts` -> `uploadAccountMedia()`
2. `src/components/inbox/message-composer.tsx` -> image attachment handler
3. `src/components/social/post-composer-sheet.tsx` -> media dropzone handler

#### 2.3 Verification Gate

- Test uploading an image > 5MB in `MessageComposer` and `PostComposerSheet`.
- Confirm file uploads successfully under 1.5MB without visual distortion.
- Run `npm run typecheck && npm run test`.

---

## Phase 3 (P1): Form Modernization (`react-hook-form` + `zod`)

### Objectives

Refactor sprawling forms from 20+ isolated `useState` hooks to type-safe, controlled forms with isolated re-renders and single-source validation.

### Implementation Steps (One Modal at a Time)

#### 3.1 Refactor `PropertyFormModal` (`src/components/properties/property-form-modal.tsx`)

1. Connect `useForm<PropertyInput>({ resolver: zodResolver(PropertyInputSchema) })`.
2. Populate initial values via `reset(property ? { ... } : defaults)`.
3. Replace manual error toast checks with field-level error messages (`formState.errors.title?.message`).
4. Retain all Base UI select and input primitives.

#### 3.2 Refactor `DealForm` (`src/components/pipelines/deal-form.tsx`)

1. Create `DealInputSchema` in `src/lib/schemas/deal.ts` (validating `title`, `value`, `currency`, `stage_id`, `contact_id`, `assigned_to`, `expected_close_date`).
2. Migrate `DealForm` to `react-hook-form`.
3. Preserve anti-poaching authorization checks (`canMoveDeal`).

#### 3.3 Refactor `ContactForm` (`src/components/contacts/contact-form.tsx`)

1. Create `ContactInputSchema` in `src/lib/schemas/contact.ts` (incorporating budget min/max, BHK configurations, phone, email, tags, and lifecycle stage).
2. Wire `react-hook-form` into `ContactForm`.
3. Preserve duplicate detection logic (`findExistingContact`) on phone field change.

#### 3.4 Verification Gate

```bash
npm run typecheck && npm run lint && npm run test
```

---

## Phase 4 (P2): Telephony & E.164 Normalization (`libphonenumber-js`)

### Objectives

Eliminate false contact collisions and deduplication errors caused by naive 8-digit substring matching in `src/lib/whatsapp/phone-utils.ts`.

### Implementation Steps

#### 4.1 Refactor `src/lib/whatsapp/phone-utils.ts`

1. Replace manual regex and `slice(-8)` logic with `libphonenumber-js/min`:
   ```ts
   import {
     parsePhoneNumberFromString,
     PhoneNumber,
   } from 'libphonenumber-js/min';

   export function parseInternationalPhone(
     phone: string,
     defaultCountry = 'IN'
   ): string | null {
     if (!phone) return null;
     const parsed = parsePhoneNumberFromString(phone, defaultCountry);
     if (parsed && parsed.isValid()) {
       return parsed.format('E.164');
     }
     return null;
   }

   export function phonesMatch(
     phone1: string,
     phone2: string,
     defaultCountry = 'IN'
   ): boolean {
     const p1 = parsePhoneNumberFromString(phone1, defaultCountry);
     const p2 = parsePhoneNumberFromString(phone2, defaultCountry);
     if (!p1 || !p2) return false;
     return p1.number === p2.number;
   }
   ```
2. Update `formatPhoneDisplay(phone)` to format national or international strings smoothly based on detected country.

#### 4.2 Update Deduplication Engine (`src/lib/contacts/dedupe.ts`)

Ensure phone number deduplication uses true E.164 canonical strings.

#### 4.3 Update Co-located Tests

Refactor `src/lib/whatsapp/phone-utils.test.ts` and `src/lib/contacts/dedupe.test.ts` to assert against edge cases (e.g. Indian mobile numbers with leading `0`, `+91`, `91`, and UK/US formats).

#### 4.4 Verification Gate

```bash
npx vitest run src/lib/whatsapp/phone-utils.test.ts src/lib/contacts/dedupe.test.ts
npm run test
```

---

## Phase 5 (P2): Global Query Cache & Realtime Synchronization (`@tanstack/react-query`) [COMPLETED]

### Objectives

Eliminate manual `setTimeout(..., 0)` effect boilerplate, implement instant stale-while-revalidate tab switching, and provide automated cache invalidation when modals mutate entities.

### Implementation Steps

#### 5.1 Initialize Query Client Provider

In `src/app/(dashboard)/layout.tsx`:

1. Create a client-side provider `src/components/providers/query-provider.tsx`:
   ```tsx
   'use client';
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
   import { useState, type ReactNode } from 'react';

   export function QueryProvider({ children }: { children: ReactNode }) {
     const [queryClient] = useState(
       () =>
         new QueryClient({
           defaultOptions: {
             queries: {
               staleTime: 1000 * 60 * 2, // 2 minutes fresh cache
               gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
               refetchOnWindowFocus: false,
             },
           },
         })
     );
     return (
       <QueryClientProvider client={queryClient}>
         {children}
       </QueryClientProvider>
     );
   }
   ```
2. Wrap the dashboard shell in `QueryProvider`.

#### 5.2 Migrate Dashboard Query Pages (One by One)

1. **`src/app/(dashboard)/properties/page.tsx`:**
   Replace `fetchProperties()` and `useEffect` with:
   ```tsx
   const { data: properties = [], isLoading } = useQuery({
     queryKey: ['properties', accountId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('properties')
         .select('*')
         .order('created_at', { ascending: false });
       if (error) throw error;
       return data as Property[];
     },
     enabled: !!accountId,
   });
   ```
   In `PropertyFormModal` and `PropertyDeleteDialog`, invalidate cache upon save:
   ```tsx
   const queryClient = useQueryClient();
   // On success:
   void queryClient.invalidateQueries({ queryKey: ['properties', accountId] });
   ```
2. **`src/app/(dashboard)/site-visits/page.tsx`:**
   Migrate scheduled visits queries to `useQuery` with `queryKey: ['site-visits', accountId]`.
3. **`src/app/(dashboard)/contacts/page.tsx`:**
   Migrate contacts list to `useQuery` with `queryKey: ['contacts', accountId, filters]`.

#### 5.3 Verification Gate

- Verify smooth transitions between `/properties`, `/site-visits`, and `/contacts` without re-triggering loading skeletons for cached data.
- Run `npm run typecheck && npm run test`.

---

## Phase 6 (P3): High-Density List Virtualization (`@tanstack/react-virtual`) [COMPLETED]

### Objectives

Maintain 60 FPS scrolling and low memory consumption in chat conversations with 500+ messages and contact lists with 1,000+ leads.

### Implementation Steps

#### 6.1 Virtualize Message Thread (`src/components/inbox/message-thread.tsx`)

1. Integrate `useVirtualizer` from `@tanstack/react-virtual` inside the scroll container (`scrollRef`):
   ```tsx
   const rowVirtualizer = useVirtualizer({
     count: messages.length,
     getScrollElement: () => scrollRef.current,
     estimateSize: () => 72, // Average height of a message bubble
     overscan: 5,
   });
   ```
2. Render only the items returned by `rowVirtualizer.getVirtualItems()`.
3. Position virtual items absolutely with `transform: translateY(...)`.
4. Ensure smooth auto-scroll to the latest message on initial load and incoming WebSocket message.

#### 6.2 Virtualize Conversation List (`src/components/inbox/conversation-list.tsx`)

Apply `useVirtualizer` to the left-hand conversation drawer for accounts with 200+ active conversations.

#### 6.3 Verification Gate

- Test chat scrolling on mobile and desktop with long conversation threads.
- Confirm auto-scroll to bottom functions properly.
- Run `npm run typecheck && npm run test`.

---

## Phase 7 (P3): Client/Server PDF Document Engine (`@react-pdf/renderer`) [COMPLETED]

### Objectives

Enable 1-click generation and WhatsApp dispatch of professional, branded PDF Cost Sheets and Property Brochures directly from the CRM.

### Implementation Steps

#### 7.1 Create PDF Template Components

Under `src/lib/pdf/`:

- `cost-sheet-document.tsx`:
  Build an agency-branded PDF template containing:
  - Developer/Agency Header with logo & contact details.
  - Property Specs: Project Name, Location, BHK, Carpet Area, RERA ID.
  - Itemized Cost Table: Base Price, Floor Rise, Covered Parking, GST, Stamp Duty, and Total All-Inclusive in ₹ INR.
  - RERA Disclaimer & Validity Notice.
- `pdf-generator.ts`:
  Utility to compile the document into a `Blob`:
  ```ts
  import { pdf } from '@react-pdf/renderer';
  import { CostSheetDocument } from './cost-sheet-document';

  export async function generateCostSheetPdf(props: CostSheetProps): Promise<Blob> {
    const doc = <CostSheetDocument {...props} />;
    return await pdf(doc).toBlob();
  }
  ```

#### 7.2 Wire into `CostSheetModal` (`src/components/contacts/cost-sheet-modal.tsx`)

1. Add an action button: **"Download PDF"** and **"Send PDF on WhatsApp"**.
2. When clicking "Send PDF on WhatsApp":
   - Generate PDF blob in browser.
   - Upload to Supabase Storage `chat-media` bucket via `uploadAccountMedia()`.
   - Call `/api/whatsapp/send` with `messageType: 'document'` and the generated storage URL.

#### 7.3 Verification Gate

- Test generating and previewing a PDF cost sheet.
- Test sending the generated PDF directly to a contact conversation.
- Run `npm run typecheck && npm run test`.

---

## Definition of Done (Entire Modernization)

- [x] All 7 categories successfully implemented according to specification.
- [x] No Radix UI packages installed; Base UI primitives preserved.
- [x] 4-locale i18n parity verified across `en.json`, `es.json`, `ko.json`, and `pt.json`.
- [x] Database migrations 001–133 untouched; any new tables (if needed) start at 134.
- [x] `npm run typecheck` passes with zero errors.
- [x] `npm run lint` passes with zero warnings/errors.
- [x] `npm run format:check` passes across the repository.
- [x] `npm run test` passes (all test suites and 1,200+ tests green).
