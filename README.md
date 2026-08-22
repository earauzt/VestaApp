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

## Desarrollo

```bash
# frontend
cd frontend && npm install --legacy-peer-deps && npm run build

# backend (tests locales que no pegan a un API remoto)
cd backend && pip install -r requirements.txt
python -m pytest tests/test_parsers.py tests/test_taxonomy_canonical.py -q
```
