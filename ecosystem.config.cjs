module.exports = {
  apps: [
    {
      name: "discord-invite-bot",
      script: "src/index.js",
      interpreter: "node",
      node_args: "",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      },
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      time: true
    }
  ]
};
