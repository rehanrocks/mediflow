# MediFlow — White-Label Branding Module
Add to existing multi-tenant MediFlow app (Django + DRF backend, React + Vite frontend).
Feed each prompt to your coding agent one at a time. Backend first, then frontend.

---

## BACKEND

### B1 — Add branding fields to Organization model
```
In organizations/models.py, add two fields to the existing Organization model:
- display_name (CharField, max_length=150, blank=True) — the clinic's branding
  name shown in the UI. Falls back to the existing `name` field if blank.
- logo (ImageField, upload_to="org_logos/", blank=True, null=True)

Add a property `branding_name` that returns display_name if set, else name.
Install Pillow if not already installed (required for ImageField).
In settings.py add:
  MEDIA_URL = "/media/"
  MEDIA_ROOT = BASE_DIR / "media"
In mediflow/urls.py, append at the bottom (inside `if settings.DEBUG`):
  from django.conf import settings
  from django.conf.urls.static import static
  urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
Run makemigrations and migrate.
```

### B2 — Expose branding in the login response
```
In the existing custom TokenObtainPairSerializer (wherever login response fields
are added), include two additional fields:
- organization_name: use organization.branding_name (the property from B1,
  not organization.name directly)
- organization_logo: if organization.logo is set, return
  request.build_absolute_uri(organization.logo.url), else return null.
The request object is available via self.context["request"] in the serializer.
No new endpoint needed. No other changes.
```

### B3 — Django Admin: logo upload UI
```
In organizations/admin.py, on the existing OrganizationAdmin class:
- Add display_name and logo to fieldsets or fields so they are editable.
- Add a read-only method `logo_preview` that returns an HTML <img> tag
  (mark_safe) showing the current logo at max-height 60px, or the text
  "No logo uploaded" if blank. Add logo_preview to readonly_fields and
  include it next to the logo field so the admin can see the current image
  while uploading a new one.
No other admin changes.
```

---

## FRONTEND

### F1 — Store branding in AuthContext
```
In src/context/AuthContext.jsx (or wherever login state is stored), when saving
the login response to localStorage and context state, include:
- organization_name
- organization_logo (may be null)
alongside the existing fields (role, enabled_features, etc.).
Expose these via the existing useAuth() hook. No other changes to auth logic.
```

### F2 — OrgBrand component
```
Create src/components/OrgBrand.jsx.
Props: size (default "md" — controls height: sm=24px, md=32px, lg=40px)
Logic:
- Read organization_name and organization_logo from useAuth().
- If organization_logo is a non-null, non-empty string:
    render <img src={organization_logo} alt={organization_name}
    style={{ height: <size px>, objectFit: "contain" }} />
- Else:
    render an initials badge — a colored circle (background color
    deterministically derived from organization_name using a simple hash
    mod over 5 preset brand-adjacent hex colors) containing the first two
    initials of organization_name in white, font-sans font-semibold,
    sized proportionally to the height prop.
- Next to the image or badge, render organization_name in font-sans
  font-bold at a size proportional to the height prop.
This component has no props other than `size` — it always reads from auth
context. Export as default.
```

### F3 — Place OrgBrand in Sidebar and Topbar
```
In src/components/Sidebar.jsx:
- Remove any hardcoded "MediFlow" wordmark or logo.
- Import OrgBrand from "../components/OrgBrand".
- Render <OrgBrand size="md" /> at the top of the sidebar where the
  wordmark/logo currently sits.

In src/components/Topbar.jsx (if it shows an org name or logo):
- Apply the same replacement with <OrgBrand size="sm" />.

No other page changes needed — every page already renders the sidebar/topbar,
so branding appears everywhere automatically.
```

---

## QA Checklist
```
Backend
[ ] python manage.py makemigrations && migrate — no errors
[ ] Django Admin → open an Organization → display_name and logo fields visible
[ ] Upload a logo image in Django Admin → logo_preview thumbnail appears
[ ] POST /api/auth/login/ as any user → response includes organization_name
    and organization_logo (absolute URL if logo uploaded, null if not)
[ ] organization_name in login response reflects display_name when set,
    falls back to name when display_name is blank

Frontend
[ ] Log in as a user whose org has NO logo uploaded → initials badge renders
    in sidebar (no broken image icon, no empty box)
[ ] Log in as a user whose org HAS a logo uploaded → logo image renders in
    sidebar (object-contain, not stretched)
[ ] Org name renders next to logo/badge in sidebar on every page
[ ] Log out, log in as a user from a DIFFERENT org → sidebar immediately
    shows the second org's name and logo/badge, not the first org's
[ ] No page anywhere still shows the hardcoded "MediFlow" wordmark where the
    org branding should appear
```
