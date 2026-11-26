import { defineStorage } from '@aws-amplify/backend';
export const storage = defineStorage({
  name: 'photoBucket',
  access: (allow) => ({
    'photos/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.groups(['USERS', 'ADMINS']).to(['read', 'write', 'delete']),
    ],
  }),
});