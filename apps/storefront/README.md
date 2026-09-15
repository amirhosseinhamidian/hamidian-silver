This is the Hamidian Silver storefront.

## Environment

Expose the storefront values documented in the repository's root `.env.example` to the Next.js
process (for example through `apps/storefront/.env.local`). `MEDIA_PUBLIC_BASE_URL` must match the
API's public media base URL because Next.js only optimizes images from explicitly configured hosts
and paths.

## Analytics

Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` to a valid GA4 measurement ID (for example `G-ABC123`) when
building the production storefront. Leaving it empty disables analytics and avoids loading the
Google tag. The storefront sends App Router page views plus `search`, `view_item`,
`add_to_wishlist`, `remove_from_wishlist`, `add_to_cart`, `begin_checkout`, and verified `purchase`
events. Prices are converted from toman to `IRR`; customer identity, phone, and address data are not
included in commerce events.

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
