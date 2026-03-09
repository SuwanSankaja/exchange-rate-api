export function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      success: true,
      status: 'OK',
      service: 'exchange-rate-api',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
