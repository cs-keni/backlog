import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'pdfjs-dist', 'pdf-parse', '@react-pdf/renderer'],
};

export default nextConfig;
