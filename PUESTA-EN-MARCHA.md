# A los Palos — puesta en marcha (cuentas y amigos)

## 1. Crear las tablas (una sola vez)
1. Supabase → tu proyecto → **SQL Editor** → **New query**.
2. Abrí `supabase/schema.sql`, copiá todo, pegalo y tocá **Run**.
3. Tiene que decir "Success". Se puede volver a correr sin problema.

## 2. Mails de confirmación (obligatorio para usuarios reales)
El envío de mails que trae Supabase solo manda a miembros de tu equipo y 2 por hora.
Para que le llegue a cualquiera:
1. Creá una cuenta gratis en **Brevo** (brevo.com, 300 mails por día gratis).
2. En Brevo: Senders → agregá y verificá el mail que va a mandar (ej. tu gmail).
3. En Brevo: SMTP & API → SMTP → copiá servidor, puerto, login y generá una "SMTP key".
4. En Supabase: **Authentication → Emails → SMTP Settings** → Enable custom SMTP y pegá:
   - Sender email: el mail verificado · Sender name: A los Palos
   - Host: smtp-relay.brevo.com · Port: 587 · Username: el login de Brevo · Password: la SMTP key
5. En **Authentication → Rate limits** subí "emails per hour" (ej. 100).
6. (Opcional) **Authentication → Emails → Templates → Confirm signup**: cambiá el texto a español.

## 3. Publicar en Vercel
1. Subí esta carpeta a un repo nuevo de GitHub.
2. Vercel → Add New → Project → el repo → Deploy (detecta Vite solo).
3. Copiá el link que te da (ej. `https://alospalos.vercel.app`).

## 4. Decirle a Supabase cuál es tu link
**Authentication → URL Configuration**:
- Site URL: tu link de Vercel
- Redirect URLs: agregá tu link de Vercel con `/**` al final (ej. `https://alospalos.vercel.app/**`)

Sin esto, el link del mail de confirmación manda a una página que no existe.

## 5. Instalar en el celular
Abrí tu link en Safari → Compartir → **Agregar a inicio**.

## Datos del proyecto
Están en `src/cloud.ts` (URL y clave anon). La clave anon es pública a propósito:
la seguridad la ponen las reglas de la base (cada uno edita solo lo suyo y ve lo de
los demás según su privacidad). **Nunca pongas la clave `service_role` en la app.**
