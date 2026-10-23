import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// In the team's pnpm workspace (artifacts/orbyte) packages live under the workspace root; standalone, this folder is the root.
const workspaceRoot = resolve(process.cwd(), '../..');
const root = existsSync(resolve(workspaceRoot, 'pnpm-workspace.yaml')) ? workspaceRoot : process.cwd();

const nextConfig: NextConfig = {
  // "/" shows the copy of orbyte.my (public/index.html); e-Salary Guard lives at /login, /hr and /employee.
  async rewrites() {
    return { beforeFiles: [{ source: '/', destination: '/index.html' }], afterFiles: [], fallback: [] };
  },
  turbopack: {
    root, // set explicitly so a stray package-lock.json higher up is ignored
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
