import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  /*
   * 开发服务器运行时执行 `next build` 会覆写同一个 .next 目录，导致 dev 立刻 404。
   * 让构建可以指到另一个目录：NEXT_DIST_DIR=.next-build npm run build
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
