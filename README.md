# ᑌᑎᔕIᘔ ᗩᑎIᗰE — Premium v3

Толық Node.js + Express аниме каталогы. Frontend — vanilla HTML/CSS/JS, database — JSON файл. Admin панелі бар.

## Іске қосу

1. Node.js 18+ орнатыңыз.
2. Папкада `npm install` орындаңыз.
3. `.env.example` файлын `.env` етіп көшіріңіз.
4. `ADMIN_PASSWORD` мәнін өз құпиясөзіңізге өзгертіңіз.
5. `npm start` орындаңыз.
6. Браузерде `http://localhost:3000` ашыңыз.

## Admin

`/admin` route арқылы кіріңіз. Құпиясөз `ADMIN_PASSWORD` environment variable арқылы тексеріледі.

## Deploy

Node.js web service ретінде жариялаңыз.

Build: `npm install`
Start: `npm start`

Environment variables:
- `ADMIN_PASSWORD`
- `TELEGRAM_URL`
- `SITE_URL`
- `PORT` (hosting өзі берсе, өзгертпеңіз)

## Ескерту

Видео URL-дары тек сізге тиесілі, лицензияланған немесе заңды түрде пайдалануға рұқсат етілген материалдарға қолданылуы керек.

Бұл жоба жергілікті JSON storage пайдаланады. Hosting platform файлдық жүйені уақытша етсе, production үшін persistent database/storage-қа ауыстыру қажет.
