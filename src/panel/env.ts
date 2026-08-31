export const ENV = {
  apiUrl: (import.meta.env.VITE_API_URL ?? 'https://api.pipeelo.com/v1').replace(/\/+$/, ''),
  soketiKey: import.meta.env.VITE_SOKETI_KEY ?? 'edf3e8e06df44054379686a760935487',
  soketiHost: import.meta.env.VITE_SOKETI_HOST ?? 'soketi.pipeelo.com',
  soketiPort: Number(import.meta.env.VITE_SOKETI_PORT ?? '443') || 443,
  soketiCluster: import.meta.env.VITE_SOKETI_CLUSTER ?? 'm1',
  soketiTls: (import.meta.env.VITE_SOKETI_TLS ?? 'true') !== 'false',
};
