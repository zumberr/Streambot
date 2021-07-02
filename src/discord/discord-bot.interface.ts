import { TwitchSourceInitParams } from '../sources/twitch/twitch-source.interface';
import { TrovoSourceInitParams } from '../sources/trovo/trovo-source.interface';

export interface StreambotInitParams {
  token: string;
  sources: {
    twitch: TwitchSourceInitParams;
    trovo: TrovoSourceInitParams;
  };
}

export interface GuildSettings {
  guildName: string;
  guildId: string;
  channelId?: string;
  announcementMessage: string;
  devStreamEnabled: boolean;
  sources: Sources;
}

export type Source = 'twitch' | 'trovo';

export type Sources = {
  [key in Source]: StreamerList;
};

export interface StreamerList {
  [key: string]: StreamerInfo;
}

export interface StreamerInfo {
  userId: string;
  displayName: string;
  lastStreamMessageId?: string;
}

export const DEV_STREAMER_INFO = {
  twitch: {
    userId: '53547736',
    displayName: 'xRedeven',
  },
  trovo: {
    userId: '102814782',
    displayName: 'redeven',
  },
};
