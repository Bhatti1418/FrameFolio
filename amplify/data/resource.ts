import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

const schema = a.schema({
  Photo: a.model({
    title: a.string().required(),
    description: a.string(),
    s3Key: a.string().required(),
  }).authorization((allow) => [allow.owner(), allow.authenticated().to(['read'])]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: { defaultAuthorizationMode: 'userPool' },
});