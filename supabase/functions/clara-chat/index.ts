// Content of your file at f27540320879b998427b9cee54f500f754e235ae

// This is a placeholder for the original content from the commit,
// replace it with the actual contents of the file at that commit.

import { serve } from "https://deno.land/std@0.94.0/http/server.ts";

serve((req) => {
  const url = new URL(req.url);
  if (url.pathname === "/clara-chat") {
    return new Response("Hello from Clara Chat!");
  }
  return new Response("Not found", { status: 404 });
});