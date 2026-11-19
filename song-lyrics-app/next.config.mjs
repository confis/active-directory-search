/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite-like native client needs to stay external on the server
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
