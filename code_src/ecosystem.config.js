module.exports = {
  apps: [
    {
      name: 'personal-planet-server',
      cwd: './server',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1',
      },
    },
    {
      name: 'personal-planet-client',
      cwd: './client',
      script: 'dist/server/entry.mjs',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4321,
        HOST: '127.0.0.1',
        PUBLIC_API_BASE: '/api',
      },
    },
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/var/www/personal-planet',
      'pre-deploy-local': '',
      'post-deploy': 'cd code_src && npm ci && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
    },
  },
}
