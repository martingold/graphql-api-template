import { buildSchema } from 'type-graphql';
import { Container } from 'typedi';
import * as TypeORM from 'typeorm';
import { UserResolver } from './resolvers';
import { contextFactory } from './bootstrap/contextFactory';
import { authChecker } from './bootstrap/authChecker';
import { errorFormatter } from './bootstrap/errorFormatter';
import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { register as registerPrometheusClient } from 'prom-client';
import createMetricsPlugin from 'apollo-metrics';
import * as Sentry from '@sentry/node';
import config from './config';
import { apolloClearContainerPlugin, apolloServerSentryPlugin } from './bootstrap/apollo-plugins';
import { registerEnumsToSchema } from './bootstrap/registerEnumsToSchema';

// Init sentry
Sentry.init({ ...config.sentry, environment: config.environment });

/**
 * Bootstrapping function
 */
async function bootstrap(): Promise<void> {
    // Type di with type ORM
    TypeORM.useContainer(Container);

    // Database connection
    await TypeORM.createConnection();

    // Registers enums to schema
    registerEnumsToSchema();

    // Building scheme with type-graphql
    const schema = await buildSchema({
        resolvers: [UserResolver],
        container: Container,
        authChecker,
    });

    // Express app
    const app = express();

    app.use(Sentry.Handlers.requestHandler());

    // Setup /graphql/metrics endpoint for prometheus
    app.get('/graphql/metrics', (_, res) => res.send(registerPrometheusClient.metrics()));
    const apolloMetricsPlugin = createMetricsPlugin(registerPrometheusClient);

    const isEnvDev = config.environment === 'dev';

    // Apollo server
    const server = new ApolloServer({
        schema,
        context: contextFactory,
        formatError: errorFormatter,
        debug: isEnvDev,
        introspection: isEnvDev,
        playground: isEnvDev,

        // @ts-ignore
        plugins: [apolloMetricsPlugin, apolloServerSentryPlugin, apolloClearContainerPlugin],
        tracing: true,
    });

    server.applyMiddleware({ app });

    app.listen({ port: 4000 }, () => {
        console.log(`Server ready at http://localhost:4000${server.graphqlPath}`);
    });
}

bootstrap();
