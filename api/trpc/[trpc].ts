import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '../../server/routers';
import { createContext } from '../../server/_core/context';

const handler = async (req: Request) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req: req as any, res: {} as any }),
  });
};

export const GET = handler;
export const POST = handler;
export const runtime = 'nodejs';
