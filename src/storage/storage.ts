import { access, readFile, writeFile } from 'fs/promises';
import { defaultsDeep } from 'lodash';
import { defer, Observable, of, Subject } from 'rxjs';
import { catchError, concatMap, map, switchMap, tap } from 'rxjs/operators';
import { Settings } from './storage.interface';

export class Storage {
  private static _settings: Settings;
  private static _queue: Subject<Settings> = new Subject();

  public static init() {
    this._queue.pipe(concatMap((settings) => defer(() => writeFile('settings.json', JSON.stringify(settings, null, 2))))).subscribe();
    return this.loadSettings();
  }

  public static saveSettings(): void {
    this._queue.next(this.settings);
  }

  public static loadSettings(): Observable<Settings> {
    return defer(() => access('settings.json')).pipe(
      catchError(() => of(false)),
      map((exists) => (exists === false ? false : true)),
      switchMap((exists) =>
        exists ? defer(() => readFile('settings.json', { encoding: 'utf-8' })).pipe(map((json) => JSON.parse(json))) : of(this.getDefaultSettings()),
      ),
      map((settings) => {
        defaultsDeep(settings, this.getDefaultSettings());
        return settings;
      }),
      tap((settings) => (this._settings = settings)),
    );
  }

  public static get settings() {
    return this._settings;
  }

  private static getDefaultSettings(): Settings {
    return {
      botStatus: 'StreamBot',
      adminUsers: [],
      trovo: {
        interval: 2,
      },
      guilds: {},
    };
  }
}
