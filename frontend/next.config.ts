import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // `next dev` otherwise auto-writes/updates AGENTS.md and CLAUDE.md with its own
  // managed "read the bundled docs" block whenever it detects an AI coding agent running.
  agentRules: false,
};

export default nextConfig;
