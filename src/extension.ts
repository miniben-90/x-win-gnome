import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import type Meta from 'gi://Meta';
import type {XWinIcon, XWinWindowInfo} from '../types/x-win.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';

/**
 * Gnome Extension for x-win project
 */
export default class XWinWaylandExtension extends Extension {
  #dbus?: Gio.DBusExportedObject = undefined;

  public static DBUS_OBJECT = `
<node>
  <interface name="org.gnome.Shell.Extensions.XWinWaylandExtension">
    <method name="get_active_window">
      <arg name="value" type="s" direction="out" />
    </method>
    <method name="get_open_windows">
      <arg name="value" type="s" direction="out" />
    </method>
    <method name="get_icon">
      <arg name="value" type="d" direction="in" />
      <arg name="value" type="s" direction="out" />
    </method>
  </interface>
</node>
`;

  /**
   *
   */
  public enable() {
    this.#dbus = Gio.DBusExportedObject.wrapJSObject(
      XWinWaylandExtension.DBUS_OBJECT,
      this
    );
    this.#dbus.export(
      Gio.DBus.session,
      '/org/gnome/Shell/Extensions/XWinWaylandExtension'
    );
  }

  /**
   *
   */
  public disable() {
    if (this.#dbus !== undefined) {
      this.#dbus.flush();
      this.#dbus.unexport();
    }
    this.#dbus = undefined;
  }

  /**
   *
   */
  public get_open_windows(): string {
    const open_windows = global
      .get_window_actors()
      .filter(value => {
        return this._filterWindow(value);
      })
      .map(value => {
        return this._strcutData(value);
      });
    return JSON.stringify(open_windows);
  }

  /**
   *
   */
  public get_active_window(): string {
    const active_window = global.get_window_actors().find(window_actor => {
      return (
        window_actor.get_meta_window()?.has_focus() &&
        this._filterWindow(window_actor)
      );
    });
    const windowInfo = this._strcutData(active_window);
    return JSON.stringify(windowInfo);
  }

  /**
   *
   */
  public get_icon(window_id: number): string {
    const iconInfo = this._getIcon(window_id);
    return JSON.stringify(iconInfo);
  }

  private _emptyIconInfo(): XWinIcon {
    return {
      data: '',
      height: 0,
      width: 0,
    };
  }

  private _emptyWindowInfo(): XWinWindowInfo {
    return {
      id: 0,
      os: 'linux',
      title: '',
      info: {
        process_id: 0,
        path: '',
        exec_name: '',
        name: '',
      },
      position: {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        isFullScreen: false,
      },
      usage: {memory: 0},
    };
  }

  private _getIcon(window_id: number): XWinIcon {
    const windowActors: Meta.WindowActor[] = global
      .get_window_actors()
      .filter(this._filterWindow);

    const metaWindow: Meta.Window | null | undefined = windowActors
      .find(
        windowActor => windowActor.get_meta_window()?.get_id() === window_id
      )
      ?.get_meta_window();

    if (!metaWindow || !metaWindow.get_id) {
      return this._emptyIconInfo();
    }
    const tracker = Shell.WindowTracker.get_default();
    const windowApp = tracker.get_window_app(metaWindow);
    const windowIcon = windowApp.get_icon();
    const iconTheme = new St.IconTheme();
    const iconInfo = iconTheme.lookup_by_gicon(
      windowIcon,
      128,
      St.IconLookupFlags.FORCE_SIZE
    );
    if (!iconInfo || !iconInfo.load_icon) {
      return this._emptyIconInfo();
    }
    const icon_buffer = iconInfo.load_icon();
    const [success, unitArray] = icon_buffer.save_to_bufferv('png', [], []);
    if (!success) {
      return this._emptyIconInfo();
    }
    const data = GLib.base64_encode(unitArray);
    return {
      data: 'data:image/png;base64,' + data,
      height: icon_buffer.get_height(),
      width: icon_buffer.get_width(),
    };
  }

  private _filterWindow(
    window_actor: Meta.WindowActor,
    _index?: number,
    _array?: Meta.WindowActor[]
  ) {
    return window_actor.get_meta_window()?.get_window_type() !== -1;
  }

  private _strcutData(
    window_actor: Meta.WindowActor | undefined
  ): XWinWindowInfo {
    if (!window_actor || !window_actor.get_meta_window) {
      return this._emptyWindowInfo();
    }
    const metaWindow = window_actor.get_meta_window();
    if (!metaWindow) {
      return this._emptyWindowInfo();
    }

    const process_id = metaWindow.get_pid ? metaWindow.get_pid() : 0;
    const info = Object.assign(this._getProcessInfo(process_id), {
      name: metaWindow.get_wm_class ? metaWindow.get_wm_class() : '',
      process_id,
    });

    return Object.assign(this._emptyWindowInfo(), {
      id: metaWindow.get_id ? metaWindow.get_id() : 0,
      info,
      title: metaWindow.get_title ? metaWindow.get_title() : '',
      position: {
        width: window_actor.get_width ? window_actor.get_width() : 0,
        height: window_actor.get_height ? window_actor.get_height() : 0,
        x: window_actor.get_x ? window_actor.get_x() : 0,
        y: window_actor.get_y ? window_actor.get_y() : 0,
        isFullScreen: metaWindow.is_fullscreen
          ? metaWindow.is_fullscreen()
          : false,
      },
      usage: {memory: this._getMemoryUsage(process_id)},
    });
  }

  private _getMemoryUsage(pid: number): number {
    const [isOk, contents] = GLib.file_get_contents(`/proc/${pid}/statm`);
    if (isOk) {
      return parseInt(contents.toString().split(' ')[0], 10);
    }
    return 0;
  }

  private _getProcessInfo(process_id: number): {
    path: string;
    exec_name: string;
  } {
    const process_info = {
      path: '',
      exec_name: '',
    };

    try {
      const path = GLib.file_read_link(`/proc/${process_id}/exe`);
      if (path) {
        process_info.path = path;
        process_info.exec_name = path.split('/').pop() || '';
      }
    } catch {
      /* empty */
    }
    return process_info;
  }
}
