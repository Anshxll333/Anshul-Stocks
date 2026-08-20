# Run Instructions

This guide lists the terminal commands needed to run both frontend and backend development environments.

## Development Startup

### 1. Launch backend
Open a terminal in the root workspace folder:

```bash
cd anshul-stocks/backend
npm run start:dev
```

This starts the NestJS server on [http://localhost:3000](http://localhost:3000) with watch mode enabled.

---

### 2. Launch frontend
Open another terminal in the root workspace folder:

```bash
cd anshul-stocks/frontend
npm run dev
```

This starts the Vite React server on [http://localhost:5173](http://localhost:5173) with instant hot module reloading.

---

## Production Build

To build and compile optimized assets:

### Build Backend
```bash
cd anshul-stocks/backend
npm run build
npm run start:prod
```

### Build Frontend
```bash
cd anshul-stocks/frontend
npm run build
npm run preview
```
