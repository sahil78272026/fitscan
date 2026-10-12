/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '192.168.1.6',
    '192.168.1.6:3000',
    'localhost:3000',
    '127.0.0.1:3000',
  ],
};

export default nextConfig;
