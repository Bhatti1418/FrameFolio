import { defineAuth, secret } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile', 'openid'],
      },
      callbackUrls: ['http://localhost:5173/'],
      logoutUrls: ['http://localhost:5173/'],
    },
  },
  groups: ['ADMINS', 'USERS'],
  triggers: { postConfirmation },
  access: (allow) => [allow.resource(postConfirmation).to(['addUserToGroup'])],
});