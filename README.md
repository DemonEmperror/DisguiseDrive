# DisguiseDrive MVP

A secure, mobile-first drive-like web application with client-side encryption and disguised image covers.

## Features

- **Secure Authentication**: Username/email + password login
- **Protected Folders**: Optional folder-level password protection
- **Encrypted Images**: Per-image password protection with client-side decryption
- **Disguise Covers**: Automatically generated cover images that look completely different from originals
- **Triple-tap Unlock**: Tap cover 3x or use unlock button to reveal original
- **No Downloads**: Images cannot be downloaded via browser (screenshots still possible)

## Tech Stack

- **Frontend**: Next.js + React + Tailwind CSS (mobile-first)
- **Backend**: Node.js + Express
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: MinIO (S3-compatible) for local dev
- **Encryption**: WebCrypto API (client) + Node crypto (server)
- **Password Derivation**: Argon2

## Security Architecture

### Upload Flow
1. Server generates random 256-bit AES-GCM file key `K_file`
2. Server encrypts original image with `K_file` → stores encrypted blob in private S3
3. Client provides per-image password `P_img`
4. Server derives `K_pwd = Argon2(P_img, salt)` and encrypts `K_file` with `K_pwd`
5. Server generates deterministic cover image and stores metadata

### View Flow
1. Client displays public cover image
2. On triple-tap, client prompts for `P_img`
3. Client derives `K_pwd`, decrypts `K_file`, requests encrypted blob
4. Client decrypts blob with WebCrypto and renders to canvas (not `<img>`)

## Quick Start

1. **Clone and setup**:
```bash
git clone <repo>
cd DisguiseDrive
cp .env.sample .env
# Edit .env with your settings
```

2. **Start services**:
```bash
docker-compose up -d
```

3. **Install dependencies**:
```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run seed

# Frontend
cd ../frontend
npm install
```

4. **Run development servers**:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

5. **Access the app**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- MinIO Console: http://localhost:9001 (admin/password123)

## Demo Credentials

- **User**: demo@example.com / password123
- **Folder Password**: folder123 (for protected folders)

## Environment Variables

See `.env.sample` for required environment variables.

## API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/folders` - List folders
- `POST /api/folders` - Create folder
- `POST /api/folders/:id/lock` - Set folder password
- `POST /api/folders/:id/unlock` - Unlock folder
- `POST /api/folders/:id/files` - Upload file to folder
- `GET /api/files/:id/meta` - Get file metadata
- `GET /api/files/:id/cover` - Get cover image (public)
- `GET /api/files/:id/encrypted` - Get encrypted blob (auth required)
- `DELETE /api/files/:id` - Delete file

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Threat Model & Limitations

**What we protect against:**
- Unauthorized access to original images
- Server-side plaintext storage
- Direct download links
- Brute force attacks (rate limiting)

**What we cannot prevent:**
- Screenshots of decrypted images displayed on screen
- Screen recording while image is visible
- Physical photography of the screen
- Client-side memory dumps (advanced attacks)

**Security assumptions:**
- Client device is not compromised
- User keeps passwords secure
- HTTPS is properly configured in production

## Production Deployment

1. Use AWS S3 instead of MinIO
2. Configure proper HTTPS certificates
3. Set strong JWT secrets and database passwords
4. Enable AWS KMS for additional key wrapping (optional)
5. Configure rate limiting and monitoring
6. Use CDN for cover images

## Development

### Adding New Features

1. Update database schema in `backend/prisma/schema.prisma`
2. Run `npx prisma migrate dev`
3. Add API routes in `backend/src/routes/`
4. Add frontend components in `frontend/src/components/`
5. Update tests

### Crypto Implementation Notes

- All encryption uses AES-256-GCM for authenticated encryption
- Argon2 parameters: memory=64MB, iterations=3, parallelism=1
- File keys are 256-bit random values from crypto.randomBytes()
- Salts are 32-byte random values, unique per password derivation
- Cover generation is deterministic using file hash + owner ID as seed

## License

MIT License - See LICENSE file for details.
