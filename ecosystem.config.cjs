module.exports = {
  apps: [
    {
      name: "sistema-tickets",
      script: "./node_modules/tsx/dist/cli.mjs",
      args: "server.ts",
      cwd: __dirname,
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
    },
  ],
};
