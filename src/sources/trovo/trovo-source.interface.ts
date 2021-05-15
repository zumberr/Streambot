import { Subscription } from 'rxjs';

export interface TrovoSourceInitParams {
  clientId: string;
  clientSecret: string;
}

export interface TrovoGetUsersResponse {
  total: number;
  users: TrovoUser[];
}

export interface TrovoUser {
  user_id: string;
  username: string;
  nickname: string;
  channel_id: string;
}

export interface TrovoChannel {
  is_live: boolean;
  category_id: string;
  category_name: string;
  live_title: string;
  audi_type: string;
  language_code: string;
  thumbnail: string;
  current_viewers: number;
  followers: number;
  streamer_info: string;
  profile_pic: string;
  channel_url: string;
  created_at: string;
  subscriber_num: string;
  username: string;
  social_links: {
    type: string;
    url: string;
  }[];
}

export interface TrovoSourceStreamChanges {
  guildId: string;
  userId: string;
  stream: TrovoChannel;
}

export interface TrovoSourceSubscriptions {
  [key: string]: {
    [key: string]: Subscription;
  };
}
