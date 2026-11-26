export const handler = async (event: any) => {
  const claims = event.requestContext?.authorizer?.claims;
  console.log('Request', event.path, claims?.email);
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ path: event.path, user: claims?.email ?? 'anonymous' }),
  };
};