import { GuildSettings } from '../discord/discord-bot.interface';

export interface Settings {
  adminUsers: string[];
  guilds: {
    [key: string]: GuildSettings;
  };
}
