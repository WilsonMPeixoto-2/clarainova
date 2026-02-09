const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Handling OPTIONS request
if (req.method === 'OPTIONS') {
  res.writeHead(204, corsHeaders);
  res.end();
  return;
}

// Catch block and error handling should include CORS headers as well
catch (error) {
  res.writeHead(500, {...corsHeaders, ...additionalErrorHeaders});
  res.end(JSON.stringify({ message: 'Internal server error' }));
}