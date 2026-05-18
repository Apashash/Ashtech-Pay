/**
 * PM2 Ecosystem Config — Plesk Node.js Deployment
 *
 * Dans Plesk :
 *   - Application root : /var/www/vhosts/votre-domaine.com/httpdocs
 *   - Startup file     : ecosystem.config.cjs  (ou dist/index.cjs)
 *   - Run command      : node dist/index.cjs
 *
 * Ou via PM2 directement : pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "ashtechpay",
      script: "dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_production: {
        NODE_ENV: "production",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
