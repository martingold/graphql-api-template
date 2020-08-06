import { GraphQLServer } from 'graphql-yoga';
import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import * as TypeORM from 'typeorm';
import { UserResolver } from './models/user/UserResolver';
import { contextFactory } from './bootstrap/contextFactory';
import { authChecker } from './bootstrap/authChecker';

/**
 * Bootstrapping function
 */
async function bootstrap(): Promise<void> {
    TypeORM.useContainer(Container);

    await TypeORM.createConnection();

    const schema = await buildSchema({
        resolvers: [UserResolver],
        container: Container,
        authChecker,
    });

    const server = new GraphQLServer({
        schema,
        context: contextFactory,
    });
    await server.start((): void => console.log(`Server is running on http://localhost:4000`));
}

bootstrap();
