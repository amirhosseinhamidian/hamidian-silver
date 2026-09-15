# Product media storage

Product images are stored on the API server filesystem. No external download host or object
storage service is required.

## Local development

The values in `.env.example` work without extra services:

```env
MEDIA_STORAGE_ROOT=.data/media
MEDIA_PUBLIC_BASE_URL=http://localhost:3000/media
```

The API creates the directory when the first image is uploaded and serves files from `/media`.
The `.data` directory is ignored by Git and must not be committed.

## Production VPS

Use an absolute path outside the deployed release directory so a deployment cannot remove uploaded
files:

```env
NODE_ENV=production
MEDIA_STORAGE_ROOT=/var/lib/hamidian-silver/media
MEDIA_PUBLIC_BASE_URL=https://api.example.com/media
```

Create the directory once and grant it to the operating-system account that runs the API:

```bash
sudo install -d -o hamidian -g hamidian -m 0750 /var/lib/hamidian-silver/media
```

The existing Nest application serves this directory with immutable cache headers. The reverse proxy
must route `/media/*` to the API, or it may serve the same directory directly with an equivalent
configuration. Keep the `MEDIA_PUBLIC_BASE_URL` aligned with the public route used by browsers.

Treat the media directory as persistent application data: include it in VPS backups, monitor free
disk space, and restore it together with the database. If the API later runs in a container, mount
this directory as a persistent bind mount at the exact `MEDIA_STORAGE_ROOT` path.
