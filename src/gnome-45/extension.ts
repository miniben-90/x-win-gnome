import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Meta from "gi://Meta";
import Shell from "gi://Shell";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

import type { XWinIcon, XWinWindowInfo } from "../../types/x-win.js";

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

  public enable() {
    this.#dbus = Gio.DBusExportedObject.wrapJSObject(
      XWinWaylandExtension.DBUS_OBJECT,
      this
    );

    this.#dbus?.export(
      Gio.DBus.session,
      "/org/gnome/Shell/Extensions/XWinWaylandExtension"
    );
  }

  public disable() {
    this.#dbus?.flush();
    this.#dbus?.unexport();
    this.#dbus = undefined;
  }

  public get_open_windows(): string {
    const open_windows = global
      .get_window_actors()
      .filter(value => {
        return this._filterWindow(value);
      })
      .map(value => {
        return this._strcut_data(value);
      });
    return JSON.stringify(open_windows);
  }

  public get_active_window(): string {
    const active_window = global
      .get_window_actors()
      .find(
        (window_actor) =>
          window_actor?.get_meta_window()?.has_focus() &&
          this._filterWindow(window_actor)
      );
    const windowInfo = this._strcut_data(active_window);
    return JSON.stringify(windowInfo);
  }

  public get_icon(window_id: number): string {
    const iconInfo = this._get_icon(window_id);
    return JSON.stringify(iconInfo);
  }

  private _get_icon(window_id: number): XWinIcon {
    let icon: XWinIcon = {
      data: "",
      height: 0,
      width: 0,
    };

    if (window_id) {
      const window_actors: Meta.WindowActor[] = global
        .get_window_actors()
        .filter(this._filterWindow);

      const meta_window: Meta.Window | null | undefined = window_actors
        .find(
          (window_actor) =>
            window_actor?.get_meta_window()?.get_id() === window_id
        )
        ?.get_meta_window();

      if (meta_window && meta_window !== undefined && meta_window !== null) {
        const tracker = Shell.WindowTracker.get_default();
        const window_app = tracker.get_window_app(meta_window);
        if (window_app) {
          const icon = window_app.get_icon();
          if (icon) {
            const iconTheme = new St.IconTheme();
            const iconInfo = iconTheme.lookup_by_gicon(
              icon,
              128,
              St.IconLookupFlags.FORCE_SIZE
            );
            if (iconInfo) {
              const pixBuf = iconInfo.load_icon();
              if (pixBuf) {
                const [success, unitArray] = pixBuf.save_to_bufferv(
                  "png",
                  [],
                  []
                );
                if (success && unitArray.length) {
                  const data = GLib.base64_encode(unitArray);
                  if (data) {
                    return {
                      data: "data:image/png;base64," + data,
                      height: pixBuf.get_height(),
                      width: pixBuf.get_width(),
                    };
                  }
                }
              }
            }
          }
        }
      }
    }

    return icon;
  }

  private _filterWindow(
    window_actor: Meta.WindowActor,
    _index?: number,
    _array?: Meta.WindowActor[]
  ) {
    return window_actor?.get_meta_window()?.get_window_type() !== -1;
  }

  private _strcut_data(
    window_actor: Meta.WindowActor | undefined
  ): XWinWindowInfo {
    let window_info: XWinWindowInfo = {
      id: 0,
      os: "linux",
      title: "",
      info: {
        process_id: 0,
        path: "",
        exec_name: "",
        name: "",
      },
      position: {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        isFullScreen: false,
      },
      usage: { memory: 0 },
    };

    const meta_window = window_actor?.get_meta_window();

    if (meta_window && meta_window !== undefined && meta_window !== null) {
      const process_id = meta_window?.get_pid() ?? 0;

      const info = Object.assign(this._get_process_info(process_id), {
        name: meta_window?.get_wm_class() ?? "",
        process_id,
      });

      window_info = Object.assign(window_info, {
        id: meta_window.get_id(),
        info,
        title: meta_window?.get_title() ?? "",
        position: {
          width: window_actor?.get_width() ?? 0,
          height: window_actor?.get_height() ?? 0,
          x: window_actor?.get_x() ?? 0,
          y: window_actor?.get_y() ?? 0,
          isFullScreen: meta_window?.is_fullscreen() ?? false,
        },
        usage: { memory: this._get_memory_usage(process_id) },
      });
    }

    return window_info;
  }

  private _get_memory_usage(pid: number): number {
    const [isOk, contents] = GLib.file_get_contents(`/proc/${pid}/statm`);
    if (isOk) {
      return parseInt(contents.toString().split(" ")[0], 10);
    }
    return 0;
  }

  private _get_process_info(process_id: number): {
    path: string;
    exec_name: string;
  } {
    let process_info = {
      path: "",
      exec_name: "",
    };

    try {
      const path = GLib.file_read_link(`/proc/${process_id}/exe`);
      if (path) {
        process_info.path = path;
        process_info.exec_name = path.split("/").pop() ?? "";
      }
    } catch (_error) {}

    return process_info;
  }
}
