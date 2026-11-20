import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { readDatabaseConfig } from '../common/config/environment';

export type TransactionContext = Prisma.TransactionClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaMariaDb({
      ...readDatabaseConfig(),
      timezone: '+00:00',
      connectionLimit: 5,
    });

    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      const [connection] = await this.$queryRaw<{ timeZone: string }[]>`SELECT @@session.time_zone AS timeZone`;
      if (connection.timeZone !== '+00:00') throw new Error('Database connection must use UTC.');
    } catch {
      await this.$disconnect();
      throw new Error('Database connection failed or session timezone is not UTC.');
    }
  }

  runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>, tx?: TransactionContext): Promise<T> {
    return tx ? work(tx) : this.$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
