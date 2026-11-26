import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { RestApi, LambdaIntegration, CognitoUserPoolsAuthorizer,
  AuthorizationType, Cors } from 'aws-cdk-lib/aws-apigateway';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { postConfirmation } from './auth/post-confirmation/resource';
import { apiHandler } from './api-handler/resource';

const backend = defineBackend({ auth, data, storage, postConfirmation, apiHandler });

const apiStack = backend.createStack('rest-api-stack');
const api = new RestApi(apiStack, 'PhotoRestApi', {
  restApiName: 'photo-rest-api',
  deployOptions: { stageName: 'prod' },
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: Cors.DEFAULT_HEADERS,
  },
});
const authorizer = new CognitoUserPoolsAuthorizer(apiStack, 'Authorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
});
const integration = new LambdaIntegration(backend.apiHandler.resources.lambda);

api.root.addResource('hello').addMethod('GET', integration);
api.root.addResource('me').addMethod('GET', integration, {
  authorizer, authorizationType: AuthorizationType.COGNITO,
});

backend.addOutput({
  custom: { API: { [api.restApiName]: {
    endpoint: api.url, region: Stack.of(api).region, apiName: api.restApiName,
  } } },
});