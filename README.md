# Vesta

App de finanzas personales de Emilio (repo: `earauzt/VestaApp`).
Frontend React en `frontend/`. API FastAPI en `backend/`.

URL canónica: https://vesta-emilio.vercel.app

## Autenticación de la app

El backend **no usa login**. `GET /auth/me` y `get_current_user` siempre
devuelven el perfil fijo de Emilio. No hay `POST /auth/login` ni
contraseña de la app. El frontend trata esa respuesta como la sesión y
no muestra formulario de ingreso.

El candado es la URL de Vercel / [Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
(SSO al abrir https://vesta-emilio.vercel.app). Tras el SSO, Emilio entra
a https://vesta-emilio.vercel.app/dashboard.

## Deployment Protection de Vercel (SSO)

Al abrir https://vesta-emilio.vercel.app sin sesión de Vercel, la
producción responde **HTTP 302** a
`https://vercel.com/sso-api?url=https://vesta-emilio.vercel.app/`.

Eso **no es un bug de esta app**: es [Vercel Authentication / Deployment
Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
a nivel de proyecto. `frontend/vercel.json` no puede apagarlo (no existe
campo de `vercel.json` para SSO / Deployment Protection).

Para que la URL de producción sea alcanzable:

1. En el dashboard de Vercel: proyecto → **Settings → Deployment Protection**.
2. Desactiva **Vercel Authentication** para Production, **o** déjala solo en
   Preview.
3. Desde CLI (si tienes acceso al proyecto):
   `vercel project protection disable <proyecto> --sso`
4. Por API: `PATCH` del proyecto con `{"ssoProtection": null}`.

No commitees tokens de bypass. El candado de producción es ese SSO de
Vercel, no una clave de Vesta.

## Deploy frontend (Vercel project `vesta`)

Producción: https://vesta-beige-nine.vercel.app

El dashboard de `vesta` está mal para este repo: corre `react-scripts build`
en la **raíz** (no hay `package.json` ahí) bajo Node 24. Production tiene
que construir **`frontend/`** con `npm run build` o `yarn run build`
(ambos ejecutan `craco build`), en **Node 20.x**.

`packageManager` dice yarn@1.22.22, pero no hay `yarn.lock`; el lock es
`frontend/package-lock.json`. El install de Vercel debe ser **npm**.

### Dashboard — setear exactamente (proyecto `vesta`)

Settings → Build and Deployment:

- **Root Directory:** `frontend`
- **Build Command:** `CI=false npm run build`
- **Install Command:** `npm ci --legacy-peer-deps`
- **Output Directory:** `build`
- **Node.js Version:** `20.x`
- **Framework Preset:** Other (no Create React App / no `react-scripts build`)

`CI=false yarn run build` es el mismo script (`craco build`). No usar
`react-scripts build`.

Si Root Directory se deja vacío, el `vercel.json` de la raíz instala
`frontend/` y corre `CI=false npm --prefix frontend run build`
(output `frontend/build`, Node 20). En ese caso el dashboard debe ser:

- **Root Directory:** _(vacío)_
- **Build Command:** `CI=false npm --prefix frontend run build`
- **Install Command:** `bash scripts/vercel-install.sh`
- **Output Directory:** `frontend/build`
- **Node.js Version:** `20.x`

Lo correcto es **Root Directory = `frontend`** y
**Build Command = `CI=false npm run build`**.

```bash
cd frontend && npm ci && npm run build
```

## Desarrollo

```bash
# frontend
cd frontend && npm ci && npm run build

# backend (tests locales que no pegan a un API remoto)
cd backend && pip install -r requirements.txt
python -m pytest tests/test_parsers.py tests/test_taxonomy_canonical.py -q
```
