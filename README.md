# Nexus Repartidor App

Panel de despacho y seguimiento de pedidos en tiempo real para repartidores de la plataforma Nexus AI.

## Características

- ✅ Login con verificación de rol (repartidor/admin/owner)
- ✅ Tablero Kanban en 3 columnas: Pendientes → En Ruta → Entregados
- ✅ Actualización en tiempo real vía Firebase Firestore
- ✅ Avance de estado de pedidos con un clic
- ✅ Sonido de notificación + alerta del navegador para pedidos nuevos
- ✅ Filtro por negocio (para admins multi-negocio)
- ✅ Conectado a Firebase Firestore (proyecto: bot-nuevo-bdf67)

## Uso local

```bash
npm install
npm start
# Abre http://localhost:3002
```

## Credenciales de prueba (modo local sin Firebase)

- Repartidor: `reparto@nexus.com` / `reparto123`
- Admin: `admin@nexus.com` / `admin123`

## Despliegue

Este proyecto puede desplegarse en **Cloudflare Pages** o **Firebase Hosting** como sitio estático.
El archivo `server.js` sirve para pruebas locales únicamente.
