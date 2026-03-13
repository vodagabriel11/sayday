const config: CapacitorConfig = {
  appId: 'com.gabriel.sayday',
  appName: 'Sayday',
  webDir: 'dist/public',
  server: {
    url: 'https://sayday-production.up.railway.app',
    cleartext: true,
    hostname: 'sayday-production.up.railway.app',
  }
};

export default config;