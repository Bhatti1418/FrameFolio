import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminAddUserToGroupCommand }
  from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  await client.send(new AdminAddUserToGroupCommand({
    GroupName: 'USERS',
    Username: event.userName,
    UserPoolId: event.userPoolId,
  }));
  return event;
};