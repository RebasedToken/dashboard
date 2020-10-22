module.exports = {
  apps: [
    {
      name: "dashboard",
      script: "./node_modules/.bin/serve -s .",
      autorestart: true,
      watch: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      }
    },
  ],
}
