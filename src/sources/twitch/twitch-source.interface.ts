import { HelixStream } from 'twitch';
import { Subscription } from 'twitch-webhooks';

export interface TwitchSourceInitParams {
  clientId: string;
  clientSecret: string;
  hostName: string;
  listenerPort: number;
}

export interface TwitchSourceStreamChanges {
  guildId: string;
  userId: string;
  stream: HelixStream;
}

export interface TwitchSourceSubscriptions {
  [key: string]: {
    [key: string]: Subscription;
  };
}
