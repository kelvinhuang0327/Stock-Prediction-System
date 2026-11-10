import { PrismaClient } from '@prisma/client';

export type PrismaClientFactoryOptions = ConstructorParameters<typeof PrismaClient>[0];

export function createPrismaClient(options?: PrismaClientFactoryOptions): PrismaClient;
