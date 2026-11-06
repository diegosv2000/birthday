This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Protección del registro

`POST /api/rsvp` permite 5 intentos por minuto y 30 por hora, en ventanas fijas.
Los intentos que llegan al contador cuentan, incluidos los cuerpos inválidos y los registros repetidos.
Al superar cualquiera de los límites devuelve `429` y `Retry-After` en segundos.
Las ventanas se reinician al cambiar de minuto/hora; no son ventanas deslizantes.

Una caché local de hasta 1024 bloqueos rechaza de inmediato las siguientes
solicitudes de una IP bloqueada, sin volver a consultar MongoDB hasta que venza el bloqueo.
Los contadores se incrementan de forma atómica en MongoDB, por lo que se comparten
entre procesos e instancias. La colección `rsvp_rate_limits` (configurable mediante
`DB_COL_RSVP_LIMITS`) se crea con un índice TTL sobre `expiresAt`. La cuenta de MongoDB
debe poder crear ese índice. La eliminación TTL puede demorarse, pero cada ventana
tiene su propia clave y no depende de la eliminación para reiniciarse. Las IP se
guardan como hash SHA-256, no como texto. Si falla el contador, se responde `503`
sin consultar ni modificar invitados.

En Vercel, la IP se toma de `x-vercel-forwarded-for`. En otro hosting, configura
`RSVP_TRUSTED_IP_HEADER` con una cabecera que tu proxy **sobrescriba siempre** con una
única IP válida. El servidor debe ser accesible únicamente a través de ese proxy.
No se aceptan listas de IP. Sin una cabecera confiable, o si falta/es inválida, se
aplica un **límite compartido** para evitar saltarse la protección inventando cabeceras.
Los usuarios que comparten IP también comparten los límites.

El JSON está limitado a 1 KiB, incluso sin `Content-Length`, y el nombre a 120
caracteres. El formulario muestra cuánto esperar al recibir un `429`.
Esta protección se ejecuta dentro de la aplicación y consulta MongoDB para contar
los intentos; no detiene un DDoS antes de que alcance el servidor.

Verificación: `npm test` y `npx tsc --noEmit --incremental false`.
Las pruebas usan un contador en memoria que simula las operaciones atómicas;
no se conectan a la base real ni modifican invitados.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
