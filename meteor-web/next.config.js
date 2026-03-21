/** @type {import('next').NextConfig} */
const nextConfig = {
  // Les images annotées sont servies par Nginx directement via /images/
  // Next.js n'a pas besoin de les gérer
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
