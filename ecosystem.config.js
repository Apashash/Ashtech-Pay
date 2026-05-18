module.exports = {
  apps: [
    {
      name: "ashtech-pay",
      script: "dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      // Les variables d'environnement DOIVENT être configurées dans Plesk
      // (Domaines > votre-domaine > Node.js > Variables d'environnement)
      // ou dans un fichier .env à la racine du projet (jamais commité sur Git).
      // Les valeurs ci-dessous sont des DÉFAUTS SEULEMENT — écrasés par .env / Plesk.
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      watch: false,
      max_memory_restart: "512M",
      error_file: "logs/pm2-error.log",
      out_file: "logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
      // Lecture automatique du fichier .env si présent
      env_file: ".env",
    },
  ],
};
